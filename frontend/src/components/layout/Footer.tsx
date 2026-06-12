import {
  ChevronDown,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";

import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
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

const footerLinkGroups = [
  {
    label: "Diagnóstico / Servicios",
    links: [
      { label: "Servicios", href: ROUTES.servicios },
      { label: "Profesionales", href: ROUTES.profesionales },
    ],
  },
  {
    label: "Operación clínica",
    links: [
      { label: "Clínicas", href: ROUTES.clinicas },
      { label: "Precios", href: ROUTES.precios },
    ],
  },
] as const;

const mapsLocationUrl =
  "https://www.google.com/maps?q=Blvd.%20Italia%20274%2C%20Villa%20Maria%2C%20Cordoba%2C%20Argentina";
const mapsEmbedUrl =
  "https://www.google.com/maps?output=embed&q=Blvd.%20Italia%20274%2C%20Villa%20Maria%2C%20Cordoba%2C%20Argentina";

export function FooterFaq() {
  return (
    <section className="relative overflow-hidden bg-vetneb-surface-muted/40 py-12" aria-labelledby="footer-faq-heading">
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
                  className="h-4 w-4 shrink-0 text-primary transition duration-200 group-open:rotate-180 group-open:text-vetneb-teal"
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
  const year = new Date().getFullYear();

  return (
    <footer className="bg-transparent text-sidebar-foreground" role="contentinfo">
      <section
        className="border-t border-white/10 bg-sidebar py-10"
        aria-labelledby="footer-lab-info-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
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

            <div className="overflow-hidden rounded-xl border border-white/14 bg-sidebar/96 shadow-[0_14px_38px_rgba(0,0,0,0.22)]">
              <div className="relative h-52 overflow-hidden border-b border-white/18">
                <iframe
                  title="Mapa de ubicación de Servicio Patológico VETNEB"
                  src={mapsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="h-full w-full border-0 pointer-events-none"
                />
                <div className="pointer-events-none absolute inset-x-3 top-3 rounded-md border border-white/24 bg-sidebar/86 px-3 py-2 text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/95">
                    Ubicación
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-tight">
                    Blvd. Italia 274, Villa María
                  </p>
                  <p className="mt-0.5 text-xs text-sidebar-foreground/90">
                    Córdoba, Argentina
                  </p>
                </div>
              </div>
              <div className="bg-sidebar/92 p-3">
                <PublicExternalControl
                  href={mapsLocationUrl}
                  target="_blank"
                  aria-label="Ver ubicación del laboratorio en Google Maps"
                  className="inline-flex w-full items-center justify-center rounded-md border border-white/22 bg-white px-3 py-2 text-sm font-semibold text-vetneb-navy shadow-[0_6px_14px_rgba(255,255,255,0.22)] transition-colors hover:bg-vetneb-surface-raised hover:text-vetneb-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar/80"
                >
                  Ver ubicación en Maps
                </PublicExternalControl>
              </div>
            </div>
          </div>

          <div className="my-8 h-px bg-white/12" aria-hidden="true" />

          <nav
            className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4"
            aria-label="Mapa institucional y operativo"
          >
            {footerLinkGroups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-white">
                  {group.label}
                </h3>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <PublicRouteControl
                        href={link.href}
                        variant="bare"
                        className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                      >
                        {link.label}
                      </PublicRouteControl>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-white">
                Acceso
              </h3>
              <ul className="space-y-3">
                <li>
                  <PublicRouteControl
                    href={ROUTES.particulares}
                    variant="bare"
                    className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                  >
                    Particulares
                  </PublicRouteControl>
                </li>
                <li>
                  <PublicRouteControl
                    href={ROUTES.login}
                    variant="bare"
                    className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                  >
                    Iniciar sesión
                  </PublicRouteControl>
                </li>
                <li>
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="bare"
                    className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/14 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Solicitar acceso
                  </PublicRouteControl>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-white">
                Contacto
              </h3>
              <ul className="space-y-3">
                <li>
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="bare"
                    className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                  >
                    Contacto
                  </PublicRouteControl>
                </li>
                <li>
                  <PublicExternalControl
                    href="https://wa.me/5493534138946"
                    target="_blank"
                    className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal"
                  >
                    WhatsApp
                  </PublicExternalControl>
                </li>
                <li>
                  <PublicExternalControl
                    href="mailto:lab.vetneb@gmail.com"
                    target="_self"
                    className="text-left text-sm text-sidebar-foreground/74 transition-colors hover:text-vetneb-teal"
                  >
                    Email
                  </PublicExternalControl>
                </li>
              </ul>
            </div>
          </nav>
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
