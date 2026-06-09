import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const backendDir = resolve(process.env.AUTOMEDIA_BACKEND_DIR || process.cwd());
const user = process.env.AUTOMEDIA_SERVICE_USER || process.env.USER || "gustavo";
const nodePath = process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

const files = {
  "/etc/systemd/system/automedia-backup.service": `[Unit]
Description=AutoMedia full backup
After=docker.service automedia-backend.service

[Service]
Type=oneshot
User=${user}
WorkingDirectory=${backendDir}
Environment=PATH=${nodePath}
ExecStart=/usr/bin/npm run backup:full
`,
  "/etc/systemd/system/automedia-backup.timer": `[Unit]
Description=Run AutoMedia full backup daily

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true
Unit=automedia-backup.service

[Install]
WantedBy=timers.target
`,
  "/etc/systemd/system/automedia-monitor.service": `[Unit]
Description=AutoMedia health monitor
After=docker.service automedia-backend.service automedia-video-worker.service

[Service]
Type=oneshot
User=${user}
WorkingDirectory=${backendDir}
Environment=PATH=${nodePath}
ExecStart=/usr/bin/npm run monitor:health
`,
  "/etc/systemd/system/automedia-monitor.timer": `[Unit]
Description=Run AutoMedia health monitor every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true
Unit=automedia-monitor.service

[Install]
WantedBy=timers.target
`,
};

function sudo(command, args = [], input) {
  const result = spawnSync("sudo", [command, ...args], {
    input,
    encoding: "utf8",
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
  });

  if (result.error || result.status !== 0) {
    throw new Error(`sudo ${command} ${args.join(" ")} falhou.`);
  }
}

for (const [file, content] of Object.entries(files)) {
  console.log(`Instalando ${file}`);
  sudo("tee", [file], content);
}

sudo("systemctl", ["daemon-reload"]);
sudo("systemctl", ["enable", "--now", "automedia-backup.timer", "automedia-monitor.timer"]);

console.log("Timers instalados. Verifique com:");
console.log("systemctl list-timers 'automedia-*'");
