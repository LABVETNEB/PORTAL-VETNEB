import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const BELL_PATH = "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("notification click does not navigate after mark-read failure", () => {
  const source = read(BELL_PATH);
  const handler = sectionBetween(
    source,
    "async function handleNotificationClick(",
    "async function handleMarkAllAsRead()",
  );

  const markReadIndex = handler.indexOf("await markDashboardNotificationRead(");
  const catchIndex = handler.indexOf("} catch {");
  const returnIndex = handler.indexOf("return;", catchIndex);
  const navigateIndex = handler.indexOf("navigateToNotificationDestination(destination)");

  assert.ok(markReadIndex > -1, "handler must call markDashboardNotificationRead");
  assert.ok(catchIndex > markReadIndex, "handler must catch mark-read failures");
  assert.ok(returnIndex > catchIndex, "catch block must return before navigation");
  assert.ok(navigateIndex > returnIndex, "navigation must remain after successful read contract");
});

test("mark-all read error copy describes the failed mutation", () => {
  const source = read(BELL_PATH);

  assert.ok(
    source.includes("No se pudieron marcar las notificaciones como leídas."),
  );
  assert.equal(
    source.includes("No se pudieron cargar las notificaciones.\");\n    } finally {\n      setIsMarkingAllAsRead(false);"),
    false,
  );
});
