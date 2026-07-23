'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { Gauge, Layers3, Play, ShieldCheck } from 'lucide-react';
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

  const handleRun = () => {
    if (!definition || concurrency === null || maxPages === null || targetConcurrency === null) {
      return;
    }
    const targets = definition.targets
      .map(({ id }) => id)
      .filter((targetId) => selectedTargets.includes(targetId));
    reset();
    runJob(
      { jobId: 'exposure-suite', options: { targets, concurrency, maxPages, targetConcurrency } },
      { onSuccess: ({ runId }) => setSelectedRunId(runId) },
    );
  };

  const isRunning = suiteJob?.isRunning ?? false;
  const isBlocked = suiteJob?.isBlocked ?? false;
  const isReady =
    definition !== undefined &&
    concurrency !== null &&
    maxPages !== null &&
    targetConcurrency !== null;
  const isDisabled = !isReady || selectedTargets.length === 0 || isRunning || isBlocked || isPending;
  const suiteStatus = getSuiteStatus(isLoading, isError, Boolean(suiteJob), isRunning, isBlocked);

  return (
    <Card className={cn('overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-0 dark:border-blue-900 dark:from-blue-950/50 dark:via-neutral-900 dark:to-cyan-950/30')}>
      <div className={cn('border-b border-blue-100 px-5 py-4 dark:border-blue-900/70')}>
        <div className={cn('flex flex-wrap items-start justify-between gap-3')}>
          <div className={cn('flex items-start gap-3')}>
            <span className={cn('rounded-xl bg-blue-600 p-2.5 text-white shadow-sm')}>
              <Gauge className={cn('size-5')} />
            </span>
            <div>
              <h2 className={cn('text-base font-semibold text-neutral-950 dark:text-white')}>
                {suiteJob?.label ?? '전체 노출체크'}
              </h2>
              <p className={cn('mt-1 text-sm text-neutral-600 dark:text-neutral-300')}>
                {suiteJob?.description ?? '필요한 노출체크 대상을 선택해 실행합니다.'}
              </p>
            </div>
          </div>
          <Badge tone={suiteStatus.tone}>{suiteStatus.label}</Badge>
        </div>
      </div>

      <div className={cn('grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]')}>
        <section>
          <div className={cn('mb-3 flex items-center justify-between gap-3')}>
            <h3 className={cn('flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200')}>
              <Layers3 className={cn('size-4 text-blue-600')} /> 대상 선택
              <span className={cn('text-xs font-normal text-neutral-500')}>{selectedTargets.length}개</span>
            </h3>
            <Button variant="ghost" disabled={!definition} onClick={handleSelectAll}>
              {definition && selectedTargets.length === definition.targets.length ? '전체 해제' : '전체 선택'}
            </Button>
          </div>
          <div className={cn('grid gap-2 sm:grid-cols-2')}>
            {definition?.targets.map((target) => (
              <TargetOption
                key={target.id}
                target={target}
                isSelected={selectedTargets.includes(target.id)}
                onToggle={handleToggleTarget}
              />
            ))}
          </div>
        </section>

        <section className={cn('flex flex-col gap-2')}>
          {definition ? (
            <React.Fragment>
              {isDistributed ? (
                <div className={cn('rounded-lg border border-blue-100 bg-white/80 px-3 py-2 dark:border-blue-900 dark:bg-neutral-900/70')}>
                  <p className={cn('text-sm font-medium text-neutral-800 dark:text-neutral-200')}>
                    시트 내부 병렬 수
                  </p>
                  <p className={cn('mt-1 text-xs text-neutral-500 dark:text-neutral-400')}>
                    원본의 유효 키워드 행 수에 맞춰 자동 실행
                  </p>
                </div>
              ) : (
                <NumberOption {...definition.concurrency} value={concurrency} description="각 실행 서버가 동시에 처리할 요청 수" onChange={setConcurrency} />
              )}
              <NumberOption {...definition.maxPages} value={maxPages} description="애견·서리펫에만 적용 (도그마루는 1페이지)" onChange={setMaxPages} />
              <NumberOption {...definition.targetConcurrency} value={targetConcurrency} description={isDistributed ? '클라우드 워커가 없을 때 함께 처리할 예비 프로세스 수' : '동시에 시작할 대상 수'} onChange={setTargetConcurrency} />
            </React.Fragment>
          ) : null}
          <div className={cn('mt-1 flex gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200')}>
            <ShieldCheck className={cn('mt-0.5 size-4 shrink-0')} />
            <p>{isDistributed ? '각 시트는 서로 다른 원격 워커와 외부 IP 하나를 전용으로 사용합니다. 시트의 모든 키워드를 병렬 풀에 넣고, 전체 성공 후 결과 반영과 Dooray 전송을 대상별 한 번만 수행합니다.' : '선택한 시트를 병렬 실행하고 완료 후 대상별 결과를 확인합니다.'}</p>
          </div>
          {isLoading ? <p className={cn('text-sm text-neutral-500')}>설정을 불러오는 중...</p> : null}
          {isError ? <p className={cn('text-sm text-red-600 dark:text-red-400')}>실행 설정을 불러오지 못함</p> : null}
          {error ? <p className={cn('text-sm text-red-600 dark:text-red-400')}>{error.message}</p> : null}
          {selectedTargets.length === 0 ? <p className={cn('text-xs text-amber-700 dark:text-amber-300')}>실행할 대상을 1개 이상 선택해 주세요.</p> : null}
          <Button className={cn('mt-auto min-h-11')} disabled={isDisabled} onClick={handleRun}>
            <Play className={cn('size-4')} />
            {isPending ? '실행 요청 중...' : isRunning ? '실행 중' : isDistributed ? '다중 워커로 실행' : '빠른 노출체크 실행'}
          </Button>
        </section>
      </div>
    </Card>
  );
};
