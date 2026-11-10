"use client";

import {
  FormEvent,
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import NextImage from "next/image";
import {
  Building2,
  ChevronDown,
  FileText,
  Mail,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";

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
import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";
import { cn } from "@/lib/utils";

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
const STATUS_TAB_ID = "estado";
const PASSWORD_TAB_ID = "cambiar-contrasena";

const PROFILE_SECTIONS = [
  { id: STATUS_TAB_ID, label: "Estado" },
  { id: "datos", label: "Datos" },
  { id: "contacto", label: "Contacto" },
  { id: "contenido", label: "Contenido" },
  { id: PASSWORD_TAB_ID, label: "Cambiar contraseña" },
] as const;

type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

const PROFILE_SECTION_LABELS = Object.fromEntries(
  PROFILE_SECTIONS.map((section) => [section.id, section.label]),
) as Record<ProfileSectionId, string>;

// Decorative row icons (from 768px up); the label is the accessible name.
const PROFILE_SECTION_ICONS: Partial<Record<ProfileSectionId, LucideIcon>> = {
  datos: Building2,
  contacto: Mail,
  contenido: FileText,
  [PASSWORD_TAB_ID]: ShieldCheck,
};

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
  const [activeTabId, setActiveTabId] = useState<string>(STATUS_TAB_ID);
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

  const isStatusTabActive = activeTabId === STATUS_TAB_ID;

  // Institutional identity (from 768px up). The saved snapshot, not the live
  // form, so the column shows what is published; the avatar fallback keeps
  // reading the form as it always did.
  const identityName = profile?.displayName?.trim() || "Sin nombre visible";
  const identitySpecialty = profile?.specialtyText?.trim() || null;
  const identityPlace =
    [profile?.locality, profile?.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ") || null;

  // Quality is shown only when the real response carries both numbers.
  const qualityScore = publication?.qualityScore;
  const minimumQualityScore = publication?.minimumQualityScore;
  const hasQuality =
    typeof qualityScore === "number" &&
    Number.isFinite(qualityScore) &&
    typeof minimumQualityScore === "number" &&
    Number.isFinite(minimumQualityScore);
  const qualityPercent = hasQuality
    ? Math.min(100, Math.max(0, Math.round(qualityScore)))
    : 0;
  const minimumPercent = hasQuality
    ? Math.min(100, Math.max(0, Math.round(minimumQualityScore)))
    : 0;
  const hasPendingItems =
    missingRequiredFields.length > 0 ||
    missingRecommendedFields.length > 0 ||
    publicationErrors.length > 0;

  // Avatar o logo: below 768px it is the "Estado" chip's content, exactly as
  // before; from 768px up it is the identity block of the institutional column.
  // It is always mounted (hidden on phones while another chip is active), which
  // also keeps the selected file in its input across section changes. From 768px
  // up the real file input stays in the DOM, visually hidden, and a label styled
  // as a button opens it: keyboard, focus ring and accessible name are preserved.
  const statusTab = (
    <div
      data-clinic-profile-fields={isStatusTabActive ? "true" : undefined}
      data-clinic-profile-avatar="true"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:flex-none md:overflow-visible",
        !isStatusTabActive && "max-md:hidden",
      )}
    >
      <div className="clinical-muted-band rounded-lg px-3 py-2 md:border-0 md:bg-none md:bg-transparent md:p-0">
        <label htmlFor="clinic-profile-avatar" className="field-label md:sr-only">
          Avatar o logo
        </label>
        <div className="flex flex-col gap-2 sm:max-[1199px]:flex-row sm:max-[1199px]:items-center md:gap-3 min-[1200px]:items-center">
          <div
            data-clinic-profile-logo="true"
            className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-vetneb-line/70 bg-white md:rounded-2xl"
          >
            {profileAvatarSrc ? (
              <NextImage
                src={profileAvatarSrc}
                alt="Avatar o logo de la clínica"
                width={112}
                height={112}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-sm font-semibold text-vetneb-ink md:text-xl [:root[data-theme=dark-gray]_&]:text-slate-900">
                {profileInitials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 md:flex md:w-full md:flex-col md:gap-2 md:space-y-0 min-[1200px]:items-center min-[1200px]:text-center">
            <div
              data-clinic-profile-identity="true"
              className="min-w-0 max-md:hidden"
            >
              <p className="break-words text-base font-semibold leading-snug text-vetneb-ink">
                {identityName}
              </p>
              {identitySpecialty ? (
                <p className="break-words text-xs text-muted-foreground">
                  {identitySpecialty}
                </p>
              ) : null}
              {identityPlace ? (
                <p className="break-words text-xs text-muted-foreground">
                  {identityPlace}
                </p>
              ) : null}
            </div>
            <Input
              id="clinic-profile-avatar"
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarInputChange}
              disabled={isWorking}
              className="peer md:sr-only"
            />
            <label
              htmlFor="clinic-profile-avatar"
              data-clinic-profile-avatar-picker="true"
              className="inline-flex h-9 w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground ring-offset-background transition-colors hover:bg-vetneb-surface-muted peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/85 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-55 max-md:hidden"
            >
              <Upload aria-hidden="true" className="h-4 w-4 shrink-0" />
              Elegir imagen
            </label>
            <p
              data-clinic-profile-avatar-file={avatarFile ? "selected" : "empty"}
              className="break-all text-xs text-muted-foreground max-md:hidden"
            >
              {avatarFile ? avatarFile.name : "Ninguna imagen seleccionada"}
            </p>
            <div className="flex flex-wrap gap-2 md:shrink-0 min-[1200px]:justify-center">
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
            <p
              data-clinic-profile-hint="true"
              className="text-xs text-muted-foreground max-md:hidden"
            >
              JPG, PNG o WebP · 160–1024 px · máx. 512 KB
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  function renderPendingGroup(
    title: string,
    items: readonly string[],
    tone: "required" | "recommended" | "error",
  ) {
    return (
      <div className="min-w-0">
        <p className="text-xs font-semibold text-vetneb-ink">{title}</p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                "break-words rounded-md border px-2 py-px text-xs",
                tone === "recommended"
                  ? "border-vetneb-line text-muted-foreground"
                  : "border-destructive/60 bg-destructive/10 text-vetneb-ink",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }


  const detailsTab = (
    <div
      data-clinic-profile-fields="true"
      className="min-h-0 flex-1 overflow-hidden md:overflow-visible md:px-3 md:py-1"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-4 md:gap-y-3">
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
      className="min-h-0 flex-1 overflow-hidden md:overflow-visible md:px-3 md:py-1"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-4 md:gap-y-3">
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

  // One `isPublic` control bound to formState, rendered twice and shown once:
  // inside "Contenido" below 768px (as before) and in the institutional column
  // from 768px up, where it is reachable whatever section is open.
  function renderPublishCheckbox(visibilityClass: string) {
    return (
      <label
        className={cn(
          "clinical-muted-band flex items-start gap-3 rounded-lg px-3 py-2 text-xs text-vetneb-navy sm:text-sm",
          visibilityClass,
        )}
      >
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
    );
  }

  const contentTab = (
    <div
      data-clinic-profile-fields="true"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:overflow-visible md:px-3 md:py-1"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-4 md:gap-y-3">
        <div>
          <label htmlFor="clinic-profile-services" className="field-label">
            Servicios
          </label>
          <textarea
            id="clinic-profile-services"
            name="servicesText"
            className="field-textarea h-20 min-h-0 md:h-24"
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
            className="field-textarea h-20 min-h-0 md:h-24"
            value={formState.aboutText}
            onChange={(event) => updateField("aboutText", event.target.value)}
            disabled={isWorking}
            placeholder="Complete trayectoria y foco profesional."
          />
        </div>
      </div>

      {renderPublishCheckbox("md:hidden")}
    </div>
  );

  const isPasswordTabActive = activeTabId === PASSWORD_TAB_ID;
  const sectionBaseId = useId();

  // Clinic desktop/tablet space pass. From 768px up the chip band gives way to
  // a vertical list of disclosure rows under the always-visible avatar, with
  // ONE section open at a time. Rows and chips drive the same `activeTabId`, so
  // both regimes share one source of truth; below 768px the rows do not paint
  // and the chips behave exactly as before. Field values live in `formState`,
  // so a closed section may unmount its inputs without losing anything (which
  // also keeps browser validation scoped to the open section, as before); the
  // password panel owns its own state and is therefore kept mounted, hidden.
  function toggleSection(sectionId: string) {
    setActiveTabId((current) =>
      current === sectionId ? STATUS_TAB_ID : sectionId,
    );
  }

  function renderSectionToggle(sectionId: ProfileSectionId) {
    const isOpen = activeTabId === sectionId;
    const Icon = PROFILE_SECTION_ICONS[sectionId];

    return (
      <button
        type="button"
        id={`${sectionBaseId}-toggle-${sectionId}`}
        aria-expanded={isOpen}
        aria-controls={`${sectionBaseId}-section-${sectionId}`}
        data-clinic-profile-section-toggle={sectionId}
        onClick={() => toggleSection(sectionId)}
        className={cn(
          "hidden h-11 w-full shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-1 md:flex",
          isOpen
            ? "bg-vetneb-surface-muted"
            : "hover:bg-vetneb-surface-muted/60",
        )}
      >
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-vetneb-navy"
          />
        ) : null}
        <span className="flex-1 text-left">{PROFILE_SECTION_LABELS[sectionId]}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
    );
  }

  function renderSection(
    sectionId: ProfileSectionId,
    content: ReactNode,
    keepMounted = false,
  ) {
    const isOpen = activeTabId === sectionId;

    return (
      <div
        id={`${sectionBaseId}-section-${sectionId}`}
        data-clinic-profile-section={sectionId}
        hidden={!isOpen}
        className={isOpen ? "contents md:flex md:flex-col" : "hidden"}
      >
        {isOpen || keepMounted ? content : null}
      </div>
    );
  }

  const publicationBadge = (
    <Badge variant={getPublicationVariant(profile)}>
      {getPublicationLabel(profile)}
    </Badge>
  );

  // From 768px up only: status, quality and pending requirements of the real
  // publication snapshot, plus the existing `isPublic` control. Phones keep the
  // toolbar badge, the completion line and the checkbox inside "Contenido".
  const publicationPanel = (
    <section
      aria-label="Estado de publicación"
      data-clinic-profile-publication="true"
      className="hidden min-w-0 flex-col gap-3 border-vetneb-line/70 md:max-[1199px]:grid md:max-[1199px]:grid-cols-2 md:max-[1199px]:content-start md:max-[1199px]:gap-x-4 md:max-[1199px]:border-l md:max-[1199px]:pl-4 min-[1200px]:flex min-[1200px]:border-t min-[1200px]:pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Publicación
        </p>
        {publicationBadge}
      </div>
      {hasQuality ? (
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>Calidad del perfil</span>
            <span>
              <strong className="font-semibold text-vetneb-ink">{qualityPercent}</strong>{" "}
              / mínimo {minimumPercent}
            </span>
          </div>
          <div
            role="meter"
            aria-label="Calidad del perfil"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={qualityPercent}
            aria-valuetext={`${qualityPercent} de 100, mínimo requerido ${minimumPercent}`}
            className="relative mt-1.5 h-1.5 rounded-full bg-vetneb-line/60"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-vetneb-teal"
              style={{ width: `${qualityPercent}%` }}
            />
            <i
              aria-hidden="true"
              className="absolute -inset-y-0.5 w-0.5 bg-foreground/60"
              style={{ left: `${minimumPercent}%` }}
            />
          </div>
        </div>
      ) : null}
      {profile ? (
        hasPendingItems ? (
          <div className="flex min-w-0 flex-col gap-2 md:max-[1199px]:col-start-2 md:max-[1199px]:row-span-3 md:max-[1199px]:row-start-1">
            {missingRequiredFields.length
              ? renderPendingGroup(
                  "Obligatorios pendientes",
                  missingRequiredFields.map(getFieldLabel),
                  "required",
                )
              : null}
            {missingRecommendedFields.length
              ? renderPendingGroup(
                  "Recomendados pendientes",
                  missingRecommendedFields.map(getFieldLabel),
                  "recommended",
                )
              : null}
            {publicationErrors.length
              ? renderPendingGroup("Observaciones de publicación", publicationErrors, "error")
              : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground md:max-[1199px]:col-start-2 md:max-[1199px]:row-start-1">
            Todos los campos de publicación están completos.
          </p>
        )
      ) : null}
      {renderPublishCheckbox("max-md:hidden")}
    </section>
  );

  const saveProfileButton = !isPasswordTabActive ? (
    <Button
      type="submit"
      size="sm"
      className="h-8 px-3 text-xs md:h-10 md:px-5 md:text-sm"
      disabled={isWorking}
      form={PROFILE_FORM_ID}
    >
      {isSubmitting ? "Guardando..." : "Guardar perfil público"}
    </Button>
  ) : null;

  // One stack for every section: the panel renders it whatever chip is
  // active, so React keeps the same subtree (and the password panel's state)
  // across section changes. Below 768px every wrapper is `display: contents`
  // and only the active section paints, exactly as before. From 768px up it is
  // a two-region grid: the institutional column (identity, publication,
  // `isPublic`) and the editing column (single-open rows, then Guardar). From
  // 1200px the regions sit side by side (~1/3 + ~2/3); between 768px and 1199px
  // the institutional band stacks above the editor.
  const profileStack = (
    <div
      data-clinic-profile-stack="true"
      className="contents md:grid md:min-h-0 md:w-full md:flex-1 md:max-[1199px]:grid-cols-1 md:max-[1199px]:grid-rows-[auto_minmax(0,1fr)] md:max-[1199px]:gap-3 min-[1200px]:grid-cols-[minmax(17rem,1fr)_minmax(0,2fr)] min-[1200px]:grid-rows-1 min-[1200px]:gap-5"
    >
      <div
        data-clinic-profile-institutional="true"
        className="contents md:min-h-0 md:min-w-0 md:rounded-xl md:bg-vetneb-surface-muted/70 md:p-4 md:max-[1199px]:grid md:max-[1199px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)] md:max-[1199px]:content-start md:max-[1199px]:gap-4 min-[1200px]:flex min-[1200px]:flex-col min-[1200px]:gap-3"
      >
        {statusTab}
        {publicationPanel}
      </div>
      <div
        data-clinic-profile-editing="true"
        className="contents md:flex md:min-h-0 md:min-w-0 md:flex-col md:gap-1"
      >
        <form id={PROFILE_FORM_ID} className="contents" onSubmit={handleSubmit}>
          {renderSectionToggle("datos")}
          {renderSection("datos", detailsTab)}
          {renderSectionToggle("contacto")}
          {renderSection("contacto", contactTab)}
          {renderSectionToggle("contenido")}
          {renderSection("contenido", contentTab)}
        </form>
        {renderSectionToggle(PASSWORD_TAB_ID)}
        {renderSection(
          PASSWORD_TAB_ID,
          <>
            {/* C25 F-T6: below 768px the chip may still truncate this label
                (narrower than 412px) and the panel's own heading is the generic security
                title, so the section's full name paints here; the tab already
                carries it as its accessible name. */}
            <p
              aria-hidden="true"
              data-clinic-profile-section-name={PASSWORD_TAB_ID}
              className="shrink-0 px-1 pb-1.5 text-xs font-semibold text-vetneb-ink md:hidden"
            >
              {PROFILE_SECTION_LABELS[PASSWORD_TAB_ID]}
            </p>
            <PasswordChangePanel variant="clinic" density="compact" embeddedFromMd />
          </>,
          true,
        )}
        <div
          data-clinic-profile-desktop-actions="true"
          className="hidden md:mt-auto md:flex md:min-h-12 md:shrink-0 md:items-center md:justify-end md:gap-2 md:border-t md:border-vetneb-line/70 md:pt-2"
        >
          {saveProfileButton}
        </div>
      </div>
    </div>
  );

  const hasProfileLoadState = Boolean(profileLoadErrorMessage) || isLoading;

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
      chipSizing="content"
      activeId={activeTabId}
      onActiveIdChange={setActiveTabId}
      header={
        <>
          {/* Below 768px only: the publication badge and "Guardar perfil
              público" lead the card. From 768px up the same pair closes the
              section stack instead, and the summary run is retired. */}
          <div
            data-clinic-profile-toolbar="true"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 p-1.5 md:hidden"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {publicationBadge}
              {saveProfileButton}
            </div>
          </div>
          {/* CMP-10 (DIF-034) — always-rendered subtitle slot, mirroring
              AdminSessionsReadOnlyCard's header subtitle: loading/error text
              swaps in place of the default state, so the row never
              appears/disappears and the tabs below it never shift. From 768px
              up only the loading and error states paint: the completion
              summary is retired there. */}
          <div
            data-dashboard-band="true"
            className={cn(
              "flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 px-2.5 py-1.5 text-xs",
              profileLoadErrorMessage ? "text-destructive" : "text-muted-foreground",
              !hasProfileLoadState && "md:hidden",
            )}
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
      sections={PROFILE_SECTIONS.map((section) => ({
        ...section,
        content: profileStack,
      }))}
      // From 768px up the avatar stays operable with "Cambiar contraseña"
      // open, so its feedback must still reach the user there: the footer
      // mounts in that section only while a message exists (no empty band),
      // and only from 768px up — below it the avatar is not on screen and the
      // password chip keeps its previous footer-less layout.
      footer={
        !isPasswordTabActive || errorMessage || statusMessage ? (
          <div
            data-clinic-profile-footer="true"
            className={cn(
              "flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-t border-vetneb-line/65 pt-2 text-xs",
              !errorMessage && !statusMessage && "md:hidden",
              isPasswordTabActive && "max-md:hidden",
            )}
          >
            {errorMessage ? (
              <p className="clinical-alert-error px-3 py-1.5" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {statusMessage ? (
              <p className="clinical-alert-success px-3 py-1.5" role="status">
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
