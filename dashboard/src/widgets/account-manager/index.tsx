'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn } from '@/shared';
import {
  useBlogAccountLists,
  useMutateBlogAccount,
  type BlogAccountList,
  type ManagedListId,
} from '@/entities/blog-account';

interface AccountListCardProps {
  list: BlogAccountList;
}

const AccountListCard = ({ list }: AccountListCardProps) => {
  const { mutate, isPending, variables, error } = useMutateBlogAccount();
  const [draft, setDraft] = React.useState('');

  const handleDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const blogId = draft.trim();
    if (!blogId) return;
    mutate(
      { listId: list.id, blogId, action: 'add' },
      { onSuccess: () => setDraft('') },
    );
  };

  const handleRemove = (blogId: string) => {
    mutate({ listId: list.id, blogId, action: 'remove' });
  };

  return (
    <Card>
      <SectionHeader
        title={`${list.label} · ${list.effective.length}개`}
        description={list.description}
        action={
          list.added.length > 0 || list.removed.length > 0 ? (
            <Badge tone="warning">
              기본 {list.seed.length} +{list.added.length} −{list.removed.length}
            </Badge>
          ) : (
            <Badge tone="neutral">기본값</Badge>
          )
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {list.effective.map((blogId) => {
          const isAdded = list.added.includes(blogId);
          const isBusy = isPending && variables?.blogId === blogId;
          return (
            <span
              key={blogId}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs',
                isAdded
                  ? 'border-[var(--signal)]/40 bg-[var(--signal)]/8 text-[var(--signal)]'
                  : 'border-[var(--line)] bg-transparent text-[var(--ink)]',
              )}
            >
              {blogId}
              <button
                type="button"
                aria-label={`${blogId} 제거`}
                disabled={isBusy}
                onClick={() => handleRemove(blogId)}
                className="rounded p-0.5 text-[var(--ink-faint)] transition-colors hover:bg-[var(--line)]/60 hover:text-[var(--alert)] disabled:opacity-40"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        {list.effective.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">
            계정이 없음.
          </p>
        ) : null}
      </div>

      {list.removed.length > 0 ? (
        <p className="mb-3 text-xs text-[var(--ink-soft)]">
          제외됨: {list.removed.join(', ')}
        </p>
      ) : null}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={draft}
          onChange={handleDraftChange}
          placeholder="블로그 ID 또는 blog.naver.com 주소"
          aria-label={`${list.label} 계정 추가`}
          className={cn(
            'min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition',
            'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25',
            'dark:border-neutral-700',
          )}
        />
        <Button type="submit" disabled={isPending || draft.trim().length === 0}>
          <Plus className="size-4" />
          추가
        </Button>
      </form>

      {error ? (
        <p className="mt-2 text-sm text-[var(--alert)]">
          {error instanceof Error ? error.message : '변경에 실패함'}
        </p>
      ) : null}
    </Card>
  );
};

export const AccountManager = () => {
  const { data, isLoading, isError, error } = useBlogAccountLists();

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-[var(--ink-soft)]">
          계정 목록을 불러오는 중...
        </p>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <p className="text-sm text-[var(--alert)]">
          {error instanceof Error ? error.message : '계정 목록을 불러오지 못함'}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {data?.map((list: BlogAccountList) => (
        <AccountListCard key={list.id satisfies ManagedListId} list={list} />
      ))}
    </div>
  );
};
