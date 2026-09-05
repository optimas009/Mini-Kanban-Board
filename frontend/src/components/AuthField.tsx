'use client';

export const authInputClass =
  'w-full border border-(--rule) bg-white px-3 py-2.5 text-[15px] text-(--ink) outline-none transition placeholder:text-(--ink-faint) focus:border-(--ink)';

export function AuthField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-(--ink)">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-sm text-(--alert)">{error}</span>
      )}
    </label>
  );
}

export function AuthSubmit({
  busy,
  busyLabel,
  children,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full bg-(--ink) px-4 py-3 text-[15px] font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
      style={{ borderRadius: 3 }}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
