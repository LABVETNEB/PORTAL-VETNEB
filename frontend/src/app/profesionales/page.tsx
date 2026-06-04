import { Suspense } from "react";
import type { Metadata } from "next";

import { ProfesionalesSearchContent } from "@/components/public/ProfesionalesSearchContent";
import { createPageMetadata, getProfessionalsPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Clínicas y Profesionales Verificados VETNEB",
  "Clínicas y profesionales verificados que trabajan con VETNEB dentro de una red vinculada al laboratorio.",
  "/profesionales",
);

export default function ProfesionalesPage() {
  const professionalsPageJsonLd = getProfessionalsPageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(professionalsPageJsonLd),
        }}
      />
      <Suspense fallback={null}>
        <ProfesionalesSearchContent />
      </Suspense>
    </>
  );
}

