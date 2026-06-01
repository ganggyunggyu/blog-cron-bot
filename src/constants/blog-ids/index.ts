import type { PageCheckSheetType } from '../../database';

export * from './alibaba';

export const EXCLUDED_BLOG_IDS = [
  'csoheon',
  'su37un',
  'sasane',
  'wsnarin',
  'ordinarysoo',
  'mh528sk417',
  'lim_seeun',
  's901019s',
  'kangcs4162',
  'skycomps',
  'ccgakoreains',
  'ej8984',
  'beatmebiteme',
  'coolwogml',
  'dcba7516',
  'viperjy',
  '0924yim',
  'godqhr5528',
  'parks_park',
  'ds4fgy',
  'quitedu11',
  'jjin2188',
  'a380hl7611',
  'young_man70',
  'thisdk',
  'in00904',
  'servent77',
  'ari06050605',
  'yhn956',
  'mybombom',
  'cera96',
  'namggang',
  'woochulssa',
  'dudldus',
  'bookier',
  'hyuklove_3',
  'momoronica',
  'qorgksthf777',
  'soolbong25',
  'grimvit',
  'annyeong88',
  'jinhee139',
  'defie',
  'newspring247',
  'pink_rady_',
  'ssukizone',
  'uniquehanceo',
  'amormio-',
  'denis98',
  'daisy6072',
  'yjoh8615',
  'sjyh86',
  'guselvkvk',
  'adorableash',
  'yevencho',
  'kainn',
  'shinsujin7',
  'haein6256',
  '07lovelybaby',
  'bullim91',
  'hyzhengyin',
  'mcm2922',
  'antique2013',
  'mintto02',
  'sundays0411',
] as const;

const EXCLUDED_BLOG_ID_SET = new Set(
  EXCLUDED_BLOG_IDS.map((blogId) => blogId.toLowerCase())
);

const dedupeBlogIds = (blogIds: readonly string[]): string[] =>
  Array.from(
    new Set(
      blogIds
        .map((blogId) => blogId.toLowerCase())
        .filter((blogId) => !EXCLUDED_BLOG_ID_SET.has(blogId))
    )
  );

const BLACK_GOAT_BLOG_IDS = dedupeBlogIds([
  'dhtksk1p',
  'regular14631',
  'ahffkekd12',
  'q9v3m7a2',
  'laghunter8',
  'eghfsa5478',
  'pixelninja3',
] as const);

const DIET_SUPPLEMENT_BLOG_IDS = dedupeBlogIds(['ags2oigb'] as const);

const EYE_CLINIC_BLOG_IDS = dedupeBlogIds([
  'mixxut',
  'ynattg',
  'nahhjo',
  'mzuul',
  'hagyga',
  'geenl',
  'ghhoy',
  'nes1p2kx',
  'mh8j62wm',
  'h9ag469z',
  'dq1h3bjy',
] as const);

const SKIN_PROCEDURE_BLOG_IDS = dedupeBlogIds(['cookie4931'] as const);

const DENTAL_BLOG_IDS = dedupeBlogIds(['wound12567'] as const);

const PRESCRIPTION_BLOG_IDS = dedupeBlogIds(['precede1451'] as const);

const PAGE_PET_BLOG_IDS = dedupeBlogIds([
  'k7d9x2m4',
  'loand3324',
  'fail5644',
  'compare14310',
  'ghostrush7',
  'b6x2k9w3',
] as const);

const PAGE_SURI_PET_BLOG_IDS = dedupeBlogIds([
  'ahfflwl123',
  'ahffkdlek12',
  '8ua1womn',
  'ahsxkfldk12',
  'n7c3w8z2',
  'respawnking9',
] as const);

const GENERAL_ONLY_BLOG_IDS = dedupeBlogIds([
  'solantoro',
  'mygury1',
  'surreal805',
  'ybs1224',
  'minpilates',
  'busansmart',
  'dnation09',
  'dreamclock33',
  'sarangchai_',
  'i_thinkkkk',
  'sw078',
  'seowoo7603',
  'ikc9036',
  'skidrow762',
  'sghjan',
  'sunyzone2',
  'na3997',
  'bright0248',
  'kwen1030',
] as const);

