"use client";

import {
  FormEvent,
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import NextImage from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getClinicPublicProfile,
  updateClinicPublicProfile,
  uploadClinicPublicProfileAvatar,
  deleteClinicPublicProfileAvatar,
  type ClinicPublicProfile,
  type ClinicPublicProfileUpdatePayload,
} from "@/lib/api";
import { ModuleCardSections } from "@/components/dashboard/ModuleCard";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";

type ProfileFormState = {
  displayName: string;
  specialtyText: string;
  servicesText: string;
  aboutText: string;
  email: string;
  phone: string;
  publicAddress: string;
  mapLink: string;
  locality: string;
  country: string;
  isPublic: boolean;
};

const INITIAL_FORM_STATE: ProfileFormState = {
  displayName: "",
  specialtyText: "",
  servicesText: "",
  aboutText: "",
  email: "",
  phone: "",
  publicAddress: "",
  mapLink: "",
  locality: "",
  country: "",
  isPublic: false,
};

const MAX_AVATAR_FILE_SIZE_BYTES = 512 * 1024;
const MIN_AVATAR_DIMENSION = 160;
const MAX_AVATAR_DIMENSION = 1024;
const MIN_AVATAR_ASPECT_RATIO = 0.85;
const MAX_AVATAR_ASPECT_RATIO = 1.15;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PROFILE_FORM_ID = "clinic-public-profile-form";
const PASSWORD_TAB_ID = "cambiar-contrasena";

const PUBLICATION_FIELD_LABELS: Record<string, string> = {
  displayName: "Nombre visible",
  specialtyText: "Especialidad",
  publicAddress: "Dirección pública",
  mapLink: "Enlace a mapa",
  locality: "Localidad",
  country: "País",
  avatar: "Avatar",
  aboutText: "Descripción profesional",
  servicesText: "Servicios",
  email: "Email",
  phone: "Teléfono",
};

function getFieldLabel(field: string) {
  return PUBLICATION_FIELD_LABELS[field] ?? field;
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function getMapLinkValidationError(rawValue: string) {
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return "El enlace a mapa debe ser una URL válida con https://.";
  }

  if (parsed.protocol !== "https:") {
    return "El enlace a mapa debe usar https://.";
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const isGoogleMapsPath =
    (host === "google.com" || host === "www.google.com") &&
    pathname.startsWith("/maps");
  const isShortGoogleMaps = host === "goo.gl" && pathname.startsWith("/maps");
  const isAllowedMapHost = new Set([
    "maps.google.com",
    "maps.app.goo.gl",
    "openstreetmap.org",
    "www.openstreetmap.org",
  ]).has(host);

  if (!isGoogleMapsPath && !isShortGoogleMaps && !isAllowedMapHost) {
    return "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).";
  }

  return null;
}

function getAvatarFileExtension(fileName: string) {
  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.width, height: image.height });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudieron leer las dimensiones de la imagen."));
    };

    image.src = objectUrl;
  });
}

async function getAvatarValidationError(file: File) {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }

  const extension = getAvatarFileExtension(file.name);

  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }

  if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
    return "La imagen no debe superar 512 KB.";
  }

  const { width, height } = await loadImageDimensions(file);

  if (width < MIN_AVATAR_DIMENSION || height < MIN_AVATAR_DIMENSION) {
    return "La imagen debe tener al menos 160 x 160 px.";
  }

  if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
    return "La imagen no debe superar 1024 x 1024 px.";
  }

  const ratio = width / height;

  if (ratio < MIN_AVATAR_ASPECT_RATIO || ratio > MAX_AVATAR_ASPECT_RATIO) {
    return "Se recomienda una imagen cuadrada para evitar recortes.";
  }

  return null;
}

function getProfileInitials(displayName: string) {
  const words = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "CL";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function toFormState(profile: ClinicPublicProfile): ProfileFormState {
  return {
    displayName: profile.displayName ?? "",
    specialtyText: profile.specialtyText ?? "",
    servicesText: profile.servicesText ?? "",
    aboutText: profile.aboutText ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    publicAddress: profile.publicAddress ?? "",
    mapLink: profile.mapLink ?? "",
    locality: profile.locality ?? "",
    country: profile.country ?? "",
    isPublic: profile.isPublic,
  };
}

function buildPayload(formState: ProfileFormState): ClinicPublicProfileUpdatePayload {
  return {
    displayName: normalizeOptionalText(formState.displayName),
    specialtyText: normalizeOptionalText(formState.specialtyText),
    servicesText: normalizeOptionalText(formState.servicesText),
    aboutText: normalizeOptionalText(formState.aboutText),
    email: normalizeOptionalText(formState.email),
    phone: normalizeOptionalText(formState.phone),
    publicAddress: normalizeOptionalText(formState.publicAddress),
    mapLink: normalizeOptionalText(formState.mapLink),
    locality: normalizeOptionalText(formState.locality),
    country: normalizeOptionalText(formState.country),
    isPublic: formState.isPublic,
  };
}

function getPublicationVariant(
  profile: ClinicPublicProfile | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!profile) return "outline";
  if (profile.publication.isSearchEligible) return "default";
  if (profile.isPublic && profile.publication.publicationErrors.length > 0) {
    return "destructive";
  }
  return "secondary";
}

