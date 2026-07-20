import type { PopularItem } from '../../parser';
import { MAX_EXPOSURE_CONCURRENCY } from '../exposure-run-config';

export interface SharedCrawlSnapshot {
  html: string;
  items: PopularItem[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

export interface SharedCrawlRequirement {
  maxPages: number;
  blogIds: readonly string[];
}

export interface SharedCrawlPlan {
  maxPages: number;
  requirements: readonly SharedCrawlRequirement[];
}

export interface SharedCrawlTargetInput {
  searchQueries: Iterable<string>;
  maxPages: number;
  blogIds: readonly string[];
}

type Loader<T> = () => Promise<T>;

const normalizeMaxPages = (maxPages: number): number =>
  Math.max(1, Math.floor(maxPages));

const normalizeBlogIds = (blogIds: readonly string[]): string[] =>
  Array.from(
    new Set(blogIds.map((blogId) => blogId.trim().toLowerCase()).filter(Boolean))
  );

export const buildSharedCrawlPlans = (
  targets: readonly SharedCrawlTargetInput[]
): Map<string, SharedCrawlPlan> => {
  const mutablePlans = new Map<
    string,
    { maxPages: number; requirements: SharedCrawlRequirement[] }
  >();

  targets.forEach((target) => {
    const maxPages = normalizeMaxPages(target.maxPages);
    const blogIds = normalizeBlogIds(target.blogIds);
    const uniqueQueries = new Set(target.searchQueries);

    uniqueQueries.forEach((searchQuery) => {
      const existing = mutablePlans.get(searchQuery);
      const requirement = { maxPages, blogIds };

      if (existing) {
        existing.maxPages = Math.max(existing.maxPages, maxPages);
        existing.requirements.push(requirement);
        return;
      }

      mutablePlans.set(searchQuery, {
        maxPages,
        requirements: [requirement],
      });
    });
  });

  return mutablePlans;
};

const htmlContainsBlogId = (
  normalizedHtml: string,
  blogId: string
): boolean =>
  normalizedHtml.includes(`blog.naver.com/${blogId}/`) ||
  normalizedHtml.includes(`blog.naver.com/${blogId}"`);

export const createSharedCrawlStopPredicate = (
  plan: SharedCrawlPlan
): ((html: string, pageNumber: number) => boolean) => {
  const matchedRequirements = plan.requirements.map(() => false);

  return (html: string, pageNumber: number): boolean => {
    const normalizedHtml = html.toLowerCase();

    plan.requirements.forEach((requirement, index) => {
      if (
        !matchedRequirements[index] &&
        pageNumber <= requirement.maxPages &&
        requirement.blogIds.some((blogId) =>
          htmlContainsBlogId(normalizedHtml, blogId)
        )
      ) {
        matchedRequirements[index] = true;
      }
    });

    return plan.requirements.every(
      (requirement, index) =>
        matchedRequirements[index] || pageNumber >= requirement.maxPages
    );
  };
};

export const filterSnapshotItemsByMaxPages = (
  items: readonly PopularItem[],
  maxPages: number
): PopularItem[] =>
  items.filter((item) => (item.page ?? 1) <= normalizeMaxPages(maxPages));

export class SharedCrawlCoordinator {
  private readonly maxConcurrency: number;
  private readonly crawlSnapshots = new Map<
    string,
    Promise<SharedCrawlSnapshot>
  >();
  private readonly guestHtmlSnapshots = new Map<string, Promise<string>>();
  private readonly queue: Array<() => void> = [];
  private activeCount = 0;

  constructor(maxConcurrency: number = MAX_EXPOSURE_CONCURRENCY) {
    this.maxConcurrency = Math.min(
      Math.max(1, Math.floor(maxConcurrency)),
      MAX_EXPOSURE_CONCURRENCY
    );
  }

  getCrawlSnapshot(
    cacheKey: string,
    loader: Loader<SharedCrawlSnapshot>
  ): Promise<SharedCrawlSnapshot> {
    return this.getOrCreate(this.crawlSnapshots, cacheKey, loader);
  }

  getGuestHtml(cacheKey: string, loader: Loader<string>): Promise<string> {
    return this.getOrCreate(this.guestHtmlSnapshots, cacheKey, loader);
  }

  private getOrCreate<T>(
    cache: Map<string, Promise<T>>,
    cacheKey: string,
    loader: Loader<T>
  ): Promise<T> {
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    const pending = this.schedule(loader);
    cache.set(cacheKey, pending);
    void pending.catch(() => {
      if (cache.get(cacheKey) === pending) cache.delete(cacheKey);
    });
    return pending;
  }

  private schedule<T>(loader: Loader<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        this.activeCount += 1;
        void loader()
          .then(resolve, reject)
          .finally(() => {
            this.activeCount -= 1;
            this.startNext();
          });
      };

      this.queue.push(run);
      this.startNext();
    });
  }

  private startNext(): void {
    while (
      this.activeCount < this.maxConcurrency &&
      this.queue.length > 0
    ) {
      this.queue.shift()?.();
    }
  }
}
