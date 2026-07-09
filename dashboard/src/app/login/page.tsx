'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, api } from '@/shared';

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          blog-cron-bot 대시보드
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="비밀번호"
            autoFocus
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
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
