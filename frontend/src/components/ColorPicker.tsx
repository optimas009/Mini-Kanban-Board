'use client';

import { COLUMN_COLORS, type ColumnColor } from '@/lib/types';

export function ColorPicker({
  value,
  onChange,
}: {
  value: ColumnColor;
  onChange: (color: ColumnColor) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-(--ink)">
        Signal colour
      </p>

      <div className="flex flex-wrap gap-1.5">
        {COLUMN_COLORS.map((color) => {
          const selected = value === color;

          return (
            <button
              key={color}
              type="button"
              data-signal={color}
              onClick={() => onChange(color)}
              title={capitalize(color)}
              aria-label={`Choose ${color}`}
              aria-pressed={selected}
              className={`h-9 w-9 border-2 bg-(--signal) transition ${
                selected
                  ? 'border-(--ink)'
                  : 'border-transparent hover:border-(--ink-faint)'
              }`}
              style={{ borderRadius: 3 }}
            />
          );
        })}
      </div>

      <p className="mt-2 text-xs text-(--ink-faint)">
        Selected: <span className="font-semibold text-(--ink-soft)">{capitalize(value)}</span>
      </p>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
