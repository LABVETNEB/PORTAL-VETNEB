const NONCE_BYTES = 16;

export function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  globalThis.crypto.getRandomValues(bytes);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export const NONCE_PATTERN: RegExp = /^[A-Za-z0-9+/]+={0,2}$/;