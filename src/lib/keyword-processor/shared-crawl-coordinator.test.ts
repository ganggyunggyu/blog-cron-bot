import assert from 'node:assert/strict';
import { matchBlogs } from '../../matcher';
import {
  DOGMARU_COMPOSITE_MAX_PAGES,
  buildDogPetCompositeCrawlInputs,
} from '../exposure-suite/dog-pet-composite';
import {
  SharedCrawlCoordinator,
  buildSharedCrawlPlans,
  createSharedCrawlStopPredicate,
  filterSnapshotItemsByMaxPages,
  type SharedCrawlSnapshot,
} from './shared-crawl-coordinator';

const snapshot = (query: string): SharedCrawlSnapshot => ({
  html: `<html>${query}</html>`,
  items: [],
  isPopular: false,
  uniqueGroupsSize: 0,
  topicNamesArray: [],
});

const plans = buildSharedCrawlPlans([
  {
    searchQueries: ['shared', 'pet-only'],
    maxPages: 4,
    blogIds: ['pet-blog', 'suripet-blog'],
  },
  {
    searchQueries: ['shared', 'suripet-only'],
    maxPages: 4,
    blogIds: ['suripet-blog'],
  },
]);

assert.equal(plans.size, 3);
assert.equal(plans.get('shared')?.requirements.length, 2);
assert.equal(plans.get('pet-only')?.requirements.length, 1);
assert.equal(plans.get('suripet-only')?.requirements.length, 1);

const dogPetInputs = buildDogPetCompositeCrawlInputs(
  {
    dogmaru: ['three-way'],
    pet: ['three-way'],
    suripet: ['three-way'],
  },
  4,
  4
);
assert.equal(DOGMARU_COMPOSITE_MAX_PAGES, 1);
assert.deepEqual(
  dogPetInputs.map((input) => input.maxPages),
  [1, 4, 4]
);

const dogPetPlans = buildSharedCrawlPlans(dogPetInputs);
const threeWayPlan = dogPetPlans.get('three-way')!;
assert.equal(threeWayPlan.maxPages, 4);
assert.deepEqual(
  threeWayPlan.requirements.map((requirement) => requirement.maxPages),
  [1, 4, 4]
);
const shouldStopThreeWay = createSharedCrawlStopPredicate(threeWayPlan);
assert.equal(
  shouldStopThreeWay(
    '<html />',
    1
  ),
  false
);
assert.equal(
  shouldStopThreeWay(
    '<html />',
    2
  ),
  false
);
assert.equal(
  shouldStopThreeWay(
    '<html />',
    4
  ),
  true
);

const shouldStopShared = createSharedCrawlStopPredicate(plans.get('shared')!);
assert.equal(
  shouldStopShared('<a href="https://blog.naver.com/pet-blog/1">pet</a>', 1),
  false
);
assert.equal(
  shouldStopShared(
    '<a href="https://blog.naver.com/suripet-blog/2">suripet</a>',
    2
  ),
  true
);

const differentPageLimits = buildSharedCrawlPlans([
  { searchQueries: ['limited'], maxPages: 1, blogIds: ['pet-blog'] },
  { searchQueries: ['limited'], maxPages: 3, blogIds: ['suripet-blog'] },
]).get('limited')!;
const shouldStopLimited = createSharedCrawlStopPredicate(differentPageLimits);
assert.equal(shouldStopLimited('<html />', 1), false);
assert.equal(shouldStopLimited('<html />', 2), false);
assert.equal(shouldStopLimited('<html />', 3), true);

assert.deepEqual(
  filterSnapshotItemsByMaxPages(
    [
      { title: 'first', page: 1 },
      { title: 'legacy-first' },
      { title: 'second', page: 2 },
    ] as SharedCrawlSnapshot['items'],
    1
  ).map((item) => item.title),
  ['first', 'legacy-first']
);

const sharedItems = [
  {
    title: 'pet result',
    link: 'https://blog.naver.com/pet-blog/1',
    snippet: '',
    image: '',
    badge: '',
    group: '검색결과 1페이지',
    blogLink: 'https://blog.naver.com/pet-blog',
    blogName: 'pet',
    page: 1,
  },
  {
    title: 'suripet result',
    link: 'https://blog.naver.com/suripet-blog/2',
    snippet: '',
    image: '',
    badge: '',
    group: '검색결과 3페이지',
    blogLink: 'https://blog.naver.com/suripet-blog',
    blogName: 'suripet',
    page: 3,
  },
] as SharedCrawlSnapshot['items'];
const petMatches = matchBlogs('shared', sharedItems, {
  blogIds: ['pet-blog', 'suripet-blog'],
});
const suripetMatches = matchBlogs('shared', sharedItems, {
  blogIds: ['suripet-blog'],
});
assert.deepEqual(
  petMatches.map((match) => match.blogId),
  ['pet-blog', 'suripet-blog']
);
assert.deepEqual(
  suripetMatches.map((match) => match.blogId),
  ['suripet-blog']
);
petMatches.splice(0, 1);
assert.equal(suripetMatches.length, 1);

const run = async (): Promise<void> => {
  const coordinator = new SharedCrawlCoordinator(2);
  let loadCount = 0;

  const [first, second] = await Promise.all([
    coordinator.getCrawlSnapshot('same', async () => {
      loadCount += 1;
      return snapshot('same');
    }),
    coordinator.getCrawlSnapshot('same', async () => {
      loadCount += 1;
      return snapshot('duplicate');
    }),
  ]);

  assert.equal(loadCount, 1);
  assert.equal(first, second);

  let guestLoadCount = 0;
  const guestResults = await Promise.all([
    coordinator.getGuestHtml('same-guest', async () => {
      guestLoadCount += 1;
      return '<html>guest</html>';
    }),
    coordinator.getGuestHtml('same-guest', async () => {
      guestLoadCount += 1;
      return '<html>duplicate</html>';
    }),
  ]);
  assert.equal(guestLoadCount, 1);
  assert.deepEqual(guestResults, ['<html>guest</html>', '<html>guest</html>']);

  let attempts = 0;
  await assert.rejects(
    coordinator.getCrawlSnapshot('retryable', async () => {
      attempts += 1;
      throw new Error('temporary');
    }),
    /temporary/
  );
  const recovered = await coordinator.getCrawlSnapshot(
    'retryable',
    async () => {
      attempts += 1;
      return snapshot('recovered');
    }
  );
  assert.equal(attempts, 2);
  assert.match(recovered.html, /recovered/);

  let active = 0;
  let maxActive = 0;
  const slow = async <T>(value: T): Promise<T> => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return value;
  };

  await Promise.all([
    coordinator.getCrawlSnapshot('a', () => slow(snapshot('a'))),
    coordinator.getCrawlSnapshot('b', () => slow(snapshot('b'))),
    coordinator.getCrawlSnapshot('c', () => slow(snapshot('c'))),
    coordinator.getGuestHtml('guest', () => slow('<html>guest</html>')),
  ]);
  assert.equal(maxActive, 2);
};

run()
  .then(() => {
    process.stdout.write('shared crawl coordinator tests passed\n');
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
