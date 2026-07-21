import { TEST_CONFIG } from '../constants';

export interface DooraySheetLink {
  name: string;
  url: string;
}

const resultSheetUrl = (gid?: number): string =>
  `https://docs.google.com/spreadsheets/d/${TEST_CONFIG.SHEET_ID}/edit${
    gid === undefined ? '' : `#gid=${gid}`
  }`;

const RESULT_SHEETS: Array<
  DooraySheetLink & { aliases: readonly string[] }
> = [
  { name: '패키지', aliases: ['패키지'], url: resultSheetUrl(2016050258) },
  { name: '일반건', aliases: ['일반건'], url: resultSheetUrl(864347536) },
  { name: '도그마루', aliases: ['도그마루'], url: resultSheetUrl(1243473706) },
  { name: '루트', aliases: ['루트'], url: resultSheetUrl(1624245350) },
  { name: '애견(전체블로그)', aliases: ['애견'], url: resultSheetUrl(529625636) },
  { name: '서리펫', aliases: ['서리펫'], url: resultSheetUrl(934688657) },
  { name: '알리바바', aliases: ['알리바바'], url: resultSheetUrl(914645152) },
  { name: '카페노출체크', aliases: ['카페'], url: resultSheetUrl(1406050962) },
];

export const resolveDooraySheetLinks = (
  labels: readonly string[]
): DooraySheetLink[] => {
  const combinedLabel = labels.join(' ');
  const matched = RESULT_SHEETS.filter(({ aliases }) =>
    aliases.some((alias) => combinedLabel.includes(alias))
  ).map(({ name, url }) => ({ name, url }));

  return matched.length > 0
    ? matched
    : [{ name: '프로그램 노출체크', url: resultSheetUrl() }];
};
