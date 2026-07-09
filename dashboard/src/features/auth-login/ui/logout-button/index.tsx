'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, api } from '@/shared';

export const LogoutButton = () => {
  const router = useRouter();

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
    router.refresh();
  };

  return (
    <Button variant="ghost" onClick={handleLogout}>
      로그아웃
    </Button>
  );
};
