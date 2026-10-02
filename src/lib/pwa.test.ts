import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import manifest from "@/app/manifest";

it("uses a standalone same-origin manifest and valid PNG installation icons", () => {
  expect(manifest()).toMatchObject({ id: "/", scope: "/", start_url: "/", display: "standalone" });
  for (const icon of manifest().icons ?? []) {
    const bytes = readFileSync(`public${icon.src}`);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    const size = Number(icon.sizes?.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});

it("never intercepts private API or PDF requests and uses only the public fallback when navigation fails", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cached: string[] = [];
  const fetches: string[] = [];
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Promise,
    self: { location: { origin: "https://railwatch.test" }, addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } },
    caches: { open: async () => ({ add: async (path: string) => { cached.push(path); } }), match: async () => "offline", keys: async () => [] },
    fetch: async (request: { url: string }) => { fetches.push(request.url); throw new Error("offline"); },
  });
  let installation: Promise<unknown> | undefined;
  handlers.install({ waitUntil: (promise: Promise<unknown>) => { installation = promise; } });
  await installation;
  expect(cached).toEqual(["/offline.html"]);
  for (const url of ["/api/railwatch/workspace", "/api/railwatch/files/pdf"]) {
    handlers.fetch({ request: { mode: "cors", method: "GET", url: `https://railwatch.test${url}` }, respondWith: () => { throw new Error("Private fetch intercepted"); } });
  }
  let navigation: Promise<unknown> | undefined;
  handlers.fetch({ request: { mode: "navigate", method: "GET", url: "https://railwatch.test/journeys" }, respondWith: (promise: Promise<unknown>) => { navigation = promise; } });
  expect(await navigation).toBe("offline");
  expect(fetches).toEqual(["https://railwatch.test/journeys"]);
});
