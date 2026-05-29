# AutoMedia Backend

API do AutoMedia, responsável por dados, autenticação, anúncios base, mídias, geração de vídeos, aprovação, agendamento, publicações, comentários, integrações sociais, marketplace e visão comercial.

O backend foi estruturado para atender o frontend React/Vite e preparar o produto para um fluxo profissional de criação de criativos: anúncio base -> briefing -> IA -> renderização -> revisão -> agendamento -> publicação.

## Status Atual

- API em Fastify com TypeScript.
- Banco PostgreSQL via Prisma.
- Seeds e schema para produtos, mídias, jobs, posts, comentários, contas de plataforma, vendas e despesas.
- Fila BullMQ com Redis.
- Worker de geração de vídeo com FFmpeg.
- Storage local e suporte a Supabase Storage.
- Integração OpenAI Images API para criativos visuais.
- Integrações sociais com modo `mock` e preparação para modo `live`.
- Deploy da API preparado para Vercel.

## Status das Funcionalidades

✅ Backend com Fastify e TypeScript  
✅ Banco PostgreSQL com Prisma  
✅ Schema para produtos, mídias, jobs, posts, comentários e comercial  
✅ Autenticação local/JWT  
✅ Seeds para teste da plataforma  
✅ Fila BullMQ com Redis  
✅ Worker FFmpeg para renderização de vídeos  
✅ Storage local e suporte a Supabase Storage  
✅ API de geração de imagens com OpenAI Images  
✅ Integrações sociais em modo `mock`  
🟡 OpenAI em validação para fluxo profissional de criativos  
🟡 Supabase Storage em configuração para produção  
🟡 Worker de vídeo precisa rodar fora da Vercel em ambiente contínuo  
🔜 Publicação real em redes sociais  
🔜 Integração live com Shopee, Mercado Livre, TikTok e Meta  
🔜 Webhooks/polling para comentários e respostas automáticas  

## Stack

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- BullMQ
- Redis/ioredis
- FFmpeg
- Supabase Storage
- OpenAI Images API
- Zod
- Vitest

## Como Rodar Localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie o `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No PowerShell, se preferir:

```powershell
Copy-Item .env.example .env
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

4. Prepare o banco:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. Inicie a API:

```bash
npm run dev
```

6. Para renderização real de vídeos, rode o worker em outro terminal:

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
npm run worker:video # worker BullMQ de renderização de vídeo
```

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

### Aplicação

```env
NODE_ENV=development
PORT=3333
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="..."
CORS_ORIGIN="http://localhost:5173,https://auto-media-sooty.vercel.app"
FRONTEND_URL="https://auto-media-sooty.vercel.app"
API_PUBLIC_URL="https://auto-media-backend.vercel.app"
```

### IA

```env
OPENAI_API_KEY=""
OPENAI_IMAGE_MODEL="gpt-image-1"
OPENAI_IMAGE_QUALITY="high"
OPENAI_IMAGE_FALLBACK_ENABLED="false"
```

### Storage e Vídeo

```env
STORAGE_DRIVER="local"
UPLOADS_DIR="uploads"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="videos"
VIDEO_RENDER_DRIVER="ffmpeg"
FFMPEG_PATH="ffmpeg"
```

Para produção com Supabase:

```env
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
SUPABASE_STORAGE_BUCKET="videos"
```

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
2. API cria um `Job` e um `MediaAsset`.
3. Job entra na fila BullMQ `video_generation`.
4. Worker pega o job, atualiza status para `rendering`.
5. FFmpeg renderiza o MP4 usando a mídia base.
6. Worker envia o arquivo para storage local ou Supabase.
7. Mídia final vira `pending_review`.
8. Usuário aprova e agenda pelo frontend.

Estados principais do job:

```text
queued -> processing -> rendering -> uploading -> completed
```

Falhas são registradas como:

```text
failed
```

## Produção

Recomendação prática:

- API: Vercel.
- Banco: Supabase Postgres, Neon, Railway Postgres ou outro PostgreSQL gerenciado.
- Redis: Upstash Redis, Railway Redis ou Redis gerenciado.
- Worker de vídeo: Railway, Render, Fly.io, VPS ou container com FFmpeg.
- Storage: Supabase Storage ou S3 compatível.

A Vercel é adequada para a API, mas o worker `npm run worker:video` deve rodar em um serviço com processo contínuo e FFmpeg disponível.

## Deploy na Vercel

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
