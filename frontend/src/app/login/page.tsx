import { Suspense } from "react";
import type { Metadata } from "next";

import { createPageMetadata } from "@/lib/seo";
import { LoginContent } from "@/components/public/LoginContent";

export const metadata: Metadata = {
  ...createPageMetadata(
    "Iniciar sesión — Portal VETNEB",
    "Acceda al portal privado de Portal VETNEB para gestionar informes, estudios y logística veterinaria.",
    "/login",
  ),
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
