// Same-origin API gateway only. All application logic and secrets live in the backend.
export const dynamic = "force-dynamic";
async function proxy(request: Request) {
  try {
    const incoming = new URL(request.url);
    const url = new URL(incoming.pathname + incoming.search, process.env.BACKEND_URL ?? "http://127.0.0.1:3001");
    const headers = new Headers(request.headers);
    for (const name of ["host", "connection", "transfer-encoding", "content-length", "x-forwarded-host", "x-forwarded-proto"]) headers.delete(name);
    const response = await fetch(url, {
      method: request.method, headers, redirect: "manual", cache: "no-store",
      ...(request.body ? { body: request.body, duplex: "half" as const } : {}), signal: AbortSignal.timeout(300_000),
    });
    const outgoing = new Headers(response.headers);
    for (const name of ["connection", "transfer-encoding", "content-encoding", "content-length"]) outgoing.delete(name);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ error: { code: "BACKEND_UNAVAILABLE", message: "RailWatch is temporarily unavailable. Try again shortly." } }, { status: 503 });
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };
