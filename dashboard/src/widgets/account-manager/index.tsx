'use client';

import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn } from '@/shared';
import { PasteImport } from '@/features/blog-id-import';
import {
  useAddBlogAccounts,
  useBlogAccountLists,
  useMutateBlogAccount,
  type BlogAccountList,
  type ManagedListId,
} from '@/entities/blog-account';

const COLLAPSED_LIMIT = 24;

interface AccountListCardProps {
  list: BlogAccountList;
}

const AccountListCard = ({ list }: AccountListCardProps) => {
  const { mutate, isPending, variables, error } = useMutateBlogAccount();
  const {
    mutate: addMany,
    isPending: isAdding,
    error: addError,
  } = useAddBlogAccounts();
  const [draft, setDraft] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
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

  const handlePaste = (blogIds: string[]) => {
    addMany({ listId: list.id, blogIds });
  };

  const handleToggleExpand = () => {
    setIsExpanded((current) => !current);
  };

  const keyword = query.trim().toLowerCase();
  const matched = keyword
    ? list.effective.filter((blogId) => blogId.includes(keyword))
    : list.effective;
  const visible = isExpanded ? matched : matched.slice(0, COLLAPSED_LIMIT);
  const restCount = matched.length - visible.length;
  const failure = addError ?? error;

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

      {list.effective.length > COLLAPSED_LIMIT ? (
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="계정 찾기"
            aria-label={`${list.label} 계정 찾기`}
            className={cn(
              'w-full rounded border border-[var(--line)] bg-[var(--paper)] py-1.5 pl-8 pr-2.5',
              'text-[13px] text-[var(--ink)] outline-none transition-colors',
              'placeholder:text-[var(--ink-faint)]',
              'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
            )}
          />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {visible.map((blogId) => {
          const isAdded = list.added.includes(blogId);
          const isBusy = isPending && variables?.blogId === blogId;
          return (
            <span
              key={blogId}
              className={cn(
                'tabular inline-flex items-center gap-1 rounded border px-2 py-1 text-xs',
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

        {restCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={handleToggleExpand}>
            {restCount}개 더 보기
          </Button>
        ) : null}
        {isExpanded && matched.length > COLLAPSED_LIMIT ? (
          <Button variant="ghost" size="sm" onClick={handleToggleExpand}>
            접기
          </Button>
        ) : null}

        {list.effective.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">계정이 없음.</p>
        ) : null}
        {list.effective.length > 0 && matched.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">
            &quot;{query}&quot;에 걸리는 계정이 없음
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
          )}
        />
        <Button type="submit" disabled={isPending || draft.trim().length === 0}>
          <Plus className="size-4" />
          추가
        </Button>
      </form>

      <div className="mt-2">
        <PasteImport
          existing={list.effective}
          onApply={handlePaste}
          isPending={isAdding}
        />
      </div>

      {failure ? (
        <p className="mt-2 text-sm text-[var(--alert)]">
          {failure instanceof Error ? failure.message : '변경에 실패함'}
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--live)]/30 bg-[var(--live)]/8 px-4 py-3">
        <Badge tone="success" withDot>
          실행 반영됨
        </Badge>
        <p className="text-[13px] text-[var(--ink-soft)]">
          워커가 노출체크를 시작할 때 이 목록을 읽어 코드 기본값을 갈아끼움. 여기서 바꾸면
          다음 실행부터 실제 크롤 대상이 바뀜
        </p>
      </div>

      {data?.map((list: BlogAccountList) => (
        <AccountListCard key={list.id satisfies ManagedListId} list={list} />
      ))}
    </div>
  );
};
