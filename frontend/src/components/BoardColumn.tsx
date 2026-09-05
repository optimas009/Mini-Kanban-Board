'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { KanbanColumn, KanbanTask } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface BoardColumnProps {
  column: KanbanColumn;
  index: number;
  totalColumns: number;
  onAddTask: (column: KanbanColumn) => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
  onEditColumn: (column: KanbanColumn) => void;
  onDeleteColumn: (column: KanbanColumn) => void;
  onMoveColumn: (column: KanbanColumn, position: number) => void;
}

export function BoardColumn({
  column,
  index,
  totalColumns,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onEditColumn,
  onDeleteColumn,
  onMoveColumn,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <section
      data-signal={column.color}
      className="flex w-[312px] shrink-0 flex-col border border-(--board-edge) bg-(--board-deep)/35"
      style={{ borderRadius: 3 }}
    >
      {/* The signboard: a solid signal bar naming the stage. */}
      <header className="bg-(--signal)" style={{ borderRadius: '2px 2px 0 0' }}>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <button
            type="button"
            onClick={() => onEditColumn(column)}
            title="Edit name and colour"
            className="group/title flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left"
          >
            <h2 className="stamp truncate text-[15px] text-white">{column.title}</h2>
            <EditIcon />
          </button>

          <span className="stamp shrink-0 bg-black/25 px-1.5 py-1 text-[13px] text-white">
            {column.tasks.length}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-white/20 px-2.5 py-1">
          <span className="text-[11px] font-medium text-white/75">
            Stage {index + 1} of {totalColumns}
          </span>

          <div className="flex items-center gap-0.5">
            <IconButton
              label={`Move ${column.title} left`}
              title="Move left"
              disabled={index === 0}
              onClick={() => onMoveColumn(column, index - 1)}
            >
              <ArrowIcon direction="left" />
            </IconButton>
            <IconButton
              label={`Move ${column.title} right`}
              title="Move right"
              disabled={index === totalColumns - 1}
              onClick={() => onMoveColumn(column, index + 1)}
            >
              <ArrowIcon direction="right" />
            </IconButton>
            <IconButton
              label={`Delete ${column.title}`}
              title="Delete column"
              onClick={() => onDeleteColumn(column)}
            >
              <TrashIcon />
            </IconButton>
          </div>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={`kanban-scroll min-h-[240px] flex-1 space-y-0 overflow-y-auto p-2 transition-colors ${
          isOver ? 'bg-(--signal-tint)' : ''
        }`}
      >
        <SortableContext
          items={column.tasks.map((task) => `task:${task.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <DropSlot columnId={column.id} position={0} />

          {column.tasks.map((task, taskIndex) => (
            <div key={task.id}>
              <TaskCard
                task={task}
                color={column.color}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
              <DropSlot columnId={column.id} position={taskIndex + 1} />
            </div>
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div
            className="flex min-h-24 items-center justify-center border border-dashed border-(--board-edge) px-4 text-center"
            style={{ borderRadius: 3 }}
          >
            <p className="text-xs text-(--ink-soft)">
              No cards in this stage yet
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-(--board-edge) p-2">
        <button
          type="button"
          onClick={() => onAddTask(column)}
          className="w-full border border-(--board-edge) bg-(--stock) px-3 py-2 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
          style={{ borderRadius: 3 }}
        >
          Add card
        </button>
      </div>
    </section>
  );
}

function IconButton({
  label,
  title,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
      style={{ borderRadius: 2 }}
    >
      {children}
    </button>
  );
}

/**
 * An insertion point between cards. The hit area is deliberately taller than
 * the visible line so dropping does not need pixel accuracy.
 */
function DropSlot({ columnId, position }: { columnId: string; position: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${columnId}:${position}`,
    data: { type: 'task-slot', columnId, position },
  });

  return (
    <div className="relative h-2.5" aria-hidden="true">
      <div ref={setNodeRef} className="absolute -top-2 -bottom-2 left-0 right-0 z-10">
        <div
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all duration-100 ${
            isOver ? 'h-[3px] bg-(--ink)' : 'h-px bg-transparent'
          }`}
        />
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-white/0 transition group-hover/title:text-white/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m4 20 4.2-1 10-10a2 2 0 0 0-2.8-2.8l-10 10L4 20Z" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? <path d="M14 6l-6 6 6 6" /> : <path d="M10 6l6 6-6 6" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}
