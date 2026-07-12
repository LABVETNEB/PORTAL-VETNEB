# CI PR Checks Runbook

## Objetivo

Documentar cómo verificar los checks de GitHub Actions en pull requests de Portal VETNEB sin confundir:

- el gate global requerido por branch protection;
- workflows condicionales por paths;
- integraciones externas que pueden aparecer como `SKIPPED`;
- estados transitorios de GitHub CLI con ausencia real de CI.

## Mapa de checks vigente

| Check / integración | Aplica a | Requerido globalmente | Estado esperado |
| --- | --- | --- | --- |
| `validate-pr-governance` | Todos los PR hacia `main` | Sí | `SUCCESS` antes de merge |
| `validate-backend` | PR no docs-only y cambios alcanzados por Backend CI | No; condicional por workflow | `SUCCESS` cuando aparece |
| `validate-frontend` | Paths frontend, manifests y workspace definidos | No; condicional por workflow | `SUCCESS` cuando aparece |
| Supabase Preview | Paths administrados por la integración | No | Puede ser `SUCCESS` o `SKIPPED` |

## PR Governance

`PR Governance` corre en todos los pull requests hacia `main`.

El job requerido se denomina exactamente:

```text
validate-pr-governance
```

Branch protection exige ese contexto con strict status checks.

Valida:

- integridad del diff;
- política de archivos sensibles;
- secretos en líneas agregadas;
- Markdown y enlaces locales;
- metadata mínima del PR;
- clasificación y coherencia de scope.

No mergear si este job aparece como:

- `QUEUED`;
- `IN_PROGRESS`;
- `FAILURE`;
- `CANCELLED`;
- `TIMED_OUT`;
- ausente cuando el PR apunta a `main`.

## Backend CI

Backend CI corre en pull requests hacia `main`, excepto cuando todo el diff queda cubierto por:

- `docs/**`;
- `**/*.md`.

También corre en push hacia `main` y hacia ramas:

- `chore/**`;
- `feat/**`;
- `fix/**`;
- `refactor/**`;
- `ci/**`;
- `test/**`;
- `codex/**`.

Por eso, en algunas ramas puede aparecer `validate-backend` dos veces:

- evento `push`;
- evento `pull_request`.

Cuando corresponde, el job debe finalizar en `SUCCESS`.

Backend CI ejecuta:

1. instalación con lockfile congelado;
2. auditoría de dependencias;
3. migraciones sobre Postgres efímero;
4. `pnpm typecheck`;
5. `pnpm typecheck:test`;
6. `pnpm test`;
7. `pnpm build`.

Un PR docs-only puede omitir Backend CI por diseño. Esa omisión no equivale a fallo mientras `validate-pr-governance` esté presente y verde.

## Frontend CI

Frontend CI corre en pull requests hacia `main` cuando cambian:

- `frontend/**`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `package.json`;
- `.github/workflows/frontend-ci.yml`.

También corre en push hacia `main` para esos mismos paths.

Cuando corresponde, `validate-frontend` debe finalizar en `SUCCESS`.

Frontend CI ejecuta:

1. instalación con lockfile congelado;
2. lint frontend;
3. typecheck frontend;
4. build frontend;
5. auditoría de superficie pública;
6. suites E2E estratificadas;
7. artifact Playwright solo ante failure.

Un PR sin paths frontend/dependencias puede omitir Frontend CI por diseño.

## Supabase Preview

Supabase Preview puede aparecer como `SKIPPED` cuando el diff no afecta los paths administrados por la integración.

Ese estado no implica fallo del PR.

No asumir que cualquier otro check `SKIPPED` es aceptable: evaluar su aplicabilidad y el contrato del workflow correspondiente.

## Verificación antes de mergear

### Terminal 1

```powershell
cd C:\PORTAL-VETNEB

$prNumber = <NUMERO_REAL_DEL_PR>

gh pr view $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --json number,title,state,headRefName,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup

gh pr checks $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --watch
```

