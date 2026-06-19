"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, EyeOff, KeyRound, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminClinicManagementSummary } from "@/types";

export type ClinicDraft = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
};

export type CredentialsPayload = {
  username?: string;
  password?: string;
};

type Props = {
  clinic: AdminClinicManagementSummary | null;
  onSaveClinic: (clinicId: number, draft: ClinicDraft) => Promise<void>;
  onSaveCredentials: (userId: number, payload: CredentialsPayload) => Promise<void>;
  onDeleteClinic: (clinicId: number, confirmedName: string) => Promise<void>;
  onClose: () => void;
};

function getInitialClinicDraft(clinic: AdminClinicManagementSummary): ClinicDraft {
  return {
    clinicName: clinic.clinicName,
    contactEmail: clinic.contactEmail ?? "",
    contactPhone: clinic.contactPhone ?? "",
  };
}

function getInitialUserDrafts(
  clinic: AdminClinicManagementSummary,
): Record<number, { username: string; password: string }> {
  const drafts: Record<number, { username: string; password: string }> = {};
  for (const user of clinic.users) {
    drafts[user.userId] = { username: user.username, password: "" };
  }
  return drafts;
}

export function ClinicEditDrawer({
  clinic,
  onSaveClinic,
  onSaveCredentials,
  onDeleteClinic,
  onClose,
}: Props) {
  const titleId = useId();
  const open = clinic !== null;

  const [clinicDraft, setClinicDraft] = useState<ClinicDraft | null>(null);
  const [userDrafts, setUserDrafts] = useState<
    Record<number, { username: string; password: string }>
  >({});
  const [visiblePasswordUserIds, setVisiblePasswordUserIds] = useState<
    Record<number, boolean>
  >({});
  const [clinicSaving, setClinicSaving] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [credentialsErrors, setCredentialsErrors] = useState<
    Record<number, string | undefined>
  >({});
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isBusy = clinicSaving || credentialsSaving !== null || deleting;

  useEffect(() => {
    if (!clinic) return;
    setClinicDraft(getInitialClinicDraft(clinic));
    setUserDrafts(getInitialUserDrafts(clinic));
    setVisiblePasswordUserIds({});
    setClinicError(null);
    setCredentialsErrors({});
    setDeleteError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinic?.clinicId]);

  async function handleSaveClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinic || !clinicDraft || isBusy) return;

    setClinicError(null);
    setClinicSaving(true);
    try {
      await onSaveClinic(clinic.clinicId, clinicDraft);
      onClose();
    } catch (err) {
      setClinicError(
        err instanceof Error ? err.message : "No se pudo actualizar la clínica.",
      );
    } finally {
      setClinicSaving(false);
    }
  }

  async function handleSaveCredentials(
    event: FormEvent<HTMLFormElement>,
    userId: number,
  ) {
    event.preventDefault();
    if (!clinic || isBusy) return;

    const user = clinic.users.find((u) => u.userId === userId);
    const draft = userDrafts[userId];

    if (!user || !draft) return;

    const payload: CredentialsPayload = {};

    if (draft.username.trim() !== user.username) {
      payload.username = draft.username.trim();
    }

    if (draft.password.trim()) {
      const confirmed = window.confirm(
        "Se reemplazará la contraseña de acceso de esta clínica. ¿Confirmás el cambio?",
      );
      if (!confirmed) return;
      payload.password = draft.password.trim();
    }

    if (!payload.username && !payload.password) {
      setCredentialsErrors((prev) => ({
        ...prev,
        [userId]: "No hay cambios de usuario o credencial para guardar.",
      }));
      return;
    }

    setCredentialsErrors((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setCredentialsSaving(userId);

    try {
      await onSaveCredentials(userId, payload);
      setUserDrafts((prev) => ({
        ...prev,
        [userId]: { ...prev[userId]!, password: "" },
      }));
      setVisiblePasswordUserIds((prev) => ({ ...prev, [userId]: false }));
    } catch (err) {
      setCredentialsErrors((prev) => ({
        ...prev,
        [userId]: err instanceof Error
          ? err.message
          : "No se pudieron actualizar las credenciales.",
      }));
    } finally {
      setCredentialsSaving(null);
    }
  }

  function togglePasswordVisibility(userId: number) {
    setVisiblePasswordUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  }

  async function handleDelete() {
    if (!clinic || isBusy) return;

    const confirmedDestructive = window.confirm(
      `Vas a eliminar definitivamente la clínica "${clinic.clinicName}" y sus datos relacionados. Esta acción es irreversible. ¿Deseás continuar?`,
    );
    if (!confirmedDestructive) return;

    const typedName = window.prompt(
      `Para confirmar, escribí exactamente el nombre de la clínica:\n\n${clinic.clinicName}`,
      "",
    );
    if (typedName === null) return;

    if (typedName.trim() !== clinic.clinicName) {
      setDeleteError("La confirmación no coincide con el nombre exacto de la clínica.");
      return;
    }

    setDeleteError(null);
    setDeleting(true);
    try {
      await onDeleteClinic(clinic.clinicId, typedName.trim());
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "No se pudo eliminar la clínica.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-vetneb-ink/30 backdrop-blur-[1px] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-labelledby={titleId}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-vetneb-line bg-card shadow-[-24px_0_72px_rgba(8,35,50,0.18)] duration-200 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
          onInteractOutside={(e) => {
            if (isBusy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isBusy) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-vetneb-line/70 px-5 py-4">
            <div>
              <Dialog.Title
                id={titleId}
                className="text-base font-semibold text-vetneb-ink"
              >
                Editar clínica
              </Dialog.Title>
              {clinic ? (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Clínica #{clinic.clinicId}
                </p>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isBusy}
                aria-label="Cerrar panel de edición"
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {/* Clinic data section */}
            <section aria-label="Datos de la clínica">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Datos de la clínica
              </p>
              <form
                id="clinic-data-form"
                onSubmit={(e) => void handleSaveClinic(e)}
                className="space-y-3"
              >
                <fieldset disabled={isBusy} className="contents">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Nombre</span>
                    <Input
                      value={clinicDraft?.clinicName ?? ""}
                      maxLength={255}
                      required
                      onChange={(e) =>
                        setClinicDraft((d) =>
                          d ? { ...d, clinicName: e.target.value } : d,
                        )
                      }
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Email de contacto
                    </span>
                    <Input
                      type="email"
                      value={clinicDraft?.contactEmail ?? ""}
                      maxLength={255}
                      onChange={(e) =>
                        setClinicDraft((d) =>
                          d ? { ...d, contactEmail: e.target.value } : d,
                        )
                      }
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Teléfono</span>
                    <Input
                      value={clinicDraft?.contactPhone ?? ""}
                      maxLength={50}
                      placeholder="Teléfono opcional"
                      onChange={(e) =>
                        setClinicDraft((d) =>
                          d ? { ...d, contactPhone: e.target.value } : d,
                        )
                      }
                    />
                  </label>
                  {clinicError ? (
                    <div role="alert" className="clinical-alert-error">
                      {clinicError}
                    </div>
                  ) : null}
                </fieldset>
              </form>
            </section>

            {/* Credentials — one section per user */}
            {clinic?.users.map((user) => {
              const draft = userDrafts[user.userId] ?? {
                username: user.username,
                password: "",
              };
              const credError = credentialsErrors[user.userId];
              const isSavingThis = credentialsSaving === user.userId;
              const passwordInputId = `clinic-user-${user.userId}-password`;
              const isPasswordVisible =
                visiblePasswordUserIds[user.userId] ?? false;

              return (
                <section
                  key={user.userId}
                  aria-label={`Acceso usuario ${user.username}`}
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Acceso
                  </p>
                  <form
                    id={`credentials-form-${user.userId}`}
                    onSubmit={(e) => void handleSaveCredentials(e, user.userId)}
                    className="space-y-3"
                  >
                    <fieldset disabled={isBusy} className="contents">
                      <p className="font-mono text-xs text-muted-foreground">
                        Usuario #{user.userId}
                      </p>
                      <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">
                          Usuario de acceso
                        </span>
                        <Input
                          value={draft.username}
                          minLength={3}
                          maxLength={100}
                          onChange={(e) =>
                            setUserDrafts((prev) => ({
                              ...prev,
                              [user.userId]: {
                                ...prev[user.userId]!,
                                username: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <div className="block space-y-1">
                        <label
                          htmlFor={passwordInputId}
                          className="text-xs text-muted-foreground"
                        >
                          Nueva contraseña
                        </label>
                        <div className="relative">
                          <Input
                            id={passwordInputId}
                            type={isPasswordVisible ? "text" : "password"}
                            value={draft.password}
                            minLength={8}
                            autoComplete="new-password"
                            placeholder="Dejar vacío para no cambiar"
                            className="pr-10"
                            onChange={(e) =>
                              setUserDrafts((prev) => ({
                                ...prev,
                                [user.userId]: {
                                  ...prev[user.userId]!,
                                  password: e.target.value,
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                            onClick={() => togglePasswordVisibility(user.userId)}
                            aria-label={isPasswordVisible ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                            aria-pressed={isPasswordVisible}
                            aria-controls={passwordInputId}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        La contraseña anterior no se puede consultar.
                      </p>
                      {credError ? (
                        <div role="alert" className="clinical-alert-error">
                          {credError}
                        </div>
                      ) : null}
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={isBusy}
                        className="w-full"
                      >
                        {isSavingThis ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <KeyRound aria-hidden="true" />
                        )}
                        {isSavingThis ? "Guardando..." : "Guardar acceso"}
                      </Button>
                    </fieldset>
                  </form>
                </section>
              );
            })}

            {/* Danger zone */}
            <section aria-label="Zona de peligro">
              <div className="border-t border-destructive/20 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-destructive/70">
                  Zona de peligro
                </p>
                {deleteError ? (
                  <div role="alert" className="clinical-alert-error mb-3">
                    {deleteError}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? "Eliminando..." : "Eliminar clínica"}
                </Button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 border-t border-vetneb-line/70 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={isBusy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="clinic-data-form"
              className="flex-1"
              disabled={isBusy}
            >
              {clinicSaving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {clinicSaving ? "Guardando..." : "Guardar clínica"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
