"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * C08 · menu primitives (audit §46: item 32 px, surface min 200 px, elevation 2).
 * One surface implementation serves the four published names: `ActionMenu`
 * (trigger + menu), `OverflowMenu` (its icon-only adapter), `ContextMenu`
 * (same surface, opened on a host region) and `SubMenu` (nested level).
 * Presentation only: every action is the host's `onSelect`; the owner keeps the
 * open state and nothing else. Bulk actions on a selection are C09.
 */

type MenuAnchor =
  | { kind: "trigger"; element: HTMLElement; align: "start" | "end" }
  | { kind: "item"; element: HTMLElement }
  | { kind: "point"; x: number; y: number };

type OpenMenu = { anchor: MenuAnchor; focus: "first" | "last" };
type MenuRoot = { rootId: string; closeAll: (restoreFocus: boolean) => void };
type MenuLevel = { openChild: string | null; setOpenChild: Dispatch<SetStateAction<string | null>> };

const MenuRootContext = createContext<MenuRoot | null>(null);
const MenuLevelContext = createContext<MenuLevel | null>(null);

const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;
const SURFACE_PADDING = 8;
const PORTAL_ROOT = '[data-dashboard-portal-root="true"]';
const NATIVE_MENU_TARGETS = 'input, textarea, select, [contenteditable="true"]';
const ITEM_CLASS =
  "flex h-12 md:h-8 w-full items-center gap-2 px-3 text-left text-[0.8125rem] font-normal leading-5 text-foreground outline-none hover:bg-accent/70 focus:bg-accent/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/85 aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

function useMenuRootContext(): MenuRoot {
  const root = useContext(MenuRootContext);
  if (!root) throw new Error("menu items must render inside ActionMenu, OverflowMenu or ContextMenu");
  return root;
}

function useMenuLevelContext(): MenuLevel {
  const level = useContext(MenuLevelContext);
  if (!level) throw new Error("menu items must render inside a menu surface");
  return level;
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(':scope > [role=menuitem]')];
}

/**
 * Fixed placement against the viewport: flips when there is no room, then clamps on both axes.
 * It runs in a layout effect, before paint, so the surface needs no hidden first frame; it is
 * `transition-none` because under reduced motion the global 0.01ms transition would otherwise
 * hold it at the origin while it is measured and its first item takes focus.
 */
function placeMenu(menu: HTMLElement, anchor: MenuAnchor) {
  const { width, height } = menu.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  let left: number;
  let top: number;
  if (anchor.kind === "point") {
    left = anchor.x + width > viewportWidth - VIEWPORT_MARGIN ? anchor.x - width : anchor.x;
    top = anchor.y + height > viewportHeight - VIEWPORT_MARGIN ? anchor.y - height : anchor.y;
  } else {
    const rect = anchor.element.getBoundingClientRect();
    if (anchor.kind === "item") {
      left = rect.right + width > viewportWidth - VIEWPORT_MARGIN ? rect.left - width : rect.right;
      top = rect.top - SURFACE_PADDING;
    } else {
      const below = rect.bottom + TRIGGER_GAP;
      left = anchor.align === "end" ? rect.right - width : rect.left;
      top = below + height > viewportHeight - VIEWPORT_MARGIN ? rect.top - TRIGGER_GAP - height : below;
    }
  }
  menu.style.left = `${Math.round(Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - width - VIEWPORT_MARGIN)))}px`;
  menu.style.top = `${Math.round(Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - height - VIEWPORT_MARGIN)))}px`;
}

/** Open state of one menu tree, its outside-dismiss listeners and the element focus returns to. */
function useMenuRoot() {
  const rootId = useId();
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);

  const closeAll = useCallback((restoreFocus: boolean) => {
    setMenu(null);
    if (restoreFocus) restoreTarget.current?.focus({ preventScroll: true });
  }, []);

  /** `restore` is where focus returns on close; `undefined` keeps the opener of the menu already open. */
  const openAt = useCallback((next: OpenMenu, restore: HTMLElement | null | undefined) => {
    if (restore !== undefined) restoreTarget.current = restore;
    setMenu(next);
  }, []);

  const open = menu !== null;
  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: Event) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`[data-action-menu-root="${rootId}"]`)) return;
      closeAll(false);
    }
    function dismissOnViewportChange() {
      closeAll(true);
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    window.addEventListener("resize", dismissOnViewportChange);
    window.addEventListener("scroll", dismissOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      window.removeEventListener("resize", dismissOnViewportChange);
      window.removeEventListener("scroll", dismissOnViewportChange, true);
    };
  }, [open, rootId, closeAll]);

  const root = useMemo(() => ({ rootId, closeAll }), [rootId, closeAll]);
  return { root, menu, openAt, closeAll };
}

