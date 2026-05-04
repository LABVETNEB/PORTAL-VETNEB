"use client";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const contactInfo = [
  {
    icon: "📧",
    label: "Email",
    value: "contacto@vetneb.com",
    note: "— datos de ejemplo —",
  },
  {
    icon: "📞",
    label: "Teléfono",
    value: "+54 11 0000-0000",
    note: "— datos de ejemplo —",
  },
  {
    icon: "📍",
    label: "Ubicación",
    value: "Buenos Aires, Argentina",
    note: "— datos de ejemplo —",
  },
];

export function ContactoContent() {
  return (
    <PublicLayout>
      {/* Header */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contacto</h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            ¿Desea registrar su clínica o tiene consultas sobre nuestros
            servicios? Comuníquese con nuestro equipo.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Formulario visual */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Envíenos un mensaje
              </h2>
              <form
                className="space-y-4"
                aria-label="Formulario de contacto"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="nombre"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Nombre
                    </label>
                    <Input
                      id="nombre"
                      type="text"
                      placeholder="Su nombre"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="apellido"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Apellido
                    </label>
                    <Input
                      id="apellido"
                      type="text"
                      placeholder="Su apellido"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="su@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label
                    htmlFor="clinica"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nombre de la clínica (opcional)
                  </label>
                  <Input
                    id="clinica"
                    type="text"
                    placeholder="Clínica Veterinaria..."
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label
                    htmlFor="mensaje"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    rows={5}
                    placeholder="Describa su consulta o solicitud de acceso..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <strong>Nota de desarrollo:</strong> Este formulario es
                  visual. La funcionalidad de envío se integrará con el backend
                  o un servicio de email en un próximo PR.
                </p>
                <Button type="submit" className="w-full" disabled>
                  Enviar mensaje (próximamente)
                </Button>
              </form>
            </div>

            {/* Información de contacto */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Información de contacto
              </h2>
              <div className="space-y-4 mb-8">
                {contactInfo.map((info) => (
                  <Card key={info.label} className="border-gray-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span aria-hidden="true">{info.icon}</span>
                        {info.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 font-medium">{info.value}</p>
                      <p className="text-xs text-amber-500 mt-1">{info.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-2">
                  ¿Es una clínica veterinaria?
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Si desea registrar su clínica en Portal VETNEB, indíquelo en
                  su mensaje. Nuestro equipo se pondrá en contacto para
                  configurar su acceso y explicarle el proceso de integración.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
