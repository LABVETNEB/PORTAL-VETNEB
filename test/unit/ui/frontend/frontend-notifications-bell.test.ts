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

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
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
  assert.ok(
    source.includes("z-[80]"),
    "mobile banner must use a high z-index above dashboard content",
  );
});

test("notifications bell opens manual mobile panel as fixed body portal", () => {
  const source = read(BELL_PATH);
  const mobilePanelPortal = sectionBetween(
    source,
    "portalContainer && isOpen",
    "{/* Mobile auto-show banner",
  );

  assert.ok(
    mobilePanelPortal.includes("createPortal("),
    "manual mobile panel must be portaled out of parent stacking contexts",
  );
  assert.ok(
    mobilePanelPortal.includes(
      'data-dashboard-notifications-mobile-overlay="true"',
    ),
    "manual mobile panel must expose a stable overlay selector",
  );
  assert.ok(
    mobilePanelPortal.includes(
      'data-dashboard-notifications-mobile-panel="true"',
    ),
    "manual mobile panel must expose a stable panel selector",
  );
  assert.ok(
    mobilePanelPortal.includes("fixed inset-0 z-[90]"),
    "manual mobile overlay must be fixed with a z-index above dashboard chrome",
  );
  assert.ok(
    mobilePanelPortal.includes("fixed inset-x-3 top-3"),
    "manual mobile sheet must be fixed to the viewport, not the bell wrapper",
  );
  assert.ok(
    mobilePanelPortal.includes("bg-card"),
    "manual mobile sheet must use an opaque background",
  );
  assert.ok(
    mobilePanelPortal.includes("sm:hidden"),
    "manual mobile overlay must stay mobile-only",
  );
  assert.ok(
    mobilePanelPortal.includes('role="dialog"'),
    "manual mobile panel must be exposed as a dialog",
  );
  assert.ok(
    mobilePanelPortal.includes('aria-modal="true"'),
    "manual mobile panel must mark modal semantics",
  );
});

test("notifications bell closes manual mobile panel cleanly", () => {
  const source = read(BELL_PATH);
  const closeFn = sectionBetween(
    source,
    "function handleClosePanel()",
    "function handleEnableNotifications()",
  );

  assert.ok(
    closeFn.includes("setIsOpen(false);"),
    "close handler must hide the manual panel",
  );
  assert.ok(
    source.includes("portalContainer && isOpen"),
    "manual mobile portal must be conditionally mounted only while open",
  );
  assert.ok(
    source.includes('aria-label="Cerrar panel de notificaciones"'),
    "manual mobile panel must include an accessible close button",
  );
  assert.ok(
    source.includes("onClick={handleClosePanel}"),
    "manual mobile overlay and close button must use the close handler",
  );
  assert.ok(
    source.includes("event.stopPropagation()"),
    "manual mobile panel clicks must not close via backdrop bubbling",
  );
  assert.ok(
    source.includes('event.key === "Escape"'),
    "manual panel must close on Escape",
  );
  assert.ok(
    source.includes('window.addEventListener("keydown", handleKeyDown)'),
    "Escape listener must be registered while the panel is open",
  );
  assert.ok(
    source.includes('window.removeEventListener("keydown", handleKeyDown)'),
    "Escape listener must be removed when the panel closes",
  );
});

