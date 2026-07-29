import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';
import { EMPTY_PRESET, LAB_21_PRESET, resolveTargetBlogIds } from './preset';
import {
  BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
} from '../../constants/blog-ids';
import { selectTargetBlogIds } from './target-blog-ids';
import type { MemberSummary } from './store';

const findTarget = (id: string) => {
  const target = LAB_21_PRESET.targets.find((entry) => entry.id === id);
  assert.ok(target, `${id} 대상이 빠짐`);
  return target;
};

const sorted = (blogIds: readonly string[]) => [...blogIds].sort();

const main = async (): Promise<void> => {
  const hash = await hashPassword('akfalwk12!');

  // 같은 비밀번호라도 salt가 달라 해시는 매번 달라야 한다.
  const second = await hashPassword('akfalwk12!');
  assert.notEqual(hash, second);

  assert.equal(await verifyPassword('akfalwk12!', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);

  // 형식이 깨진 해시는 예외 없이 false로 떨어져야 한다.
  assert.equal(await verifyPassword('akfalwk12!', ''), false);
  assert.equal(await verifyPassword('akfalwk12!', 'not-a-hash'), false);
  assert.equal(await verifyPassword('akfalwk12!', 'scrypt$64$onlysalt'), false);

  // 새 회원은 남의 시트가 딸려가면 안 되므로 빈 프리셋이어야 한다.
  assert.equal(EMPTY_PRESET.targets.length, 0);

  // 21lab 프리셋은 현재 운영 대상을 모두 담고 있어야 한다.
  const ids = LAB_21_PRESET.targets.map(({ id }) => id);
  ['package', 'general', 'dogmaru', 'root', 'pet', 'suripet', 'cafe'].forEach(
    (id) => assert.ok(ids.includes(id), `${id} 대상이 빠짐`)
  );
  ['package-more', 'general-more', 'dogmaru-more', 'root-more'].forEach((id) =>
    assert.ok(ids.includes(id), `${id} 더보기 대상이 빠짐`)
  );

  // 모든 대상은 읽기 시트를 반드시 갖는다.
  LAB_21_PRESET.targets.forEach((target) => {
    assert.ok(target.source.sheetId, `${target.id} 읽기 시트 없음`);
    assert.ok(target.source.tabTitle, `${target.id} 읽기 탭 없음`);
  });

  // 대상이 가리키는 계정 그룹은 반드시 존재해야 한다. 없으면 계정 0개로 돌아버린다.
  const groupIds = new Set(LAB_21_PRESET.blogGroups.map(({ id }) => id));
  LAB_21_PRESET.targets.forEach((target) => {
    (target.blogGroupIds ?? []).forEach((groupId) =>
      assert.ok(groupIds.has(groupId), `${target.id}: 계정 그룹 ${groupId} 없음`)
    );
  });

  // 그룹을 합친 결과가 지금 코드가 쓰는 목록과 같아야 한다.
  assert.deepEqual(
    sorted(resolveTargetBlogIds(LAB_21_PRESET, findTarget('package'))),
    sorted(BLOG_IDS)
  );
  assert.deepEqual(
    sorted(resolveTargetBlogIds(LAB_21_PRESET, findTarget('dogmaru'))),
    sorted(DOGMARU_PAGE_CHECK_BLOG_IDS)
  );
  assert.deepEqual(
    sorted(resolveTargetBlogIds(LAB_21_PRESET, findTarget('suripet'))),
    sorted(SURI_PET_PAGE_CHECK_BLOG_IDS)
  );
  // 애견 페이지 체크 = 일반 + 도그마루 + 서리펫
  assert.deepEqual(
    sorted(resolveTargetBlogIds(LAB_21_PRESET, findTarget('pet'))),
    sorted([
      ...BLOG_IDS,
      ...DOGMARU_PAGE_CHECK_BLOG_IDS,
      ...SURI_PET_PAGE_CHECK_BLOG_IDS,
    ]).filter((blogId, index, all) => all.indexOf(blogId) === index)
  );
  // 패키지·일반건 더보기 = 일반 + 더보기 추가 계정
  assert.deepEqual(
    sorted(resolveTargetBlogIds(LAB_21_PRESET, findTarget('package-more'))),
    sorted(PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS)
  );

  const presetWithRootAccount: MemberSummary = {
    id: '21lab',
    loginId: '21lab',
    displayName: '21Lab',
    preset: {
      ...LAB_21_PRESET,
      blogGroups: LAB_21_PRESET.blogGroups.map((group) =>
        group.id === 'general'
          ? { ...group, blogIds: [...group.blogIds, 'inho5062'] }
          : group
      ),
    },
  };
  const rootSelection = selectTargetBlogIds(
    presetWithRootAccount,
    'root',
    BLOG_IDS
  );
  assert.equal(rootSelection.source, 'preset');
  assert.ok(rootSelection.blogIds.includes('inho5062'));

  const fallbackSelection = selectTargetBlogIds(null, 'root', BLOG_IDS);
  assert.equal(fallbackSelection.source, 'fallback');
  assert.deepEqual(fallbackSelection.blogIds, BLOG_IDS);

  process.stdout.write('tenant password/preset tests passed\n');
};

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
