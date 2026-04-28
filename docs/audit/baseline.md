# Baseline técnico — PR 1

Fecha de baseline: 2026-04-14

## Alcance auditado

Repositorio backend actual ejecutado en Windows con pnpm.

Validaciones confirmadas en entorno local:

- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
- `pnpm db:generate`
- `pnpm db:migrate`
- `node .\scripts\db\prepare-known-clinic-user.mjs`
- `pnpm dev`
- login/logout clínica
- login/logout admin
- lectura de reportes
- lectura de study tracking
- lectura de notificaciones

## Estado real del backend

El proyecto actual es un backend Express + TypeScript + Drizzle ORM + PostgreSQL/Supabase.
No existe todavía dashboard Next.js dentro del repositorio.
No existe todavía suite de tests automatizados.
No existe todavía Storybook ni Playwright.
No existe todavía GitHub Actions en el estado anterior a esta PR.

## Hallazgos cerrados antes de esta PR

### 1. TypeScript bloqueado por tipos de nodemailer

Se agregó `@types/nodemailer` para restaurar `pnpm typecheck`.

### 2. Desalineación en `study-tracking.routes.ts`

La ruta clínica intentaba leer `parsed.data.estimatedDeliveryAt`, pero el schema clínico omitía ese campo.
La corrección aplicada deja el cálculo de fecha estimada del lado del backend con `applyEstimatedDeliveryRules`.

### 3. Instalación ruidosa por tooling no esencial

El baseline quedó estabilizado para instalación, compilación y migraciones sin depender de un CLI no integrado a scripts críticos del backend actual.

## Riesgos abiertos

### 1. Roles persistentes todavía incompletos en runtime

Existe migración para `clinic_users.role`, pero la lectura y aplicación de permisos sigue sin estar cerrada de punta a punta en backend.

### 2. Autorización estructural todavía mezclada con environment

La lógica de permisos no está completamente respaldada por datos persistentes.
Ese trabajo queda para la siguiente PR funcional.

### 3. Falta de trazabilidad persistente

`audit_log`, `report_status_history`, `report_access_tokens`, `communication_log`, `email_templates`, `payments`, `payment_webhook_events`, `specialists` y `system_config` todavía no existen como módulos completos.

### 4. Sin quality gates funcionales más allá de typecheck/build

La validación automática agregada en esta PR cubre:

- instalación
- typecheck
- build

Todavía faltan:

- tests backend
- e2e
- dashboards
- lint formal

## Objetivo de esta PR

Esta PR no cambia permisos, ni auth, ni modelo de datos crítico.
Esta PR deja una base revisable y mergeable para seguir con:

1. higiene del repositorio
2. baseline documental
3. CI backend mínimo viable
4. preparación para PR 2 y PR 3

## Siguiente fase recomendada

### PR 2
- hardening de auth admin
- trazabilidad básica de sesión

### PR 3
- roles persistentes en `clinic_users`
- lectura real del rol en middleware
- matriz de permisos backend
- cierre real de Issue #3
