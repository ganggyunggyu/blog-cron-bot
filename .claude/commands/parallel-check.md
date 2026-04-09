---
description: Google Sheets 직접 연동으로 패키지/일반건/도그마루/루트를 순서 보장 상태로 병렬 노출체크
argument-hint: [--targets package,dogmaru-exclude,dogmaru,root] [--dry-run] [--print-only] [--limit N] [--concurrency N]
---

# 병렬 노출체크

`pnpm parallel:check`를 실행해 Google Sheets에서 `패키지`, `일반건`, `도그마루`, `루트` 탭을 직접 읽고 같은 시트에 다시 쓴다. DB 동기화 API나 시트 import/export API를 거치지 않으므로, 시트 순서 보장과 수동 재실행 안정성을 우선한다. 결과는 CSV와 날짜별 MongoDB 히스토리 컬렉션에도 같이 저장한다.

## 기본 원칙

- 레포 루트: `/Users/ganggyunggyu/Programing/blog-cron-bot`
- 대상 시트 ID 기본값: `1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0`
- 기본 실행: `pnpm parallel:check`
- 기본 타겟: `package,dogmaru-exclude,dogmaru,root`
- 기본 탭 내부 동시성: `2`
- 각 탭의 키워드 순서는 현재 Google Sheets 행 순서를 그대로 사용한다.
- 로컬 서버/프리뷰는 사용자가 명시하지 않으면 직접 켜지 않는다.
- 루트도 같은 시트의 `루트` 탭을 직접 사용한다.
- 시트 쓰기 전 검증이 필요하면 `--print-only` 또는 `--dry-run`을 우선 사용한다.

## 실행 전 점검

1. `.env` 파일 존재 여부 확인
2. `GOOGLE_SERVICE_ACCOUNT_EMAIL` 설정 여부 확인
3. `GOOGLE_PRIVATE_KEY` 설정 여부 확인
4. 네이버 로그인 상태 확인
5. 로그인되지 않았으면 자동 로그인 성공 여부 확인

Google Sheets 권한이나 로그인 상태가 불안정하면 실행하지 말고 누락 항목을 먼저 보고한다.

## 인자 해석

- `$ARGUMENTS`가 비어 있으면 4개 탭 전체 실행
- `$ARGUMENTS`에 `--targets`가 있으면 해당 타겟만 실행
  - 예: `--targets package,root`
- `$ARGUMENTS`에 `--dry-run`이 있으면 노출체크는 수행하되 시트 쓰기는 건너뜀
- `$ARGUMENTS`에 `--print-only`가 있으면 시트 로드와 시작 순서만 확인
- `$ARGUMENTS`에 `--limit N`이 있으면 각 탭 앞에서부터 N개만 처리
- `$ARGUMENTS`에 `--concurrency N`이 있으면 각 탭 내부에서 서로 다른 검색어 그룹을 최대 N개까지 제한 병렬 처리

## 실행 절차

1. 직접 시트 인증 정보를 확인한다.
2. `패키지`, `일반건`, `도그마루`, `루트` 탭을 각각 현재 행 순서대로 읽는다.
3. 각 탭의 키워드를 독립 워크플로우로 병렬 노출체크한다.
4. 같은 검색어(`searchQuery`)끼리는 기존과 동일하게 직렬 처리하고, 서로 다른 검색어 그룹만 제한 병렬로 처리한다.
5. 각 탭은 같은 행 번호에 결과를 직접 다시 쓴다.
6. 전체 결과를 CSV와 상세 로그로도 남긴다.
7. 한 타겟이 실패해도 다른 타겟은 끝까지 수행하고 마지막에 분리 보고한다.

## 직접 반영 범위

- `업체명`
- `키워드`
- `인기주제`
- `순위`
- `노출여부`
- `바이럴 체크`
- `인기글 순위`
- `이미지 매칭`
- `링크`
- `변경`
- `행`

## 저장 범위

- CSV: `output/<주차>/direct-*`
- 상세 로그: `logs/detailed-direct-*`
- MongoDB 히스토리: `exposure_history_YYYY_MM_DD`
  - 한 키워드당 1문서
  - `runId`, `sheetId`, `tabName`, `targetType`, `orderIndex`, `visibility`, `rank`, `isNewLogic` 등을 저장

## 결과 보고

실행 완료 후 아래 형식으로 보고한다.

```text
[parallel-check 보고]
- 실행 시각(KST): <YYYY-MM-DD HH:mm:ss>
- 시트 ID: <sheetId>
- 실행 타겟: <package,dogmaru-exclude,dogmaru,root>
- package: <성공/실패, 노출 수, 쓰기 여부>
- dogmaru-exclude: <성공/실패, 노출 수, 쓰기 여부>
- dogmaru: <성공/실패, 노출 수, 쓰기 여부>
- root: <성공/실패, 노출 수, 쓰기 여부>
- 순서 기준: Google Sheets 현재 행 순서
- 비고: <dry-run 여부, 누락 탭, 로그인/권한 이슈>
```
