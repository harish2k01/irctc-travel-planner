import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncrypted, stableHash } from "@/lib/crypto";

const key = Buffer.alloc(32, 7).toString("base64");
let previousKey: string | undefined;
let previousSalt: string | undefined;

beforeEach(() => {
  previousKey = process.env.APP_ENCRYPTION_KEY;
  previousSalt = process.env.RATE_LIMIT_SALT;
  process.env.APP_ENCRYPTION_KEY = key;
  process.env.RATE_LIMIT_SALT = "test-salt";
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
  else process.env.APP_ENCRYPTION_KEY = previousKey;
  if (previousSalt === undefined) delete process.env.RATE_LIMIT_SALT;
  else process.env.RATE_LIMIT_SALT = previousSalt;
});

describe("secret storage", () => {
  it("encrypts and authenticates stored secrets", () => {
    const encrypted = encryptSecret("smtp://user:password@example.com:587");
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain("password");
    expect(decryptSecret(encrypted)).toBe("smtp://user:password@example.com:587");
  });

  it("supports legacy plaintext until it is rewritten", () => {
    expect(decryptSecret("legacy-value")).toBe("legacy-value");
  });

  it("produces stable salted hashes", () => {
    expect(stableHash("value")).toBe(stableHash("value"));
    expect(stableHash("value")).not.toBe(stableHash("other"));
  });

  it("rejects invalid encryption key material", () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("value")).toThrow("32-byte key");
  });
});
