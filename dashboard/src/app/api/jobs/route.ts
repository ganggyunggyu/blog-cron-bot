import { NextResponse, type NextRequest } from 'next/server';
import { isJobActive, isJobBlocked } from '@/server/job-runner';
import {
  getJobsForPreset,
  getSuiteTargetsForPreset,
  resolveRunBundles,
} from '@/server/member-jobs';
import { EXPOSURE_SUITE_OPTION_DEFINITION } from '@/server/exposure-suite-options';
import { readSessionMember } from '@/server/session-member';

/**
 * 로그인한 회원이 실제로 돌릴 수 있는 항목만 내려준다.
 *
 * 예전에는 프리셋과 무관하게 전체 목록을 내려줬다. 화면에는 보이는데 그 계정에는
 * 시트도 계정 목록도 없는 항목이 섞여 있었고, 눌러도 21lab 설정으로 돌았다.
 */
export const GET = async (request: NextRequest) => {
  let member;
  try {
    member = await readSessionMember(request);
  } catch (error) {
    console.error('실행 목록 조회 전 세션 확인 실패', error);
    return NextResponse.json(
      { error: '실행 목록을 불러오지 못함' },
      { status: 500 },
    );
  }
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요함' }, { status: 401 });
  }

  const { preset } = member;
  const suiteTargets = getSuiteTargetsForPreset(preset);

  const jobs = getJobsForPreset(preset).map((job) => {
    const isBlocked = isJobBlocked(job.id);
    return {
      id: job.id,
      label: job.label,
      description: job.description,
      riskNote: job.riskNote,
      kind: job.kind,
      category: job.category,
      // 전체 실행의 대상 목록은 이 회원이 켜둔 것만 보여준다.
      options: job.options
        ? { ...EXPOSURE_SUITE_OPTION_DEFINITION, targets: suiteTargets }
        : undefined,
      executionMode: job.executionMode,
      isRunning: isJobActive(job.id),
      isBlocked,
      blockReason: isBlocked ? '다른 노출체크가 실행 중임' : undefined,
    };
  });

  return NextResponse.json({ jobs, bundles: resolveRunBundles(preset) });
};
