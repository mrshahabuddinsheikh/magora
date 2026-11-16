// PM2: keeps the API and the website running 24/7 and restarts them after a crash or reboot.
//   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "magora-api",
      cwd: "./apps/api",
      script: "npm",
      args: "start",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
    },
    {
      name: "magora-web",
      cwd: "./apps/web",
      script: "npm",
      args: "start",
      env: { NODE_ENV: "production" },
      max_memory_restart: "800M",
    },
  ],
};
