module.exports = {
  apps: [
    {
      name: 'memorystory-backend',
      cwd: './backend',
      script: 'dist/index.js',
      interpreter: 'D:/Program Files/nodejs/node.exe',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/memorystory',
        JWT_ACCESS_SECRET: 'rZOJoX0lglaXkX/3umes3z0nQleNbaHVJUyUA/B06jm9snQp3Gu/hA1STGX5GxGa',
        JWT_REFRESH_SECRET: 'WoBdTWenJAnIMyR5TxM1fMdub1bNDoYj2JwgG1eJivn2NFm5t6C536oJLThBBUgA',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: '12',
        CORS_ORIGIN: 'http://localhost:5173',
      },
      // Log configuration
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart policy
      max_restarts: 10,
      max_memory_restart: '300M',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
