'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { Brand } from './Brand';

export function AppShell({
  children,
  section = 'Boards',
}: {
  children: React.ReactNode;
  section?: string;
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function signOut() {
    setMobileMenuOpen(false);
    logout();
    router.replace('/login');
  }

  return (
    <div className="board-surface min-h-screen lg:flex">
      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-(--board-edge) bg-(--ink) lg:flex">
        <SidebarContent user={user} onSignOut={signOut} onNavigate={() => undefined} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-(--board-edge) bg-(--stock) px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-(--ink) text-(--stock) transition hover:bg-(--ink-soft)"
            style={{ borderRadius: 3 }}
          >
            <MenuIcon />
          </button>

          <p className="stamp truncate text-base text-(--ink)">{section}</p>
        </header>

        <header className="hidden h-14 items-center justify-between border-b border-(--board-edge) bg-(--stock) px-7 lg:flex">
          <h1 className="stamp text-base text-(--ink)">{section}</h1>
          <p className="text-xs text-(--ink-faint)">
            Signed in as <span className="text-(--ink-soft)">{user?.email}</span>
          </p>
        </header>

        {children}
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="animate-scrim-in absolute inset-0 bg-(--ink)/60"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="animate-pop-in absolute inset-y-0 left-0 flex w-[80vw] max-w-[290px] flex-col bg-(--ink)">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <Brand light />

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center bg-white/10 text-lg text-(--board) transition hover:bg-white/20 hover:text-white"
                style={{ borderRadius: 3 }}
              >
                ×
              </button>
            </div>

            <SidebarContent
              user={user}
              onSignOut={signOut}
              onNavigate={() => setMobileMenuOpen(false)}
              mobile
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  user,
  onSignOut,
  onNavigate,
  mobile = false,
}: {
  user: { name: string; email: string } | null;
  onSignOut: () => void;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      {!mobile && (
        <div className="border-b border-white/10 px-5 py-5">
          <Brand light />
        </div>
      )}

      <nav className="px-3 py-4">
        <Link
          href="/boards"
          onClick={onNavigate}
          className="flex items-center gap-2.5 border border-white/10 bg-white/[0.07] px-3 py-2.5 text-sm font-medium text-(--stock) transition hover:bg-white/[0.13]"
          style={{ borderRadius: 3 }}
        >
          <GridIcon />
          Boards
        </Link>
      </nav>

      <div className="mt-auto p-3">
        <div
          className="border border-white/10 bg-white/[0.05] p-3"
          style={{ borderRadius: 3 }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="stamp flex h-9 w-9 shrink-0 items-center justify-center bg-(--board) text-sm text-(--ink)"
              style={{ borderRadius: 3 }}
            >
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--stock)">
                {user?.name}
              </p>
              <p className="truncate text-xs text-(--ink-faint)">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="mt-3 flex w-full items-center justify-center gap-2 border border-white/10 px-3 py-2 text-xs font-semibold text-(--board) transition hover:border-(--alert) hover:bg-(--alert) hover:text-white"
            style={{ borderRadius: 3 }}
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

function initials(name?: string) {
  if (!name) return 'K';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4" width="5" height="16" />
      <rect x="10" y="4" width="5" height="11" />
      <rect x="16.5" y="4" width="4" height="14" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}
