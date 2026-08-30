import { ENV } from "../../server/lib/env.ts";
import { createMemoryRateLimitStore } from "../../server/lib/rate-limit-store.ts";

export function buildExpectedContactServiceSnapshot() {
  const explicitRecipients = Array.from(
    new Set(
      ENV.contactTo
        .flatMap((value) => value.split(/[;,]/g))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const fallbackRecipients = ENV.isProduction
    ? []
    : Array.from(
      new Set(
        [ENV.gmailApi.enabled ? ENV.gmailApi.from : ENV.smtp.from]
          .flatMap((value) => value.split(/[;,]/g))
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  const recipients = explicitRecipients.length > 0
    ? explicitRecipients
    : fallbackRecipients;
  const emailTransportReady = ENV.gmailApi.enabled || ENV.smtp.enabled;
  const contactReady = emailTransportReady && (
    ENV.isProduction ? explicitRecipients.length > 0 : recipients.length > 0
  );

  return {
    contact_email: contactReady ? "configured" : "degraded",
    contact_email_recipients: recipients,
    contact_email_recipient_count: recipients.length,
    contact_to_configured: explicitRecipients.length > 0,
    smtp_from_configured: ENV.smtp.from.trim().length > 0,
    gmail_api_from_configured: ENV.gmailApi.from.trim().length > 0,
  };
}

export function isLocalOrLanHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
    return true;
  }

  return normalized.startsWith("192.168.");
}

export function buildExpectedCorsSnapshot() {
  const origins = Array.from(
    new Set(
      ENV.corsOrigins.map((origin) => origin.trim()).filter(Boolean),
    ),
  );
  const hasLocalOrLanOrigins = origins.some((origin) => {
    try {
      return isLocalOrLanHostname(new URL(origin).hostname);
    } catch {
      return false;
    }
  });

  return {
    cors: origins.length > 0 ? "configured" : "not_configured",
    cors_origins: origins,
    cors_origin_count: origins.length,
    cors_has_local_or_lan_origins: hasLocalOrLanOrigins,
    node_env: ENV.nodeEnv,
  };
}

export function buildAdminAuditRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [],
      total: 0,
    }),
    buildAdminAuditListFilters: (_query: Record<string, unknown>) => ({
      filters: {
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: () => "id,event",
    buildAdminAuditCsvFilename: () => "admin-audit-log-test.csv",
  };
}

export function buildAdminAuthRouteStubs() {
  return {
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}

export function buildAdminFailedLoginAlertsRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAdminFailedLoginAlerts: async () => ({
      success: true as const,
      failedLoginAlerts: [],
      count: 0,
      total: 0,
      limit: 50,
      offset: 0,
      filters: {
        surface: null,
        reason: null,
      },
    }),
    buildAdminFailedLoginAlertsCsv: () =>
      "id,surface,username,reason,ipAddress,userAgent,createdAt",
    buildAdminFailedLoginAlertsCsvFilename: () =>
      "admin-failed-login-alerts-test.csv",
  };
}



