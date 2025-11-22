class HeaderManager {
  private currentIndex = 0;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private intervalMs = 60 * 1000) {
    // 기본 60초마다 교체
    this.rotate();
    this.startAutoRotate();
  }

  private rotate() {
    this.currentIndex = Math.floor(Math.random() * NAVER_HEADER_POOL.length);
  }

  private startAutoRotate() {
    this.intervalId = setInterval(() => {
      this.rotate();
    }, this.intervalMs);
  }

  public get headers() {
    return NAVER_HEADER_POOL[this.currentIndex];
  }
}

const NAVER_HEADER_POOL = [
  {
    // Mac Chrome
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua':
      '"Chromium";v="124", "Google Chrome";v="124", ";Not A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
  },
  {
    // Windows Chrome
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua':
      '"Chromium";v="124", "Google Chrome";v="124", ";Not A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  },
  {
    // iPhone Safari 느낌
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
  },
  {
    // Android Chrome 느낌
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
  },
];

export const NAVER_DESKTOP_HEADERS = {
  // Windows Chrome
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Accept-Encoding': 'gzip, deflate, br',
  'sec-ch-ua':
    '"Chromium";v="124", "Google Chrome";v="124", ";Not A Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

//   {
//   'User-Agent':
//     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',

//   'sec-ch-ua':
//     'Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99',
//   'sec-ch-ua-platform': 'macOS',
// };
export const BLOG_IDS = [
  'sarangchai_',
  'im_tang',
  'solantoro',
  'busansmart',
  'mygury1',
  'rscwsixrc',
  'surreal805',
  'dreamclock33',
  'minpilates',
  'dnation09',
  'snk92789',
  'i_thinkkkk',
  'sw078',
  'godqhr5528',
  'alstjs9711',
  'jjs216',
  'megatattoo',
  'odori2007',
  'vegetable10517',
  'rational4640',
  'hugeda14713',
  'boy848',
  'ecjroe6558',
  'dhtksk1p',
  'dhfosk1p',
  'dlfgydnjs1p',
  'eqsdxv2863',
  'ags2oigb',
  'vocabulary1215',
  'zoeofx5611',
  'tjthtjs5p',
  'wd6edn3b',
  'ihut9094',
  '3goc9xkq',
  'tube24575',
  'cookie4931',
  'wound12567',
  'precede1451',
  '0902ab',
  'by9996',
  'ziniz77',
  'taraswati',
  'vividoasis',
  'gray00jy',
  'skidrow5246',
  'kainn',
  'yaves0218',
  'idoenzang',
  'wsnarin',
  'an970405',
  'kangcs4162',
  'skycomps',
  'hotelelena',
  'bullim91',
  'hyzhengyin',
  'kisemo777',
  'mw_mj',
  'ccgakoreains',
  'sjyh86',
  'guselvkvk',
  'adorableash',
  'yevencho',
  'dlsdo9495',
  'ddo_ddi_appa',
  'gnggnggyu_',
  'mm__mm984',
  'seowoo7603',
  'ybs1224',
  'tpeany',
  'jkr1231',
  'jambbojy',
  'sssunz',
  'sos0134',
  'bright0248',
  's901019s',
  'minjin90310',
  'canopus_72',
  'youngtae0510',
];
