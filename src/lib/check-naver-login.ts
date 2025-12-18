import 'dotenv/config';
import * as cheerio from 'cheerio';

export interface LoginStatus {
  isLoggedIn: boolean;
  userName?: string;
  email?: string;
}

type GotScrapingClient = typeof import('got-scraping').gotScraping;

const dynamicImport = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<any>;

export async function checkNaverLogin(): Promise<LoginStatus> {
  const { gotScraping } = (await dynamicImport('got-scraping')) as {
    gotScraping: GotScrapingClient;
  };

  const nidAut = process.env.NAVER_NID_AUT;
  const nidSes = process.env.NAVER_NID_SES;
  const mLoc = process.env.NAVER_M_LOC;

  if (!nidAut || !nidSes) {
    return { isLoggedIn: false };
  }

  let cookie = `NID_AUT=${nidAut}; NID_SES=${nidSes}`;
  if (mLoc) cookie += `; m_loc=${mLoc}`;

  try {
    const res = await gotScraping.get(
      'https://nid.naver.com/user2/help/myInfoV2?lang=ko_KR',
      {
        headers: {
          Cookie: cookie,
          Referer: 'https://nid.naver.com/',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        http2: true,
        followRedirect: true,
        throwHttpErrors: false,
      }
    );

    if (res.statusCode !== 200) {
      return { isLoggedIn: false };
    }

    const $ = cheerio.load(res.body);
    const userName = $('.name').text().trim().split('\n')[0].trim();
    const profileText = $('.profile_area').text();
    const emailMatch = profileText.match(/([a-zA-Z0-9._-]+@naver\.com)/);

    if (userName) {
      return {
        isLoggedIn: true,
        userName,
        email: emailMatch?.[1],
      };
    }

    return { isLoggedIn: false };
  } catch {
    return { isLoggedIn: false };
  }
}
