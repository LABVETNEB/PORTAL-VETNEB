export async function loadReportsParticularAccessPersistence() {
  const repository = await import("./infrastructure/index.ts");

  return {
    getParticularTokenById:
      repository.getParticularTokenById,
    updateParticularTokenReport:
      repository.updateParticularTokenReport,
  };
}
