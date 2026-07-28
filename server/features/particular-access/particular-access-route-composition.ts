import { loadParticularAccessStudyTrackingPersistence } from "../study-tracking/index.ts";

export async function loadAdminParticularAccessRouteDeps() {
  const [
    db,
    authSecurity,
    repository,
    email,
    studyTracking,
    reportCommands,
  ] = await Promise.all([
    import("../../db.ts"),
    import("../../lib/auth-security.ts"),
    import("./infrastructure/index.ts"),
    import("../../lib/email.ts"),
    loadParticularAccessStudyTrackingPersistence(),
    import("../reports/index.ts").then(
      ({ loadParticularAccessReportCommands }) =>
        loadParticularAccessReportCommands(),
    ),
  ]);

  return {
    deleteAdminSession: db.deleteAdminSession,
    getAdminSessionByToken: db.getAdminSessionByToken,
    getAdminUserById: db.getAdminUserById,
    updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
    generateSessionToken: authSecurity.generateSessionToken,
    hashSessionToken: authSecurity.hashSessionToken,
    getClinicById: db.getClinicById,
    getReportById: reportCommands.getReportById,
    createParticularToken: repository.createParticularToken,
    getParticularTokenById: repository.getParticularTokenById,
    listParticularTokens: repository.listParticularTokens,
    updateParticularTokenReport: repository.updateParticularTokenReport,
    revokeParticularToken: repository.revokeParticularToken,
    deleteParticularToken: repository.deleteParticularToken,
    sendParticularTokenEmail: email.sendParticularTokenEmail,
    ...studyTracking,
  };
}

export async function loadClinicParticularAccessRouteDeps() {
  const [
    db,
    authSecurity,
    repository,
    email,
    studyTracking,
    reportCommands,
  ] = await Promise.all([
    import("../../db.ts"),
    import("../../lib/auth-security.ts"),
    import("./infrastructure/index.ts"),
    import("../../lib/email.ts"),
    loadParticularAccessStudyTrackingPersistence(),
    import("../reports/index.ts").then(
      ({ loadParticularAccessReportCommands }) =>
        loadParticularAccessReportCommands(),
    ),
  ]);

  return {
    deleteActiveSession: db.deleteActiveSession,
    getActiveSessionByToken: db.getActiveSessionByToken,
    getClinicUserById: db.getClinicUserById,
    updateSessionLastAccess: db.updateSessionLastAccess,
    generateSessionToken: authSecurity.generateSessionToken,
    hashSessionToken: authSecurity.hashSessionToken,
    getClinicScopedReportById: reportCommands.getClinicScopedReportById,
    createParticularToken: repository.createParticularToken,
    getClinicScopedParticularToken:
      repository.getClinicScopedParticularToken,
    listParticularTokens: repository.listParticularTokens,
    updateParticularTokenReport: repository.updateParticularTokenReport,
    revokeParticularToken: repository.revokeParticularToken,
    sendParticularTokenEmail: email.sendParticularTokenEmail,
    ...studyTracking,
  };
}
