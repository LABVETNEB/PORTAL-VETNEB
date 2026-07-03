"use server";

import { cookies } from "next/headers";
import { getAuditEntries, type AdminAuditEntry, type AdminAuditQuery } from "@/lib/api";
import type { AdminAuditRow } from "./AdminAuditDenseTable";
import {
  EVENT_LABELS,
  getEventVariant,
  getAuditActor,
  getAuditEntity,
  getAuditMetadataSummary,
  formatAuditDate,
} from "./admin-audit-shared";

export type AdminAuditPageQuery = {
  event?: string;
  actorType?: string;
  from?: string;
  to?: string;
  clinicId?: number;
  reportId?: number;
  limit: number;
  offset: number;
};

export type AdminAuditPage = {
  rows: AdminAuditRow[];
  total: number;
  loadError: boolean;
};

async function getAdminRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();
  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

// Same row shape/logic desktop and mobile share (single source of truth): no
// raw network/session/metadata field ever crosses this boundary.
function buildAuditRow(entry: AdminAuditEntry): AdminAuditRow {
  return {
    id: entry.id,
    eventCode: entry.event,
    eventLabel: EVENT_LABELS[entry.event] ?? entry.event,
    eventVariant: getEventVariant(entry.event),
    actor: getAuditActor(entry),
    action: entry.action ?? EVENT_LABELS[entry.event] ?? entry.event,
    entity: getAuditEntity(entry),
    detail: getAuditMetadataSummary(entry),
    date: formatAuditDate(entry.createdAt),
  };
}

// Only display-ready, sanitized values cross this boundary — never the raw
// audit entry (ipAddress, userAgent, requestPath, full metadata stay here).
export async function getAdminAuditPage(
  query: AdminAuditPageQuery,
): Promise<AdminAuditPage> {
  const requestOptions = await getAdminRequestOptions();
  const auditQuery: AdminAuditQuery = {
    ...(query.event ? { event: query.event } : {}),
    ...(query.actorType ? { actorType: query.actorType } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(typeof query.clinicId === "number" ? { clinicId: query.clinicId } : {}),
    ...(typeof query.reportId === "number" ? { reportId: query.reportId } : {}),
    limit: query.limit,
    offset: query.offset,
  };

  try {
    const snapshot = await getAuditEntries(auditQuery, requestOptions, {
      throwOnError: true,
    });

    return {
      rows: snapshot.items.map(buildAuditRow),
      total: snapshot.pagination.total,
      loadError: false,
    };
  } catch {
    return { rows: [], total: 0, loadError: true };
  }
}
