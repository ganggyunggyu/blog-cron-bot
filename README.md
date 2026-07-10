# blog-cron-bot

네이버 검색 결과에서 특정 블로그(또는 카페 계정)들이 실제로 노출되고 있는지 자동으로 체크하는 크론 봇이다. 원래는 대행사에서 수십~수백 개 키워드의 노출 여부를 사람이 직접 검색해서 확인하던 작업을 대체하려고 만들었다. 키워드는 Google Sheets로 관리하고, 봇이 주기적으로 네이버를 크롤링해서 인기글/스마트블록(스블) 노출 여부를 판정한 뒤 MongoDB에 저장하고 다시 시트로 반영한다.

키워드 성격(패키지 상품, 일반 업체, 도그마루 전용, 카페 등)에 따라 판정 기준이 조금씩 다르고, 네이버가 HTML 구조와 검색 URL 파라미터를 수시로 바꾸기 때문에 크롤러/파서/매칭 로직을 계속 방어적으로 다듬어야 했다. 그 과정에서 겪은 문제와 해결 방식은 아래 트러블슈팅 섹션에 정리했다.

## 주요 기능

- 네이버 모바일/PC 검색 결과에서 인기글(스니펫)과 스마트블록 노출 여부 크롤링
- 등록된 블로그 ID/업체명 기준 매칭 (지점명이 다른 경우까지 고려한 브랜드 매칭)
- 게시글 본문에 접근해 업체명을 추출하고 검색 결과와 교차 검증
- 시트타입(패키지/도그마루/일반 등)별로 매칭 허용 범위, 재시도 횟수, 딜레이를 다르게 적용
- Google Sheets ↔ MongoDB 양방향 동기화 (`syncKeywords` → 크롤링 → `importKeywords`)
- CSV 결과 파일 저장, Dooray 웹훅으로 실행 결과 알림
- 네이버 차단 대응: User-Agent 로테이션, 403 전용 백오프, 로그인/비로그인 재시도
- PM2 기반 스케줄러 3종(키워드/루트/전체시트) + Next.js 대시보드로 운영 상태 확인 및 수동 실행

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 런타임 | Node.js, TypeScript (strict, CommonJS) |
| 크롤링 | `got-scraping`(HTTP), `playwright`(브라우저 자동화가 필요한 케이스) |
| 파싱 | `cheerio` |
| 스케줄링 | `node-cron`, PM2 (`pm2-scheduler*.ts`) |
| 데이터베이스 | MongoDB (`mongoose`) |
| 외부 연동 | `google-spreadsheet` + `google-auth-library`(시트 동기화), Dooray 웹훅(`axios`) |
| 로깅 | `winston` 기반 커스텀 로거 (`src/lib/logger`) |
| 대시보드 | Next.js 16, React 19, TanStack Query, Jotai, Tailwind CSS v4 (별도 앱, `dashboard/`) |
| 배포 | Docker (`mcr.microsoft.com/playwright` 베이스), Railway + PM2 (`pm2-runtime`) |

## 아키텍처

봇 본체(`src/`)는 UI가 없는 배치/CLI 프로그램이라 레이어를 다음처럼 나눴다.

```
Entrypoints (src/cron*.ts, src/pm2-scheduler*.ts, src/tools/*)
    ↓ 인자/env 해석, 워크플로우 호출만 담당
Workflows (src/lib/*, src/api/*)
    ↓ 작업 단위 오케스트레이션, 외부 연동 흐름
Domain (src/matcher.ts, src/parser/*, src/lib/keyword-processor/*, src/sheet-config.ts, src/database.ts)
    ↓ 노출 판정, 파싱, 매칭, 저장 모델
Adapters (src/crawler.ts, src/lib/playwright-crawler/*, src/lib/google-sheets/*, src/lib/dooray.ts)
    ↓ 네이버/시트/알림 등 외부 I/O
Shared (src/constants/*, src/logs/*, src/lib/utils/*, src/types.ts)
```

