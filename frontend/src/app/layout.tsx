import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

import { PwaServiceWorkerRegistrar } from "@/components/pwa/PwaServiceWorkerRegistrar";
import { baseMetadata, getOrganizationJsonLd } from "@/lib/seo";
import { SITE_THEME_COLOR } from "@/lib/seo";

export const metadata: Metadata = baseMetadata;

export const viewport: Viewport = {
  themeColor: SITE_THEME_COLOR,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgJsonLd = getOrganizationJsonLd();

  return (
    <html lang="es">
      <head>
        <link
          rel="preload"
          href="/fonts/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <PwaServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
