/**
 * Utilidades SEO — Portal VETNEB
 * Metadata base y helpers para Open Graph, Twitter Cards y JSON-LD.
 */

import type { Metadata } from "next";

// ─── Configuración base ───────────────────────────────────────────────────────

export const SITE_NAME = "Portal VETNEB";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.vetneb.com";
export const SITE_DESCRIPTION =
  "Portal digital de laboratorio veterinario. Informes médicos, estudios veterinarios, gestión de clínicas y logística operativa para profesionales del sector.";
export const SITE_LOCALE = "es_AR";

// ─── Metadata base ────────────────────────────────────────────────────────────

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "laboratorio veterinario",
    "informes veterinarios",
    "portal veterinario",
    "estudios veterinarios",
    "gestión clínica veterinaria",
    "logística veterinaria",
    "VETNEB",
    "diagnóstico veterinario",
    "resultados veterinarios online",
  ],
  authors: [{ name: "VETNEB" }],
  creator: "VETNEB",
  publisher: "VETNEB",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Portal VETNEB — Laboratorio Veterinario Digital",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

// ─── Helper para metadata de páginas ─────────────────────────────────────────

export function createPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
    },
    twitter: {
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

// ─── JSON-LD para organización ────────────────────────────────────────────────

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: "VETNEB",
    description:
      "Laboratorio veterinario digital especializado en diagnóstico, informes médicos y gestión operativa para clínicas veterinarias.",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "Spanish",
    },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    medicalSpecialty: "Veterinary",
  };
}

// ─── JSON-LD para página de servicios ────────────────────────────────────────

export function getServicesJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Laboratorio Veterinario",
    provider: {
      "@type": "MedicalOrganization",
      name: "VETNEB",
      url: SITE_URL,
    },
    description:
      "Servicios de diagnóstico veterinario: hemogramas, bioquímicas, estudios de imagen, gestión digital de informes y logística operativa.",
    areaServed: "Argentina",
  };
}
