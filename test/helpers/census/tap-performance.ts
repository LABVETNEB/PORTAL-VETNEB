/**
 * TAP performance processor (TEST-GLOBAL-01B, versioned equivalent of the
 * unversioned script that produced §24's Pareto and ranking figures).
 *
 * §24 of the rector document is explicit: the Pareto and ranking figures
 * (50 % of aggregate time in 33 entries, 80 % in 130, 133,6 s aggregated) are
 * `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` because they came from processing a
 * TAP run with a scratchpad script that was never versioned. This module is
 * that processor, versioned: it parses the TAP stream node's own test
 * runner produces (`--test-reporter=tap`) and recomputes duration-per-entry,
 * a duration-ordered ranking and the Pareto thresholds from it.
 *
 * It reads no file and starts no process itself — the caller captures a TAP
 * run and hands its text here — so the module stays pure, deterministic for
 * the same input, and reusable by a contract's positive and negative tests
 * alike. Durations are `HISTORICAL_EXECUTION_EVIDENCE` (§24, §3.5): they
 * depend on the host and the moment of the run, never on this parser, and
 * no wall-time figure is congelable (§31.2) — this module only recomputes
 * whatever a concrete TAP capture contains.
 *
 * Reproduction command (no new dependency, no package.json change):
 *
 *   node --experimental-strip-types --experimental-specifier-resolution=node \
 *        --test --test-reporter=tap "test/**\/*.test.ts" > run.tap
 *
 * then feed the captured text to `analyzeTapOutput`.
 */

/** One TAP result line (`ok`/`not ok`) and the duration its YAML block reports. */
export type TapEntry = {
  readonly name: string;
  readonly durationMs: number;
};

export type ParetoResult = {
  /** Every entry, sorted by duration descending, name ascending on ties. */
  readonly entries: readonly TapEntry[];
  readonly totalDurationMs: number;
  /** Fewest entries, taken from the top, whose durations sum to ≥ 50 %. */
  readonly entriesFor50Percent: number;
  /** Fewest entries, taken from the top, whose durations sum to ≥ 80 %. */
  readonly entriesFor80Percent: number;
};

const RESULT_LINE = /^(\s*)(?:ok|not ok)\s+\d+\s*-\s*(.+?)\s*$/;
const DURATION_LINE = /^(\s*)duration_ms:\s*(-?[0-9]+(?:\.[0-9]+)?)\s*$/;

/**
 * Parses every `ok`/`not ok` result line of a TAP stream and its own
 * `duration_ms`. Node nests a parent test's own summary block *after* its
 * children's blocks, all deeper-indented, so a result line's duration is the
 * `duration_ms` line at exactly two more spaces of indentation than the
 * result line itself — never the first `duration_ms` line that follows in
 * the raw text, which may belong to a nested child instead.
 */
export function parseTapEntries(tap: string): readonly TapEntry[] {
  if (typeof tap !== "string" || tap.trim() === "") {
    throw new TypeError("TAP parsing requires a non-empty string");
  }

  const lines = tap.split("\n");
  const entries: { name: string; durationMs: number | null }[] = [];
  const pendingByIndent = new Map<number, { name: string; durationMs: number | null }>();

  for (const line of lines) {
    const result = RESULT_LINE.exec(line);

    if (result) {
      const indent = (result[1] ?? "").length;
      const entry = { name: result[2] ?? "", durationMs: null as number | null };

      entries.push(entry);
      pendingByIndent.set(indent, entry);
      continue;
    }

    const duration = DURATION_LINE.exec(line);

    if (!duration) {
      continue;
    }

    const indent = (duration[1] ?? "").length;
    const owner = pendingByIndent.get(indent - 2);

    if (!owner || owner.durationMs !== null) {
      continue;
    }

    owner.durationMs = Number.parseFloat(duration[2] ?? "");
  }

  const unresolved = entries.filter((entry) => entry.durationMs === null);

  if (unresolved.length > 0) {
    throw new Error(
      `TAP entry without a resolvable duration_ms: ${unresolved[0]!.name}`,
    );
  }

  if (entries.length === 0) {
    throw new Error("TAP stream contains no ok/not ok result lines");
  }

  return entries.map((entry) => ({
    name: entry.name,
    durationMs: entry.durationMs as number,
  }));
}

/**
 * Duration-ordered ranking and Pareto thresholds over already-parsed
 * entries. Kept separate from `parseTapEntries` so a caller — or a test —
 * can feed it a hand-built entry list without going through TAP text first.
 */
export function paretoAnalysis(entries: readonly TapEntry[]): ParetoResult {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("Pareto analysis requires at least one TAP entry");
  }

  for (const entry of entries) {
    if (!Number.isFinite(entry.durationMs) || entry.durationMs < 0) {
      throw new Error(
        `TAP entry has a non-finite or negative duration: ${entry.name}`,
      );
    }
  }

  const sorted = [...entries].sort(
    (left, right) =>
      right.durationMs - left.durationMs || left.name.localeCompare(right.name),
  );
  const totalDurationMs = sorted.reduce((sum, entry) => sum + entry.durationMs, 0);

  if (totalDurationMs === 0) {
    throw new Error(
      "Pareto analysis requires positive aggregate duration; every entry measured 0 ms",
    );
  }

  function entriesForShare(share: number): number {
    let cumulative = 0;

    for (const [index, entry] of sorted.entries()) {
      cumulative += entry.durationMs;

      if (cumulative / totalDurationMs >= share) {
        return index + 1;
      }
    }

    return sorted.length;
  }

  return {
    entries: sorted,
    totalDurationMs,
    entriesFor50Percent: entriesForShare(0.5),
    entriesFor80Percent: entriesForShare(0.8),
  };
}

/** Convenience: parse a TAP stream and run the Pareto analysis in one call. */
export function analyzeTapOutput(tap: string): ParetoResult {
  return paretoAnalysis(parseTapEntries(tap));
}
