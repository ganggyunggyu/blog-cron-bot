# naver-exposure-bot - 개발 가이드

## 프로젝트 개요
- 타입: Node.js TypeScript CLI Application (크론 봇)
- 목적: 네이버 검색 결과에서 특정 블로그 ID들의 노출 여부 자동 검증
- 패키지 매니저: pnpm
- 빌드 타겟: ES2022 / CommonJS

## 기술 스택

### 코어
- TypeScript 5.0
- Node.js (ES2022)

### 주요 라이브러리
- **cheerio** - HTML 파싱 및 크롤링
- **mongoose** - MongoDB ORM (키워드 관리 및 결과 저장)
- **dotenv** - 환경변수 관리

### 개발 도구
- ts-node - TypeScript 직접 실행
- @types/node - Node.js 타입 정의

## 디렉토리 구조

```
blog-cron-bot/
├── src/
│   ├── index.ts              # 메인 실행 파일
│   ├── crawler.ts            # 크롤링 로직
│   ├── parser.ts             # HTML 파싱 로직 (cheerio)
│   ├── matcher.ts            # 블로그 ID 매칭 로직
│   ├── csv-writer.ts         # CSV 파일 저장
│   ├── database.ts           # MongoDB 연결 및 스키마
│   ├── constants.ts          # 상수 (헤더, 블로그 ID 목록)
│   └── test.ts               # 테스트 파일
├── output/                   # CSV 결과 파일 출력 디렉토리
├── debug/                    # 디버그용 HTML 파일
├── .env                      # 환경변수 (MONGODB_URI)
└── dist/                     # 빌드 결과물
```

## 주요 기능

1. **검색어별 네이버 인기글 크롤링**
   - User-Agent 헤더 필수
   - 검색어 간 2초 딜레이 권장

2. **블로그 노출 여부 체크**
   - 특정 블로그 ID 목록과 매칭

3. **인기글 vs 스블(스마트블로그) 구분**
   - 스블 주제명 추출

4. **결과 저장**
   - CSV 파일 생성 (output/)
   - MongoDB 저장 (키워드, 노출 여부, URL 등)

5. **에러 핸들링**
   - 실패 시 30초 대기 후 재시도

## MongoDB 스키마

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

## 개발 규칙

### TypeScript
- strict 모드 활성화
- ES2022 타겟 사용
- CommonJS 모듈 시스템

### 코드 스타일
- 구조분해할당 사용
- async/await 패턴 사용
- 중요한 주석만 작성 (파싱 셀렉터 변경 관련 등)

### 파일 구조
- 단일 책임 원칙 (크롤링, 파싱, 매칭, 저장 분리)
- 상수는 `constants.ts`에 집중

### 에러 핸들링
- try-catch 필수
- 재시도 로직 구현 (30초 딜레이)
- 실패 로그 기록

## 실행 명령어

```bash
# 의존성 설치
pnpm install

# 개발 모드 (ts-node)
pnpm dev

# 테스트
pnpm test

# 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

## 환경 변수

`.env` 파일 설정:
```env
MONGODB_URI=mongodb://localhost:27017/naver-exposure-bot
# 또는 MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
```

## 크론 설정 (선택)

매일 오전 9시 실행:
```bash
0 9 * * * cd /path/to/blog-cron-bot && pnpm start >> /path/to/logs/cron.log 2>&1
```

## 주의사항

### 1. 네이버 차단 방지
- User-Agent 헤더 필수 설정
- 검색어 간 충분한 딜레이 (2초 이상 권장)
- 동일 IP에서 과도한 요청 금지

### 2. HTML 구조 변경 대응
- 네이버는 HTML 구조를 자주 변경
- 파싱 실패 시 `parser.ts`의 cheerio 셀렉터 업데이트 필요
- debug/ 디렉토리 HTML 파일로 구조 확인

### 3. 블로그 ID 관리
- 새 블로그 추가: `constants.ts`의 `BLOG_IDS` 배열 수정

### 4. 데이터 저장
- CSV는 마지막에 한 번만 저장
- MongoDB 연결 실패 시에도 CSV는 저장

## 참고 문서

- [TypeScript 가이드](@~/.claude/_mds/JS.md)
- [프로젝트 README](../README.md)
