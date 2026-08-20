"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import {
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
} from "@/features/dashboard/config";
import { buildDashboardModuleHref } from "@/features/dashboard/application";
import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * B06 - WorkspaceAppBar, level 4 of the dashboard shell.
 *
 * The single persistent band at the top of every authenticated workspace:
 * identity, global module search, actions, notifications and account. Its
 * geometry contract is `--dash-app-bar-h` (56px) with a +/-2px band, authored in
 * `styles/dashboard/tokens.css` and applied in `styles/dashboard/layout.css` -
 * never restated as a literal here.
 *
 * PRESENTATION-PURE by contract. Nothing in this module import closure may
 * reach `@/lib/api` or the `app/` layer, which is what lets it be re-exported
 * from `features/dashboard/presentation/shell` (enforced by
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts`). Every
 * behaviour that needs the data layer - logout, admin/clinic session
 * invalidation, notifications, theme, the admin overflow menu - is INJECTED as
 * an already-rendered slot by `DashboardTopbar`, which stays the orchestrator.
 * The bar renders those slots; it never learns what they do.
 *
 * Geometry note (A03): the band participates in the shell height ledger, so its
 * box is BOUNDED, not pinned. `layout.css` declares the 54-58px band as
 * `min-block-size`/`max-block-size`; the row keeps its measured intrinsic height
 * inside that band, so the rows canvas below it - and therefore every adaptive
 * `limit` frozen by A03 - is left exactly where it was. Pinning a point value
 * instead would move `main` and re-page the 15 adaptive consumers.
 *
 * @see docs/implementation/dashboard-b06-workspace-app-bar.md
 */

export type WorkspaceAppBarProps = {
  /** Title/subtitle block. Owned by the orchestrator (aria wiring lives there). */
  readonly identity: ReactNode;
  /** Utility actions (theme, density...). */
  readonly actions?: ReactNode;
  /** Notification affordance. */
  readonly notifications?: ReactNode;
  /** Account/session affordance. */
  readonly account?: ReactNode;
  /** Compact overflow menu rendered outside the desktop action cluster. */
  readonly overflow?: ReactNode;
  /** Disables the global module search (surfaces with no `?module=` grammar). */
  readonly search?: boolean;
};

type ModuleSearchEntry = {
  readonly moduleId: string;
  readonly label: string;
};

/** Accent- and case-insensitive fold, so "clinicas" matches "Clinicas". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchModules(
  entries: readonly ModuleSearchEntry[],
  query: string,
): readonly ModuleSearchEntry[] {
  const needle = fold(query);
  if (!needle) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      fold(entry.label).includes(needle) || fold(entry.moduleId).includes(needle),
  );
}

/**
 * Global module search.
 *
 * Searches the CANONICAL module catalog and navigates with the `?module=`
 * grammar the dashboard already ships - no new endpoint, no ranking service, no
 * dependency. Navigation goes through `router.push`: link elements and
 * `next/link` are forbidden for in-app routing by the repo contract
 * (AGENTS.md 10, `test/unit/ui/`, `security:public-surface`).
 */
function WorkspaceModuleSearch() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith(ROUTES.dashboardAdmin);
  const basePath = isAdmin ? ROUTES.dashboardAdmin : ROUTES.dashboard;
  const entries = useMemo<readonly ModuleSearchEntry[]>(
    () =>
      (isAdmin ? ADMIN_MODULE_NAV_LABELS : CLINIC_MODULE_NAV_LABELS).map(
        (item) => ({ moduleId: item.moduleId, label: item.label }),
      ),
    [isAdmin],
  );

  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => matchModules(entries, query), [entries, query]);
  const activeOption = matches[Math.min(activeIndex, matches.length - 1)];

  const select = useCallback(
    (entry: ModuleSearchEntry | undefined) => {
      if (!entry) {
        return;
      }
      setOpen(false);
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.blur();
      // The clinic workspace activates its module optimistically before the URL
      // commit, exactly as the shipped clinic nav surfaces do; admin has no
      // such activation buffer.
      if (!isAdmin) {
        requestClinicModuleActivate(entry.moduleId);
      }
      router.push(buildDashboardModuleHref(basePath, entry.moduleId));
    },
    [basePath, isAdmin, router],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) =>
          Math.min(index + 1, Math.max(0, matches.length - 1)),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        select(activeOption);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    },
    [activeOption, matches.length, select],
  );

  const expanded = open && matches.length > 0;

  /**
   * Closes only when focus really leaves the search. The usual way to keep a
   * listbox alive through a pointer selection is a pointer-press handler that
   * calls `preventDefault`, and this repo forbids that whole family of
   * handlers on every frontend source file (the text-selection/copy guard in
   * `test/unit/ui/frontend/frontend-visual-consistency.test.ts`). Focus
   * containment reaches the same result without intercepting the pointer at
   * all: the options carry `tabIndex={-1}`, so a click moves focus INTO this
   * wrapper and `relatedTarget` proves it.
   */
  const onWrapperBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }
      setOpen(false);
    },
    [],
  );

  return (
    <div
      className="relative hidden min-w-0 shrink md:block md:w-44 lg:w-60"
      data-workspace-app-bar-search="true"
      onBlur={onWrapperBlur}
    >
      <Search
        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && activeOption
            ? `${listboxId}-${activeOption.moduleId}`
            : undefined
        }
        aria-label="Buscar modulo del dashboard"
        placeholder="Buscar modulo"
        data-workspace-app-bar-search-input="true"
        className="h-9 w-full min-w-0 rounded-md border border-input bg-card/95 pl-7 pr-2 text-[0.8125rem] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {/*
        The listbox element always exists so `aria-controls` always resolves;
        `hidden` (not conditional rendering) keeps that reference valid for
        assistive technology and for the axe contract.
      */}
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Modulos del dashboard"
        hidden={!expanded}
        data-workspace-app-bar-search-results="true"
        className="absolute left-0 top-[calc(100%+0.25rem)] z-50 max-h-64 w-full overflow-y-auto rounded-md border border-input bg-card py-1 text-[0.8125rem]"
      >
        {matches.map((entry) => (
          <li
            key={entry.moduleId}
            id={`${listboxId}-${entry.moduleId}`}
            role="option"
            aria-selected={activeOption?.moduleId === entry.moduleId}
            data-workspace-app-bar-search-option={entry.moduleId}
            // Focusable but not tabbable: the click focuses the option, which is
            // what keeps the listbox open through the selection (see
            // `onWrapperBlur`). Keyboard users never land here — they drive the
            // list from the combobox with aria-activedescendant.
            tabIndex={-1}
            className={cn(
              "cursor-pointer truncate px-2 py-1 text-foreground",
              activeOption?.moduleId === entry.moduleId && "bg-accent/70",
            )}
            onClick={() => select(entry)}
          >
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkspaceAppBar({
  identity,
  actions,
  notifications,
  account,
  overflow,
  search = true,
}: WorkspaceAppBarProps) {
  return (
    <div
      className="flex min-h-[2.75rem] min-w-0 items-center justify-between gap-2 px-3 py-1.5 sm:min-h-[2.5rem] sm:gap-3 sm:px-6"
      data-workspace-app-bar="true"
    >
      {identity}

      {search ? <WorkspaceModuleSearch /> : null}

      <div
        className="ml-2 flex shrink-0 items-center gap-1.5 sm:ml-3 sm:gap-3"
        data-dashboard-desktop-actions="true"
      >
        {actions}
        {notifications}
        {account}
      </div>
      {overflow}
    </div>
  );
}
