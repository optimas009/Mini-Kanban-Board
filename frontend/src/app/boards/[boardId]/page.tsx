'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { BoardView } from '@/components/BoardView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { BoardDetail } from '@/lib/types';

export default function BoardPage() {
  return (
    <ProtectedRoute>
      <BoardContent />
    </ProtectedRoute>
  );
}

function BoardContent() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const boardId = params.boardId;

  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmBoardDelete, setConfirmBoardDelete] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const boardQuery = useQuery({
    queryKey: ['board', boardId],
    enabled: Boolean(token && boardId),
    queryFn: () => apiFetch<BoardDetail>(`/boards/${boardId}`, {}, token),
  });

  const isOwner = boardQuery.data?.ownerId === user?.id;

  const shareMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch(
        `/boards/${boardId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
        token,
      ),
    onSuccess: async () => {
      setShareEmail('');
      setShareError('');
      await queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (error) => setShareError(getErrorMessage(error)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      apiFetch(
        `/boards/${boardId}/members/${memberUserId}`,
        { method: 'DELETE' },
        token,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch(
        `/boards/${boardId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        },
        token,
      ),
    onSuccess: async () => {
      setShowRename(false);
      await queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/boards/${boardId}`, { method: 'DELETE' }, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      router.push('/boards');
    },
  });

  function submitShare(event: React.FormEvent) {
    event.preventDefault();
    const email = shareEmail.trim();

    if (!email) {
      setShareError('Enter an email address');
      return;
    }

    shareMutation.mutate(email);
  }

  if (boardQuery.isLoading) {
    return (
      <AppShell section="Board">
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            <div className="stock-flat h-20 p-4">
              <div className="animate-shimmer h-5 w-56 bg-(--board)" />
              <div className="animate-shimmer mt-3 h-3 w-40 bg-(--board)" />
            </div>
            <div className="mt-4 flex gap-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="stock-flat h-72 w-[312px] shrink-0" />
              ))}
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  if (boardQuery.isError || !boardQuery.data) {
    return (
      <AppShell section="Board">
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div
            className="mx-auto max-w-2xl border border-(--alert)/30 bg-(--alert-tint) p-5 text-(--alert)"
            style={{ borderRadius: 3 }}
            role="alert"
          >
            <h2 className="stamp text-lg">Cannot open this board</h2>
            <p className="mt-1.5 text-sm">{getErrorMessage(boardQuery.error)}</p>
            <button
              type="button"
              onClick={() => router.push('/boards')}
              className="mt-4 border border-(--alert) px-3 py-1.5 text-sm font-semibold transition hover:bg-(--alert) hover:text-white"
              style={{ borderRadius: 3 }}
            >
              Back to boards
            </button>
          </div>
        </main>
      </AppShell>
    );
  }

  const board = boardQuery.data;
  const memberCount = board.members.length;

  return (
    <AppShell section={board.name}>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="stock-flat mb-4 p-4">
            <button
              type="button"
              onClick={() => router.push('/boards')}
              className="text-xs font-semibold text-(--ink-soft) underline underline-offset-4 transition hover:text-(--ink)"
            >
              Back to boards
            </button>

            <div className="mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="stamp truncate text-3xl text-(--ink)">
                  {board.name}
                </h1>
                <p className="mt-1 text-sm text-(--ink-soft)">
                  {isOwner ? 'You own this board' : `Owned by ${board.owner.name}`}
                  <span className="px-2 text-(--ink-faint)">/</span>
                  {memberCount === 0
                    ? 'Not shared with anyone'
                    : `Shared with ${memberCount} ${memberCount === 1 ? 'person' : 'people'}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => setShowMembers(true)}>
                  Members
                </SecondaryButton>

                {isOwner && (
                  <>
                    <SecondaryButton
                      onClick={() => {
                        setRenameValue(board.name);
                        setShowRename(true);
                      }}
                    >
                      Rename
                    </SecondaryButton>

                    <button
                      type="button"
                      onClick={() => setConfirmBoardDelete(true)}
                      disabled={deleteMutation.isPending}
                      className="border border-(--alert)/40 px-3.5 py-2 text-sm font-semibold text-(--alert) transition hover:bg-(--alert) hover:text-white"
                      style={{ borderRadius: 3 }}
                    >
                      Delete board
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <BoardView board={board} token={token} />
        </div>
      </main>

      <Modal open={showMembers} title="Members" onClose={() => setShowMembers(false)}>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-(--ink-faint)">Owner</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <Avatar name={board.owner.name} dark />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-(--ink)">
                  {board.owner.name}
                </p>
                <p className="truncate text-xs text-(--ink-soft)">
                  {board.owner.email}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-(--ink-faint)">
              Shared with
            </p>

            {memberCount > 0 ? (
              <div className="mt-1.5 space-y-1.5">
                {board.members.map((member) => (
                  <div
                    key={member.user.id}
                    className="flex items-center justify-between gap-3 border border-(--rule) p-2.5"
                    style={{ borderRadius: 3 }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={member.user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-(--ink)">
                          {member.user.name}
                        </p>
                        <p className="truncate text-xs text-(--ink-soft)">
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          setMemberToRemove({
                            id: member.user.id,
                            name: member.user.name,
                          })
                        }
                        className="shrink-0 border border-(--rule) px-2.5 py-1.5 text-xs font-semibold text-(--ink-soft) transition hover:border-(--alert) hover:bg-(--alert) hover:text-white"
                        style={{ borderRadius: 3 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-(--ink-soft)">
                Only you can see this board.
              </p>
            )}
          </div>

          {isOwner && (
            <form onSubmit={submitShare} className="border-t border-(--rule) pt-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-(--ink)">
                  Share with a registered user
                </span>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                    placeholder="their@email.com"
                    className="min-w-0 flex-1 border border-(--rule) bg-white px-3 py-2 text-sm text-(--ink) outline-none transition placeholder:text-(--ink-faint) focus:border-(--ink)"
                    style={{ borderRadius: 3 }}
                  />

                  <button
                    type="submit"
                    disabled={shareMutation.isPending}
                    className="shrink-0 bg-(--ink) px-4 py-2 text-sm font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
                    style={{ borderRadius: 3 }}
                  >
                    {shareMutation.isPending ? 'Sharing' : 'Share'}
                  </button>
                </div>
              </label>

              {shareError && (
                <p
                  className="mt-2 border border-(--alert)/30 bg-(--alert-tint) px-3 py-2 text-xs text-(--alert)"
                  style={{ borderRadius: 3 }}
                  role="alert"
                >
                  {shareError}
                </p>
              )}
            </form>
          )}
        </div>
      </Modal>

      <Modal open={showRename} title="Rename board" onClose={() => setShowRename(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = renameValue.trim();
            if (value) renameMutation.mutate(value);
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-(--ink)">
              Board name
            </span>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={120}
              autoFocus
              className="w-full border border-(--rule) bg-white px-3 py-2.5 text-sm text-(--ink) outline-none transition focus:border-(--ink)"
              style={{ borderRadius: 3 }}
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-(--rule) pt-4">
            <button
              type="button"
              onClick={() => setShowRename(false)}
              className="border border-(--rule) px-4 py-2 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
              style={{ borderRadius: 3 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={renameMutation.isPending}
              className="bg-(--ink) px-4 py-2 text-sm font-semibold text-(--stock) transition hover:bg-(--ink-soft)"
              style={{ borderRadius: 3 }}
            >
              {renameMutation.isPending ? 'Saving' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmBoardDelete}
        title="Delete this board?"
        description={`“${board.name}” and every stage and card on it will be deleted. This cannot be undone.`}
        confirmLabel="Delete board"
        destructive
        busy={deleteMutation.isPending}
        onClose={() => setConfirmBoardDelete(false)}
        onConfirm={() =>
          deleteMutation.mutate(undefined, {
            onSuccess: () => setConfirmBoardDelete(false),
          })
        }
      />

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remove this member?"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to this board straight away.`
            : ''
        }
        confirmLabel="Remove member"
        destructive
        busy={removeMemberMutation.isPending}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (!memberToRemove) return;

          removeMemberMutation.mutate(memberToRemove.id, {
            onSuccess: () => setMemberToRemove(null),
          });
        }}
      />
    </AppShell>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-(--rule) bg-white px-3.5 py-2 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
      style={{ borderRadius: 3 }}
    >
      {children}
    </button>
  );
}

function Avatar({ name, dark = false }: { name: string; dark?: boolean }) {
  return (
    <span
      className={`stamp flex h-9 w-9 shrink-0 items-center justify-center text-sm ${
        dark
          ? 'bg-(--ink) text-(--stock)'
          : 'bg-(--board) text-(--ink)'
      }`}
      style={{ borderRadius: 3 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
