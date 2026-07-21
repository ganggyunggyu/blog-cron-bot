'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Lock } from 'lucide-react';
import { Button, Card, api, cn } from '@/shared';

const LoginPage = () => {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/auth/login', { password });
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('비밀번호가 올바르지 않음');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Compass className="size-5.5" />
          </span>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            노출지기 대시보드
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            네이버 노출체크 크론 봇 제어판
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              aria-label="대시보드 비밀번호"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="비밀번호"
              autoFocus
              className={cn(
                'w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
              )}
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          ) : null}
          <Button type="submit" disabled={isSubmitting || password.length === 0}>
            {isSubmitting ? '확인 중...' : '로그인'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
