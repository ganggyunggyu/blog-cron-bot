---
description: 원격 대시보드로 7개 시트를 서로 다른 외부 IP에서 병렬 노출체크하고 시트반영·두레이까지 확인
argument-hint: [대상목록] [--max-pages N] (예: 없음=7개 전체, "package root", --max-pages 4)
---

# 원격 병렬 노출체크

프로덕션 대시보드(Railway)에 `exposure-suite` 잡을 걸어 **7개 시트를 각각 다른 원격 워커·외부 IP로 병렬** 노출체크한다. 로컬에서 크롤링하지 않으므로 이 맥의 IP가 차단될 일이 없고, 완료 후 시트 반영과 Dooray 전송까지 서버가 알아서 처리한다.

로컬 실행 스킬(`parallel-check`, `exposure-check`)과 혼동하지 말 것. 저건 이 맥에서 단일 IP로 도는 방식이다.

## 기본 정보

- 레포 루트: `/Users/ganggyunggyu/Programing/blog-cron-bot`
- 대시보드: `https://blog-cron-bot-production.up.railway.app`
- 비밀번호: 레포 루트 `.env`의 `DASHBOARD_PASSWORD` (파일/응답에 값을 그대로 노출하지 않음)

## 대상 매핑

| 표시 이름 | target id |
|---|---|
| 패키지 | `package` |
| 일반건 | `general` |
| 도그마루 | `dogmaru` |
| 루트 | `root` |
| 애견 | `pet` |
| 서리펫 | `suripet` |
| 카페 + 블로그 | `cafe` |

- 기본은 7개 전체.
- **`--max-pages` 기본값은 9** (애견 1~9페이지 기준). 애견·서리펫에만 적용되고 나머지는 1페이지.
- `$ARGUMENTS`에 대상 이름/ID가 있으면 그것만 실행한다.

## 실행 절차

1. `.env`에서 `DASHBOARD_PASSWORD`를 읽어 로그인하고 쿠키를 보관한다.
   ```bash
   COOKIE=<스크래치패드>/remote-check-cookies.txt
   PW=$(grep -E '^DASHBOARD_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"')
   curl -s -c "$COOKIE" -X POST "$BASE/api/auth/login" \
     -H 'Content-Type: application/json' \
     --data "$(python3 -c 'import json,os;print(json.dumps({"password":os.environ["PW"]}))')" \
     -o /dev/null -w 'login:%{http_code}\n'
   ```
2. **실행 전 충돌 확인** — `GET /api/jobs`로 이미 도는 잡이 있으면 실행하지 않고 그 사실을 먼저 보고한다. 동시에 두 번 돌리면 뒤엣것이 잠금 충돌로 실패한다.
3. 잡을 트리거한다.
   ```bash
   curl -s -b "$COOKIE" -X POST "$BASE/api/jobs/exposure-suite/run" \
     -H 'Content-Type: application/json' \
     -d '{"targets":["package","general","dogmaru","root","pet","suripet","cafe"],"maxPages":9}'
   ```
   응답의 `runId`를 보관한다.
4. 완료까지 추적한다. 크롤링만 수 분~수십 분 걸리므로 **백그라운드(`run_in_background: true`)로 폴링**하고, 10초 간격으로 `GET /api/runs`에서 해당 `runId`의 `status`가 `running`이 아닐 때까지 기다린다.
5. 완료되면 로그를 받아 결과를 확인한다.
   ```bash
   curl -s -b "$COOKIE" "$BASE/api/runs/<runId>/stream" --max-time 30
   ```
   아래 문자열을 근거로 대상별 상태를 판정한다.
   - 성공 근거: `Dooray 전송 완료: <대상>`, `... 반영 및 재조회 완료: N행`, `분산 루트 시트 반영 결과: N건`
   - 실패 근거: `마무리 실패`, `일부 대상 마무리 실패`, `원본 순서 매칭 실패`, `종료 코드 1`
   - 외부 IP 분리 근거: `[다중워커] 외부 IP 분리 확인: ...`

## 판정 규칙

- **로그에 실제로 찍힌 문자열만 근거로 삼는다.** 결과를 추측해서 쓰지 않는다.
- 한 대상이 실패해도 나머지는 계속 진행되므로, 대상별로 따로 판정한다.
- 전체 상태가 `failed`여도 이미 두레이가 나간 대상은 성공으로 적고, 무엇이 남았는지 분리해서 적는다.
- 실행 자체가 트리거되지 않았으면(이미 실행 중 등) 그 사실만 보고하고 성공/실패를 지어내지 않는다.

## 결과 보고

```text
[remote-check 보고]
- 실행 시각(KST): <YYYY-MM-DD HH:mm:ss>
- runId: <id>
- 전체 상태: <success/failed/stopped>  소요: <n분 n초>
- 외부 IP 분리: <n개 워커 / 중복 여부>

| 대상 | 결과 | 시트 반영 | 두레이 | 비고 |
|---|---|---|---|---|
| 패키지 | | | | |
| 일반건 | | | | |
| 도그마루 | | | | |
| 루트 | | | | |
| 애견 | | | | |
| 서리펫 | | | | |
| 카페+블로그 | | | | |

- 실패 원인: <에러 문자열 그대로>
- 후속 조치: <필요한 것만>
```
