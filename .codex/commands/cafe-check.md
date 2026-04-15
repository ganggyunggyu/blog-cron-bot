---
description: 카페 노출체크 실행 (Google Sheets 키워드 기반)
argument-hint: [append]
---

# 카페 노출체크

Google Sheets `카페키워드` 탭에서 키워드를 읽어 네이버 통합검색 카페 노출 여부를 체크합니다.

## 실행 규칙

- 레포 루트: `/Users/ganggyunggyu/Programing/blog-cron-bot`
- 키워드 소스: Google Sheets (CAFE_SOURCE_SHEET_ID / CAFE_SOURCE_SHEET_NAME / CAFE_SOURCE_SHEET_GID)
- 결과 시트: `카페 노출여부` 탭에 내보내기

## 인자 해석

- `$ARGUMENTS`가 비어있거나 없으면 **덮어쓰기 모드**로 실행
- `$ARGUMENTS`가 `append`이면 **추가 모드**(`CAFE_EXPORT_MODE=append`)로 실행

## 실행 전 점검

1. `.env` 파일 존재 여부
2. `GOOGLE_SERVICE_ACCOUNT_EMAIL` 설정 여부
3. `GOOGLE_PRIVATE_KEY` 설정 여부
4. `CAFE_SOURCE_SHEET_ID` 설정 여부

누락 시 실행하지 말고 누락 항목을 안내합니다.

## 실행 명령

```bash
# 덮어쓰기 모드 (기본)
cd /Users/ganggyunggyu/Programing/blog-cron-bot && pnpm cafe:check

# 추가 모드
cd /Users/ganggyunggyu/Programing/blog-cron-bot && CAFE_EXPORT_MODE=append pnpm cafe:check
```

## 결과 보고

실행 완료 후 아래 형식으로 보고합니다.

```text
[카페 노출체크 보고]
- 실행 시각(KST): <YYYY-MM-DD HH:mm:ss>
- 키워드 소스: Google Sheets 카페키워드 탭
- 내보내기 모드: <덮어쓰기/추가>
- 총 키워드: <N>개
- 노출: <N>개
- 미노출: <N>개
- 확인실패: <N>개
- CSV: <파일 경로>
- Google Sheets: <내보내기 성공/실패>
- 핵심 로그: <마지막 요약 로그 3~5줄>
```
