# Ubuntu EC2 배포 가이드 (blog-cron-bot)

이 프로젝트는 TypeScript(Node.js)로 작성된 크롤링/노출체크 봇입니다.

- 1회 실행(노출 체크만): `dist/index.js` 실행
- 풀 워크플로우(시간 감지 + 시트 동기화 + 노출 체크 + 시트 반영): `dist/pm2-scheduler.js`를 상시 실행(pm2 권장)

---

## 0) EC2 접속

로컬(내 PC)에서:

```bash
ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 1) 기본 패키지 설치

```bash
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates build-essential
```

타임존(권장):

```bash
sudo timedatectl set-timezone Asia/Seoul
timedatectl | grep -E "Time zone|Local time" || true
```

---

## 2) Node.js 20 설치

NodeSource(권장):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v
npm -v
```

---

## 3) 프로젝트 받기

```bash
cd ~
git clone <REPO_URL> blog-cron-bot
cd blog-cron-bot
```

---

## 4) 환경변수(.env) 세팅

`blog-cron-bot/.env` 생성:

```bash
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority

# 풀 워크플로우(cron.ts/cron-root.ts)에서 Sheet App API 호출에 사용
# 예: https://sheet-app.example.com
SHEET_APP_URL=http://127.0.0.1:3000

# (선택) 필터
# ONLY_SHEET_TYPE=package
# ONLY_COMPANY=회사명
# ONLY_KEYWORD_REGEX=정규식
# ONLY_ID=Mongo ObjectId 문자열
# START_INDEX=0

# (선택) 매칭 완화(모든 블로그 허용)
# ALLOW_ANY_BLOG=true

# (선택) cron.ts 테스트 스케줄(분)
# TEST_DELAY_MINUTES=1

# (선택) 스케줄(여러 번/일 가능) - HH:mm 콤마 구분
# 기본 키워드(Keyword): `pnpm scheduler` / pm2 keywords 프로세스
# WORKFLOW_RUN_TIMES=09:10,13:10,17:10
#
# 루트 키워드(RootKeyword): `pnpm scheduler:root` / pm2 root 프로세스
# ROOT_RUN_TIMES=09:20,13:20,17:20

# (선택) 스케줄러 상태 파일(중복 실행 방지용)
# SCHEDULER_STATE_PATH=/home/ubuntu/blog-cron-bot/.scheduler-state.json
# ROOT_SCHEDULER_STATE_PATH=/home/ubuntu/blog-cron-bot/.scheduler-state.root.json

# (선택) 스케줄러 체크 주기(ms)
# SCHEDULER_TICK_INTERVAL_MS=15000
EOF
```

MongoDB Atlas 사용 시:
- Atlas Network Access(IP 허용)에 EC2 공인 IP를 추가해야 합니다.
- Security Group outbound(기본 허용) 막혀있으면 MongoDB/Naver 접근이 안 됩니다.

---

## 5) 의존성 설치 및 빌드

이 프로젝트는 `dist/`를 만들기 위해 TypeScript 빌드가 필요합니다.

```bash
sudo npm i -g pnpm
pnpm -v

pnpm install --frozen-lockfile
pnpm build
```

---

## 6) 실행 방법

### A. 1회 실행(노출 체크만)

```bash
cd ~/blog-cron-bot
node dist/index.js
```

### B. 풀 워크플로우(시트 동기화 포함, 상시 실행)

`dist/pm2-scheduler.js`는 KST 기준 시간을 감지해서 지정 시각에 워크플로우를 실행합니다.
- 기본 시간: `src/constants/scheduler/index.ts`의 `WORKFLOW_RUN_TIME_LIST`
- 운영에서 변경: `.env`의 `WORKFLOW_RUN_TIMES=HH:mm,HH:mm,...`

#### pm2로 상시 실행(권장)

1) pm2 설치

```bash
sudo npm i -g pm2
pm2 -v
```

2) 실행(레포에 포함된 ecosystem 사용)

```bash
cd ~/blog-cron-bot
pm2 start ecosystem.config.cjs --env production
pm2 status
```

3) 로그 보기

```bash
pm2 logs blog-cron-bot-keywords
pm2 logs blog-cron-bot-root
```

4) 재부팅 자동 시작

```bash
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# 출력되는 sudo 명령어 1줄을 그대로 실행
```

#### systemd로 상시 실행(대안)

pm2 없이 운영하고 싶으면 systemd로 `dist/cron.js`를 올려도 됩니다.

```bash
sudo tee /etc/systemd/system/blog-cron-bot.service > /dev/null << 'EOF'
[Unit]
Description=blog-cron-bot scheduler
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/blog-cron-bot
EnvironmentFile=/home/ubuntu/blog-cron-bot/.env
ExecStart=/usr/bin/node /home/ubuntu/blog-cron-bot/dist/pm2-scheduler.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blog-cron-bot.service
sudo systemctl status blog-cron-bot.service --no-pager
journalctl -u blog-cron-bot.service -f
```

---

## 7) (선택) OS 크론으로 1회 실행 스케줄링

`dist/index.js`는 실행 후 종료되므로 OS 크론에 올리기 쉽습니다.

```bash
crontab -e
```

예시(매일 09:05 KST):

```cron
5 9 * * * cd /home/ubuntu/blog-cron-bot && /usr/bin/node dist/index.js >> /home/ubuntu/blog-cron-bot/vendor-cron.log 2>&1
```
