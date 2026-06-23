"use server";

import { cookies } from "next/headers";
import {
  getAdminClinics,
  getAuditEntries,
  type AdminAuditEntry,
  type AdminAuditQuery,
} from "@/lib/api";
import type { AdminAuditRow } from "./AdminAuditDenseTable";
import {
  EVENT_LABELS,
  getEventVariant,
  getAuditEntity,
  getAuditMetadataSummary,
  formatAuditDate,
} from "./admin-audit-shared";

export type AdminMobileAuditQuery = {
  event?: string;
  actorType?: string;
  from?: string;
  to?: string;
  clinicId?: number;
  reportId?: number;
  limit: number;
  offset: number;
};

export type AdminMobileAuditPage = {
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

// Audit mobile shows "Admin" or the clinic name (not a generic "Clínica
// #id") per record. The audit entry's actorClinicUserId is the clinic
// *user* id, not the clinic id — the only clinic reference on the entry is
// the generic `clinicId` context field already trusted by the desktop
// "Entidad" column (getAuditEntity). It is reused here as a best-effort
// approximation: for most event types it is the acting clinic, but for a
// few it may instead be a related/target clinic.
async function buildClinicNameMap(
  requestOptions: RequestInit,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const snapshot = await getAdminClinics({ limit, offset }, requestOptions);
    total = snapshot.total;

    for (const clinic of snapshot.clinics) {
      if (clinic.clinicName?.trim()) {
        map.set(clinic.clinicId, clinic.clinicName.trim());
      }
    }

    offset += snapshot.clinics.length;
    if (snapshot.clinics.length === 0) break;
  }

  return map;
}

function getMobileAuditActor(
  entry: AdminAuditEntry,
  clinicNamesById: Map<number, string>,
) {
  const actorType = entry.actorType ?? "system";
  if (actorType === "admin_user") return "Admin";
  if (actorType === "clinic_user") {
    const clinicName = entry.clinicId ? clinicNamesById.get(entry.clinicId) : undefined;
    return clinicName ?? (entry.clinicId ? `Clínica #${entry.clinicId}` : "Clínica");
  }
  if (actorType === "public_report_access_token") return "Token público";
  return "Sistema";
}

function buildMobileAuditRow(
  entry: AdminAuditEntry,
  clinicNamesById: Map<number, string>,
): AdminAuditRow {
  return {
    id: entry.id,
    eventCode: entry.event,
    eventLabel: EVENT_LABELS[entry.event] ?? entry.event,
    eventVariant: getEventVariant(entry.event),
    actor: getMobileAuditActor(entry, clinicNamesById),
    action: entry.action ?? EVENT_LABELS[entry.event] ?? entry.event,
    entity: getAuditEntity(entry),
    detail: getAuditMetadataSummary(entry),
    date: formatAuditDate(entry.createdAt),
  };
}

// Only display-ready, sanitized values cross this boundary — never the raw
// audit entry (ipAddress, userAgent, requestPath, full metadata stay here).
export async function getAdminMobileAuditPage(
  query: AdminMobileAuditQuery,
): Promise<AdminMobileAuditPage> {
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

    const hasClinicActor = snapshot.items.some(
      (entry) => entry.actorType === "clinic_user" && entry.clinicId !== null,
    );
    // Clinic-name resolution is a display nicety, not a critical record
    // field. If it fails, fall back to "Clínica #id" rather than dropping
    // the whole audit page.
    const clinicNamesById = hasClinicActor
      ? await buildClinicNameMap(requestOptions).catch(() => new Map<number, string>())
      : new Map<number, string>();

    return {
      rows: snapshot.items.map((entry) => buildMobileAuditRow(entry, clinicNamesById)),
      total: snapshot.pagination.total,
      loadError: false,
    };
  } catch {
    return { rows: [], total: 0, loadError: true };
  }
}
