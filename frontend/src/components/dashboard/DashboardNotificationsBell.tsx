"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getAdminStudyTrackingNotifications,
  markAdminStudyTrackingNotificationRead,
  type AdminStudyTrackingNotificationSummary,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const NOTIFICATIONS_LIMIT = 20;
const POLLING_INTERVAL_MS = 30_000;

export function DashboardNotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [notifications, setNotifications] = useState<
    AdminStudyTrackingNotificationSummary[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingNotificationId, setUpdatingNotificationId] = useState<
    number | null
  >(null);
  const isFetchingRef = useRef(false);

  const unreadCount = notifications.filter((notification) => !notification.isRead)
    .length;

  const loadNotifications = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAdminStudyTrackingNotifications({
        limit: NOTIFICATIONS_LIMIT,
        offset: 0,
      });
      setNotifications(response.notifications);
    } catch {
      setErrorMessage("No se pudieron cargar las notificaciones.");
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

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
        void loadNotifications();
      }

      return next;
    });
  }

  function handleEnableNotifications() {
    setIsPollingEnabled(true);
    void loadNotifications();
  }

  async function handleMarkAsRead(
    notification: AdminStudyTrackingNotificationSummary,
  ) {
    if (notification.isRead || updatingNotificationId !== null) {
      return;
    }

    setUpdatingNotificationId(notification.id);
    setErrorMessage(null);

    try {
      const response = await markAdminStudyTrackingNotificationRead(
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
      setErrorMessage("No se pudieron cargar las notificaciones.");
    } finally {
      setUpdatingNotificationId(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card/95 text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-accent-foreground"
        onClick={handleToggleOpen}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-vetneb-teal px-1 text-[0.62rem] font-semibold leading-none text-vetneb-navy">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[20rem] rounded-lg border border-vetneb-line/80 bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-vetneb-ink">Notificaciones</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                onClick={() => void loadNotifications()}
                disabled={isLoading}
              >
                {isLoading ? "Actualizando..." : "Actualizar"}
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

          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-vetneb-line/70 bg-vetneb-surface-raised/78 px-3 py-2 text-left transition-colors hover:border-vetneb-teal/45"
                  onClick={() => void handleMarkAsRead(notification)}
                  disabled={
                    notification.isRead ||
                    updatingNotificationId === notification.id
                  }
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
        </div>
      ) : null}
    </div>
  );
}