`dashboard/`는 봇 제어용 웹 UI로, `src/`와 완전히 분리된 자체 Next.js 프로젝트다(자체 `package.json`, `tsconfig.json`). 봇 프로세스를 PM2로 start/stop/restart 하거나, 크론 스크립트를 수동으로 한 번 실행하고 SSE로 실시간 로그를 스트리밍하는 용도로 쓴다.

### 데이터 파이프라인

```
cron.ts
  1. syncKeywords()          Google Sheets → MongoDB 동기화
  2. main() (index.ts)
       checkNaverLogin()      로그인/비로그인 모드 결정
       getAllKeywords()       MongoDB 조회 + 필터링(ONLY_SHEET_TYPE 등)
       processKeywords()      크롤링 → 파싱 → 매칭 → 벤더 검증 → DB 업데이트
  3. importKeywords()         MongoDB → Google Sheets 반영
```

### 폴더 구조

```
blog-cron-bot/
├── src/
│   ├── index.ts                 # 메인 파이프라인 오케스트레이터
│   ├── cron.ts                  # 풀 워크플로우 (sync → crawl → import)
│   ├── cron-root.ts             # 루트 키워드 전용 크론
│   ├── cron-pages.ts            # 멀티페이지 크론
│   ├── cron-sheet.ts            # 시트타입 지정 멀티페이지 크론
│   ├── cron-dogmaru.ts / cron-dogmaru-exclude.ts
│   ├── pm2-scheduler*.ts        # PM2 기반 스케줄러 (키워드/루트/전체시트)
│   ├── crawler.ts               # HTTP 크롤링 (got-scraping), 403 백오프
│   ├── matcher.ts               # 블로그 ID 매칭, ExposureResult 생성
│   ├── csv-writer.ts            # CSV 내보내기 → output/
│   ├── database.ts              # MongoDB 모델 (Keyword, RootKeyword, 시트별 컬렉션)
│   ├── sheet-config.ts          # 시트타입별 동작 설정 (package, dogmaru 등)
│   ├── parser/
│   │   ├── popular-parser/      # Cheerio 기반 인기글/스블 파싱
│   │   └── selectors/           # CSS 셀렉터 중앙 관리
│   ├── lib/
│   │   ├── keyword-processor/   # 키워드 순회 + 크롤/매칭/필터/저장 도메인 로직
│   │   ├── playwright-crawler/  # 브라우저 기반 크롤링 (로그인 필요 케이스)
│   │   ├── post-filter/         # 벤더명/제목 매칭 필터
│   │   ├── vendor-extractor/    # 게시글 HTML에서 업체명 추출
│   │   ├── google-sheets/       # 시트 API 어댑터
│   │   ├── logger/              # winston 기반 구조화 로깅
│   │   └── dooray.ts            # Dooray 알림 전송
│   ├── logs/                    # 콘솔/파일 로깅 서브시스템
│   ├── constants/                # 블로그 ID, 크롤 설정, 네이버 헤더, API 엔드포인트
│   ├── api/                     # Google Sheets 동기화 (syncKeywords, importKeywords)
│   ├── tools/                   # CLI 도구 (쿠키 갱신, 셀렉터 갱신, 병렬 체크 등)
│   └── migrations/              # 일회성 DB 마이그레이션 스크립트
├── dashboard/                    # 별도 Next.js 제어판 앱 (독립 배포 단위)
├── output/                       # 생성된 CSV 결과
├── docs/                         # 운영 문서 (EC2/Railway 배포 가이드 등)
├── ecosystem.config.cjs          # EC2용 PM2 설정
├── ecosystem.railway.config.cjs  # Railway용 PM2 설정 (봇 3개 + 대시보드)
└── Dockerfile                    # Railway 배포용 (Playwright 베이스 이미지)
```

## 설치 및 실행

