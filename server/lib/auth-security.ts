import crypto from "node:crypto";
import argon2 from "argon2";

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashLegacyPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// WBR-15 (VET-15, F1): the legacy SHA-256 password path is verify-only (no
// new password ever hashes through hashLegacyPassword outside this file) and
// must stay supported for historical credentials until a separate,
// DB-inventoried migration (F2/F3) retires it. This comparator only removes
// the non-constant-time `===` string comparison; it does not change which
// hashes are accepted, nor the needsRehash policy.
//
// Buffer.from(x, "hex") never throws on malformed hex — it silently
// truncates at the first invalid byte pair instead — so a malformed or
// wrong-length stored hash safely fails the length check below rather than
// throwing or leaking timing information proportional to a partial match.
function timingSafeHexEqual(computedHex: string, storedHex: string): boolean {
  const computed = Buffer.from(computedHex, "hex");
  const stored = Buffer.from(storedHex, "hex");

  if (computed.length === 0 || computed.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, stored);
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith("$argon2")) {
    const valid = await argon2.verify(storedHash, password);

    return {
      valid,
      needsRehash:
        valid && (await argon2.needsRehash(storedHash, PASSWORD_HASH_OPTIONS)),
    };
  }

  const valid = timingSafeHexEqual(hashLegacyPassword(password), storedHash);

  return {
    valid,
    needsRehash: valid,
  };
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
