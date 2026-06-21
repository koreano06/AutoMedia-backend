# AutoMedia Backend

API do AutoMedia, responsável por dados, autenticação, anúncios base, mídias, geração de vídeos, aprovação, agendamento, publicações, comentários, integrações sociais, marketplace e visão comercial.

O backend foi estruturado para atender o frontend React/Vite e preparar o produto para um fluxo profissional de criação de criativos: anúncio base -> briefing -> IA -> renderização -> revisão -> agendamento -> publicação.

## Status Atual

- API em Fastify com TypeScript.
- Banco PostgreSQL via Prisma.
- Seeds e schema para produtos, mídias, jobs, posts, comentários, contas de plataforma, vendas e despesas.
- Fila BullMQ com Redis.
- Worker de geração/renderização de vídeo com plano criativo gerado por IA e montagem final via FFmpeg.
- Storage local, S3/MinIO e suporte a Supabase Storage.
- Integração OpenAI Images API para criativos visuais.
- Integrações sociais com modo `mock` e preparação para modo `live`.
- Deploy atual preparado para VM/home lab com systemd, worker contínuo, Redis, PostgreSQL e MinIO.
- Login em produção validado em `POST /api/auth/login`.
- Usuário de teste garantido pelo seed: `admin / admin123`.
- Backup completo testado na VM com PostgreSQL + MinIO.
- API saudável na VM em `GET /api/health`.

## Status das Funcionalidades

- ✅ Backend com Fastify e TypeScript
- ✅ Banco PostgreSQL com Prisma
- ✅ Schema para produtos, mídias, jobs, posts, comentários e comercial
- ✅ Autenticação local/JWT
- ✅ Login público corrigido e validado no backend próprio
- ✅ Seeds para teste da plataforma
- ✅ Fila BullMQ com Redis
- ✅ Worker FFmpeg para renderização de vídeos
- ✅ Pipeline preparado para IA gerar roteiro, cenas, textos de tela e direção visual
- ✅ Storage local, S3/MinIO e suporte a Supabase Storage
- ✅ API de geração de imagens com OpenAI Images
- ✅ Integrações sociais em modo `mock`
- ✅ Rotas privadas protegidas por JWT
- ✅ Rate limit e headers de segurança no backend
- ✅ Tokens sociais criptografados no banco
- ✅ Auditoria básica para login, integrações e publicação
- ✅ Diagnóstico interno de banco, Redis, storage e OpenAI
- ✅ Diagnóstico do pipeline de vídeo com jobs ativos, travados e falhas recentes
- ✅ Refresh token com rotação e revogação no banco
- ✅ Validação forte de upload de imagem por MIME/tamanho
- ✅ Permissões por papel em rotas sensíveis
- ✅ Bloqueio temporário contra brute force no login
- ✅ Scripts de migração segura, verificação de banco, backfill de workspace e rotação de secrets
- ✅ Testes de segurança para autenticação, permissão e assinatura de webhook
- ✅ Testes de services para comments, jobs e posts
- ✅ Smoke test CRUD para validar API real de ponta a ponta
- 🟡 OpenAI em validação para fluxo profissional de roteiros, cenas e criativos
- ✅ Storage persistente com MinIO/S3 na VM
- ✅ Redis em container Docker na VM para BullMQ
- ✅ Worker de vídeo rodando fora da Vercel em ambiente contínuo
- ✅ Worker valida mídia ausente, registra falhas/stalls e limpa temporários após upload
- ✅ Renderização protegida contra falha de URL externa, incluindo HTTP 429, com fallback visual local
- ✅ Camada de vídeo IA externo preparada com Replicate/Kling e fallback para FFmpeg
- ✅ Backup completo de PostgreSQL + MinIO com retenção
- ✅ Script de deploy da VM com validações, restart e rollback simples
- ✅ Monitoramento simples de API, Redis, storage e backup recente
- ✅ Cache de mídia externa para storage próprio antes do render
- ✅ Retry manual de jobs de vídeo falhos via API e frontend
- ✅ Checklist de produção e logs operacionais expostos na aba Qualidade
- ✅ Timers systemd instaláveis para backup e monitoramento automático
- 🟡 URL pública HTTPS definitiva do backend ainda pendente
- 🟡 MinIO público por HTTPS/domínio ainda pendente
- 🟡 OpenAI configurada, mas dependente de quota/billing/rate limit
- 🔜 Publicação real em redes sociais
- 🔜 Integração live com Shopee, Mercado Livre, TikTok e Meta
- 🔜 Webhooks/polling para comentários e respostas automáticas

