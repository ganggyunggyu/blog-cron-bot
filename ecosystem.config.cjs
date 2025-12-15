module.exports = {
  apps: [
    {
      name: 'blog-cron-bot-keywords',
      cwd: __dirname,
      script: 'dist/pm2-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: '512M',
    },
    {
      name: 'blog-cron-bot-root',
      cwd: __dirname,
      script: 'dist/pm2-scheduler-root.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: '512M',
    },
  ],
};
