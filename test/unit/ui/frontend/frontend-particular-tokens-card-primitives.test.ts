import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PRIMITIVES_PATH =
  "frontend/src/components/dashboard/ParticularTokensCardPrimitives.tsx";
const ADMIN_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const CLINIC_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const DOC_PATH = "docs/audit/pr-vis-7-implementation.md";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("PR-VIS-7 exposes small visual-only particular token card primitives", () => {
  const source = read(PRIMITIVES_PATH);

  for (const exportName of [
    "ParticularTokensMetricStrip",
    "ParticularTokensPanel",
    "ParticularTokensPanelHeader",
    "ParticularTokensPanelBody",
    "ParticularTokensPanelFooter",
    "ParticularTokensMobileList",
    "ParticularTokensEmptyPanel",
  ]) {
    assert.ok(source.includes(`export function ${exportName}`));
  }

  for (const tokenClass of [
    "border-vetneb-line/75",
    "bg-vetneb-surface-muted/45",
    "text-muted-foreground",
    "text-vetneb-ink",
    "bg-card/82",
    "divide-vetneb-line/60",
  ]) {
    assert.ok(source.includes(tokenClass), `missing visual token ${tokenClass}`);
  }

  assert.equal(source.includes("@/lib/api"), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("useState"), false);
  assert.equal(source.includes("useEffect"), false);
  assert.equal(source.includes("admin_session_id"), false);
  assert.equal(source.includes("app_session_id"), false);
});

test("PR-VIS-7 wires primitives only into admin and clinic token cards", () => {
  const admin = read(ADMIN_CARD_PATH);
  const clinic = read(CLINIC_CARD_PATH);

  assert.ok(
    admin.includes(
      'from "@/components/dashboard/ParticularTokensCardPrimitives";',
    ),
  );
  assert.ok(admin.includes("<ParticularTokensMetricStrip"));
  assert.ok(admin.includes("<ParticularTokensMobileList"));
  assert.ok(admin.includes('data-admin-particulars-mobile-list="true"'));

  assert.ok(
    clinic.includes(
      'from "@/components/dashboard/ParticularTokensCardPrimitives";',
    ),
  );
  assert.ok(clinic.includes('from "@/components/dashboard/ModuleMetricRun";'));
  assert.ok(clinic.includes("<ModuleMetricRun"));
  assert.ok(clinic.includes("<ParticularTokensPanel"));
  assert.ok(clinic.includes("<ParticularTokensPanelHeader"));
  assert.ok(clinic.includes("<ParticularTokensPanelBody"));
  assert.ok(clinic.includes("<ParticularTokensPanelFooter"));
  assert.ok(clinic.includes("<ParticularTokensEmptyPanel"));
  assert.ok(clinic.includes('data-clinic-access-list-panel="true"'));
  assert.ok(clinic.includes('data-clinic-access-pagination-footer="true"'));
});

test("PR-VIS-7 documentation records scope validations and exclusions", () => {
  const source = read(DOC_PATH);

  assert.ok(source.includes("# PR-VIS-7 implementation report"));
  assert.ok(source.includes("## Scope exacto detectado"));
  assert.ok(source.includes("## Criterio de razonamiento usado"));
  assert.ok(source.includes("## Archivos modificados"));
  assert.ok(source.includes("## Que tokens/contratos visuales se usaron"));
  assert.ok(source.includes("## Que componentes/primitivas se crearon, usaron o no se usaron"));
  assert.ok(source.includes("## Que se evito tocar explicitamente"));
  assert.ok(source.includes("## Validaciones ejecutadas"));
  assert.ok(source.includes("## Riesgos residuales"));
  assert.ok(source.includes("no backend/API/auth/DB/migrations/deps/lockfiles/CI"));
});
