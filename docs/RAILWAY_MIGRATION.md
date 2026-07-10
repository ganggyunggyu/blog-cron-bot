# EC2 → Railway 이전 런북

이 문서는 사용자가 직접 실행하는 절차임 (Railway 계정/크리덴셜이 필요해서 에이전트가 대신 실행 못 함).

## 사전 준비

- Railway 계정 (railway.app)
- 로컬에 [Railway CLI](https://docs.railway.com/guides/cli) 설치: `npm i -g @railway/cli` (선택 — 대시보드 UI로만 진행해도 됨)
- 지금 EC2/로컬 `.env` 파일 내용 (통째로 붙여넣을 예정)

## 1. Railway 프로젝트 생성

1. railway.app에서 새 프로젝트 생성 → "Deploy from GitHub repo" (또는 로컬에서 CLI로 배포할 거면 빈 프로젝트로 시작)
2. 서비스 하나만 생성 (이 레포는 봇 3개 스케줄러 + 대시보드가 **하나의 서비스**로 합쳐져서 돎 — `docs/../AGENTS.md`의 "DASHBOARD (제어판)" 섹션 참고)
3. Service Settings → Build → Builder가 `Dockerfile`로 잡히는지 확인 (레포 루트에 `Dockerfile`이 있어서 자동 감지됨. 안 잡히면 `railway.toml`에 이미 `builder = "DOCKERFILE"`로 명시돼있음)

## 2. 볼륨 생성

1. 서비스 → Volumes 탭 → 새 볼륨 생성, 마운트 경로 **`/data`**
2. 5GB(Hobby 플랜 기준)면 충분함 — CSV/로그가 계속 쌓이니 주기적으로 정리 권장

## 3. 환경변수 설정

Service → Variables 탭 → **Raw Editor**에 기존 `.env` 파일 내용을 통째로 붙여넣기.

그 다음 아래 5개를 **추가로** 설정 (볼륨 경로로 리다이렉트하는 용도, 코드에 이미 지원돼있음):

```
OUTPUT_ROOT_DIR=/data/output
LOGS_DIR=/data/logs
SCHEDULER_STATE_PATH=/data/.scheduler-state.json
ROOT_SCHEDULER_STATE_PATH=/data/.scheduler-state.root.json
ALL_SHEETS_SCHEDULER_STATE_PATH=/data/.scheduler-state.all-sheets.json
```

대시보드 인증도 추가:

```
DASHBOARD_PASSWORD=<새로 정할 비밀번호>
DASHBOARD_SESSION_SECRET=<openssl rand -hex 32 같은 걸로 생성한 긴 랜덤 문자열>
```

**주의**: `PORT`는 Railway가 자동으로 주입하니 직접 설정하지 않는다. `ecosystem.railway.config.cjs`가 이 값을 읽어서 대시보드 포트로 씀.

## 4. 배포

**GitHub 연동으로 했다면**: 이 브랜치를 push하면 자동 빌드/배포됨.

**CLI로 직접 배포하려면**:
```bash
railway login          # 브라우저 인증 (SSH 등 화면 없는 환경이면 --browserless)
railway link           # 방금 만든 프로젝트에 연결
railway up              # 로컬 레포를 그대로 업로드해서 빌드/배포
```

빌드 로그에서 `pnpm build`(tsc), `pnpm --dir dashboard build`(next build)가 에러 없이 끝나는지 확인. **이 Dockerfile은 로컬에 Docker가 없어서 사전에 `docker build`로 검증하지 못한 상태** — 여기 빌드 로그가 첫 실검증임. Docker 쓸 수 있는 환경이 있으면 미리 `docker build -t blog-cron-bot .`로 로컬 검증해보는 걸 추천함.

## 5. 배포 후 체크리스트 (전부 통과해야 다음 단계로)

- [ ] 대시보드 공개 URL 접속 → 로그인 페이지 뜸 → `DASHBOARD_PASSWORD`로 로그인 성공
- [ ] PM2 데몬 상태 패널에서 `blog-cron-bot-keywords` / `blog-cron-bot-root` / `blog-cron-bot-all-sheets` 3개 다 **online** 표시
- [ ] 잡 실행 패널에서 `cafe:check`처럼 저위험 잡 하나 실행 → 실시간 로그가 스트리밍되고, 네이버 응답이 정상(차단/캡차 아님)인지 로그로 확인 — **Railway의 새 IP가 네이버한테 차단당하는지 여기서 처음 검증됨**, 문제 있으면 EC2 해지를 미루고 원인 파악
- [ ] 결과 파일 패널에 방금 실행한 잡의 output이 뜨는지 (볼륨 마운트 정상 확인)
- [ ] 하루 지나서 스케줄 현황 패널의 "마지막 실행일"이 실제로 갱신되는지 (내부 스케줄러가 정상 동작하는지)

## 6. EC2 종료

**위 체크리스트를 전부 통과하고 최소 하루~며칠 정도 안정적으로 도는 걸 확인한 뒤에만** EC2 인스턴스를 종료한다. 되돌리기 어려운 작업이라 서두르지 않는다.

EC2 해지 후에는 레포에서 `ecosystem.config.cjs`, `ecosystem.jobs.cjs`(EC2 전용)를 지우고 `ecosystem.railway.config.cjs`만 남겨도 됨.
