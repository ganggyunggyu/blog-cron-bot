interface ProgressSuccessParams {
  index: number;
  total: number;
  keyword: string;
  restaurantName: string;
  rank: number | string;
  topic: string;
  vendor: string;
  title: string;
  source: string;
}

interface ProgressFailureParams {
  index: number;
  total: number;
  keyword: string;
  restaurantName: string;
  reason: string;
}

export const progressLogger = {
  success: (params: ProgressSuccessParams) => {
    const { index, total, keyword, restaurantName, rank, topic, vendor, title, source } = params;
    console.log(
      `[${index}/${total}] ${keyword} ✅ ${restaurantName || '-'} / ${rank} / ${topic} / ${vendor || '-'} / ${title} / SRC=${source}`
    );
  },

  failure: (params: ProgressFailureParams) => {
    const { index, total, keyword, restaurantName, reason } = params;
    console.log(
      `[${index}/${total}] ${keyword} ❌ ${restaurantName || '-'} / - / - / - / - (${reason})`
    );
  },

  skip: (params: { index: number; total: number; keyword: string; company: string }) => {
    const { index, total, keyword, company } = params;
    console.log(
      `[${index}/${total}] ${keyword} ⏭️  ${company} - 프로그램 제외 대상 (스킵)`
    );
  },

  cacheUsed: (params: { index: number; total: number; searchQuery: string }) => {
    const { index, total, searchQuery } = params;
    console.log(
      `\n[${index}/${total}] 🔄 캐시 사용: "${searchQuery}"`
    );
  },

  newCrawl: (searchQuery: string) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔎 [신규 크롤링] 검색어: "${searchQuery}"`);
    console.log('='.repeat(60));
  },
};