## Plano de Estabilização

- ✅ 1. Consolidar ambiente de produção
- ✅ 2. Fechar Redis + storage persistente na VM
- ✅ 3. Melhorar acompanhamento em tempo real dos jobs
- ✅ 4. Fortalecer autenticação e sessão
- ✅ 5. Revisar CRUDs ponta a ponta
- ✅ 6. Preparar frontend para API pública do backend na VM
- ✅ 7. Fechar backup completo PostgreSQL + MinIO
- ✅ 8. Adicionar diagnóstico real do pipeline de vídeo
- ✅ 9. Fortalecer resiliência do worker de vídeo
- ✅ 10. Evitar quebra de render quando imagem externa retorna 429 ou bloqueio
- ✅ 11. Criar deploy automático com rollback simples para VM
- ✅ 12. Criar monitoramento simples e documentação de backup agendado
- ✅ 13. Cachear mídia externa em MinIO/S3 antes de renderizar
- ✅ 14. Reprocessar jobs de vídeo falhos pela interface
- ✅ 15. Exibir checklist de produção e logs operacionais no frontend
- ✅ 16. Instalar timers systemd para backup e monitoramento
- 🟡 17. Publicar backend e mídia por HTTPS estável
- 🟡 18. Estabilizar OpenAI real para criativos
- 🔜 19. Implementar integrações sociais live

## Plano de Segurança

- ✅ 1. JWT real no backend e rotas privadas protegidas
- ✅ 2. Escopo por usuário/empresa com `workspace_id` nas entidades principais e backfill aplicado
- ✅ 3. Criptografia de tokens sociais no banco
- ✅ 4. Validação forte de upload e limites por tipo/tamanho
- ✅ 5. Auditoria para ações críticas
- ✅ 6. Assinatura/validação de webhooks externos
- ✅ 7. Rotação e checklist de secrets em produção
- ✅ 8. Diagnóstico interno protegido
- ✅ 9. Refresh token com rotação de sessão
- ✅ 10. Permissões por papel em rotas sensíveis
- ✅ 11. Bloqueio por tentativas repetidas de login
- ✅ 12. Sanitização de dados sensíveis em auditoria
- ✅ 13. Verificação de schema de segurança no banco
- 🟡 14. Trocar senha da VM e credenciais MinIO usadas durante setup
- 🟡 15. Colocar API e mídia atrás de HTTPS antes de uso externo real
- 🔜 16. Adicionar alertas automáticos para falha de backup, worker ou storage

## Roadmap de Produção

- ✅ 1. VM criada e operacional
- ✅ 2. Docker instalado e validado
- ✅ 3. PostgreSQL, Redis e MinIO rodando em Docker
- ✅ 4. Backend rodando via systemd
- ✅ 5. Worker de vídeo rodando via systemd
- ✅ 6. Prisma aplicado no banco da VM
- ✅ 7. Seed com usuário `admin / admin123`
- ✅ 8. Healthcheck da API validado
- ✅ 9. Storage S3/MinIO validado para vídeos
- ✅ 10. Backup completo PostgreSQL + MinIO validado
- ✅ 11. Frontend preparado para apontar local, VM, tunnel ou API pública
- 🟡 12. Domínio/tunnel HTTPS definitivo para `API_PUBLIC_URL`
- 🟡 13. URL pública HTTPS para mídia/MinIO
- 🟡 14. OpenAI real precisa estabilizar quota/billing/rate limit para gerar roteiros, cenas e criativos
- 🔜 15. Publicação Instagram/Meta live
- 🔜 16. Publicação TikTok live
- 🔜 17. Webhooks/polling de comentários
- 🔜 18. Monitoramento e alertas operacionais

Camada atual:

