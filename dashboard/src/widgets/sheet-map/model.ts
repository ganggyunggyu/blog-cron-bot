import type { PresetTarget, SheetLocation } from '@/entities/preset';

/**
 * 시트ID → 사람이 알아볼 수 있는 스프레드시트 이름.
 *
 * 프리셋 데이터엔 시트ID만 있어서 그대로 보여주면 뭔지 알 수 없다. 실제 구글시트
 * 제목을 그대로 옮겨 적었다.
 */
export const SPREADSHEET_LABELS: Record<string, string> = {
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw': '패키지현황',
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0': '프로그램 노출체크',
  '1CsO-R1LMrsQdUw7T1KEL2I4bMxAeYnZIklOgr8e_DPY': '루트컴퍼니 전체현황 (신규)',
  '1c9TJ1gETtunuCmzfzap-2lyqXj1cwzITOb1k8W4tL8c': '1-9페이지 노출체크',
};

/**
 * `시트ID::탭이름` → gid. 탭 gid는 한 번 만들어지면 안 바뀌므로 하드코딩해도 안전하다.
 * 여기 없는 조합은 gid 없이 스프레드시트 첫 탭으로만 링크한다.
 */
const TAB_GIDS: Record<string, number> = {
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw::패키지': 0,
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw::도그마루 제외': 664058956,
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw::도그마루': 1530604719,
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw::서리펫': 1011935033,
  '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw::카페 작업': 250477480,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::패키지': 2016050258,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::일반건': 864347536,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::도그마루': 1243473706,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::루트': 1624245350,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::서리펫': 934688657,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::애견(전체블로그)': 529625636,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::카페노출체크': 1406050962,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::패키지_더보기': 1976196124,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::일반건_더보기': 1586090773,
  '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0::도그마루_더보기': 657052107,
  '1CsO-R1LMrsQdUw7T1KEL2I4bMxAeYnZIklOgr8e_DPY::월보장 시트': 0,
  '1c9TJ1gETtunuCmzfzap-2lyqXj1cwzITOb1k8W4tL8c::애견': 1960709235,
};

/**
 * pet(애견), cafe처럼 프리셋의 result 필드가 비어 있지만 코드에 결과 시트가
 * 따로 고정돼 있는 대상. 실제 쓰기 함수(writePetResultsToSheet 등)를 추적해서
 * 확인한 값이라 프리셋을 고쳐도 안 바뀐다 — 그래서 프리셋과 별개로 여기 적어둔다.
 */
const HARDCODED_RESULT_OVERRIDES: Record<string, SheetLocation> = {
  pet: {
    sheetId: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
    tabTitle: '애견(전체블로그)',
  },
  cafe: {
    sheetId: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
    tabTitle: '카페노출체크',
  },
};

export const spreadsheetLabel = (sheetId: string): string =>
  SPREADSHEET_LABELS[sheetId] ?? sheetId;

export const sheetUrl = (location: SheetLocation): string => {
  const gid = TAB_GIDS[`${location.sheetId}::${location.tabTitle}`];
  const base = `https://docs.google.com/spreadsheets/d/${location.sheetId}/edit`;
  return gid === undefined ? base : `${base}#gid=${gid}`;
};

export interface ResolvedResult {
  location: SheetLocation | null;
  /** result가 프리셋에 없어서 코드에서 고정된 값을 대신 보여주는 경우 */
  isHardcodedOverride: boolean;
  /** result도, 오버라이드도 없어서 원본 시트에 그대로 반영되는 경우 */
  writesBackToSource: boolean;
}

/** 대상 하나의 실제 결과 시트를 판단한다. 프리셋 → 알려진 예외 → 원본 반영 순서로 본다. */
export const resolveResult = (target: PresetTarget): ResolvedResult => {
  if (target.result) {
    return { location: target.result, isHardcodedOverride: false, writesBackToSource: false };
  }

  const override = HARDCODED_RESULT_OVERRIDES[target.id];
  if (override) {
    return { location: override, isHardcodedOverride: true, writesBackToSource: false };
  }

  return { location: null, isHardcodedOverride: false, writesBackToSource: true };
};