No ejecutar comandos finales con placeholders. Sustituir `<NUMERO_REAL_DEL_PR>` antes de ejecutar.

## Estado aceptable antes de mergear

Se puede considerar el merge solamente cuando:

- `validate-pr-governance` está en `SUCCESS`;
- no hay checks aplicables en `QUEUED` o `IN_PROGRESS`;
- no hay checks aplicables en `FAILURE`, `CANCELLED` o `TIMED_OUT`;
- `validate-backend` está en `SUCCESS` cuando corresponde;
- `validate-frontend` está en `SUCCESS` cuando corresponde;
- Supabase Preview puede estar `SKIPPED` cuando no aplica;
- el PR sigue abierto, no es draft y apunta a `main`;
- el head SHA verificado coincide con el SHA que se va a fusionar;
- el diff y el scope siguen siendo los revisados.

## Estado bloqueante

No mergear si ocurre cualquiera de estos casos:

- `validate-pr-governance` ausente o no exitoso;
- check aplicable pendiente o fallido;
- head SHA cambió después de la revisión;
- aparecieron archivos fuera de scope;
- el PR está detrás de `main` y la política vigente exige actualización;
- existen conversaciones sin resolver;
- GitHub informa bloqueo de branch protection.

## Merge seguro

Usar squash merge explícito y fijar el head SHA cuando se automatiza mediante API o conector.

### Terminal 1

```powershell
cd C:\PORTAL-VETNEB

$prNumber = <NUMERO_REAL_DEL_PR>

gh pr merge $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --squash
```

No usar `--admin` para evitar checks requeridos.

## Sincronización posterior al merge

Desde `main`, no ejecutar `gh pr checks --watch` sin número esperando que encuentre el PR recién fusionado. Puede responder que no existe un PR para la rama `main`; eso es normal.

### Terminal 1

```powershell
cd C:\PORTAL-VETNEB

git branch --show-current
git status --short --untracked-files=all
git fetch --prune
git switch main
git pull --ff-only
git status --short --untracked-files=all
git log -1 --oneline
git branch --remotes
git worktree list
gh pr list `
  --repo LABVETNEB/PORTAL-VETNEB `
  --state open
```

No usar `git reset --hard` como procedimiento normal de sincronización o cleanup.

## Cleanup de rama de entrega

Eliminar una rama remota solamente después de verificar:

- PR fusionada o cerrada según el objetivo;
- head SHA exacto;
- ausencia de commits exclusivos que deban preservarse;
- working tree local limpio;
- rama no asociada al segundo worktree.

Después de eliminar:

```powershell
cd C:\PORTAL-VETNEB

git fetch --prune
git branch --remotes
git ls-remote --heads origin
git worktree list
```

## Auditoría de un PR ya fusionado

Usar el número real del PR:

```powershell
cd C:\PORTAL-VETNEB

$prNumber = <NUMERO_REAL_DEL_PR>

gh pr view $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --json number,title,state,mergedAt,mergeCommit,headRefName,headRefOid,baseRefName,statusCheckRollup,url
```

## Regla operativa

- No usar comandos finales con placeholders.
- No tratar un check condicional ausente como fallo sin revisar sus paths.
- No tratar `mergeable` como equivalente a cumplimiento de branch protection.
- No usar `--admin` para eludir gates.
- No usar `git reset --hard` como cleanup estándar.
- Mantener este runbook alineado con los nombres reales de workflows, jobs, triggers y branch protection.

## Evidencia relacionada

- [CI/CD Pipeline Governance implementation closeout](../implementation/ci-pipeline-governance-closeout.md)
- [CI/CD Pipeline Governance closeout audit](../audit/ci-pipeline-governance-closeout-audit.md)
- [Branch Protection Governance implementation closeout](../implementation/branch-protection-governance-closeout.md)
- [Review Governance](../review-governance.md)