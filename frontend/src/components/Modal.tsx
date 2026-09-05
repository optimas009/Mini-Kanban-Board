'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="animate-scrim-in fixed inset-0 z-50 flex items-center justify-center bg-(--ink)/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="stock-raised animate-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-center justify-between border-b border-(--rule) px-5 py-3.5">
          <h2 className="stamp text-lg text-(--ink)">{title}</h2>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center border border-(--rule) text-lg text-(--ink-soft) transition hover:border-(--ink) hover:bg-(--ink) hover:text-(--stock)"
            style={{ borderRadius: 3 }}
          >
            ×
          </button>
        </div>

        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
