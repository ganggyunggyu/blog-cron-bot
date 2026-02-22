# naver-exposure-bot - 개발 가이드

## 프로젝트 개요
- **타입**: Node.js TypeScript CLI / 크론 봇
- **목적**: 네이버 검색 결과에서 특정 블로그 ID의 노출 여부 자동 검증 + 결과 시트 동기화
- **패키지 매니저**: pnpm
- **빌드**: TypeScript 5.0 → ES2022 / CommonJS
- **런타임**: ts-node (개발), dist/ (프로덕션, PM2)

## 기술 스택

| 구분 | 라이브러리 | 용도 |
|------|-----------|------|
| 크롤링 | got-scraping, playwright | TLS 우회 크롤링, 브라우저 자동화 |
| 파싱 | cheerio | HTML 파싱 |
| DB | mongoose | MongoDB ORM |
| 스케줄링 | node-cron | 크론 스케줄 |
| 웹 | express, socket.io | 내부 대시보드/API |
| 로그 | winston, chalk | 구조화 로깅 |
| HTTP | axios | 외부 API 호출 |

## 디렉토리 구조

```
src/
├── index.ts                    # 메인 크롤러 오케스트레이션
├── cron.ts                     # 패키지 키워드 크론 (매일 13:02)
├── cron-root.ts                # 루트 키워드 크론
├── cron-pages.ts               # 멀티페이지 크론 (시트별 순위 체크)
├── cron-pet.ts                 # 펫 전용 크론
├── pm2-scheduler.ts            # PM2 스케줄러 (패키지)
├── pm2-scheduler-root.ts       # PM2 스케줄러 (루트)
├── crawler.ts                  # got-scraping TLS 우회 크롤러
├── parser/                     # HTML 파서 + 셀렉터
│   ├── selectors/              # 네이버 검색 DOM 셀렉터
│   └── popular-parser/         # 인기글 파싱
├── matcher.ts                  # 블로그 ID 매칭 + ExposureResult 타입
├── database.ts                 # MongoDB 스키마/모델 (Keyword, RootKeyword, PageCheck)
├── csv-writer.ts               # CSV 결과 저장
├── sheet-config.ts             # 시트별 설정 (csvPrefix 등)
├── constants/                  # 전역 상수 (배럴 export)
│   ├── api/                    # API 엔드포인트
│   ├── blog-ids/               # 블로그 ID 목록
│   ├── crawl-config/           # 크롤링 설정 (DELAY, RETRY, TIMEOUT 등)
│   ├── naver-header/           # 네이버 요청 헤더
│   └── scheduler/              # 스케줄러 설정
├── lib/                        # 핵심 라이브러리
│   ├── keyword-processor/      # 키워드 처리 오케스트레이션
│   │   ├── index.ts            # 키워드 순회/매칭/저장
│   │   ├── crawl-manager.ts    # 크롤링 + 캐시/큐
│   │   ├── guest-retry.ts      # 비로그인 재시도
│   │   ├── allow-any-blog.ts   # ALLOW_ANY_BLOG 우선순위
│   │   ├── handlers.ts         # 성공/실패/예외 분기
│   │   └── keyword-classifier.ts # 키워드 분류
│   ├── logger/                 # 구조화 로거 (winston)
│   ├── playwright-crawler/     # Playwright 브라우저 크롤러
│   ├── post-filter/            # 포스트 필터링
│   ├── post-quality-checker/   # 포스트 품질 체크
│   ├── dooray.ts               # Dooray 메신저 알림
│   ├── check-naver-login.ts    # 네이버 로그인 상태 확인
│   └── vendor-extractor/       # 벤더 정보 추출
├── logs/                       # 로그 시스템
│   ├── console/                # 콘솔 출력
│   ├── detailed-log/           # 상세 로그 빌더
│   ├── formatter/              # 로그 포맷터
│   ├── progress-logger/        # 진행률 로거
│   └── storage/                # 로그 파일 저장
├── api/                        # 외부 API 호출 (시트 동기화)
├── web/                        # 내부 웹 서버
│   ├── server/                 # Express 서버
│   ├── tester/                 # 단일 키워드 테스트
│   ├── batch-runner/           # 배치 실행
│   └── cron-runner/            # 크론 SSE 스트림
├── tools/                      # 유틸리티 도구
│   ├── auto-login.ts           # 자동 로그인
│   ├── login-and-get-cookie.ts # 쿠키 획득
│   ├── update-cookie.ts        # 쿠키 갱신
│   └── update-popular-selectors/ # 인기 탭 셀렉터 자동 업데이트
└── migrations/                 # DB 마이그레이션
```