function getPublicationLabel(profile: ClinicPublicProfile | null) {
  if (!profile) return "Sin cargar";
  if (profile.publication.isSearchEligible) return "Visible en banco";
  if (profile.isPublic) return "Publicación incompleta";
  return "Borrador privado";
}

export function ClinicPublicProfileCard() {
  const [profile, setProfile] = useState<ClinicPublicProfile | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>(INITIAL_FORM_STATE);
  const [activeTabId, setActiveTabId] = useState("estado");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarDeleting, setIsAvatarDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileLoadErrorMessage, setProfileLoadErrorMessage] = useState<
    string | null
  >(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

  function clearAvatarObjectUrl() {
    if (!avatarObjectUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(avatarObjectUrlRef.current);
    avatarObjectUrlRef.current = null;
  }

  function resetAvatarSelection() {
    clearAvatarObjectUrl();
    setAvatarPreviewUrl(null);
    setAvatarFile(null);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  async function loadProfile() {
    setIsLoading(true);
    setErrorMessage(null);
    setProfileLoadErrorMessage(null);

    try {
      const snapshot = await getClinicPublicProfile();

      setProfile(snapshot.profile);
      setFormState(toFormState(snapshot.profile));
    } catch (error) {
      setProfileLoadErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el perfil público de la clínica.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();

    return () => {
      clearAvatarObjectUrl();
    };
  }, []);

  function updateField<K extends keyof ProfileFormState>(
    field: K,
    value: ProfileFormState[K],
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleAvatarSelection(file: File) {
    const validationError = await getAvatarValidationError(file);

    if (validationError) {
      resetAvatarSelection();
      setErrorMessage(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    clearAvatarObjectUrl();
    avatarObjectUrlRef.current = objectUrl;
    setAvatarPreviewUrl(objectUrl);
    setAvatarFile(file);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleAvatarInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      resetAvatarSelection();
      return;
    }

    await handleAvatarSelection(file);
  }

  async function handleAvatarUpload() {
    if (!avatarFile || isAvatarUploading) {
      return;
    }

    setIsAvatarUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await uploadClinicPublicProfileAvatar(avatarFile);
      setProfile(response.profile);
      setFormState(toFormState(response.profile));
      resetAvatarSelection();
      setStatusMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el avatar o logo institucional.",
      );
    } finally {
      setIsAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!profile?.avatarUrl || isAvatarDeleting) {
      return;
    }

    setIsAvatarDeleting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await deleteClinicPublicProfileAvatar();
      setProfile(response.profile);
      setFormState(toFormState(response.profile));
      resetAvatarSelection();
      setStatusMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo quitar el avatar o logo institucional.",
      );
    } finally {
      setIsAvatarDeleting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (/[<>]/.test(formState.publicAddress)) {
      setErrorMessage("La dirección pública no puede contener HTML.");
      setStatusMessage(null);
      return;
    }

    const mapLinkValidationError = getMapLinkValidationError(formState.mapLink);

    if (mapLinkValidationError) {
      setErrorMessage(mapLinkValidationError);
      setStatusMessage(null);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await updateClinicPublicProfile(buildPayload(formState));

      setProfile(response.profile);
      setFormState(toFormState(response.profile));
      setStatusMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el perfil público.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const publication = profile?.publication;
  const missingRequiredFields = publication?.missingRequiredFields ?? [];
  const missingRecommendedFields = publication?.missingRecommendedFields ?? [];
  const publicationErrors = publication?.publicationErrors ?? [];
  const profileAvatarSrc = avatarPreviewUrl ?? profile?.avatarUrl ?? null;
  const profileInitials = getProfileInitials(formState.displayName);
  const isWorking =
    isLoading || isSubmitting || isAvatarUploading || isAvatarDeleting;

  // CMP-10 (DIF-034) — a single always-rendered header subtitle line replaces
  // the three stacked in-flow alert blocks that used to push tab content
  // down when they appeared. All three conditions still fully described —
  // joined, in the same severity order the blocks used to render top to
  // bottom — just collapsed into one persistent, never-shifting slot instead
  // of geometry-changing siblings.
  const completionSummaryParts: string[] = [];
  if (missingRequiredFields.length) {
    completionSummaryParts.push(
      `Obligatorios pendientes: ${missingRequiredFields.map(getFieldLabel).join(", ")}`,
    );
  }
  if (missingRecommendedFields.length) {
    completionSummaryParts.push(
      `Recomendados: ${missingRecommendedFields.map(getFieldLabel).join(", ")}`,
    );
  }
  if (publicationErrors.length) {
    completionSummaryParts.push(...publicationErrors);
  }
  const completionSummary = completionSummaryParts.length
    ? completionSummaryParts.join(" · ")
    : "Todos los campos de publicación están completos.";

  const statusTab = (
    <div
      data-clinic-profile-fields="true"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    >
      <div className="clinical-muted-band rounded-lg px-3 py-2">
        <label htmlFor="clinic-profile-avatar" className="field-label">
          Avatar o logo
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-vetneb-line/70 bg-white">
            {profileAvatarSrc ? (
              <NextImage
                src={profileAvatarSrc}
                alt="Avatar o logo de la clínica"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-sm font-semibold text-vetneb-ink">
                {profileInitials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              id="clinic-profile-avatar"
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarInputChange}
              disabled={isWorking}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAvatarUpload}
                disabled={!avatarFile || isWorking}
              >
                {isAvatarUploading ? "Cargando..." : "Guardar imagen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAvatarRemove}
                disabled={!profile?.avatarUrl || isWorking}
              >
                {isAvatarDeleting ? "Quitando..." : "Quitar imagen"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const detailsTab = (
    <div
      data-clinic-profile-fields="true"
      className="min-h-0 flex-1 overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label htmlFor="clinic-profile-display-name" className="field-label">
            Nombre visible
          </label>
          <Input
            id="clinic-profile-display-name"
            name="displayName"
            type="text"
            required
            value={formState.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            disabled={isWorking}
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-specialty" className="field-label">
            Especialidad
          </label>
          <Input
            id="clinic-profile-specialty"
            name="specialtyText"
            type="text"
            required
            value={formState.specialtyText}
            onChange={(event) => updateField("specialtyText", event.target.value)}
            disabled={isWorking}
            placeholder="Ej: Anatomía patológica veterinaria"
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-locality" className="field-label">
            Localidad
          </label>
          <Input
            id="clinic-profile-locality"
            name="locality"
            type="text"
            required
            value={formState.locality}
            onChange={(event) => updateField("locality", event.target.value)}
            disabled={isWorking}
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-country" className="field-label">
            País
          </label>
          <Input
            id="clinic-profile-country"
            name="country"
            type="text"
            required
            value={formState.country}
            onChange={(event) => updateField("country", event.target.value)}
            disabled={isWorking}
          />
        </div>
      </div>
    </div>
  );

  const contactTab = (
    <div
      data-clinic-profile-fields="true"
      className="min-h-0 flex-1 overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label htmlFor="clinic-profile-email" className="field-label">
            Email público
          </label>
          <Input
            id="clinic-profile-email"
            name="email"
            type="email"
            value={formState.email}
            onChange={(event) => updateField("email", event.target.value)}
            disabled={isWorking}
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-phone" className="field-label">
            Teléfono público
          </label>
          <Input
            id="clinic-profile-phone"
            name="phone"
            type="text"
            value={formState.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            disabled={isWorking}
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-public-address" className="field-label">
            Dirección pública
          </label>
          <Input
            id="clinic-profile-public-address"
            name="publicAddress"
            type="text"
            maxLength={160}
            value={formState.publicAddress}
            onChange={(event) => updateField("publicAddress", event.target.value)}
            disabled={isWorking}
            placeholder="Calle, número, ciudad"
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-map-link" className="field-label">
            Enlace a mapa
          </label>
          <Input
            id="clinic-profile-map-link"
            name="mapLink"
            type="url"
            value={formState.mapLink}
            onChange={(event) => updateField("mapLink", event.target.value)}
            disabled={isWorking}
            placeholder="https://maps.google.com/..."
          />
        </div>
      </div>
    </div>
  );

  const contentTab = (
    <div
      data-clinic-profile-fields="true"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label htmlFor="clinic-profile-services" className="field-label">
            Servicios
          </label>
          <textarea
            id="clinic-profile-services"
            name="servicesText"
            className="field-textarea h-20 min-h-0"
            value={formState.servicesText}
            onChange={(event) => updateField("servicesText", event.target.value)}
            disabled={isWorking}
            placeholder="Describa prestaciones, estudios y servicios ofrecidos."
          />
        </div>

        <div>
          <label htmlFor="clinic-profile-about" className="field-label">
            Descripción profesional
          </label>
          <textarea
            id="clinic-profile-about"
            name="aboutText"
            className="field-textarea h-20 min-h-0"
            value={formState.aboutText}
            onChange={(event) => updateField("aboutText", event.target.value)}
            disabled={isWorking}
            placeholder="Complete trayectoria y foco profesional."
          />
        </div>
      </div>

      <label className="clinical-muted-band flex items-start gap-3 rounded-lg px-3 py-2 text-xs text-vetneb-navy sm:text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={formState.isPublic}
          onChange={(event) => updateField("isPublic", event.target.checked)}
          disabled={isWorking}
        />
        <span>
          Publicar perfil cuando cumpla los requisitos para aparecer en el banco
          de especialidades.
        </span>
      </label>
    </div>
  );

  function renderProfileForm(content: ReactNode) {
    return (
      <form id={PROFILE_FORM_ID} className="contents" onSubmit={handleSubmit}>
        {content}
      </form>
    );
  }

  const isPasswordTabActive = activeTabId === PASSWORD_TAB_ID;

  return (
    <ModuleCardSections
      ariaLabel="Perfil público de la clínica"
      cardDataAttributes={{
        id: "clinic-public-profile",
        "data-clinic-profile-editor": "true",
      }}
      cardAttribute="data-clinic-mobile-module"
      cardAttributeValue="perfil"
      chipAttribute="data-clinic-profile-chip"
      panelAttribute="data-clinic-profile-panel"
      activeId={activeTabId}
      onActiveIdChange={setActiveTabId}
      header={
        <>
          <div
            data-clinic-profile-toolbar="true"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 p-1.5"
          >
            {/* CMP-05 formulas intentionally use the existing profile snapshot; no endpoint is added.
                Desktop-only below: the toolbar stays because it carries the publication badge and
                "Guardar perfil público", and retiring just the run returns the wrapped 16px line
                plus the 8px flex row-gap to that action row. The CMP-10 subtitle slot underneath
                ("Recomendados: …", loading, error + retry) is a SIBLING of this toolbar and is
                deliberately untouched. */}
            <ModuleMetricRun
              className="hidden md:flex"
              surfaceId="clinic-perfil"
              metrics={[
                { key: "estado", label: "Estado", value: publication?.isSearchEligible ? "Visible" : "Oculto" },
                { key: "completitud", label: "Completitud", value: publication ? `${publication.qualityScore}/${publication.minimumQualityScore}` : "—" },
                { key: "pendientes", label: "Pendientes", value: missingRequiredFields.length + missingRecommendedFields.length },
              ]}
            />
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge variant={getPublicationVariant(profile)}>
              {getPublicationLabel(profile)}
            </Badge>
            {!isPasswordTabActive ? (
              <Button
                type="submit"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={isWorking}
                form={PROFILE_FORM_ID}
              >
                {isSubmitting ? "Guardando..." : "Guardar perfil público"}
              </Button>
              ) : null}
            </div>
          </div>
          {/* CMP-10 (DIF-034) — always-rendered subtitle slot, mirroring
              AdminSessionsReadOnlyCard's header subtitle: loading/error text
              swaps in place of the default state, so the row never
              appears/disappears and the tabs below it never shift. */}
          <div
            className={`flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 px-2.5 py-1.5 text-xs ${
              profileLoadErrorMessage ? "text-destructive" : "text-muted-foreground"
            }`}
            role={profileLoadErrorMessage ? "alert" : isLoading ? "status" : undefined}
          >
            <span className="line-clamp-2">
              {profileLoadErrorMessage ??
                (isLoading ? "Cargando perfil público..." : completionSummary)}
            </span>
            {profileLoadErrorMessage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 px-2.5 text-xs"
                onClick={() => void loadProfile()}
                disabled={isWorking}
              >
                Reintentar carga
              </Button>
            ) : null}
          </div>
        </>
      }
      sections={[
            {
              id: "estado",
              label: "Estado",
              content: renderProfileForm(statusTab),
            },
            {
              id: "datos",
              label: "Datos",
              content: renderProfileForm(detailsTab),
            },
            {
              id: "contacto",
              label: "Contacto",
              content: renderProfileForm(contactTab),
            },
            {
              id: "contenido",
              label: "Contenido",
              content: renderProfileForm(contentTab),
            },
            {
              id: PASSWORD_TAB_ID,
              label: "Cambiar contraseña",
              content: (
                <PasswordChangePanel variant="clinic" density="compact" />
              ),
            },
          ]}
      footer={
        !isPasswordTabActive ? (
          <div
            data-clinic-profile-footer="true"
            className="flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-t border-vetneb-line/65 pt-2 text-xs"
          >
            {errorMessage ? (
              <p className="clinical-alert-error px-3 py-1.5" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {statusMessage ? (
              <p className="clinical-alert-success px-3 py-1.5">
                {statusMessage}
              </p>
            ) : null}

            {!errorMessage && !statusMessage ? (
              <p className="text-muted-foreground">
                Cambios del perfil se guardan desde la acción principal del módulo.
              </p>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
