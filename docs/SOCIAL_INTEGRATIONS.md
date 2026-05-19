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
- Shopee: OAuth v2 preparado com assinatura HMAC, troca de `code` por `access_token`/`refresh_token`, refresh token e sincronização básica de loja por `get_shop_info`.
- Mercado Livre/Shopee catálogo: marketplace exige fluxo de anúncio/catálogo, não post social. A criação completa de item ainda precisa mapear categoria, atributos obrigatórios, logística, estoque, preço e imagens.

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
SHOPEE_API_BASE_URL="https://partner.shopeemobile.com"
```

## Shopee

Para conectar uma loja Shopee de forma correta:

1. Crie um app na Shopee Open Platform.
2. Configure `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` e `SHOPEE_REDIRECT_URI`.
3. Use a tela de integrações para gerar a URL de autorização.
4. A Shopee redireciona para `/api/platform-callback?platform=shopee&code=...&shop_id=...`.
5. O backend chama `/api/v2/auth/token/get`, salva `access_token`, `refresh_token` e `shop_id`.
6. Use `POST /api/platform-sync-account` com `{ "platform": "shopee" }` para validar a loja conectada.
7. Use `POST /api/platform-refresh-token` com `{ "platform": "shopee" }` para renovar tokens.

Não use e-mail/senha da loja no backend. A integração profissional usa OAuth e chaves de parceiro.

## Pendências fora do código

- Criar apps oficiais nos portais Meta, TikTok, Google, Mercado Livre e Shopee.
- Passar pelas revisões/auditorias exigidas para publicar publicamente.
- Usar storage público real para vídeos/imagens gerados.
- Ativar banco PostgreSQL em produção e rodar `npm run db:deploy`.
