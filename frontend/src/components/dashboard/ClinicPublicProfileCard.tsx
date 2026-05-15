"use client";

import { FormEvent, useEffect, useState } from "react";

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
  locality: "",
  country: "",
  isPublic: false,
};

const PUBLICATION_FIELD_LABELS: Record<string, string> = {
  displayName: "Nombre visible",
  specialtyText: "Especialidad",
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

function toFormState(profile: ClinicPublicProfile): ProfileFormState {
  return {
    displayName: profile.displayName ?? "",
    specialtyText: profile.specialtyText ?? "",
    servicesText: profile.servicesText ?? "",
    aboutText: profile.aboutText ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  }, []);

  function updateField<K extends keyof ProfileFormState>(
    field: K,
    value: ProfileFormState[K],
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
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

  return (
    <Card id="clinic-public-profile">
      <CardHeader>
        <CardTitle className="text-base">Perfil para banco de especialidades</CardTitle>
        <CardDescription>
          Complete y publique el perfil de la clínica para aparecer en el banco
          público de especialidades y profesionales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="surface-soft">
            <p className="text-xs text-gray-400">Estado</p>
            <Badge className="mt-2" variant={getPublicationVariant(profile)}>
              {getPublicationLabel(profile)}
            </Badge>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-gray-400">Calidad</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {publication ? publication.qualityScore : "—"}
              <span className="text-sm font-medium text-gray-400">
                /{publication?.minimumQualityScore ?? 75}
              </span>
            </p>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-gray-400">Campos obligatorios</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {publication?.hasRequiredPublicFields ? "Completos" : "Pendientes"}
            </p>
          </div>
          <div className="surface-soft">
            <p className="text-xs text-gray-400">Banco público</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {publication?.isSearchEligible ? "Visible" : "No visible"}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
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
                disabled={isLoading || isSubmitting}
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
                disabled={isLoading || isSubmitting}
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
                disabled={isLoading || isSubmitting}
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
                disabled={isLoading || isSubmitting}
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
                disabled={isLoading || isSubmitting}
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
                disabled={isLoading || isSubmitting}
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
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formState.servicesText}
              onChange={(event) => updateField("servicesText", event.target.value)}
              disabled={isLoading || isSubmitting}
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
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formState.aboutText}
              onChange={(event) => updateField("aboutText", event.target.value)}
              disabled={isLoading || isSubmitting}
              placeholder="Complete trayectoria, foco profesional y datos relevantes para el banco de especialidades."
            />
          </div>

          <label className="clinical-muted-band flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-vetneb-navy">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.isPublic}
              onChange={(event) => updateField("isPublic", event.target.checked)}
              disabled={isLoading || isSubmitting}
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

          <Button type="submit" disabled={isLoading || isSubmitting}>
            {isSubmitting ? "Guardando perfil..." : "Guardar perfil público"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
