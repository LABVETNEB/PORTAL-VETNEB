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

export type PasswordChangeVariant = "clinic" | "admin";

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
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: PasswordChangePanelProps) {
  const fieldId = useId();
  const currentPasswordId = `${fieldId}-current-password`;
  const newPasswordId = `${fieldId}-new-password`;
  const confirmPasswordId = `${fieldId}-confirm-password`;

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
    <Card id={`${variant}-password-change`} className="dashboard-surface">
      <CardHeader className="border-b border-vetneb-line/70">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor={currentPasswordId} className="field-label">
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
            <label htmlFor={newPasswordId} className="field-label">
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
            <p className="mt-1 text-xs text-muted-foreground">
              Mínimo 8 caracteres.
            </p>
          </div>

          <div>
            <label htmlFor={confirmPasswordId} className="field-label">
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
              <p className="clinical-alert-success px-3 py-2">
                {statusMessage}
              </p>
            ) : null}
          </div>

          <div aria-live="assertive">
            {errorMessage ? (
              <p className="clinical-alert-error px-3 py-2" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
