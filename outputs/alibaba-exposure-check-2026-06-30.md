# 알리바바 노출체크 결과 - 2026-06-30

## 결론

- `i_thinkkkk`는 알리바바 노출체크 아이디 리스트에 포함되어 있음.
- 기본 실행 결과 16개가 6/29 결과(87개)와 차이가 커서 저부하 모드로 재검증함.
- 저부하 재검증 최종 결과는 13개이며, 현재 알리바바 시트도 13개 기준으로 반영됨.
- 감소 원인은 아이디 리스트 누락이 아니라, 6/29에 `i_thinkkkk`로 잡히던 다수 키워드가 6/30 현재 네이버 인기글 응답에서 빠진 현상으로 확인됨.

## 최종 결과

- 실행 명령: `pnpm alibaba:check -- --guest --concurrency 1`
- 실행 시간: 2026-06-30 10:10:40 - 10:24:40 KST
- 대상 탭: 알리바바 (`gid=914645152`)
- 처리 대상: 신규작업 351개
- 전체 키워드 행: 474개
- 중복 키워드 행: 123개
- 노출: 13개
- 미노출: 338개
- 인기글: 13개
- 스블: 0개
- 신규로직: 9개
- 구로직: 4개
- 시트 반영: 완료
- Dooray 알림: 전송 완료

## 검증

- `src/constants/blog-ids/alibaba.ts`의 `ALIBABA_BLOG_IDS` 16라인에 `i_thinkkkk` 포함.
- 저부하 CSV 행수: 헤더 제외 13행
- 저부하 상세 JSON: 351개 기록, `success=true` 13개, `totalItemsParsed=0` 338개
- 시트 readback: 노출 `o` 13행, 링크 13행
- 시트 readback 범위: 알리바바 탭 마지막 키워드 행 475행
- `i_thinkkkk` 현재 노출: 광저우박람회, 중국직구 2개

## 비교

| 기준 | 노출 | 신규 | 구 | 비고 |
|---|---:|---:|---:|---|
| 2026-06-29 09:46 | 89 | 86 | 3 | 이전 실행 |
| 2026-06-29 10:43 | 87 | 84 | 3 | 보정본 |
| 2026-06-30 10:06 | 16 | 12 | 4 | 기본 실행 |
| 2026-06-30 10:24 | 13 | 9 | 4 | 저부하 재검증, 최종 시트 반영 |

## 산출물

- 최종 CSV: `/Users/ganggyunggyu/Programing/blog-cron-bot/output/2026-06월5주차/alibaba-신규작업/alibaba-신규작업_2026-06-30-10-24-39.csv`
- 최종 JSON 로그: `/Users/ganggyunggyu/Programing/blog-cron-bot/logs/detailed-alibaba-신규작업_2026-06-30-10-24-39.json`
- 최종 TXT 로그: `/Users/ganggyunggyu/Programing/blog-cron-bot/logs/detailed-alibaba-신규작업_2026-06-30-10-24-39.txt`
- 기본 실행 CSV: `/Users/ganggyunggyu/Programing/blog-cron-bot/output/2026-06월5주차/alibaba-신규작업/alibaba-신규작업_2026-06-30-10-06-32.csv`

## 최종 노출 키워드

| 행 | 키워드 | 블로그ID | 순위 | 주제 | 링크 |
|---:|---|---|---:|---|---|
| 10 | 해외구매대행사이트 | individual14144 | 3 | 인기글 | https://blog.naver.com/individual14144/224248664441 |
| 51 | 광저우박람회 | i_thinkkkk | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/i_thinkkkk/224324284910 |
| 60 | 상해박람회 | heavymouse448 | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/heavymouse448/224307754470 |
| 121 | 중국직구 | i_thinkkkk | 1 | 인기글 | https://blog.naver.com/i_thinkkkk/224323146200 |
| 148 | 구매대행수수료 | weed3122 | 4 | 인기글 | https://blog.naver.com/weed3122/224251093764 |
| 161 | B2B구매대행 | weed3122 | 1 | 인기글 | https://blog.naver.com/weed3122/224248653222 |
| 212 | 1688구매방법비용 | mad1651 | 2 | 인기글 | https://blog.naver.com/mad1651/224251089796 |
| 280 | 알리바바닷컴결제하는법 | chemical12568 | 3 | 인기글 | https://blog.naver.com/chemical12568/224248660216 |
| 281 | 알리바바닷컴공장거래 | mad1651 | 1 | 인기글 | https://blog.naver.com/mad1651/224251085886 |
| 282 | 알리바바닷컴구매대행비용 | chemical12568 | 2 | 인기글 | https://blog.naver.com/chemical12568/224248658539 |
| 304 | 중국소싱추천 | weed3122 | 2 | 인기글 | https://blog.naver.com/weed3122/224248654461 |
| 357 | 사업박람회 | copy11525 | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/copy11525/224255897791 |
| 378 | 1688직구방법 | mad1651 | 6 | 인기글 | https://blog.naver.com/mad1651/224251085886 |

## 남은 리스크

- 네이버 인기글 결과가 시간/세션/요청 조건에 따라 크게 흔들리는 상태임.
- 6/29 대비 대량 감소는 운영상 이상 신호로 보고, 재확인 시에는 같은 저부하 모드와 샘플 인기글 덤프를 함께 비교하는 것이 안전함.
