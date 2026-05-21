import { buildApp } from "../../src/app.js";

const app = buildApp();
const ready = app.ready();

export default async function handler(request: any, response: any) {
  await ready;

  const catchAllPath = request.query?.path;
  const rawSegments = catchAllPath ? (Array.isArray(catchAllPath) ? catchAllPath : [catchAllPath]) : [];
  const segments = rawSegments.flatMap((segment) => String(segment).split("/")).filter(Boolean);
  const originalUrl = new URL(request.url, "http://localhost");
  originalUrl.searchParams.delete("path");
  const queryString = originalUrl.searchParams.toString();
  request.url = `/api/marketplace-listings/${segments.map((segment) => encodeURIComponent(String(segment))).join("/")}${queryString ? `?${queryString}` : ""}`;

  app.server.emit("request", request, response);
}
