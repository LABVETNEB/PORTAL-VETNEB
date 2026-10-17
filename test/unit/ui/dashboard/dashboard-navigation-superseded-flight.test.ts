import assert from "node:assert/strict";
import test from "node:test";

import {
  guardSupersededFlights,
  installSupersededFlightGuard,
} from "../../../../frontend/src/lib/dashboard/navigation/supersededFlightGuard.ts";

// D-10 — Next 16.4 turns a failed router payload into a document navigation
// even after a later navigation superseded it. The guard withholds only the
// failure of a superseded navigation payload; everything else reaches the
// router exactly as the network answered it.

type Pending = {
  readonly url: string;
  readonly resolve: (response: Response) => void;
  readonly reject: (error: unknown) => void;
};

function rig() {
  const pending: Pending[] = [];
  const network = (input: RequestInfo | URL) =>
    new Promise<Response>((resolve, reject) => {
      pending.push({ url: String(input), resolve, reject });
    });
  const guarded = guardSupersededFlights(network);
  const outcomes: string[] = [];
  const issue = (url: string, headers: Record<string, string>) => {
    void guarded(url, { headers }).then(
      (response) => outcomes.push(`${url} ${response.status}`),
      (error: Error) => outcomes.push(`${url} rejected ${error.message}`),
    );
  };
  const answer = (url: string, status: number) => {
    const entry = pending.find((candidate) => candidate.url === url);
    assert.ok(entry, `${url} was issued`);
    entry.resolve(new Response(null, { status }));
  };
  const fail = (url: string, message: string) => {
    const entry = pending.find((candidate) => candidate.url === url);
    assert.ok(entry, `${url} was issued`);
    entry.reject(new Error(message));
  };
  return { issue, answer, fail, outcomes, pending };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const NAVIGATION = { rsc: "1" };

test("a failed payload superseded by a later navigation never reaches the router", async () => {
  const { issue, answer, outcomes } = rig();
  issue("/dashboard?module=informes&_rsc=a", NAVIGATION);
  issue("/dashboard?module=tokens&_rsc=b", NAVIGATION);
  answer("/dashboard?module=informes&_rsc=a", 500);
  answer("/dashboard?module=tokens&_rsc=b", 200);
  await settle();
  assert.deepEqual(outcomes, ["/dashboard?module=tokens&_rsc=b 200"]);
});

test("a 524 of an abandoned flight after the later one committed is withheld", async () => {
  const { issue, answer, outcomes } = rig();
  issue("/dashboard/admin?module=admin-sessions&_rsc=a", NAVIGATION);
  issue("/dashboard/admin?module=audit-log&_rsc=b", NAVIGATION);
  answer("/dashboard/admin?module=audit-log&_rsc=b", 200);
  await settle();
  answer("/dashboard/admin?module=admin-sessions&_rsc=a", 524);
  await settle();
  assert.deepEqual(outcomes, ["/dashboard/admin?module=audit-log&_rsc=b 200"]);
});

test("the latest navigation's failure keeps the router's document fallback", async () => {
  const { issue, answer, fail, outcomes } = rig();
  issue("/dashboard?module=tokens&_rsc=a", NAVIGATION);
  answer("/dashboard?module=tokens&_rsc=a", 524);
  await settle();
  issue("/dashboard?module=perfil&_rsc=b", NAVIGATION);
  fail("/dashboard?module=perfil&_rsc=b", "offline");
  await settle();
  assert.deepEqual(outcomes, [
    "/dashboard?module=tokens&_rsc=a 524",
    "/dashboard?module=perfil&_rsc=b rejected offline",
  ]);
});

test("a superseded payload that answers is delivered: only failures are withheld", async () => {
  const { issue, answer, fail, outcomes } = rig();
  issue("/dashboard?module=informes&_rsc=a", NAVIGATION);
  issue("/dashboard?module=tokens&_rsc=b", NAVIGATION);
  issue("/dashboard?module=perfil&_rsc=c", NAVIGATION);
  answer("/dashboard?module=informes&_rsc=a", 200);
  fail("/dashboard?module=tokens&_rsc=b", "offline");
  answer("/dashboard?module=perfil&_rsc=c", 200);
  await settle();
  assert.deepEqual(outcomes, ["/dashboard?module=informes&_rsc=a 200", "/dashboard?module=perfil&_rsc=c 200"]);
});

test("prefetches, server actions and plain requests neither supersede nor are withheld", async () => {
  const { issue, answer, outcomes } = rig();
  issue("/dashboard?module=tokens&_rsc=a", NAVIGATION);
  issue("/dashboard?module=perfil&_rsc=p", { rsc: "1", "next-router-prefetch": "1" });
  issue("/dashboard?module=perfil&_rsc=s", { rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" });
  issue("/api/clinic/reports", {});
  answer("/dashboard?module=perfil&_rsc=p", 500);
  answer("/dashboard?module=perfil&_rsc=s", 500);
  answer("/api/clinic/reports", 503);
  answer("/dashboard?module=tokens&_rsc=a", 500);
  await settle();
  assert.deepEqual(outcomes, [
    "/dashboard?module=perfil&_rsc=p 500",
    "/dashboard?module=perfil&_rsc=s 500",
    "/api/clinic/reports 503",
    "/dashboard?module=tokens&_rsc=a 500",
  ]);
});

test("an aborted superseded request still rejects, so its caller sees the abort", async () => {
  const pending: Pending[] = [];
  const network = (input: RequestInfo | URL) =>
    new Promise<Response>((resolve, reject) => {
      pending.push({ url: String(input), resolve, reject });
    });
  const guarded = guardSupersededFlights(network);
  const controller = new AbortController();
  const outcomes: string[] = [];
  void guarded("/dashboard?_rsc=a", { headers: NAVIGATION, signal: controller.signal }).catch((error: Error) =>
    outcomes.push(`rejected ${error.message}`),
  );
  void guarded("/dashboard?_rsc=b", { headers: NAVIGATION });
  controller.abort();
  pending[0].reject(new Error("aborted"));
  await settle();
  assert.deepEqual(outcomes, ["rejected aborted"]);
});

test("the installed guard is removed only while it is still the installed fetch", () => {
  const original = (() => Promise.resolve(new Response(null))) as typeof fetch;
  const target = { fetch: original };
  const uninstall = installSupersededFlightGuard(target);
  assert.notEqual(target.fetch, original);
  uninstall();
  assert.equal(target.fetch, original);

  const later = (() => Promise.resolve(new Response(null))) as typeof fetch;
  const uninstallAgain = installSupersededFlightGuard(target);
  target.fetch = later;
  uninstallAgain();
  assert.equal(target.fetch, later, "a fetch installed after the guard is left in place");
});
