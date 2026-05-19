# Banco de Dados

Este backend usa PostgreSQL com Prisma.

## Estrutura

```txt
prisma/
  schema.prisma   # modelos e relações do banco
  seed.ts         # dados iniciais

src/database/
  prisma.ts       # Prisma Client compartilhado
```

## Tabelas Principais

- `users`: usuários e permissões.
- `products`: produtos recebidos por imagem, link ou cadastro manual.
- `product_analyses`: histórico de análises de IA.
- `media_assets`: imagens, vídeos coletados e vídeos gerados.
- `media_collection_sources`: origem dos arquivos coletados.
- `approvals`: histórico de aprovação/rejeição.
- `posts`: publicações agendadas/publicadas.
- `post_metrics`: métricas históricas das publicações.
- `comments`: comentários monitorados.
- `comment_reply_logs`: histórico de respostas automáticas.
- `platform_accounts`: integrações com redes sociais/marketplaces.
- `automation_settings`: preferências de automação.
- `jobs`: tarefas assíncronas.
- `campaigns`: campanhas comerciais/editoriais.
- `audit_logs`: auditoria para ações importantes.

## Rodar Localmente

1. Crie `.env` a partir de `.env.example`.
2. Configure `DATABASE_URL`.
3. Rode:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Para abrir o painel do Prisma:

```bash
npm run db:studio
```

## Produção

Na Vercel, configure:

```env
DATABASE_URL=postgresql://...
```

Depois rode migrations no ambiente de deploy ou local apontando para o banco de produção:

```bash
npm run db:deploy
```

## Status Atual

Os módulos principais já usam Prisma/PostgreSQL como fonte de dados:

- `products`
- `media`
- `posts`
- `comments`
- `jobs`
- `settings`
- `platforms`

O banco em memória fica apenas como referência histórica/dados demo antigos, não como storage principal da API.
