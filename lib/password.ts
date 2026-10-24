import crypto from "node:crypto";

const KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

/** scrypt 密码哈希，格式：scrypt$<salt-hex>$<hash-hex> */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}
