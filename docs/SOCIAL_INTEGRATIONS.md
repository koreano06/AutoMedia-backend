# Integrações com redes sociais

Este backend está preparado para dois modos:

- `SOCIAL_INTEGRATIONS_MODE=mock`: conecta e publica de forma simulada para testar o fluxo completo.
- `SOCIAL_INTEGRATIONS_MODE=live`: usa OAuth real e exige credenciais oficiais das plataformas.

## Fluxo implementado

1. Frontend chama `POST /api/platforms/:platform/connect`.
2. Backend retorna `oauth_url` ou conecta direto em modo `mock`.
3. Em modo `live`, a plataforma redireciona para `GET /api/platforms/:platform/callback`.
4. Backend troca `code` por token e marca a conta como conectada.
5. Publicações usam `POST /api/posts/:id/publish-now`, que chama o provider da plataforma.

## Variáveis principais

```env
FRONTEND_URL="https://auto-media-sooty.vercel.app"
API_PUBLIC_URL="https://auto-media-backend.vercel.app"
SOCIAL_INTEGRATIONS_MODE="mock"
```

Meta Instagram/Facebook:

```env
META_CLIENT_ID=""
META_CLIENT_SECRET=""
META_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platforms/instagram/callback"
META_GRAPH_VERSION="v21.0"
```

TikTok:

```env
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""
TIKTOK_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platforms/tiktok/callback"
```

YouTube:

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
YOUTUBE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platforms/youtube/callback"
```

Mercado Livre e Shopee:

```env
MERCADOLIVRE_CLIENT_ID=""
MERCADOLIVRE_CLIENT_SECRET=""
MERCADOLIVRE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platforms/mercadolivre/callback"

SHOPEE_PARTNER_ID=""
SHOPEE_PARTNER_KEY=""
SHOPEE_REDIRECT_URI="https://auto-media-backend.vercel.app/api/platforms/shopee/callback"
```

## Observações importantes

- YouTube usa OAuth 2.0 e o escopo `https://www.googleapis.com/auth/youtube.upload`.
- TikTok Content Posting API usa escopos como `video.publish` e clientes não auditados podem ter visibilidade limitada.
- Instagram/Facebook exigem app no Meta Developers, permissões de páginas/Instagram e revisão para publicação real.
- Mercado Livre e Shopee têm APIs orientadas a loja/produto, não são redes sociais puras; a publicação real precisa mapear produto/anúncio conforme as regras de cada marketplace.
