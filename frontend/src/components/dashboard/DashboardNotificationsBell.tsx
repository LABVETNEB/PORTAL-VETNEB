"use client";

import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getDashboardNotifications,
  markAllDashboardNotificationsRead,
  markDashboardNotificationRead,
  type AdminStudyTrackingNotificationSummary,
  type DashboardNotificationSurface,
} from "@/lib/api";
import { buildNotificationDestination } from "@/lib/notification-destinations";
import { formatDateTime } from "@/lib/utils";

const NOTIFICATIONS_LIMIT = 20;
const POLLING_INTERVAL_MS = 30_000;

type DashboardNotificationsBellProps = {
  surface: DashboardNotificationSurface;
};

export function DashboardNotificationsBell({
  surface,
}: DashboardNotificationsBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [notifications, setNotifications] = useState<
    AdminStudyTrackingNotificationSummary[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingNotificationId, setUpdatingNotificationId] = useState<
    number | null
  >(null);
  const [mobileBannerVisible, setMobileBannerVisible] = useState(false);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);

  const isFetchingRef = useRef(false);
  // Tracks the unread count that was last auto-shown.
  // Re-opens only when new unread notifications arrive beyond this threshold.
  // Resets to 0 when inbox reaches zero so the next notification triggers
  // auto-show again.
  const autoShownUnreadCountRef = useRef(0);
  const isMobileRef = useRef(false);

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;
  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const desktopPanelId = `dashboard-notifications-${surface}-panel`;
  const mobilePanelId = `dashboard-notifications-${surface}-mobile-panel`;
  const desktopPanelTitleId = `dashboard-notifications-${surface}-title`;
  const mobilePanelTitleId = `dashboard-notifications-${surface}-mobile-title`;

  // Initialise portal target (SSR-safe) and mobile breakpoint tracking.
  useEffect(() => {
    setPortalContainer(document.body);

    const mq = window.matchMedia("(max-width: 639px)");
    isMobileRef.current = mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      isMobileRef.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getDashboardNotifications(surface, {
        limit: NOTIFICATIONS_LIMIT,
        offset: 0,
      });
      setNotifications(response.notifications);

      // Auto-show logic: open automatically when the unread count exceeds
      // what was already shown. Notifications are NOT marked as read by
      // this action -- only the display surface is opened.
      const newUnreadCount = response.notifications.filter(
        (n) => !n.isRead,
      ).length;

      if (newUnreadCount === 0) {
        autoShownUnreadCountRef.current = 0;
      } else if (newUnreadCount > autoShownUnreadCountRef.current) {
        autoShownUnreadCountRef.current = newUnreadCount;
        if (isMobileRef.current) {
          setMobileBannerVisible(true);
        } else {
          setIsOpen(true);
        }
      }
    } catch {
      setErrorMessage("No se pudieron cargar las notificaciones.");
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [surface]);

  // Initial silent load on mount to detect unread notifications and
  // auto-show the appropriate surface without any manual interaction.
  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!isPollingEnabled) {
      return;
    }

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPollingEnabled, loadNotifications]);

  function handleToggleOpen() {
    setIsOpen((current) => {
      const next = !current;

      if (next) {
        setMobileBannerVisible(false);
        void loadNotifications();
      }

      return next;
    });
  }

  function handleClosePanel() {
    setIsOpen(false);
  }

  function handleEnableNotifications() {
    setIsPollingEnabled(true);
    void loadNotifications();
  }

  function handleCloseMobileBanner() {
    setMobileBannerVisible(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function scrollToHashDestination(destination: string) {
    if (typeof window === "undefined") {
      return;
    }

    const targetUrl = new URL(destination, window.location.origin);

    if (
      targetUrl.pathname !== window.location.pathname ||
      targetUrl.hash.length === 0
    ) {
      return;
    }

    window.setTimeout(() => {
      if (window.location.hash !== targetUrl.hash) {
        window.location.hash = targetUrl.hash;
      }

      const targetId = decodeURIComponent(targetUrl.hash.slice(1));
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }, 0);
  }

  function navigateToNotificationDestination(destination: string) {
    router.push(destination);
    scrollToHashDestination(destination);
  }

  async function handleNotificationClick(
    notification: AdminStudyTrackingNotificationSummary,
  ) {
    if (updatingNotificationId === notification.id) {
      return;
    }

    const destination = buildNotificationDestination(surface, notification);
    const shouldMarkAsRead =
      !notification.isRead &&
      updatingNotificationId === null &&
      !isMarkingAllAsRead;

    if (shouldMarkAsRead) {
      setUpdatingNotificationId(notification.id);
      setErrorMessage(null);

      try {
        const response = await markDashboardNotificationRead(
          surface,
          notification.id,
        );
        setNotifications((current) =>
          current.map((currentNotification) =>
            currentNotification.id === notification.id
              ? response.notification
              : currentNotification,
          ),
        );
      } catch {
        setErrorMessage("No se pudo marcar la notificación como leída.");
      } finally {
        setUpdatingNotificationId(null);
      }
    }

    setIsOpen(false);
    setMobileBannerVisible(false);
    navigateToNotificationDestination(destination);
  }

  async function handleMarkAllAsRead() {
    if (isMarkingAllAsRead || updatingNotificationId !== null) {
      return;
    }

    setIsMarkingAllAsRead(true);
    setErrorMessage(null);

    try {
      await markAllDashboardNotificationsRead(surface);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          notification.isRead
            ? notification
            : {
                ...notification,
                isRead: true,
                readAt,
              },
        ),
      );
    } catch {
      setErrorMessage("No se pudieron cargar las notificaciones.");
    } finally {
      setIsMarkingAllAsRead(false);
    }
  }

  function renderPanelContent({
    titleId,
    listClassName,
    showCloseButton = false,
  }: {
    titleId: string;
    listClassName: string;
    showCloseButton?: boolean;
  }) {
    return (
      <>
        <div className="mb-2 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p id={titleId} className="text-sm font-semibold text-vetneb-ink">
              Notificaciones
            </p>
            {showCloseButton ? (
              <button
                type="button"
                aria-label="Cerrar panel de notificaciones"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                onClick={handleClosePanel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
              onClick={handleEnableNotifications}
              disabled={isPollingEnabled}
            >
              {isPollingEnabled
                ? "Notificaciones activadas"
                : "Activar notificaciones"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
              onClick={() => void loadNotifications()}
              disabled={isLoading}
            >
              {isLoading ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
              onClick={() => void handleMarkAllAsRead()}
              disabled={
                isLoading ||
                isMarkingAllAsRead ||
                updatingNotificationId !== null ||
                unreadCount === 0
              }
            >
              {isMarkingAllAsRead ? "Marcando..." : "Marcar todo como leído"}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <p className="clinical-alert-warning px-3 py-2 text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {!errorMessage && !isLoading && notifications.length === 0 ? (
          <p className="surface-empty py-3 text-sm">No hay notificaciones.</p>
        ) : null}

        <ul className={listClassName}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                aria-label={`Abrir notificación: ${notification.title}`}
                className="w-full cursor-pointer rounded-md border border-vetneb-line/70 bg-vetneb-surface-raised/78 px-3 py-2 text-left transition-colors hover:border-vetneb-teal/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                onClick={() => void handleNotificationClick(notification)}
                disabled={updatingNotificationId === notification.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-vetneb-ink">
                    {notification.title}
                  </p>
                  <span className="text-[0.66rem] text-muted-foreground">
                    {notification.isRead ? "Leída" : "No leída"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {notification.message}
                </p>
                <p className="mt-1 text-[0.66rem] text-muted-foreground">
                  {formatDateTime(notification.createdAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${desktopPanelId} ${mobilePanelId}` : undefined}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card/95 text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
        onClick={handleToggleOpen}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vetneb-teal px-1 text-[0.62rem] font-semibold leading-none text-vetneb-navy">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={desktopPanelId}
          role="dialog"
          aria-labelledby={desktopPanelTitleId}
          className="absolute right-0 z-50 mt-2 hidden w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-vetneb-line/80 bg-card p-3 shadow-xl sm:block"
          data-dashboard-notifications-desktop-panel="true"
        >
          {renderPanelContent({
            titleId: desktopPanelTitleId,
            listClassName: "max-h-72 space-y-2 overflow-y-auto pr-1",
          })}
        </div>
      ) : null}

      {portalContainer && isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] bg-vetneb-navy/30 sm:hidden"
              data-dashboard-notifications-mobile-overlay="true"
              onClick={handleClosePanel}
            >
              <div
                id={mobilePanelId}
                className="fixed inset-x-3 top-3 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-lg border border-vetneb-line/85 bg-card p-3 shadow-2xl"
                data-dashboard-notifications-mobile-panel="true"
                role="dialog"
                aria-modal="true"
                aria-labelledby={mobilePanelTitleId}
                onClick={(event) => event.stopPropagation()}
              >
                {renderPanelContent({
                  titleId: mobilePanelTitleId,
                  listClassName: "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
                  showCloseButton: true,
                })}
              </div>
            </div>,
            portalContainer,
          )
        : null}

      {/* Mobile auto-show banner: visible only on narrow viewports (< 640 px).
          Portaled to document.body to avoid stacking-context clipping from the
          sticky topbar. Notifications are NOT marked as read by appearing here. */}
      {portalContainer && mobileBannerVisible && unreadCount > 0
        ? createPortal(
            <div
              className="fixed inset-x-0 top-0 z-[80] border-b border-vetneb-teal/30 bg-card shadow-xl sm:hidden"
              role="region"
              aria-label="Notificaciones no leidas"
            >
              <div className="flex items-center justify-between border-b border-vetneb-line/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-vetneb-teal" aria-hidden="true" />
                  <p className="text-sm font-semibold text-vetneb-ink">
                    Notificaciones no leidas{" "}
                    <span className="ml-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vetneb-teal px-1 text-[0.62rem] font-semibold leading-none text-vetneb-navy">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar notificaciones"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                  onClick={handleCloseMobileBanner}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ul
                className="max-h-52 divide-y divide-vetneb-line/50 overflow-y-auto"
                aria-label="Lista de notificaciones no leidas"
              >
                {unreadNotifications.slice(0, 5).map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      aria-label={`Abrir notificación: ${notification.title}`}
                      className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                      onClick={() => void handleNotificationClick(notification)}
                      disabled={updatingNotificationId === notification.id}
                    >
                      <p className="text-xs font-semibold text-vetneb-ink">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="mt-0.5 text-[0.66rem] text-muted-foreground">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {unreadNotifications.length > 5 ? (
                <div className="border-t border-vetneb-line/50 px-4 py-2.5">
                  <button
                    type="button"
                    className="text-xs font-semibold text-vetneb-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                    onClick={() => {
                      setMobileBannerVisible(false);
                      setIsOpen(true);
                    }}
                  >
                    Ver mas en el panel
                  </button>
                </div>
              ) : null}
            </div>,
            portalContainer,
          )
        : null}
    </div>
  );
}
