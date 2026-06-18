# Operação da VM AutoMedia

Este documento descreve o fluxo operacional recomendado para rodar o backend, worker, Redis, PostgreSQL e MinIO na VM do home lab.

## Serviços esperados

- `automedia-backend.service`: API Fastify.
- `automedia-video-worker.service`: worker BullMQ/FFmpeg.
- `automedia-postgres`: PostgreSQL em Docker.
- `automedia-redis`: Redis em Docker.
- `automedia-minio`: MinIO/S3 em Docker.

## Deploy automático com rollback

Script:

```bash
npm run vm:deploy
```

O deploy executa:

1. `git pull --ff-only`
2. `npm install`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. `npm run db:push:safe`
7. `npm run db:verify:security`
8. restart de API e worker via `systemctl`
9. healthcheck em `/api/health`

Se o deploy falhar depois de começar, o script tenta `git reset --hard` para o commit anterior, recompila e reinicia os serviços.

Variáveis opcionais:

```env
AUTOMEDIA_BACKEND_DIR=/home/gustavo/automedia/backend
AUTOMEDIA_LOGS_DIR=/home/gustavo/automedia/logs
AUTOMEDIA_BACKEND_SERVICE=automedia-backend
AUTOMEDIA_WORKER_SERVICE=automedia-video-worker
AUTOMEDIA_HEALTH_URL=http://localhost:3333/api/health
```

## Backup automático com systemd timer

Instalação recomendada pelo próprio projeto:

```bash
cd /home/gustavo/automedia/backend
npm run vm:install-timers
systemctl list-timers 'automedia-*'
```

Esse comando cria e ativa:

- `automedia-backup.timer`: backup completo diário às 03:15.
- `automedia-monitor.timer`: monitoramento a cada 10 minutos.

Backup manual:

```bash
npm run backup:full
```

Se quiser instalar manualmente, use a referência abaixo.

Crie `/etc/systemd/system/automedia-backup.service`:

```ini
[Unit]
Description=AutoMedia full backup

[Service]
Type=oneshot
User=gustavo
WorkingDirectory=/home/gustavo/automedia/backend
ExecStart=/usr/bin/npm run backup:full
```

Crie `/etc/systemd/system/automedia-backup.timer`:

```ini
[Unit]
Description=Run AutoMedia full backup daily

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true
Unit=automedia-backup.service

[Install]
WantedBy=timers.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now automedia-backup.timer
systemctl list-timers automedia-backup.timer
```

## Monitoramento simples

Script:

```bash
npm run monitor:health
```

Ele verifica:

- API `/api/health`
- Redis
- configuração do storage
- idade do último backup

Logs:

```text
/home/gustavo/automedia/logs/health-monitor.log
```

Exemplo manual de timer:

```ini
[Unit]
Description=AutoMedia health monitor

[Service]
Type=oneshot
User=gustavo
WorkingDirectory=/home/gustavo/automedia/backend
ExecStart=/usr/bin/npm run monitor:health
```

```ini
[Unit]
Description=Run AutoMedia health monitor every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true
Unit=automedia-monitor.service

[Install]
WantedBy=timers.target
```

## Segurança operacional

- Não commitar `.env`, `.env.local`, `.env.production` ou backups.
- Usar `.env.vm.example` como base e manter `.env.local` apenas na VM.
- Validar ambiente com `npm run env:check` antes de reiniciar serviços.
- Trocar credenciais temporárias do setup antes de abrir a VM para fora da rede.
- Manter `JWT_SECRET`, `ENCRYPTION_KEY`, tokens sociais e `OPENAI_API_KEY` apenas no ambiente da VM.
- Antes de uso externo real, colocar API e mídia atrás de HTTPS.
- Revisar logs depois de deploy e backup:

```bash
journalctl -u automedia-backend -n 100 --no-pager
journalctl -u automedia-video-worker -n 100 --no-pager
journalctl -u automedia-backup -n 100 --no-pager
```

Também é possível consultar resumo pelo frontend na aba **Qualidade**, que consome:

- `GET /api/diagnostics/production-checklist`
- `GET /api/diagnostics/logs`
