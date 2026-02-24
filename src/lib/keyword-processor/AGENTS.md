# KEYWORD PROCESSOR

핵심 도메인 오케스트레이터. 키워드 순회 → 크롤 → 매칭 → 필터 → DB 저장을 총괄.

## STRUCTURE

```
keyword-processor/
├── index.ts              # processKeywords() 메인 루프
├── crawl-manager.ts      # getCrawlResult() — 크롤 + 파싱 + 매칭 + 캐싱
├── handlers.ts           # handleSuccess/Failure/Excluded/QueueEmpty → DB 업데이트
├── keyword-classifier.ts # 키워드 분류 (restaurant/pet/basic), 벤더 타겟 추출
├── guest-retry.ts        # 로그인 모드일 때 비로그인 재시도 로직
├── allow-any-blog.ts     # allowAnyBlog 판단 (env > sheet config > default)
└── types.ts              # KeywordDoc, CrawlCaches, ProcessKeywordsOptions 등
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| 키워드 처리 흐름 수정 | `index.ts` | 314줄, for-of 루프 기반 순차 처리 |
| 크롤 캐싱 로직 | `crawl-manager.ts` | 6개 캐시 Map 관리 |
| 성공/실패 핸들링 | `handlers.ts` | DB 업데이트 + 로그 빌더 연동 |
| 키워드 분류/제외 | `keyword-classifier.ts` | shouldExclude(), getKeywordType() |
| 비로그인 재시도 | `guest-retry.ts` | 로그인 모드에서 매칭 실패 시 게스트 모드 재시도 |
| 타입 정의 추가 | `types.ts` | 모든 내부 인터페이스 집중 |

## CACHING STRATEGY

6개의 `Map` 인스턴스가 동일 검색어 중복 처리를 방지:

| Cache | Key | Value | Purpose |
|-------|-----|-------|---------|
| `crawlCache` | searchQuery | HTML string | 동일 쿼리 재 크롤링 방지 |
| `matchQueueMap` | searchQuery | ExposureResult[] | 매칭된 블로그 목록 공유 |
| `itemsCache` | searchQuery | PopularItem[] | 파싱된 아이템 공유 |
| `htmlStructureCache` | searchQuery | {isPopular, uniqueGroups, topicNames} | HTML 구조 정보 |
| `guestAddedLinksCache` | searchQuery | Set<link> | 게스트 재시도로 추가된 링크 |
| `usedLinksCache` | searchQuery | Set<link> | 이미 사용된 링크 (중복 매칭 방지) |

동일 검색어의 다른 업체(company)가 같은 크롤 결과를 공유할 때 캐시 히트.
`matchQueue`에서 매칭된 결과는 splice로 제거되어 다음 업체가 같은 포스트를 할당받지 않음.

## PROCESSING FLOW

```
for each keyword:
  1. getCrawlResult()      → 크롤 or 캐시 히트 → PopularItem[] → matchBlogs()
  2. shouldExclude()       → 변경 불필요 키워드 제외
  3. matchQueue 확인       → 빈 큐면 게스트 재시도 or handleQueueEmpty()
  4. findMatchingPost()    → 벤더/제목 매칭 필터
  5. 매칭 성공             → handleSuccess() → DB 업데이트 + allResults.push()
  6. 매칭 실패             → 게스트 재시도 → 재실패면 handleFilterFailure()
```

## CONVENTIONS (이 모듈 한정)

- 모든 컨텍스트는 구조체로 전달: `KeywordContext`, `ProcessingContext`, `HtmlStructure`.
- 핸들러(handlers.ts)는 순수 부수효과 함수 — DB 저장 + 로깅만 담당.
- `updateFunction`은 DI 패턴 — 테스트/배치에서 다른 업데이트 함수 주입 가능.
- 캐시는 `processKeywords()` 호출마다 새로 생성 — 요청 간 공유 없음.