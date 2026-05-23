import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter, Source_Sans_3 } from "next/font/google";
import "./globals.css";

import { PwaServiceWorkerRegistrar } from "@/components/pwa/PwaServiceWorkerRegistrar";
import { baseMetadata, getOrganizationJsonLd } from "@/lib/seo";
import { SITE_THEME_COLOR } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-sans-3",
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="es" className={`${inter.variable} ${sourceSans.variable}`}>
      <head>
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
