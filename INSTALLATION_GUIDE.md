# 네이버 검색 노출 크론 봇 - 완전 초보자 가이드

> 아무것도 모르는 분도 따라 할 수 있는 상세한 설치 및 실행 가이드입니다.

## 목차

1. [시작하기 전에](#시작하기-전에)
2. [Mac 사용자를 위한 가이드](#mac-사용자를-위한-가이드)
3. [Windows 사용자를 위한 가이드](#windows-사용자를-위한-가이드)
4. [프로젝트 설치 및 실행](#프로젝트-설치-및-실행)
5. [문제 해결](#문제-해결)

---

## 시작하기 전에

### 이 프로그램이 하는 일

이 프로그램은 네이버 검색 결과에서 특정 블로그가 노출되는지 자동으로 확인해주는 봇입니다.
- 매일 자동으로 실행 가능
- 키워드별 노출 여부 체크
- 결과를 데이터베이스에 저장

### 필요한 것들

1. **컴퓨터** (Mac 또는 Windows)
2. **인터넷 연결**
3. **약 30분의 시간**
4. **MongoDB 계정** (무료, 가입 방법 아래 설명)

---

## Mac 사용자를 위한 가이드

### 1단계: Homebrew 설치

Homebrew는 Mac에서 프로그램을 쉽게 설치할 수 있게 해주는 도구입니다.

1. **터미널 열기**
   - `Command(⌘) + Space` 누르기
   - "터미널" 또는 "Terminal" 입력
   - Enter 키 누르기

2. **Homebrew 설치 명령어 입력**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   - 터미널에 위 명령어 복사 후 붙여넣기
   - Enter 키 누르기
   - 비밀번호 입력 (화면에 보이지 않아도 정상입니다)

3. **설치 확인**
   ```bash
   brew --version
   ```
   - 버전 정보가 나오면 성공!

### 2단계: Node.js 설치

Node.js는 JavaScript를 실행할 수 있게 해주는 프로그램입니다.

1. **Node.js 설치**
   ```bash
   brew install node
   ```

2. **설치 확인**
   ```bash
   node --version
   npm --version
   ```
   - 두 명령어 모두 버전 정보가 나오면 성공!
   - 예: `v20.11.0`, `10.2.4`

### 3단계: pnpm 설치

pnpm은 프로젝트의 필요한 패키지들을 설치하는 도구입니다.

1. **pnpm 설치**
   ```bash
   npm install -g pnpm
   ```

2. **설치 확인**
   ```bash
   pnpm --version
   ```
   - 버전 정보가 나오면 성공!

### 4단계: Git 설치 (선택사항)

Git은 프로젝트를 다운로드하는 데 사용됩니다.

1. **Git 설치 (Homebrew 사용)**
   ```bash
   brew install git
   ```

2. **설치 확인**
   ```bash
   git --version
   ```

**또는** Git 없이 프로젝트 다운로드:
- GitHub에서 ZIP 파일로 다운로드 가능 (아래에서 설명)

### 5단계: MongoDB Atlas 가입 (무료)

MongoDB는 데이터를 저장하는 데이터베이스입니다. 무료로 클라우드에서 사용할 수 있습니다.

1. **MongoDB Atlas 웹사이트 방문**
   - 브라우저에서 https://www.mongodb.com/cloud/atlas/register 접속

2. **회원가입**
   - 이메일, 비밀번호 입력
   - "Create your Atlas account" 클릭

3. **무료 플랜 선택**
   - "Shared" (무료) 선택
   - 클라우드 제공자: AWS 선택
   - 지역: Seoul (ap-northeast-2) 권장
   - "Create Cluster" 클릭

4. **데이터베이스 사용자 생성**
   - Username 입력 (예: `myuser`)
   - Password 입력 (예: `mypassword123`) - **꼭 기억하세요!**
   - "Create User" 클릭

5. **IP 주소 허용**
   - "Add My Current IP Address" 클릭
   - 또는 "Allow Access from Anywhere" 선택 (0.0.0.0/0)
   - "Add Entry" 클릭

6. **연결 문자열 복사**
   - 클러스터 화면에서 "Connect" 버튼 클릭
   - "Connect your application" 선택
   - Driver: Node.js 선택
   - 연결 문자열 복사 (예: `mongodb+srv://myuser:<password>@cluster0.xxxxx.mongodb.net/`)
   - `<password>` 부분을 실제 비밀번호로 바꾸기
   - **이 문자열을 메모장에 저장해두세요!**

---

## Windows 사용자를 위한 가이드

### 1단계: Node.js 설치

1. **Node.js 다운로드**
   - 브라우저에서 https://nodejs.org 접속
   - "LTS" 버전 다운로드 (예: 20.11.0 LTS)
   - 다운로드한 `.msi` 파일 실행

2. **설치 진행**
   - "Next" 계속 클릭
   - 모든 기본 설정 그대로 유지
   - "Install" 클릭
   - 설치 완료 후 "Finish" 클릭

3. **설치 확인**
   - `Windows 키` 누르기
   - "cmd" 또는 "명령 프롬프트" 입력
   - Enter 키 눌러서 명령 프롬프트 열기
   - 아래 명령어 입력:
   ```cmd
   node --version
   npm --version
   ```
   - 두 명령어 모두 버전 정보가 나오면 성공!

### 2단계: pnpm 설치

1. **명령 프롬프트 열기** (관리자 권한)
   - `Windows 키` 누르기
   - "cmd" 입력
   - `Ctrl + Shift + Enter` (관리자 권한으로 실행)

2. **pnpm 설치**
   ```cmd
   npm install -g pnpm
   ```

3. **설치 확인**
   ```cmd
   pnpm --version
   ```

### 3단계: Git 설치 (선택사항)

1. **Git 다운로드**
   - 브라우저에서 https://git-scm.com/download/win 접속
   - "64-bit Git for Windows Setup" 다운로드
   - 다운로드한 `.exe` 파일 실행

2. **설치 진행**
   - "Next" 계속 클릭
   - 모든 기본 설정 그대로 유지
   - "Install" 클릭
   - 설치 완료 후 "Finish" 클릭

3. **설치 확인**
   - 새로운 명령 프롬프트 창 열기
   ```cmd
   git --version
   ```

**또는** Git 없이 프로젝트 다운로드:
- GitHub에서 ZIP 파일로 다운로드 가능 (아래에서 설명)

### 4단계: MongoDB Atlas 가입 (무료)

> Mac 사용자와 동일합니다. [위의 Mac 5단계](#5단계-mongodb-atlas-가입-무료)를 참고하세요.

---

## 프로젝트 설치 및 실행

이제 실제 프로젝트를 설치하고 실행해봅시다!

### 방법 1: Git으로 프로젝트 다운로드 (Git 설치한 경우)

#### Mac

1. **터미널 열기**

2. **원하는 폴더로 이동**
   ```bash
   cd ~/Desktop
   ```
   - 바탕화면에 프로젝트를 다운로드하려면 위 명령어 사용
   - 또는 원하는 경로로 변경 (예: `cd ~/Documents`)

3. **프로젝트 클론**
   ```bash
   git clone https://github.com/yourusername/blog-cron-bot.git
   ```
   - `yourusername`을 실제 GitHub 사용자명으로 변경

4. **프로젝트 폴더로 이동**
   ```bash
   cd blog-cron-bot
   ```

#### Windows

1. **명령 프롬프트 열기**

2. **원하는 폴더로 이동**
   ```cmd
   cd C:\Users\내사용자명\Desktop
   ```
   - `내사용자명`을 실제 Windows 사용자명으로 변경

3. **프로젝트 클론**
   ```cmd
   git clone https://github.com/yourusername/blog-cron-bot.git
   ```

4. **프로젝트 폴더로 이동**
   ```cmd
   cd blog-cron-bot
   ```

### 방법 2: ZIP 파일로 프로젝트 다운로드 (Git 없는 경우)

1. **GitHub에서 다운로드**
   - 브라우저에서 프로젝트 GitHub 페이지 접속
   - 녹색 "Code" 버튼 클릭
   - "Download ZIP" 클릭

2. **압축 해제**
   - 다운로드한 ZIP 파일을 원하는 위치에 압축 해제
   - Mac: 파일 더블클릭
   - Windows: 우클릭 → "압축 풀기"

3. **터미널/명령 프롬프트에서 폴더로 이동**

   **Mac:**
   ```bash
   cd ~/Downloads/blog-cron-bot-main
   ```

   **Windows:**
   ```cmd
   cd C:\Users\내사용자명\Downloads\blog-cron-bot-main
   ```

### 의존성 설치

프로젝트에 필요한 패키지들을 설치합니다.

**Mac/Windows 공통:**

```bash
pnpm install
```

- 1~2분 정도 걸립니다
- 여러 패키지가 설치되는 로그가 나타나면 정상입니다

### 환경 변수 설정 (.env 파일 생성)

프로젝트 설정을 위한 파일을 만듭니다.

#### Mac

1. **텍스트 편집기로 .env 파일 생성**
   ```bash
   nano .env
   ```

2. **아래 내용 입력**
   ```
   MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.xxxxx.mongodb.net/naver-bot?retryWrites=true&w=majority
   ```
   - MongoDB Atlas에서 복사한 연결 문자열로 변경
   - `<password>` 부분을 실제 비밀번호로 변경
   - 데이터베이스 이름 `naver-bot` 추가

3. **저장하고 나가기**
   - `Ctrl + O` (저장)
   - Enter
   - `Ctrl + X` (종료)

**또는 VS Code 사용:**
```bash
code .env
```
- VS Code가 설치되어 있다면 사용 가능
- 내용 입력 후 `Command + S`로 저장

#### Windows

1. **메모장으로 .env 파일 생성**
   ```cmd
   notepad .env
   ```
   - "새 파일을 만드시겠습니까?" 나오면 "예" 클릭

2. **아래 내용 입력**
   ```
   MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.xxxxx.mongodb.net/naver-bot?retryWrites=true&w=majority
   ```
   - MongoDB Atlas에서 복사한 연결 문자열로 변경
   - `<password>` 부분을 실제 비밀번호로 변경

3. **저장**
   - "파일" → "저장"
   - 메모장 닫기

### MongoDB 데이터 준비

처음 실행하기 전에 키워드 데이터를 준비해야 합니다.

#### 옵션 1: MongoDB Compass 사용 (GUI)

1. **MongoDB Compass 다운로드**
   - https://www.mongodb.com/try/download/compass
   - 설치 후 실행

2. **연결**
   - 연결 문자열 붙여넣기
   - "Connect" 클릭

3. **데이터베이스 생성**
   - 좌측 "+" 버튼 클릭
   - Database Name: `naver-bot`
   - Collection Name: `keywords`
   - "Create Database" 클릭

4. **샘플 데이터 추가**
   - `keywords` 컬렉션 클릭
   - "Insert Document" 클릭
   - 아래 내용 입력:
   ```json
   {
     "company": "테스트회사",
     "keyword": "스마일라식",
     "visibility": false,
     "popularTopic": "",
     "url": "",
     "sheetType": "package"
   }
   ```
   - "Insert" 클릭

#### 옵션 2: 코드로 데이터 추가

프로젝트에 테스트 스크립트가 있다면 사용 가능합니다.

### 프로젝트 실행

모든 준비가 끝났습니다! 이제 실행해봅시다.

#### 개발 모드 실행 (테스트용)

**Mac/Windows 공통:**

```bash
pnpm dev
```

- 프로그램이 실행되며 로그가 출력됩니다
- 키워드별 검색 결과가 나타납니다
- 예:
  ```
  검색어 1개 처리 예정
  [1/1] 스마일라식 ✅
  총 검색어: 1개
  총 노출 발견: 1개
  ```

#### 프로덕션 모드 실행 (실제 사용)

1. **빌드**
   ```bash
   pnpm build
   ```

2. **실행**
   ```bash
   pnpm start
   ```

### 자동 실행 설정 (크론잡)

매일 자동으로 실행되게 설정할 수 있습니다.

#### Mac

1. **crontab 편집**
   ```bash
   crontab -e
   ```
   - 처음 실행 시 편집기 선택 (nano 추천: `1` 입력)

2. **크론 작업 추가**
   ```
   0 9 * * * cd /Users/내사용자명/Desktop/blog-cron-bot && /usr/local/bin/pnpm start >> /Users/내사용자명/Desktop/blog-cron-bot/cron.log 2>&1
   ```
   - 매일 오전 9시 실행
   - `/Users/내사용자명/Desktop/blog-cron-bot`를 실제 프로젝트 경로로 변경

3. **pnpm 경로 확인**
   ```bash
   which pnpm
   ```
   - 출력된 경로를 크론 작업의 pnpm 경로에 사용

4. **저장**
   - `Ctrl + O`, Enter, `Ctrl + X`

5. **크론 작업 확인**
   ```bash
   crontab -l
   ```

#### Windows (작업 스케줄러 사용)

1. **작업 스케줄러 열기**
   - `Windows 키` 누르기
   - "작업 스케줄러" 입력 후 Enter

2. **새 작업 만들기**
   - 우측 "작업 만들기" 클릭

3. **일반 탭**
   - 이름: `네이버 크론 봇`
   - 설명: `매일 오전 9시 실행`

4. **트리거 탭**
   - "새로 만들기" 클릭
   - "매일" 선택
   - 시작 시간: 오전 9:00
   - "확인" 클릭

5. **동작 탭**
   - "새로 만들기" 클릭
   - 프로그램/스크립트: `C:\Program Files\nodejs\pnpm.cmd`
   - 인수 추가: `start`
   - 시작 위치: `C:\Users\내사용자명\Desktop\blog-cron-bot`
   - "확인" 클릭

6. **조건 탭**
   - "컴퓨터가 AC 전원을 사용할 경우에만 작업 시작" 체크 해제

7. **확인** 클릭

---

## 문제 해결

### 자주 발생하는 오류

#### 1. `command not found: node` 또는 `'node'은(는) 내부 또는 외부 명령이 아닙니다`

**원인**: Node.js가 설치되지 않았거나 PATH에 추가되지 않음

**해결 (Mac):**
```bash
brew install node
```

**해결 (Windows):**
- Node.js 재설치
- 설치 시 "Add to PATH" 옵션 확인

#### 2. `command not found: pnpm`

**원인**: pnpm이 설치되지 않았거나 PATH에 추가되지 않음

**해결:**
```bash
npm install -g pnpm
```

#### 3. `MongooseError: The uri parameter to openUri() must be a string`

**원인**: `.env` 파일이 없거나 `MONGODB_URI`가 잘못됨

**해결:**
1. `.env` 파일 존재 확인
2. `MONGODB_URI` 값 확인
3. 연결 문자열에 비밀번호가 올바른지 확인

#### 4. `MongoNetworkError: failed to connect`

**원인**:
- 인터넷 연결 문제
- MongoDB Atlas IP 화이트리스트 설정 문제
- 잘못된 연결 문자열

**해결:**
1. 인터넷 연결 확인
2. MongoDB Atlas에서 "Network Access" 확인
   - "0.0.0.0/0" (모든 IP 허용) 추가
3. 연결 문자열 재확인

#### 5. `Error: ENOENT: no such file or directory`

**원인**: 프로젝트 폴더 경로가 잘못됨

**해결:**
```bash
# 현재 위치 확인
pwd  # Mac
cd   # Windows

# 올바른 폴더로 이동
cd /path/to/blog-cron-bot
```

#### 6. `permission denied` (Mac)

**원인**: 파일 실행 권한 문제

**해결:**
```bash
chmod +x node_modules/.bin/*
```

#### 7. 크롤링 실패 (네이버 차단)

**증상**: 모든 키워드에서 `❌` 표시

**원인**:
- 너무 빠른 요청으로 네이버 차단
- IP 차단

**해결:**
1. `src/constants.ts`에서 딜레이 시간 증가
2. 30분~1시간 대기 후 재시도
3. VPN 사용 고려

#### 8. 파싱 실패

**증상**: 크롤링은 되지만 결과가 없음

**원인**: 네이버 HTML 구조 변경

**해결:**
1. `src/selector-analyzer.ts` 실행
   ```bash
   pnpm tsx src/selector-analyzer.ts
   ```
2. 출력된 셀렉터를 `src/parser.ts`에 업데이트

### 도움이 필요하신가요?

#### 로그 확인

**실행 로그 보기:**
```bash
# Mac/Windows
tail -f cron.log  # 크론 로그가 있는 경우
```

**데이터베이스 확인:**
- MongoDB Compass로 직접 확인
- 또는 프로젝트의 테스트 스크립트 실행
  ```bash
  pnpm tsx src/test.ts
  ```

#### 추가 도움

- GitHub Issues: https://github.com/yourusername/blog-cron-bot/issues
- 이메일: your-email@example.com

---

## 다음 단계

프로젝트가 정상적으로 실행되었다면:

1. **키워드 추가**
   - MongoDB에 더 많은 키워드 추가
   - 또는 Sheet-App 사용 (별도 프로젝트)

2. **블로그 ID 설정**
   - `src/constants.ts`에서 추적할 블로그 ID 수정
   ```typescript
   export const BLOG_IDS = [
     'your_blog_id',
     'another_blog_id',
   ];
   ```

3. **결과 확인**
   - MongoDB Compass에서 `keywords` 컬렉션 확인
   - `visibility`, `popularTopic`, `url` 필드 업데이트 확인

4. **자동화 확인**
   - 크론잡이 설정한 시간에 실행되는지 확인
   - 로그 파일 확인

5. **고급 설정**
   - Slack 알림 추가
   - 대시보드 구축
   - CSV 내보내기 활용

---

## 부록

### 유용한 명령어 모음

#### 프로젝트 명령어

```bash
# 의존성 설치
pnpm install

# 개발 모드 실행
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start

# 특정 파일 실행
pnpm tsx src/test.ts
```

#### Git 명령어

```bash
# 프로젝트 클론
git clone <repository-url>

# 최신 버전 가져오기
git pull origin main

# 변경사항 확인
git status
```

#### 시스템 명령어

**Mac:**
```bash
# 현재 위치 확인
pwd

# 폴더 내용 보기
ls -la

# 폴더 이동
cd <폴더명>

# 상위 폴더로 이동
cd ..
```

**Windows:**
```cmd
# 현재 위치 확인
cd

# 폴더 내용 보기
dir

# 폴더 이동
cd <폴더명>

# 상위 폴더로 이동
cd ..
```

### 환경 변수 예시

```env
# MongoDB 연결 (필수)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/naver-bot?retryWrites=true&w=majority

# 로그 레벨 (선택)
LOG_LEVEL=info

# 크롤링 딜레이 (선택, 밀리초)
CRAWL_DELAY=2000
```

### 크론 표현식 가이드

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 요일 (0-7, 0=일요일)
│ │ │ └─── 월 (1-12)
│ │ └───── 일 (1-31)
│ └─────── 시 (0-23)
└───────── 분 (0-59)
```

**예시:**
```
0 9 * * *      # 매일 오전 9시
0 */2 * * *    # 2시간마다
0 9 * * 1      # 매주 월요일 오전 9시
0 9 1 * *      # 매월 1일 오전 9시
*/30 * * * *   # 30분마다
```

---

## 마무리

축하합니다! 프로젝트 설치와 실행을 완료하셨습니다.

혹시 문제가 발생하거나 궁금한 점이 있다면:
1. [문제 해결](#문제-해결) 섹션 확인
2. GitHub Issues에 질문 남기기
3. README.md 파일 참고

**Happy Coding!** 🚀
