# Operational Repository Architecture Closeout Audit

## Audit metadata

- Control: `ERM-CTRL-002`
- Capability: Operational Repository Architecture
- Audit date: 2026-07-12
- Audited base: `main@1ae80f53931188bdc8accdc709cf0b24817a372d`
- Owner role: Engineering governance
- Change class: documentation-only
- Runtime impact: none

## Objective

Determine whether `ERM-CTRL-002` can transition from `PARTIAL` to `IMPLEMENTED` without overstating domain-architecture maturity or modifying historical snapshots.

## Acceptance criteria

The control may close only when all of the following are true:

1. the actual top-level repository layout is documented and understandable;
2. each major operational area has a clear responsibility;
3. current architecture evidence matches the repository used by engineering;
4. the layout is navigable without relying on undocumented tribal knowledge;
5. owner and review cadence are defined;
6. no related enterprise gap remains open for this capability;
7. the closeout does not conflate operational layout with completion of every domain or quality initiative.

## Evidence reviewed

### Enterprise baseline

`docs/audit/enterprise-repository-maturity-baseline.md` recorded a clear top-level operational architecture including backend, frontend, database, tests, scripts and documentation.

### Domain architecture audit

`docs/audit/repository-domain-architecture-audit.md` provides a path-level inventory and classifies VETNEB as an emerging modular monolith. Its current structure section identifies:

- `server/` as the Fastify backend;
- `drizzle/` as schema and migrations;
- `frontend/` as the Next.js application and E2E area;
- `test/` as the broad contract and backend test suite;
- `docs/` and `scripts/` as documentation and operational tooling.

The audit also distinguishes current operational structure from future domain extraction, preventing a false claim that package-by-feature or hexagonal architecture is complete.

### Operational ordering audit

`docs/audit/repository-operational-ordering-audit.md` found the repository root, `server/`, `drizzle/`, `scripts/` and workflows operationally ordered. Its documentation findings are governed by separate documentation controls and do not invalidate the runtime layout.

### Current governance state

The Enterprise Control Register assigns:

- status `PARTIAL`;
- maturity `3`;
- priority `NONE`;
- owner `Engineering governance`;
- related gaps `NONE`.

The previous next action was conditional on a future concrete gap, not an outstanding implementation requirement.

## Findings

### F-1 — Stable top-level responsibility boundaries

Result: PASS.

The repository has durable areas for backend, frontend, schema/migrations, automated verification, scripts, documentation and GitHub governance. These boundaries are sufficient for operational navigation and change scoping.

### F-2 — Evidence matches the actual architecture model

Result: PASS.

The authoritative audits consistently describe a modular monolith rather than claiming a completed clean-architecture migration. The closeout preserves that distinction.

### F-3 — No open gap assigned to the capability

Result: PASS.

`ERM-CTRL-002` has `Related gap IDs = NONE` and `Priority = NONE`. No historical gap is being silently overwritten or declared closed.

### F-4 — Ownership and review are explicit

Result: PASS.

Engineering governance owns the control. Quarterly review and event-driven review after material top-level restructuring are defined in the closeout.

### F-5 — Adjacent debt remains visible

Result: PASS.

Documentation lifecycle, ADR/RFC enforcement, quality gates and maintainability remain under separate controls. Closing `ERM-CTRL-002` does not close or downgrade those controls.

## Risk analysis

- Product risk: none; no runtime files change.
- Database risk: none; no schema or migration changes.
- CI risk: none; no workflows or scripts change.
- Governance risk: low; the change narrows one control to its actual capability and retains reopening criteria.
- Historical-integrity risk: none; baseline and gap register remain immutable.

## Audit conclusion

All acceptance criteria pass. The repository architecture is documented, navigable, role-owned and backed by current path-level evidence. No related enterprise gap is open.

Approved transition:

- `PARTIAL / 3 / NONE`
- to `IMPLEMENTED / 3 / NONE`

The control must be reopened if the top-level repository structure becomes ambiguous, diverges from its sources of truth or receives a new enterprise gap.

## Required register update

The closeout PR must:

- retain Control ID `ERM-CTRL-002`;
- set status to `IMPLEMENTED`;
- retain maturity `3`;
- retain priority `NONE`;
- link the implementation closeout and this audit;
- set verification date to `2026-07-12`;
- define quarterly/event-driven review;
- preserve all 25 control rows and historical snapshots.
