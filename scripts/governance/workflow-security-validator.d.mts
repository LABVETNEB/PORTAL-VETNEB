export interface WorkflowSecurityFailure {
  workflow: string;
  path: string;
  cause: string;
}

export interface WorkflowSecurityWorkflow {
  workflow: string;
}

export interface WorkflowSecurityExternalAction {
  workflow: string;
  path: string;
  reference: string;
  repository: string;
  ref: string;
}

export interface WorkflowSecurityLocalAction {
  workflow: string;
  path: string;
  reference: string;
  normalizedPath: string;
}

export interface WorkflowSecurityPermission {
  workflow: string;
  path: string;
  scope: "top-level" | "job";
  job?: string;
  permissions: unknown;
}

export interface WorkflowSecurityContainerImage {
  workflow: string;
  path: string;
  job: string;
  service: string | null;
  image: unknown;
  kind: "job-container" | "service";
  allowedBy: "sha256-digest" | "exception" | null;
}

export interface WorkflowSecurityExceptionUsed {
  type: "container-image" | "job-level-permissions";
  workflow: string;
  path: string;
  exception: unknown;
}

export interface WorkflowSecurityReport {
  passed: boolean;
  failures: WorkflowSecurityFailure[];
  details: string[];
  policyVersion: string;
  workflows: WorkflowSecurityWorkflow[];
  externalActions: WorkflowSecurityExternalAction[];
  localActions: WorkflowSecurityLocalAction[];
  permissions: WorkflowSecurityPermission[];
  containerImages: WorkflowSecurityContainerImage[];
  exceptionsUsed: WorkflowSecurityExceptionUsed[];
}

export function evaluateWorkflowSecurity(options?: {
  rootDir?: string;
  workflowPaths?: string[];
}): WorkflowSecurityReport;

export function renderWorkflowSecuritySummary(report: WorkflowSecurityReport): string;

export function main(argv?: string[]): number;
