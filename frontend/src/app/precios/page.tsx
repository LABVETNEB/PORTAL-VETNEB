import type { Metadata } from "next";

import { PreciosContent } from "@/components/public/PreciosContent";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Lista de precios",
  "Listado público de estudios de citologías e histopatologías con sus valores de referencia y estado vigente.",
  "/precios",
);

export default function PreciosPage() {
  return <PreciosContent />;
}
