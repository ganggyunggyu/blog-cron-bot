import React from 'react';
import { LayoutGrid, ListChecks, AlarmClock } from 'lucide-react';
import { cn, Button } from '@/shared';
import { Header } from '@/widgets/header';
import { TestPanel } from '@/widgets/test-panel';
import { BatchPanel } from '@/widgets/batch-panel';
import { CronPanel } from '@/widgets/cron-panel';

type PanelKey = 'test' | 'batch' | 'cron';

const panels = [
  { key: 'test' as PanelKey, label: 'Keyword Test', icon: LayoutGrid },
  { key: 'batch' as PanelKey, label: 'Batch Runner', icon: ListChecks },
  { key: 'cron' as PanelKey, label: 'Cron Runner', icon: AlarmClock },
];

export const HomePage = () => {
  const [activePanel, setActivePanel] = React.useState<PanelKey>('test');

  return (
    <div className={cn('relative min-h-screen overflow-hidden')}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -left-40 top-24 h-72 w-72 rounded-full',
          'bg-[radial-gradient(circle,rgba(200,107,60,0.18),transparent_70%)]'
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-10 right-10 h-64 w-64 rounded-full',
          'bg-[radial-gradient(circle,rgba(15,118,110,0.18),transparent_70%)]'
        )}
      />

      <div
        className={cn(
          'relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10'
        )}
      >
        <Header />

        <div className={cn('flex flex-wrap items-center gap-3')}>
          {panels.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={activePanel === key ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Icon size={16} />}
              onClick={() => setActivePanel(key)}
            >
              {label}
            </Button>
          ))}
        </div>

          <div className={cn('reveal')}>
            {activePanel === 'test' ? (
              <TestPanel />
            ) : activePanel === 'batch' ? (
              <BatchPanel />
            ) : (
              <CronPanel />
            )}
          </div>
      </div>
    </div>
  );
};
