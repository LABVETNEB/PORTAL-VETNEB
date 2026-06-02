import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const BELL_PATH =
  "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";
const TOPBAR_PATH =
  "frontend/src/components/dashboard/DashboardTopbar.tsx";
const PARTICULARES_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── 1. Auto-show panel when unread notifications exist on load ───────────────

test("notifications bell auto-opens desktop panel on mount when unread count > 0", () => {
  const source = read(BELL_PATH);

  // Initial load effect wired to loadNotifications
  assert.ok(
    source.includes("void loadNotifications();\n  }, [loadNotifications]);"),
    "mount effect must call loadNotifications once",
  );

  // Auto-show logic: opens panel when new unread exceeds tracked threshold
  assert.ok(
    source.includes("newUnreadCount > autoShownUnreadCountRef.current"),
    "auto-show guard must compare against tracked threshold",
  );
  assert.ok(
    source.includes("setIsOpen(true)"),
    "desktop path must call setIsOpen(true)",
  );
  assert.ok(
    source.includes("autoShownUnreadCountRef.current = newUnreadCount"),
    "threshold must be updated after auto-show",
  );
});

// ── 2. No auto-show when inbox is empty ─────────────────────────────────────

test("notifications bell does not auto-show when unread count is zero", () => {
  const source = read(BELL_PATH);

  // Guard: auto-show block is inside the `> 0` branch
  assert.ok(
    source.includes("if (newUnreadCount === 0)"),
    "zero-unread path must reset the threshold ref",
  );
  assert.ok(
    source.includes("autoShownUnreadCountRef.current = 0"),
    "threshold ref must be reset to 0 when inbox is empty",
  );
  // The reset and the auto-show are in separate branches (no setIsOpen in the
  // zero branch). Verify the reset statement is NOT immediately followed by
  // setIsOpen(true) on the same condition.
  const zeroBlock = source.slice(
    source.indexOf("if (newUnreadCount === 0)"),
    source.indexOf("} else if (newUnreadCount > autoShownUnreadCountRef"),
  );
  assert.equal(
    zeroBlock.includes("setIsOpen(true)"),
    false,
    "zero-unread branch must not call setIsOpen(true)",
  );
  assert.equal(
    zeroBlock.includes("setMobileBannerVisible(true)"),
    false,
    "zero-unread branch must not show mobile banner",
  );
});

// ── 3. Mobile surface: visible banner, not just dropdown ────────────────────

test("notifications bell shows visible mobile banner as auto-show surface", () => {
  const source = read(BELL_PATH);

  assert.ok(
    source.includes("mobileBannerVisible"),
    "mobileBannerVisible state must exist",
  );
  assert.ok(
    source.includes("setMobileBannerVisible(true)"),
    "mobile path must activate banner",
  );
  assert.ok(
    source.includes('isMobileRef.current'),
    "component must detect mobile breakpoint via ref",
  );
  assert.ok(
    source.includes("createPortal"),
    "mobile banner must use createPortal for safe rendering",
  );
  assert.ok(
    source.includes('role="region"'),
    "mobile banner must carry region role for accessibility",
  );
  assert.ok(
    source.includes("sm:hidden"),
    "mobile banner must be hidden on desktop (sm:hidden)",
  );
  assert.ok(
    source.includes("fixed inset-x-0"),
    "mobile banner must use fixed full-width positioning",
  );
});

// ── 4. Badge renders unread count correctly ──────────────────────────────────

test("notifications bell badge renders unread count with correct positioning and contrast", () => {
  const source = read(BELL_PATH);

  // Badge span exists and is positioned correctly
  assert.ok(
    source.includes('className="absolute -right-1 -top-1'),
    "badge must use absolute -right-1 -top-1 positioning",
  );
  assert.ok(
    source.includes("min-h-[1.1rem] min-w-[1.1rem]"),
    "badge must define both min-height and min-width",
  );
  assert.ok(
    source.includes("rounded-full bg-vetneb-teal"),
    "badge must use rounded-full with teal background",
  );
  assert.ok(
    source.includes("text-vetneb-navy"),
    "badge must use navy text for contrast against teal",
  );
  assert.ok(
    source.includes("font-semibold"),
    "badge text must be semibold for legibility",
  );
});

