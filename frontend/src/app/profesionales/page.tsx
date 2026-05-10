import { Suspense } from "react";
import type { Metadata } from "next";

import { ProfesionalesSearchContent } from "@/components/public/ProfesionalesSearchContent";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Red de Profesionales Veterinarios",
  "Banco público de profesionales vinculados a VETNEB. Búsqueda por texto libre con coincidencias aproximadas.",
  "/profesionales",
);

export default function ProfesionalesPage() {
  return (
    <Suspense fallback={null}>
      <ProfesionalesSearchContent />
    </Suspense>
  );
}