'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button, api } from '@/shared';

export const LogoutButton = () => {
  const router = useRouter();

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
    router.refresh();
  };

  return (
    <Button size="sm" variant="ghost" onClick={handleLogout}>
      <LogOut className="size-4" />
      로그아웃
    </Button>
  );
};
