import type { Active, Over } from '@dnd-kit/core';

import type { BoardDetail } from './types';

export interface DropTarget {
  targetColumnId: string;
  targetPosition: number;
}

/**
 * Works out which column and index a drag should land on.
 *
 * Positions are read from the board as it looked before the drag, so when a
 * task moves down inside its own column the gaps after it shift up by one once
 * the task is lifted out. That correction is the subtle part.
 */
export function resolveDropTarget(
  board: BoardDetail,
  active: Active,
  over: Over,
): DropTarget | null {
  const activeId = String(active.id);
  if (!activeId.startsWith('task:')) return null;

  const activeTaskId = activeId.slice('task:'.length);
  const sourceColumn = board.columns.find((column) =>
    column.tasks.some((task) => task.id === activeTaskId),
  );

  if (!sourceColumn) return null;

  const sourceIndex = sourceColumn.tasks.findIndex(
    (task) => task.id === activeTaskId,
  );
  const overId = String(over.id);

  if (overId.startsWith('slot:')) {
    const slotData = over.data.current as
      | { columnId?: string; position?: number }
      | undefined;

    const targetColumnId = slotData?.columnId;
    const rawSlotPosition = slotData?.position;

    if (
      !targetColumnId ||
      typeof rawSlotPosition !== 'number' ||
      !board.columns.some((column) => column.id === targetColumnId)
    ) {
      return null;
    }

    let targetPosition = rawSlotPosition;

    // Slot positions describe the gaps in the original list. When moving
    // downward inside the same column, removing the active task first shifts
    // every later gap up by one.
    if (sourceColumn.id === targetColumnId && sourceIndex < rawSlotPosition) {
      targetPosition -= 1;
    }

    const targetColumn = board.columns.find(
      (column) => column.id === targetColumnId,
    );
    const maxPosition =
      targetColumnId === sourceColumn.id
        ? Math.max(0, (targetColumn?.tasks.length ?? 1) - 1)
        : (targetColumn?.tasks.length ?? 0);

    return {
      targetColumnId,
      targetPosition: Math.max(0, Math.min(targetPosition, maxPosition)),
    };
  }

  if (overId.startsWith('task:')) {
    const overTaskId = overId.slice('task:'.length);
    const targetColumn = board.columns.find((column) =>
      column.tasks.some((task) => task.id === overTaskId),
    );

    if (!targetColumn) return null;

    const overIndex = targetColumn.tasks.findIndex(
      (task) => task.id === overTaskId,
    );

    if (overTaskId === activeTaskId) {
      return {
        targetColumnId: sourceColumn.id,
        targetPosition: sourceIndex,
      };
    }

    const overRect = over.rect;
    const activeRect =
      active.rect.current.translated ?? active.rect.current.initial;
    const isBelowMidpoint =
      overRect && activeRect
        ? activeRect.top + activeRect.height / 2 >
          overRect.top + overRect.height / 2
        : false;

    let rawTargetPosition = overIndex + (isBelowMidpoint ? 1 : 0);

    if (sourceColumn.id === targetColumn.id && sourceIndex < rawTargetPosition) {
      rawTargetPosition -= 1;
    }

    const maxPosition =
      sourceColumn.id === targetColumn.id
        ? Math.max(0, targetColumn.tasks.length - 1)
        : targetColumn.tasks.length;

    return {
      targetColumnId: targetColumn.id,
      targetPosition: Math.max(0, Math.min(rawTargetPosition, maxPosition)),
    };
  }

  if (overId.startsWith('column:')) {
    const targetColumnId = overId.slice('column:'.length);
    const targetColumn = board.columns.find(
      (column) => column.id === targetColumnId,
    );

    if (!targetColumn) return null;

    // The bare column body is only a fallback for empty space. Treat it as
    // the end of the list; the explicit slot droppables handle every exact
    // position between cards, including the top.
    return {
      targetColumnId,
      targetPosition:
        sourceColumn.id === targetColumnId
          ? Math.max(0, targetColumn.tasks.length - 1)
          : targetColumn.tasks.length,
    };
  }

  return null;
}

/**
 * Returns a copy of the board with the task moved, positions renumbered
 * contiguously. Used to update the cache optimistically while the request
 * is in flight.
 */
export function applyTaskMove(
  board: BoardDetail,
  taskId: string,
  targetColumnId: string,
  targetPosition: number,
): BoardDetail {
  const columns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => ({ ...task })),
  }));

  const sourceColumn = columns.find((column) =>
    column.tasks.some((task) => task.id === taskId),
  );
  const targetColumn = columns.find((column) => column.id === targetColumnId);

  if (!sourceColumn || !targetColumn) return board;

  const sourceIndex = sourceColumn.tasks.findIndex((task) => task.id === taskId);
  const [task] = sourceColumn.tasks.splice(sourceIndex, 1);

  if (!task) return board;

  const safePosition = Math.max(
    0,
    Math.min(targetPosition, targetColumn.tasks.length),
  );

  targetColumn.tasks.splice(safePosition, 0, {
    ...task,
    columnId: targetColumn.id,
  });

  for (const column of columns) {
    column.tasks = column.tasks.map((currentTask, position) => ({
      ...currentTask,
      position,
    }));
  }

  return { ...board, columns };
}
