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
// The encoding MUST be validated before decoding, not after. `Buffer.from(x,
// "hex")` does not throw on malformed input: it stops at the first invalid
// byte pair and returns the prefix it managed to decode. So a stored value of
// `<valid 64-char digest>` followed by junk decodes to exactly the same 32
// bytes as the digest itself, passes a decoded-length check, and would make
// timingSafeEqual report a match — accepting a credential record the previous
// string comparison rejected. Requiring the canonical 64-character lowercase
// hex form up front closes that, and the check is on the stored encoding
// rather than on secret-dependent content, so it leaks no comparison timing.
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function timingSafeHexEqual(computedHex: string, storedHex: string): boolean {
  if (!SHA256_HEX_RE.test(storedHex) || !SHA256_HEX_RE.test(computedHex)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(computedHex, "hex"),
    Buffer.from(storedHex, "hex"),
  );
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
