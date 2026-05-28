export type BuildReportOnlyCspOptions = {
  nonce?: string;
};

function buildDirectives(nonce?: string): readonly string[] {
  const scriptSrc: string[] = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
  const styleSrc: string[] = ["'self'", "'unsafe-inline'"];

  if (nonce) {
    scriptSrc.push(`'nonce-${nonce}'`);
    styleSrc.push(`'nonce-${nonce}'`);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `style-src ${styleSrc.join(" ")}`,
    `script-src ${scriptSrc.join(" ")}`,
    "connect-src 'self' https:",
    "frame-src https://www.google.com https://maps.google.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ];
}

export function buildReportOnlyCsp(
  options: BuildReportOnlyCspOptions = {},
): string {
  return buildDirectives(options.nonce).join("; ");
}

export function buildReportOnlyCspDirectives(
  options: BuildReportOnlyCspOptions = {},
): readonly string[] {
  return buildDirectives(options.nonce);
}