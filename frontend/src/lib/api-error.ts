export class ApiResponseError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
  }
}

export type AdminAccessErrorStatus = 401 | 403;

export type AdminAccessErrorState = {
  status: AdminAccessErrorStatus;
  title: string;
  message: string;
  supportText?: string;
};

const ADMIN_ACCESS_ERROR_STATES: Record<
  AdminAccessErrorStatus,
  AdminAccessErrorState
> = {
  401: {
    status: 401,
    title: "Sesión expirada",
    message:
      "Tu sesión de Administración expiró. Volvé a iniciar sesión para continuar.",
  },
  403: {
    status: 403,
    title: "Acceso restringido",
    message: "No tenés permisos suficientes para acceder a este módulo.",
    supportText: "Contactá a Administración si necesitás acceso.",
  },
};

export function isAdminAccessErrorStatus(
  status: number,
): status is AdminAccessErrorStatus {
  return status === 401 || status === 403;
}

export function getAdminAccessErrorStatus(
  error: unknown,
): AdminAccessErrorStatus | null {
  return error instanceof ApiResponseError &&
    isAdminAccessErrorStatus(error.status)
    ? error.status
    : null;
}

export function getAdminAccessErrorState(
  errorOrStatus: unknown,
): AdminAccessErrorState | null {
  const status =
    typeof errorOrStatus === "number" &&
    isAdminAccessErrorStatus(errorOrStatus)
      ? errorOrStatus
      : getAdminAccessErrorStatus(errorOrStatus);

  return status ? ADMIN_ACCESS_ERROR_STATES[status] : null;
}

export function isUnauthorizedApiError(
  error: unknown,
): error is ApiResponseError {
  return error instanceof ApiResponseError && error.status === 401;
}