- `POST /api/auth/login` é rota pública com rate limit mais restrito.
- `POST /api/auth/login` foi validada em produção com o usuário de teste `admin / admin123`.
- Rotas privadas exigem `Authorization: Bearer <token>`.
- `GET /api/health`, `GET /api/meta/routes` e callback OAuth continuam públicos.
- Tokens JWT usam `issuer` e `audience`.
- Sessões usam access token curto e refresh token rotativo salvo com hash no banco.
- CORS não aceita `*` em produção.
- Headers HTTP de segurança são aplicados via Helmet.
- Tokens de plataformas são salvos criptografados e nunca retornam ao frontend.
- Contas de plataforma, produtos, mídias, posts, jobs, comentários, marketplace listings e finanças usam `workspace_id`.
- Tentativas repetidas de login são registradas e bloqueadas temporariamente.
- Auditoria mascara tokens, segredos, senhas e emails.
- `GET /api/diagnostics` exige autenticação e mostra saúde de banco, Redis, storage, OpenAI e worker.
- `POST /api/diagnostics/run-checks` inclui `video_pipeline` para detectar jobs de vídeo parados, falhas recentes e fila ativa.
- `GET /api/diagnostics/production-checklist` retorna um checklist seguro de prontidão operacional.
- `GET /api/diagnostics/logs` retorna últimas linhas de logs de deploy, monitoramento e backup sem expor secrets.
- O renderizador FFmpeg tenta baixar a mídia externa, mas se a fonte responder `429`, bloquear hotlink ou falhar, o job continua com uma imagem fallback local para revisão.
- A geração de vídeo tenta cachear imagens/vídeos externos no storage próprio antes de enviar para render, reduzindo dependência de hotlinks.
- Jobs de vídeo `failed` ou `cancelled` podem ser reenfileirados em `POST /api/jobs/:id/retry`.
- Upload de imagem aceita apenas `image/jpeg`, `image/png`, `image/webp` e `image/gif`, com limite de 8 MB.
- Rotas financeiras e exclusão de anúncio exigem papel `admin`.

Depois de atualizar este schema em um banco existente, aplique:

```bash
npm run db:push:safe
npm run db:backfill:security
npm run db:verify:security
```

Backup:

```bash
npm run db:backup
npm run backup:full
```

Operação da VM:

```bash
npm run vm:deploy
npm run monitor:health
npm run vm:install-timers
```

Guia completo:

```text
docs/VM_OPERATIONS.md
```

`db:backup` salva apenas o PostgreSQL usando `pg_dump`.

`backup:full` é o backup recomendado para a VM: ele cria um dump do PostgreSQL, compacta os dados do MinIO quando `MINIO_DATA_DIR` existir e remove backups antigos conforme `BACKUP_RETENTION_DAYS`.

Na VM, instale o cliente PostgreSQL caso ainda não exista:

```bash
sudo apt install -y postgresql-client
```

Exemplo de cron diário às 03:15:

```bash
15 3 * * * cd /home/gustavo/automedia/backend && /usr/bin/npm run backup:full >> /home/gustavo/automedia/logs/backup.log 2>&1
```

Para validar as variáveis essenciais do backend antes de publicar:

```bash
npm run prod:check
```

Para validar Redis e storage persistente em ambiente real:

```bash
npm run infra:check
```

Teste público correto da API:

```bash
curl http://localhost:3333/api/health
```

Se `GET /api` responder `AUTH_REQUIRED`, isso está correto: a raiz da API é protegida. Use `/api/health` para healthcheck público e rotas privadas com `Authorization: Bearer <token>`.

### Upstash Redis

O backend usa BullMQ, então a conexão precisa ser Redis TCP/TLS:

```env
REDIS_URL="rediss://default:SENHA@HOST:PORT"
# ou
UPSTASH_REDIS_URL="rediss://default:SENHA@HOST:PORT"
```

Instalação recomendada no Vercel Marketplace:

```bash
npx vercel integration add upstash/upstash-kv
```

Se o CLI pedir aceite de termos, abra o link mostrado, aceite no navegador e rode o comando novamente. Depois confira se a variável criada é compatível com BullMQ. Se o Marketplace criar apenas `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, copie a URL Redis/TLS do painel da Upstash para `REDIS_URL` ou `UPSTASH_REDIS_URL`.

## Stack

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- BullMQ
- Redis/ioredis
- FFmpeg
- MinIO/S3
- Supabase Storage opcional
- OpenAI Images API
- Zod
- Vitest

## Como Rodar Localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie o `.env.local` a partir do exemplo:

```bash
cp .env.example .env.local
```

No PowerShell, se preferir:

```powershell
Copy-Item .env.example .env.local
```

3. Configure pelo menos:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/automedia?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="troque-por-um-segredo-forte"
CORS_ORIGIN="http://localhost:5173,https://auto-media-sooty.vercel.app"
FRONTEND_URL="http://localhost:5173"
API_PUBLIC_URL="http://localhost:3333"
```

