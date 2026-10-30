// DRV V1 · Google Drive fidelity probe: reference model and per-metric
// classifier. Pure module (no Playwright at runtime) so the node unit suite can
// import it. Classification follows the reference §XIII.1: IGUAL within the
// Drive tolerance, DIFERENTE, AUSENTE when VETNEB has no such element, and
// NO_COMPARABLE when Drive's value is not OBSERVADO/DERIVADO or when the
// surface has no equivalent component. No global score.
//
// Instrument problems are never a classification: a colour the parser cannot
// read, or a reading of the wrong type, sets `instrumentError` so the probe
// fails instead of reporting a visual difference.

export const DRIVE_REFERENCE_SCHEMA = "drv-v1-drive-reference/2";

export type DriveMetricKind = "px" | "token" | "atLeast" | "formula" | "color";
export type DriveFormula = "viewport-313" | "search-width";
export type DriveEvidence = "OBSERVADO" | "DERIVADO";
export type DriveCategory = "geometry" | "typography" | "color" | "state";
export type DriveState = "default" | "selected" | "hover" | "focus" | "filtered";

export type DriveMetric = {
  readonly id: string;
  readonly component: string;
  readonly category: DriveCategory;
  readonly state: DriveState;
  readonly kind: DriveMetricKind;
  readonly expected?: number | string;
  readonly formula?: DriveFormula;
  readonly tolerance?: number;
  readonly minViewportWidth?: number;
  readonly evidence: DriveEvidence;
  readonly section: string;
};

export type DriveNotComparable = {
  readonly id: string;
  readonly reason: string;
  readonly section: string;
};

export type DriveReference = {
  readonly schema: string;
  readonly source: string;
  readonly colorCriterion: string;
  readonly metrics: readonly DriveMetric[];
  readonly notComparable: readonly DriveNotComparable[];
};

export type FidelityStatus = "IGUAL" | "DIFERENTE" | "AUSENTE" | "NO_COMPARABLE";

/** The surface has no component equivalent to Drive's; `reason` says why. */
export type NotApplicable = { readonly notApplicable: string };

/** `null` = the VETNEB element does not exist in the measured state. */
export type MeasuredValue = number | string | null | NotApplicable;

export type FidelityResult = {
  readonly id: string;
  readonly component: string;
  readonly category: DriveCategory;
  readonly state: DriveState;
  readonly status: FidelityStatus;
  readonly expected: number | string | null;
  readonly measured: number | string | null;
  readonly delta: number | null;
  readonly reason?: string;
  readonly instrumentError?: string;
};

/** Channel tolerance in 8-bit sRGB units and alpha tolerance for `color`. */
export const COLOR_CHANNEL_TOLERANCE = 2;
export const COLOR_ALPHA_TOLERANCE = 0.01;

const KINDS: readonly DriveMetricKind[] = ["px", "token", "atLeast", "formula", "color"];
const EVIDENCE: readonly DriveEvidence[] = ["OBSERVADO", "DERIVADO"];

/** Rejects a reference that would let an unproven Drive value be compared. */
export function validateDriveReference(reference: DriveReference): string[] {
  const errors: string[] = [];
  if (reference.schema !== DRIVE_REFERENCE_SCHEMA) errors.push(`schema ${reference.schema}`);
  if (!reference.colorCriterion) errors.push("colorCriterion missing");
  const ids = new Set<string>();
  for (const metric of reference.metrics) {
    if (ids.has(metric.id)) errors.push(`duplicate id ${metric.id}`);
    ids.add(metric.id);
    if (!KINDS.includes(metric.kind)) errors.push(`${metric.id}: kind ${metric.kind}`);
    if (!EVIDENCE.includes(metric.evidence)) errors.push(`${metric.id}: evidence ${metric.evidence}`);
    if (!metric.section) errors.push(`${metric.id}: no section`);
    if (metric.kind === "formula") {
      if (!metric.formula) errors.push(`${metric.id}: formula missing`);
    } else if (metric.expected === undefined) {
      errors.push(`${metric.id}: expected missing`);
    }
    if ((metric.kind === "px" || metric.kind === "formula") && typeof metric.tolerance !== "number") {
      errors.push(`${metric.id}: tolerance missing`);
    }
    if (metric.kind === "color" && parseCssColor(String(metric.expected)) === null) {
      errors.push(`${metric.id}: expected colour unparseable`);
    }
  }
  for (const entry of reference.notComparable) {
    if (ids.has(entry.id)) errors.push(`${entry.id}: both comparable and not comparable`);
    if (!entry.reason) errors.push(`${entry.id}: no reason`);
  }
  return errors;
}

/** Drive value for a viewport width, or null outside the formula's interval. */
export function expectedFor(metric: DriveMetric, viewportWidth: number): number | string | null {
  if (metric.minViewportWidth !== undefined && viewportWidth < metric.minViewportWidth) return null;
  if (metric.kind !== "formula") return metric.expected ?? null;
  if (metric.formula === "viewport-313") return viewportWidth - 313;
  // §VI.3: 722 cap from 1416, viewport - 694 from 1024, viewport - 674 below.
  if (viewportWidth >= 1416) return 722;
  if (viewportWidth >= 1024) return viewportWidth - 694;
  return viewportWidth - 674;
}

