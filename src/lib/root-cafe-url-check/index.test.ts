import assert from 'node:assert/strict';
import { parseCafeUrlTarget } from './index';

assert.deepEqual(
  parseCafeUrlTarget('https://cafe.naver.com/talkmadang702/12345'),
  { name: 'talkmadang702', ids: ['talkmadang702'] }
);

assert.deepEqual(parseCafeUrlTarget('https://cafe.naver.com/talkmadang702'), {
  name: 'talkmadang702',
  ids: ['talkmadang702'],
});

assert.deepEqual(
  parseCafeUrlTarget('  https://m.cafe.naver.com/talkmadang702/12345  '),
  { name: 'talkmadang702', ids: ['talkmadang702'] }
);

assert.throws(() => parseCafeUrlTarget(''), /카페 URL 형식이 올바르지 않음/);
assert.throws(
  () => parseCafeUrlTarget('https://blog.naver.com/higher_0/224367708238'),
  /카페 URL 형식이 올바르지 않음/
);
assert.throws(
  () => parseCafeUrlTarget('그냥 텍스트'),
  /카페 URL 형식이 올바르지 않음/
);

process.stdout.write('root cafe url check tests passed\n');
