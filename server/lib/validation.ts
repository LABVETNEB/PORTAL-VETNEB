import { type ZodError } from "zod";

function issuePath(path: (string | number)[]): string {
  if (path.length === 0) {
    return "body";
  }

  return path
    .map((part) => (typeof part === "number" ? `[${part}]` : part))
    .join(".");
}

export function zodValidationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issuePath(issue.path),
    message: issue.message,
  }));
}

export function zodValidationResponse(error: ZodError) {
  return {
    success: false,
    error: "Payload invalido",
    details: zodValidationDetails(error),
  };
}
