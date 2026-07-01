"use client";

// PR-SRV-1: Admin Sessions collapsed its desktop and mobile presentations into
// a single measured runtime inside `AdminSessionsReadOnlyCard`, which now owns
// the mobile ops-module view and shares one data source, filters, offset and
// revoke. This file is kept only as a compat shim so no stale import breaks; it
// performs no data fetch, holds no per-device page-size constant and reads no
// media query.
export function AdminMobileSessionsModule() {
  return null;
}
