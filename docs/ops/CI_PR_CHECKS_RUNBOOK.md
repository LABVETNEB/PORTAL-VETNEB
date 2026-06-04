# CI PR Checks Runbook

## Objetivo

Documentar cómo verificar checks de GitHub Actions en pull requests de Portal VETNEB sin confundir estados temporales de GitHub CLI con ausencia real de CI.

## Workflows actuales

Los workflows relevantes son:

- Backend CI
- Frontend CI
- Supabase Preview

## Backend CI

Backend CI corre en pull requests hacia main.

Backend CI también corre en push hacia main y hacia ramas:

- chore/**
- feat/**
- fix/**
- refactor/**
- ci/**
- test/**
- codex/**

Por eso, en PRs desde ramas fix/** puede aparecer Backend CI dos veces:

- validate-backend por push
- validate-backend por pull_request

## Frontend CI

Frontend CI corre en pull requests hacia main cuando cambian:

- frontend/**
- pnpm-lock.yaml
- pnpm-workspace.yaml
- package.json
- .github/workflows/frontend-ci.yml

Frontend CI también corre en push hacia main para esos mismos paths.

Frontend CI no corre por push a ramas fix/**. Corre por pull_request.

## Supabase Preview

Supabase Preview puede aparecer como SKIPPED.

Ese estado no implica fallo del PR.

## Verificacion antes de mergear

Despues de crear un PR, no asumir que gh pr checks --watch muestra todos los checks si se ejecuta inmediatamente.

Primero inspeccionar el rollup real del PR.

Ejemplo real usado en este repo:

    cd C:\PORTAL-VETNEB
    gh pr view 861 --json number,title,state,headRefName,baseRefName,mergeStateStatus,statusCheckRollup

Luego ejecutar, desde la rama del PR:

    cd C:\PORTAL-VETNEB
    gh pr checks --watch

## Estado aceptable antes de mergear

Se puede mergear cuando el rollup muestra:

- 0 failing
- 0 pending
- Backend CI validate-backend en SUCCESS cuando corresponde
- Frontend CI validate-frontend en SUCCESS cuando corresponde por paths
- Supabase Preview puede estar SKIPPED

No mergear si el rollup muestra:

- IN_PROGRESS
- QUEUED
- FAILURE
- CANCELLED
- TIMED_OUT

## Despues de mergear

No ejecutar gh pr checks --watch desde main esperando encontrar el PR recien mergeado.

Desde main puede responder:

    no pull requests found for branch "main"

Eso es normal.

Para auditar un PR ya mergeado, usar el numero real del PR.

Ejemplo real:

    cd C:\PORTAL-VETNEB
    gh pr view 861 --json number,title,state,headRefName,baseRefName,mergeStateStatus,statusCheckRollup

## Merge y limpieza local

Usar siempre squash merge explicito.

Ejemplo real:

    cd C:\PORTAL-VETNEB
    gh pr merge 861 --squash --delete-branch
    git fetch origin --prune
    git reset --hard origin/main
    git status --short
    git log -1 --oneline
    gh pr list --state open --limit 30
    git branch -r --no-merged origin/main
    git branch

## Regla operativa

No usar comandos finales con placeholders.

Antes de ejecutar, usar el numero real del PR activo.
