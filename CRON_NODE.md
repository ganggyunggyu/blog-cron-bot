# 스케줄러 사용 가이드

`src/pm2-scheduler.ts`는 기본 키워드(Keyword) 워크플로우 스케줄러입니다.
`src/pm2-scheduler-root.ts`는 루트 키워드(RootKeyword) 워크플로우 스케줄러입니다.
KST(Asia/Seoul) 기준으로 시간을 감지해서 지정된 시각에 작업을 수행합니다.

`src/cron.ts`는 node-cron 기반(크론 표현식) 스케줄러로, 필요할 때만 사용합니다.

## 워크플로우 개요

워크플로우는 3단계로 실행됩니다:

1. Step 1: Sheet App → DB 동기화 (`POST ${SHEET_APP_URL}/api/keywords/sync`)
   - 시트 데이터를 MongoDB로 동기화합니다

2. Step 2: 크롤링 및 노출 체크
   - 네이버 검색 결과 크롤링
   - 블로그 노출 여부 확인
   - MongoDB에 결과 업데이트

3. Step 3: DB → Sheet App 반영 (`POST ${SHEET_APP_URL}/api/keywords/import`)
   - 노출 체크 결과를 시트에 반영합니다

> ⚠️ **중요**: 3단계는 **반드시 순서대로** 실행됩니다. 중간에 실패하면 전체 워크플로우가 중단됩니다.

---

## 빠른 시작

### 사전 준비

1. **환경 변수 설정** (`.env`)
   ```env
   MONGODB_URI=mongodb+srv://...
   SHEET_APP_URL=http://localhost:3000  # Sheet App URL (기본값)
   # HH:mm 콤마 구분(하루 여러 번 가능)
   WORKFLOW_RUN_TIMES=09:10,13:10,17:10
   ROOT_RUN_TIMES=09:20,13:20,17:20
   ```

### 1. 스케줄러 실행

```bash
pnpm scheduler
pnpm scheduler:root
```

### 2. 테스트 실행 (N분 뒤)

```bash
TEST_DELAY_MINUTES=1 pnpm scheduler
TEST_DELAY_MINUTES=1 pnpm scheduler:root
```

다른 시간으로 테스트:
```bash
# 3분 뒤
TEST_DELAY_MINUTES=3 pnpm scheduler
TEST_DELAY_MINUTES=3 pnpm scheduler:root

# 10분 뒤
TEST_DELAY_MINUTES=10 pnpm scheduler
TEST_DELAY_MINUTES=10 pnpm scheduler:root

# 1분 뒤
TEST_DELAY_MINUTES=1 pnpm scheduler
TEST_DELAY_MINUTES=1 pnpm scheduler:root
```

---

## pm2 운영

EC2에서 상시 실행은 pm2를 권장합니다:

```bash
pnpm build
pm2 start ecosystem.config.cjs --env production
pm2 logs blog-cron-bot-keywords
pm2 logs blog-cron-bot-root
```
