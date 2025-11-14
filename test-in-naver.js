// in.naver.com 패턴 테스트
const { extractBlogId } = require('./dist/matcher');

console.log('\n🧪 in.naver.com 패턴 테스트\n');
console.log('='.repeat(60));

const testCases = [
  {
    name: 'blog.naver.com (기본)',
    url: 'https://blog.naver.com/testuser123/220123456789',
    expected: 'testuser123'
  },
  {
    name: 'in.naver.com (신규 패턴)',
    url: 'https://in.naver.com/testuser123/220123456789',
    expected: 'testuser123'
  },
  {
    name: 'm.blog.naver.com (모바일)',
    url: 'https://m.blog.naver.com/testuser123/220123456789',
    expected: 'testuser123'
  },
  {
    name: 'blog.naver.com (쿼리 파라미터)',
    url: 'https://blog.naver.com/testuser/220123?param=value',
    expected: 'testuser'
  },
  {
    name: 'in.naver.com (쿼리 파라미터)',
    url: 'https://in.naver.com/testuser/220123?param=value',
    expected: 'testuser'
  },
  {
    name: '빈 문자열',
    url: '',
    expected: ''
  },
  {
    name: '다른 도메인',
    url: 'https://cafe.naver.com/testuser/123',
    expected: ''
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  const result = extractBlogId(test.url);
  const isPass = result === test.expected;

  console.log(`\n테스트 ${idx + 1}: ${test.name}`);
  console.log(`  입력: ${test.url}`);
  console.log(`  기대값: "${test.expected}"`);
  console.log(`  실제값: "${result}"`);
  console.log(`  결과: ${isPass ? '✅ PASS' : '❌ FAIL'}`);

  if (isPass) {
    passed++;
  } else {
    failed++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n결과 요약: ${passed}개 통과, ${failed}개 실패`);

if (failed === 0) {
  console.log('✅ 모든 테스트 통과! in.naver.com 패턴이 정상 작동합니다!\n');
} else {
  console.log('❌ 일부 테스트 실패!\n');
  process.exit(1);
}
