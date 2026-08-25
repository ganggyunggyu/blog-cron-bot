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
 *
 * DB에 이미 연결된 진입점은 `applyStoredBlogIdOverrides`를, 시트만 보고 도느라 DB 연결이
 * 없는 진입점은 스스로 연결하는 `applyStoredBlogIdOverridesStandalone`을 쓴다.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');

const CONNECTED_HOOK = 'applyStoredBlogIdOverrides';
const STANDALONE_HOOK = 'applyStoredBlogIdOverridesStandalone';

const CRAWL_ENTRYPOINTS: Array<{
  path: string;
  hook: typeof CONNECTED_HOOK | typeof STANDALONE_HOOK;
  note: string;
}> = [
  {
    path: 'src/exposure-page-shard.ts',
    hook: CONNECTED_HOOK,
    note: '애견·서리펫 페이지 체크 자식 프로세스',
  },
  {
    path: 'src/exposure-worker.ts',
    hook: CONNECTED_HOOK,
    note: '분산 실행의 부모 워커',
  },
  {
    path: 'src/tools/run-parallel-direct-sheet-check.ts',
    hook: CONNECTED_HOOK,
    note: '패키지·일반건·도그마루·서리펫·애견 병렬 실행',
  },
  {
    path: 'src/index.ts',
    hook: CONNECTED_HOOK,
    // worker-child가 keywordIds가 있는 direct-sheet 대상을 여기로 보내는데,
    // 이 호출이 없어 도그마루에 새로 추가한 계정이 한 차례 통째로 빠졌다.
    note: '분산 실행에서 패키지·일반건·도그마루 조각을 크롤하는 진입점',
  },
  {
    path: 'src/tools/check-old-logic-more-exposure.ts',
    hook: STANDALONE_HOOK,
    // 이 호출이 없어 설정 화면에서 계정을 추가해도 더보기만 예전 목록으로 검사했다.
    note: '더보기 전 종류(패키지·일반건·도그마루·루트)',
  },
  {
    path: 'src/cron-cafe-current-exposure.ts',
    hook: STANDALONE_HOOK,
    // DB 연결 없이 시트만 보고 돌아서 계정 설정을 한 번도 불러오지 않고 있었다.
    note: '카페+블로그 체크 — 7개 메인 대상 중 하나',
  },
];

/*
 * 여기에는 레포에 실제로 커밋된 파일만 넣는다.
 *
 * src/tools/*는 .gitignore에 걸려 있고 파일마다 예외를 적어야 올라간다. 올라가지
 * 않은 파일을 여기 적어두면 이 맥에서는 통과하고 새로 클론한 곳에서는 readFileSync가
 * ENOENT로 죽는다. test:unit이 && 체인이라 그 뒤 테스트가 전부 안 돌게 된다.
 */
CRAWL_ENTRYPOINTS.forEach(({ path: relativePath, hook, note }) => {
  const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
  assert.ok(
    source.includes(`${hook}(`),
    `${relativePath}(${note})에 ${hook}() 호출이 없음 — 대시보드에서 바꾼 계정이 반영되지 않음`
  );
  assert.ok(
    source.includes(`import { ${hook} }`) || source.includes(`${hook},`),
    `${relativePath}에 ${hook} import가 없음`
  );
});

process.stdout.write('blog id override callsite tests passed\n');
