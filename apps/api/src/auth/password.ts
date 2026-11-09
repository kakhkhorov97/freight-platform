import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  const parts = stored?.match(/^scrypt:([0-9a-f]{32}):([0-9a-f]{128})$/u);
  const salt = Buffer.from(parts?.[1] ?? "0".repeat(32), "hex");
  const expected = Buffer.from(parts?.[2] ?? "0".repeat(128), "hex");
  const actual = await derive(password, salt);
  return timingSafeEqual(expected, actual) && parts != null;
}