export function buildAdminParticularTokensRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    createParticularToken: async () => ({
      id: 7,
      clinicId: 3,
      reportId: null,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      tutorLastName: "Gomez",
      petName: "Luna",
      petAge: "8 aÃƒÆ’Ã‚Â±os",
      petBreed: "Caniche",
      petSex: "Hembra",
      petSpecies: "Canina",
      sampleLocation: "PabellÃƒÆ’Ã‚Â³n auricular",
      sampleEvolution: "15 dÃƒÆ’Ã‚Â­as",
      detailsLesion: null,
      extractionDate: new Date("2026-04-20T00:00:00.000Z"),
      shippingDate: new Date("2026-04-21T00:00:00.000Z"),
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByAdminId: 1,
      createdByClinicUserId: null,
    }),
    getParticularTokenById: async () => null,
    listParticularTokens: async () => [],
    updateParticularTokenReport: async () => null,
    revokeParticularToken: async () => null,
    sendParticularTokenEmail: async () => ({
      sent: true as const,
      messageId: "particular-email-1",
    }),
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => ({} as any),
    updateStudyTrackingCase: async () => null,
  };
}
export function buildAdminReportsRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    uploadReport: async () => "reports/admin-test.pdf",
    upsertReport: async () => ({
      id: 88,
      clinicId: 3,
      uploadDate: new Date("2026-04-22T09:00:00.000Z"),
      studyType: "Histopatologia",
      patientName: "Luna",
      fileName: "luna-report.pdf",
      currentStatus: "uploaded",
      statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
      createdAt: new Date("2026-04-22T09:00:00.000Z"),
      updatedAt: new Date("2026-04-22T09:30:00.000Z"),
      storagePath: "reports/admin-test.pdf",
    } as any),
    getParticularTokenById: async () => null,
    updateParticularTokenReport: async () => null,
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => ({} as any),
    updateStudyTrackingCase: async () => null,
    createStudyTrackingNotification: async () => ({} as any),
    createSignedReportUrl: async (storagePath: string) =>
      `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    writeAuditLog: async () => {},
  };
}

export function buildAdminReportAccessTokensRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    createReportAccessToken: async () => ({
      id: 9,
      clinicId: 3,
      reportId: 55,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      accessCount: 0,
      lastAccessAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByClinicUserId: null,
      createdByAdminUserId: 1,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    }),
    getReportAccessTokenById: async () => null,
    listReportAccessTokens: async () => [],
    revokeReportAccessToken: async () => null,
    writeAuditLog: async () => {},
  };
}
export function buildAdminStudyTrackingRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    getParticularTokenById: async () => null,
    updateParticularTokenReport: async () => null,
    createStudyTrackingCase: async () => ({} as any),
    updateStudyTrackingCase: async () => null,
    getClinicScopedStudyTrackingCase: async () => null,
    getStudyTrackingCaseById: async () => null,
    listStudyTrackingCases: async () => [],
    createStudyTrackingNotification: async () => ({} as any),
    listStudyTrackingNotifications: async () => [],
    writeAuditLog: async () => {},
    sendSpecialStainRequiredEmail: async () => ({ sent: true }),
  };
}
export function buildClinicAuthRouteStubs() {
  return {
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "rehash-password",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}

export function buildClinicAuditRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [],
      total: 0,
    }),
    buildClinicAuditListFilters: (
      _query: Record<string, unknown>,
      clinicId: number,
    ) => ({
      filters: {
        clinicId,
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: () => "id,event",
  };
}

export function buildClinicPublicProfileRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getClinicPublicProfileByClinicId: async () => null,
    buildClinicPublicProfileResponse: (input: {
      clinic: Record<string, unknown>;
      profile: Record<string, unknown> | null;
      avatarUrl: string | null;
    }) => ({
      clinicId: input.clinic.id,
      clinicName: input.clinic.name,
      avatarUrl: input.avatarUrl,
      displayName: input.profile?.displayName ?? null,
      isPublic: input.profile?.isPublic ?? false,
    }),
    evaluateClinicPublicProfilePublication: () => ({
      isPublic: false,
      hasRequiredPublicFields: true,
      hasQualitySupplement: true,
      qualityScore: 80,
      isSearchEligible: true,
      missingRequiredFields: [],
      missingRecommendedFields: [],
      publicationErrors: [],
    }),
    minPublicProfileQualityScore: 60,
    patchClinicPublicProfile: async () => ({
      clinicId: 3,
      displayName: "Clinica Centro",
      avatarStoragePath: "avatars/3/avatar.png",
      isPublic: true,
    }),
    removeClinicPublicAvatar: async () => ({
      previousAvatarStoragePath: "avatars/3/avatar.png",
      profile: {
        clinicId: 3,
        displayName: "Clinica Centro",
        avatarStoragePath: null,
        isPublic: true,
      },
    }),
    syncClinicPublicSearch: async () => ({
      clinicId: 3,
      isPublic: true,
      hasRequiredPublicFields: true,
      isSearchEligible: true,
      profileQualityScore: 80,
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      searchText: "clinica centro",
    }),
    createSignedStorageUrl: async (storagePath: string) => `signed:${storagePath}`,
    uploadClinicAvatar: async () => "avatars/3/avatar-new.png",
    deleteStorageObject: async () => {},
  };
}

export function buildParticularAuditRouteStubs() {
  return {
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    updateParticularSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listParticularAuditLog: async () => ({
      items: [],
      total: 0,
    }),
    buildParticularAuditListFilters: (_query: Record<string, unknown>) => ({
      filters: {
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAuditCsv: () => "id,event",
    buildParticularAuditCsvFilename: () =>
      "particular-audit-log-test.csv",
  };
}

export function buildParticularAuthRouteStubs() {
  return {
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    generateSessionToken: () => "particular-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
  };
}


export function buildParticularTokensRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    getReportById: async () => null,
    createParticularToken: async () => ({
      id: 7,
      clinicId: 3,
      reportId: null,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      tutorLastName: "Gomez",
      petName: "Luna",
      petAge: "8 aÃƒÆ’Ã‚Â±os",
      petBreed: "Caniche",
      petSex: "Hembra",
      petSpecies: "Canina",
      sampleLocation: "PabellÃƒÆ’Ã‚Â³n auricular",
      sampleEvolution: "15 dÃƒÆ’Ã‚Â­as",
      detailsLesion: null,
      extractionDate: new Date("2026-04-20T00:00:00.000Z"),
      shippingDate: new Date("2026-04-21T00:00:00.000Z"),
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByAdminId: null,
      createdByClinicUserId: 9,
    }),
    getClinicScopedParticularToken: async () => null,
    listParticularTokens: async () => [],
    updateParticularTokenReport: async () => null,
    revokeParticularToken: async () => null,
    sendParticularTokenEmail: async () => ({
      sent: true as const,
      messageId: "particular-email-1",
    }),
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => ({} as any),
    updateStudyTrackingCase: async () => null,
  };
}
export function buildStudyTrackingRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    getParticularTokenById: async () => null,
    updateParticularTokenReport: async () => null,
    createStudyTrackingCase: async () => ({} as any),
    updateStudyTrackingCase: async () => null,
    getClinicScopedStudyTrackingCase: async () => null,
    listStudyTrackingCases: async () => [],
    createStudyTrackingNotification: async () => ({} as any),
    listStudyTrackingNotifications: async () => [],
    markStudyTrackingNotificationReadScoped: async () => null,
    markAllStudyTrackingNotificationsReadScoped: async () => ({
      updatedCount: 0,
    }),
    writeAuditLog: async () => {},
    sendSpecialStainRequiredEmail: async () => ({ sent: true }),
  };
}

export function buildPublicReportAccessRouteStubs() {
  return {
    publicReportAccessRateLimitStore: createMemoryRateLimitStore(),
    getReportAccessTokenWithReportByTokenHash: async () => null,
    recordReportAccessTokenAccess: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    hashSessionToken: (token: string) => `hash:${token}`,
    writeAuditLog: async () => {},
  };
}

export function buildReportAccessTokensRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashPassword: async () => "unused",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    getReportById: async () => null,
    createReportAccessToken: async () => ({
      id: 9,
      clinicId: 3,
      reportId: 55,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      accessCount: 0,
      lastAccessAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByClinicUserId: 9,
      createdByAdminUserId: null,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    }),
    getClinicScopedReportAccessToken: async () => null,
    listReportAccessTokens: async () => [],
    revokeReportAccessToken: async () => null,
    writeAuditLog: async () => {},
  };
}

export function buildParticularStudyTrackingRouteStubs() {
  return {
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    updateParticularSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getParticularStudyTrackingCase: async () => null,
    listStudyTrackingNotifications: async () => [],
    markStudyTrackingNotificationReadScoped: async () => null,
    markAllStudyTrackingNotificationsReadScoped: async () => ({
      updatedCount: 0,
    }),
  };
}

export function buildPublicProfessionalsRouteStubs() {
  return {
    searchPublicProfessionals: async () => ({
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async () => null,
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
  };
}

export function buildReportsRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getReportsByClinicId: async () => [],
    searchReports: async () => [],
    getStudyTypes: async () => [],
    getReportById: async () => null,
    getReportStatusHistory: async () => [],
    getClinicScopedStudyTrackingCase: async () => null,
    updateStudyTrackingCase: async () => null,
    uploadReport: async () => "reports/test.pdf",
    upsertReport: async () => ({} as any),
    createSignedReportUrl: async (storagePath: string) =>
      `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
  };
}

export function buildReportsStatusRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getReportById: async () => null,
    updateReportStatus: async () => null,
    createSignedReportUrl: async (storagePath: string) =>
      `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    writeAuditLog: async () => {},
  };
}

export function buildLogisticsRouteEventsRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createRouteEvent: async () => null,
    listClinicRouteEvents: async () => [],
    listRouteEventsForClinicRoutePlan: async () => [],
    listIncrementalClinicRouteEvents: async () => [],
  };
}

export function buildLogisticsRoutePlansRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createRoutePlan: async () => null,
    getClinicScopedRoutePlan: async () => null,
    listClinicRoutePlans: async () => [],
    updateClinicScopedRoutePlan: async () => null,
    createRouteStopForClinicRoutePlan: async () => null,
    listRouteStopsForClinicRoutePlan: async () => [],
    updateClinicScopedRouteStop: async () => null,
    transitionClinicScopedRoutePlanStatus: async () => ({
      reason: "not_found" as const,
    }),
  };
}

export function buildLogisticsFieldVisitsRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createFieldVisit: async () => null,
    listClinicFieldVisits: async () => [],
    updateClinicScopedFieldVisit: async () => null,
    getVisitLocationForClinicVisit: async () => null,
    upsertVisitLocationForClinicVisit: async () => null,
    createTimeWindowForClinicVisit: async () => null,
    listTimeWindowsForClinicVisit: async () => [],
  };
}

export function buildLogisticsSlaRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listActiveClinicSlaPolicies: async () => [],
    listClinicSlaInstances: async () => [],
    listOverdueActiveClinicSlaInstances: async () => [],
    getClinicSlaSummary: async () => ({
      clinicId: 1,
      total: 0,
      active: 0,
      paused: 0,
      breached: 0,
      resolved: 0,
      canceled: 0,
    }),
  };
}
export function buildAdminSystemHealthRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
      },
    }),
    getBackendVersion: () => "test-version",
  };
}

export function buildFastifyDispatchRouteStubs() {
  return {
    adminAuditRoutes: buildAdminAuditRouteStubs(),
    adminAuthRoutes: buildAdminAuthRouteStubs(),
    adminFailedLoginAlertsRoutes: buildAdminFailedLoginAlertsRouteStubs(),
    adminParticularTokensRoutes: buildAdminParticularTokensRouteStubs(),
    adminReportsRoutes: buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
    adminStudyTrackingRoutes: buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: buildAdminSystemHealthRouteStubs(),
    clinicAuthRoutes: buildClinicAuthRouteStubs(),
    clinicAuditRoutes: buildClinicAuditRouteStubs(),
    clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
    particularAuditRoutes: buildParticularAuditRouteStubs(),
    particularAuthRoutes: buildParticularAuthRouteStubs(),
    particularStudyTrackingRoutes: buildParticularStudyTrackingRouteStubs(),
    particularTokensRoutes: buildParticularTokensRouteStubs(),
    publicProfessionalsRoutes: buildPublicProfessionalsRouteStubs(),
    publicPricingRoutes: {
      listPublicPricingItems: async () => [],
    },
    publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
    reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    reportsRoutes: buildReportsRouteStubs(),
    reportsStatusRoutes: buildReportsStatusRouteStubs(),
    studyTrackingRoutes: buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: buildLogisticsFieldVisitsRouteStubs(),
    logisticsRoutePlansRoutes: buildLogisticsRoutePlansRouteStubs(),
    logisticsRouteEventsRoutes: buildLogisticsRouteEventsRouteStubs(),
    logisticsSlaRoutes: buildLogisticsSlaRouteStubs(),
  };
}
