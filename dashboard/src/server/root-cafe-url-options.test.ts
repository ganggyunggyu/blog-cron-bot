import assert from 'node:assert/strict';
import test from 'node:test';
import { InvalidJobInputError } from './job-errors';
import { buildRootCafeUrlArgs } from './root-cafe-url-options';

test('유효한 카페 URL을 --url 인자로 변환함', () => {
  assert.deepEqual(
    buildRootCafeUrlArgs({ url: 'https://cafe.naver.com/talkmadang702/12345' }),
    ['--url=https://cafe.naver.com/talkmadang702/12345'],
  );
  assert.deepEqual(
    buildRootCafeUrlArgs({ url: '  https://m.cafe.naver.com/talkmadang702  ' }),
    ['--url=https://m.cafe.naver.com/talkmadang702'],
  );
});

test('카페 URL이 아니거나 비어 있으면 거부함', () => {
  const invalidInputs: unknown[] = [
    undefined,
    {},
    { url: '' },
    { url: '   ' },
    { url: 'https://blog.naver.com/higher_0/224367708238' },
    { url: '그냥 텍스트' },
    { url: 123 },
    { command: 'arbitrary-command' },
  ];

  invalidInputs.forEach((input) => {
    assert.throws(() => buildRootCafeUrlArgs(input), InvalidJobInputError);
  });
});