### 사전 준비

- Node.js 20 이상, `pnpm` (corepack으로 설치 권장: `corepack enable`)
- MongoDB 인스턴스 (로컬 또는 Atlas)
- 네이버 계정(로그인 모드로 크롤링할 경우), Google 서비스 계정(시트 연동 시)

### 1. 의존성 설치

```bash
pnpm install
```

Playwright를 쓰는 스크립트(도그마루 크론, 자동 로그인 등)를 처음 실행한다면 브라우저 바이너리도 받아야 한다.

```bash
npx playwright install chromium
```

### 2. 환경변수 설정

레포 루트에 `.env` 파일을 만든다. 최소 구성:

```
MONGODB_URI=mongodb://localhost:27017/naver-exposure-bot
```

Google Sheets 동기화, 네이버 로그인 모드, Dooray 알림 등 선택 기능을 쓰려면 아래 변수도 채운다 (자세한 항목은 아래 "환경 변수" 표 참고).

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
NAVER_ID=
NAVER_PW=
NAVER_NID_AUT=
NAVER_NID_SES=
DOORAY_WEBHOOK_URL=
```

네이버 로그인 쿠키가 필요하면 브라우저로 직접 로그인해서 쿠키를 받아온다.

```bash
pnpm cookie:login    # 수동 로그인 후 쿠키를 .env에 반영
pnpm cookie:auto     # NAVER_ID/NAVER_PW로 자동 로그인
```

### 3. 개발 모드 실행

빌드 없이 바로 실행해보는 방법이다.

```bash
pnpm dev             # src/index.ts 단발 실행
pnpm cron:p          # 1분 뒤 실행되는 테스트 크론 (TEST_DELAY_MINUTES=1)
```

### 4. 빌드 & 프로덕션 실행

```bash
pnpm build           # tsc → dist/
pnpm start           # node dist/index.js
```

### 5. 크론/스케줄러

```bash
pnpm cron                   # 풀 워크플로우 (시트 동기화 → 크롤 → 시트 반영)
pnpm cron:root               # 루트 키워드 전용
pnpm cron:pages               # 멀티페이지 크롤링
pnpm cron:pages:package        # 패키지 시트, 4페이지 노출체크
pnpm cron:pages:general        # 일반(도그마루 제외) 시트, 4페이지 노출체크
pnpm cron:dogmaru               # 도그마루 전용
pnpm cron:exclude               # 도그마루 제외
pnpm scheduler                  # PM2 기반 상시 스케줄러 (키워드)
pnpm scheduler:root              # PM2 기반 상시 스케줄러 (루트)
pnpm scheduler:all-sheets         # PM2 기반 상시 스케줄러 (전체 시트)
```

각 스케줄러는 `:test` 접미사를 붙이면 `TEST_DELAY_MINUTES=1`로 1분 뒤 즉시 실행해서 동작을 확인할 수 있다 (`pnpm scheduler:test`, `pnpm scheduler:root:test` 등).

### 6. 테스트

```bash
pnpm test
```

`ts-node`로 `src/lib/csv-output/csv-output.test.ts`, `src/lib/scheduler-runner/time.test.ts`를 순서대로 실행하는 단순한 스크립트 테스트다.

### 7. 대시보드 (선택)

봇 프로세스 상태를 웹에서 보고 수동 실행하고 싶다면 `dashboard/`를 별도로 띄운다.

```bash
cd dashboard
pnpm install
pnpm dev              # http://localhost:4500 (개발 모드)
```

대시보드는 `DASHBOARD_PASSWORD`, `DASHBOARD_SESSION_SECRET`을 `dashboard/.env.local`에 설정해야 로그인이 동작한다. 이 값은 절대 커밋하지 않는다.

### 8. 배포

- **Railway** (현재 이전 중): `Dockerfile` + `railway.toml`로 Docker 빌드, `pm2-runtime`이 `ecosystem.railway.config.cjs`를 읽어 봇 3개 + 대시보드를 한 서비스로 띄운다. 절차는 `docs/RAILWAY_MIGRATION.md` 참고.
- **EC2**: `ecosystem.config.cjs`로 PM2 4개 앱(keywords/root/all-sheets/dashboard) 관리. 절차는 `docs/ec2-ubuntu.md` 참고. 대시보드 앱은 `pnpm --dir dashboard build`를 먼저 실행해야 `pm2 start`가 정상 기동한다.

## 시트타입별 동작 (sheet-config)

`src/sheet-config.ts`에서 시트타입별로 매칭 범위, 재시도 횟수, CSV 파일명 접두어를 다르게 설정한다. 환경변수가 있으면 시트 설정보다 환경변수가 우선한다.

| 시트타입 | allowAnyBlog | maxContentChecks | contentCheckDelayMs | CSV 접두어 |
|----------|:---:|:---:|:---:|---|
| 기본값(package) | false | 3 | 600 | `results-package` |
| 도그마루(dogmaru) | true | 4 | 500 | `results-dogmaru` |

## 환경 변수

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `MONGODB_URI` | 필수 | MongoDB 연결 URI (부팅 시 검증) |
| `NAVER_ID` / `NAVER_PW` | 선택 | `cookie:auto` 자동 로그인용 계정 |
| `NAVER_NID_AUT` / `NAVER_NID_SES` | 선택 | 네이버 로그인 쿠키 (로그인 모드 크롤링) |
| `NAVER_M_LOC` | 선택 | 네이버 위치 관련 쿠키 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | 선택 | Google Sheets 서비스 계정 (시트 동기화용) |
| `DOORAY_WEBHOOK_URL` | 선택 | 실행 결과를 알리는 Dooray 웹훅 |
| `CAFE_SOURCE_SHEET_ID` / `CAFE_SOURCE_SHEET_GID` / `CAFE_SOURCE_SHEET_NAME` | 선택 | 카페 노출체크용 소스 시트 지정 |
| `SHEET_APP_URL` | 선택 | 시트 동기화 엔드포인트 (기본값 `localhost:3000`) |
| `ONLY_SHEET_TYPE` / `ONLY_ID` / `ONLY_COMPANY` | 선택 | 실행 대상 필터 |
| `ALLOW_ANY_BLOG` / `MAX_CONTENT_CHECKS` / `CONTENT_CHECK_DELAY_MS` | 선택 | 시트 설정 전역 오버라이드 |
| `TEST_DELAY_MINUTES` | 선택 | 크론/스케줄러 테스트용 지연(분) |

MongoDB URI, API 키, 비밀번호 등 실제 값은 이 문서에 절대 기록하지 않는다. `.env`, `*.pem` 파일은 커밋 대상이 아니다.

## 트러블슈팅

실제로 겪었던 문제와 수정 방식을 커밋 히스토리 기준으로 정리했다. 대부분 네이버가 HTML/URL 구조를 바꾸거나, 매칭 로직이 과하게 관대해서 생긴 문제다.

### 1. 지점명이 다른 매장을 같은 브랜드로 오매칭

`청기와타운 종로점`처럼 브랜드명 뒤에 지점명이 붙는 업체를 매칭할 때, 처음엔 지점 표기를 통째로 제거한 "브랜드 루트"(첫 단어)만 남겨서 비교했다(`fix(match): treat brand-root...`, 커밋 `543e2d4`). 그런데 이렇게 하면 `종로점`과 `을지로점`처럼 서로 다른 지점의 게시글도 같은 브랜드 루트로 매칭되는 문제가 생겼다.

이후 커밋(`e27f5f8`)에서 정규식을 `.replace(/(본점|지점)$/u, '').replace(/점$/u, '')`로 완화해서 "점" 접미사만 제거하고 지점 이름(`종로`, `을지로`)은 남기도록 바꿨다. 매칭은 벤더명 포함 여부(`check1`), 지점 정보가 남은 브랜드명 포함 여부(`check2`), 역방향 포함 여부(`check3`)로 3단계 검사한다. 현재 로직은 `src/lib/post-filter/index.ts:123-132`에 있다.

### 2. 네이버 셀렉터가 빌드마다 바뀌는 해시 클래스라 자주 깨짐

`snippetTitle`, `snippetImageTitle` 셀렉터를 `a.QCvLchZmBzziK2un6REU` 같은 CSS-in-JS 해시 클래스로 잡아뒀는데, 네이버가 프론트엔드를 재배포할 때마다 이 해시가 바뀌어서 파싱이 깨졌다. `fix(selectors): use stable structure-based selectors`(`6a11267`)에서 `a:has(.sds-comps-text-type-headline1)`처럼 시맨틱 클래스 기준 구조 셀렉터로 바꿔서 재배포 내성을 높였다. 현재 값은 `src/parser/selectors/index.ts:40`, `:48`에서 확인할 수 있다. 그래도 구조 자체가 바뀌는 경우엔 여전히 깨지기 때문에 `src/selector-analyzer.ts`로 진단하고 `pnpm naver:popular:update`로 셀렉터를 자동 갱신하는 도구를 별도로 두고 있다.

### 3. 403 차단 대응이 단순 재시도만으로는 부족했음

초기에는 크롤링 실패 시 30초 고정 딜레이 후 재시도만 했는데, 네이버가 403으로 차단하는 빈도가 늘면서 별도 대응이 필요했다. `fix(crawler): improve anti-blocking with header rotation and backoff`(`2f50752`)에서 User-Agent/Referer/Sec-Fetch 헤더를 가진 여러 브라우저 프로필을 두고 요청마다 무작위로 순환시키고, 403 응답일 때만 기본 지연을 더 크게(60초) 잡고 시도 횟수에 비례해 지수적으로 늘리는 방식으로 바꿨다. 현재는 `src/constants/naver-header/index.ts`의 `getRandomHeaders()`와 `src/crawler.ts:125-129`의 `calculateRetryDelay()`(403 여부에 따라 base delay 분기 + jitter)로 정리되어 있다.

### 4. MongoDB 컬렉션명이 실제 데이터와 어긋남

`suripet` 시트타입의 모델을 `mongoose.model('suripets', ..., 'suripets')`로 선언했는데, 실제 컬렉션명은 `suripetKeywords`였다. 이름이 다르면 mongoose는 조용히 빈 컬렉션을 만들어 쓰기 때문에 에러 없이 데이터가 계속 안 맞는 상태로 돌아갔다. `fix(database): suripet 컬렉션명 수정`(`9a9c946`)로 모델명과 컬렉션명을 실제 값(`suripetKeywords`)에 맞춰 고쳤다. 현재 정의는 `src/database.ts:353-356`.

### 5. `.gitignore`가 실제 의존 관계를 반영하지 못해 클린 체크아웃 빌드가 깨짐

`src/tools/`는 stdin 입력이나 로컬 브라우저가 필요한 일회성 스크립트가 많아서, 커밋 대상으로 삼을 파일만 화이트리스트로 관리한다(`.gitignore:21-31`). 그런데 `auto-login.ts`를 새로 추가하면서 `cron-root.ts`와 `run-parallel-direct-sheet-check.ts`가 이 파일을 import하도록 만들어놓고 정작 `.gitignore` 화이트리스트에는 추가하지 않았다. 로컬에는 파일이 있어서 문제가 안 보였는데, Railway가 클린 체크아웃으로 `pnpm build`를 돌리자 `auto-login.ts`가 없어서 `tsc`가 실패했다. `fix(tools): whitelist auto-login.ts so clean checkouts build`(`f33114f`)로 `!src/tools/auto-login.ts`를 추가해서 해결했다. `src/tools/` 아래 파일을 새로 추가할 때 다른 스크립트가 import한다면 이 화이트리스트도 같이 갱신해야 한다는 걸 보여주는 사례다.

### 6. PM2 설정 파일이 확장자 때문에 config로 인식되지 않음

Railway로 이전하면서 PM2 설정 파일을 `ecosystem.railway.cjs`로 뒀는데, `pm2-runtime`은 내부적으로 `.json`/`.yml`/`.yaml`/`.config.js`/`.config.cjs`/`.config.mjs` 확장자만 config 파일로 인식한다. `.cjs`만으로는 매칭이 안 돼서 `pm2-runtime`이 이 파일 자체를 하나의 스크립트로 실행해버렸고, 결과적으로 `ecosystem.railway`라는 프로세스 하나만 뜨고 대시보드는 포트를 바인딩하지 못해 헬스체크가 실패했다. `fix(railway): rename ecosystem file so pm2-runtime recognizes it as config`(`8b676c6`)에서 파일명을 `ecosystem.railway.config.cjs`로 바꾸고 `Dockerfile`, `railway.toml`, `docs/RAILWAY_MIGRATION.md`의 참조를 전부 맞췄다.

### 7. `pnpm start -- -p <port>`가 Next.js에 포트로 전달되지 않음

대시보드 프로세스를 PM2에서 `script: 'pnpm', args: 'start -- -p 8080'`로 띄웠는데, pnpm이 `--` 구분자를 제거하지 않고 그대로 `next start` CLI에 넘기는 바람에 Next.js가 `-- -p 8080`을 인자로 받아 `--p`를 프로젝트 디렉터리 이름으로 잘못 해석했다. `fix(railway): call next binary directly instead of pnpm start -- -p`(`dc35c90`)에서 `pnpm`을 거치지 않고 `node_modules/.bin/next start -p <port>`를 직접 호출하도록 바꿔서 해결했다. `ecosystem.railway.config.cjs`의 대시보드 앱 설정에서 확인 가능하다.

### 8. mongoose `_id`를 `string`으로 타입 고정했다가 타입 에러

`KeywordDoc._id`를 `string`으로 선언해뒀는데, mongoose 문서의 `_id`는 실제로는 `ObjectId`이고 `.lean()`이나 캐스팅 방식에 따라 타입이 달라질 수 있어서 여러 호출부에서 타입 에러가 났다. `fix(types): change KeywordDoc._id type to unknown for mongoose compatibility`(`2df87be`)로 `unknown`으로 완화하고 사용하는 쪽에서 필요한 형태로 캐스팅하게 바꿨다. 현재 정의는 `src/lib/keyword-processor/types.ts:37`.

## 알려진 제약사항

- `cron-dogmaru.ts` / `cron-dogmaru-exclude.ts`는 정상 종료 시에도 Playwright `closeBrowser()`를 호출하지 않아 브라우저 프로세스가 잔류할 수 있다. 대시보드의 job-runner는 자식 프로세스를 process group으로 spawn해서 정지 시 그룹 전체를 kill하지만, 스크립트 자체의 leak은 근본적으로 고쳐지지 않은 상태다.
- 레포 전체에 `SIGINT`/`SIGTERM` 핸들러가 없다.
- Keyword/RootKeyword가 이중 스키마로 존재해서 한쪽 스키마를 변경하면 다른 쪽도 수동으로 맞춰야 한다.
- Railway 이전 작업이 진행 중이며, 아직 EC2와 병행 운영 단계다. 배포 체크리스트는 `docs/RAILWAY_MIGRATION.md`를 따른다.
- 네이버 HTML 구조가 예고 없이 바뀌는 경우가 잦아서, 파싱 실패 시 `src/selector-analyzer.ts`로 원인을 진단하고 `pnpm naver:popular:update`로 셀렉터를 갱신하는 작업이 주기적으로 필요하다.
