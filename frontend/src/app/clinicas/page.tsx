import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    description: "Complete el formulario de contacto para registrar su clínica en Portal VETNEB.",
  },
  {
    number: "02",
    title: "Configure su cuenta",
    description: "Reciba sus credenciales y configure los usuarios de su equipo con los roles apropiados.",
  },
  {
    number: "03",
    title: "Acceda a sus informes",
    description: "Desde el dashboard privado, acceda a todos los informes y estudios de su clínica.",
  },
  {
    number: "04",
    title: "Gestione su operación",
    description: "Utilice las herramientas de seguimiento, logística y auditoría para optimizar su práctica.",
  },
];

export default function ClinicasPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Portal para clínicas veterinarias
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Gestión centralizada de informes, estudios y logística para su
            clínica veterinaria. Acceso seguro, trazable y disponible las 24 hs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="bg-white text-blue-900 hover:bg-blue-50 font-semibold"
            >
              <Link href={ROUTES.login}>Acceder al portal</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10"
            >
              <Link href={ROUTES.contacto}>Solicitar acceso</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Todo lo que necesita su clínica
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-gray-100 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="text-3xl mb-2" aria-hidden="true">
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

      {/* Cómo funciona */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Cómo comenzar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white font-bold text-lg mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
