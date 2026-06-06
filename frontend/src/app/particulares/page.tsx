import type { Metadata } from "next";
import { FileText } from "lucide-react";

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

const steps = [
  {
    number: "01",
    title: "Recibí tu token",
    description:
      "VETNEB o tu clínica tratante te entregó un código único vinculado a tu caso. Ese token es la clave de acceso.",
  },
  {
    number: "02",
    title: "Ingresá con el token",
    description:
      "Pegá o escribí el token en el formulario de acceso. La sesión queda aislada y no expone datos de otras clínicas ni estudios.",
  },
  {
    number: "03",
    title: "Consultá tu informe",
    description:
      "Una vez validado el token podés consultar el estado del estudio, ver el seguimiento del caso y acceder al informe cuando esté disponible.",
  },
];

export default function ParticularesPage() {
  return (
    <PublicLayout>
      <ParticularesContent />

      {/* Guía de pasos — sin scroll reveal (functional page) */}
      <div className="sec-page-canvas">
        <section
          className="sec-page-section pb-14"
          aria-labelledby="particulares-steps-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="home-section-heading home-section-heading-centered">
              <p className="home-kicker">Cómo funciona</p>
              <h2 id="particulares-steps-heading">
                Tres pasos para consultar tu caso.
              </h2>
              <p>
                El acceso particular es seguro, privado y limitado al caso
                autorizado por el laboratorio.
              </p>
            </div>

            <ol
              className="sec-step-list mx-auto max-w-lg"
              aria-label="Pasos para acceder como particular"
            >
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="sec-step-item"
                  aria-labelledby={`particulares-step-${step.number}`}
                >
                  <div className="sec-step-marker" aria-hidden="true">
                    {step.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="sec-step-label">Paso {step.number}</p>
                    <h3
                      id={`particulares-step-${step.number}`}
                      className="sec-step-title"
                    >
                      {step.title}
                    </h3>
                    <p className="sec-step-desc">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="clinical-muted-band mx-auto mt-10 max-w-2xl rounded-2xl p-6 clinical-surface-shadow">
              <div className="flex items-start gap-3">
                <FileText
                  className="mt-0.5 h-5 w-5 shrink-0 text-vetneb-navy"
                  aria-hidden="true"
                  strokeWidth={1.8}
                />
                <div>
                  <h3 className="font-semibold text-vetneb-ink">
                    ¿No tenés token?
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    El token es emitido por VETNEB al momento de asociar tu
                    caso al sistema. Si tu clínica no te lo entregó aún,
                    consultales directamente o contactá al laboratorio para
                    coordinar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
