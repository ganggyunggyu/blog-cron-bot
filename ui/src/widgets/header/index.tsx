import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Link2, RefreshCcw } from 'lucide-react';
import { cn, Badge, Button, Card, Input } from '@/shared';
import { getHealth } from '@/shared/api/health';
import { useApiBase } from '@/shared/hooks/use-api-base';

export const Header = () => {
  const { apiBase, setApiBase, normalizedBase, resolvedBase } = useApiBase();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['health', normalizedBase],
    queryFn: () => getHealth(normalizedBase),
  });

  const handleReset = () => {
    setApiBase('');
  };

  const handleUseOrigin = () => {
    if (typeof window === 'undefined') return;
    setApiBase(window.location.origin);
  };

  const statusVariant = isLoading
    ? 'warning'
    : isError || !data?.ok
      ? 'danger'
      : 'success';

  const statusLabel = isLoading
    ? 'Checking'
    : isError || !data?.ok
      ? 'Offline'
      : 'Online';

  return (
    <React.Fragment>
      <Card className={cn('relative overflow-hidden px-8 py-10 float-in')}>
        <div
          className={cn(
            'pointer-events-none absolute -right-16 top-4 h-40 w-40 rounded-full',
            'bg-[radial-gradient(circle,rgba(15,118,110,0.2),transparent_70%)]'
          )}
        />
        <div className={cn('relative z-10 flex flex-col gap-6')}>
          <div className={cn('flex flex-col gap-3')}>
            <div className={cn('flex items-center gap-3')}>
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)]',
                  'bg-white/80 text-[var(--accent-1)]'
                )}
              >
                <Activity size={22} />
              </div>
              <div>
                <h1 className={cn('text-2xl font-semibold text-[var(--ink-1)]')}>
                  Blog Exposure Console
                </h1>
                <p className={cn('text-sm text-[var(--ink-2)]')}>
                  Run keyword tests and batch checks from a single control room.
                </p>
              </div>
            </div>
            <div className={cn('flex flex-wrap items-center gap-2')}>
              <Badge variant={statusVariant}>API {statusLabel}</Badge>
              <Badge variant="neutral">Base: {resolvedBase || '-'}</Badge>
            </div>
          </div>

          <div className={cn('grid gap-4 md:grid-cols-[1.6fr_auto_auto]')}>
            <div className={cn('flex flex-col gap-2')}>
              <span className={cn('text-xs font-semibold text-[var(--ink-2)]')}>
                API Base URL
              </span>
              <Input
                value={apiBase}
                onChange={(event) => setApiBase(event.target.value)}
                placeholder="http://localhost:5178"
                startIcon={<Link2 size={16} />}
              />
            </div>
            <div className={cn('flex items-end justify-start gap-2 md:justify-end')}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCcw size={14} />}
                onClick={handleReset}
              >
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={handleUseOrigin}>
                Use Current Origin
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </React.Fragment>
  );
};