// ── 5. Badge displays 99+ when count exceeds 99 ──────────────────────────────

test("notifications bell badge displays 99+ when unread count exceeds 99", () => {
  const source = read(BELL_PATH);

  assert.ok(
    source.includes('unreadCount > 99 ? "99+" : unreadCount'),
    "badge must cap display at 99+ for counts above 99",
  );
  // The 99+ cap must also appear in the mobile banner
  const mobileBannerSection = source.slice(
    source.indexOf("portalContainer && mobileBannerVisible"),
  );
  assert.ok(
    mobileBannerSection.includes('unreadCount > 99 ? "99+" : unreadCount'),
    "mobile banner must also cap badge at 99+",
  );
});

// ── 6. Closing auto surface prevents immediate reopen ────────────────────────

test("notifications bell does not reopen panel after user closes it if count unchanged", () => {
  const source = read(BELL_PATH);

  // The only condition that re-opens is strictly greater-than
  assert.ok(
    source.includes("newUnreadCount > autoShownUnreadCountRef.current"),
    "reopen guard must be strict greater-than, not greater-or-equal",
  );
  // handleCloseMobileBanner must NOT reset autoShownUnreadCountRef
  const closeFnStart = source.indexOf("function handleCloseMobileBanner()");
  const closeFnEnd = source.indexOf("\n  }", closeFnStart) + 4;
  const closeFnBody = source.slice(closeFnStart, closeFnEnd);
  assert.equal(
    closeFnBody.includes("autoShownUnreadCountRef"),
    false,
    "closing mobile banner must not manipulate autoShownUnreadCountRef",
  );
});

// ── 7. Auto-show does not mark notifications as read ─────────────────────────

test("notifications bell auto-show does not call mark-as-read APIs", () => {
  const source = read(BELL_PATH);

  // Locate the auto-show block boundaries
  const autoShowStart = source.indexOf(
    "// Auto-show logic: open automatically",
  );
  assert.ok(autoShowStart !== -1, "auto-show logic block must exist");

  // The auto-show block ends before the catch
  const autoShowEnd = source.indexOf("} catch {", autoShowStart);
  const autoShowBlock = source.slice(autoShowStart, autoShowEnd);

  assert.equal(
    autoShowBlock.includes("markDashboardNotificationRead"),
    false,
    "auto-show block must not call markDashboardNotificationRead",
  );
  assert.equal(
    autoShowBlock.includes("markAllDashboardNotificationsRead"),
    false,
    "auto-show block must not call markAllDashboardNotificationsRead",
  );
  assert.equal(
    autoShowBlock.includes("isRead: true"),
    false,
    "auto-show block must not mutate isRead state",
  );
});

// ── 8. All three roles wire the bell component ───────────────────────────────

test("admin role wires notifications bell via DashboardTopbar", () => {
  const source = read(TOPBAR_PATH);

  assert.ok(
    source.includes(
      'notifications?: "admin" | "clinic" | "particular" | false;',
    ),
    "topbar must accept all three surfaces",
  );
  assert.ok(
    source.includes(
      "{notifications ? <DashboardNotificationsBell surface={notifications} /> : null}",
    ),
    "topbar must pass surface to bell",
  );
});

test("clinic and admin dashboards pass surface to topbar notifications prop", () => {
  const clinicPage = readFileSync(
    resolve(process.cwd(), "frontend/src/app/dashboard/page.tsx"),
    "utf8",
  );
  const adminPage = readFileSync(
    resolve(process.cwd(), "frontend/src/app/dashboard/admin/page.tsx"),
    "utf8",
  );

  assert.ok(
    clinicPage.includes('notifications="clinic"'),
    "clinic dashboard must pass notifications='clinic'",
  );
  assert.ok(
    adminPage.includes('notifications="admin"'),
    "admin dashboard must pass notifications='admin'",
  );
});

test("particular role wires notifications bell when session is active", () => {
  const source = read(PARTICULARES_PATH);

  assert.ok(
    source.includes(
      'import { DashboardNotificationsBell } from "@/components/dashboard/DashboardNotificationsBell";',
    ),
    "ParticularesContent must import DashboardNotificationsBell",
  );
  assert.ok(
    source.includes('<DashboardNotificationsBell surface="particular" />'),
    "ParticularesContent must render bell with particular surface",
  );
});
