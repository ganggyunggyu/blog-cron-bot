const BOX_WIDTH = 50;

export const consoleLog = {
  box: (title: string, content: string[]) => {
    const line = '─'.repeat(BOX_WIDTH);
    console.log(`\n┌${line}┐`);
    console.log(`│ ${title.padEnd(BOX_WIDTH - 1)}│`);
    console.log(`├${line}┤`);
    content.forEach((c) => console.log(`│ ${c.padEnd(BOX_WIDTH - 1)}│`));
    console.log(`└${line}┘`);
  },

  step: (num: number, total: number, msg: string, status: 'start' | 'done' = 'start') => {
    const icon = status === 'done' ? '✓' : '▶';
    console.log(`  ${icon} [${num}/${total}] ${msg}`);
  },

  result: (label: string, count: number) => {
    console.log(`     └─ ${label}: ${count}건`);
  },

  waiting: (msg = '대기 중...') => {
    console.log(`\n  ⏳ ${msg}\n`);
  },

  divider: (char = '─', width = 60) => {
    console.log(char.repeat(width));
  },

  section: (title: string) => {
    console.log(`\n▸ ${title}`);
  },

  info: (label: string, value: string | number) => {
    console.log(`  ${label}: ${value}`);
  },

  success: (msg: string) => {
    console.log(`  ✅ ${msg}`);
  },

  error: (msg: string) => {
    console.error(`  ❌ ${msg}`);
  },
};