test("notifications bell keeps desktop dropdown desktop-only", () => {
  const source = read(BELL_PATH);

  assert.ok(
    source.includes('data-dashboard-notifications-desktop-panel="true"'),
    "desktop dropdown must expose a stable selector",
  );
  assert.match(
    source,
    /className="[^"]*\babsolute\b[^"]*\bright-0\b[^"]*\bz-50\b[^"]*\bhidden\b[^"]*\bsm:block\b[^"]*"/,
    "desktop dropdown must remain absolute on desktop and hidden below sm",
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

// ── 8. Click-through navigation behavior ────────────────────────────────────

test("notifications bell keeps read desktop notifications clickable for navigation", () => {
  const source = read(BELL_PATH);
  const desktopButtonOpening = sectionBetween(
    source,
    'aria-label={`Abrir notificación: ${notification.title}`}',
    '<div className="flex items-start justify-between gap-2">',
  );

  assert.ok(
    desktopButtonOpening.includes("cursor-pointer"),
    "notification button must communicate click affordance",
  );
  assert.ok(
    desktopButtonOpening.includes(
      "disabled={updatingNotificationId === notification.id}",
    ),
    "notification button may only disable while its own update is pending",
  );
  assert.equal(
    desktopButtonOpening.includes("notification.isRead"),
    false,
    "read notifications must not be disabled by isRead",
  );
});

test("notifications bell routes desktop clicks through contextual destinations", () => {
  const source = read(BELL_PATH);
  const handler = sectionBetween(
    source,
    "async function handleNotificationClick(",
    "async function handleMarkAllAsRead()",
  );

  assert.ok(source.includes('import { useRouter } from "next/navigation";'));
  assert.ok(
    source.includes(
      'import { buildNotificationDestination } from "@/lib/notification-destinations";',
    ),
  );
  assert.ok(source.includes("const router = useRouter();"));
  assert.ok(
    handler.includes(
      "const destination = buildNotificationDestination(surface, notification);",
    ),
    "click handler must resolve a contextual destination",
  );
  assert.ok(
    handler.includes("markDashboardNotificationRead("),
    "unread clicks must still attempt mark-as-read",
  );
  assert.ok(
    handler.includes("setIsOpen(false);"),
    "desktop dropdown must close on notification click",
  );
  assert.ok(
    handler.includes("navigateToNotificationDestination(destination);"),
    "click handler must navigate after the mark-as-read attempt",
  );
  assert.ok(source.includes("router.push(destination);"));
  assert.ok(source.includes("scrollToHashDestination(destination);"));
  assert.equal(
    handler.includes("notification.isRead ||"),
    false,
    "already-read notifications must not return before navigation",
  );
  assert.ok(
    handler.includes('setErrorMessage("No se pudo marcar la notificación como leída.");'),
    "mark-as-read failures must be surfaced without blocking navigation",
  );
});

test("notifications bell uses the same contextual click handler on mobile and desktop", () => {
  const source = read(BELL_PATH);
  const clickHandlers =
    source.match(
      /onClick=\{\(\) => void handleNotificationClick\(notification\)\}/g,
    ) ?? [];

  assert.equal(
    clickHandlers.length,
    2,
    "desktop dropdown and mobile banner must use the same click handler",
  );
  assert.ok(
    source.includes("setMobileBannerVisible(false);"),
    "mobile banner must close on notification navigation",
  );
});

test("notifications mobile panel does not depend on Particulares layout wrapper", () => {
  const bellSource = read(BELL_PATH);
  const particularesSource = read(PARTICULARES_PATH);

  assert.ok(
    particularesSource.includes(
      'className="particular-notifications-bell-layer shrink-0"',
    ),
    "ParticularesContent must keep the session bell wrapper",
  );
  assert.ok(
    bellSource.includes("setPortalContainer(document.body);"),
    "DashboardNotificationsBell must target document.body for overlays",
  );
  assert.ok(
    bellSource.includes(
      'data-dashboard-notifications-mobile-overlay="true"',
    ),
    "manual mobile overlay must be owned by the bell component",
  );
  assert.equal(
    particularesSource.includes(
      "data-dashboard-notifications-mobile-overlay",
    ),
    false,
    "ParticularesContent must not own the notification overlay layer",
  );
});

// ── 9. All three roles wire the bell component ───────────────────────────────

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
  // B10: the clinic notification role moved from the six clinic routes to
  // their single shell owner, which is where it is now asserted. Admin still
  // declares its own topbar, so its assertion is unchanged.
  const clinicShell = readFileSync(
    resolve(
      process.cwd(),
      "frontend/src/components/dashboard/ClinicDashboardShell.tsx",
    ),
    "utf8",
  );
  const adminPage = readFileSync(
    resolve(process.cwd(), "frontend/src/app/dashboard/admin/page.tsx"),
    "utf8",
  );

  assert.ok(
    clinicShell.includes("<DashboardTopbar"),
    "the clinic shell must own the topbar for every clinic route",
  );
  assert.ok(
    clinicShell.includes('notifications="clinic"'),
    "clinic shell must pass notifications='clinic'",
  );
  assert.ok(
    adminPage.includes('notifications="admin"'),
    "admin dashboard must pass notifications='admin'",
  );
});

test("particular role wires notifications bell when session is active", () => {
  const source = read(PARTICULARES_PATH);

  assert.ok(
    source.includes('import dynamic from "next/dynamic";'),
    "ParticularesContent must use next/dynamic for the session-only bell",
  );
  assert.ok(
    source.includes(
      'import("@/components/dashboard/DashboardNotificationsBell").then(',
    ),
    "ParticularesContent must dynamically import DashboardNotificationsBell",
  );
  assert.ok(source.includes("mod.DashboardNotificationsBell"));
  assert.ok(
    source.includes('<ParticularNotificationsBell surface="particular" />'),
    "ParticularesContent must render bell with particular surface",
  );
});
