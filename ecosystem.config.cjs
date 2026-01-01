const path = require('path');
const appDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'todo-backend',
      script: 'server/index.js',
      cwd: appDir,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: path.join(appDir, 'logs/error.log'),
      out_file: path.join(appDir, 'logs/out.log'),
      log_file: path.join(appDir, 'logs/combined.log'),
      time: true
    },
    {
      name: 'todo-frontend',
      cwd: path.join(appDir, 'client'),
      script: 'node_modules/.bin/vite',
      args: '--host',
      env: {
        NODE_ENV: 'development'
      },
      error_file: path.join(appDir, 'logs/frontend-error.log'),
      out_file: path.join(appDir, 'logs/frontend-out.log'),
      time: true
    }
  ]
};
