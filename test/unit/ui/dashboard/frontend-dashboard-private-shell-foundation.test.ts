import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  assertPlainProps,
  effectiveAttribute,
  elementText,
  exportedFunction,
  type JsxNode,
  parseTsx,
  renderedUnder,
  staticAttribute,
  unwrap,
} from "./dashboard-source-oracle.ts";

const STATUS_BADGE_PATH = "frontend/src/components/dashboard/StatusBadge.tsx";
const EMPTY_STATE_PATH = "frontend/src/components/dashboard/EmptyState.tsx";
const LOADING_STATE_PATH = "frontend/src/components/dashboard/LoadingState.tsx";
const ERROR_STATE_PATH = "frontend/src/components/dashboard/ErrorState.tsx";
const PAGE_HEADER_PATH =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const PRIVATE_SHELL_PATH =
  "frontend/src/components/dashboard/PrivateDashboardShell.tsx";

// TEST-GLOBAL-07 (G06-D13): the root announces role="alert" on every render and
// "Reintentar", wired to `onRetry`, renders exactly when a callback is given.
// `.includes("onRetry ? (")` also matches the inverted `!onRetry ? (`
// (C.15.1 M-D11).
function retryRendering(source: string) {
  const component = exportedFunction(parseTsx(source, ERROR_STATE_PATH), "ErrorState");
  const wiresRetry = (element: JsxNode) => {
    const onClick = effectiveAttribute(element, "onClick");
    return onClick.kind === "value" && unwrap(onClick.expression).getText() === "onRetry";
  };

  assertPlainProps(component, ["onRetry"]);

  const withCallback = renderedUnder(component, new Map([["onRetry", true]]));
  const withoutCallback = renderedUnder(component, new Map([["onRetry", false]]));
  return {
    alertRoot: [withCallback, withoutCallback].every((rendered) =>
      rendered.some((r) => r.must && staticAttribute(r.element, "role") === "alert"),
    ),
    retryWithCallback: withCallback.some(
      (r) => r.must && wiresRetry(r.element) && elementText(r.element) === "Reintentar",
    ),
    retryWithoutCallback: withoutCallback.some(
      (r) => wiresRetry(r.element) || elementText(r.element).includes("Reintentar"),
    ),
  };
}

test("status badge maps required report and logistics statuses to icon text and semantic class", () => {
  const source = read(STATUS_BADGE_PATH);
  const statuses = [
    "uploaded",
    "processing",
    "ready",
    "delivered",
    "pending",
    "in_progress",
    "done",
    "canceled",
    "error",
    "failed",
    "active",
    "inactive",
    "unknown",
  ];

  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes("type LucideIcon"));
  assert.ok(source.includes("icon: LucideIcon;"));
  assert.ok(source.includes("semanticClass: string;"));
  assert.ok(source.includes("toneClassName: string;"));

  for (const status of statuses) {
    assert.ok(source.includes(`${status}: {`));
  }

  assert.ok(source.includes('semanticClass: "status-badge-uploaded"'));
  assert.ok(source.includes('semanticClass: "status-badge-processing"'));
  assert.ok(source.includes('semanticClass: "status-badge-ready"'));
  assert.ok(source.includes('semanticClass: "status-badge-delivered"'));
  assert.ok(source.includes('semanticClass: "status-badge-pending"'));
  assert.ok(source.includes('semanticClass: "status-badge-in-progress"'));
  assert.ok(source.includes('semanticClass: "status-badge-done"'));
  assert.ok(source.includes('semanticClass: "status-badge-canceled"'));
  assert.ok(source.includes('label: "Desconocido"'));
  assert.ok(source.includes("function isKnownStatus(status: string): status is KnownStatus"));
  assert.ok(source.includes('return isKnownStatus(status) ? status : "unknown";'));
  assert.ok(source.includes("data-status={normalizedStatus}"));
  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes("<span>{label ?? config.label}</span>"));
});

test("status badge exposes stable props and size variants", () => {
  const source = read(STATUS_BADGE_PATH);

  assert.ok(source.includes("export type StatusBadgeProps = {"));
  assert.ok(source.includes("status: string;"));
  assert.ok(source.includes("label?: string;"));
  assert.ok(source.includes('size?: StatusBadgeSize;'));
  assert.ok(source.includes('type StatusBadgeSize = "sm" | "md";'));
  assert.ok(source.includes('size = "md"'));
  assert.ok(source.includes('size === "sm"'));
  assert.ok(source.includes("className?: string;"));
});

test("empty state renders title description action and optional lucide icon", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes('import { Inbox, type LucideIcon } from "lucide-react";'));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("action?: ReactNode;"));
  assert.ok(source.includes("icon?: LucideIcon;"));
  assert.ok(source.includes("icon: Icon = Inbox"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{description}"));
  assert.ok(source.includes("{action}"));
  assert.ok(source.includes('aria-hidden="true"'));
});

test("loading state renders table cards detail timeline and list variants with skeletons", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('variant?: "table" | "cards" | "detail" | "timeline" | "list";'));
  assert.ok(source.includes("rows?: number;"));
  assert.ok(source.includes('variant = "cards"'));
  assert.ok(source.includes('if (variant === "table")'));
  assert.ok(source.includes('if (variant === "detail")'));
  assert.ok(source.includes('if (variant === "timeline")'));
  assert.ok(source.includes('if (variant === "list")'));
  assert.ok(source.includes('aria-busy="true"'));
  assert.ok(source.includes("getRows(rows)"));
});

test("error state announces alert and wires retry callback", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("message: string;"));
  assert.ok(source.includes("onRetry?: () => void;"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{message}"));
  assert.ok(source.includes("onRetry ? ("));
  assert.ok(source.includes("onClick={onRetry}"));
  assert.ok(source.includes("Reintentar"));
  assert.equal(source.includes("Error desconocido"), false);
  assert.deepEqual(retryRendering(source), {
    alertRoot: true,
    retryWithCallback: true,
    retryWithoutCallback: false,
  });

  const inverted = source.replace("{onRetry ? (", () => "{!onRetry ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(retryRendering(inverted), {
    alertRoot: true,
    retryWithCallback: false,
    retryWithoutCallback: true,
  });
});

test("dashboard page header keeps required title and optional description badge actions", () => {
  const source = read(PAGE_HEADER_PATH);

  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("badge?: ReactNode;"));
  assert.ok(source.includes("actions?: ReactNode;"));
  assert.ok(source.includes("text-xl font-semibold"));
  assert.ok(source.includes("text-sm text-muted-foreground"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{description}"));
  assert.ok(source.includes("{badge}"));
  assert.ok(source.includes("{actions}"));
  assert.ok(source.includes("sm:flex-row sm:items-start sm:justify-between"));
});

test("private dashboard shell renders children through dashboard shell router", () => {
  const source = read(PRIVATE_SHELL_PATH);

  assert.ok(source.includes('import { DashboardShellRouter } from "./DashboardShellRouter";'));
  assert.ok(source.includes("children: ReactNode;"));
  assert.ok(source.includes("export function PrivateDashboardShell({"));
  assert.ok(source.includes("<DashboardShellRouter>{children}</DashboardShellRouter>"));
});
