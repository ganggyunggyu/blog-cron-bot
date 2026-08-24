'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useRunJob } from '@/entities/job';
import { Button } from '@/shared';

const CAFE_URL_PATTERN =
  /^https?:\/\/(?:m\.)?cafe\.naver\.com\/[^/?#\s]+(?:\/\d+)?\/?$/i;

interface RootCafeUrlFormProps {
  disabled: boolean;
}

/** 루트 키워드 전체에서 카페 글 URL 하나가 노출되는지 확인하는 단발성 체크. */
export const RootCafeUrlForm = ({ disabled }: RootCafeUrlFormProps) => {
  const { mutate: runJob, isPending, error, reset } = useRunJob();
  const [url, setUrl] = React.useState('');

  const trimmedUrl = url.trim();
  const isValid = CAFE_URL_PATTERN.test(trimmedUrl);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;
    reset();
    runJob({ jobId: 'root-cafe-url-exposure', options: { url: trimmedUrl } });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3"
    >
      <span className="shrink-0 text-xs text-[var(--ink-faint)]">
        루트 · 카페 URL
      </span>
      <input
        type="url"
        value={url}
        onChange={handleChange}
        placeholder="https://cafe.naver.com/카페아이디/게시글번호"
        disabled={disabled || isPending}
        aria-label="루트 키워드로 확인할 카페 URL"
        className="h-8 min-w-48 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25 disabled:opacity-50"
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={disabled || isPending || !trimmedUrl || !isValid}
      >
        <Search className="size-3.5" />
        {isPending ? '확인 중' : '루트 전체에서 확인'}
      </Button>
      {trimmedUrl && !isValid ? (
        <p className="w-full text-xs text-[var(--ink-faint)]">
          카페 글 URL 형식이 아님 (예: https://cafe.naver.com/카페아이디/게시글번호)
        </p>
      ) : null}
      {error ? (
        <p className="w-full text-xs text-[var(--alert)]">{error.message}</p>
      ) : null}
    </form>
  );
};
