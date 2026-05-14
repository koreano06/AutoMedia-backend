# AutoMedia Backend

Backend planejado para atender o frontend do AutoMedia.

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

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
5. Mídias e vídeos inicialmente mockados.
6. Agendamento local.
