import { Suspense } from "react";
import type { Metadata } from "next";

import { ProfesionalDetailContent } from "@/components/public/ProfesionalDetailContent";
import { createPageMetadata } from "@/lib/seo";

type ProfesionalesDetailPageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProfesionalesDetailPageProps): Promise<Metadata> {
  const { clinicId } = await params;

  return createPageMetadata(
    "Perfil profesional veterinario",
    "Detalle público de profesional o clínica veterinaria vinculada a VETNEB.",
    `/profesionales/${encodeURIComponent(clinicId)}`,
  );
}

export default async function ProfesionalesDetailPage({
  params,
}: ProfesionalesDetailPageProps) {
  const { clinicId } = await params;

  return (
    <Suspense fallback={null}>
      <ProfesionalDetailContent clinicId={clinicId} />
    </Suspense>
  );
}
