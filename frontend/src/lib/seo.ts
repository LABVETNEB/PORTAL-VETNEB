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
  "La anatomía patológica veterinaria estudia los motivos, el desarrollo y las consecuencias de distintas enfermedades mediante el análisis de tejidos, órganos y muestras celulares. Servicio patológico veterinario con histopatología, citología, citopatología, hematología, diagnóstico hematológico y hemoparásitos.";
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
    "laboratorio patológico veterinario",
    "laboratorio veterinario",
    "servicio patológico veterinario",
    "patología veterinaria",
    "anatomía patológica veterinaria",
    "histopatología veterinaria",
    "servicio histopatológico veterinario",
    "citología veterinaria",
    "citopatología veterinaria",
    "servicio citopatológico veterinario",
    "hematología veterinaria",
    "diagnóstico hematológico veterinario",
    "servicio hematológico veterinario",
    "hemoparásitos veterinarios",
    "diagnóstico de hemoparásitos",
    "informes veterinarios",
    "estudios veterinarios",
    "diagnóstico veterinario",
    "resultados veterinarios online",
    "VETNEB",
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
        alt: "Portal VETNEB — Laboratorio patológico veterinario, histopatología, citología y hematología",
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
      "Laboratorio patológico veterinario orientado a diagnóstico integral mediante estudio anatomopatológico, citológico y tinciones especiales para clínicas y profesionales.",
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
    knowsAbout: [
      "laboratorio patológico veterinario",
      "servicio patológico veterinario",
      "histopatología veterinaria",
      "citología veterinaria",
      "citopatología veterinaria",
      "hematología veterinaria",
      "diagnóstico hematológico veterinario",
      "hemoparásitos veterinarios",
      "anatomía patológica veterinaria",
    ],
  };
}

// ─── JSON-LD para página de servicios ────────────────────────────────────────

export function getServicesJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Laboratorio patológico veterinario",
    provider: {
      "@type": "MedicalOrganization",
      name: "VETNEB",
      url: SITE_URL,
    },
    description:
      "Servicios patológicos veterinarios para diagnóstico integral: estudio anatomopatológico de tejidos, citología de muestras, tinciones especiales, hematología y seguimiento de informes diagnósticos.",
    areaServed: "Argentina",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servicios de laboratorio patológico veterinario",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Histopatología veterinaria",
            serviceType: "Servicio histopatológico veterinario",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Citología y citopatología veterinaria",
            serviceType: "Servicio citopatológico veterinario",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Hematología veterinaria",
            serviceType: "Servicio hematológico veterinario",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Diagnóstico de hemoparásitos",
            serviceType: "Hemoparásitos veterinarios",
          },
        },
      ],
    },
  };
}
