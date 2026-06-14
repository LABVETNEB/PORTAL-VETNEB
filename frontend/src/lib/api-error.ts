export class ApiResponseError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
  }
}

export function isUnauthorizedApiError(
  error: unknown,
): error is ApiResponseError {
  return error instanceof ApiResponseError && error.status === 401;
}
