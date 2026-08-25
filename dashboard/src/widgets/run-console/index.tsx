'use client';

import React from 'react';
import { ChevronDown, Play, Square } from 'lucide-react';
import {
  useJobList,
  useRunJob,
  type ExposureTargetId,
} from '@/entities/job';
import {
  findTargetProgress,
  parseLogLine,
  useRunList,
  useRunLogStream,
  useStopRun,
  type RunSummary,
} from '@/entities/run';
import { Button, Card, cn, formatDateTime } from '@/shared';
import { LogPanel } from './log-panel';
import { buildTargetRows, formatElapsed, summarizeShards } from './model';
import { RootCafeUrlForm } from './root-cafe-url-form';
import { NumberOption, TargetOption } from './run-options';
import { TargetBoard } from './target-board';

/** 더보기는 매일 쓰는 두 개만 앞으로 뺀다. 나머지는 아래 개별 실행에 있다. */
const MORE_SHORTCUTS = [
  { jobId: 'package-general-dogmaru-more-exposure', label: '패키지·일반건·도그마루' },
  { jobId: 'root-more-exposure', label: '루트' },
];

const RUN_STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지',
  unknown: '알 수 없음',
};

const RUN_STATUS_TONE: Record<string, string> = {
  running: 'text-[var(--signal)]',
  success: 'text-[var(--live)]',
  failed: 'text-[var(--alert)]',
  stopped: 'text-[var(--ink-soft)]',
  unknown: 'text-[var(--ink-faint)]',
};

const findActiveRun = (runs: RunSummary[] | undefined): RunSummary | null =>
  runs?.find(({ status }) => status === 'running') ?? null;

