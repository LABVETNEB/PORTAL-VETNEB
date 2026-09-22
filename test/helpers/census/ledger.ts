/**
 * Ledger of the census (TEST-GLOBAL-01B).
 *
 * Holds the rules that make a census entry admissible under the single-source
 * rule of §31.2, separated from the data so that the fail-closed contract can
 * feed them malformed entries and prove they turn red. A guard that is never
 * exercised against a violation is an assumption, not a control (§16).
 */

export type CensusGuard =
  | { readonly kind: "FROZEN_EXACT" }
  | { readonly kind: "NON_INCREASING" }
  | { readonly kind: "TOLERANCE_BAND"; readonly tolerance: number };

export type CensusResolution = "REPRODUCED" | "RECLASSIFIED";

export type CensusEntry = {
  readonly row: string;
  readonly section: string;
  readonly metric: string;
  readonly historical: number;
  readonly baseline?: number;
  readonly compute: () => number;
  readonly resolution: CensusResolution;
  readonly guard: CensusGuard;
  readonly motive: string;
};

export type LedgerReport = {
  readonly row: string;
  readonly metric: string;
  readonly historical: number;
  readonly anchor: number;
  readonly current: number;
  readonly declaredDifference: number;
  readonly drift: number;
  readonly resolution: CensusResolution;
};

/** Minimum written motive, and the stricter minimum for a reclassification. */
export const MOTIVE_MINIMUM = 40;
export const RECLASSIFICATION_REASON_MINIMUM = 80;
/** A band wider than this stops being a threshold and becomes a free pass. */
export const MAXIMUM_TOLERANCE = 0.5;

/** Computes the current figure of an entry. Throws on a broken computation. */
export function evaluateEntry(entry: CensusEntry): LedgerReport {
  if (entry === null || typeof entry !== "object") {
    throw new TypeError("a census entry is required");
  }

  if (typeof entry.compute !== "function") {
    throw new TypeError(`census entry without computation: ${entry.metric}`);
  }

  const current = entry.compute();

  if (!Number.isInteger(current) || current < 0) {
    throw new Error(
      `census computation must yield a non-negative integer: ${entry.metric}`,
    );
  }

  const anchor = entry.baseline ?? entry.historical;

  return {
    row: entry.row,
    metric: entry.metric,
    historical: entry.historical,
    anchor,
    current,
    declaredDifference: anchor - entry.historical,
    drift: current - anchor,
    resolution: entry.resolution,
  };
}

/**
 * Declaration rules. Returns the violation, or `null` when the entry is
 * admissible. Fail-closed: an unknown guard kind is a violation, never a pass.
 */
export function declarationViolation(entry: CensusEntry): string | null {
  if (!Number.isInteger(entry.historical) || entry.historical < 0) {
    return `${entry.metric}: la cifra histórica debe ser un entero no negativo`;
  }

  if (entry.motive.trim().length < MOTIVE_MINIMUM) {
    return `${entry.metric}: toda entrada declara su motivo por escrito`;
  }

  if (entry.resolution === "RECLASSIFIED") {
    if (typeof entry.baseline !== "number") {
      return `${entry.metric}: una reclasificación declara el valor que produce el tooling`;
    }

    if (entry.baseline === entry.historical) {
      return `${entry.metric}: una reclasificación sin diferencia numérica es una etiqueta falsa`;
    }

    if (entry.motive.trim().length < RECLASSIFICATION_REASON_MINIMUM) {
      return `${entry.metric}: la reclasificación exige razón verificable, no una nota`;
    }
  } else if (entry.baseline !== undefined) {
    return `${entry.metric}: una cifra reproducida se ancla en el histórico, no en un baseline propio`;
  }

  if (entry.guard.kind === "FROZEN_EXACT") {
    if (entry.resolution !== "REPRODUCED") {
      return `${entry.metric}: un invariante congelado no puede estar reclasificado`;
    }

    if (entry.historical !== 0) {
      return `${entry.metric}: sólo se congelan invariantes en 0 (§31.2, fila Congelable)`;
    }

    return null;
  }

  if (entry.guard.kind === "NON_INCREASING") {
    return null;
  }

  if (entry.guard.kind === "TOLERANCE_BAND") {
    return entry.guard.tolerance > 0 &&
      entry.guard.tolerance <= MAXIMUM_TOLERANCE
      ? null
      : `${entry.metric}: la banda debe ser una tolerancia real, no un pase libre`;
  }

  return `${entry.metric}: clase de guard desconocida`;
}

/** Guard rules over the computed figure. `null` when the guard holds. */
export function guardViolation(
  entry: CensusEntry,
  report: LedgerReport,
): string | null {
  if (entry.guard.kind === "FROZEN_EXACT") {
    return report.current === report.anchor
      ? null
      : `${entry.metric}: invariante congelado en ${report.anchor}; vigente ${report.current}. Su cambio exige revisión humana`;
  }

  if (entry.guard.kind === "NON_INCREASING") {
    return report.current <= report.anchor
      ? null
      : `${entry.metric}: ${report.current} supera la cota de no-regresión ${report.anchor}`;
  }

  if (entry.guard.kind === "TOLERANCE_BAND") {
    const allowed = Math.ceil(report.anchor * entry.guard.tolerance);

    return Math.abs(report.drift) <= allowed
      ? null
      : `${entry.metric}: ${report.current} sale de la banda ${report.anchor} ± ${allowed}`;
  }

  return `${entry.metric}: clase de guard desconocida`;
}

/** Every violation of a ledger, declaration first, sorted and deduplicated. */
export function ledgerViolations(
  entries: readonly CensusEntry[],
): readonly string[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("the census ledger cannot be empty");
  }

  const violations: string[] = [];

  for (const entry of entries) {
    const declaration = declarationViolation(entry);

    if (declaration !== null) {
      violations.push(declaration);
      continue;
    }

    const guard = guardViolation(entry, evaluateEntry(entry));

    if (guard !== null) {
      violations.push(guard);
    }
  }

  return violations.sort();
}
