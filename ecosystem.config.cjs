module.exports = {
  apps: [
    {
      // requires `pnpm --dir dashboard build` beforehand (produces dashboard/.next)
      name: 'blog-cron-dashboard',
      cwd: `${__dirname}/dashboard`,
      script: 'pnpm',
      args: 'start -- -p 4500',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.local',
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: '512M',
    },
  ],
};
