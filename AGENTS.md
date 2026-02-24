# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-24
**Branch:** main

## OVERVIEW

네이버 검색 노출 모니터링 크론 봇. 키워드별 블로그 인기글/스블 노출 여부를 자동 크롤링 → 파싱 → 매칭 → DB 저장 → CSV/시트 반영.
스택: TypeScript (strict, CommonJS) + Cheerio + Playwright + MongoDB.

## STRUCTURE

```
blog-cron-bot/
├── src/
│   ├── index.ts              # 메인 파이프라인 오케스트레이터
│   ├── cron.ts               # 풀 워크플로우 (sync → crawl → import)
│   ├── cron-root.ts          # 루트 키워드 전용 크론
│   ├── cron-pages.ts         # 멀티페이지 크론
│   ├── pm2-scheduler.ts      # PM2 기반 스케줄러
│   ├── crawler.ts            # HTTP fetch (got-scraping)
│   ├── matcher.ts            # 블로그 ID 매칭, ExposureResult 생성
│   ├── csv-writer.ts         # CSV 내보내기 → output/
│   ├── database.ts           # MongoDB 모델 (Keyword, RootKeyword)
│   ├── sheet-config.ts       # 시트타입별 동작 설정 (package, dogmaru)
│   ├── parser/
│   │   ├── popular-parser/   # Cheerio 기반 인기글/스블 파싱
│   │   └── selectors/        # CSS 셀렉터 중앙 관리
│   ├── lib/
│   │   ├── keyword-processor/  # 핵심 도메인 로직 (→ 별도 AGENTS.md)
│   │   ├── playwright-crawler/ # Playwright 브라우저 크롤링
│   │   ├── post-filter/        # 벤더명/제목 매칭 필터
│   │   ├── vendor-extractor/   # 포스트 HTML에서 업체명 추출
│   │   ├── logger/             # 구조화된 로깅 (winston 기반)
│   │   ├── dooray.ts           # Dooray 알림 전송
│   │   └── check-naver-login.ts # 네이버 로그인 상태 확인
│   ├── logs/                 # 로깅 서브시스템 (console, formatter, storage, progress)
│   ├── constants/            # 블로그 ID, 크롤 설정, 네이버 헤더, API 엔드포인트
│   ├── api/                  # Google Sheets 동기화 (syncKeywords, importKeywords)
│   ├── tools/                # 쿠키 업데이트, 셀렉터 갱신 CLI
│   └── migrations/           # 일회성 DB 마이그레이션 스크립트
├── output/                   # 생성된 CSV (주차별 하위 디렉토리)
├── logs/                     # 런타임 로그 파일
├── debug/                    # 상세 디버그 로그
└── ecosystem.config.cjs      # PM2 설정 (keywords + root 2개 앱)
```

## DATA PIPELINE

