import { z } from "zod";

export const discordUrlSchema = z.string().url().max(1000).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && ["discord.com", "discordapp.com"].includes(url.hostname)
    && !url.username && !url.password && !url.port && !url.hash && !url.search
    && /^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname);
}, "Use a Discord webhook URL from discord.com.");

export async function sendDiscordMessage(url: string, content: string) {
  discordUrlSchema.parse(url);
  const response = await fetch(url, {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Discord did not accept the message.");
}
