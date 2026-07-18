import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function derive(password: string, salt: string, options?: { N?: number; r?: number; p?: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options ?? {}, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION });
  return `scrypt:v1:${COST}:${BLOCK_SIZE}:${PARALLELIZATION}:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");

  if (parts.length === 3 && parts[0] === "scrypt") {
    const [, salt, hash] = parts;
    const key = await derive(password, salt);
    const expected = Buffer.from(hash, "hex");
    return expected.length === key.length && timingSafeEqual(expected, key);
  }

  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const [, , cost, blockSize, parallelization, salt, hash] = parts;
  const key = await derive(password, salt, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
  });
  const expected = Buffer.from(hash, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
