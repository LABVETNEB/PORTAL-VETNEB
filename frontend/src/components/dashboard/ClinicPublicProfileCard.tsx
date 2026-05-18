"use client";

import { FormEvent, type ChangeEvent, useEffect, useRef, useState } from "react";
import NextImage from "next/image";

import { Badge } from "@/components/ui/badge";
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
  getClinicPublicProfile,
  updateClinicPublicProfile,
  uploadClinicPublicProfileAvatar,
  deleteClinicPublicProfileAvatar,
  type ClinicPublicProfile,
  type ClinicPublicProfileUpdatePayload,
} from "@/lib/api";

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarDeleting, setIsAvatarDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    try {
      const snapshot = await getClinicPublicProfile();

      setProfile(snapshot.profile);
      setFormState(toFormState(snapshot.profile));
    } catch (error) {
      setErrorMessage(
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

  return (
    <Card id="clinic-public-profile" className="dashboard-surface">
      <CardHeader className="border-b border-vetneb-line/70">
        <CardTitle className="text-base">Perfil para banco de especialidades</CardTitle>
        <CardDescription>
          Complete y publique el perfil de la clínica para aparecer en el banco
          público de especialidades y profesionales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Estado</p>
            <Badge className="mt-2" variant={getPublicationVariant(profile)}>
              {getPublicationLabel(profile)}
            </Badge>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Calidad</p>
            <p className="mt-1 text-2xl font-bold text-vetneb-ink">
              {publication ? publication.qualityScore : "—"}
              <span className="text-sm font-medium text-muted-foreground">
                /{publication?.minimumQualityScore ?? 75}
              </span>
            </p>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Campos obligatorios</p>
            <p className="mt-1 text-sm font-semibold text-vetneb-ink">
              {publication?.hasRequiredPublicFields ? "Completos" : "Pendientes"}
            </p>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Banco público</p>
            <p className="mt-1 text-sm font-semibold text-vetneb-ink">
              {publication?.isSearchEligible ? "Visible" : "No visible"}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="clinical-muted-band space-y-3 rounded-lg px-4 py-3">
            <label htmlFor="clinic-profile-avatar" className="field-label">
              Avatar o logo
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-vetneb-line/70 bg-white">
                {profileAvatarSrc ? (
                  <NextImage
                    src={profileAvatarSrc}
                    alt="Avatar o logo de la clínica"
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm font-semibold text-vetneb-ink">
                    {profileInitials}
                  </span>
                )}
              </div>
              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground">
                  Imagen cuadrada recomendada. JPG, PNG o WebP. Máximo 512 KB.
                </p>
                <p className="text-xs text-muted-foreground">
                  Dimensiones permitidas: 160 x 160 px a 1024 x 1024 px.
                </p>
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
                    className="public-cta-outline"
                    onClick={handleAvatarUpload}
                    disabled={!avatarFile || isWorking}
                  >
                    {isAvatarUploading ? "Cargando imagen..." : "Guardar avatar o logo"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="public-cta-outline"
                    onClick={handleAvatarRemove}
                    disabled={!profile?.avatarUrl || isWorking}
                  >
                    {isAvatarDeleting ? "Quitando imagen..." : "Quitar imagen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

          <div>
            <label htmlFor="clinic-profile-services" className="field-label">
              Servicios
            </label>
            <textarea
              id="clinic-profile-services"
              name="servicesText"
              className="field-textarea min-h-24"
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
              className="field-textarea min-h-28"
              value={formState.aboutText}
              onChange={(event) => updateField("aboutText", event.target.value)}
              disabled={isWorking}
              placeholder="Complete trayectoria, foco profesional y datos relevantes para el banco de especialidades."
            />
          </div>

          <label className="clinical-muted-band flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-vetneb-navy">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.isPublic}
              onChange={(event) => updateField("isPublic", event.target.checked)}
              disabled={isWorking}
            />
            <span>
              Publicar perfil cuando cumpla los requisitos para aparecer en el
              banco de especialidades.
            </span>
          </label>

          {missingRequiredFields.length ? (
            <div className="clinical-alert-warning px-3 py-2">
              <p className="font-semibold">Campos obligatorios pendientes:</p>
              <p>{missingRequiredFields.map(getFieldLabel).join(", ")}</p>
            </div>
          ) : null}

          {missingRecommendedFields.length ? (
            <div className="clinical-alert-info px-3 py-2">
              <p className="font-semibold">Recomendados para mejorar calidad:</p>
              <p>{missingRecommendedFields.map(getFieldLabel).join(", ")}</p>
            </div>
          ) : null}

          {publicationErrors.length ? (
            <div className="clinical-alert-error px-3 py-2">
              {publicationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <p
              className="clinical-alert-error px-3 py-2"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {statusMessage ? (
            <p className="clinical-alert-success px-3 py-2">
              {statusMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={isWorking}>
            {isSubmitting ? "Guardando perfil..." : "Guardar perfil público"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
