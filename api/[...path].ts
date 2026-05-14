import { buildApp } from "../src/app.js";

const app = buildApp();
const ready = app.ready();

export default async function handler(request: any, response: any) {
  await ready;
  app.server.emit("request", request, response);
}
