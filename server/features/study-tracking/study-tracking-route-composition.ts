export async function loadClinicStudyTrackingPersistence() {
  const repository = await import("./infrastructure/index.ts");

  return {
    createStudyTrackingCase: repository.createStudyTrackingCase,
    updateStudyTrackingCase: repository.updateStudyTrackingCase,
    getClinicScopedStudyTrackingCase:
      repository.getClinicScopedStudyTrackingCase,
    listStudyTrackingCases: repository.listStudyTrackingCases,
    createStudyTrackingNotification:
      repository.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      repository.listStudyTrackingNotifications,
    markStudyTrackingNotificationReadScoped:
      repository.markStudyTrackingNotificationReadScoped,
    markAllStudyTrackingNotificationsReadScoped:
      repository.markAllStudyTrackingNotificationsReadScoped,
  };
}

export async function loadParticularStudyTrackingPersistence() {
  const repository = await import("./infrastructure/index.ts");

  return {
    getParticularStudyTrackingCase:
      repository.getParticularStudyTrackingCase,
    listStudyTrackingNotifications:
      repository.listStudyTrackingNotifications,
    markStudyTrackingNotificationReadScoped:
      repository.markStudyTrackingNotificationReadScoped,
    markAllStudyTrackingNotificationsReadScoped:
      repository.markAllStudyTrackingNotificationsReadScoped,
  };
}

export async function loadAdminStudyTrackingPersistence() {
  const repository = await import("./infrastructure/index.ts");

  return {
    createStudyTrackingCase: repository.createStudyTrackingCase,
    updateStudyTrackingCase: repository.updateStudyTrackingCase,
    getClinicScopedStudyTrackingCase:
      repository.getClinicScopedStudyTrackingCase,
    getStudyTrackingCaseById: repository.getStudyTrackingCaseById,
    listStudyTrackingCases: repository.listStudyTrackingCases,
    createStudyTrackingNotification:
      repository.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      repository.listStudyTrackingNotifications,
    markStudyTrackingNotificationRead:
      repository.markStudyTrackingNotificationRead,
    markAllStudyTrackingNotificationsRead:
      repository.markAllStudyTrackingNotificationsRead,
  };
}
