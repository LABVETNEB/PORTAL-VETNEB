"use client";

// PR-SRV-2: Admin Users/Roles collapsed its desktop and mobile presentations
// into a single measured runtime inside `AdminUsersRolesReadOnlyCard`, which now
// owns the mobile ops-module view and shares one data source, filters, offset
// and role-change flow. This file is kept only as a compat shim so no stale
// import breaks; it performs no data fetch, holds no per-device page-size
// constant and reads no media query.
export function AdminMobileUsersModule() {
  return null;
}
