import crypto from "node:crypto";
import argon2 from "argon2";

export function hashLegacyPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith("$argon2")) {
    const valid = await argon2.verify(storedHash, password);

    return {
      valid,
      needsRehash: valid && (await argon2.needsRehash(storedHash)),
    };
  }

  const valid = hashLegacyPassword(password) === storedHash;

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
