# Dependabot PR Governance Compatibility

## Objective

Allow trusted Dependabot pull requests to satisfy repository pull-request
governance without requiring Dependabot-generated bodies to reproduce the
human pull-request template.

This change does not bypass technical governance validation and does not
enable automatic merge.

## Problem

Dependabot generates release-note bodies rather than the repository sections
`Summary`, `Scope`, `Validation` and `Rollback`.

The governance validator therefore rejected otherwise valid dependency
updates after Backend and Frontend CI had passed.

## Trusted identity contract

Automated metadata and scope inference is allowed only when all identity
conditions hold:

1. The pull-request author is exactly `dependabot[bot]`.
2. The head branch begins with `dependabot/`.
3. The head repository is non-empty.
4. The head and base repositories are identical.

A human-created branch whose name resembles a Dependabot branch is not
trusted. A Dependabot-looking branch from a fork is not trusted.

## Changed-file contract

Trusted inference accepts only modified files matching one of these classes:

- any workspace `package.json`;
- `package-lock.json`;
- `pnpm-lock.yaml`;
- `yarn.lock`;
- `npm-shrinkwrap.json`;
- YAML workflows directly below `.github/workflows/`.

Added, deleted or renamed files are rejected. Runtime source files,
documentation, scripts, repository configuration and arbitrary files are
rejected.

## Preserved governance checks

Trusted inference changes only the source of PR metadata and scope
declaration. These checks remain mandatory:

- `git diff --check`;
- sensitive-path policy;
- added-line secret scanning;
- Markdown validation;
- Quality Gate Impact validation;
- changed-file classification;
- same-repository comparison range validation.

Human pull requests continue to require the complete body template and exact
scope checkboxes.

## Validation

Contract tests cover:

- valid Dependabot identity;
- human author spoofing;
- non-Dependabot branch spoofing;
- fork spoofing;
- workspace manifest plus root lockfile updates;
- GitHub Actions workflow updates;
- runtime-source rejection;
- added, deleted and renamed file rejection.

## Rollback

Revert the DP-2 commit. Human and Dependabot pull requests will again use the
same manual metadata and scope contract. No runtime, API, database,
authentication or application behavior is affected.