```
cron.ts
  │
  ├─ 1. syncKeywords() ─── Google Sheets → MongoDB 동기화
  │
  ├─ 2. main() (index.ts)
  │     ├─ checkNaverLogin() → 로그인/비로그인 모드 결정
  │     ├─ getAllKeywords() → MongoDB에서 키워드 조회
  │     ├─ 필터링 (ONLY_SHEET_TYPE, ONLY_COMPANY, ONLY_ID 등)
  │     ├─ dogmaru/기타 분리 후 processKeywords()
  │     │     ├─ getCrawlResult() → crawler.ts(HTTP) → parser(Cheerio) → matcher
  │     │     ├─ findMatchingPost() → vendor-extractor → post-filter
  │     │     ├─ runGuestRetry() → 비로그인 재시도 (로그인 모드일 때)
  │     │     └─ handleSuccess/Failure() → DB 업데이트
  │     ├─ saveToCSV() + saveToSheetCSV()
  │     └─ sendDoorayExposureResult()
  │
  └─ 3. importKeywords() ─── DB → Google Sheets 반영
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 크롤링 로직 변경 | `src/crawler.ts` | got-scraping 사용, 쿠키/헤더 설정 |
| 셀렉터 깨짐 대응 | `src/parser/selectors/` → `popular-parser/` | `selector-analyzer.ts`로 진단 |
| 블로그 ID 추가 | `src/constants/blog-ids/` | BLOG_IDS, DOGMARU_BLOG_IDS 등 |
| 시트타입 동작 변경 | `src/sheet-config.ts` | allowAnyBlog, maxContentChecks, csvFilePrefix |
| 매칭 로직 | `src/matcher.ts` | extractBlogId(), matchBlogs() |
| 벤더 필터링 | `src/lib/post-filter/` + `vendor-extractor/` | 포스트 HTML 접근해 업체명 매칭 |
| 크론 스케줄 변경 | `src/cron.ts` (L102) / `pm2-scheduler.ts` | cronSchedule 변수, timezone: Asia/Seoul |
| DB 스키마 변경 | `src/database.ts` | Keyword + RootKeyword 이중 스키마 주의 |
| Dooray 알림 | `src/lib/dooray.ts` | DOORAY_WEBHOOK_URL 환경변수 |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `main()` | function | `src/index.ts` | 메인 파이프라인 오케스트레이터 |
| `processKeywords()` | function | `src/lib/keyword-processor/` | 키워드 순회 + 크롤/매칭/필터/저장 |
| `getCrawlResult()` | function | `keyword-processor/crawl-manager.ts` | 크롤링 오케스트레이션 + 캐싱 |
| `fetchHtml()` | function | `src/crawler.ts` | HTTP 요청 (got-scraping) |
| `extractPopularItems()` | function | `src/parser/popular-parser/` | HTML → PopularItem[] |
| `matchBlogs()` | function | `src/matcher.ts` | PopularItem[] → ExposureResult[] |
| `findMatchingPost()` | function | `src/lib/post-filter/` | 벤더/제목 매칭 필터 |
| `ExposureResult` | interface | `src/matcher.ts` | 핵심 데이터 타입 (query, blogId, exposureType, position) |
| `KeywordDoc` | type | `keyword-processor/types.ts` | DB 키워드 문서 타입 |
| `SheetOptions` | interface | `src/sheet-config.ts` | 시트타입별 동작 설정 |

## CONVENTIONS

- TypeScript strict, CommonJS.
- 파일명 kebab-case. 변수 camelCase. 타입 PascalCase. 상수 UPPER_SNAKE_CASE.
- 하위 모듈은 `index.ts` 배럴 export 패턴 사용.
- 프로덕션 로깅은 `lib/logger` 사용 (console.log 금지).
- Cheerio 셀렉터는 `parser/selectors/`에 집중. 인라인 매직 스트링 금지.
- 시트타입별 분기는 `sheet-config.ts` 설정 기반 (OOP 상속이 아닌 함수형 분기).
- Keyword/RootKeyword 이중 스키마 — 한쪽 변경 시 반드시 다른 쪽도 동기화.

## ANTI-PATTERNS (THIS PROJECT)

- `.env`, `*.pem` 절대 커밋 금지.
- `as any`, `@ts-ignore`, `@ts-expect-error` 사용 금지.
- 빈 catch 블록 `catch(e) {}` 금지 — 최소한 로깅 필수.
- 네이버 요청 시 딜레이 없이 연속 호출 금지 (차단 위험).
- Playwright 사용 후 `closeBrowser()` 반드시 호출 (리소스 누수 방지).

## COMMANDS

```bash
# 빌드 & 프로덕션
pnpm build                  # tsc → dist/
pnpm start                  # node dist/index.js
pnpm dev                    # ts-node src/index.ts (빌드 없이 실행)

# 크론
pnpm cron                   # 풀 워크플로우 (매일 13:02)
pnpm cron:root              # 루트 키워드 전용
pnpm cron:pages             # 멀티페이지 크롤링
pnpm scheduler              # PM2 스케줄러
pnpm scheduler:test         # 1분 뒤 테스트 실행

# 도구
pnpm naver:popular:update   # 인기글 셀렉터 자동 갱신
pnpm cookie:update          # 네이버 쿠키 갱신
pnpm cookie:login           # 로그인 후 쿠키 획득
```

## ENVIRONMENT VARIABLES

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB 연결 URI (startup 검증) |
| `NAVER_NID_AUT`, `NAVER_NID_SES` | ❌ | 네이버 로그인 쿠키 |
| `DOORAY_WEBHOOK_URL` | ❌ | Dooray 알림 웹훅 |
| `SHEET_APP_URL` | ❌ | 시트 동기화 엔드포인트 (기본: localhost:3000) |
| `ONLY_SHEET_TYPE` | ❌ | 특정 시트타입 필터 (e.g. "dogmaru") |
| `ONLY_ID` / `ONLY_COMPANY` | ❌ | 특정 문서/회사 필터 |
| `ALLOW_ANY_BLOG` | ❌ | 블로그 필터 전역 오버라이드 (env > sheet config) |
| `MAX_CONTENT_CHECKS` | ❌ | 키워드당 확인 게시글 수 (env > sheet config) |
| `TEST_DELAY_MINUTES` | ❌ | 테스트 모드 딜레이 (분) |

## DEPLOYMENT

- **EC2**: PM2 (`ecosystem.config.cjs`) — keywords + root 2개 앱, 512MB 메모리 제한.
- **3단계 워크플로우**: Sheet sync → Crawl → Sheet import. 순서 필수, 중간 실패 시 전체 중단.

## NOTES

- 네이버 HTML 구조가 자주 변경됨 → 파싱 실패 시 `selector-analyzer.ts`로 진단 후 `parser/selectors/` 갱신.
- 크론 변형이 3개 (cron, cron-root, cron-pages) + PM2 스케줄러 — 각각 독립 스크립트.
- Conventional Commits 필수: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` (스코프 포함 권장).
  - 예: `feat(crawler): handle smart blog ranking`, `refactor(logging): reduce noisy output`.
