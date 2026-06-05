import type { Metadata } from "next";
import { createPageMetadata, getContactPageJsonLd } from "@/lib/seo";
import { ContactoContent } from "@/components/public/ContactoContent";

export const metadata: Metadata = createPageMetadata(
  "Contacto — Laboratorio Patológico Veterinario",
  "Contacte con el equipo de Portal VETNEB. Solicite acceso para su clínica o consulte sobre los servicios del laboratorio veterinario.",
  "/contacto",
);

export default function ContactoPage() {
  const jsonLd = getContactPageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ContactoContent />
    </>
  );
}
