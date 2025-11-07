# 네이버 검색 노출 크론 봇

네이버 검색 결과에서 특정 블로그 ID들의 노출 여부를 자동으로 검증하는 Node.js 크론 봇입니다.

## 주요 기능

- 검색어별 네이버 인기글 크롤링
- 블로그 노출 여부 체크
- 인기글 vs 스블(스마트블로그) 구분
- 스블 주제명 추출
- CSV 결과 파일 생성
- MongoDB 연동 (키워드 관리 및 결과 저장)
- 에러 발생 시 30초 텀 재시도

## 설치

```bash
pnpm install
```

## 환경 변수 설정

`.env` 파일에 MongoDB URI를 설정하세요:

```
MONGODB_URI=mongodb://localhost:27017/naver-exposure-bot
```

또는 MongoDB Atlas 사용 시:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

## MongoDB 스키마

키워드 컬렉션 스키마:

```typescript
{
  company: string;        // 회사명
  keyword: string;        // 검색 키워드
  visibility: boolean;    // 노출 여부
  popularTopic: string;   // 인기 주제명
  url: string;            // 게시글 URL
  sheetType: string;      // 시트 타입 (기본값: "package")
  lastChecked: Date;      // 마지막 체크 시간
  createdAt: Date;        // 생성 시간
  updatedAt: Date;        // 업데이트 시간
}
```

## 실행

개발 모드:
```bash
pnpm dev
```

빌드:
```bash
pnpm build
```

프로덕션 실행:
```bash
pnpm start
```

## 크론 설정 (선택)

매일 오전 9시 실행 예시:

```bash
0 9 * * * cd /path/to/blog-cron-bot && pnpm start >> /path/to/logs/cron.log 2>&1
```

## 프로젝트 구조

```
blog-cron-bot/
├── src/
│   ├── index.ts              # 메인 실행 파일
│   ├── crawler.ts            # 크롤링 로직
│   ├── parser.ts             # HTML 파싱 로직
│   ├── matcher.ts            # 블로그 ID 매칭
│   ├── csv-writer.ts         # CSV 저장
│   ├── database.ts           # MongoDB 연결 및 스키마
│   └── constants.ts          # 상수 (헤더, 블로그 ID)
├── output/                   # CSV 결과 파일
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## 블로그 ID 추가/수정

`src/constants.ts` 파일의 `BLOG_IDS` 배열에서 수정:

```typescript
export const BLOG_IDS = [
  'im_tang',
  'solantoro',
  // ... 더 추가
];
```

## 주의사항

1. **네이버 차단 방지**
   - User-Agent 헤더 필수
   - 검색어 간 2초 이상 딜레이 권장
   - 동일 IP에서 과도한 요청 금지

2. **HTML 구조 변경**
   - 네이버는 HTML 구조를 자주 변경합니다
   - 파싱 실패 시 `src/parser.ts`의 셀렉터 업데이트 필요

3. **에러 처리**
   - 30초 재시도 로직 구현
   - 실패한 검색어도 로그 기록
   - CSV 저장은 마지막에 한 번만

## 라이선스

MIT
