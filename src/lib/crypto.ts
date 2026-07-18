import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1";

function encryptionKey() {
  const configured = process.env.APP_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("APP_ENCRYPTION_KEY must be configured before sensitive values can be stored.");
  }

  const decoded = Buffer.from(configured, "base64");
  if (decoded.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return decoded;
}

export function encryptSecret(value: string) {
  if (value.startsWith(`${PREFIX}:`)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return undefined;
  if (!value.startsWith(`${PREFIX}:`)) return value;

  const [, , ivValue, tagValue, encryptedValue] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Encrypted value is malformed.");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncrypted(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}

export function stableHash(value: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.APP_ENCRYPTION_KEY ?? "irctc-travel-planner";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}
