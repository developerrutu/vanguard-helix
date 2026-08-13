import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY = 32;

export function hashSecret(secret: string): { salt: string; hash: string } {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, KEY, { N, r: R, p: P });
  return { salt: salt.toString("base64url"), hash: hash.toString("base64url") };
}

export function verifySecret(secret: string, saltB64: string, hashB64: string): boolean {
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const want = Buffer.from(hashB64, "base64url");
    const got = scryptSync(secret, salt, want.length, { N, r: R, p: P });
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

export function mintToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function mintRecovery(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

export function mintPlayerId(): string {
  return "p_" + randomBytes(6).toString("hex");
}