4. Valide o arquivo de ambiente:

```bash
npm run env:check
```

5. Prepare o banco:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

O seed cria/atualiza o usuário inicial:

```text
usuario: admin
senha: admin123
```

6. Inicie a API:

```bash
npm run dev
```

7. Para renderização real de vídeos, rode o worker em outro terminal:

```bash
npm run worker:video
```

## Scripts

```bash
npm run dev          # API em desenvolvimento
npm run build        # Prisma generate + TypeScript build
npm run start        # executa dist/src/server.js
npm run typecheck    # valida TypeScript sem emitir arquivos
npm run test         # testes com Vitest
npm run crud:check   # smoke test CRUD contra API real
npm run check:errors # roda validações e mostra apenas erros
npm run worker:video # worker BullMQ de renderização de vídeo
npm run env:check    # valida .env.local sem expor segredos
npm run prod:check   # valida variáveis essenciais de produção
npm run infra:check  # valida Redis e storage persistente
npm run monitor:health # verifica API, Redis, storage e backup recente
npm run vm:deploy    # deploy na VM com rollback simples
npm run vm:install-timers # instala timers systemd de backup e monitoramento
npm run backup:full  # backup PostgreSQL + MinIO com retenção
```

## Testes e Qualidade

Validação recomendada antes de deploy:

```bash
npm run typecheck
npm test
npm run build
```

Para uma saída limpa que mostra somente falhas:

```bash
npm run --silent check:errors
```

Para incluir o smoke CRUD contra API real:

```powershell
$env:RUN_SMOKE="true"; npm run --silent check:errors; Remove-Item Env:RUN_SMOKE
```

Smoke test contra uma API publicada:

```bash
$env:CRUD_CHECK_API_URL="https://api.seudominio.com/api"
$env:CRUD_CHECK_USERNAME="admin"
$env:CRUD_CHECK_PASSWORD="admin123"
npm run crud:check
```

Esse smoke cria, atualiza e remove registros temporários para validar o contrato real de produtos, comentários, posts e jobs.

Banco:

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

## Variáveis Importantes

O backend usa `.env.local` como arquivo operacional. Esse arquivo nunca deve ir para o Git. Para a VM/home lab, use `.env.vm.example` como base segura:

```bash
cp .env.vm.example .env.local
nano .env.local
npm run env:check
```

Guia completo de ambiente:

```text
docs/ENVIRONMENT.md
```

### Aplicação

```env
NODE_ENV=development
PORT=3333
DATABASE_URL="postgresql://..."
REDIS_URL="rediss://default:SENHA@HOST:PORT"
JWT_SECRET="..."
CORS_ORIGIN="http://localhost:5173,https://auto-media-sooty.vercel.app"
FRONTEND_URL="https://auto-media-sooty.vercel.app"
API_PUBLIC_URL="https://api.seudominio.com"
```

### IA

```env
OPENAI_API_KEY=""
OPENAI_IMAGE_MODEL="gpt-image-1"
OPENAI_IMAGE_QUALITY="high"
OPENAI_IMAGE_FALLBACK_ENABLED="false"
AI_VIDEO_PROVIDER="ffmpeg"
AI_VIDEO_FALLBACK_TO_FFMPEG="true"
REPLICATE_API_TOKEN=""
REPLICATE_KLING_MODEL="kwaivgi/kling-v2.1"
REPLICATE_KLING_MODE="standard"
REPLICATE_POLL_INTERVAL_MS="5000"
REPLICATE_TIMEOUT_MS="420000"
```

### Storage e Vídeo

```env
STORAGE_DRIVER="local"
UPLOADS_DIR="uploads"
BACKUPS_DIR="backups"
BACKUP_RETENTION_DAYS="14"
MINIO_DATA_DIR="../data/minio"
S3_ENDPOINT="http://localhost:9000"
S3_PUBLIC_URL="http://192.168.1.42:9000"
S3_REGION="us-east-1"
S3_BUCKET="automedia-media"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_FORCE_PATH_STYLE="true"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="videos"
VIDEO_RENDER_DRIVER="ffmpeg"
FFMPEG_PATH="ffmpeg"
```

