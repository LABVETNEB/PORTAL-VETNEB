import Link from "next/link";

import { ROUTES } from "@/lib/routes";

const faqItems = [
  {
    question: "¿Cuánto tiempo se realiza la fijación en formol?",
    answer:
      "La muestra biológica debe incorporarse inmediatamente después de la extracción a formol al 10% en buen estado. En especímenes de gran tamaño se deben realizar cortes para aumentar la permeabilidad del fijador. Considerando esto, el tiempo de fijación recomendado es de 48-72 horas.",
  },
  {
    question: "¿Cómo se envía la muestra?",
    answer:
      "La muestra biológica debe enviarse en bolsa tipo ziploc, previamente fijada en formol 10% 48-72hs.",
  },
  {
    question: "¿Dónde debo enviar la muestra?",
    answer: "El envío debe coordinarse previo contacto vía WhatsApp.",
  },
  {
    question: "¿Cuánto tiempo lleva realizar el estudio hasta el informe?",
    answer:
      "El tiempo depende de la complejidad del caso. El tiempo límite para informe es de 15 días hábiles contando desde recepción de muestra. Actividad: lunes a viernes. No se realizan informes preliminares.",
  },
  {
    question: "¿Cuál es el costo de estudio?",
    answer:
      "El costo del estudio dependerá del estudio a realizar. Dicho monto será entregado de manera particular y personal cuando se requiera. Existe un costo básico y, dependiendo la complejidad, incrementará su costo por utilización de tinciones especiales.",
  },
];

const labInfo = [
  "Blvd. Italia 274 - Villa María - Córdoba",
  "Horario: Lunes a viernes de 8 a 17hs",
];

const footerLinks = [
  { label: "Servicios", href: ROUTES.servicios },
  { label: "Profesionales", href: ROUTES.profesionales },
  { label: "Clínicas", href: ROUTES.clinicas },
  { label: "Contacto", href: ROUTES.contacto },
];

const mapsEmbedUrl =
  "https://www.google.com/maps?q=Blvd.%20Italia%20274%2C%20Villa%20Maria%2C%20Cordoba%2C%20Argentina&output=embed";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-gray-50" role="contentinfo">
      <section
        className="bg-emerald-50 py-12"
        aria-labelledby="footer-faq-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="footer-faq-heading"
            className="mb-8 text-lg font-bold uppercase tracking-wide text-gray-950"
          >
            Preguntas frecuentes:
          </h2>

          <div className="divide-y divide-gray-500/50">
            {faqItems.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-gray-950">
                  <span>{item.question}</span>
                  <span
                    className="text-lg leading-none transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ˄
                  </span>
                </summary>
                <p className="mt-3 max-w-6xl text-sm leading-relaxed text-gray-900">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-white py-8"
        aria-labelledby="footer-lab-info-heading"
      >
        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.75fr_0.75fr_1.15fr] lg:px-8">
          <div className="text-sm text-gray-950">
            <h2
              id="footer-lab-info-heading"
              className="mb-5 text-sm font-bold uppercase tracking-wide"
            >
              Servicio Patológico VETNEB
            </h2>

            <address className="not-italic">
              <ul className="space-y-3">
                {labInfo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>
                  WhatsApp:{" "}
                  <a
                    href="https://wa.me/5493534138946"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    3534138946
                  </a>
                </li>
                <li>
                  Mail:{" "}
                  <a
                    href="mailto:lab.vetneb@gmail.com"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    lab.vetneb@gmail.com
                  </a>
                </li>
              </ul>
            </address>
          </div>

          <nav aria-label="Navegación secundaria">
            <h3 className="mb-5 text-sm font-semibold text-gray-900">
              Navegación
            </h3>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="mb-5 text-sm font-semibold text-gray-900">
              Acceso
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href={ROUTES.login}
                  className="text-sm text-gray-500 transition-colors hover:text-primary"
                >
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.contacto}
                  className="text-sm text-gray-500 transition-colors hover:text-primary"
                >
                  Solicitar acceso
                </Link>
              </li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
            <iframe
              title="Ubicación de Servicio Patológico VETNEB en Google Maps"
              src={mapsEmbedUrl}
              className="h-40 w-full"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="text-xs text-gray-400">
            &copy; {year} VETNEB. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-400">
            Laboratorio veterinario digital — Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}