import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "logistics-sla.fastify.ts"),
  "utf8",
);

const appSource = readFileSync(
  resolve(process.cwd(), "server", "fastify-app.ts"),
  "utf8",
);

test("logistics SLA API exposes read-only policy, instance, overdue and summary endpoints", () => {
  assert.match(routeSource, /export const logisticsSlaNativeRoutes/);
  assert.match(routeSource, /app\.get\("\/summary", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/overdue", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/policies", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/instances", async/);
  assert.match(routeSource, /app\.options\("\/summary", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/overdue", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/policies", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/instances", optionsHandler\)/);
  assert.match(routeSource, /GET,OPTIONS/);
});

test("logistics SLA API wires DB helpers through injectable deps", () => {
  assert.match(routeSource, /listActiveClinicSlaPolicies\?:/);
  assert.match(routeSource, /listClinicSlaInstances\?:/);
  assert.match(routeSource, /getClinicSlaSummary\?:/);
  assert.match(routeSource, /listOverdueActiveClinicSlaInstances\?:/);
  assert.match(routeSource, /dbLogistics\.listActiveClinicSlaPolicies/);
  assert.match(routeSource, /dbLogistics\.listClinicSlaInstances/);
  assert.match(routeSource, /dbLogistics\.getClinicSlaSummary/);
  assert.match(routeSource, /dbLogistics\.listOverdueActiveClinicSlaInstances/);
  assert.match(routeSource, /deps\.listActiveClinicSlaPolicies\(parsed\.params\)/);
  assert.match(routeSource, /deps\.listClinicSlaInstances\(parsed\.params\)/);
  assert.match(routeSource, /deps\.getClinicSlaSummary\(auth\.clinicId\)/);
  assert.match(routeSource, /deps\.listOverdueActiveClinicSlaInstances\(\s*parsed\.params,\s*\)/);
});

test("logistics SLA API keeps reads clinic scoped and paginated", () => {
  assert.match(routeSource, /buildListSlaPoliciesParams\(request\.query, auth\.clinicId\)/);
  assert.match(routeSource, /buildListSlaInstancesParams\(request\.query, auth\.clinicId\)/);
  assert.match(routeSource, /getClinicSlaSummary\(auth\.clinicId\)/);
  assert.match(routeSource, /clinicId,/);
  assert.match(routeSource, /parsePositiveInt\(query\.limit, 50, 100\)/);
  assert.match(routeSource, /parseOffset\(query\.offset\)/);
  assert.match(routeSource, /pagination:/);
});

test("logistics SLA API validates status and target filters before DB reads", () => {
  assert.match(routeSource, /SLA_TARGET_TYPES/);
  assert.match(routeSource, /SLA_INSTANCE_STATUSES/);
  assert.match(routeSource, /parseSlaTargetType\(query\.targetType\)/);
  assert.match(routeSource, /parseSlaInstanceStatus\(query\.status\)/);
  assert.match(routeSource, /parseOptionalEntityId\(query\.targetId, "targetId"\)/);
});

test("fastify app registers logistics SLA routes under dedicated prefix", () => {
  assert.match(appSource, /logisticsSlaNativeRoutes/);
  assert.match(appSource, /type LogisticsSlaNativeRoutesOptions/);
  assert.match(appSource, /logisticsSlaRoutes\?: LogisticsSlaNativeRoutesOptions/);
  assert.match(appSource, /prefix: "\/api\/logistics\/sla"/);
});

test("logistics SLA API validates overdue route filters before DB reads", () => {
  assert.match(routeSource, /buildListOverdueSlaInstancesParams/);
  assert.match(routeSource, /parseOptionalDate\(\s*query\.dueAtOrBefore,\s*"dueAtOrBefore",\s*\)/);
  assert.match(routeSource, /parseSlaTargetType\(query\.targetType\)/);
  assert.match(routeSource, /dueAtOrBefore: dueAtOrBefore\.value \?\? new Date\(now\(\)\)/);
});
