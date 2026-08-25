import assert from 'node:assert/strict';
import type { PopularItem } from '../../parser';
import { findCafeUrlExposure } from './index';

const cafeItem = (overrides: Partial<PopularItem>): PopularItem =>
  ({
    title: '강남 맛집 정리',
    link: 'https://cafe.naver.com/localtable702/12345',
    snippet: '',
    image: '',
    badge: '',
    group: '인기글',
    blogLink: '',
    blogName: '맛집 동네밥상',
    postPublishedAt: '4시간 전',
    sourceType: 'cafe',
    sourceId: 'localtable702',
    ...overrides,
  }) as PopularItem;

const target = { cafeId: 'localtable702', articleId: '12345' };

// 붙여넣은 그 글이 걸리면 노출.
{
  const row = findCafeUrlExposure('강남맛집', [cafeItem({})], target);
  assert.equal(row.status, '노출');
  assert.equal(row.rank, '1');
}

// 같은 카페의 다른 글은 노출로 세면 안 된다. 내 글은 아직 안 올라온 것이다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [cafeItem({ link: 'https://cafe.naver.com/localtable702/99999' })],
    target
  );
  assert.equal(row.status, '같은 카페 다른 글');
  assert.equal(row.link, 'https://cafe.naver.com/localtable702/99999');
}

// 글 번호 없이 카페만 넣었으면 그 카페 글 아무거나 걸리면 노출이다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [cafeItem({ link: 'https://cafe.naver.com/localtable702/99999' })],
    { cafeId: 'localtable702', articleId: '' }
  );
  assert.equal(row.status, '노출');
}

// 공용 matchCafeTargets의 이름 부분일치를 그대로 쓰면 표시 이름이 "Table"인 남의 카페가
// localtable702에 걸렸다. 아이디로만 맞추는지 고정한다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [
      cafeItem({
        link: 'https://cafe.naver.com/table/777',
        sourceId: 'table',
        blogName: 'Table',
      }),
    ],
    target
  );
  assert.equal(row.status, '미노출');
  assert.equal(row.link, '');
}

// 블로그 글은 이 체크의 대상이 아니다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [
      cafeItem({
        sourceType: 'blog',
        sourceId: 'localtable702',
        link: 'https://blog.naver.com/localtable702/12345',
      }),
    ],
    target
  );
  assert.equal(row.status, '미노출');
}

// 앞에 다른 카페가 있어도 순위는 인기글 목록 기준 그대로 센다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [
      cafeItem({ sourceId: 'othercafe', link: 'https://cafe.naver.com/othercafe/1' }),
      cafeItem({}),
    ],
    target
  );
  assert.equal(row.status, '노출');
  assert.equal(row.rank, '2');
}

// 같은 카페 다른 글이 먼저 나오고 뒤에 내 글이 있으면 내 글을 이겨야 한다.
{
  const row = findCafeUrlExposure(
    '강남맛집',
    [
      cafeItem({ link: 'https://cafe.naver.com/localtable702/99999' }),
      cafeItem({}),
    ],
    target
  );
  assert.equal(row.status, '노출');
  assert.equal(row.rank, '2');
}

process.stdout.write('root cafe url check tests passed\n');