type MenuSurfaceProps = {
  id: string;
  anchor: MenuAnchor;
  focus: "first" | "last";
  label?: string;
  labelledBy?: string;
  /** Closes this level only: the root restores its opener, a submenu its parent item. */
  onDismiss: () => void;
  children: ReactNode;
};

function MenuSurface({ id, anchor, focus, label, labelledBy, onDismiss, children }: MenuSurfaceProps) {
  const root = useMenuRootContext();
  const surface = useRef<HTMLDivElement>(null);
  const [openChild, setOpenChild] = useState<string | null>(null);
  const level = useMemo(() => ({ openChild, setOpenChild }), [openChild]);

  useLayoutEffect(() => {
    const menu = surface.current;
    if (!menu) return;
    placeMenu(menu, anchor);
    const items = menuItems(menu);
    (focus === "last" ? items[items.length - 1] : items[0])?.focus({ preventScroll: true });
  }, [anchor, focus]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The surface is portalled: without this, keys would bubble through React to the parent level and the host.
    event.stopPropagation();
    const items = menuItems(event.currentTarget);
    const current = items.findIndex((item) => item === document.activeElement);
    const move = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus({ preventScroll: true });
    };
    switch (event.key) {
      case "ArrowDown":
        move(current + 1);
        break;
      case "ArrowUp":
        move(current < 0 ? -1 : current - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(-1);
        break;
      case "Escape":
        event.preventDefault();
        onDismiss();
        break;
      case "ArrowLeft":
        if (anchor.kind === "item") {
          event.preventDefault();
          onDismiss();
        }
        break;
      case "Tab":
        // Not trapped: focus returns to the opener and the browser moves on from there.
        root.closeAll(true);
        break;
      default:
        if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const key = event.key.toLocaleLowerCase();
          [...items.slice(current + 1), ...items.slice(0, current + 1)]
            .find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(key))
            ?.focus({ preventScroll: true });
        }
    }
  }

  return createPortal(
    <MenuLevelContext.Provider value={level}>
      <div
        ref={surface}
        id={id}
        role="menu"
        aria-orientation="vertical"
        aria-label={label}
        aria-labelledby={labelledBy}
        data-action-menu-surface={anchor.kind === "item" ? "sub" : "root"}
        data-action-menu-root={root.rootId}
        className="fixed left-0 top-0 z-50 transition-none min-w-[200px] max-w-[calc(100vw-1rem)] rounded-lg bg-popover py-2 text-popover-foreground shadow-[var(--clinical-shadow-md)] outline-none"
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </MenuLevelContext.Provider>,
    document.querySelector<HTMLElement>(PORTAL_ROOT) ?? document.body,
  );
}

/** A selection that reaches the element; one elsewhere in the document is not this target's. */
function selectionCovers(element: Element) {
  const selection = window.getSelection();
  if (!selection?.toString()) return false;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    if (selection.getRangeAt(index).intersectsNode(element)) return true;
  }
  return false;
}

/** Copy and paste stay with the browser menu: over the text selection or an editable field. */
function keepsNativeMenu(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  return Boolean(element && (selectionCovers(element) || element.closest(NATIVE_MENU_TARGETS)));
}

function focusOnHover(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget) {
    event.currentTarget.focus({ preventScroll: true });
  }
}

export type ActionMenuItemProps = {
  children: ReactNode;
  /** The host's action. Runs once, after the menu closed and focus returned to the opener. */
  onSelect: () => void;
  /** Stays focusable and announced, never runs `onSelect`. */
  disabled?: boolean;
  icon?: ReactNode;
};

export function ActionMenuItem({ children, onSelect, disabled = false, icon }: ActionMenuItemProps) {
  const root = useMenuRootContext();
  const level = useMenuLevelContext();

  function select() {
    if (disabled) return;
    root.closeAll(true);
    onSelect();
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled ? "true" : undefined}
      className={ITEM_CLASS}
      onClick={select}
      onFocus={() => level.setOpenChild(null)}
      onPointerMove={focusOnHover}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export type SubMenuProps = {
  label: ReactNode;
  /** `ActionMenuItem` and nested `SubMenu` elements. */
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
};

export function SubMenu({ label, children, disabled = false, icon }: SubMenuProps) {
  const level = useMenuLevelContext();
  const id = useId();
  const menuId = useId();
  const [item, setItem] = useState<HTMLButtonElement | null>(null);
  const anchor = useMemo<MenuAnchor | null>(() => (item ? { kind: "item", element: item } : null), [item]);
  const open = level.openChild === id;

  function openSubmenu() {
    if (disabled) return;
    level.setOpenChild(id);
  }

  return (
    <>
      <button
        ref={setItem}
        id={id}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-disabled={disabled ? "true" : undefined}
        className={ITEM_CLASS}
        onClick={openSubmenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            openSubmenu();
          }
        }}
        // Focus arriving here closes a sibling submenu, never this one: hover opens it and focuses it in the same gesture.
        onFocus={() => level.setOpenChild((current) => (current === id ? current : null))}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") openSubmenu();
        }}
        onPointerMove={focusOnHover}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight aria-hidden="true" className="text-muted-foreground" />
      </button>
      {open && anchor ? (
        <MenuSurface
          id={menuId}
          anchor={anchor}
          focus="first"
          labelledBy={id}
          onDismiss={() => {
            level.setOpenChild(null);
            item?.focus({ preventScroll: true });
          }}
        >
          {children}
        </MenuSurface>
      ) : null}
    </>
  );
}

