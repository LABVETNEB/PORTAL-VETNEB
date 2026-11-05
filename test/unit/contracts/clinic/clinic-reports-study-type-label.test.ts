import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStudyTypeDisplay,
  STUDY_TYPE_LABELS,
  STUDY_TYPE_MISSING_LABEL,
} from "../../../../frontend/src/lib/study-types.ts";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const STUDY_TYPES_PATH = "frontend/src/lib/study-types.ts";

const occurrences = (source: string, needle: string) => source.split(needle).length - 1;

test("catalog ids render as accented uppercase labels", () => {
  assert.equal(formatStudyTypeDisplay("histopatologia"), "HISTOPATOLOGÍA");
  assert.equal(formatStudyTypeDisplay("hemoparasitos"), "HEMOPARÁSITOS");
  assert.equal(formatStudyTypeDisplay("citologia"), "CITOLOGÍA");
});

test("historical stored labels resolve to the same catalog label", () => {
  for (const historical of ["Histopatología", "HISTOPATOLOGIA", " histopatologia ", "HistoPatología"]) {
    assert.equal(formatStudyTypeDisplay(historical), "HISTOPATOLOGÍA", historical);
  }
  assert.equal(formatStudyTypeDisplay("Hemoparásitos"), "HEMOPARÁSITOS");
  assert.equal(formatStudyTypeDisplay("Citología"), "CITOLOGÍA");
});

test("unknown values keep their own accents in uppercase and missing values share one label", () => {
  assert.equal(formatStudyTypeDisplay("Inmunohistoquímica"), "INMUNOHISTOQUÍMICA");
  assert.equal(formatStudyTypeDisplay("Biopsia de piel"), "BIOPSIA DE PIEL");
  for (const missing of [null, undefined, "", "   "]) {
    assert.equal(formatStudyTypeDisplay(missing), STUDY_TYPE_MISSING_LABEL);
  }
  for (const value of ["citologia", "Necropsia", "Histopatología"]) {
    assert.equal(formatStudyTypeDisplay(formatStudyTypeDisplay(value)), formatStudyTypeDisplay(value));
  }
});

test("catalog ids stay the stored values used by both upload forms", () => {
  assert.deepEqual([...STUDY_TYPE_LABELS.keys()], ["histopatologia", "citologia", "hemoparasitos"]);
  for (const formPath of [
    "frontend/src/components/dashboard/UploadReportModal.tsx",
    "frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx",
  ]) {
    const source = read(formPath);
    for (const [value, label] of STUDY_TYPE_LABELS) {
      assert.ok(source.includes(`{ value: "${value}", label: "${label}" }`), `${formPath}: ${value}`);
    }
  }
});

test("the formatter is pure presentation: no theme, DOM or storage dependency", () => {
  const source = read(STUDY_TYPES_PATH);
  for (const forbidden of ["document", "window", "theme", "matchMedia", "localStorage"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

// Cada superficie muestra la clasificación sólo vía formatStudyTypeDisplay;
// `raw` enumera los usos que deben seguir con el valor guardado (filtros,
// consultas y mensajes salientes).
function assertSurfaceUsesSharedFormatter(path: string, renders: number, raw: readonly string[]) {
  const source = read(path);
  assert.ok(source.includes('import { formatStudyTypeDisplay } from "@/lib/study-types";'), path);
  assert.equal(occurrences(source, "formatStudyTypeDisplay("), renders, path);

  // Sólo se formatea la clasificación: ningún otro campo pasa por el formatter.
  for (const call of source.match(/formatStudyTypeDisplay\([^)]*\)/g) ?? []) {
    assert.match(
      call,
      /^formatStudyTypeDisplay\((report|selectedReport|latestReport|session\.report)\.studyType\)$/,
      `${path}: ${call}`,
    );
  }

  // Ningún render crudo ni catálogo paralelo sobrevive.
  assert.equal(/\{[\w.]*\.studyType\}/.test(source), false, `${path}: raw {x.studyType}`);
  assert.equal(/studyLabel\(|STUDY_LABELS/.test(source), false, `${path}: duplicated catalog`);
  let remainder = source;
  for (const value of raw) {
    assert.ok(remainder.includes(value), `${path}: raw value kept for ${value}`);
    remainder = remainder.split(value).join("");
  }
  assert.equal(/\.studyType \?\?/.test(remainder), false, `${path}: raw fallback render`);
}

test("clínica · resumen Informes (tabla, fila móvil, detalle) usa el formatter compartido", () => {
  assertSurfaceUsesSharedFormatter("frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx", 3, [
    'const studyDisplay = report.studyType ?? "Tipo sin registrar";',
  ]);
});

test("clínica · ruta completa Informes (lista, grilla, detalle, resumen móvil, aria) usa el formatter compartido", () => {
  assertSurfaceUsesSharedFormatter("frontend/src/app/dashboard/informes/InformesReportsList.tsx", 5, [
    "query.studyType ?? null,",
  ]);
});

test("clínica · command center (actividad e informes recientes) usa el formatter compartido", () => {
  assertSurfaceUsesSharedFormatter("frontend/src/app/dashboard/ClinicCommandCenter.tsx", 2, []);
});

test("admin · Informes (filtro, tabla, tarjeta móvil, detalle) usa el formatter compartido", () => {
  assertSurfaceUsesSharedFormatter("frontend/src/app/dashboard/admin/AdminReportsCard.tsx", 5, [
    "matchesFilterText(report.studyType, filters.study)",
  ]);
});

test("particulares · informe disponible (desktop, móvil, title) usa el formatter compartido", () => {
  assertSurfaceUsesSharedFormatter("frontend/src/components/public/ParticularesContent.tsx", 3, [
    "formatSpecialStainContactValue(session.report.studyType)",
  ]);
});

test("filters, queries and outbound messages keep the stored value", () => {
  const admin = read("frontend/src/app/dashboard/admin/AdminReportsCard.tsx");
  assert.ok(admin.includes("matchesFilterText(studyDisplay, filters.study)"));
  assert.ok(admin.includes("matchesFilterText(report.studyType, filters.study)"));

  const summary = read("frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx");
  assert.ok(summary.includes("matchesFilterText(studyDisplay, filters.study)"));

  const list = read("frontend/src/app/dashboard/informes/InformesReportsList.tsx");
  assert.ok(list.includes("studyType: filters.studyType || undefined,"));
});