const VIRAL_TEAM_SCHEDULE_BLOG_IDS = dedupeBlogIds([
  '0902ab',
  'by9996',
  'ziniz77',
  'taraswati',
  'vividoasis',
  'yaves0218',
  'idoenzang',
  'an970405',
  'youngtae0510',
  'sssunz',
  'canopus_72',
  'queen9336',
  'sesrsoa',
  'mw_mj',
  'jkr1231',
  'jini79_kr',
  'sweetfam',
  'janaggena',
  'ohn1052',
  'xuzhu',
  'qhghk6202',
  'sachicov',
  'fever0324',
  'easysilverr',
  'ster1624',
  'actress217',
  'actionandd',
  'kyeahk',
  'pell419',
  'isubass',
  'idear2011',
  'hero642',
  'breadcow',
  'seosj52',
  'guragura24',
  'biotherm7',
  'lgnamhs',
  'nebie',
  'khjkhjokok',
  'iori135',
  'sungei98',
  'mjy201',
  'zx6250',
  'purny77',
  'hyeojun',
  'vlfl28',
  'wersi76',
  'dress_up123',
  'alstnr07',
  'likegon2',
  'ds5qlm',
  'hweeba88',
  '83junhee',
  'mirinest2',
  'yeonsun23',
  'hjh1515',
  'suho1004sl',
  'seryuen12',
  'abatement',
  'leeyt777',
  'lso00000',
  'anauds248',
  'hanilove3',
  'catchurd',
  'mimi3225',
  'raruya',
  'mmento',
  'jgh2369',
  'sasane',
  'wsnarin',
  'ordinarysoo',
  'mh528sk417',
  'lim_seeun',
  'su37un',
  'ej8984',
  'kangcs4162',
  'skycomps',
  'ccgakoreains',
  'beatmebiteme',
  'coolwogml',
  'csoheon',
  'dcba7516',
  'viperjy',
  '0924yim',
  'godqhr5528',
  'parks_park',
  'ds4fgy',
  'quitedu11',
  'jjin2188',
  'a380hl7611',
  'young_man70',
  'thisdk',
  'in00904',
  'servent77',
  'ari06050605',
  'yhn956',
  'mybombom',
  'cera96',
  'woochulssa',
  'dudldus',
  'bookier',
  'hyuklove_3',
  'momoronica',
  'qorgksthf777',
  'soolbong25',
  'grimvit',
  'jinhee139',
  'defie',
  'newspring247',
  'pink_rady_',
  'ssukizone',
  'uniquehanceo',
  'amormio-',
  'denis98',
  'daisy6072',
  'yjoh8615',
  'sjyh86',
  'guselvkvk',
  'adorableash',
  'yevencho',
  'shinsujin7',
  '07lovelybaby',
  'sos0134',
  'viva0',
  'rughrt293',
  'jambbojy',
  'jw96306',
  'kgshon',
  'olpark4455',
] as const);

const TAGGED_DOGMARU_BLOG_IDS = dedupeBlogIds([
  'nanugi99',
  'v3se',
  'zifefe00000',
  'tpeany',
  'yakooroo',
  'minjin90310',
  'uhmcom',
  's901019s',
  'bullim91',
  'hyzhengyin',
  'namggang',
  'kainn',
  'gray00jy',
  'kamcopy',
  'skidrow5246',
  'annyeong88',
  'haein6256',
  'iealpx8p',
  'angrykoala270',
  'tinyfish183',
  'mw_mj',
  'janaggena',
] as const);

const TAGGED_SURI_PET_BLOG_IDS = dedupeBlogIds([
  'sanghoonchoi',
  'ylk3516',
  'hotelelena',
  'k54382000',
  'umle1203',
] as const);

const PAGE_GENERAL_BLOG_IDS = dedupeBlogIds([
  ...BLACK_GOAT_BLOG_IDS,
  ...DIET_SUPPLEMENT_BLOG_IDS,
  ...EYE_CLINIC_BLOG_IDS,
  ...SKIN_PROCEDURE_BLOG_IDS,
  ...DENTAL_BLOG_IDS,
  ...PRESCRIPTION_BLOG_IDS,
]);

const PAGE_ONLY_BLOG_IDS = dedupeBlogIds([
  ...PAGE_GENERAL_BLOG_IDS,
  ...PAGE_PET_BLOG_IDS,
  ...PAGE_SURI_PET_BLOG_IDS,
]);

// cron:pages용 전체 블로그(도그마루/서리펫 전용 계정 제외)
export const PAGES_BLOG_IDS = [...PAGE_GENERAL_BLOG_IDS];

// 노출체크 대상 블로그 계정 목록(블로그 URL 기준 ID)
export const BLOG_IDS = dedupeBlogIds([
  ...PAGES_BLOG_IDS,
  ...GENERAL_ONLY_BLOG_IDS,
  ...VIRAL_TEAM_SCHEDULE_BLOG_IDS,
]);

// 도그마루 전용 블로그
export const DOGMARU_BLOG_IDS = dedupeBlogIds([
  ...PAGE_PET_BLOG_IDS,
  ...TAGGED_DOGMARU_BLOG_IDS,
]);

// 도그마루 노출체크용 전체 블로그 + 도그마루 전용 블로그
export const DOGMARU_PAGE_CHECK_BLOG_IDS = dedupeBlogIds([
  ...BLOG_IDS,
  ...DOGMARU_BLOG_IDS,
]);

// 서리펫 전용 블로그
export const SURI_PET_BLOG_IDS = dedupeBlogIds([
  ...PAGE_SURI_PET_BLOG_IDS,
  ...TAGGED_SURI_PET_BLOG_IDS,
]);

// 페이지 애견 노출체크용 전체 블로그 + 도그마루 전용 + 서리펫 전용 블로그
export const PET_PAGE_CHECK_BLOG_IDS = dedupeBlogIds([
  ...BLOG_IDS,
  ...DOGMARU_BLOG_IDS,
  ...SURI_PET_BLOG_IDS,
]);

// 서리펫 노출체크용 전체 블로그 + 서리펫 전용 블로그
export const SURI_PET_PAGE_CHECK_BLOG_IDS = dedupeBlogIds([
  ...BLOG_IDS,
  ...SURI_PET_BLOG_IDS,
]);

export const PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE: Record<
  PageCheckSheetType,
  string[]
> = {
  'black-goat-new': [...BLACK_GOAT_BLOG_IDS],
  'black-goat-old': [...BLOG_IDS],
  'diet-supplement': [...DIET_SUPPLEMENT_BLOG_IDS],
  'skin-procedure': [...SKIN_PROCEDURE_BLOG_IDS],
  dental: [...DENTAL_BLOG_IDS],
  prescription: [...PRESCRIPTION_BLOG_IDS],
  'eye-clinic': [...EYE_CLINIC_BLOG_IDS],
  pet: [...PET_PAGE_CHECK_BLOG_IDS],
  suripet: [...SURI_PET_PAGE_CHECK_BLOG_IDS],
};
