'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { ChevronDown, Layers3, Play, ShieldCheck } from 'lucide-react';
import { useJobList, useRunJob, type ExposureTargetId } from '@/entities/job';
import { Badge, Button, Card, cn, selectedRunIdAtom } from '@/shared';
import { NumberOption, TargetOption } from './option-controls';

const getSuiteStatus = (
  isLoading: boolean,
  isError: boolean,
  hasSuiteJob: boolean,
  isRunning: boolean,
  isBlocked: boolean,
): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } => {
  if (isLoading) return { label: '확인 중', tone: 'neutral' };
  if (isError || !hasSuiteJob) return { label: '사용 불가', tone: 'danger' };
  if (isRunning) return { label: '실행 중', tone: 'warning' };
  if (isBlocked) return { label: '다른 작업 실행 중', tone: 'warning' };
  return { label: '실행 가능', tone: 'success' };
};

export const ExposureSuitePanel = () => {
  const { data: jobs, isLoading, isError } = useJobList();
  const { mutate: runJob, isPending, error, reset } = useRunJob();
  const setSelectedRunId = useSetAtom(selectedRunIdAtom);
  const suiteJob = jobs?.find((job) => job.kind === 'exposure-suite');
  const isDistributed = suiteJob?.executionMode === 'distributed';
  const definition = suiteJob?.options;
  const initializedRef = React.useRef(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [selectedTargets, setSelectedTargets] = React.useState<ExposureTargetId[]>([]);
  const [concurrency, setConcurrency] = React.useState<number | null>(null);
  const [maxPages, setMaxPages] = React.useState<number | null>(null);
  const [targetConcurrency, setTargetConcurrency] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!definition || initializedRef.current) return;
    initializedRef.current = true;
    setSelectedTargets(definition.targets.map(({ id }) => id));
    setConcurrency(definition.concurrency.defaultValue);
    setMaxPages(definition.maxPages.defaultValue);
    setTargetConcurrency(definition.targetConcurrency.defaultValue);
  }, [definition]);

  const isRunning = suiteJob?.isRunning ?? false;
  const isBlocked = suiteJob?.isBlocked ?? false;
  const isReady =
    definition !== undefined &&
    concurrency !== null &&
    maxPages !== null &&
    targetConcurrency !== null;
  const suiteStatus = getSuiteStatus(isLoading, isError, Boolean(suiteJob), isRunning, isBlocked);

  const runWith = (targets: ExposureTargetId[]) => {
    if (!definition || concurrency === null || maxPages === null || targetConcurrency === null) {
      return;
    }
    reset();
    runJob(
      { jobId: 'exposure-suite', options: { targets, concurrency, maxPages, targetConcurrency } },
      { onSuccess: ({ runId }) => setSelectedRunId(runId) },
    );
  };

  const handleRunAll = () => {
    if (!definition) return;
    runWith(definition.targets.map(({ id }) => id));
  };

  const handleRunSelected = () => {
    if (!definition) return;
    const targets = definition.targets
      .map(({ id }) => id)
      .filter((targetId) => selectedTargets.includes(targetId));
    runWith(targets);
  };

  const handleToggleTarget = (targetId: ExposureTargetId) => {
    setSelectedTargets((current) =>
      current.includes(targetId)
        ? current.filter((candidate) => candidate !== targetId)
        : [...current, targetId],
    );
  };

  const handleSelectAll = () => {
    if (!definition) return;
    const allTargets = definition.targets.map(({ id }) => id);
    setSelectedTargets(selectedTargets.length === allTargets.length ? [] : allTargets);
  };

  const handleToggleAdvanced = () => setShowAdvanced((prev) => !prev);

  const totalTargets = definition?.targets.length ?? 0;
  const runAllDisabled = !isReady || isRunning || isBlocked || isPending;
  const runSelectedDisabled = runAllDisabled || selectedTargets.length === 0;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-5 border-l-2 border-l-[var(--signal)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="stamp">Run all</span>
            <Badge withDot tone={suiteStatus.tone}>
              {suiteStatus.label}
            </Badge>
          </div>
          <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
            전체 노출체크
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
            {totalTargets > 0
              ? `${totalTargets}개 시트를 한 번에 검사하고 시트 반영과 알림까지 처리합니다.`
              : '모든 시트를 한 번에 검사하고 시트 반영과 알림까지 처리합니다.'}
          </p>
        </div>

        <Button
          size="lg"
          className="w-full shrink-0 sm:w-auto"
          disabled={runAllDisabled}
          onClick={handleRunAll}
        >
          <Play className="size-[18px]" />
          {isPending ? '요청하는 중' : isRunning ? '실행 중' : '전체 실행'}
        </Button>
      </div>

      <div className="border-t border-[var(--line)] px-5 py-3">
        <button
          type="button"
          onClick={handleToggleAdvanced}
          className="flex w-full items-center justify-between gap-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          <span className="flex items-center gap-2">
            <Layers3 className="size-4 text-[var(--signal)]" />
            세부 설정 · 일부 대상만 실행
          </span>
          <ChevronDown className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')} />
        </button>

        {showAdvanced && definition ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  대상 선택 · {selectedTargets.length}/{totalTargets}
                </span>
                <Button size="sm" variant="ghost" onClick={handleSelectAll}>
                  {selectedTargets.length === totalTargets ? '전체 해제' : '전체 선택'}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {definition.targets.map((target) => (
                  <TargetOption
                    key={target.id}
                    target={target}
                    isSelected={selectedTargets.includes(target.id)}
                    onToggle={handleToggleTarget}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              {isDistributed ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]/80 px-3 py-2">
                  <p className="text-sm font-medium text-[var(--ink)]">시트 내부 병렬 수</p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    원본의 유효 키워드 행 수에 맞춰 자동 실행
                  </p>
                </div>
              ) : (
                <NumberOption
                  {...definition.concurrency}
                  value={concurrency}
                  description="각 실행 서버가 동시에 처리할 요청 수"
                  onChange={setConcurrency}
                />
              )}
              <NumberOption
                {...definition.maxPages}
                value={maxPages}
                description="애견·서리펫에만 적용 (도그마루는 1페이지)"
                onChange={setMaxPages}
              />
              <NumberOption
                {...definition.targetConcurrency}
                value={targetConcurrency}
                description={isDistributed ? '클라우드 워커가 없을 때 함께 처리할 예비 프로세스 수' : '동시에 시작할 대상 수'}
                onChange={setTargetConcurrency}
              />
              <div className="mt-1 flex gap-2 rounded-lg border border-[var(--line)] bg-[var(--signal)]/8/70 p-3 text-xs leading-5 text-blue-800">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <p>
                  {isDistributed
                    ? '각 시트는 서로 다른 원격 워커와 외부 IP 하나를 전용으로 씁니다. 전체 성공 후 결과 반영과 Dooray 전송을 대상별 한 번만 수행합니다.'
                    : '선택한 시트를 병렬 실행하고 완료 후 대상별 결과를 확인합니다.'}
                </p>
              </div>
              <Button
                variant="secondary"
                className="mt-auto"
                disabled={runSelectedDisabled}
                onClick={handleRunSelected}
              >
                <Play className="size-4" />
                선택 {selectedTargets.length}개만 실행
              </Button>
            </section>
          </div>
        ) : null}

        {isError ? <p className="mt-2 text-sm text-[var(--alert)]">실행 설정을 불러오지 못함</p> : null}
        {error ? <p className="mt-2 text-sm text-[var(--alert)]">{error.message}</p> : null}
      </div>
    </Card>
  );
};
