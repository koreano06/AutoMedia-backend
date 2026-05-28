# AutoMedia Backend

Backend planejado para atender o frontend do AutoMedia.

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Para a geração real de vídeos, rode também o worker em outro terminal/serviço:

```bash
npm run worker:video
```

## Banco de Dados

O backend usa PostgreSQL com Prisma. Para preparar o banco:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Veja detalhes em `docs/DATABASE.md`.

## Integrações sociais

O projeto agora separa `mock` e `live` para redes sociais. Veja o passo a passo em `docs/SOCIAL_INTEGRATIONS.md`.

## Geração de vídeos com IA

O fluxo profissional fica separado em API, fila, worker e storage:

- O frontend envia produto, mídias, template, formato, duração, briefing e plataformas para `POST /api/videos/generate`.
- A API cria um `Job` e um `MediaAsset` com status de geração.
- A fila BullMQ envia o trabalho para o worker `video_generation`.
- O worker usa FFmpeg para renderizar o MP4 e envia o arquivo para o storage configurado.
- O resultado volta para a biblioteca de mídia como `pending_review`, pronto para aprovação.

Variáveis principais:

```bash
REDIS_URL="redis://..."
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_STORAGE_BUCKET="videos"
VIDEO_RENDER_DRIVER="ffmpeg"
FFMPEG_PATH="ffmpeg"
```

Em produção na Vercel, mantenha a API na Vercel e rode o `worker:video` em um ambiente que suporte processo contínuo e FFmpeg, como Railway, Render, Fly.io, VPS ou container.

## Estrutura

- `src/modules`: regras de negócio por domínio do produto.
- `src/integrations`: integrações externas de IA, storage, vídeo e coleta.
- `src/queue`: infraestrutura de filas e workers.
- `src/database`: Prisma, migrations e seeds.
- `src/shared`: middlewares, erros, utilitários e tipos reutilizáveis.

## Primeira meta

1. Auth real.
2. CRUD de produtos.
3. Upload de imagem.
4. Jobs assíncronos básicos.
5. Renderização real de vídeos com FFmpeg.
6. Agendamento local.
