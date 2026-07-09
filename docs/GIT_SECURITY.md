# Seguranca do Git

Este repositório pode versionar estrutura, código, migrations, documentação e arquivos de exemplo.

Nunca devem subir para o Git:

- `.env`, `.env.local`, `.env.production`, `.env.*.local`
- chaves privadas e certificados: `*.pem`, `*.key`, `*.p12`, `*.pfx`
- tokens e credenciais reais em qualquer arquivo
- dumps e artefatos operacionais: `*.dump`, `*.sql.gz`, `*.bak`, `*.backup`, `*.log`
- conteúdo real de `uploads/`, `backups/` e `logs/`
- arquivos pessoais de autenticação como `.npmrc` e `.envrc`

Podem subir:

- `.env.example`
- `.env.vm.example`
- `uploads/.gitkeep`
- `backups/.gitkeep`
- migrations do Prisma em `prisma/migrations/`

Regras práticas:

- arquivos de exemplo devem usar apenas placeholders como `TROCAR_*`, `change-me`, vazio ou valores locais de desenvolvimento
- nunca use segredo real em README, docs, testes ou scripts
- se um segredo foi exposto em commit, considere-o comprometido e rotacione antes de qualquer outra ação
- antes de commitar, rode `npm run git:safety`

O workflow de CI também executa `npm run git:safety` para bloquear arquivos rastreados indevidos e padrões claros de segredo.
