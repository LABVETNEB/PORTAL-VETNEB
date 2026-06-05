import type { Metadata } from "next";

import { PreciosContent } from "@/components/public/PreciosContent";
import { createPageMetadata, getPreciosPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Precios de Estudios Patológicos Veterinarios",
  "Listado público de estudios de citologías e histopatologías con sus valores de referencia y estado vigente.",
  "/precios",
);

export default function PreciosPage() {
  const jsonLd = getPreciosPageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PreciosContent />
    </>
  );
}
