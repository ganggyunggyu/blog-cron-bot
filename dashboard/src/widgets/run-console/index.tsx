'use client';

import React from 'react';
import {
  useJobList,
  useRunJob,
  type ExposureTargetId,
  type JobDefinition,
  type ResolvedRunBundle,
} from '@/entities/job';
import { usePreset, useSavePreset } from '@/entities/preset';
import {
  findTargetProgress,
  parseLogLine,
  useRunList,
  useRunLogStream,
  useStopRun,
  type RunSummary,
} from '@/entities/run';
import { Card } from '@/shared';
import { CheckList } from './check-list';
import { LogPanel } from './log-panel';
import { buildCheckRows, buildTargetRows, summarizeShards } from './model';
import { SelectionFooter } from './selection-footer';
import { ShortcutBar } from './shortcut-bar';
import { StatusBar } from './status-bar';
import { TargetBoard } from './target-board';

const findActiveRun = (runs: RunSummary[] | undefined): RunSummary | null =>
  runs?.find(({ status }) => status === 'running') ?? null;

export const RunConsole = () => {
  const { data: jobList } = useJobList();
  const { data: runs } = useRunList();
  const { data: presetData } = usePreset();
  const { mutate: runJob, isPending } = useRunJob();
  const { mutate: savePreset, isPending: isSaving } = useSavePreset();
  const { mutate: stopRun, isPending: isStopping } = useStopRun();

  const jobs = React.useMemo(() => jobList?.jobs ?? [], [jobList]);
  const bundles = jobList?.bundles ?? [];

  const activeRun = findActiveRun(runs);
  const lastRun = runs?.[0] ?? null;
  const { lines } = useRunLogStream(activeRun?.runId ?? null);

  const [selectedTargets, setSelectedTargets] = React.useState<ExposureTargetId[]>([]);
  // null이면 "아직 안 골랐다"는 뜻이고 서버 기본값을 쓴다. effect로 채우면
  // 렌더 도중 상태를 바꾸게 되고, 기본값이 바뀌어도 반영되지 않는다.
  const [chosenMaxPages, setChosenMaxPages] = React.useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [errorByJobId, setErrorByJobId] = React.useState<Record<string, string>>({});

  const suiteJob = jobs.find((job) => job.kind === 'exposure-suite');
  const definition = suiteJob?.options;
  const maxPages = chosenMaxPages ?? definition?.maxPages.defaultValue ?? null;

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
  const progressRows = React.useMemo(
    () => buildTargetRows(findTargetProgress(parsedLines)),
    [parsedLines],
  );
  const shards = React.useMemo(() => summarizeShards(progressRows), [progressRows]);
  const counts = React.useMemo(() => {
    let success = 0;
    let failure = 0;
    parsedLines.forEach(({ kind }) => {
      if (kind === 'success') success += 1;
      if (kind === 'failure') failure += 1;
    });
    return { success, failure };
  }, [parsedLines]);

  const targetLabels = React.useMemo(
    () =>
      new Map((definition?.targets ?? []).map(({ id, label }) => [id, label])),
    [definition],
  );
  const dailyRows = React.useMemo(
    () => buildCheckRows(jobs, 'daily', targetLabels),
    [jobs, targetLabels],
  );
  const moreRows = React.useMemo(
    () => buildCheckRows(jobs, 'more', targetLabels),
    [jobs, targetLabels],
  );
  const toolRows = React.useMemo(
    () => buildCheckRows(jobs, 'tool', targetLabels),
    [jobs, targetLabels],
  );

  const isBusy = activeRun !== null || isPending;
  const allTargetIds = React.useMemo(
    () => (definition?.targets ?? []).map(({ id }) => id),
    [definition],
  );

  const rememberError = (jobId: string, message: string) => {
    setErrorByJobId((current) => ({ ...current, [jobId]: message }));
  };

  const clearError = (jobId: string) => {
    setErrorByJobId((current) => {
      if (!(jobId in current)) return current;
      const next = { ...current };
      delete next[jobId];
      return next;
    });
  };

  const runSuite = (targets: ExposureTargetId[], pages: number | null) => {
    if (!definition || targets.length === 0) return;
    clearError('exposure-suite');
    runJob(
      {
        jobId: 'exposure-suite',
        options: {
          targets,
          concurrency: definition.concurrency.defaultValue,
          maxPages: pages ?? definition.maxPages.defaultValue,
          targetConcurrency: definition.targetConcurrency.defaultValue,
        },
      },
      { onError: (error) => rememberError('exposure-suite', error.message) },
    );
  };

  const handleRunAll = () => runSuite(allTargetIds, maxPages);
  const handleRunSelected = () => runSuite(selectedTargets, maxPages);
  const handleRunBundle = (bundle: ResolvedRunBundle) =>
    runSuite(bundle.targets, bundle.maxPages ?? null);

  /** 줄에서 누르는 실행은 오늘과 똑같은 잡을 똑같은 옵션으로 부른다. */
  const handleRunJob = (job: JobDefinition, options?: { url: string }) => {
    clearError(job.id);
    runJob(
      { jobId: job.id, options },
      { onError: (error) => rememberError(job.id, error.message) },
    );
  };

  const handleToggleSelect = (targetId: string) => {
    setSelectedTargets((current) =>
      current.includes(targetId as ExposureTargetId)
        ? current.filter((candidate) => candidate !== targetId)
        : [...current, targetId as ExposureTargetId],
    );
  };

  const handleClearSelection = () => setSelectedTargets([]);

  const handleSaveBundle = (label: string) => {
    const preset = presetData?.preset;
    if (!preset || selectedTargets.length === 0) return;
    const bundleList = preset.runBundles ?? [];
    const used = new Set(bundleList.map(({ id }) => id));
    let index = bundleList.length + 1;
    while (used.has(`bundle-${index}`)) index += 1;

    savePreset({
      ...preset,
      runBundles: [
        ...bundleList,
        {
          id: `bundle-${index}`,
          label,
          targets: [...selectedTargets],
          maxPages: maxPages ?? undefined,
        },
      ],
    });
    setSelectedTargets([]);
  };

  const handleStop = () => {
    if (activeRun) stopRun(activeRun.runId);
  };

  const hasNoChecks = jobs.length === 0;

  return (
    <Card className="overflow-hidden p-0">
      <StatusBar
        activeRun={activeRun}
        lastRun={lastRun}
        elapsedMs={elapsedMs}
        shards={shards}
        isStopping={isStopping}
        onStop={handleStop}
      />

      {hasNoChecks ? (
        <p className="px-5 py-6 text-sm text-[var(--ink-soft)]">
          이 계정에 켜둔 노출체크가 없습니다. 설정에서 체크를 먼저 켜야 실행할 수 있습니다.
        </p>
      ) : (
        <React.Fragment>
          <ShortcutBar
            bundles={bundles}
            targetLabels={targetLabels}
            canRunAll={allTargetIds.length > 0}
            isBusy={isBusy}
            onRunAll={handleRunAll}
            onRunBundle={handleRunBundle}
          />

          <CheckList
            title="매일 돌리는 체크"
            rows={dailyRows}
            selectedTargets={selectedTargets}
            isBusy={isBusy}
            errorByJobId={errorByJobId}
            onToggleSelect={handleToggleSelect}
            onRun={handleRunJob}
          />
          <CheckList
            title="더보기"
            rows={moreRows}
            selectedTargets={selectedTargets}
            isBusy={isBusy}
            errorByJobId={errorByJobId}
            onRun={handleRunJob}
          />
          <CheckList
            title="도구"
            rows={toolRows}
            selectedTargets={selectedTargets}
            isBusy={isBusy}
            errorByJobId={errorByJobId}
            onRun={handleRunJob}
          />

          <SelectionFooter
            count={selectedTargets.length}
            maxPages={maxPages}
            pageRange={{
              min: definition?.maxPages.min ?? 1,
              max: definition?.maxPages.max ?? 9,
            }}
            isBusy={isBusy}
            isSaving={isSaving}
            onMaxPagesChange={setChosenMaxPages}
            onRun={handleRunSelected}
            onSaveBundle={handleSaveBundle}
            onClear={handleClearSelection}
          />
        </React.Fragment>
      )}

      {activeRun && progressRows.length > 0 ? (
        <div className="border-t border-[var(--line)] px-5 py-3">
          <TargetBoard rows={progressRows} />
        </div>
      ) : null}

      {activeRun ? (
        <LogPanel
          lines={parsedLines.filter(({ kind }) => kind !== 'detail')}
          successCount={counts.success}
          failureCount={counts.failure}
        />
      ) : null}
    </Card>
  );
};
