# 노출지기 데스크톱

노출지기 운영 제어판을 macOS와 Windows에서 실행하는 데스크톱 앱입니다. 실제 노출체크는 서버에서 실행되므로 사용자의 PC에 Google·Naver·MongoDB 인증 정보를 저장하지 않습니다.

## 개발 실행

```bash
npm install
npm test
npm start
```

기본 연결 주소는 `https://blog-cron-bot-production.up.railway.app`입니다. 로컬 제어판을 확인할 때만 다음처럼 바꿀 수 있습니다.

```bash
NOCHULJIGI_DASHBOARD_URL=http://localhost:4500 npm start
```

운영 환경의 사용자 지정 주소는 HTTPS만 허용합니다.

## 설치파일 만들기

- macOS(Intel·Apple Silicon): `npm run package:mac`
- Windows 64비트: `npm run package:win`
- 현재 운영체제에서 압축 해제형 앱 확인: `npm run package:dir`

`v`로 시작하는 태그를 GitHub에 올리면 GitHub Actions가 macOS용 DMG·ZIP과 Windows용 설치 EXE·포터블 EXE를 만들고 해당 GitHub Release에 첨부합니다.

## 보안 설계

- 렌더러의 Node.js 연동을 끕니다.
- 컨텍스트 격리, Chromium sandbox, 웹 보안을 켭니다.
- 설정된 제어판과 동일한 출처만 앱 안에서 이동하거나 새 창을 열 수 있습니다.
- 카메라, 마이크, 위치 등 브라우저 권한 요청을 모두 거부합니다.
- 원격 페이지가 `webview`를 붙일 수 없게 막습니다.

## 배포 전 필수 확인

현재 macOS 시험판은 실행 가능한 임시(ad-hoc) 서명을 적용하고, Windows 시험판은 서명하지 않습니다. 공개 배포본은 정식 코드 서명이 필요하며, 지금 만든 파일에는 macOS Gatekeeper 또는 Windows SmartScreen 경고가 나타납니다.

- macOS: Apple Developer ID Application 인증서로 서명하고 Apple 공증을 적용합니다.
- Windows: 신뢰 가능한 코드 서명 인증서로 EXE를 서명합니다.

정식 인증서를 연결할 때는 `mac.identity`의 임시 서명을 제거하고 GitHub Actions에 인증서와 공증 정보를 설정해야 합니다. 그 뒤 실제 설치 기기에서 다운로드·설치·로그인·노출체크 실행·CSV 다운로드까지 확인해야 합니다.
