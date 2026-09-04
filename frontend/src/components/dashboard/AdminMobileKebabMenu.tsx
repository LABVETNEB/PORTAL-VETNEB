"use client";

import { DashboardMobileKebabMenu } from "./DashboardMobileKebabMenu";

/**
 * CMP-01 — retained name, ZERO local visual implementation.
 *
 * The whole body of this component moved to `DashboardMobileKebabMenu`, which both
 * roles now consume (audit DIF-005, RC-002). This wrapper delegates 100% and exists
 * only so the presentation barrel and the architecture guards that anchor
 * `AdminMobileKebabMenu` keep resolving. It renders no markup of its own.
 */
export function AdminMobileKebabMenu() {
  return <DashboardMobileKebabMenu surface="admin" />;
}
