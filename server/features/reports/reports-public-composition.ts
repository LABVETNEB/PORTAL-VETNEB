export async function loadParticularAccessReportCommands() {
  const commands = await import("./composition/index.ts");

  return {
    getReportById: commands.getReportById,
    getClinicScopedReportById:
      commands.getClinicScopedReportById,
  };
}