Para produção atual na VM com MinIO:

```env
STORAGE_DRIVER="s3"
S3_ENDPOINT="http://localhost:9000"
S3_PUBLIC_URL="https://media.seudominio.com"
S3_BUCKET="automedia-media"
S3_ACCESS_KEY_ID="automedia"
S3_SECRET_ACCESS_KEY="troque-essa-senha"
S3_FORCE_PATH_STYLE="true"
```

Para produção com Supabase:

```env
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
SUPABASE_STORAGE_BUCKET="videos"
```

Checklist de infraestrutura recomendado para produção:

- `REDIS_URL` ou `UPSTASH_REDIS_URL` deve apontar para Redis gerenciado em formato `redis://` ou `rediss://`.
- Para Upstash/Vercel Marketplace, use o produto `upstash/upstash-kv` e configure uma URL Redis TCP/TLS, não apenas a URL REST.
- Variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` são úteis para cache simples, mas BullMQ precisa de `rediss://...`.
- `STORAGE_DRIVER` deve ser `s3` com MinIO/S3 ou `supabase`.
- Com MinIO, `S3_PUBLIC_URL` precisa ser acessível pelo navegador para preview dos vídeos.
- Para geração de vídeo IA via Replicate/Kling, a imagem inicial também precisa estar em URL pública acessível pela internet, não apenas em `localhost` ou `192.168.x.x`.
- Com Supabase, `SUPABASE_STORAGE_BUCKET` deve existir antes do primeiro render.
- O bucket precisa ser público ou o backend deve evoluir para gerar URLs assinadas.
- O worker de vídeo precisa usar as mesmas variáveis `DATABASE_URL`, `REDIS_URL` e storage da API.
- Rode `npm run infra:check` no ambiente onde a API/worker estiver configurado.

### Integrações Sociais

```env
SOCIAL_INTEGRATIONS_MODE="mock"
```

Use `mock` para testar interface e fluxo sem credenciais oficiais. Use `live` apenas quando as credenciais de cada provedor estiverem configuradas.

Provedores preparados:

- Meta/Instagram/Facebook Graph API
- TikTok Content Posting API
- YouTube Data API
- Mercado Livre
- Shopee Partner API

## Geração de Vídeos com IA

Fluxo atual:

1. Frontend envia produto, mídias, template, formato, duração, briefing e plataformas para `POST /api/videos/generate`.
2. IA gera roteiro, gancho, cenas, textos de tela, CTA, direção visual e plano de montagem.
3. API cria um `Job` e um `MediaAsset`.
4. Job entra na fila BullMQ `video_generation`.
5. Worker pega o job, atualiza status para `rendering`.
6. Se `AI_VIDEO_PROVIDER=replicate_kling`, o worker tenta gerar o vídeo real por IA a partir da imagem inicial pública do produto.
7. Se o provedor externo estiver desativado, sem token, sem URL pública ou falhar, o worker usa FFmpeg como fallback seguro.
8. Worker envia o arquivo final para storage local, MinIO/S3 ou Supabase.
9. Mídia final vira `pending_review`.
10. Usuário aprova e agenda pelo frontend.

Situação atual do fluxo:

- ✅ Contrato frontend -> backend preparado
- ✅ Criação de job e mídia inicial preparada
- ✅ Worker FFmpeg implementado para montagem/renderização
- ✅ Plano criativo preparado para IA orientar cenas, textos e CTA
- ✅ Execução contínua do worker na VM com systemd
- ✅ Storage persistente com MinIO/S3 na VM
- ✅ Feedback granular do job em evolução no frontend
- ✅ Provedor externo Replicate/Kling preparado para image-to-video
- 🟡 Uso real do Replicate/Kling depende de `REPLICATE_API_TOKEN` e URL pública para a imagem inicial
- 🔜 Publicação social real após aprovação

Estados principais do job:

```text
queued -> processing -> rendering -> uploading -> completed
```

Falhas são registradas como:

```text
failed
```

## Produção

Produção atual escolhida para economizar e manter controle:

