"use client";

import { useEffect } from "react";

// Defense-in-depth against the back/forward cache (bfcache). When the browser
// restores a page from bfcache it does so from an in-memory snapshot without a
// network request, so the proxy never re-validates the session. The no-store
// headers on /dashboard already make these pages ineligible for bfcache in
// Chromium and Firefox; this guard covers engines that still restore them
// (notably WebKit/Safari) by forcing a real reload, which re-runs the proxy and
// redirects a logged-out user to /login.
export function BackForwardCacheGuard() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
