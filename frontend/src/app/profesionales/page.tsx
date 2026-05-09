import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Red de Profesionales Veterinarios",
  "Directorio y red de profesionales veterinarios en Portal VETNEB. Accedé a informes, estudios y herramientas de gestión clínica.",
  "/profesionales",
);

const specialties = [
  "Clínica general",
  "Cirugía",
  "Diagnóstico por imagen",
  "Laboratorio clínico",
  "Cardiología",
  "Dermatología",
  "Oncología",
  "Neurología",
  "Oftalmología",
  "Medicina interna",
];

const benefits = [
  {
    icon: "🔐",
    title: "Acceso seguro",
    description:
      "Acceso autenticado a informes y estudios de sus pacientes con tokens seguros y trazabilidad completa.",
  },
  {
    icon: "📱",
    title: "Multiplataforma",
    description:
      "Acceda desde cualquier dispositivo: computadora, tablet o celular. Interfaz responsive y optimizada.",
  },
  {
    icon: "📊",
    title: "Seguimiento de casos",
    description:
      "Historial completo de estudios por paciente. Seguimiento del estado de cada análisis en tiempo real.",
  },
  {
    icon: "🤝",
    title: "Integración con clínicas",
    description:
      "Trabaje en conjunto con las clínicas donde ejerce. Acceso compartido con control de permisos.",
  },
];

export default function ProfesionalesPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Red de profesionales veterinarios
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Herramientas digitales diseñadas para el profesional veterinario
            moderno. Gestione estudios, informes y casos clínicos desde un único
            portal.
          </p>
        </div>
      </section>

      {/* Beneficios */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Herramientas para el profesional
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="border-gray-100">
                <CardHeader>
                  <div className="text-3xl mb-2" aria-hidden="true">
                    {benefit.icon}
                  </div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            Especialidades atendidas
          </h2>
          <p className="text-gray-500 text-center mb-8 max-w-xl mx-auto">
            Portal VETNEB da soporte a profesionales de todas las especialidades
            de la medicina veterinaria.
          </p>
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {specialties.map((specialty) => (
              <Badge
                key={specialty}
                variant="secondary"
                className="text-sm px-4 py-1.5"
              >
                {specialty}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¿Querés integrar tu práctica a Portal VETNEB?
          </h2>
          <p className="text-gray-600 leading-relaxed mb-8">
            Contactanos para coordinar el acceso profesional o conocer cómo una
            clínica puede operar con informes digitales, trazabilidad y gestión
            segura desde el portal.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.contacto}>Contactar a VETNEB</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.clinicas}>Ver portal para clínicas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Texto SEO */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Portal veterinario para profesionales en Argentina
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Portal VETNEB está diseñado para acompañar al profesional
            veterinario en su práctica diaria. Desde el acceso a resultados de
            laboratorio hasta el seguimiento de casos clínicos complejos,
            nuestra plataforma centraliza la información que necesita para tomar
            decisiones clínicas informadas.
          </p>
          <p className="text-gray-600 leading-relaxed">
            La red de profesionales de VETNEB está en desarrollo. Próximamente
            podrá crear su perfil profesional, conectar con clínicas y acceder
            a herramientas colaborativas para el sector veterinario argentino.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