- API: VM/home lab com systemd.
- Banco: PostgreSQL em Docker na VM.
- Redis: Redis em Docker na VM.
- Worker de vídeo: systemd na VM com FFmpeg.
- Storage: MinIO/S3 em Docker na VM.
- Frontend: Vercel apontando para uma URL pública HTTPS do backend.

Próximo ajuste obrigatório para uso fora da rede local: publicar a API e o MinIO por domínio/tunnel HTTPS. O frontend da Vercel não deve apontar para `192.168.1.42`.

Quando a demanda aumentar, a migração mais simples é manter a mesma arquitetura e trocar cada peça por serviço gerenciado: PostgreSQL gerenciado, Redis gerenciado e S3/Supabase Storage.

### VM/Home Lab

Arquivo de ambiente da VM:

```bash
cd ~/automedia/backend
cp .env.vm.example .env.local
nano .env.local
npm run env:check
```

Use o comando acima na primeira configuração ou sempre que trocar chaves, URLs, provider de IA, storage ou integrações sociais. O `.env.local` fica apenas na VM e não deve ser commitado.

Serviços esperados na VM:

```bash
sudo systemctl status automedia-backend
sudo systemctl status automedia-video-worker
cd ~/automedia && docker compose ps
```

Deploy operacional:

```bash
~/automedia/deploy-backend.sh
```

Antes de reiniciar manualmente os serviços, valide:

```bash
cd ~/automedia/backend
npm run env:check
npm run infra:check
```

Healthcheck:

```bash
curl http://localhost:3333/api/health
```

Backup completo manual:

```bash
cd ~/automedia/backend
npm run backup:full
```

Backup automático diário com cron:

```bash
crontab -e
```

Adicione:

```cron
15 3 * * * cd /home/gustavo/automedia/backend && /usr/bin/npm run backup:full >> /home/gustavo/automedia/logs/backup.log 2>&1
```

Os arquivos são salvos em `BACKUPS_DIR` e backups antigos são removidos conforme `BACKUP_RETENTION_DAYS`.

Alternativa recomendada ao cron: timers systemd instaláveis pelo projeto.

```bash
cd ~/automedia/backend
npm run vm:install-timers
systemctl list-timers 'automedia-*'
```

Timers criados:

- `automedia-backup.timer`: roda `npm run backup:full` todos os dias às 03:15.
- `automedia-monitor.timer`: roda `npm run monitor:health` a cada 10 minutos.

## Deploy na Vercel

O backend pode rodar na Vercel, mas o modo recomendado atual é VM por causa do worker contínuo, FFmpeg e MinIO. Se voltar para Vercel, use:

Configuração recomendada:

- Install Command: `npm install --include=dev`
- Build Command: `npm run build`
- Output/Functions conforme `vercel.json`

Configure no painel da Vercel as variáveis de produção, principalmente:

```env
DATABASE_URL
REDIS_URL
JWT_SECRET
CORS_ORIGIN
FRONTEND_URL
API_PUBLIC_URL
OPENAI_API_KEY
STORAGE_DRIVER
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

## Estrutura

```text
src/
  app.ts
  server.ts
  config/          env, cors, database, queue e storage
  modules/         domínios de negócio
  integrations/    IA, storage, renderização e coletores
  queue/           cliente BullMQ e runner
  shared/          erros, middlewares, tipos e utilitários
prisma/
  schema.prisma
  seed.ts
tests/
uploads/
api/
```

## Módulos Principais

- `auth`: autenticação.
- `products`: anúncios base.
- `media`: biblioteca de mídia.
- `videos`: geração e fila de vídeos.
- `approvals`: aprovação/rejeição.
- `posts`: agendamento/publicação.
- `comments`: comentários e intenção de compra.
- `platforms`: contas conectadas e provedores.
- `settings`: automações.
- `reports`: indicadores.
- `commercial`: ERP leve, vendas, custos e margem.

## Documentação Interna

- `docs/DATABASE.md`: modelo de dados e operação do banco.
- `docs/SOCIAL_INTEGRATIONS.md`: como configurar integrações sociais reais.

## Segurança

- Nunca coloque chaves reais no frontend.
- Nunca commite `.env` ou `.env.local`.
- Use `SUPABASE_SERVICE_ROLE_KEY` apenas no backend.
- Rotacione qualquer chave exposta acidentalmente.
- Em produção, troque `JWT_SECRET` por um segredo forte.
