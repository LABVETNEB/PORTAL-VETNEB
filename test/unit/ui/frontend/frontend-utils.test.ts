import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UTILS_PATH = "frontend/src/lib/utils.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend utils keep class merge helper backed by clsx and tailwind-merge", () => {
  const source = read(UTILS_PATH);

  assert.ok(source.includes('import { type ClassValue, clsx } from "clsx";'));
  assert.ok(source.includes('import { twMerge } from "tailwind-merge";'));
  assert.ok(source.includes("export function cn(...inputs: ClassValue[])"));
  assert.ok(source.includes("return twMerge(clsx(inputs));"));
});

test("frontend utils keep Argentine date formatting helpers", () => {
  const source = read(UTILS_PATH);

  assert.ok(source.includes("export function formatDate(dateString: string | null | undefined): string"));
  assert.ok(source.includes("export function formatDateTime(dateString: string | null | undefined): string"));
  assert.ok(source.includes('if (!dateString) return "—";'));
  assert.ok(source.includes('new Intl.DateTimeFormat("es-AR"'));
  assert.ok(source.includes('day: "2-digit"'));
  assert.ok(source.includes('month: "2-digit"'));
  assert.ok(source.includes('year: "numeric"'));
  assert.ok(source.includes('hour: "2-digit"'));
  assert.ok(source.includes('minute: "2-digit"'));
});

test("frontend utils keep report status labels and badge variants", () => {
  const source = read(UTILS_PATH);

  assert.ok(source.includes("export function getReportStatusLabel(status: ReportStatus): string"));
  assert.ok(source.includes('uploaded: "Subido"'));
  assert.ok(source.includes('processing: "Procesando"'));
  assert.ok(source.includes('ready: "Listo"'));
  assert.ok(source.includes('delivered: "Entregado"'));
  assert.ok(source.includes("export function getReportStatusVariant("));
  assert.ok(source.includes('uploaded: "outline"'));
  assert.ok(source.includes('processing: "secondary"'));
  assert.ok(source.includes('ready: "default"'));
  assert.ok(source.includes('delivered: "default"'));
});

test("frontend utils keep field visit status labels and badge variants", () => {
  const source = read(UTILS_PATH);

  assert.ok(source.includes("export function getFieldVisitStatusLabel(status: FieldVisitStatus): string"));
  assert.ok(source.includes('pending: "Pendiente"'));
  assert.ok(source.includes('scheduled: "Programado"'));
  assert.ok(source.includes('in_progress: "En curso"'));
  assert.ok(source.includes('done: "Completado"'));
  assert.ok(source.includes('canceled: "Cancelado"'));
  assert.ok(source.includes('no_show: "Sin presencia"'));
  assert.ok(source.includes("export function getFieldVisitStatusVariant("));
  assert.ok(source.includes('canceled: "destructive"'));
  assert.ok(source.includes('no_show: "destructive"'));
});

test("frontend utils keep route plan status labels and badge variants", () => {
  const source = read(UTILS_PATH);

  assert.ok(source.includes("export function getRoutePlanStatusLabel(status: RoutePlanStatus): string"));
  assert.ok(source.includes('draft: "Borrador"'));
  assert.ok(source.includes('planned: "Planificado"'));
  assert.ok(source.includes('released: "Liberado"'));
  assert.ok(source.includes('completed: "Completado"'));
  assert.ok(source.includes("export function getRoutePlanStatusVariant("));
  assert.ok(source.includes('draft: "outline"'));
  assert.ok(source.includes('planned: "secondary"'));
  assert.ok(source.includes('released: "secondary"'));
  assert.ok(source.includes('completed: "default"'));
});
