# UI 구성 문서

## 개요

- React + Vite + TypeScript 기반 UI
- FSD 구조(`app/pages/widgets/features/shared`)
- TanStack Query로 데이터 요청/캐싱
- Jotai로 로컬 상태(`api_base`) 관리
- Tailwind CSS v4 + CSS 변수로 스타일링

## 디렉토리 구조

```
ui/
  src/
    app/
      providers/
      styles/
    pages/
      home/
    widgets/
      header/
      test-panel/
      batch-panel/
    features/
      test-keyword/
        api/
      batch-runner/
        api/
    shared/
      api/
      hooks/
      lib/
      store/
      ui/w
```

## 실행 흐름

- UI 개발: `pnpm ui:dev`
- API 서버: `pnpm web`
- UI 빌드: `pnpm ui:build` → `ui/dist/`
- `pnpm web` 실행 시 `ui/dist/`가 있으면 해당 빌드를 정적 서빙

## API 연동

### `/api/test`

단일 키워드 노출/벤더 매칭 확인

```ts
export interface TestKeywordRequest {
  keyword: string;
  allowAnyBlog: boolean;
  fetchHtml: boolean;
  maxContentChecks?: number;
  contentCheckDelay?: number;
}
```

### `/api/run`

DB 키워드 일괄 처리

```ts
export interface BatchRunRequest {
  startIndex: number;
  limit: number;
  onlySheetType: string;
  onlyCompany: string;
  onlyKeywordRegex: string;
  onlyId: string;
  onlyIds: string[];
  allowAnyBlog: boolean;
  maxContentChecks: number;
  contentCheckDelay: number;
}
```

### 응답 타입

```ts
export interface TestResult {
  ok: boolean;
  query: string;
  baseKeyword: string;
  restaurantName: string;
  matches: {
    match: ExposureResult;
    postVendorName?: string;
  }[];
}

export interface BatchResponse {
  ok: boolean;
  total: number;
  processed: BatchItemResult[];
  error?: string;
}
```

## 환경/설정

- API Base URL은 UI 상단 입력에서 설정 가능
- 값은 `localStorage`에 `api_base`로 저장
- 기본값은 현재 `window.location.origin`
- `pnpm web` 포트가 5178이 아니면 UI에서 Base URL을 맞춰야 함

## 스타일링

- Tailwind v4: `ui/src/app/styles/index.css`에서 `@import "tailwindcss"`
- CSS 변수로 색상/그라디언트/그림자 정의
- 아이콘은 `lucide-react` 사용

## 참고

- 배치 API는 `MONGODB_URI` 설정 필요
- Vite 프록시는 `ui/vite.config.ts`에서 `/api`, `/health`를 5178로 연결
