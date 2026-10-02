import "dotenv/config";
import Fastify from "fastify";
import { Readable } from "node:stream";
import { routes } from "./routes.generated";
import { withRequestContext } from "./context";
import { startScheduler } from "./scheduler";
import { prisma } from "@/lib/db";
import { routeError } from "@/lib/http";

export function createBackend() {
  const server = Fastify({ bodyLimit: 8_000_000, requestTimeout: 30_000, connectionTimeout: 30_000, logger: false });
  server.removeAllContentTypeParsers();
  server.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
  for (const route of routes) {
    server.route({
      method: route.method, url: route.path,
      handler: async (incoming, reply) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const origin = process.env.APP_URL ?? "http://localhost:3000";
        // APP_URL is the canonical browser origin, never an untrusted forwarded host.
        headers.set("x-forwarded-host", new URL(origin).host);
        const request = new Request(new URL(incoming.url, origin), {
          method: incoming.method, headers,
          ...(incoming.body ? { body: incoming.body as Uint8Array<ArrayBuffer> } : {}),
        });
        const params = incoming.params as Record<string, string>;
        const response = await withRequestContext(request, async () => {
          try { return await route.handler(request, { params: Promise.resolve(params) }); }
          catch (error) { return routeError(error, request); }
        });
        reply.code(response.status);
        response.headers.forEach((value, name) => { if (name !== "set-cookie") reply.header(name, value); });
        const setCookies = response.headers.getSetCookie();
        if (setCookies.length) reply.header("set-cookie", setCookies);
        return response.body ? reply.send(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream)) : reply.send();
      },
    });
  }
  server.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({ error: { code: status === 413 ? "PAYLOAD_TOO_LARGE" : "REQUEST_FAILED", message: status === 413 ? "The request is too large." : "The request could not be completed." } });
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  const server = createBackend();
  await server.listen({ port: Number(process.env.BACKEND_PORT ?? 3001), host: process.env.BACKEND_HOST ?? "0.0.0.0" });
  const stopScheduler = process.env.SCHEDULER_ENABLED === "false" ? async () => {} : startScheduler();
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await server.close(); await stopScheduler(); await prisma.$disconnect(); };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
