'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { ColumnColor, KanbanTask } from '@/lib/types';

interface TaskCardProps {
  task: KanbanTask;
  color: ColumnColor;
  onEdit: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
}

export function TaskCard({ task, color, onEdit, onDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `task:${task.id}`,
      data: { type: 'task', taskId: task.id, columnId: task.columnId },
    });

  return (
    <article
      ref={setNodeRef}
      data-signal={color}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderRadius: 3,
      }}
      className={`group relative flex border border-(--board-edge) bg-(--stock-raised) ${
        isDragging
          ? 'opacity-30'
          : 'shadow-[2px_2px_0_rgba(28,29,26,0.12)] transition-shadow hover:shadow-[3px_3px_0_rgba(28,29,26,0.2)]'
      }`}
    >
      {/* Signal tab: which stage this card belongs to, readable at a glance. */}
      <span
        className="w-[5px] shrink-0 bg-(--signal)"
        aria-hidden="true"
      />

      <button
        type="button"
        aria-label={`Drag ${task.title}`}
        title="Drag to move"
        className="flex w-8 shrink-0 touch-none select-none items-center justify-center border-r border-(--rule) text-(--ink-faint) transition hover:bg-(--signal-tint) hover:text-(--signal)"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={() => onEdit(task)}
        className="min-w-0 flex-1 px-3 py-2.5 text-left"
      >
        <h3 className="break-words text-sm font-semibold leading-snug text-(--ink)">
          {task.title}
        </h3>
        {task.description ? (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-(--ink-soft)">
            {task.description}
          </p>
        ) : (
          <p className="mt-1 text-xs text-(--ink-faint)">Add details</p>
        )}
      </button>

      {/*
        Delete stays visible rather than appearing on hover: a hover-only
        control is unreachable on touch devices.
      */}
      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Delete ${task.title}`}
        title="Delete task"
        className="m-1.5 flex h-7 w-7 shrink-0 items-center justify-center self-start text-(--ink-faint) transition hover:bg-(--alert-tint) hover:text-(--alert)"
        style={{ borderRadius: 3 }}
      >
        <TrashIcon />
      </button>
    </article>
  );
}

/** The card as it looks while held, lifted off the board. */
export function TaskCardOverlay({ task }: { task: KanbanTask }) {
  return (
    <div
      className="w-[300px] rotate-[-1.2deg] border border-(--ink) bg-(--stock-raised) px-3 py-2.5 shadow-[6px_6px_0_rgba(28,29,26,0.28)]"
      style={{ borderRadius: 3 }}
    >
      <p className="text-sm font-semibold leading-snug text-(--ink)">{task.title}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--ink-soft)">
          {task.description}
        </p>
      )}
    </div>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="5" r="1.3" /><circle cx="13" cy="5" r="1.3" />
      <circle cx="7" cy="10" r="1.3" /><circle cx="13" cy="10" r="1.3" />
      <circle cx="7" cy="15" r="1.3" /><circle cx="13" cy="15" r="1.3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M8 10v7M12 10v7M16 10v7M6 7l1 13h10l1-13" />
    </svg>
  );
}
