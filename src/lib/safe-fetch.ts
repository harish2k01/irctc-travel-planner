import { lookup } from "dns/promises";
import { isIP } from "net";
import { ApiError } from "@/lib/http";

function ipv4Number(address: string) {
  return address.split(".").reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: string, network: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask);
}

export function isPrivateAddress(value: string) {
  const address = value.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return isPrivateAddress(mapped);

  if (isIP(address) === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
    ].some(([network, prefix]) => inIpv4Range(address, String(network), Number(prefix)));
  }

  if (isIP(address) !== 6) return true;
  return address === "::"
    || address === "::1"
    || address.startsWith("fc")
    || address.startsWith("fd")
    || /^fe[89ab]/.test(address)
    || address.startsWith("ff")
    || address.startsWith("2001:db8:");
}

export async function validateExternalUrl(value: string) {
  const url = new URL(value);
  const allowedProtocol = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
  if (!allowedProtocol || url.username || url.password) {
    throw new ApiError(400, "Only public HTTPS URLs are allowed.", "UNSAFE_URL");
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ApiError(400, "Private network addresses are not allowed.", "UNSAFE_URL");
  }
  return url;
}

export async function fetchExternal(url: URL, init: RequestInit = {}, maxBytes = 1_000_000) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new ApiError(502, "The external response is too large.", "PROVIDER_RESPONSE_TOO_LARGE");
  return response;
}

export async function limitedResponseText(response: Response, maxBytes = 1_000_000) {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new ApiError(502, "The external response is too large.", "PROVIDER_RESPONSE_TOO_LARGE");
  return buffer.toString("utf8");
}
