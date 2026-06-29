import { chromium, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const SCHEDULER_ENV_PATH =
  '/Users/ganggyunggyu/Programing/21lab/blog-bot/scheduler-server/.env';

type ProbeResult = {
  accountId: string;
  blogId: string;
  logNo: string;
  loggedIn: boolean;
  pages: Array<{
    label: string;
    url: string;
    title: string;
    textMatches: string[];
    forms: Array<{ action: string; method: string; inputNames: string[] }>;
    requests: string[];
  }>;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readEnvValue = async (filePath: string, key: string): Promise<string> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const line = raw.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
    if (!line) return '';
    return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
};

const getGeminiApiKey = async (): Promise<string> => {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    (await readEnvValue(SCHEDULER_ENV_PATH, 'GEMINI_API_KEY'))
  );
};

const sessionDir = path.resolve('.playwright-session');

async function loadCookies(accountId: string) {
  try {
    const raw = await fs.readFile(path.join(sessionDir, `${accountId}-cookies.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveCookies(page: Page, accountId: string) {
  await fs.mkdir(sessionDir, { recursive: true });
  const cookies = await page.context().cookies();
  await fs.writeFile(
    path.join(sessionDir, `${accountId}-cookies.json`),
    `${JSON.stringify(cookies, null, 2)}\n`,
    'utf8'
  );
}

async function detectCaptcha(page: Page): Promise<{
  detected: boolean;
  base64?: string;
  question?: string;
  captchaType?: string;
}> {
  const captchaType = await page.evaluate(() => {
    const typeEl = document.getElementById('captcha_type') as HTMLInputElement | null;
    const captchaInput =
      document.querySelector<HTMLInputElement>('#captcha') ??
      document.querySelector<HTMLInputElement>('#chptchakey');
    const img = document.getElementById('captchaimg') as HTMLImageElement | null;
    return typeEl?.value || (captchaInput && img ? 'detected' : '');
  }).catch(() => '');

  if (!captchaType) return { detected: false };

  let base64 = await page.evaluate(() => {
    const img = document.getElementById('captchaimg') as HTMLImageElement | null;
    if (!img?.src) return '';
    const match = img.src.match(/base64,(.+)/);
    return match?.[1] || '';
  }).catch(() => '');

  if (!base64) {
    const image = page.locator('#captchaimg').first();
    if (await image.isVisible({ timeout: 1000 }).catch(() => false)) {
      base64 = (await image.screenshot()).toString('base64');
    }
  }

  if (!base64) return { detected: false };

  const question = await page.evaluate(() => {
    const info = document.getElementById('captcha_info');
    return info?.textContent?.trim() || '';
  }).catch(() => '');

  return { detected: true, base64, question, captchaType };
}

async function solveCaptchaWithGemini(imageBase64: string, question: string): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return '';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              {
                text: `이 이미지는 네이버 로그인 캡차로 나오는 가상 영수증 이미지야.
질문: "${question}"
답만 정확히 적어. 숫자면 숫자만, 물건 이름이면 이름만. 다른 말 하지마.`,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) return '';
  const json = await response.json();
  const candidate = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

async function attemptCaptchaSolve(page: Page, password: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const captcha = await detectCaptcha(page);
    if (!captcha.detected) return true;

    const answer = await solveCaptchaWithGemini(captcha.base64 ?? '', captcha.question ?? '');
    if (!answer) {
      await delay(1000);
      continue;
    }

    const input =
      (await page.locator('#captcha').first().isVisible({ timeout: 1000 }).catch(() => false))
        ? page.locator('#captcha').first()
        : page.locator('#chptchakey').first();

    await input.fill(answer);
    await delay(200);

    if (await page.locator('#pw').first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.fill('#pw', password);
      await delay(150);
    }

    await page.click(".btn_login, #log\\.login, button[type='submit']");
    await delay(3000);

    if (!page.url().includes('nidlogin')) return true;
  }

  return false;
}

async function login(page: Page, accountId: string, password: string): Promise<boolean> {
  await page.goto('https://nid.naver.com/nidlogin.login', {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  if (!page.url().includes('nidlogin.login')) {
    await saveCookies(page, accountId);
    return true;
  }

  if ((await detectCaptcha(page)).detected) {
    await page.fill('input#id', accountId);
    await page.fill('input#pw', password);
    const solved = await attemptCaptchaSolve(page, password);
    if (solved && !page.url().includes('nidlogin')) {
      await saveCookies(page, accountId);
      return true;
    }
  }

  await page.fill('input#id', accountId);
  await page.fill('input#pw', password);
  await page.click('button.btn_login, button#log\\.login, .btn_login');

  for (let i = 0; i < 180; i += 1) {
    await delay(1000);
    const cookies = await page.context().cookies();
    const hasSession = cookies.some((cookie) => cookie.name === 'NID_SES');
    const currentUrl = page.url();
    if (hasSession && !currentUrl.includes('nidlogin.login')) {
      await saveCookies(page, accountId);
      return true;
    }
    if (currentUrl.includes('captcha') || currentUrl.includes('protect')) {
      const solved = await attemptCaptchaSolve(page, password);
      if (solved && !page.url().includes('nidlogin')) {
        await saveCookies(page, accountId);
        return true;
      }
    }
  }

  return false;
}

async function inspectPage(page: Page, label: string, url: string) {
  const requests: string[] = [];
  const onRequest = (request: { url: () => string }) => {
    const requestUrl = request.url();
    if (/blog|admin|post|open|private|write|api/i.test(requestUrl)) {
      requests.push(requestUrl);
    }
  };

  page.on('request', onRequest);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay(2500);
  } catch {
    // Keep partial page data; some Naver admin pages keep long-polling assets open.
  } finally {
    page.off('request', onRequest);
  }

  const data = await page.evaluate(() => {
    const words = ['비공개', '공개', '수정', '관리', '삭제', '글관리', 'PostUpdate', 'postList'];
    const bodyText = document.body?.innerText ?? '';
    const textMatches = words.filter((word) => bodyText.includes(word) || document.documentElement.innerHTML.includes(word));
    const forms = Array.from(document.querySelectorAll('form')).slice(0, 20).map((form) => ({
      action: form.getAttribute('action') ?? '',
      method: form.getAttribute('method') ?? '',
      inputNames: Array.from(form.querySelectorAll('input'))
        .map((input) => input.getAttribute('name') ?? input.id ?? '')
        .filter(Boolean)
        .slice(0, 60),
    }));
    return { textMatches, forms };
  });

  return {
    label,
    url: page.url(),
    title: await page.title(),
    textMatches: data.textMatches,
    forms: data.forms,
    requests: Array.from(new Set(requests)).slice(0, 120),
  };
}

async function main() {
  const accountId = required('NAVER_PROBE_ID');
  const password = required('NAVER_PROBE_PW');
  const blogId = required('NAVER_PROBE_BLOG_ID');
  const logNo = required('NAVER_PROBE_LOG_NO');

  const outDir = path.resolve('work/naver-private-probe');
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  });
  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  });
  const cookies = await loadCookies(accountId);
  if (cookies.length > 0) await context.addCookies(cookies);
  const page = await context.newPage();

  const result: ProbeResult = {
    accountId,
    blogId,
    logNo,
    loggedIn: false,
    pages: [],
  };

  try {
    result.loggedIn = await login(page, accountId, password);
    if (!result.loggedIn) {
      throw new Error('login failed or challenge required');
    }

    const urls = [
      ['blog-post', `https://blog.naver.com/${blogId}/${logNo}`],
      ['mobile-post', `https://m.blog.naver.com/${blogId}/${logNo}`],
      ['post-view', `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`],
      ['post-update-form', `https://blog.naver.com/PostUpdateForm.naver?blogId=${blogId}&logNo=${logNo}`],
      ['admin-main', `https://admin.blog.naver.com/AdminMain.naver?blogId=${blogId}`],
      ['admin-blog', `https://admin.blog.naver.com/${blogId}`],
      ['post-list', `https://blog.naver.com/PostList.naver?blogId=${blogId}&from=postList&categoryNo=0&currentPage=1`],
    ] as const;

    for (const [label, url] of urls) {
      result.pages.push(await inspectPage(page, label, url));
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(outDir, `${blogId}-${logNo}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    loggedIn: result.loggedIn,
    outPath,
    pages: result.pages.map((p) => ({
      label: p.label,
      url: p.url,
      title: p.title,
      matches: p.textMatches,
      requestCount: p.requests.length,
      formCount: p.forms.length,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
