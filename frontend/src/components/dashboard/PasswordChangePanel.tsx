"use client";

import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  changeAdminPassword,
  changeClinicPassword,
  type ChangePasswordInput,
  type ChangePasswordResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export type PasswordChangeVariant = "clinic" | "admin";
export type PasswordChangeDensity = "default" | "compact";

const MIN_PASSWORD_LENGTH = 8;

const DEFAULT_TITLE = "Seguridad";
const DEFAULT_DESCRIPTION =
  "Actualizá tu contraseña de acceso sin cerrar tu sesión actual.";

const SUCCESS_MESSAGE = "Contraseña actualizada correctamente.";
const GENERIC_ERROR_MESSAGE =
  "No pudimos cambiar la contraseña. Verificá los datos e intentá nuevamente.";

const REQUIRED_FIELDS_MESSAGE =
  "Completá la contraseña actual, la nueva y su confirmación.";
const MIN_LENGTH_MESSAGE =
  "La nueva contraseña debe tener al menos 8 caracteres.";
const MISMATCH_MESSAGE =
  "La nueva contraseña y su confirmación no coinciden.";
const SAME_AS_CURRENT_MESSAGE =
  "La nueva contraseña debe ser distinta de la actual.";

// Both authenticated surfaces reuse the API clients merged in PR #1003. The
// variant maps to the matching client; the token-backed surface is
// intentionally absent because it has no password-change contract.
const PASSWORD_CHANGE_HANDLERS: Record<
  PasswordChangeVariant,
  (input: ChangePasswordInput) => Promise<ChangePasswordResponse>
> = {
  clinic: changeClinicPassword,
  admin: changeAdminPassword,
};

type PasswordChangePanelProps = {
  variant: PasswordChangeVariant;
  density?: PasswordChangeDensity;
  title?: string;
  description?: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const INITIAL_FORM_STATE: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getValidationError(state: PasswordFormState): string | null {
  if (
    !state.currentPassword ||
    !state.newPassword ||
    !state.confirmPassword
  ) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (state.newPassword.length < MIN_PASSWORD_LENGTH) {
    return MIN_LENGTH_MESSAGE;
  }

  if (state.newPassword !== state.confirmPassword) {
    return MISMATCH_MESSAGE;
  }

  if (state.newPassword === state.currentPassword) {
    return SAME_AS_CURRENT_MESSAGE;
  }

  return null;
}

export function PasswordChangePanel({
  variant,
  density = "default",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: PasswordChangePanelProps) {
  const isCompact = density === "compact";
  const fieldId = useId();
  const currentPasswordId = `${fieldId}-current-password`;
  const newPasswordId = `${fieldId}-new-password`;
  const confirmPasswordId = `${fieldId}-confirm-password`;
  const labelClassName = cn(
    "field-label",
    isCompact && "mb-1 text-xs leading-tight sm:mb-1.5 sm:text-sm",
  );
  const alertClassName = cn(
    "px-3 py-2",
    isCompact && "px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm",
  );

  const [formState, setFormState] =
    useState<PasswordFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateField(field: keyof PasswordFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationError = getValidationError(formState);

    if (validationError) {
      setStatusMessage(null);
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      // Only the two backend-required fields leave the component; the
      // confirmation stays local and is never transmitted.
      await PASSWORD_CHANGE_HANDLERS[variant]({
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
      });

      // Success keeps the current session active and clears the sensitive
      // fields from component state.
      setFormState(INITIAL_FORM_STATE);
      setStatusMessage(SUCCESS_MESSAGE);
    } catch {
      // Backend failures collapse to a single generic, non-enumerative message.
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card
      id={`${variant}-password-change`}
      className={cn(
        "dashboard-surface",
        isCompact &&
          "flex min-h-0 flex-1 flex-col overflow-hidden sm:block sm:overflow-visible",
      )}
    >
      {isCompact ? (
        <div className="sr-only sm:hidden">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      ) : null}
      <CardHeader
        className={cn(
          "border-b border-vetneb-line/70 px-5 py-4",
          isCompact && "hidden sm:flex",
        )}
      >
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "px-5 py-4",
          isCompact &&
            "flex min-h-0 flex-1 flex-col px-3 py-2.5 sm:block sm:px-5 sm:py-4",
        )}
      >
        <form
          className={cn(
            "space-y-3",
            isCompact && "space-y-2 sm:space-y-3",
          )}
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor={currentPasswordId} className={labelClassName}>
              Contraseña actual
            </label>
            <Input
              id={currentPasswordId}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={formState.currentPassword}
              onChange={(event) =>
                updateField("currentPassword", event.target.value)
              }
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor={newPasswordId} className={labelClassName}>
              Nueva contraseña
            </label>
            <Input
              id={newPasswordId}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={formState.newPassword}
              onChange={(event) =>
                updateField("newPassword", event.target.value)
              }
              disabled={isSubmitting}
            />
            <p
              className={cn(
                "mt-1 text-xs text-muted-foreground",
                isCompact &&
                  "mt-0.5 text-[11px] leading-tight sm:mt-1 sm:text-xs",
              )}
            >
              Mínimo 8 caracteres.
            </p>
          </div>

          <div>
            <label htmlFor={confirmPasswordId} className={labelClassName}>
              Confirmar nueva contraseña
            </label>
            <Input
              id={confirmPasswordId}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={formState.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              disabled={isSubmitting}
            />
          </div>

          <div aria-live="polite" role="status">
            {statusMessage ? (
              <p className={cn("clinical-alert-success", alertClassName)}>
                {statusMessage}
              </p>
            ) : null}
          </div>

          <div aria-live="assertive">
            {errorMessage ? (
              <p
                className={cn("clinical-alert-error", alertClassName)}
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              isCompact && "h-9 px-3 py-1.5 sm:h-10 sm:px-4 sm:py-2",
            )}
          >
            {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
