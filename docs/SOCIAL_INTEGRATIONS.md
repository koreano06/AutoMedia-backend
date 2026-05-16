# Integrações com redes sociais

O backend suporta dois modos:

- `SOCIAL_INTEGRATIONS_MODE=mock`: simula OAuth/publicação para validar o fluxo.
- `SOCIAL_INTEGRATIONS_MODE=live`: usa OAuth real, salva tokens em `platform_accounts` e chama APIs oficiais quando a plataforma permite.

## Fluxo profissional

1. O frontend chama `POST /api/platform-connect` com `{ "platform": "instagram" }`.
2. Em `mock`, o backend marca a conta como conectada para testes.
3. Em `live`, o backend retorna `oauth_url` e o usuário autoriza no provedor oficial.
4. O provedor redireciona para `GET /api/platform-callback?platform=...&code=...`.
5. O backend troca `code` por token, salva a conta em `platform_accounts` e volta para `/integrations`.
6. Publicações usam `POST /api/post-publish-now` ou `POST /api/platform-publish`.

## Redirect URIs

Cadastre estes redirects nos portais de desenvolvedor:

```env
META_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platform-callback?platform=instagram"
TIKTOK_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platform-callback?platform=tiktok"
YOUTUBE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platform-callback?platform=youtube"
MERCADOLIVRE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platform-callback?platform=mercadolivre"
SHOPEE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platform-callback?platform=shopee"
```

## Publicação implementada

- Instagram: cria container de mídia e publica via Graph API. Exige conta profissional e mídia em URL HTTPS pública.
- Facebook: publica texto ou foto em uma Page via Graph API.
- TikTok: inicia Direct Post via Content Posting API usando `PULL_FROM_URL`. O domínio da mídia precisa estar verificado no TikTok.
- YouTube: faz upload resumível via YouTube Data API para vídeos pequenos. Para produção com vídeos grandes, mova o upload para worker/fila dedicada.
- Mercado Livre/Shopee: em `live`, retornam erro orientativo porque marketplace exige fluxo de anúncio/catálogo, não post social.

## Variáveis

```env
SOCIAL_INTEGRATIONS_MODE="live"
FRONTEND_URL="https://auto-media-sooty.vercel.app"
API_PUBLIC_URL="https://auto-media-backend.vercel.app"
DATABASE_URL="postgresql://..."
```

Meta:

```env
META_CLIENT_ID=""
META_CLIENT_SECRET=""
META_GRAPH_VERSION="v21.0"
```

TikTok:

```env
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""
```

YouTube:

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

Mercado Livre e Shopee:

```env
MERCADOLIVRE_CLIENT_ID=""
MERCADOLIVRE_CLIENT_SECRET=""
SHOPEE_PARTNER_ID=""
SHOPEE_PARTNER_KEY=""
```

## Pendências fora do código

- Criar apps oficiais nos portais Meta, TikTok, Google, Mercado Livre e Shopee.
- Passar pelas revisões/auditorias exigidas para publicar publicamente.
- Usar storage público real para vídeos/imagens gerados.
- Ativar banco PostgreSQL em produção e rodar `npm run db:deploy`.
