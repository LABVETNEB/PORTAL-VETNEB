# Operational Repository Architecture Closeout

## Control

- Control ID: `ERM-CTRL-002`
- Capability: Operational Repository Architecture
- Owner: Engineering governance
- Verification date: 2026-07-12
- Target status: `IMPLEMENTED`
- Target maturity: `3`
- Target priority: `NONE`

## Purpose

This record closes the operational repository architecture control using current, observable repository structure and durable architecture evidence. It does not claim that every application domain has reached a final clean-architecture target. The control concerns whether the repository has a documented, navigable and operationally coherent top-level architecture.

## Implemented architecture

VETNEB is operated as a pnpm monorepo with stable top-level responsibility boundaries:

- `server/`: Fastify backend runtime, route adapters, middleware, libraries and data-access modules;
- `frontend/`: Next.js frontend application and Playwright end-to-end suites;
- `drizzle/`: schema, relations and ordered database migrations;
- `test/`: backend, frontend-contract, infrastructure and architecture tests;
- `scripts/`: operational, security and governance tooling;
- `docs/`: sources of truth, governance records, audits, implementation evidence and runbooks;
- `.github/`: repository ownership, pull-request contract and CI workflows.

The layout is intentionally a modular monolith. Backend and frontend are separated by an HTTP boundary; database evolution is isolated under `drizzle/`; automated verification is isolated under `test/`, `frontend/e2e/` and workflows; governance tooling is versioned under `scripts/governance/`.

## Authoritative evidence

The closure is supported by:

1. `docs/audit/enterprise-repository-maturity-baseline.md`, which recorded the top-level operational architecture and maturity state;
2. `docs/audit/repository-domain-architecture-audit.md`, which classified the repository as an emerging modular monolith and mapped the current backend, frontend, database, test, scripts and documentation boundaries;
3. `docs/audit/repository-operational-ordering-audit.md`, which verified that the root, backend, database, scripts and workflow areas are operationally ordered and identified documentation ordering separately from runtime architecture;
4. `docs/governance/ownership-model.md`, which assigns role ownership across engineering, architecture, CI, security, data and operations;
5. the current repository tree at `main@1ae80f53931188bdc8accdc709cf0b24817a372d`.

## Closure rationale

The prior control state was `PARTIAL / 3 / NONE`. The row had no related enterprise gap and its next action was conditional: create follow-up work only when a concrete operational architecture gap is opened.

The current evidence satisfies the closure criteria:

- the top-level architecture is documented;
- the repository remains navigable by operational responsibility;
- domain-specific architecture evidence exists without requiring a big-bang rewrite;
- current sources describe the actual paths used by backend, frontend, database, tests, tooling and documentation;
- no open enterprise gap is assigned to this capability;
- role ownership and periodic review are defined.

The control therefore transitions to `IMPLEMENTED / 3 / NONE`.

## Explicit non-claims

This closeout does not claim:

- that backend domain extraction is complete;
- that every package follows Clean Architecture or package-by-feature;
- that documentation lifecycle automation is complete;
- that architecture-boundary ADR/RFC enforcement is complete;
- that test coverage or maintainability controls are complete.

Those concerns remain governed by their own enterprise controls, particularly `ERM-CTRL-005`, `ERM-CTRL-010`, `ERM-CTRL-014` and `ERM-CTRL-025`.

## Review and reopening criteria

Review cadence: quarterly and after a material top-level repository restructure.

Reopen `ERM-CTRL-002` when any of the following occurs:

- a new top-level runtime or infrastructure area is introduced without a documented responsibility;
- a current top-level path is moved or removed without updating its source of truth;
- backend, frontend, database, tests or scripts become operationally ambiguous;
- an enterprise gap is opened against repository layout or operational navigability;
- the repository architecture evidence no longer matches the current tree.

## Rollback

If this closeout is found inaccurate, revert the closeout PR and restore `ERM-CTRL-002` to `PARTIAL / 3 / NONE` with a concrete related gap, next action and closure criteria. No runtime or data rollback is required because this change is documentation-only.
