const path = require('path');
const appDir = __dirname;

module.exports = {
  apps: [{
    name: 'todo-backend',
    script: 'server/index.js',
    cwd: appDir,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: path.join(appDir, 'logs/error.log'),
    out_file: path.join(appDir, 'logs/out.log'),
    log_file: path.join(appDir, 'logs/combined.log'),
    time: true
  }]
};
