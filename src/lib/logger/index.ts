import winston from 'winston';
import chalk from 'chalk';

const { format, transports, createLogger } = winston;

const getTimestamp = () => {
  const now = new Date();
  return now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const levels = {
  error: 0,
  warn: 1,
  success: 2,
  info: 3,
  debug: 4,
};

const levelColors: Record<string, (text: string) => string> = {
  error: (t) => chalk.red.bold(t),
  warn: (t) => chalk.yellow(t),
  success: (t) => chalk.green(t),
  info: (t) => chalk.cyan(t),
  debug: (t) => chalk.gray(t),
};

const levelIcons: Record<string, string> = {
  error: '✖',
  warn: '⚠',
  success: '✓',
  info: '→',
  debug: '·',
};

const customFormat = format.printf(({ level, message }) => {
  const timestamp = chalk.gray(getTimestamp());
  const icon = levelIcons[level] || '·';
  const colorFn = levelColors[level] || ((t: string) => t);
  const levelStr = colorFn(`${icon}`);

  return `${timestamp} │ ${levelStr} │ ${message}`;
});

const winstonLogger = createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(customFormat),
  transports: [new transports.Console()],
});

const BOX_WIDTH = 54;

const drawBox = (
  title: string,
  content: string[],
  color: 'green' | 'red' | 'cyan' | 'yellow' = 'cyan'
) => {
  const colorFn = chalk[color];
  const line = '─'.repeat(BOX_WIDTH);

  console.log('');
  console.log(colorFn(`┌${line}┐`));
  console.log(colorFn(`│`) + ` ${chalk.bold(title).padEnd(BOX_WIDTH + 9)}` + colorFn(`│`));
  console.log(colorFn(`├${line}┤`));
  content.forEach((c) => {
    const paddedContent = c.padEnd(BOX_WIDTH - 1);
    console.log(colorFn(`│`) + ` ${paddedContent}` + colorFn(`│`));
  });
  console.log(colorFn(`└${line}┘`));
  console.log('');
};

const progressBar = (current: number, total: number, width = 30) => {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  const bar = chalk.green('━'.repeat(filled)) + chalk.gray('━'.repeat(empty));
  const percentStr = chalk.yellow(`${percent}%`);

  return `${bar} ${current}/${total} (${percentStr})`;
};

let lastProgressLine = '';
let statusState: { current: number; total: number; message: string } | null = null;

const renderStatusLine = () => {
  if (!statusState) return;

  const { current, total, message } = statusState;
  const percent = Math.round((current / total) * 100);
  const barWidth = 20;
  const filled = Math.round((current / total) * barWidth);
  const empty = barWidth - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const stats = chalk.cyan(`${current}/${total}`);
  const pct = chalk.yellow(`${percent}%`);
  const msg = chalk.white(message.slice(0, 30).padEnd(30));

  const line = `${bar} ${stats} ${pct} │ ${msg}`;
  process.stdout.write(line);
  lastProgressLine = line;
};

const clearStatusLine = () => {
  if (lastProgressLine) {
    process.stdout.write('\r' + ' '.repeat(lastProgressLine.length) + '\r');
    lastProgressLine = '';
  }
};

const printLine = (text: string) => {
  clearStatusLine();
  console.log(text);
  renderStatusLine();
};

const statusLine = {
  update: (current: number, total: number, message: string) => {
    statusState = { current, total, message };
    clearStatusLine();
    renderStatusLine();
  },

  clear: () => {
    clearStatusLine();
    statusState = null;
  },

  done: () => {
    if (lastProgressLine) {
      process.stdout.write('\n');
      lastProgressLine = '';
    }
    statusState = null;
  },

  print: printLine,
};

const step = (
  num: number,
  total: number,
  msg: string,
  status: 'start' | 'done' | 'fail' = 'start'
) => {
  const stepNum = chalk.gray(`[${num}/${total}]`);

  if (status === 'start') {
    console.log(`  ${chalk.blue('▶')} ${stepNum} ${msg}`);
  } else if (status === 'done') {
    console.log(`  ${chalk.green('✓')} ${stepNum} ${msg}`);
  } else {
    console.log(`  ${chalk.red('✖')} ${stepNum} ${msg}`);
  }
};

const result = (label: string, value: string | number) => {
  console.log(`     ${chalk.gray('└─')} ${label}: ${chalk.yellow(String(value))}`);
};

const keyword = {
  start: (idx: number, total: number, query: string) => {
    const progress = chalk.gray(`[${String(idx).padStart(3)}/${total}]`);
    console.log(`${progress} ${chalk.cyan('🔍')} "${chalk.white(query)}"`);
  },

  success: (type: string, rank: number | string, elapsed: number) => {
    const typeColor = type === '인기글' ? chalk.magenta : chalk.blue;
    console.log(
      `        ${chalk.green('✓')} ${typeColor(type)} ${chalk.yellow(`${rank}위`)} ${chalk.gray(`(${elapsed}ms)`)}`
    );
  },

  fail: (reason: string, elapsed: number) => {
    console.log(
      `        ${chalk.red('✖')} ${chalk.gray(reason)} ${chalk.gray(`(${elapsed}ms)`)}`
    );
  },

  retry: (msg: string) => {
    console.log(`        ${chalk.yellow('↻')} ${chalk.gray(msg)}`);
  },

  skip: (reason: string) => {
    console.log(`        ${chalk.gray('○')} ${chalk.gray(reason)}`);
  },
};

const divider = (title?: string) => {
  if (title) {
    const line = '─'.repeat(20);
    console.log(`\n${chalk.gray(line)} ${chalk.cyan(title)} ${chalk.gray(line)}\n`);
  } else {
    console.log(chalk.gray('─'.repeat(50)));
  }
};

const summary = {
  start: (title: string, items: Array<{ label: string; value: string }>) => {
    const content = items.map((i) => `${i.label}: ${i.value}`);
    drawBox(`🚀 ${title}`, content, 'cyan');
  },

  complete: (title: string, items: Array<{ label: string; value: string }>) => {
    const content = items.map((i) => `✅ ${i.label}: ${i.value}`);
    drawBox(`📊 ${title}`, content, 'green');
  },

  error: (title: string, items: Array<{ label: string; value: string }>) => {
    const content = items.map((i) => `${i.label}: ${i.value}`);
    drawBox(`❌ ${title}`, content, 'red');
  },
};

const logWithStatusLine = (level: string, msg: string) => {
  clearStatusLine();
  winstonLogger.log(level, msg);
  renderStatusLine();
};

export const logger = {
  debug: (msg: string) => logWithStatusLine('debug', msg),
  info: (msg: string) => logWithStatusLine('info', msg),
  success: (msg: string) => logWithStatusLine('success', msg),
  warn: (msg: string) => logWithStatusLine('warn', msg),
  error: (msg: string) => logWithStatusLine('error', msg),

  box: drawBox,
  progress: progressBar,
  step,
  result,
  keyword,
  divider,
  summary,
  statusLine,

  blank: () => printLine(''),
};

export default logger;
