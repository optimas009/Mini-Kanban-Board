import type { Active, Over } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';

import { applyTaskMove, resolveDropTarget } from './board-ordering';
import type { BoardDetail, KanbanColumn, KanbanTask } from './types';

function task(id: string, columnId: string, position: number): KanbanTask {
  return {
    id,
    title: id.toUpperCase(),
    description: null,
    position,
    columnId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function column(id: string, taskIds: string[], position: number): KanbanColumn {
  return {
    id,
    title: id,
    color: 'navy',
    position,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tasks: taskIds.map((taskId, index) => task(taskId, id, index)),
  };
}

/** todo: a, b, c, d   |   doing: x, y   |   done: (empty) */
function board(): BoardDetail {
  return {
    id: 'board-1',
    name: 'Board',
    ownerId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    owner: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
    members: [],
    columns: [
      column('todo', ['a', 'b', 'c', 'd'], 0),
      column('doing', ['x', 'y'], 1),
      column('done', [], 2),
    ],
  };
}

function activeTask(id: string, top = 0, height = 100): Active {
  return {
    id: `task:${id}`,
    data: { current: undefined },
    rect: {
      current: {
        initial: { top, left: 0, width: 300, height, bottom: top + height, right: 300 },
        translated: { top, left: 0, width: 300, height, bottom: top + height, right: 300 },
      },
    },
  } as unknown as Active;
}

function overSlot(columnId: string, position: number): Over {
  return {
    id: `slot:${columnId}:${position}`,
    data: { current: { type: 'task-slot', columnId, position } },
    rect: { top: 0, left: 0, width: 300, height: 12, bottom: 12, right: 300 },
  } as unknown as Over;
}

function overTask(id: string, top = 0, height = 100): Over {
  return {
    id: `task:${id}`,
    data: { current: undefined },
    rect: { top, left: 0, width: 300, height, bottom: top + height, right: 300 },
  } as unknown as Over;
}

function overColumn(columnId: string): Over {
  return {
    id: `column:${columnId}`,
    data: { current: { type: 'column', columnId } },
    rect: { top: 0, left: 0, width: 300, height: 600, bottom: 600, right: 300 },
  } as unknown as Over;
}

describe('resolveDropTarget', () => {
  describe('dropping on a gap between cards', () => {
    it('moves a task up to the requested gap', () => {
      // c is at index 2; gap 0 is above a.
      expect(resolveDropTarget(board(), activeTask('c'), overSlot('todo', 0))).toEqual(
        { targetColumnId: 'todo', targetPosition: 0 },
      );
    });

    it('compensates for the lifted task when moving down in the same column', () => {
      // a is at index 0. Gap 3 sits between c and d in the original list, but
      // once a is lifted out that gap becomes index 2.
      expect(resolveDropTarget(board(), activeTask('a'), overSlot('todo', 3))).toEqual(
        { targetColumnId: 'todo', targetPosition: 2 },
      );
    });

    it('does not compensate when moving up', () => {
      expect(resolveDropTarget(board(), activeTask('d'), overSlot('todo', 1))).toEqual(
        { targetColumnId: 'todo', targetPosition: 1 },
      );
    });

    it('does not compensate when the gap is in another column', () => {
      expect(resolveDropTarget(board(), activeTask('a'), overSlot('doing', 2))).toEqual(
        { targetColumnId: 'doing', targetPosition: 2 },
      );
    });

    it('clamps to the last index within the same column', () => {
      expect(
        resolveDropTarget(board(), activeTask('a'), overSlot('todo', 99)),
      ).toEqual({ targetColumnId: 'todo', targetPosition: 3 });
    });

    it('allows appending past the last card in another column', () => {
      expect(
        resolveDropTarget(board(), activeTask('a'), overSlot('doing', 99)),
      ).toEqual({ targetColumnId: 'doing', targetPosition: 2 });
    });

    it('drops into an empty column at index 0', () => {
      expect(resolveDropTarget(board(), activeTask('a'), overSlot('done', 0))).toEqual(
        { targetColumnId: 'done', targetPosition: 0 },
      );
    });

    it('returns null for a slot on a column that no longer exists', () => {
      expect(
        resolveDropTarget(board(), activeTask('a'), overSlot('deleted', 0)),
      ).toBeNull();
    });
  });

  describe('dropping on another card', () => {
    it('inserts above the card when the pointer is in its top half', () => {
      // Active centre 50, over card spans 200..300 (centre 250): above.
      expect(
        resolveDropTarget(board(), activeTask('d', 0, 100), overTask('b', 200, 100)),
      ).toEqual({ targetColumnId: 'todo', targetPosition: 1 });
    });

    it('inserts below the card when the pointer is past its midpoint', () => {
      // Active centre 350, over card spans 200..300 (centre 250): below.
      expect(
        resolveDropTarget(board(), activeTask('a', 300, 100), overTask('c', 200, 100)),
      ).toEqual({ targetColumnId: 'todo', targetPosition: 2 });
    });

    it('is a no-op when dropped on itself', () => {
      expect(
        resolveDropTarget(board(), activeTask('b'), overTask('b')),
      ).toEqual({ targetColumnId: 'todo', targetPosition: 1 });
    });

    it('moves onto a card in another column', () => {
      expect(
        resolveDropTarget(board(), activeTask('a', 0, 100), overTask('y', 200, 100)),
      ).toEqual({ targetColumnId: 'doing', targetPosition: 1 });
    });

    it('returns null when the card is not on the board', () => {
      expect(
        resolveDropTarget(board(), activeTask('a'), overTask('ghost')),
      ).toBeNull();
    });
  });

  describe('dropping on the column body', () => {
    it('appends to the end of another column', () => {
      expect(resolveDropTarget(board(), activeTask('a'), overColumn('doing'))).toEqual(
        { targetColumnId: 'doing', targetPosition: 2 },
      );
    });

    it('moves to the last slot within the same column', () => {
      expect(resolveDropTarget(board(), activeTask('a'), overColumn('todo'))).toEqual(
        { targetColumnId: 'todo', targetPosition: 3 },
      );
    });

    it('drops into an empty column', () => {
      expect(resolveDropTarget(board(), activeTask('a'), overColumn('done'))).toEqual(
        { targetColumnId: 'done', targetPosition: 0 },
      );
    });

    it('returns null for an unknown column', () => {
      expect(
        resolveDropTarget(board(), activeTask('a'), overColumn('missing')),
      ).toBeNull();
    });
  });

  describe('guards', () => {
    it('ignores a drag that is not a task', () => {
      const active = { id: 'column:todo' } as unknown as Active;
      expect(resolveDropTarget(board(), active, overColumn('doing'))).toBeNull();
    });

    it('ignores a task that is not on the board', () => {
      expect(
        resolveDropTarget(board(), activeTask('ghost'), overColumn('doing')),
      ).toBeNull();
    });

    it('ignores an unrecognised drop target', () => {
      const over = { id: 'something-else', data: { current: undefined } } as unknown as Over;
      expect(resolveDropTarget(board(), activeTask('a'), over)).toBeNull();
    });
  });
});

describe('applyTaskMove', () => {
  function layout(next: BoardDetail) {
    return Object.fromEntries(
      next.columns.map((col) => [col.id, col.tasks.map((t) => t.id)]),
    );
  }

  it('reorders within a column', () => {
    expect(layout(applyTaskMove(board(), 'c', 'todo', 0))).toEqual({
      todo: ['c', 'a', 'b', 'd'],
      doing: ['x', 'y'],
      done: [],
    });
  });

  it('moves to another column at the requested index', () => {
    expect(layout(applyTaskMove(board(), 'a', 'doing', 1))).toEqual({
      todo: ['b', 'c', 'd'],
      doing: ['x', 'a', 'y'],
      done: [],
    });
  });

  it('moves into an empty column', () => {
    expect(layout(applyTaskMove(board(), 'a', 'done', 0))).toEqual({
      todo: ['b', 'c', 'd'],
      doing: ['x', 'y'],
      done: ['a'],
    });
  });

  it('renumbers positions contiguously in every column', () => {
    const next = applyTaskMove(board(), 'a', 'doing', 1);

    for (const col of next.columns) {
      expect(col.tasks.map((t) => t.position)).toEqual(
        col.tasks.map((_, index) => index),
      );
    }
  });

  it('rewrites the columnId of the moved task', () => {
    const next = applyTaskMove(board(), 'a', 'doing', 0);
    const moved = next.columns
      .flatMap((col) => col.tasks)
      .find((t) => t.id === 'a');

    expect(moved?.columnId).toBe('doing');
  });

  it('clamps a position past the end', () => {
    expect(layout(applyTaskMove(board(), 'a', 'doing', 99))).toEqual({
      todo: ['b', 'c', 'd'],
      doing: ['x', 'y', 'a'],
      done: [],
    });
  });

  it('does not mutate the board it was given', () => {
    const original = board();
    const snapshot = JSON.stringify(original);

    applyTaskMove(original, 'a', 'doing', 0);

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('returns the board unchanged for an unknown task', () => {
    const original = board();
    expect(layout(applyTaskMove(original, 'ghost', 'doing', 0))).toEqual(
      layout(original),
    );
  });

  it('returns the board unchanged for an unknown column', () => {
    const original = board();
    expect(layout(applyTaskMove(original, 'a', 'missing', 0))).toEqual(
      layout(original),
    );
  });

  it('round trips back to the original layout', () => {
    const moved = applyTaskMove(board(), 'a', 'doing', 0);
    const back = applyTaskMove(moved, 'a', 'todo', 0);

    expect(layout(back)).toEqual(layout(board()));
  });
});

describe('resolveDropTarget and applyTaskMove agree', () => {
  it('a downward drag inside a column lands where the gap was drawn', () => {
    const start = board();
    // Gap 3 is drawn between c and d.
    const target = resolveDropTarget(start, activeTask('a'), overSlot('todo', 3));
    const next = applyTaskMove(
      start,
      'a',
      target!.targetColumnId,
      target!.targetPosition,
    );

    expect(next.columns[0]!.tasks.map((t) => t.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('an upward drag inside a column lands where the gap was drawn', () => {
    const start = board();
    // Gap 1 is drawn between a and b.
    const target = resolveDropTarget(start, activeTask('d'), overSlot('todo', 1));
    const next = applyTaskMove(
      start,
      'd',
      target!.targetColumnId,
      target!.targetPosition,
    );

    expect(next.columns[0]!.tasks.map((t) => t.id)).toEqual(['a', 'd', 'b', 'c']);
  });
});
