// Shim temporal de compatibilidad. Retiro previsto para M41.
export type { AdminReportWorkflowItem } from "./features/reports/infrastructure/index.ts";
export {
  getAdminReportWorkflowItem,
  listAdminReportWorkflowItems,
  updateAdminReportSpecialStain,
  updateAdminReportWorkflowStage,
} from "./features/reports/composition/index.ts";
