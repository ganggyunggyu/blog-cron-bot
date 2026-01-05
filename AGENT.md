# Purpose
- TypeScript(CommonJS) 크롤러 프로젝트. `src/index.ts` → `processKeywords` → `crawlWithRetry` → `parser` → `matcher` → `csv-writer`/MongoDB 흐름을 유지한다.
- 키워드 처리 로직은 `src/lib/keyword-processor` 모듈 단위로 분리되어 있다.

# Keyword Processor Map
- `lib/keyword-processor/index.ts`: 키워드 순회/매칭/결과 저장 오케스트레이션
- `lib/keyword-processor/crawl-manager.ts`: 크롤링 + 캐시/큐 구성
- `lib/keyword-processor/guest-retry.ts`: 비로그인 재시도 및 큐 확장
- `lib/keyword-processor/allow-any-blog.ts`: `ALLOW_ANY_BLOG` 우선순위 계산
- `lib/keyword-processor/handlers.ts`: 성공/실패/예외 처리 분기

# Commands
- 설치: `pnpm install`
- 개발 실행: `pnpm dev`
- 빌드/프로덕션: `pnpm build` 후 `pnpm start`
- 스모크: `pnpm test` (네트워크/DB 사용)
- 웹 실험 서버: `pnpm web` (요청 있을 때만 실행)
- UI 개발: `pnpm ui:dev` (Vite, API는 `pnpm web`)
- UI 빌드: `pnpm ui:build` (출력: `ui/dist`)
- Ubuntu EC2 배포: `docs/ec2-ubuntu.md`

# Code & HTTP Rules
- Strict TS, 2-space indent, CJS module. 기존 상대 경로 패턴 유지(별도 경로 alias 없음).
- 네이버 검색은 `crawler.fetchWithChromeTLS`(got-scraping)로 TLS 우회, 결과 파싱/셀렉터는 `parser`에만 추가한다. 일반 페이지 fetch는 `fetchHtml` + 헤더(`constants/naver-header`)로 처리.
- 딜레이/재시도는 `crawler.randomDelay`와 `CRAWL_CONFIG`를 사용해 일관성 있게 적용한다. 매직 넘버를 새로 만들지 말고 상수/옵션으로 둔다.
- 매칭 로직은 `matcher`와 `lib/keyword-processor` 캐시 흐름을 깨지 않도록, 검색어별 캐시 맵 업데이트를 동기화한다.

# Data & Output
- CSV는 `output/`, 빌드 결과는 `dist/`, 임시 로그는 `debug/`/`logs/`. 생성물은 커밋하지 않는다.
- UI 빌드 산출물은 `ui/dist/` (커밋하지 않는다).
- MongoDB URI는 `.env`의 `MONGODB_URI`; 실제 값이나 `.env` 파일은 커밋 금지.

# Testing & Safety
- 네트워크 타격 코드 수정 시 `pnpm test` 또는 부분 모듈 테스트로 스모크 확인. 가능하면 실제 서비스 도메인에 과도한 요청을 보내지 않는다.
- 셀렉터 변경 시 `selector-analyzer` 참고 기록 남기기.

# UI (React) Rules
- `<React.Fragment>` 또는 `<></>` 는 꼭 필요한 경우에만 사용한다. 불필요한 Fragment 래핑 금지.
