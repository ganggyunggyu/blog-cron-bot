# 프로젝트 규모 분석

## 개요

네이버 블로그 검색 노출 모니터링 크론 봇

## 코드 규모

| 항목 | 수치 |
|------|------|
| TypeScript 파일 | 47개 |
| 총 코드 라인 | ~4,800줄 |
| 디렉토리 | 32개 |

## 기술 스택

- **Runtime**: Node.js + TypeScript
- **Database**: MongoDB (Mongoose)
- **HTTP**: axios, cheerio (HTML 파싱)
- **Scheduler**: node-cron
- **Web**: Express.js

## 디렉토리 구조

```
src/
├── api/              # 외부 API 호출 (키워드 조회)
├── constants/        # 설정값 (헤더, 크롤링 설정, 블로그 ID)
├── lib/              # 핵심 비즈니스 로직
│   ├── keyword-processor/   # 키워드 처리 (크롤링, 매칭)
│   ├── post-filter/         # 포스트 필터링
│   ├── post-quality-checker/# 포스트 품질 체크
│   ├── vendor-extractor/    # 업체명 추출
│   └── utils/               # 유틸리티
├── logs/             # 로깅 시스템
├── migrations/       # DB 마이그레이션
├── parser/           # HTML 파서 (인기글)
├── tools/            # 유틸 도구 (셀렉터 업데이트)
├── web/              # 웹 인터페이스
│   ├── batch-runner/ # 배치 실행기
│   ├── server/       # Express 서버
│   └── tester/       # 테스터
├── crawler.ts        # 네이버 크롤러
├── cron.ts           # 크론 스케줄러
├── cron-root.ts      # 루트 키워드 크론
├── database.ts       # MongoDB 모델
├── index.ts          # 메인 진입점
├── matcher.ts        # 키워드 매칭
└── types.ts          # 타입 정의
```

## 주요 파일 (라인 수)

| 파일 | 라인 |
|------|------|
| web/batch-runner/index.ts | 425 |
| test.ts | 330 |
| lib/keyword-processor/handlers.ts | 257 |
| web/tester/index.ts | 257 |
| selector-analyzer.ts | 241 |
| tools/update-popular-selectors/index.ts | 212 |
| lib/keyword-processor/index.ts | 209 |
| database.ts | 204 |
| parser/popular-parser/index.ts | 203 |
| lib/post-filter/index.ts | 181 |

## 데이터 모델

### Keyword
```typescript
{
  company: string;         // 업체명
  keyword: string;         // 검색 키워드
  visibility: boolean;     // 노출 여부
  popularTopic: string;    // 인기글 주제
  url: string;             // 매칭된 URL
  keywordType: 'restaurant' | 'pet' | 'basic';
  rank: number;            // 순위
  rankWithCafe: number;    // 카페 포함 순위
  isUpdateRequired: boolean;
}
```

### RootKeyword
- 루트 키워드 (상위 키워드) 관리

## 핵심 기능

### 1. 크롤링 (`crawler.ts`)
- 네이버 모바일 검색 결과 크롤링
- 재시도 로직 (403 에러 시 백오프)
- got-scraping으로 TLS 핑거프린트 에뮬레이션

### 2. 파싱 (`parser/`)
- 네이버 인기글 블록 파싱
- Collection 블록형 + Single Intention 리스트형 지원
- CSS 셀렉터 기반 추출

### 3. 키워드 처리 (`lib/keyword-processor/`)
- 키워드별 크롤링 및 매칭
- 캐싱 (동일 검색어 중복 크롤링 방지)
- 키워드 분류 (restaurant, pet, basic)

### 4. 업체 추출 (`lib/vendor-extractor/`)
- 블로그 포스트에서 업체명 추출
- HTML 파싱 기반

### 5. 로깅 (`logs/`)
- 상세 로그 빌더
- 콘솔 + 파일 저장
- 진행률 표시

### 6. 웹 인터페이스 (`web/`)
- Express 서버
- 배치 실행 API
- 테스트 인터페이스

## 실행 스크립트

```bash
npm run build     # TypeScript 빌드
npm start         # 메인 실행
npm run cron      # 크론 스케줄러
npm run cron:root # 루트 키워드 크론
npm run web       # 웹 서버
npm run test      # 테스트
```

## 환경 변수

- `MONGODB_URI` - MongoDB 연결 문자열
- `ONLY_SHEET_TYPE` - 특정 시트 타입만 처리
- `ONLY_COMPANY` - 특정 업체만 처리
- `ONLY_KEYWORD_REGEX` - 키워드 정규식 필터
- `ONLY_ID` - 특정 ID만 처리

## 프로젝트 복잡도

| 지표 | 평가 |
|------|------|
| 규모 | 중소형 (~5,000줄) |
| 모듈화 | 높음 (FSD 구조) |
| 타입 안정성 | 높음 (TypeScript strict) |
| 테스트 | 수동 테스트 |
| 의존성 | 최소화 (7개 런타임 의존성) |
