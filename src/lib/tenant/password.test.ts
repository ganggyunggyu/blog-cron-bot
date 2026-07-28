import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';
import { EMPTY_PRESET, LAB_21_PRESET } from './preset';

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

  process.stdout.write('tenant password/preset tests passed\n');
};

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
