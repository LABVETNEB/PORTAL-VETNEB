"use client";

import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";

import { PublicExternalControl } from "@/components/public/PublicRouteControl";
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
    answer: "El envío debe coordinarse previo contacto vía Web o WhatsApp.",
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
  { label: "Particulares", href: ROUTES.particulares },
  { label: "Contacto", href: ROUTES.contacto },
];

const mapsLocationUrl =
  "https://www.google.com/maps?q=Blvd.%20Italia%20274%2C%20Villa%20Maria%2C%20Cordoba%2C%20Argentina";

export function FooterFaq() {
  return (
    <section className="relative overflow-hidden py-12" aria-labelledby="footer-faq-heading">
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="footer-faq-heading" className="mb-8 text-lg font-bold text-foreground">
          Preguntas frecuentes:
        </h2>

        <div className="divide-y divide-vetneb-line/70 rounded-lg border border-vetneb-line/80 bg-card/95 px-5 shadow-[0_18px_52px_rgba(15,45,62,0.10)] ring-1 ring-white/55">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-vetneb-ink">
                <span>{item.question}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-primary transition-colors group-open:text-vetneb-teal"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 max-w-6xl text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const router = useRouter();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-transparent text-sidebar-foreground" role="contentinfo">
      <section
        className="border-t border-white/10 bg-sidebar py-8"
        aria-labelledby="footer-lab-info-heading"
      >
        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.75fr_0.75fr_1.15fr] lg:px-8">
          <div className="text-sm text-sidebar-foreground/82">
            <h2
              id="footer-lab-info-heading"
              className="mb-5 text-sm font-bold text-white"
            >
              Servicio Patológico VETNEB
            </h2>

            <address className="not-italic">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                  <span>{labInfo[0]}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <span>{labInfo[1]}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                  <span>
                    WhatsApp:{" "}
                    <PublicExternalControl
                      href="https://wa.me/5493534138946"
                      target="_blank"
                      className="underline underline-offset-2 hover:text-vetneb-teal"
                    >
                      3534138946
                    </PublicExternalControl>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground/70" aria-hidden="true" />
                  <span>
                    Mail:{" "}
                    <PublicExternalControl
                      href="mailto:lab.vetneb@gmail.com"
                      target="_self"
                      className="underline underline-offset-2 hover:text-vetneb-teal"
                    >
                      lab.vetneb@gmail.com
                    </PublicExternalControl>
                  </span>
                </li>
              </ul>
            </address>
          </div>

          <nav aria-label="Navegación secundaria">
            <h3 className="mb-5 text-sm font-semibold text-white">
              Navegación
            </h3>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <button
                    type="button"
                    onClick={() => router.push(link.href)}
                    className="text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">
              Acceso
            </h3>
            <ul className="space-y-3">
              <li>
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.login)}
                  className="text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                >
                  Iniciar sesión
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.particulares)}
                  className="text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                >
                  Acceso particulares
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.contacto)}
                  className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/8 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Solicitar acceso
                </button>
              </li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/12 bg-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.18)]">
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-100 to-slate-200">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(15,45,62,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,45,62,0.10)_1px,transparent_1px)] [background-size:24px_24px]"
              />
              <div
                aria-hidden="true"
                className="absolute -left-4 top-6 h-12 w-44 rounded-full border border-sky-300/75 bg-sky-200/55"
              />
              <div
                aria-hidden="true"
                className="absolute right-[-2.5rem] top-14 h-16 w-52 rounded-full border border-cyan-300/75 bg-cyan-200/50"
              />
              <div className="absolute inset-x-0 bottom-0 bg-white/86 p-3 backdrop-blur-[1px]">
                <p className="text-xs font-semibold text-vetneb-navy">
                  Blvd. Italia 274, Villa María
                </p>
                <p className="text-[11px] text-vetneb-navy/80">
                  Córdoba, Argentina
                </p>
              </div>
            </div>
            <div className="border-t border-white/18 bg-sidebar/88 p-3">
              <PublicExternalControl
                href={mapsLocationUrl}
                target="_blank"
                aria-label="Ver ubicación del laboratorio en Google Maps"
                className="inline-flex w-full items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-vetneb-navy shadow-sm transition-colors hover:bg-vetneb-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
              >
                Ver ubicación en Maps
              </PublicExternalControl>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="premium-divider mb-6 h-px" aria-hidden="true" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {year} VETNEB. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
