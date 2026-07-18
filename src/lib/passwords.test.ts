import { scrypt as scryptCallback } from "crypto";
import { promisify } from "util";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/passwords";

const scrypt = promisify(scryptCallback);

describe("password hashing", () => {
  it("creates a versioned, salted hash and verifies it", async () => {
    const first = await hashPassword("Strong#Password2026");
    const second = await hashPassword("Strong#Password2026");
    expect(first).toMatch(/^scrypt:v1:/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("Strong#Password2026", first)).resolves.toBe(true);
    await expect(verifyPassword("Wrong#Password2026", first)).resolves.toBe(false);
  });

  it("accepts the legacy hash format during migration", async () => {
    const salt = "legacy-salt";
    const key = await scrypt("Legacy#Password2026", salt, 64) as Buffer;
    await expect(verifyPassword("Legacy#Password2026", `scrypt:${salt}:${key.toString("hex")}`)).resolves.toBe(true);
  });

  it("rejects missing and malformed hashes", async () => {
    await expect(verifyPassword("value", null)).resolves.toBe(false);
    await expect(verifyPassword("value", "not-a-password-hash")).resolves.toBe(false);
  });
});
