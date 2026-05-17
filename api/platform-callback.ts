import { buildApp } from "../src/app.js";

const app = buildApp();
const ready = app.ready();

export default async function handler(request: any, response: any) {
  await ready;

  request.url = request.url?.startsWith("/api/platform-callback")
    ? request.url
    : `/api/platform-callback${request.url?.includes("?") ? request.url.slice(request.url.indexOf("?")) : ""}`;

  app.server.emit("request", request, response);
}
