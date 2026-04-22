import { Router } from "express";
import multer from "multer";

import { getClinicById } from "../db";
import {
  buildClinicPublicProfileResponse,
  evaluateClinicPublicProfilePublication,
  getClinicPublicProfileByClinicId,
  MIN_PUBLIC_PROFILE_QUALITY_SCORE,
  patchClinicPublicProfile,
  removeClinicPublicAvatar,
  syncClinicPublicSearch,
  type UpsertClinicPublicProfileInput,
} from "../db-public-professionals";
import { ENV } from "../lib/env";
import {
  createSignedStorageUrl,
  deleteStorageObject,
  uploadClinicAvatar,
} from "../lib/supabase";
import { requireClinicManagementPermission } from "../middlewares/clinic-permissions";
import { requireAuth } from "../middlewares/auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(ENV.maxUploadFileSizeMb, 5) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Tipo de avatar no permitido"));
      return;
    }

    cb(null, true);
  },
});

const MAX_DISPLAY_NAME = 255;
const MAX_EMAIL = 255;
const MAX_PHONE = 50;
const MAX_LOCALITY = 255;
const MAX_COUNTRY = 255;
const MAX_SPECIALTY = 500;
const MAX_ABOUT = 5000;
const MAX_SERVICES = 5000;

function normalizeNullableString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "sí"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function buildPatchInput(body: Record<string, unknown> | undefined): UpsertClinicPublicProfileInput {
  return {
    displayName: normalizeNullableString(body?.displayName, MAX_DISPLAY_NAME),
    aboutText: normalizeNullableString(body?.aboutText, MAX_ABOUT),
    specialtyText: normalizeNullableString(body?.specialtyText, MAX_SPECIALTY),
    servicesText: normalizeNullableString(body?.servicesText, MAX_SERVICES),
    email: normalizeNullableString(body?.email, MAX_EMAIL),
    phone: normalizeNullableString(body?.phone, MAX_PHONE),
    locality: normalizeNullableString(body?.locality, MAX_LOCALITY),
    country: normalizeNullableString(body?.country, MAX_COUNTRY),
    isPublic: parseOptionalBoolean(body?.isPublic),
  };
}

router.use(requireTrustedOrigin);
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const clinicId = req.auth!.clinicId;
    const data = await getClinicPublicProfileByClinicId(clinicId);

    if (!data?.clinic) {
      return res.status(404).json({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const avatarUrl = data.profile?.avatarStoragePath
      ? await createSignedStorageUrl(data.profile.avatarStoragePath)
      : null;

    return res.json({
      success: true,
      profile: buildClinicPublicProfileResponse({
        clinic: data.clinic,
        profile: data.profile,
        avatarUrl,
      }),
      search: data.search
        ? {
            clinicId: data.search.clinicId,
            isPublic: data.search.isPublic,
            hasRequiredPublicFields: data.search.hasRequiredPublicFields,
            isSearchEligible: data.search.isSearchEligible,
            profileQualityScore: data.search.profileQualityScore,
            updatedAt: data.search.updatedAt,
            searchText: data.search.searchText,
          }
        : null,
    });
  }),
);

router.patch(
  "/",
  requireClinicManagementPermission,
  asyncHandler(async (req, res) => {
    const clinicId = req.auth!.clinicId;
    const clinic = await getClinicById(clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const currentData = await getClinicPublicProfileByClinicId(clinicId);
    const patchInput = buildPatchInput(req.body);
    const currentProfile = currentData?.profile ?? null;

    const publicationPreview = evaluateClinicPublicProfilePublication({
      clinic,
      profile: {
        displayName: patchInput.displayName ?? currentProfile?.displayName ?? null,
        avatarStoragePath:
          patchInput.avatarStoragePath ?? currentProfile?.avatarStoragePath ?? null,
        aboutText: patchInput.aboutText ?? currentProfile?.aboutText ?? null,
        specialtyText: patchInput.specialtyText ?? currentProfile?.specialtyText ?? null,
        servicesText: patchInput.servicesText ?? currentProfile?.servicesText ?? null,
        email: patchInput.email ?? currentProfile?.email ?? null,
        phone: patchInput.phone ?? currentProfile?.phone ?? null,
        locality: patchInput.locality ?? currentProfile?.locality ?? null,
        country: patchInput.country ?? currentProfile?.country ?? null,
        isPublic: patchInput.isPublic ?? currentProfile?.isPublic ?? false,
      },
    });

    if (publicationPreview.isPublic && publicationPreview.publicationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: publicationPreview.publicationErrors[0],
        publication: {
          hasRequiredPublicFields: publicationPreview.hasRequiredPublicFields,
          hasQualitySupplement: publicationPreview.hasQualitySupplement,
          qualityScore: publicationPreview.qualityScore,
          minimumQualityScore: MIN_PUBLIC_PROFILE_QUALITY_SCORE,
          isSearchEligible: publicationPreview.isSearchEligible,
          missingRequiredFields: publicationPreview.missingRequiredFields,
          missingRecommendedFields: publicationPreview.missingRecommendedFields,
          publicationErrors: publicationPreview.publicationErrors,
        },
      });
    }

    const profile = await patchClinicPublicProfile(clinicId, patchInput);
    const search = await syncClinicPublicSearch(clinicId);
    const avatarUrl = profile.avatarStoragePath
      ? await createSignedStorageUrl(profile.avatarStoragePath)
      : null;

    return res.json({
      success: true,
      message: "Perfil publico actualizado correctamente",
      profile: buildClinicPublicProfileResponse({
        clinic,
        profile,
        avatarUrl,
      }),
      search,
    });
  }),
);

