# Ambientes e `.env.local`

O backend carrega variáveis nesta ordem:

1. `.env.local`
2. `.env`

Na VM/home lab, use `.env.local` como arquivo principal. Ele fica ignorado pelo Git e deve conter os segredos reais.

## Criar `.env.local` na VM

```bash
cd /home/gustavo/automedia/backend
cp .env.vm.example .env.local
nano .env.local
```

Troque todos os valores marcados como `TROCAR_`.

Depois valide:

```bash
npm run env:check
npm run prod:check
npm run infra:check
```

Se tudo passar:

```bash
sudo systemctl restart automedia-backend automedia-video-worker
curl http://localhost:3333/api/health
```

## Variáveis principais da VM

- `DATABASE_URL`: PostgreSQL em Docker na VM.
- `REDIS_URL`: Redis em Docker na VM.
- `JWT_SECRET`: segredo de assinatura dos tokens.
- `ENCRYPTION_KEY`: chave para criptografar tokens sociais.
- `CORS_ORIGIN`: lista de frontends autorizados, incluindo Vercel e local.
- `FRONTEND_URL`: URL principal do frontend.
- `API_PUBLIC_URL`: URL pública ou LAN da API.
- `STORAGE_DRIVER=s3`: usa MinIO/S3.
- `S3_PUBLIC_URL`: URL pela qual o navegador consegue abrir imagens/vídeos.
- `OPENAI_API_KEY`: usada para roteiro e imagens IA.
- `REPLICATE_API_TOKEN`: usada para Kling via Replicate.
- `AI_VIDEO_SEGMENT_ESTIMATED_COST_USD`: custo estimado por segmento IA para o painel.

## Regras de segurança

- Nunca commite `.env.local`.
- Nunca cole `.env.local` inteiro em issue, chat ou README.
- Quando precisar mostrar configuração, use:

```bash
npm run env:check
```

Esse comando mascara valores sensíveis.

## Local usando backend da VM

No frontend local, use:

```env
VITE_API_BASE_URL=http://192.168.1.6:3333/api
```

No frontend da Vercel, use uma URL pública/tunnel/HTTPS quando a API precisar funcionar fora da sua rede.
