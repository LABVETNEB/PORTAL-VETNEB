import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOADING_STATE_PATH = "frontend/src/components/dashboard/LoadingState.tsx";
const EMPTY_STATE_PATH = "frontend/src/components/dashboard/EmptyState.tsx";
const ERROR_STATE_PATH = "frontend/src/components/dashboard/ErrorState.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── LoadingState ────────────────────────────────────────────────────────────

test("loading state has role=status and aria-live=polite for accessible announcement", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes('aria-live="polite"'));
});

test("loading state has sr-only accessible loading text", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("Cargando..."));
});

test("loading state maintains all four variants and skeleton usage", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes('variant?: "table" | "cards" | "detail" | "timeline";'));
  assert.ok(source.includes('if (variant === "table")'));
  assert.ok(source.includes('if (variant === "detail")'));
  assert.ok(source.includes('if (variant === "timeline")'));
  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('aria-busy="true"'));
  assert.ok(source.includes("getRows(rows)"));
});

test("loading state supports optional label and compact props without breaking existing api", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes("label?: string;"));
  assert.ok(source.includes("compact?: boolean;"));
  assert.ok(source.includes('variant = "cards"'));
  assert.ok(source.includes("rows?: number;"));
  assert.ok(source.includes("className?: string;"));
});

test("loading state does not render a fullscreen spinner", () => {
  const source = read(LOADING_STATE_PATH);

  assert.equal(
    source.includes("fixed inset-0"),
    false,
    "loading state must not use fullscreen overlay",
  );
  assert.equal(
    source.includes("animate-spin"),
    false,
    "loading state must not use spinner animation",
  );
});

// ── EmptyState ──────────────────────────────────────────────────────────────

test("empty state retains full existing api surface", () => {
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

test("empty state supports optional eyebrow prop for contextual labeling", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes("eyebrow?: string;"));
  assert.ok(source.includes("{eyebrow}"));
});

test("empty state supports optional secondaryAction prop for dual call-to-action", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes("secondaryAction?: ReactNode;"));
  assert.ok(source.includes("{secondaryAction}"));
});

test("empty state icon wrapper and icon element are both aria-hidden", () => {
  const source = read(EMPTY_STATE_PATH);

  const hiddenCount = (source.match(/aria-hidden="true"/g) ?? []).length;

  assert.ok(
    hiddenCount >= 2,
    `empty state must have aria-hidden on both icon container and icon element, found ${hiddenCount}`,
  );
});

// ── ErrorState ──────────────────────────────────────────────────────────────

test("error state retains full existing api and role=alert", () => {
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
});

test("error state retry button has type=button attribute", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes('type="button"'));
});

test("error state supports optional tone prop for warning and critical severity", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes('tone?: "warning" | "critical";'));
  assert.ok(source.includes('tone = "critical"'));
  assert.ok(source.includes("isWarning"));
});

test("error state supports optional supportText prop for contextual guidance", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes("supportText?: string;"));
  assert.ok(source.includes("{supportText}"));
});

test("error state retry button has explicit focus-visible ring", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes("focus-visible:ring-2"));
});

test("error state does not expose stack traces or internal error details", () => {
  const source = read(ERROR_STATE_PATH);

  assert.equal(source.includes(".stack"), false, "error state must not expose .stack");
  assert.equal(source.includes("Error desconocido"), false);
});

// ── Scope contracts ─────────────────────────────────────────────────────────

test("state components do not import api auth or backend modules", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(
      source.includes('from "@/lib/api"'),
      false,
      `${path} must not import api module`,
    );
    assert.equal(
      source.includes('from "@/lib/auth"'),
      false,
      `${path} must not import auth module`,
    );
    assert.equal(
      source.includes("cookies("),
      false,
      `${path} must not use cookies()`,
    );
    assert.equal(
      source.includes('"/api'),
      false,
      `${path} must not embed /api literals`,
    );
  }
});

test("state components do not use next/link or anchor tags for navigation", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(
      source.includes('from "next/link"'),
      false,
      `${path} must not import next/link`,
    );
  }
});

test("loading state empty state and error state do not touch package deps or tsconfig", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(source.includes("package.json"), false);
    assert.equal(source.includes("tsconfig"), false);
    assert.equal(source.includes("next-env"), false);
  }
});