router.post(
  "/avatar",
  requireClinicManagementPermission,
  upload.single("avatar"),
  asyncHandler(async (req, res) => {
    const clinicId = req.auth!.clinicId;
    const clinic = await getClinicById(clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Avatar obligatorio",
      });
    }

    const currentData = await getClinicPublicProfileByClinicId(clinicId);
    const previousAvatarStoragePath = currentData?.profile?.avatarStoragePath ?? null;

    const avatarStoragePath = await uploadClinicAvatar({
      clinicId,
      file: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    const profile = await patchClinicPublicProfile(clinicId, {
      avatarStoragePath,
    });

    const search = await syncClinicPublicSearch(clinicId);

    if (previousAvatarStoragePath && previousAvatarStoragePath !== avatarStoragePath) {
      await deleteStorageObject(previousAvatarStoragePath);
    }

    const avatarUrl = await createSignedStorageUrl(avatarStoragePath);

    return res.status(201).json({
      success: true,
      message: "Avatar actualizado correctamente",
      profile: buildClinicPublicProfileResponse({
        clinic,
        profile,
        avatarUrl,
      }),
      search,
    });
  }),
);

router.delete(
  "/avatar",
  requireClinicManagementPermission,
  asyncHandler(async (req, res) => {
    const clinicId = req.auth!.clinicId;
    const clinic = await getClinicById(clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const currentData = await getClinicPublicProfileByClinicId(clinicId);

    if (!currentData?.profile?.avatarStoragePath) {
      return res.status(404).json({
        success: false,
        error: "La clinica no tiene avatar cargado",
      });
    }

    const publicationPreview = evaluateClinicPublicProfilePublication({
      clinic,
      profile: {
        displayName: currentData.profile.displayName,
        avatarStoragePath: null,
        aboutText: currentData.profile.aboutText,
        specialtyText: currentData.profile.specialtyText,
        servicesText: currentData.profile.servicesText,
        email: currentData.profile.email,
        phone: currentData.profile.phone,
        locality: currentData.profile.locality,
        country: currentData.profile.country,
        isPublic: currentData.profile.isPublic,
      },
    });

    if (publicationPreview.isPublic && publicationPreview.publicationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "No se puede eliminar el avatar porque el perfil público dejaría de cumplir la calidad mínima.",
        publication: {
          hasRequiredPublicFields: publicationPreview.hasRequiredPublicFields,
          hasQualitySupplement: publicationPreview.hasQualitySupplement,
          qualityScore: publicationPreview.qualityScore,
          minimumQualityScore: MIN_PUBLIC_PROFILE_QUALITY_SCORE,
          isSearchEligible: publicationPreview.isSearchEligible,
          missingRequiredFields: publicationPreview.missingRequiredFields,
          missingRecommendedFields: publicationPreview.missingRecommendedFields,
          publicationErrors: publicationPreview.publicationErrors,
        },
      });
    }

    const result = await removeClinicPublicAvatar(clinicId);
    const search = await syncClinicPublicSearch(clinicId);

    if (result.previousAvatarStoragePath) {
      await deleteStorageObject(result.previousAvatarStoragePath);
    }

    return res.json({
      success: true,
      message: "Avatar eliminado correctamente",
      profile: buildClinicPublicProfileResponse({
        clinic,
        profile: result.profile,
        avatarUrl: null,
      }),
      search,
    });
  }),
);

export default router;
