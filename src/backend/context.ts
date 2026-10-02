import { AsyncLocalStorage } from "node:async_hooks";
import { parse, serialize, type SerializeOptions } from "cookie";

type Context = { values: Record<string, string | undefined>; outgoing: string[] };
const requests = new AsyncLocalStorage<Context>();

// Each request owns its cookie jar, including concurrent sign-ins and callbacks.
/** Runs a route with isolated request headers and response cookies using async-local storage. */
export async function withRequestContext(request: Request, handler: () => Promise<Response>) {
  const context: Context = { values: parse(request.headers.get("cookie") ?? ""), outgoing: [] };
  return requests.run(context, async () => {
    const response = await handler();
    const headers = new Headers(response.headers);
    for (const value of context.outgoing) headers.append("Set-Cookie", value);
    return new Response(response.body, { status: response.status, headers });
  });
}

/** Returns the cookie jar bound to the current backend request. */
export async function cookies() {
  const context = requests.getStore();
  if (!context) throw new Error("Cookies require a backend request context.");
  return {
    get(name: string) { const value = context.values[name]; return value === undefined ? undefined : { name, value }; },
    set(name: string, value: string, options: SerializeOptions = {}) {
      context.values[name] = value;
      context.outgoing.push(serialize(name, value, options));
    },
    delete(name: string) {
      delete context.values[name];
      context.outgoing.push(serialize(name, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 }));
    },
  };
}
