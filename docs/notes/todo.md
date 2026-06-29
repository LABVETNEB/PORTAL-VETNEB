# Portal VETNEB - TODO

> El TODO original de este archivo describía una arquitectura **tRPC + Google
> Sheets** que nunca correspondió al sistema real. Ese contenido histórico se
> archivó en
> [`docs/archive/legacy-trpc-sheets-todo.md`](../archive/legacy-trpc-sheets-todo.md).
> La arquitectura vigente es **Fastify REST + Supabase/Postgres + Drizzle +
> Next.js App Router** — ver `docs/SOURCES_OF_TRUTH.md`.

## Logística operativa

- [x] Definir contrato de dominio MVP de logística (`docs/logistics/MVP_DOMAIN.md`)
- [x] Definir contrato de seguridad logística (`docs/logistics/SECURITY_CONTRACT.md`)
- [x] Definir roadmap incremental de logística (`docs/logistics/ROLLING_ROADMAP.md`)
- [x] Implementar modelo base de visitas de campo (`field_visits`)
- [x] Implementar ubicaciones de visita (`visit_locations`)
- [x] Implementar ventanas horarias (`time_windows`)
- [x] Implementar planes de ruta y paradas (`route_plans`, `route_stops`)
- [x] Implementar modelo de eventos logísticos (`route_events`)
- [x] Implementar SLA básico (`sla_policies`, `sla_instances`)
- [x] Implementar cobertura de cumplimiento SLA
- [x] Implementar métricas básicas de cumplimiento
- [x] Implementar API de métricas de cumplimiento de planes de ruta
- [x] Implementar API de visitas de campo y ventanas horarias
- [x] Implementar API de planes de ruta y paradas
- [x] Implementar ciclo de release de planes de ruta
- [x] Implementar API de eventos logísticos y polling incremental
- [x] Evaluar heurística determinista simple
- [x] Consolidar cierre documental de Phase 4/5 logística
- [x] Definir readiness checklist de optimización avanzada
- [ ] Evaluar optimización avanzada solo con volumen/ROI justificado
