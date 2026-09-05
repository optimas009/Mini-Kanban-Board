'use client';

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { apiFetch, getErrorMessage } from '@/lib/api';
import { applyTaskMove, resolveDropTarget } from '@/lib/board-ordering';
import type { BoardDetail, ColumnColor, KanbanColumn, KanbanTask } from '@/lib/types';
import { BoardColumn } from './BoardColumn';
import { ColorPicker } from './ColorPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { TaskCardOverlay } from './TaskCard';

interface BoardViewProps {
  board: BoardDetail;
  token: string | null;
}

interface TaskEditorState {
  mode: 'create' | 'edit';
  columnId: string;
  task?: KanbanTask;
}

type DeleteTarget =
  | { type: 'task'; id: string; title: string }
  | { type: 'column'; id: string; title: string }
  | null;

export function BoardView({ board, token }: BoardViewProps) {
  const queryClient = useQueryClient();

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState<ColumnColor>('navy');
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [columnError, setColumnError] = useState('');

  const [editColumn, setEditColumn] = useState<KanbanColumn | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [editColumnColor, setEditColumnColor] = useState<ColumnColor>('navy');

  const [taskEditor, setTaskEditor] = useState<TaskEditorState | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskError, setTaskError] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const dragSnapshotRef = useRef<BoardDetail | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const activeTask = useMemo(
    () =>
      activeTaskId
        ? board.columns.flatMap((column) => column.tasks).find((task) => task.id === activeTaskId) ?? null
        : null,
    [activeTaskId, board.columns],
  );

  async function invalidateBoard() {
    await queryClient.invalidateQueries({ queryKey: ['board', board.id] });
  }

  const createColumnMutation = useMutation({
    mutationFn: (payload: { title: string; color: ColumnColor }) =>
      apiFetch(
        `/boards/${board.id}/columns`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      ),
    onSuccess: async () => {
      setNewColumnTitle('');
      setNewColumnColor('navy');
      setShowCreateColumn(false);
      setColumnError('');
      await invalidateBoard();
    },
    onError: (error) => setColumnError(getErrorMessage(error)),
  });

  const updateColumnMutation = useMutation({
    mutationFn: (payload: { columnId: string; title: string; color: ColumnColor }) =>
      apiFetch(
        `/columns/${payload.columnId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: payload.title,
            color: payload.color,
          }),
        },
        token,
      ),
    onSuccess: async () => {
      setEditColumn(null);
      await invalidateBoard();
    },
  });

  const moveColumnMutation = useMutation({
    mutationFn: (payload: { columnId: string; position: number }) =>
      apiFetch(
        `/columns/${payload.columnId}/move`,
        {
          method: 'PATCH',
          body: JSON.stringify({ position: payload.position }),
        },
        token,
      ),
    onSuccess: invalidateBoard,
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) =>
      apiFetch(`/columns/${columnId}`, { method: 'DELETE' }, token),
    onSuccess: invalidateBoard,
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: { columnId: string; title: string; description: string }) =>
      apiFetch(
        `/columns/${payload.columnId}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: payload.title,
            description: payload.description || undefined,
          }),
        },
        token,
      ),
    onSuccess: async () => {
      closeTaskEditor();
      await invalidateBoard();
    },
    onError: (error) => setTaskError(getErrorMessage(error)),
  });

  const updateTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; title: string; description: string }) =>
      apiFetch(
        `/tasks/${payload.taskId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
          }),
        },
        token,
      ),
    onSuccess: async () => {
      closeTaskEditor();
      await invalidateBoard();
    },
    onError: (error) => setTaskError(getErrorMessage(error)),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/tasks/${taskId}`, { method: 'DELETE' }, token),
    onSuccess: invalidateBoard,
  });

  const moveTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; columnId: string; position: number }) =>
      apiFetch(
        `/tasks/${payload.taskId}/move`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            columnId: payload.columnId,
            position: payload.position,
          }),
        },
        token,
      ),
  });

  function openCreateTask(column: KanbanColumn) {
    setTaskEditor({ mode: 'create', columnId: column.id });
    setTaskTitle('');
    setTaskDescription('');
    setTaskError('');
  }

  function openEditTask(task: KanbanTask) {
    setTaskEditor({ mode: 'edit', columnId: task.columnId, task });
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? '');
    setTaskError('');
  }

  function closeTaskEditor() {
    setTaskEditor(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskError('');
  }

  function saveTask(event: React.FormEvent) {
    event.preventDefault();

    const title = taskTitle.trim();
    const description = taskDescription.trim();

    if (!title) {
      setTaskError('Task title is required');
      return;
    }

    if (!taskEditor) return;

    if (taskEditor.mode === 'create') {
      createTaskMutation.mutate({
        columnId: taskEditor.columnId,
        title,
        description,
      });
      return;
    }

    if (taskEditor.task) {
      updateTaskMutation.mutate({
        taskId: taskEditor.task.id,
        title,
        description,
      });
    }
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith('task:')) {
      setActiveTaskId(id.slice('task:'.length));
      dragSnapshotRef.current =
        queryClient.getQueryData<BoardDetail>(['board', board.id]) ?? null;
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);

    const { active, over } = event;
    const activeId = String(active.id);
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;

    if (!activeId.startsWith('task:') || !over) return;

    const taskId = activeId.slice('task:'.length);
    const sourceBoard = snapshot ?? board;
    const resolved = resolveDropTarget(sourceBoard, active, over);

    if (!resolved) return;

    const originalColumn = sourceBoard.columns.find((column) =>
      column.tasks.some((task) => task.id === taskId),
    );

    if (!originalColumn) return;

    const originalPosition = originalColumn.tasks.findIndex(
      (task) => task.id === taskId,
    );

    if (
      originalColumn.id === resolved.targetColumnId &&
      originalPosition === resolved.targetPosition
    ) {
      return;
    }

    const optimisticBoard = applyTaskMove(
      sourceBoard,
      taskId,
      resolved.targetColumnId,
      resolved.targetPosition,
    );

    queryClient.setQueryData(['board', board.id], optimisticBoard);

    moveTaskMutation.mutate(
      {
        taskId,
        columnId: resolved.targetColumnId,
        position: resolved.targetPosition,
      },
      {
        onError: () => {
          if (snapshot) {
            queryClient.setQueryData(['board', board.id], snapshot);
          }
        },
        onSettled: invalidateBoard,
      },
    );
  }

  function onDragCancel() {
    setActiveTaskId(null);
    dragSnapshotRef.current = null;
  }

  const totalTasks = board.columns.reduce((sum, column) => sum + column.tasks.length, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--ink-soft)">
          <span className="font-semibold text-(--ink)">{board.columns.length}</span>{' '}
          {board.columns.length === 1 ? 'stage' : 'stages'}
          <span className="px-2 text-(--ink-faint)">/</span>
          <span className="font-semibold text-(--ink)">{totalTasks}</span>{' '}
          {totalTasks === 1 ? 'card' : 'cards'}
        </p>

        <button
          type="button"
          onClick={() => {
            setNewColumnTitle('');
            setNewColumnColor('navy');
            setColumnError('');
            setShowCreateColumn(true);
          }}
          className="bg-(--ink) px-4 py-2 text-sm font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
          style={{ borderRadius: 3 }}
        >
          Add stage
        </button>
      </div>

      {board.columns.length === 0 ? (
        <div
          className="stock-flat flex flex-col items-center justify-center px-6 py-16 text-center"
        >
          <h2 className="stamp text-xl text-(--ink)">Nothing on the board yet</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-(--ink-soft)">
            Stages are the columns work moves through, like Todo, In progress
            and Done. Add your first one to start.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={taskCollisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          autoScroll={{
            threshold: { x: 0.22, y: 0.15 },
            acceleration: 12,
            interval: 5,
          }}
        >
          <div className="kanban-scroll flex min-h-[560px] items-start gap-3 overflow-x-auto pb-4">
            {board.columns.map((column, index) => (
              <BoardColumn
                key={column.id}
                column={column}
                index={index}
                totalColumns={board.columns.length}
                onAddTask={openCreateTask}
                onEditTask={openEditTask}
                onDeleteTask={(task) =>
                  setDeleteTarget({
                    type: 'task',
                    id: task.id,
                    title: task.title,
                  })
                }
                onEditColumn={(selectedColumn) => {
                  setEditColumn(selectedColumn);
                  setEditColumnTitle(selectedColumn.title);
                  setEditColumnColor(selectedColumn.color ?? 'navy');
                }}
                onDeleteColumn={(selectedColumn) =>
                  setDeleteTarget({
                    type: 'column',
                    id: selectedColumn.id,
                    title: selectedColumn.title,
                  })
                }
                onMoveColumn={(selectedColumn, position) =>
                  moveColumnMutation.mutate({
                    columnId: selectedColumn.id,
                    position,
                  })
                }
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal
        open={showCreateColumn}
        title="Add stage"
        onClose={() => setShowCreateColumn(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const title = newColumnTitle.trim();

            if (!title) {
              setColumnError('Give the stage a name');
              return;
            }

            createColumnMutation.mutate({
              title,
              color: newColumnColor,
            });
          }}
          className="space-y-4"
        >
          <Field label="Stage name">
            <input
              value={newColumnTitle}
              onChange={(event) => setNewColumnTitle(event.target.value)}
              maxLength={80}
              autoFocus
              placeholder="In progress"
              className={inputClass}
            />
          </Field>

          <ColorPicker value={newColumnColor} onChange={setNewColumnColor} />

          {columnError && <FormError>{columnError}</FormError>}

          <FormActions
            onCancel={() => setShowCreateColumn(false)}
            submitLabel="Add stage"
            busy={createColumnMutation.isPending}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(editColumn)}
        title="Edit stage"
        onClose={() => setEditColumn(null)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const title = editColumnTitle.trim();

            if (editColumn && title) {
              updateColumnMutation.mutate({
                columnId: editColumn.id,
                title,
                color: editColumnColor,
              });
            }
          }}
          className="space-y-4"
        >
          <Field label="Stage name">
            <input
              value={editColumnTitle}
              onChange={(event) => setEditColumnTitle(event.target.value)}
              maxLength={80}
              autoFocus
              className={inputClass}
            />
          </Field>

          <ColorPicker value={editColumnColor} onChange={setEditColumnColor} />

          <FormActions
            onCancel={() => setEditColumn(null)}
            submitLabel="Save changes"
            busy={updateColumnMutation.isPending}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(taskEditor)}
        title={taskEditor?.mode === 'edit' ? 'Edit card' : 'Add card'}
        onClose={closeTaskEditor}
      >
        <form onSubmit={saveTask} className="space-y-4">
          <Field label="Title">
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              maxLength={200}
              autoFocus
              placeholder="What needs doing?"
              className={inputClass}
            />
          </Field>

          <Field label="Details">
            <textarea
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Anything the next person needs to know"
              className={`${inputClass} resize-y`}
            />
          </Field>

          {taskError && <FormError>{taskError}</FormError>}

          <FormActions
            onCancel={closeTaskEditor}
            submitLabel="Save card"
            busy={createTaskMutation.isPending || updateTaskMutation.isPending}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'column' ? 'Delete this stage?' : 'Delete this card?'}
        description={
          deleteTarget?.type === 'column'
            ? `“${deleteTarget.title}” and every card in it will be deleted. This cannot be undone.`
            : deleteTarget
              ? `“${deleteTarget.title}” will be deleted. This cannot be undone.`
              : ''
        }
        confirmLabel={deleteTarget?.type === 'column' ? 'Delete stage' : 'Delete card'}
        destructive
        busy={deleteColumnMutation.isPending || deleteTaskMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;

          if (deleteTarget.type === 'column') {
            deleteColumnMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          } else {
            deleteTaskMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
      />
    </>
  );
}

const inputClass =
  'w-full border border-(--rule) bg-white px-3 py-2.5 text-sm text-(--ink) outline-none transition placeholder:text-(--ink-faint) focus:border-(--ink)';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-(--ink)">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="border border-(--alert)/30 bg-(--alert-tint) px-3 py-2 text-sm text-(--alert)"
      style={{ borderRadius: 3 }}
      role="alert"
    >
      {children}
    </p>
  );
}

function FormActions({
  onCancel,
  submitLabel,
  busy,
}: {
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-(--rule) pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="border border-(--rule) px-4 py-2 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
        style={{ borderRadius: 3 }}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="bg-(--ink) px-4 py-2 text-sm font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
        style={{ borderRadius: 3 }}
      >
        {busy ? 'Saving' : submitLabel}
      </button>
    </div>
  );
}

const taskCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    // Insertion slots intentionally overlap the edges around task cards so the
    // user does not need pixel-perfect aiming. Always prefer a slot when one is
    // under the pointer, then a task card, and use the column body only as a
    // final fallback.
    const slotTargets = pointerCollisions.filter((collision) =>
      String(collision.id).startsWith('slot:'),
    );

    if (slotTargets.length > 0) return slotTargets;

    const taskTargets = pointerCollisions.filter((collision) =>
      String(collision.id).startsWith('task:'),
    );

    if (taskTargets.length > 0) return taskTargets;

    return pointerCollisions;
  }

  return closestCorners(args);
};
