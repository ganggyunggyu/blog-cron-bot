'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useRunJob } from '@/entities/job';
import { Button } from '@/shared';

/**
 * 서버(root-cafe-url-options)와 봇(src/lib/naver-cafe-url)이 진짜 판정을 한다.
 * 여기서는 붙여넣자마자 빨간 줄로 알려주는 용도만 하고, 애매하면 통과시켜서
 * 서버 메시지를 받아 보여준다. 화면이 서버보다 엄격하면 멀쩡한 주소가 막힌다.
 */
const CAFE_HOST_PATTERN = /^https?:\/\/(?:m\.)?cafe\.naver\.com\/.+/i;
const SPA_PATH_PATTERN = /^https?:\/\/(?:m\.)?cafe\.naver\.com\/(?:f-e|ca-fe|\d+)(?:\/|$)/i;

const describeUrlProblem = (url: string): string | null => {
  if (!CAFE_HOST_PATTERN.test(url)) {
    return '네이버 카페 주소가 아님 (예: https://cafe.naver.com/카페이름/12345)';
  }
  if (SPA_PATH_PATTERN.test(url)) {
    return '카페 이름이 없는 주소임. 글을 열고 주소창에 뜨는 cafe.naver.com/카페이름/글번호 형태로 넣어야 함';
  }
  return null;
};

interface RootCafeUrlFormProps {
  disabled: boolean;
}

/** 루트 키워드 전체에서 카페 글 URL 하나가 노출되는지 확인하는 단발성 체크. */
export const RootCafeUrlForm = ({ disabled }: RootCafeUrlFormProps) => {
  const { mutate: runJob, isPending, error, reset } = useRunJob();
  const [url, setUrl] = React.useState('');

  const trimmedUrl = url.trim();
  const urlProblem = trimmedUrl ? describeUrlProblem(trimmedUrl) : null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedUrl || urlProblem) return;
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
        placeholder="https://cafe.naver.com/카페이름/글번호"
        disabled={disabled || isPending}
        aria-label="루트 키워드로 확인할 카페 URL"
        className="h-8 min-w-48 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25 disabled:opacity-50"
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={disabled || isPending || !trimmedUrl || urlProblem !== null}
      >
        <Search className="size-3.5" />
        {isPending ? '확인 중' : '루트 전체에서 확인'}
      </Button>
      {urlProblem ? (
        <p className="w-full text-xs text-[var(--ink-faint)]">{urlProblem}</p>
      ) : null}
      {error ? (
        <p className="w-full text-xs text-[var(--alert)]">{error.message}</p>
      ) : null}
    </form>
  );
};
