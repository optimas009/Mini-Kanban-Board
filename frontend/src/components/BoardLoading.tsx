'use client';

/**
 * Loading state drawn as the product itself: three stage headers with cards
 * settling into place, rather than a generic spinner.
 */
export function BoardLoading({ label }: { label: string }) {
  return (
    <main className="board-surface flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="flex gap-2.5" aria-hidden="true">
        {(['blue', 'yellow', 'green'] as const).map((signal, column) => (
          <div
            key={signal}
            data-signal={signal}
            className="w-[92px] border border-(--board-edge) bg-(--board-deep)/30"
            style={{ borderRadius: 3 }}
          >
            <div className="h-4 bg-(--signal)" />
            <div className="space-y-1.5 p-1.5">
              {[0, 1].map((card) => (
                <div
                  key={card}
                  className="animate-settle h-7 border border-(--board-edge) bg-(--stock-raised)"
                  style={{
                    borderRadius: 3,
                    animationDelay: `${(column * 2 + card) * 90}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-(--ink-soft)" role="status">
        {label}
      </p>
    </main>
  );
}
