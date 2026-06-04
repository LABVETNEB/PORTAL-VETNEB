/**
 * Utilidades SEO — Portal VETNEB
 * Metadata base y helpers para Open Graph, Twitter Cards y JSON-LD.
 */

import type { Metadata } from "next";

// ─── Configuración base ───────────────────────────────────────────────────────

export const SITE_NAME = "Portal VETNEB";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.vetneb.com"
).replace(/\/+$/, "");
export const SITE_DESCRIPTION =
  "La anatomía patológica veterinaria estudia los motivos, el desarrollo y las consecuencias de distintas enfermedades mediante el análisis de tejidos, órganos y muestras celulares. Servicio patológico veterinario con histopatología, citología, citopatología, hematología, diagnóstico hematológico y hemoparásitos.";
export const SITE_LOCALE = "es_AR";
export const SITE_OG_IMAGE_PATH = "/images/hero-microscope-vetneb.webp";
export const SITE_OG_IMAGE_URL = `${SITE_URL}${SITE_OG_IMAGE_PATH}`;
export const SITE_THEME_COLOR = "#0c354e";
export const SITE_BACKGROUND_COLOR = "#f7fbfb";

export function buildCanonicalUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === "/") {
    return SITE_URL;
  }

  return `${SITE_URL}${normalizedPath}`;
}

// ─── Metadata base ────────────────────────────────────────────────────────────

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "VETNEB",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
        url: SITE_OG_IMAGE_URL,
        alt: "Portal VETNEB — Laboratorio patológico veterinario, histopatología, citología y hematología",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE_URL],
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
  const canonicalUrl = buildCanonicalUrl(path);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: SITE_OG_IMAGE_URL,
          alt: "Portal VETNEB — Laboratorio patológico veterinario, histopatología, citología y hematología",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SITE_OG_IMAGE_URL],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// ─── JSON-LD para organización ────────────────────────────────────────────────

export function getOrganizationJsonLd() {
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "VETNEB",
        description:
          "Laboratorio patológico veterinario orientado a diagnóstico integral mediante estudio anatomopatológico, citológico y tinciones especiales para clínicas y profesionales.",
        url: SITE_URL,
        areaServed: {
          "@type": "Country",
          name: "Argentina",
        },
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
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "es-AR",
        publisher: {
          "@id": organizationId,
        },
      },
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
      "@type": "Organization",
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


// ─── JSON-LD para landing de servicio diagnóstico ────────────────────────────

export type DiagnosticServiceJsonLdInput = {
  path: string;
  name: string;
  serviceType: string;
  description: string;
  knowsAbout: string[];
};

export function getDiagnosticServiceJsonLd({
  path,
  name,
  serviceType,
  description,
  knowsAbout,
}: DiagnosticServiceJsonLdInput) {
  const pageUrl = buildCanonicalUrl(path);
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const serviceId = `${pageUrl}#service`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Servicios",
            item: buildCanonicalUrl("/servicios"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name,
        serviceType,
        description,
        url: pageUrl,
        inLanguage: "es-AR",
        areaServed: {
          "@type": "Country",
          name: "Argentina",
        },
        provider: {
          "@id": organizationId,
        },
        isPartOf: {
          "@id": websiteId,
        },
        breadcrumb: {
          "@id": breadcrumbId,
        },
        knowsAbout,
      },
    ],
  };
}

// ─── JSON-LD para página pública de profesionales ────────────────────────────

export function getProfessionalsPageJsonLd() {
  const pageUrl = buildCanonicalUrl("/profesionales");
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const searchPageId = `${pageUrl}#search-results-page`;
  const searchActionTarget = `${pageUrl}?q={search_term_string}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Profesionales",
            item: pageUrl,
          },
        ],
      },
      {
        "@type": ["WebPage", "SearchResultsPage"],
        "@id": searchPageId,
        url: pageUrl,
        name: "Clínicas y Profesionales Verificados VETNEB",
        description:
          "Clínicas y profesionales verificados que trabajan con VETNEB dentro de una red vinculada al laboratorio.",
        inLanguage: "es-AR",
        isPartOf: {
          "@id": websiteId,
        },
        publisher: {
          "@id": organizationId,
        },
        breadcrumb: {
          "@id": breadcrumbId,
        },
        about: [
          "profesionales veterinarios",
          "clínicas veterinarias",
          "laboratorio patológico veterinario",
          "diagnóstico veterinario",
        ],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: searchActionTarget,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
