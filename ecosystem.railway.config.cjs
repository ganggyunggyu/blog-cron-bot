// Railway(Docker + pm2-runtime) 전용 설정. EC2용 ecosystem.config.cjs / ecosystem.jobs.cjs와 달리
// env_file을 쓰지 않음 — Railway가 컨테이너 프로세스에 환경변수를 직접 주입하므로 각 앱이
// process.env를 그대로 상속받음. EC2 파일들은 EC2 해지 전까지 별도로 그대로 둠.
const deploymentRole = process.env.DEPLOYMENT_ROLE || 'control';

const controlApps = [
    {
      name: 'blog-cron-dashboard',
      cwd: `${__dirname}/dashboard`,
      script: 'node_modules/.bin/next',
      args: `start -p ${process.env.PORT || 4500}`,
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: '512M',
    },
    {
      // 패키지/일반건/도그마루/루트 더보기(인기글더보기 실클릭) 노출체크 (check-old-logic-more-exposure.ts, mode=browser 기본)
      // Codex의 08:00 전체 빠른 노출체크와 겹치지 않도록 08:30에 시작
      name: 'blog-cron-more-check-830am',
      cwd: __dirname,
      script: 'pnpm',
      args: 'old-logic:more-check:daily',
      interpreter: 'none',
      autorestart: false,
      cron_restart: '30 8 * * *',
      time: true,
      env: { TZ: 'Asia/Seoul' },
    },
];

const workerApps = [
  {
    name: 'exposure-distributed-worker',
    cwd: __dirname,
    script: 'pnpm',
    args: 'exposure:worker',
    interpreter: 'none',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    time: true,
    max_memory_restart: '1G',
    env: {
      DISTRIBUTED_WORKER_JOB_CONCURRENCY: '3',
    },
  },
];

module.exports = {
  apps: deploymentRole === 'worker' ? workerApps : controlApps,
};