## 핵심 데이터 흐름

```
processKeywords → crawlWithRetry → parser(cheerio) → matcher → DB update + CSV
```

1. MongoDB에서 키워드 로드
2. 키워드별 네이버 검색 크롤링 (got-scraping TLS 우회)
3. HTML 파싱 → 블로그 ID 매칭
4. 인기글/스블(스마트블록) 구분
5. DB 업데이트 + CSV 저장 + Dooray 알림

## MongoDB 컬렉션

| 모델 | 컬렉션 | 용도 |
|------|--------|------|
| Keyword | keywords | 패키지 키워드 |
| RootKeyword | rootkeywords | 루트 키워드 |
| PageCheck | blackgoatnews, blackgoatolds, pets 등 | 시트별 페이지 체크 키워드 |

## 실행 명령어

```bash
# 의존성 설치
pnpm install

# 개발 (메인 크롤러)
pnpm dev

# 크론 실행
pnpm cron              # 패키지 크론
pnpm cron:root         # 루트 크론
pnpm cron:pages        # 멀티페이지 크론 (전체 시트)
pnpm cron:pages pet    # 특정 시트만

# 웹 대시보드
pnpm web               # Express 서버 (포트 5178)

# 빌드 + 프로덕션
pnpm build && pnpm start

# PM2 배포
pm2 start ecosystem.config.cjs

# 도구
pnpm cookie:auto       # 자동 로그인
pnpm cookie:update     # 쿠키 갱신
pnpm naver:popular:update  # 인기 탭 셀렉터 업데이트
```

## 시트 타입 (cron:pages)

`PAGE_CHECK_META` (sheet.ts) 한 곳에서 관리. 새 탭 추가 시 enum + meta 한 줄만 추가.

| enum | 라벨 | 시트탭 | DB 컬렉션 | 키워드 수 |
|------|------|--------|----------|-----------|
| BLACK_GOAT_NEW | 흑염소 신규 | 흑염소 신규 | blackgoatnews | 368 |
| BLACK_GOAT_OLD | 흑염소 구 | 흑염소 구 | blackgoatolds | 309 |
| SKIN_PROCEDURE | 피부시술 | 피부시술 | skinprocedures | 17 |
| PRESCRIPTION | 약처방 | 약처방 | prescriptions | 28 |
| EYE_CLINIC | 안과 | 안과 | eyeclinics | 82 |
| DIET_SUPPLEMENT | 다이어트보조제 | 다이어트보조제 | dietsupplements | 30 |
| DENTAL | 치과 | 치과 | dentals | 48 |
| PET | 애견 | 애견 | pets | 300 |

삭제됨: 약재효능(herbeffects), 치질(hemorrhoids), 흑염소 통합(blackgoats)

## 코드 규칙

- **Strict TS**, 2-space indent, CJS 모듈
- **상대 경로** 사용 (별도 path alias 없음)
- 네이버 검색은 `crawler.fetchWithChromeTLS`(got-scraping)으로 TLS 우회
- 파싱/셀렉터 수정은 `parser/` 에서만
- 딜레이/재시도는 `constants/crawl-config`의 상수 사용 (매직 넘버 금지)
- 생성물(`output/`, `dist/`, `logs/`, `debug/`)은 커밋 금지
- `.env`, 키 파일(`.pem`)은 커밋 금지

## 환경 변수

```env
MONGODB_URI=mongodb+srv://...      # MongoDB 연결
NAVER_COOKIE=...                   # 네이버 로그인 쿠키
PAGE_CHECK_API=http://...          # 시트 동기화 API
DOORAY_WEBHOOK_URL=...             # Dooray 알림 웹훅
TEST_DELAY_MINUTES=1               # 테스트 시 크론 딜레이
ONLY_SHEET_TYPE=pet                # 특정 시트만 필터
```

## 주의사항

1. **네이버 차단 방지**: 딜레이/재시도 상수 준수, 과도한 요청 금지
2. **HTML 구조 변경**: 파싱 실패 시 `parser/selectors` 업데이트, `selector-analyzer` 참고
3. **블로그 ID 관리**: `constants/blog-ids` 수정
4. **Playwright**: 일부 키워드는 브라우저 크롤링 사용, `closeBrowser()` 호출 필수
