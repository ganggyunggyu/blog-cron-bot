const DASHBOARD_URL = "https://blog-cron-bot-production.up.railway.app";
const RELEASE_URL =
  "https://github.com/ganggyunggyu/blog-cron-bot/releases/latest";

const jobs = [
  ["루트 노출체크", "통합검색 결과를 빠르게 확인"],
  ["루트 더보기 노출체크", "더보기 페이지까지 꼼꼼하게 확인"],
  ["패키지 노출체크", "패키지 전체 업체를 한 번에 확인"],
  ["일반건 노출체크", "도그마루 제외 일반건만 분리 확인"],
  ["도그마루 노출체크", "전용 계정과 기준으로 독립 확인"],
  ["애견 통합 노출체크", "애견 1~4페이지를 병렬로 확인"],
  ["카페 통합 노출체크", "블로그와 카페 결과를 함께 확인"],
];

const progress = [
  ["패키지", "완료", "100%", "100"],
  ["일반건", "완료", "100%", "100"],
  ["도그마루", "진행 중", "68%", "68"],
  ["루트", "대기", "0%", "0"],
];

const faqs = [
  [
    "처음 설치할 때 경고가 보여요.",
    "현재 배포본은 코드 서명 인증서 적용 전이라 macOS Gatekeeper나 Windows SmartScreen 안내가 나타날 수 있습니다. 공식 GitHub 배포 페이지에서 받은 파일인지 확인한 뒤, macOS는 우클릭 후 ‘열기’, Windows는 ‘추가 정보’에서 실행할 수 있습니다.",
  ],
  [
    "패키지현황이나 루트 원본 시트를 수정하나요?",
    "아니요. 원본 현황 시트는 키워드를 가져오는 읽기 전용 자료입니다. 노출 결과는 별도로 지정된 결과 시트와 내보내기 파일에만 기록합니다.",
  ],
  [
    "차단이나 통신 실패가 나면 미노출로 기록되나요?",
    "아니요. 응답 차단·빈 결과·일시 오류는 ‘확인 실패’로 분리하고 낮은 속도로 재시도합니다. 확인되지 않은 결과를 미노출로 확정하지 않습니다.",
  ],
  [
    "IP나 헤더를 바꿔 우회하나요?",
    "IP 위장, 회전 프록시, 차단 회피 기능은 제공하지 않습니다. 헤더로 실제 발신 IP를 바꿀 수도 없습니다. 일반 브라우저 요청 형식과 전체 요청 수 제한, 대기, 안전한 재시도만 사용합니다.",
  ],
  [
    "설치 없이도 사용할 수 있나요?",
    "네. 웹 제어판에서도 같은 작업 버튼과 진행 상황, 결과 파일을 사용할 수 있습니다. 데스크톱 앱은 제어판을 더 편하게 여는 선택 사항입니다.",
  ],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="노출지기 처음으로">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>노출지기</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#features">기능</a>
          <a href="#start">사용법</a>
          <a href="#safety">안전 원칙</a>
        </nav>
        <a className="header-cta" href={DASHBOARD_URL} target="_blank" rel="noreferrer">
          웹에서 열기 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> NAVER EXPOSURE CONTROL DESK</p>
          <h1>복잡한 노출체크를,<br /><em>버튼 한 번으로.</em></h1>
          <p className="hero-description">
            패키지부터 루트 더보기, 애견 1~4페이지와 카페까지.<br />
            동시에 확인하고 진행 상황과 결과를 한 화면에서 관리하세요.
          </p>
          <div className="hero-actions">
            <a className="button primary" href={DASHBOARD_URL} target="_blank" rel="noreferrer">
              지금 바로 실행하기 <span aria-hidden="true">↗</span>
            </a>
            <a className="button secondary" href="#download">앱 다운로드 <span aria-hidden="true">↓</span></a>
          </div>
          <div className="trust-row" aria-label="주요 안전 원칙">
            <span><b>✓</b> 원본 시트 읽기 전용</span>
            <span><b>✓</b> 실패 결과 분리</span>
            <span><b>✓</b> 전체 요청 수 제한</span>
          </div>
        </div>

        <div className="progress-window" aria-label="노출체크 진행 상황 화면 예시">
          <div className="window-bar"><span /><span /><span /><small>오늘 08:00 전체 노출체크</small></div>
          <div className="window-body">
            <div className="run-heading">
              <div><p>전체 진행률</p><strong>72<small>%</small></strong></div>
              <span className="live-pill"><i /> 실행 중</span>
            </div>
            <div className="total-track"><span /></div>
            <div className="target-list">
              {progress.map(([name, state, percent, width]) => (
                <div className="target-row" key={name}>
                  <div className="target-meta"><b>{name}</b><span className={`state state-${state}`}>{state}</span><strong>{percent}</strong></div>
                  <div className="target-track"><span style={{ width: `${width}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="window-footer"><span>7개 작업 중 2개 완료</span><b>실시간 자동 갱신</b></div>
          </div>
          <span className="sample-label">화면 예시</span>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading"><p className="section-number">01 · ONE CLICK</p><h2>필요한 작업만 골라<br />한 번에 시작하세요.</h2><p>작업 이름 그대로 된 버튼을 누르면 나머지는 노출지기가 처리합니다.</p></div>
        <div className="job-grid">
          {jobs.map(([name, description], index) => (
            <article className="job-card" key={name}>
              <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{name}</h3><p>{description}</p><span className="job-arrow" aria-hidden="true">→</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section steps-section" id="start">
        <div className="section-heading"><p className="section-number">02 · GET STARTED</p><h2>처음이어도<br />3단계면 충분해요.</h2></div>
        <ol className="steps">
          <li><span>1</span><div><small>DOWNLOAD</small><h3>내 컴퓨터에 설치</h3><p>macOS 또는 Windows용 최신 앱을 내려받아 실행합니다.</p></div></li>
          <li><span>2</span><div><small>OPEN</small><h3>제어판 열기</h3><p>공유받은 비밀번호로 접속하면 준비가 끝납니다.</p></div></li>
          <li><span>3</span><div><small>RUN</small><h3>버튼 누르고 확인</h3><p>작업을 선택하고 진행률, 결과 파일, 알림을 확인합니다.</p></div></li>
        </ol>
      </section>

      <section className="download-section" id="download">
        <div><p className="section-number light">03 · DESKTOP APP</p><h2>익숙한 컴퓨터에서<br />더 빠르게 시작하세요.</h2><p className="download-copy">앱을 설치하면 주소를 찾을 필요 없이 노출지기 제어판을 바로 열 수 있습니다.</p></div>
        <div className="download-options">
          <a href={RELEASE_URL} target="_blank" rel="noreferrer"><span className="os-mark">⌘</span><div><small>FOR APPLE SILICON &amp; INTEL</small><strong>macOS용 다운로드</strong></div><b>↓</b></a>
          <a href={RELEASE_URL} target="_blank" rel="noreferrer"><span className="os-mark windows">⊞</span><div><small>FOR WINDOWS 10 &amp; 11</small><strong>Windows용 다운로드</strong></div><b>↓</b></a>
          <p>최신 버전의 운영체제별 설치 파일이 있는 공식 GitHub 배포 페이지로 이동합니다.</p>
        </div>
      </section>

      <section className="section safety-section" id="safety">
        <div className="section-heading"><p className="section-number">04 · SAFE BY DESIGN</p><h2>빠르게 확인하되,<br />결과는 신중하게.</h2></div>
        <div className="safety-grid">
          <article><span>READ</span><h3>원본 시트는 읽기 전용</h3><p>패키지현황과 루트 원본은 조회만 합니다. 결과는 지정된 결과 시트와 파일로만 내보냅니다.</p></article>
          <article><span>VERIFY</span><h3>오류를 미노출로 쓰지 않음</h3><p>차단이나 빈 응답은 확인 실패로 분리합니다. 정상 응답이 확인된 결과만 반영합니다.</p></article>
          <article><span>PACE</span><h3>요청 속도를 한곳에서 제한</h3><p>동시에 여러 작업을 실행해도 전체 요청 수를 통제하고, 일시 오류에는 천천히 재시도합니다.</p></article>
          <article><span>HONEST</span><h3>IP 위장·우회 기능 없음</h3><p>임의 IP 위장이나 회전 프록시로 차단을 피하지 않습니다. 정상 요청과 안전한 대기만 사용합니다.</p></article>
        </div>
      </section>

      <section className="section faq-section">
        <div className="section-heading"><p className="section-number">05 · FAQ</p><h2>자주 묻는 질문</h2></div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="final-cta">
        <p>READY WHEN YOU ARE</p><h2>오늘의 노출체크,<br />지금 시작하세요.</h2>
        <a className="button primary" href={DASHBOARD_URL} target="_blank" rel="noreferrer">노출지기 열기 <span aria-hidden="true">↗</span></a>
      </section>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark">N</span><span>노출지기</span></a><p>노출체크를 빠르고 정확하게 관리하는 운영 도구</p><span>© 2026 NOCHULJIGI</span></footer>
    </main>
  );
}
