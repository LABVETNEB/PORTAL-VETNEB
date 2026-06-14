import "server-only";

import { redirect } from "next/navigation";

import { isUnauthorizedApiError } from "@/lib/api-error";
import { ROUTES } from "@/lib/routes";

export function redirectToLoginOnUnauthorized(error: unknown): void {
  if (isUnauthorizedApiError(error)) {
    redirect(ROUTES.login);
  }
}