export const RunConsole = () => {
  const { data: jobs } = useJobList();
  const { data: runs } = useRunList();
  const { mutate: runJob, isPending, error, reset } = useRunJob();
  const { mutate: stopRun, isPending: isStopping } = useStopRun();

  const activeRun = findActiveRun(runs);
  const lastRun = runs?.[0] ?? null;
  const { lines } = useRunLogStream(activeRun?.runId ?? null);

  const [showOptions, setShowOptions] = React.useState(false);
  const [selectedTargets, setSelectedTargets] = React.useState<ExposureTargetId[]>([]);
  const [maxPages, setMaxPages] = React.useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  const suiteJob = jobs?.find((job) => job.kind === 'exposure-suite');
  const definition = suiteJob?.options;
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!definition || initializedRef.current) return;
    initializedRef.current = true;
    setSelectedTargets(definition.targets.map(({ id }) => id));
    setMaxPages(definition.maxPages.defaultValue);
  }, [definition]);

  // 경과 시간은 서버 렌더 결과와 어긋나면 안 되므로 화면이 뜬 뒤에만 센다.
  const startedAt = activeRun?.startedAt ?? null;
  React.useEffect(() => {
    if (startedAt === null) return undefined;
    const tick = () => setElapsedMs(Date.now() - startedAt);
    const firstTick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, [startedAt]);

  const parsedLines = React.useMemo(() => lines.map(parseLogLine), [lines]);
  const rows = React.useMemo(
    () => buildTargetRows(findTargetProgress(parsedLines)),
    [parsedLines],
  );
  const shards = React.useMemo(() => summarizeShards(rows), [rows]);
  const counts = React.useMemo(() => {
    let success = 0;
    let failure = 0;
    parsedLines.forEach(({ kind }) => {
      if (kind === 'success') success += 1;
      if (kind === 'failure') failure += 1;
    });
    return { success, failure };
  }, [parsedLines]);

  const handleToggleOptions = () => setShowOptions((current) => !current);

  const handleToggleTarget = (targetId: ExposureTargetId) => {
    setSelectedTargets((current) =>
      current.includes(targetId)
        ? current.filter((candidate) => candidate !== targetId)
        : [...current, targetId],
    );
  };

  const runSuite = (targets: ExposureTargetId[]) => {
    if (!definition || maxPages === null) return;
    reset();
    runJob({
      jobId: 'exposure-suite',
      options: {
        targets,
        concurrency: definition.concurrency.defaultValue,
        maxPages,
        targetConcurrency: definition.targetConcurrency.defaultValue,
      },
    });
  };

  const handleRunAll = () => {
    if (!definition) return;
    runSuite(definition.targets.map(({ id }) => id));
  };

  const handleRunSelected = () => runSuite(selectedTargets);

  const handleRunMore = (jobId: string) => {
    reset();
    runJob({ jobId });
  };

  const handleStop = () => {
    if (activeRun) stopRun(activeRun.runId);
  };

  const targetCount = definition?.targets.length ?? 0;
  // 프리셋에 켜진 대상이 없으면 돌릴 게 없다. 버튼을 눌러 400을 받는 대신
  // 어디로 가야 하는지 알려준다.
  const hasNoTargets = definition !== undefined && targetCount === 0;
  const isBusy = activeRun !== null || isPending;

  return (
    <Card className="overflow-hidden p-0">
      {activeRun ? (
        <div className="border-l-2 border-l-[var(--signal)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--signal)] animate-pulse-dot" />
                <span className="stamp text-[var(--signal)]">실행 중</span>
                <span className="tabular text-xs text-[var(--ink-soft)]">
                  {formatElapsed(elapsedMs)} 경과
                </span>
              </div>
              <h2 className="mt-2 truncate text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                {activeRun.jobLabel}
              </h2>
            </div>

            <Button variant="danger" disabled={isStopping} onClick={handleStop}>
              <Square className="size-4" />
              정지
            </Button>
          </div>

          {shards.total > 0 ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="tabular text-sm text-[var(--ink)]">
                  {shards.done}
                  <span className="text-[var(--ink-faint)]">/{shards.total} 조각</span>
                </span>
                <span className="tabular text-sm text-[var(--signal)]">
                  {shards.percent}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--line)]"
                role="progressbar"
                aria-label="전체 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={shards.percent}
              >
                <div
                  className="h-full rounded-full bg-[var(--signal)] transition-[width] duration-500 ease-out"
                  style={{ width: `${shards.percent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              키워드를 불러오는 중
            </p>
          )}

          {rows.length > 0 ? (
            <div className="mt-4 border-t border-[var(--line)] pt-1">
              <TargetBoard rows={rows} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <span className="stamp">대기</span>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                전체 노출체크
              </h2>
              <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
                {hasNoTargets
                  ? '이 계정에 켜둔 시트가 없습니다. 설정에서 대상을 먼저 켜야 실행할 수 있습니다.'
                  : `${targetCount}개 시트를 검사하고 시트 반영과 두레이 발송까지 이어서 처리합니다.`}
              </p>
            </div>

            <Button
              size="lg"
              className="w-full shrink-0 sm:w-auto"
              disabled={!definition || hasNoTargets || isPending}
              onClick={handleRunAll}
            >
              <Play className="size-[18px]" />
              {isPending ? '시작하는 중' : '지금 실행'}
            </Button>
          </div>

          {lastRun ? (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-faint)]">
              <span>마지막 실행</span>
              <span className="text-[var(--ink-soft)]">{lastRun.jobLabel}</span>
              <span className="tabular">
                {formatDateTime(new Date(lastRun.startedAt).toISOString())}
              </span>
              <span className={cn(RUN_STATUS_TONE[lastRun.status] ?? '')}>
                {RUN_STATUS_LABELS[lastRun.status] ?? lastRun.status}
              </span>
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
        <span className="mr-1 text-xs text-[var(--ink-faint)]">더보기</span>
        {MORE_SHORTCUTS.map((shortcut) => {
          const job = jobs?.find(({ id }) => id === shortcut.jobId);
          const handleClick = () => handleRunMore(shortcut.jobId);
          return (
            <Button
              key={shortcut.jobId}
              size="sm"
              variant="secondary"
              disabled={!job || isBusy}
              onClick={handleClick}
            >
              {shortcut.label}
            </Button>
          );
        })}
      </div>

      <RootCafeUrlForm disabled={isBusy} />

      <div className="border-t border-[var(--line)]">
        <button
          type="button"
          onClick={handleToggleOptions}
          aria-expanded={showOptions}
          className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          <span>대상과 페이지 범위 고르기</span>
          <ChevronDown
            className={cn('size-4 transition-transform', showOptions && 'rotate-180')}
          />
        </button>

        {showOptions && definition ? (
          <div className="border-t border-[var(--line)] px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {definition.targets.map((target) => (
                <TargetOption
                  key={target.id}
                  target={target}
                  isSelected={selectedTargets.includes(target.id)}
                  onToggle={handleToggleTarget}
                />
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <NumberOption
                {...definition.maxPages}
                value={maxPages}
                description="애견과 서리펫에만 적용"
                onChange={setMaxPages}
              />
              <Button
                variant="secondary"
                className="h-auto"
                disabled={isBusy || selectedTargets.length === 0 || maxPages === null}
                onClick={handleRunSelected}
              >
                <Play className="size-4" />
                고른 {selectedTargets.length}개만 실행
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {activeRun ? (
        <LogPanel
          lines={parsedLines.filter(({ kind }) => kind !== 'detail')}
          successCount={counts.success}
          failureCount={counts.failure}
        />
      ) : null}

      {error ? (
        <p className="border-t border-[var(--line)] px-5 py-3 text-sm text-[var(--alert)]">
          {error.message}
        </p>
      ) : null}
    </Card>
  );
};
