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

// 워커는 실행이 없어도 상시 떠 있으므로 유휴 메모리가 그대로 요금이 된다.
// ts-node는 타입스크립트 컴파일러를 프로세스에 계속 물고 있어 앱 코드를 올리기도 전에
// 약 240MB를 더 쓴다(측정: node 41MB / ts-node 284MB). 이미지가 pnpm build로 dist를
// 만들어 두므로 컴파일 산출물을 직접 띄운다.
const workerApps = [
  {
    name: 'exposure-distributed-worker',
    cwd: __dirname,
    script: 'node',
    args: 'dist/exposure-worker.js',
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
