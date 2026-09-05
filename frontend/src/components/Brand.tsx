'use client';

import Link from 'next/link';

export function Brand({
  href = '/boards',
  light = false,
  compact = false,
}: {
  href?: string;
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5"
      aria-label="Kanban home"
    >
      <BoardMark light={light} />

      <span className="min-w-0">
        <span
          className={`stamp block ${compact ? 'text-lg' : 'text-xl'} ${
            light ? 'text-(--stock)' : 'text-(--ink)'
          }`}
        >
          Kanban
        </span>
        {!compact && (
          <span
            className={`mt-0.5 block text-[11px] ${
              light ? 'text-(--board-edge)' : 'text-(--ink-faint)'
            }`}
          >
            Signal board
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Three cards standing at different heights: the board itself, reduced to
 * its smallest legible form.
 */
function BoardMark({ light }: { light: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-end justify-center gap-[3px] border p-[5px] ${
        light
          ? 'border-(--board-edge)/40 bg-(--ink)'
          : 'border-(--board-edge) bg-(--stock)'
      }`}
      style={{ borderRadius: 3 }}
      aria-hidden="true"
    >
      <span className="h-full w-[6px] bg-[#1e6bb8]" />
      <span className="h-2/3 w-[6px] bg-[#c08a05] transition-[height] duration-200 group-hover:h-full" />
      <span className="h-1/3 w-[6px] bg-[#3a7248]" />
    </span>
  );
}
