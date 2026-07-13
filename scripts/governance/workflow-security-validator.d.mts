export interface WorkflowExternalAction {
  workflow: string;
  line: number;
  reference: string;
  repository: string;
}

export interface WorkflowLocalAction {
  workflow: string;
  line: number;
  reference: string;
}

export interface WorkflowPermissionEntry {
  value: string;
  line: number;
}

export interface WorkflowPermissions {
  workflow: string;
  line: number;
  scalar?: string;
  entries: Record<string, WorkflowPermissionEntry>;
}

export interface WorkflowContainerImage {
  workflow: string;
  line: number;
  job: string;
  service: string | null;
  image: string;
}

export interface WorkflowImageExceptionUsage {
  workflow: string;
  job: string;
  service: string;
  image: string;
  owner: string;
  reason: string;
  reviewBy: string;
  line: number;
}

export interface WorkflowSecurityWorkflow {
  path: string;
  permissions: WorkflowPermissions | null;
  externalActions: WorkflowExternalAction[];
  localActions: WorkflowLocalAction[];
  containerImages: WorkflowContainerImage[];
  exceptionsUsed: WorkflowImageExceptionUsage[];
}

export interface WorkflowSecurityReport {
  passed: boolean;
  failures: string[];
  details: string[];
  policyVersion: string;
  workflows: WorkflowSecurityWorkflow[];
  externalActions: WorkflowExternalAction[];
  localActions: WorkflowLocalAction[];
  permissions: WorkflowPermissions[];
  containerImages: WorkflowContainerImage[];
  exceptionsUsed: WorkflowImageExceptionUsage[];
}

export function isPinnedExternalActionReference(reference: string): boolean;

export function scanWorkflowSecurity(input?: {
  workflowPath: string;
  text: string;
  rootDir?: string;
}): WorkflowSecurityReport;

export function validateWorkflowSecurityDocument(input?: {
  workflowPath: string;
  text: string;
  rootDir?: string;
}): WorkflowSecurityReport;

export function validateWorkflowSecurityRepository(input?: {
  rootDir?: string;
}): WorkflowSecurityReport;

export function renderWorkflowSecuritySummary(report: WorkflowSecurityReport | null): string;
