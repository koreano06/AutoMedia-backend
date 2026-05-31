import { randomBytes } from "node:crypto";

const secrets = {
  JWT_SECRET: randomBytes(48).toString("base64url"),
  ENCRYPTION_KEY: randomBytes(48).toString("base64url"),
  WEBHOOK_SECRET: randomBytes(48).toString("base64url"),
};

console.log("Novos valores sugeridos. Não commite este output e salve apenas no Vercel/ambiente seguro.\n");
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}

console.log(`
Checklist:
1. Revogar e recriar OPENAI_API_KEY no painel da OpenAI.
2. Atualizar JWT_SECRET, ENCRYPTION_KEY e WEBHOOK_SECRET no Vercel/backend.
3. Reautorizar integrações sociais se ENCRYPTION_KEY anterior não estiver disponível.
4. Redeploy do backend.
5. Rodar npm run prod:check e npm run infra:check.
`);
