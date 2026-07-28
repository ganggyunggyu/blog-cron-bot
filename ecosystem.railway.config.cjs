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
      DISTRIBUTED_WORKER_JOB_CONCURRENCY: '1',
    },
  },
];

module.exports = {
  apps: deploymentRole === 'worker' ? workerApps : controlApps,
};
