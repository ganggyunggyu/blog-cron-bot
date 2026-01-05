import React from 'react';
import { useAtom } from 'jotai';
import { apiBaseAtom } from '@/shared/store/api-base';

export const useApiBase = () => {
  const [apiBase, setApiBase] = useAtom(apiBaseAtom);

  const normalizedBase = React.useMemo(() => {
    return apiBase.trim().replace(/\/$/, '');
  }, [apiBase]);

  const resolvedBase = React.useMemo(() => {
    if (normalizedBase) return normalizedBase;
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, [normalizedBase]);

  return { apiBase, setApiBase, normalizedBase, resolvedBase };
};
