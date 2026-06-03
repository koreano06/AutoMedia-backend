import { buildApp } from "../../src/app.js";

const app = buildApp();
const ready = app.ready();

export default async function handler(request: any, response: any) {
  await ready;

  const rawId = request.query?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const originalUrl = new URL(request.url, "http://localhost");
  originalUrl.searchParams.delete("id");
  const queryString = originalUrl.searchParams.toString();

  request.url = `/api/jobs/${encodeURIComponent(String(id || ""))}${queryString ? `?${queryString}` : ""}`;
  app.server.emit("request", request, response);
}

