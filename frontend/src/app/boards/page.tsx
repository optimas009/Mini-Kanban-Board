'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { BoardSummary } from '@/lib/types';

export default function BoardsPage() {
  return (
    <ProtectedRoute>
      <BoardsContent />
    </ProtectedRoute>
  );
}

function BoardsContent() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<BoardSummary[]>('/boards', {}, token),
  });

  const createBoard = useMutation({
    mutationFn: (boardName: string) =>
      apiFetch<BoardSummary>(
        '/boards',
        {
          method: 'POST',
          body: JSON.stringify({ name: boardName }),
        },
        token,
      ),
    onSuccess: async () => {
      setName('');
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function submitBoard(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setFormError('Give the board a name');
      return;
    }

    createBoard.mutate(trimmed);
  }

  const boards = boardsQuery.data;

  return (
    <AppShell section="Boards">
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="stock-flat p-4">
            <form onSubmit={submitBoard} className="flex flex-col gap-2.5 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">New board name</span>
                <input
                  id="board-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  placeholder="Name a new board, for example Product launch"
                  className="w-full border border-(--rule) bg-white px-3 py-2.5 text-sm text-(--ink) outline-none transition placeholder:text-(--ink-faint) focus:border-(--ink)"
                  style={{ borderRadius: 3 }}
                />
              </label>

              <button
                type="submit"
                disabled={createBoard.isPending}
                className="shrink-0 bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
                style={{ borderRadius: 3 }}
              >
                {createBoard.isPending ? 'Creating' : 'Create board'}
              </button>
            </form>

            {formError && (
              <p
                className="mt-2.5 border border-(--alert)/30 bg-(--alert-tint) px-3 py-2 text-sm text-(--alert)"
                style={{ borderRadius: 3 }}
                role="alert"
              >
                {formError}
              </p>
            )}
          </div>

          {boardsQuery.isLoading && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="stock h-[132px] p-4">
                  <div className="animate-shimmer h-4 w-2/3 bg-(--board)" />
                  <div className="animate-shimmer mt-3 h-3 w-1/3 bg-(--board)" />
                </div>
              ))}
            </div>
          )}

          {boardsQuery.isError && (
            <div
              className="mt-6 border border-(--alert)/30 bg-(--alert-tint) p-4 text-sm text-(--alert)"
              style={{ borderRadius: 3 }}
              role="alert"
            >
              {getErrorMessage(boardsQuery.error)}
            </div>
          )}

          {boards?.length === 0 && (
            <div className="stock-flat mt-6 px-6 py-14 text-center">
              <h2 className="stamp text-xl text-(--ink)">No boards yet</h2>
              <p className="mt-2 text-sm text-(--ink-soft)">
                Create one above and it will appear here.
              </p>
            </div>
          )}

          {boards && boards.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {boards.map((board, index) => {
                const isOwner = board.ownerId === user?.id;

                return (
                  <Link
                    key={board.id}
                    href={`/boards/${board.id}`}
                    className="animate-settle stock group flex flex-col p-4 transition-shadow hover:shadow-[4px_4px_0_rgba(28,29,26,0.2)]"
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="stamp min-w-0 text-lg text-(--ink)">
                        {board.name}
                      </h2>
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[11px] font-semibold ${
                          isOwner
                            ? 'border-(--ink) text-(--ink)'
                            : 'border-(--ink-faint) text-(--ink-faint)'
                        }`}
                        style={{ borderRadius: 2 }}
                      >
                        {isOwner ? 'Owner' : 'Shared'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-(--ink-faint)">
                      {isOwner ? 'You own this board' : `Owned by ${board.owner.name}`}
                    </p>

                    <div className="mt-auto flex items-center gap-4 border-t border-(--rule) pt-3 text-xs text-(--ink-soft)">
                      <span>
                        <span className="font-semibold text-(--ink)">
                          {board._count.columns}
                        </span>{' '}
                        {board._count.columns === 1 ? 'stage' : 'stages'}
                      </span>
                      <span>
                        <span className="font-semibold text-(--ink)">
                          {board._count.members}
                        </span>{' '}
                        {board._count.members === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
