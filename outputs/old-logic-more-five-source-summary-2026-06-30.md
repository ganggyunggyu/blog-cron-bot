# 더보기 노출체크 전체 실행 요약

- 실행 완료: 2026-06-30 11:04:25 KST
- 작업 위치: `/Users/ganggyunggyu/Programing/blog-cron-bot`
- 실행 대상: `패키지`, `일반건`, `도그마루`, `루트`, `서리펫`
- 결과 탭: `패키지_더보기`, `일반건_더보기`, `도그마루_더보기`, `루트_더보기`, `서리펫_더보기`
- 기준: 브라우저 모드, 50위까지만, `--all-matches`, `--external-blog-limit 10`, `--concurrency 1`
- Dooray 전송: OK

| 탭 | 고유 키워드 | 결과 행 | 노출 행 | 노출 키워드 | 미노출/오류 행 | 오류 | 50위 초과 | 최대 순위 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 패키지_더보기 | 58 | 62 | 22 | 18 | 40 | 0 | 0 | 45 |
| 일반건_더보기 | 51 | 76 | 55 | 30 | 21 | 0 | 0 | 50 |
| 도그마루_더보기 | 48 | 156 | 150 | 42 | 6 | 0 | 0 | 50 |
| 루트_더보기 | 129 | 139 | 39 | 29 | 100 | 1 | 0 | 44 |
| 서리펫_더보기 | 18 | 63 | 61 | 16 | 2 | 0 | 0 | 49 |
| 합계 | 304 | 496 | 327 | 135 | 169 | 1 | 0 | 50 |

## 오류/특이사항

- 루트_더보기 1건: `지웰시티맛집(창심관 지웰시티점)` -> `오류: 더보기 결과 0개`
- 실행 로그 기준 스크롤 상한 도달: 0건
- 일부 `in.naver.com` 외부 상위글 작성일 수집 경고가 있었으나, 노출 판정 및 시트 반영은 완료됨.

## 산출물

- 체크포인트: `/Users/ganggyunggyu/Programing/blog-cron-bot/output/old-logic-more-checkpoint.json`
- readback JSON: `/Users/ganggyunggyu/Programing/blog-cron-bot/output/old-logic-more-five-source-readback-2026-06-30T02-03-45-453Z.json`
- 실행 요약: `/Users/ganggyunggyu/Programing/blog-cron-bot/outputs/old-logic-more-five-source-summary-2026-06-30.md`
- Google Sheet: `https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit`
