# Deploy do Backend na Vercel

Este backend está preparado para rodar como Vercel Functions usando o arquivo `api/[...path].ts`.

## Frontend atual

```txt
https://auto-media-sooty.vercel.app
```

## Rotas

Local:

```txt
http://localhost:3333/api/health
```

Vercel:

```txt
https://seu-backend.vercel.app/api/health
```

## Variáveis de ambiente na Vercel

Configure no projeto do backend:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=uma-chave-forte
CORS_ORIGIN=https://auto-media-sooty.vercel.app,http://localhost:5173
STORAGE_DRIVER=local
UPLOADS_DIR=uploads
```

## Deploy

```bash
npm install
npm run build
vercel
```

Depois copie a URL gerada e coloque no frontend:

```env
VITE_API_BASE_URL=https://seu-backend.vercel.app/api
```

## Observação importante

A versão atual usa armazenamento em memória. Em produção na Vercel, os dados podem sumir entre invocações e instâncias. Para ficar sólido, o próximo passo é conectar PostgreSQL/Prisma e storage externo.
