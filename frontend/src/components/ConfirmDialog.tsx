'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="animate-scrim-in fixed inset-0 z-[70] flex items-center justify-center bg-(--ink)/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="stock-raised animate-pop-in w-full max-w-md">
        <div className="flex gap-4 p-5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center ${
              destructive
                ? 'bg-(--alert-tint) text-(--alert)'
                : 'bg-(--board) text-(--ink)'
            }`}
            style={{ borderRadius: 3 }}
            aria-hidden="true"
          >
            {destructive ? <WarningIcon /> : <QuestionIcon />}
          </span>

          <div className="min-w-0">
            <h2 className="stamp text-lg text-(--ink)">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-(--ink-soft)">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-(--rule) px-5 py-3.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="border border-(--rule) px-4 py-2 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            style={{ borderRadius: 3 }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-(--stock) transition ${
              destructive
                ? 'bg-(--alert) hover:brightness-110'
                : 'bg-(--ink) hover:bg-(--ink-soft)'
            }`}
            style={{ borderRadius: 3 }}
          >
            {busy ? 'Working' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 4 3.8 19h16.4L12 4Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 1.8-2.4 2.1-2.4 4M12 17h.01" />
    </svg>
  );
}
