import { config } from "dotenv";

config({ path: ".env.local" });
config();

const rawApiBaseUrl = (process.env.CRUD_CHECK_API_URL || process.env.API_PUBLIC_URL || "http://localhost:3333").replace(/\/$/, "");
const apiBaseUrl = rawApiBaseUrl.endsWith("/api") ? rawApiBaseUrl : `${rawApiBaseUrl}/api`;
const username = process.env.CRUD_CHECK_USERNAME || "admin";
const password = process.env.CRUD_CHECK_PASSWORD || "admin123";

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${options.method || "GET"} ${path} returned non-JSON response: ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text}`);
  }

  return payload;
}

async function main() {
  const login = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  const token = login.token;
  const suffix = Date.now();
  const summary = [];

  async function step(label, path, options = {}) {
    const result = await request(path, { ...options, token });
    summary.push(`OK ${label}`);
    return result;
  }

  let product;
  let comment;
  let post;
  let job;

  try {
    product = await step("product.create", "/products", {
      method: "POST",
      body: { name: `CRUD Test ${suffix}`, status: "draft", input_source: "manual" },
    });
    await step("product.update", `/products/${product.id}`, {
      method: "PATCH",
      body: { status: "review", category: "Teste" },
    });

    comment = await step("comment.create", "/comments", {
      method: "POST",
      body: { content: "eu quero teste", platform: "instagram" },
    });
    await step("comment.update", `/comments/${comment.id}`, {
      method: "PATCH",
      body: { auto_replied: false },
    });
    await step("comment.delete", `/comments/${comment.id}`, { method: "DELETE" });
    comment = null;

    post = await step("post.create", "/posts", {
      method: "POST",
      body: {
        product_id: product.id,
        product_name: product.name,
        platform: "instagram",
        caption: "teste crud",
        status: "scheduled",
        scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });
    await step("post.update", `/posts/${post.id}`, {
      method: "PATCH",
      body: { caption: "teste crud atualizado" },
    });
    await step("post.delete", `/posts/${post.id}`, { method: "DELETE" });
    post = null;

    job = await step("job.create", "/jobs", {
      method: "POST",
      body: { type: "post_publishing", title: `CRUD Job ${suffix}` },
    });
    await step("job.get", `/jobs/${job.id}`);
    await step("job.update", `/jobs/${job.id}`, {
      method: "PATCH",
      body: { status: "cancelled", progress: 100 },
    });
    await step("job.delete", `/jobs/${job.id}`, { method: "DELETE" });
    job = null;

    await step("product.delete", `/products/${product.id}`, { method: "DELETE" });
    product = null;

    console.log(summary.join("\n"));
    console.log("Verificação CRUD concluída.");
  } finally {
    const cleanup = [
      comment && ["/comments", comment.id],
      post && ["/posts", post.id],
      job && ["/jobs", job.id],
      product && ["/products", product.id],
    ].filter(Boolean);

    for (const [basePath, id] of cleanup) {
      await request(`${basePath}/${id}`, { method: "DELETE", token }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
