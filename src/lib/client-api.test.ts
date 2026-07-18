import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ClientApiError } from "@/lib/client-api";

afterEach(() => vi.unstubAllGlobals());

describe("client API requests", () => {
  it("returns the data envelope and adds JSON content type for bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "ticket-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest<{ id: string }>("/api/journeys", { method: "POST", body: "{}" })).resolves.toEqual({ id: "ticket-1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/journeys", expect.objectContaining({ headers: { "Content-Type": "application/json" } }));
  });

  it("throws the structured API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "CONFLICT", message: "Ticket changed.", details: { version: 2 } } }), { status: 409 })));
    const error = await apiRequest("/api/journeys/ticket-1").catch((value) => value);
    expect(error).toBeInstanceOf(ClientApiError);
    expect(error).toMatchObject({ message: "Ticket changed.", code: "CONFLICT", details: { version: 2 } });
  });

  it("uses a safe fallback for an invalid error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 500 })));
    await expect(apiRequest("/api/failure")).rejects.toThrow("The request could not be completed.");
  });
});
