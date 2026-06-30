# 알리바바 노출체크 결과 - 2026-06-30

## 결과

- 실행 명령: `pnpm alibaba:check`
- 실행 시간: 2026-06-30 09:40:35 - 10:06:33 KST
- 대상 탭: 알리바바 (`gid=914645152`)
- 처리 대상: 신규작업 351개
- 전체 키워드 행: 474개
- 중복 키워드 행: 123개
- 노출: 16개
- 미노출: 335개
- 인기글: 16개
- 스블: 0개
- 신규로직: 12개
- 구로직: 4개
- 소요 시간: 25분 57초
- 시트 반영: 완료
- Dooray 알림: 전송 완료

## 검증

- CSV 행수: 헤더 제외 16행
- 상세 JSON: 351개 기록, `success=true` 16개
- 시트 readback: 노출 `o` 16행, 링크 16행
- 시트 readback 범위: 알리바바 탭 마지막 키워드 행 475행

## 산출물

- CSV: `/Users/ganggyunggyu/Programing/blog-cron-bot/output/2026-06월5주차/alibaba-신규작업/alibaba-신규작업_2026-06-30-10-06-32.csv`
- JSON 로그: `/Users/ganggyunggyu/Programing/blog-cron-bot/logs/detailed-alibaba-신규작업_2026-06-30-10-06-32.json`
- TXT 로그: `/Users/ganggyunggyu/Programing/blog-cron-bot/logs/detailed-alibaba-신규작업_2026-06-30-10-06-32.txt`

## 노출 키워드

| 행 | 키워드 | 순위 | 주제 | 링크 |
|---:|---|---:|---|---|
| 10 | 해외구매대행사이트 | 3 | 인기글 | https://blog.naver.com/individual14144/224248664441 |
| 51 | 광저우박람회 | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/i_thinkkkk/224324284910 |
| 60 | 상해박람회 | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/heavymouse448/224307754470 |
| 121 | 중국직구 | 1 | 인기글 | https://blog.naver.com/i_thinkkkk/224323146200 |
| 148 | 구매대행수수료 | 4 | 인기글 | https://blog.naver.com/weed3122/224251093764 |
| 149 | 1688결제하는법 | 8 | 인기글 | https://blog.naver.com/weed3122/224251090056 |
| 152 | 1688도매상품 | 1 | 인기글 | https://blog.naver.com/mad1651/224251093716 |
| 161 | B2B구매대행 | 1 | 인기글 | https://blog.naver.com/weed3122/224248653222 |
| 212 | 1688구매방법비용 | 2 | 인기글 | https://blog.naver.com/mad1651/224251089796 |
| 280 | 알리바바닷컴결제하는법 | 3 | 인기글 | https://blog.naver.com/chemical12568/224248660216 |
| 281 | 알리바바닷컴공장거래 | 1 | 인기글 | https://blog.naver.com/mad1651/224251085886 |
| 282 | 알리바바닷컴구매대행비용 | 2 | 인기글 | https://blog.naver.com/chemical12568/224248658539 |
| 304 | 중국소싱추천 | 1 | 인기글 | https://blog.naver.com/weed3122/224248654461 |
| 305 | 중국소싱후기 | 6 | 인기글 | https://blog.naver.com/weed3122/224248654461 |
| 357 | 사업박람회 | 1 | 비즈니스·경제 인기글 | https://blog.naver.com/copy11525/224255897791 |
| 378 | 1688직구방법 | 6 | 인기글 | https://blog.naver.com/mad1651/224251085886 |

## 남은 리스크

- 실행 중 `HTTP 403`과 `NGHTTP2_REFUSED_STREAM` 재시도가 있었지만 내장 백오프로 회복했고 최종 저장까지 완료됨.
- 네이버 검색 결과는 시간에 따라 변동될 수 있음.
