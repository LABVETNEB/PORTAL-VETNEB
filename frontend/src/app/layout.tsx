import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

import { AppVersionGate } from "@/components/app-version/AppVersionGate";
import { PwaServiceWorkerRegistrar } from "@/components/pwa/PwaServiceWorkerRegistrar";
import { INTER_FONT_PATH } from "@/lib/fonts";
import { baseMetadata, getOrganizationJsonLd } from "@/lib/seo";
import { SITE_THEME_COLOR } from "@/lib/seo";
import { NORMAL_THEME_MODE, THEME_INIT_SCRIPT_SRC } from "@/lib/theme";

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
    <html lang="es" data-theme={NORMAL_THEME_MODE} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- sync by design: applies persisted theme before first paint */}
        <script src={THEME_INIT_SCRIPT_SRC} />
        <link
          rel="preload"
          href={INTER_FONT_PATH}
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
        <AppVersionGate />
        {children}
      </body>
    </html>
  );
}
