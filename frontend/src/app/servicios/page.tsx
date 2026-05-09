import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPageMetadata, getServicesJsonLd } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Servicios de Laboratorio Veterinario",
  "Informes médicos veterinarios, estudios diagnósticos, gestión digital de clínicas y logística operativa. Conocé todos los servicios de Portal VETNEB.",
  "/servicios",
);

const serviceCategories = [
  {
    id: "informes",
    title: "Informes Médicos Veterinarios",
    icon: "📋",
    description:
      "Gestión completa del ciclo de vida de informes médicos veterinarios. Desde la carga hasta la entrega digital segura a la clínica.",
    features: [
      "Carga y procesamiento de estudios",
      "Estados en tiempo real: subido, procesando, listo, entregado",
      "Descarga segura con URLs firmadas y con vencimiento",
      "Historial completo por paciente y clínica",
      "Búsqueda y filtrado avanzado",
      "Notificaciones de cambio de estado",
    ],
  },
  {
    id: "estudios",
    title: "Estudios Veterinarios",
    icon: "🔬",
    description:
      "Procesamiento y gestión de una amplia gama de estudios diagnósticos veterinarios con trazabilidad completa.",
    features: [
      "Hemograma completo y diferencial",
      "Bioquímica sérica y hepática",
      "Uroanálisis y sedimento urinario",
      "Estudios de imagen (radiografía, ecografía)",
      "Citologías y anatomía patológica",
      "Seguimiento de casos clínicos",
    ],
  },
  {
    id: "gestion",
    title: "Gestión Digital de Clínicas",
    icon: "🏥",
    description:
      "Portal centralizado para que las clínicas veterinarias administren su relación con el laboratorio de forma eficiente.",
    features: [
      "Dashboard privado por clínica",
      "Gestión de usuarios y roles",
      "Acceso a informes con tokens seguros",
      "Auditoría de accesos y acciones",
      "Perfil público de la clínica",
      "Integración con flujos de trabajo existentes",
    ],
  },
  {
    id: "logistica",
    title: "Logística Operativa",
    icon: "🚐",
    description:
      "Sistema de planificación y seguimiento de visitas de campo y rutas de entrega para optimizar las operaciones del laboratorio.",
    features: [
      "Planificación de rutas de entrega",
      "Seguimiento de visitas de campo",
      "Eventos de ruta en tiempo real",
      "Métricas de cumplimiento y SLA",
      "Optimización heurística de recorridos",
      "Reportes operativos",
    ],
  },
];

export default function ServiciosPage() {
  const jsonLd = getServicesJsonLd();

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Servicios del laboratorio
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Soluciones digitales completas para la gestión de diagnóstico
            veterinario. Desde el estudio hasta la entrega del informe.
          </p>
        </div>
      </section>

      {/* Servicios */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {serviceCategories.map((service) => (
              <Card
                key={service.id}
                id={service.id}
                className="border-gray-100 hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="text-4xl mb-3" aria-hidden="true">
                    {service.icon}
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span
                          className="mt-0.5 text-primary font-bold text-xs"
                          aria-hidden="true"
                        >
                          →
                        </span>
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¿Necesitás digitalizar la gestión de estudios?
          </h2>
          <p className="text-gray-600 leading-relaxed mb-8">
            Solicitá acceso para tu clínica o contactanos para conocer cómo
            Portal VETNEB puede acompañar el flujo completo de informes,
            logística y trazabilidad.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.contacto}>Solicitar información</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.clinicas}>Ver solución para clínicas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Texto SEO adicional */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Laboratorio veterinario digital en Argentina
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Portal VETNEB es la plataforma digital de referencia para la gestión
            de laboratorio veterinario en Argentina. Ofrecemos a clínicas y
            profesionales veterinarios un sistema centralizado, seguro y
            eficiente para el manejo de estudios diagnósticos, informes médicos
            y logística operativa.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Nuestra plataforma está diseñada para reducir los tiempos de entrega
            de resultados, mejorar la comunicación entre el laboratorio y las
            clínicas, y garantizar la trazabilidad completa de cada estudio
            desde su ingreso hasta su entrega final.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
