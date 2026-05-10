import type { Metadata } from "next";
import Link from "next/link";

import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal para Clínicas Veterinarias",
  "Acceso al portal de gestión para clínicas veterinarias. Informes, seguimiento de estudios, logística y auditoría desde un único lugar.",
  "/clinicas",
);

const features = [
  {
    icon: "📥",
    title: "Recepción de informes",
    description:
      "Reciba los resultados de estudios directamente en su portal. Notificaciones automáticas cuando un informe esté listo.",
  },
  {
    icon: "🔍",
    title: "Búsqueda avanzada",
    description:
      "Encuentre informes por paciente, tipo de estudio, fecha o estado. Filtros potentes para gestionar grandes volúmenes.",
  },
  {
    icon: "📦",
    title: "Seguimiento de logística",
    description:
      "Vea el estado de las visitas de campo y entregas programadas para su clínica. Transparencia total en el proceso.",
  },
  {
    icon: "🔒",
    title: "Acceso seguro y auditado",
    description:
      "Cada acceso a informes queda registrado. Control total sobre quién accede a qué información y cuándo.",
  },
  {
    icon: "👥",
    title: "Gestión de usuarios",
    description:
      "Administre los usuarios de su clínica con roles diferenciados: propietario y personal de clínica.",
  },
  {
    icon: "🌐",
    title: "Perfil público",
    description:
      "Mantenga actualizado el perfil público de su clínica en el directorio de Portal VETNEB.",
  },
];

const steps = [
  {
    number: "01",
    title: "Solicite acceso",
    description:
      "Complete el formulario de contacto para registrar su clínica en Portal VETNEB.",
  },
  {
    number: "02",
    title: "Configure su cuenta",
    description:
      "Reciba sus credenciales y configure los usuarios de su equipo con los roles apropiados.",
  },
  {
    number: "03",
    title: "Acceda a sus informes",
    description:
      "Desde el dashboard privado, acceda a todos los informes y estudios de su clínica.",
  },
  {
    number: "04",
    title: "Gestione su operación",
    description:
      "Utilice las herramientas de seguimiento, logística y auditoría para optimizar su práctica.",
  },
];

export default function ClinicasPage() {
  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 py-16 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Portal para clínicas veterinarias
          </h1>
          <p className="max-w-2xl text-xl text-blue-100">
            Gestión centralizada de informes, estudios y logística para su
            clínica veterinaria. Acceso seguro, trazable y disponible las 24 hs.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white font-semibold text-blue-900 hover:bg-blue-50"
            >
              <Link href={ROUTES.login}>Acceder al portal</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-white/70 bg-blue-950/20 font-semibold text-white shadow-sm hover:bg-white hover:text-blue-900"
            >
              <Link href={ROUTES.contacto}>Solicitar acceso</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Todo lo que necesita su clínica
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-gray-100 transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-2 text-3xl" aria-hidden="true">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Cómo comenzar
          </h2>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}