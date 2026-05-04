import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { ContactoContent } from "@/components/public/ContactoContent";

export const metadata: Metadata = createPageMetadata(
  "Contacto — Portal VETNEB",
  "Contacte con el equipo de Portal VETNEB. Solicite acceso para su clínica o consulte sobre los servicios del laboratorio veterinario.",
  "/contacto",
);

export default function ContactoPage() {
  return <ContactoContent />;
}
