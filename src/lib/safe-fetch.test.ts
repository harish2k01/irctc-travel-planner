import { describe, expect, it } from "vitest";
import { fetchExternal, isPrivateAddress, limitedResponseText } from "@/lib/safe-fetch";
import { afterEach, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("provider URL address validation", () => {
  it.each([
    "0.0.0.0",
    "10.10.0.1",
    "100.64.1.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "203.0.113.10",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
  ])("rejects non-public address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it("rejects oversized response bodies", async () => {
    await expect(limitedResponseText(new Response("too large"), 4)).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_TOO_LARGE" });
  });

  it("uses a bounded, no-store, no-redirect external request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchExternal(new URL("https://provider.example.com/pnr"));
    await expect(response.text()).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ cache: "no-store", redirect: "error" }));
  });
});
