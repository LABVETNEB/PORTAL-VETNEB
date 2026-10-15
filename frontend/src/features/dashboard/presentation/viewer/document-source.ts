export type DocumentSource = {
  kind: "pdf" | "image";
  url: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
};

export type TrustedDocumentPolicy = { trustedOrigins: readonly string[] };

export function validateDocumentSource(source: DocumentSource, policy: TrustedDocumentPolicy): boolean {
  if (source.kind === "pdf" ? source.mimeType !== "application/pdf" : !["image/jpeg", "image/png", "image/webp"].includes(source.mimeType)) return false;
  try {
    const url = new URL(source.url);
    return url.protocol === "https:" && !url.username && !url.password && policy.trustedOrigins.some((origin) => {
      try {
        const trusted = new URL(origin);
        return trusted.protocol === "https:" && trusted.origin === origin && trusted.origin === url.origin;
      } catch { return false; }
    });
  } catch { return false; }
}
