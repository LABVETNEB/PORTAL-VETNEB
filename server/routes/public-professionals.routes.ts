import { Router } from "express";

import {
  getPublicProfessionalByClinicId,
  searchPublicProfessionals,
} from "../db-public-professionals";
import { createPublicProfessionalsSearchRateLimit } from "../lib/public-professionals-rate-limit";
import { createSignedStorageUrl } from "../lib/supabase";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const publicProfessionalsSearchRateLimit =
  createPublicProfessionalsSearchRateLimit();

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parsePositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return typeof max === "number" ? Math.min(parsed, max) : parsed;
}

function parseOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseClinicId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function serializeProfessional(row: {
  clinicId: number;
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  updatedAt: Date;
  profileQualityScore?: number;
  rank?: number;
  similarity?: number;
  score?: number;
}) {
  const avatarUrl = row.avatarStoragePath
    ? await createSignedStorageUrl(row.avatarStoragePath)
    : null;

  return {
    clinicId: row.clinicId,
    displayName: row.displayName,
    avatarUrl,
    specialtyText: row.specialtyText,
    servicesText: row.servicesText,
    email: row.email,
    phone: row.phone,
    locality: row.locality,
    country: row.country,
    aboutText: row.aboutText,
    updatedAt: row.updatedAt,
    relevance: {
      rank: row.rank ?? 0,
      similarity: row.similarity ?? 0,
      score: row.score ?? 0,
    },
    profileQualityScore: row.profileQualityScore ?? null,
  };
}

router.get(
  "/search",
  publicProfessionalsSearchRateLimit,
  asyncHandler(async (req, res) => {
    const query = normalizeText(req.query.q ?? req.query.query);
    const locality = normalizeText(req.query.locality);
    const country = normalizeText(req.query.country);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const offset = parseOffset(req.query.offset, 0);

    const result = await searchPublicProfessionals({
      query,
      locality,
      country,
      limit,
      offset,
    });

    const professionals = await Promise.all(
      result.rows.map((row) => serializeProfessional(row)),
    );

    return res.json({
      success: true,
      count: professionals.length,
      total: result.total,
      professionals,
      filters: {
        query: query ?? null,
        locality: locality ?? null,
        country: country ?? null,
      },
      pagination: {
        limit: result.limit,
        offset: result.offset,
      },
    });
  }),
);

router.get(
  "/:clinicId",
  asyncHandler(async (req, res) => {
    const clinicId = parseClinicId(req.params.clinicId);

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: "ID de clinica invalido",
      });
    }

    const professional = await getPublicProfessionalByClinicId(clinicId);

    if (!professional) {
      return res.status(404).json({
        success: false,
        error: "Perfil publico no encontrado",
      });
    }

    return res.json({
      success: true,
      professional: await serializeProfessional(professional),
    });
  }),
);

export default router;
