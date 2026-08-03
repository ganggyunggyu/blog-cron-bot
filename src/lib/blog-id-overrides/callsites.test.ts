import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 대시보드에서 관리한 계정 목록은 "실제로 크롤하는 프로세스"가 읽어야 반영된다.
 *
 * 애견/서리펫은 부모 워커가 아니라 exposure-page-shard 자식 프로세스가 크롤하는데,
 * 자식은 상수 모듈을 새로 import하므로 부모에서 적용한 값이 전달되지 않는다.
 * 실제로 이 호출이 빠져서 대시보드 변경이 페이지 체크에 조용히 무시된 적이 있다.
 * 크롤 진입점이 늘어날 때 같은 누락이 반복되지 않도록 소스에서 직접 확인한다.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');

const CRAWL_ENTRYPOINTS = [
  'src/exposure-page-shard.ts',
  'src/exposure-worker.ts',
  'src/tools/run-parallel-direct-sheet-check.ts',
  // 분산 실행에서 패키지·일반건·도그마루 조각을 크롤하는 진입점.
  // worker-child가 keywordIds가 있는 direct-sheet 대상을 여기로 보내는데,
  // 이 호출이 없어 도그마루에 새로 추가한 계정이 한 차례 통째로 빠졌다.
  'src/index.ts',
];

const HOOK = 'applyStoredBlogIdOverrides';

CRAWL_ENTRYPOINTS.forEach((relativePath) => {
  const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
  assert.ok(
    source.includes(`${HOOK}(`),
    `${relativePath}에 ${HOOK}() 호출이 없음 — 대시보드에서 바꾼 계정이 반영되지 않음`
  );
  assert.ok(
    source.includes(`import { ${HOOK} }`) || source.includes(`${HOOK},`),
    `${relativePath}에 ${HOOK} import가 없음`
  );
});

process.stdout.write('blog id override callsite tests passed\n');
