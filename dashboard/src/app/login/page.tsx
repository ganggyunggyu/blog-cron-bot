'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { api, cn } from '@/shared';

const RANK_SLOTS = Array.from({ length: 10 }, (_, index) => index + 1);
/** 스캔이 멈추는 자리. 실제 순위가 아니라 그림이 멈출 지점일 뿐이다. */
const FOUND_RANK = 3;

/**
 * 검색결과 1~10위를 훑다가 한 칸에 멈추는 스트립.
 * 이 제품이 하는 일을 그대로 보여주는 그림이다. 옆에 "3위 노출" 같은 숫자를
 * 붙이면 진짜 결과처럼 읽히므로 붙이지 않는다.
 */
/** 모션을 끈 사용자에게는 스캔 없이 결과 상태만 바로 보여준다. */
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RankScan = () => {
  const [reduced] = React.useState(prefersReducedMotion);
  const [cursor, setCursor] = React.useState(() => (reduced ? FOUND_RANK : 0));
  const [isLocked, setIsLocked] = React.useState(() => reduced);

  React.useEffect(() => {
    if (reduced) return;

    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      const position = ((step - 1) % RANK_SLOTS.length) + 1;
      setCursor(position);
      if (position === FOUND_RANK && step > RANK_SLOTS.length) {
        setIsLocked(true);
        window.clearInterval(timer);
      }
    }, 110);

    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {RANK_SLOTS.map((rank) => {
        const isCursor = cursor === rank;
        const isFound = isLocked && rank === FOUND_RANK;
        return (
          <span
            key={rank}
            className={cn(
              'w-full origin-bottom rounded-[2px] transition-colors duration-150',
              isFound ? 'bg-[var(--live)]' : isCursor ? 'bg-[var(--signal)]' : 'bg-[var(--line)]',
            )}
            style={{
              height: isFound ? 34 : isCursor ? 24 : 12,
              animation: isFound ? 'rank-lock 420ms ease-out' : undefined,
              transitionProperty: 'height, background-color',
            }}
          />
        );
      })}
    </div>
  );
};

const LoginPage = () => {
  const router = useRouter();
  const [loginId, setLoginId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLoginIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLoginId(event.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/auth/login', { loginId, password });
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('아이디 또는 비밀번호가 맞지 않음. 다시 입력해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-5 py-10">
      <main className="w-full max-w-[420px]">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">
          노출지기
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          네이버 검색에서 내 글이 몇 위에 있는지 확인합니다.
        </p>

        <div className="mt-7 rounded-md border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-3">
            <span className="stamp">검색결과에서 내 글 찾기</span>
          </div>
          <RankScan />
        </div>

        <form onSubmit={handleSubmit} className="mt-7">
          <label
            htmlFor="dashboard-login-id"
            className="stamp mb-2 block"
          >
            아이디
          </label>
          <input
            id="dashboard-login-id"
            type="text"
            value={loginId}
            onChange={handleLoginIdChange}
            placeholder="아이디"
            autoFocus
            autoComplete="username"
            aria-invalid={errorMessage ? true : undefined}
            className={cn(
              'w-full rounded-md border bg-[var(--panel)] px-3.5 py-3 text-[15px] text-[var(--ink)]',
              'outline-none transition-colors placeholder:text-[var(--ink-faint)]',
              'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25',
              errorMessage ? 'border-[var(--alert)]' : 'border-[var(--line)]',
            )}
          />

          <label
            htmlFor="dashboard-password"
            className="stamp mb-2 mt-4 block"
          >
            비밀번호
          </label>
          <input
            id="dashboard-password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="비밀번호"
            autoComplete="current-password"
            aria-invalid={errorMessage ? true : undefined}
            className={cn(
              'w-full rounded-md border bg-[var(--panel)] px-3.5 py-3 text-[15px] text-[var(--ink)]',
              'outline-none transition-colors placeholder:text-[var(--ink-faint)]',
              'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25',
              errorMessage ? 'border-[var(--alert)]' : 'border-[var(--line)]',
            )}
          />

          {errorMessage ? (
            <p role="alert" className="mt-2 text-sm text-[var(--alert)]">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || loginId.trim().length === 0 || password.length === 0}
            className={cn(
              'mt-4 flex w-full items-center justify-between rounded-md px-4 py-3.5',
              'bg-[var(--signal)] text-[15px] font-medium text-[var(--signal-ink)]',
              'transition-[transform,opacity] active:translate-y-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <span>{isSubmitting ? '확인하는 중' : '로그인'}</span>
            <span aria-hidden="true" className="tabular text-sm opacity-70">
              &rarr;
            </span>
          </button>
        </form>

        <p className="stamp mt-8 text-center">21Lab</p>
      </main>
    </div>
  );
};

export default LoginPage;
