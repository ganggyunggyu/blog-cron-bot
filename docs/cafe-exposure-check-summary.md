# 네이버 카페 노출체크 정리

- 실행 시각: 2026. 3. 18. 18시 12분 57초
- 기준: 네이버 통합검색 1페이지 카페 카드 기준
- 입력 파일: docs/cafe-exposure-keywords-2026-03-18.txt
- 원본 키워드 수: 45개
- 중복 제거 수: 0개
- 실제 조회 키워드 수: 45개
- 노출 키워드 수: 20개
- 확인 실패 키워드 수: 0개
- 결과 CSV: /Users/ganggyunggyu/Programing/blog-cron-bot/output/2026-03월3주차/cafe-exposure-check/cafe-exposure-check_2026-03-18-18-12-57.csv

## 카페명 체크 검토
- 쇼핑지름신: 이름 매칭 15건, ID 매칭 0건, 확인된 카페명 쇼핑지름신 (구매대행, 공동구매, 해외직구, 체험단, 핫딜), 확인된 sourceId shopjirmsin
- 샤넬오픈런: 이름 매칭 8건, ID 매칭 0건, 확인된 카페명 샤넬오픈런 - No. 1 명품 대표 커뮤니티, 확인된 sourceId shoppingtpw
- 건강한노후준비: 이름 매칭 1건, ID 매칭 0건, 확인된 카페명 건강한노후준비, 확인된 sourceId freemapleafreecabj
- 건강관리소: 이번 실행에서는 이름 기준 매칭 결과를 확인하지 못함. sourceId도 확인하지 못함.

## 메모
- 현재 도구는 카페명과 카페 URL 식별자(sourceId)를 둘 다 쓸 수 있게 구성됨.
- 이번 실행은 사용자가 준 카페명 4개를 기준으로 먼저 매칭했고, 검색 결과에서 확인된 sourceId를 함께 기록함.