import { execFileSync } from "node:child_process";

const forbiddenHistoryPathPattern = /^(\.env($|(?!(\.example$|\.vm\.example$))\.)|\.npmrc$|\.envrc$|.*\.(pem|key|p12|pfx|kdbx|dump|bak|backup|log)$|backups\/(?!\.gitkeep$)|uploads\/(?!\.gitkeep$)|logs\/)/i;
const historyContentPatterns = [
  { label: "private key block", regex: "BEGIN [A-Z ]*PRIVATE KEY" },
  { label: "GitHub token", regex: "gh[pousr]_[A-Za-z0-9]{20,}" },
  { label: "OpenAI-style secret", regex: "sk-[A-Za-z0-9]{20,}" },
  { label: "AWS access key", regex: "AKIA[0-9A-Z]{16}" },
  { label: "Google API key", regex: "AIza[0-9A-Za-z_-]{35}" },
];

const issues = new Set();

const historyFiles = execFileSync("git", ["log", "--all", "--name-only", "--pretty=format:"], {
  encoding: "utf8",
}).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

for (const file of historyFiles) {
  if (forbiddenHistoryPathPattern.test(file)) {
    issues.add(`[history-path] ${file} apareceu no historico do Git e merece auditoria/rotacao se conteve dado real.`);
  }
}

for (const rule of historyContentPatterns) {
  const result = execFileSync("git", ["log", "--all", "-G", rule.regex, "--pretty=format:%H", "--", "."], {
    encoding: "utf8",
  }).trim();

  if (result) {
    const commits = result.split(/\r?\n/).filter(Boolean).slice(0, 5).join(", ");
    issues.add(`[history-content] possivel ${rule.label} encontrado em commits antigos: ${commits}`);
  }
}

if (issues.length) {
  console.error("Falha na checagem de seguranca do historico Git:\n");
  for (const issue of [...issues]) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Git history safety check OK: nenhum padrao critico encontrado no historico.");
