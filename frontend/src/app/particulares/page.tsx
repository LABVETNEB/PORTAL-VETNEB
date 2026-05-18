import type { Metadata } from "next";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { ParticularesContent } from "@/components/public/ParticularesContent";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...createPageMetadata(
    "Acceso para particulares",
    "Ingreso seguro por token para consultar datos de casos particulares vinculados a VETNEB.",
    "/particulares",
  ),
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParticularesPage() {
  return (
    <PublicLayout>
      <ParticularesContent />
    </PublicLayout>
  );
}
