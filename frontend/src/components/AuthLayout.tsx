'use client';

import { Brand } from './Brand';

/**
 * Shared frame for sign in and register. The board itself is the illustration:
 * three stages holding cards, which is the whole product in one glance.
 */
export function AuthLayout({
  eyebrow,
  heading,
  children,
  footer,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="board-surface min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_420px] lg:gap-16 lg:px-8">
        <section className="hidden lg:block">
          <Brand />

          <h1 className="stamp mt-10 text-[52px] leading-[0.95] text-(--ink)">
            Every card says
            <br />
            where the work is
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-(--ink-soft)">
            Kanban began as a signboard on a factory floor. A card meant work
            existed and showed which stage it had reached. This is that board,
            for your team.
          </p>

          <MiniBoard />
        </section>

        <section className="w-full">
          <div className="mb-7 lg:hidden">
            <Brand />
          </div>

          <div className="stock-raised p-6 sm:p-7">
            <p className="text-sm text-(--ink-soft)">{eyebrow}</p>
            <h2 className="stamp mt-1 text-3xl text-(--ink)">{heading}</h2>

            <div className="mt-6">{children}</div>

            <div className="mt-6 border-t border-(--rule) pt-5 text-sm text-(--ink-soft)">
              {footer}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const DEMO_STAGES = [
  { signal: 'blue', title: 'Todo', cards: ['Draft the brief', 'Pick a supplier'] },
  { signal: 'yellow', title: 'In progress', cards: ['Wire the API'] },
  { signal: 'green', title: 'Done', cards: ['Set up the repo', 'Agree the scope'] },
] as const;

function MiniBoard() {
  return (
    <div className="mt-12 flex max-w-lg gap-2.5" aria-hidden="true">
      {DEMO_STAGES.map((stage) => (
        <div
          key={stage.title}
          data-signal={stage.signal}
          className="flex-1 border border-(--board-edge) bg-(--board-deep)/30"
          style={{ borderRadius: 3 }}
        >
          <div className="flex items-center justify-between bg-(--signal) px-2 py-1.5">
            <span className="stamp text-[13px] text-white">{stage.title}</span>
            <span className="stamp text-[12px] text-white/80">{stage.cards.length}</span>
          </div>

          <div className="space-y-1.5 p-1.5">
            {stage.cards.map((card) => (
              <div
                key={card}
                className="flex border border-(--board-edge) bg-(--stock-raised) shadow-[2px_2px_0_rgba(28,29,26,0.1)]"
                style={{ borderRadius: 3 }}
              >
                <span className="w-[4px] shrink-0 bg-(--signal)" />
                <span className="px-2 py-1.5 text-[11px] leading-4 text-(--ink-soft)">
                  {card}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