export function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number };

const clamp255 = (value: number) => Math.min(255, Math.max(0, value));

function linearToSrgb8(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp255(encoded * 255);
}

function oklabToRgba(l: number, a: number, b: number, alpha: number): Rgba {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return {
    r: linearToSrgb8(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: linearToSrgb8(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: linearToSrgb8(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
    a: alpha,
  };
}

const number = (token: string, percentScale: number) =>
  token.endsWith("%") ? (parseFloat(token) / 100) * percentScale : parseFloat(token);

/**
 * Parses the colour forms Chromium serialises in computed styles: rgb()/rgba()
 * (legacy and space syntax), oklab(), oklch() and color(srgb …). `color-mix()`
 * never survives into a computed value; meeting one is an instrument error, so
 * it returns null like any other unknown form.
 */
export function parseCssColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const match = /^(rgba?|oklab|oklch|color)\((.*)\)$/.exec(value);
  if (!match) return null;
  const [, fn, body] = match;
  const [channelsPart, alphaPart] = body.includes("/") ? body.split("/") : [body, undefined];
  const channels = channelsPart.replace(/,/g, " ").trim().split(/\s+/);
  let alpha = alphaPart !== undefined ? number(alphaPart.trim(), 1) : 1;
  if (fn === "rgb" || fn === "rgba") {
    if (alphaPart === undefined && channels.length === 4) alpha = number(channels.pop()!, 1);
    if (channels.length !== 3) return null;
    const [r, g, b] = channels.map((channel) => number(channel, 255));
    return { r, g, b, a: alpha };
  }
  if (fn === "oklab") {
    if (channels.length !== 3) return null;
    const [l, a, b] = [number(channels[0], 1), number(channels[1], 0.4), number(channels[2], 0.4)];
    return oklabToRgba(l, a, b, alpha);
  }
  if (fn === "oklch") {
    if (channels.length !== 3) return null;
    const l = number(channels[0], 1);
    const c = number(channels[1], 0.4);
    const h = (parseFloat(channels[2]) * Math.PI) / 180;
    return oklabToRgba(l, c * Math.cos(h), c * Math.sin(h), alpha);
  }
  if (channels[0] !== "srgb" || channels.length !== 4) return null;
  const [r, g, b] = channels.slice(1).map((channel) => number(channel, 1) * 255);
  return { r, g, b, a: alpha };
}

export function classifyMetric(
  metric: DriveMetric,
  measuredInput: MeasuredValue,
  viewportWidth: number,
): FidelityResult {
  const expected = expectedFor(metric, viewportWidth);
  const measured = measuredInput !== null && typeof measuredInput === "object" ? null : measuredInput;
  const base = {
    id: metric.id,
    component: metric.component,
    category: metric.category,
    state: metric.state,
    expected,
    measured,
  };
  if (measuredInput !== null && typeof measuredInput === "object") {
    return { ...base, status: "NO_COMPARABLE", delta: null, reason: measuredInput.notApplicable };
  }
  if (expected === null) {
    return { ...base, status: "NO_COMPARABLE", delta: null, reason: "outside the Drive formula interval" };
  }
  if (measured === null) return { ...base, status: "AUSENTE", delta: null };

  if (metric.kind === "token") {
    const equal = normalizeToken(String(measured)) === normalizeToken(String(expected));
    return { ...base, status: equal ? "IGUAL" : "DIFERENTE", delta: null };
  }

  if (metric.kind === "color") {
    const want = parseCssColor(String(expected));
    const got = parseCssColor(String(measured));
    if (!want || !got) {
      return { ...base, status: "DIFERENTE", delta: null, instrumentError: `unparseable colour ${measured}` };
    }
    const delta = Math.round(Math.max(Math.abs(got.r - want.r), Math.abs(got.g - want.g), Math.abs(got.b - want.b)) * 100) / 100;
    const equal = delta <= COLOR_CHANNEL_TOLERANCE && Math.abs(got.a - want.a) <= COLOR_ALPHA_TOLERANCE;
    return { ...base, status: equal ? "IGUAL" : "DIFERENTE", delta };
  }

  if (typeof measured !== "number" || !Number.isFinite(measured) || typeof expected !== "number") {
    return { ...base, status: "DIFERENTE", delta: null, instrumentError: `non-numeric reading ${measured}` };
  }
  const delta = Math.round((measured - expected) * 100) / 100;
  if (metric.kind === "atLeast") {
    return { ...base, status: measured >= expected ? "IGUAL" : "DIFERENTE", delta };
  }
  const tolerance = metric.tolerance ?? 0;
  return { ...base, status: Math.abs(measured - expected) <= tolerance ? "IGUAL" : "DIFERENTE", delta };
}

export type FidelityTally = Record<FidelityStatus, number>;

/** Per-key counts; deliberately no ratio or single similarity score. */
export function tallyBy(
  results: readonly FidelityResult[],
  key: "component" | "category" | "state",
): Record<string, FidelityTally> {
  const tallies: Record<string, FidelityTally> = {};
  for (const result of results) {
    const group = (tallies[result[key]] ??= { IGUAL: 0, DIFERENTE: 0, AUSENTE: 0, NO_COMPARABLE: 0 });
    group[result.status] += 1;
  }
  return tallies;
}
