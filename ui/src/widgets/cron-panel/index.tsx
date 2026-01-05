import React from 'react';
import { AlarmClock, Activity, PauseCircle } from 'lucide-react';
import { cn, Badge, Button, Card } from '@/shared';
import { getCronStreamUrl, type CronMode } from '@/features/cron-runner/api/cron-runner.api';
import { useApiBase } from '@/shared/hooks/use-api-base';

const MODES: Array<{ key: CronMode; label: string }> = [
  { key: 'cron-test', label: 'cron:test' },
  { key: 'cron-root', label: 'cron:root' },
  { key: 'cron-pet', label: 'cron:pet' },
];

type RunState = 'idle' | 'running' | 'done' | 'busy' | 'error';

export const CronPanel = () => {
  const { normalizedBase } = useApiBase();
  const [runState, setRunState] = React.useState<RunState>('idle');
  const [activeMode, setActiveMode] = React.useState<CronMode | null>(null);
  const [statusLine, setStatusLine] = React.useState('');
  const [logLines, setLogLines] = React.useState<string[]>([]);
  const [errorMessage, setErrorMessage] = React.useState('');

  const bufferRef = React.useRef('');
  const sourceRef = React.useRef<EventSource | null>(null);
  const tailRef = React.useRef<HTMLDivElement | null>(null);

  const appendLines = React.useCallback((lines: string[]) => {
    setLogLines((prev) => {
      const next = prev.concat(lines);
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }, []);

  const consumeLine = React.useCallback(
    (line: string, isComplete: boolean) => {
      if (line.includes('\r')) {
        const segments = line.split('\r');
        const last = segments.pop() ?? '';

        if (segments.length > 0) {
          appendLines(segments);
        }

        if (isComplete) {
          appendLines([last]);
          setStatusLine('');
        } else {
          setStatusLine(last);
        }
        return;
      }

      if (isComplete) {
        appendLines([line]);
      } else {
        bufferRef.current = line;
      }
    },
    [appendLines]
  );

  const handleChunk = React.useCallback(
    (chunk: string) => {
      const merged = `${bufferRef.current}${chunk}`;
      bufferRef.current = '';

      const lines = merged.split('\n');
      const last = lines.pop() ?? '';

      lines.forEach((line) => {
        consumeLine(line, true);
      });

      if (last.includes('\r')) {
        consumeLine(last, false);
      } else {
        bufferRef.current = last;
      }
    },
    [consumeLine]
  );

  const closeStream = React.useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  const resetLogs = React.useCallback(() => {
    bufferRef.current = '';
    setStatusLine('');
    setLogLines([]);
  }, []);

  const startStream = React.useCallback(
    (mode: CronMode) => {
      closeStream();
      resetLogs();
      setErrorMessage('');
      setRunState('running');
      setActiveMode(mode);

      const url = getCronStreamUrl(normalizedBase, mode);
      const source = new EventSource(url);

      source.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data) as { status: string; mode?: CronMode };
          if (data.status === 'busy') {
            setRunState('busy');
            setErrorMessage('Another job is already running.');
            setActiveMode(data.mode ?? null);
            source.close();
          }
        } catch {
          setRunState('error');
          setErrorMessage('Failed to parse status event.');
          source.close();
        }
      });

      source.addEventListener('log', (event) => {
        try {
          const data = JSON.parse(event.data) as { chunk: string };
          handleChunk(data.chunk);
        } catch {
          setErrorMessage('Failed to parse log stream.');
        }
      });

      source.addEventListener('done', () => {
        setRunState('done');
        setActiveMode(null);
        setStatusLine('');
        source.close();
      });

      source.onerror = () => {
        if (runState === 'running') {
          setRunState('error');
          setErrorMessage('Connection closed unexpectedly.');
        }
        source.close();
      };

      sourceRef.current = source;
    },
    [closeStream, handleChunk, normalizedBase, resetLogs, runState]
  );

  React.useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines, statusLine]);

  React.useEffect(() => {
    return () => {
      closeStream();
    };
  }, [closeStream]);

  const isRunning = runState === 'running';

  return (
    <React.Fragment>
      <Card className={cn('p-8')}>
        <div className={cn('flex flex-col gap-6')}>
          <div className={cn('flex flex-wrap items-center justify-between gap-4')}>
            <div className={cn('flex items-center gap-3')}>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--accent-1)]'
                )}
              >
                <AlarmClock size={18} />
              </div>
              <div>
                <h2 className={cn('text-lg font-semibold text-[var(--ink-1)]')}>
                  Cron Runner
                </h2>
                <p className={cn('text-sm text-[var(--ink-2)]')}>
                  Trigger cron flows and stream logs in real time.
                </p>
              </div>
            </div>
            <div className={cn('flex flex-wrap items-center gap-2')}>
              <Badge
                variant={
                  runState === 'running'
                    ? 'warning'
                    : runState === 'error'
                      ? 'danger'
                      : runState === 'done'
                        ? 'success'
                        : runState === 'busy'
                          ? 'warning'
                          : 'neutral'
                }
              >
                {runState.toUpperCase()}
              </Badge>
              {activeMode ? <Badge variant="neutral">{activeMode}</Badge> : null}
            </div>
          </div>

          <div className={cn('flex flex-wrap items-center gap-3')}>
            {MODES.map((mode) => (
              <Button
                key={mode.key}
                variant={activeMode === mode.key ? 'primary' : 'outline'}
                size="sm"
                leftIcon={<Activity size={16} />}
                onClick={() => startStream(mode.key)}
                disabled={isRunning}
              >
                {mode.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<PauseCircle size={16} />}
              onClick={() => {
                closeStream();
                setRunState('idle');
                setActiveMode(null);
              }}
              disabled={!isRunning}
            >
              Stop
            </Button>
          </div>

          {errorMessage ? (
            <div
              className={cn(
                'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600'
              )}
            >
              {errorMessage}
            </div>
          ) : null}

          <div
            className={cn('rounded-3xl border border-[var(--border)] bg-[#0f1216] text-white')}
          >
            <div
              className={cn(
                'flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs uppercase tracking-[0.2em] text-white/60'
              )}
            >
              <span>Live Output</span>
              <span>{logLines.length} lines</span>
            </div>
            <div className={cn('max-h-[420px] overflow-auto px-5 py-4')}>
              <pre className={cn('whitespace-pre-wrap text-[13px] leading-5')}>
                {logLines.map((line, index) => (
                  <React.Fragment key={`${index}-${line.slice(0, 12)}`}>
                    {line}
                    {'\n'}
                  </React.Fragment>
                ))}
                {statusLine ? (
                  <span className={cn('text-emerald-300')}>{statusLine}</span>
                ) : null}
              </pre>
              <div ref={tailRef} />
            </div>
          </div>
        </div>
      </Card>
    </React.Fragment>
  );
};