export type ActionMenuProps = {
  /** Trigger content. Visible text names both the trigger and the menu. */
  trigger: ReactNode;
  /** Accessible name for a trigger without visible text. */
  label?: string;
  /** `ActionMenuItem` and `SubMenu` elements. */
  children: ReactNode;
  /** Edge of the trigger the menu lines up with. */
  align?: "start" | "end";
  disabled?: boolean;
  /** The host owns the trigger geometry: 44 px below md and 32 px from md unless overridden. */
  triggerClassName?: string;
};

export function ActionMenu({ trigger, label, children, align = "start", disabled = false, triggerClassName }: ActionMenuProps) {
  const { root, menu, openAt, closeAll } = useMenuRoot();
  const triggerId = useId();
  const menuId = useId();
  const open = menu !== null;

  function openFrom(element: HTMLElement, focus: "first" | "last") {
    openAt({ anchor: { kind: "trigger", element, align }, focus }, element);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        openFrom(event.currentTarget, "first");
        break;
      case "ArrowUp":
        event.preventDefault();
        openFrom(event.currentTarget, "last");
        break;
    }
  }

  return (
    <MenuRootContext.Provider value={root}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        id={triggerId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        data-action-menu-trigger="true"
        data-action-menu-root={root.rootId}
        className={cn("h-11 min-w-11 gap-1.5 px-3 text-xs md:h-8 md:min-w-0", triggerClassName)}
        onClick={(event) => (open ? closeAll(false) : openFrom(event.currentTarget, "first"))}
        onKeyDown={onKeyDown}
      >
        {trigger}
      </Button>
      {menu ? (
        <MenuSurface id={menuId} anchor={menu.anchor} focus={menu.focus} labelledBy={triggerId} onDismiss={() => closeAll(true)}>
          {children}
        </MenuSurface>
      ) : null}
    </MenuRootContext.Provider>
  );
}

export type OverflowMenuProps = Omit<ActionMenuProps, "trigger" | "label"> & {
  /** The trigger is icon-only: its name is required. */
  label: string;
};

export function OverflowMenu({ label, align = "end", triggerClassName, ...menu }: OverflowMenuProps) {
  return (
    <ActionMenu
      {...menu}
      label={label}
      align={align}
      triggerClassName={cn("w-11 px-0 md:w-8", triggerClassName)}
      trigger={<MoreVertical aria-hidden="true" />}
    />
  );
}

/** Spread on the element that owns the context menu; it adds no DOM node of its own. */
export type ContextMenuRegionProps = {
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export type ContextMenuProps = {
  /** Accessible name of the menu. */
  label: string;
  /** `ActionMenuItem` and `SubMenu` elements. */
  menu: ReactNode;
  /** When true the region keeps the browser's own context menu, as it always does over selected text and editable fields. */
  disabled?: boolean;
  children: (region: ContextMenuRegionProps) => ReactNode;
};

export function ContextMenu({ label, menu: items, disabled = false, children }: ContextMenuProps) {
  const { root, menu, openAt, closeAll } = useMenuRoot();
  const menuId = useId();
  const enabled = !disabled;

  const region: ContextMenuRegionProps = {
    onContextMenu(event) {
      if (!enabled || keepsNativeMenu(event.target)) return;
      event.preventDefault();
      const focused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      const reopening = focused?.closest("[data-action-menu-surface]") ? undefined : focused;
      openAt({ anchor: { kind: "point", x: event.clientX, y: event.clientY }, focus: "first" }, reopening);
    },
    onKeyDown(event) {
      if (!enabled || keepsNativeMenu(event.target)) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const element = event.target instanceof HTMLElement ? event.target : event.currentTarget;
        openAt({ anchor: { kind: "trigger", element, align: "start" }, focus: "first" }, element);
      }
    },
  };

  return (
    <MenuRootContext.Provider value={root}>
      {children(region)}
      {menu ? (
        <MenuSurface id={menuId} anchor={menu.anchor} focus={menu.focus} label={label} onDismiss={() => closeAll(true)}>
          {items}
        </MenuSurface>
      ) : null}
    </MenuRootContext.Provider>
  );
}
