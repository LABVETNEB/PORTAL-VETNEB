import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import postgres from "postgres";

import {
  buildLoginRateLimitKey,
  hashLoginRateLimitIdentifier,
  hashLoginRateLimitIpAddress,
  LOGIN_RATE_LIMIT_KEY_VERSION,
  type LoginRateLimitSurface,
} from "../../server/lib/login-rate-limit.ts";
import { hashRateLimitKey } from "../../server/lib/rate-limit-store.ts";

type CliOptions = {
  surface: LoginRateLimitSurface;
  identifier: string;
  ipAddress: string | null;
  force: boolean;
};

const VALID_SURFACES = new Set<LoginRateLimitSurface>([
  "admin",
  "clinic",
  "particular",
  "unified",
]);

function printUsage() {
  console.log(
    [
      "Usage:",
      "  pnpm exec tsx scripts/dev/reset-login-rate-limit.ts --surface <surface> --identifier <value> [--ip-address <ip>] [--force]",
      "",
      "Default mode is dry-run. Use --force to delete matching rows.",
    ].join("\n"),
  );
}

function readRequiredValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requiere un valor.`);
  }

  return value;
}

function parseArgs(args: string[]): CliOptions {
  let surface: LoginRateLimitSurface | null = null;
  let identifier = "";
  let ipAddress: string | null = null;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--surface": {
        const value = readRequiredValue(args, index, arg);

        if (!VALID_SURFACES.has(value as LoginRateLimitSurface)) {
          throw new Error(
            `surface invalida. Use: ${Array.from(VALID_SURFACES).join(", ")}`,
          );
        }

        surface = value as LoginRateLimitSurface;
        index += 1;
        break;
      }
      case "--identifier": {
        identifier = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--ip-address": {
        const value = readRequiredValue(args, index, arg).trim();
        ipAddress = value || null;
        index += 1;
        break;
      }
      case "--force": {
        force = true;
        break;
      }
      case "--dry-run": {
        force = false;
        break;
      }
      case "--help":
      case "-h": {
        printUsage();
        process.exit(0);
      }
      default:
        throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  const normalizedIdentifier = identifier.trim();

  if (!surface) {
    throw new Error("--surface es requerido.");
  }

  if (!normalizedIdentifier) {
    throw new Error("--identifier no puede estar vacio.");
  }

  return {
    surface,
    identifier: normalizedIdentifier,
    ipAddress,
    force,
  };
}

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function getDatabaseUrl() {
  const databaseUrl =
    process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Defina SUPABASE_DB_URL o DATABASE_URL para conectar a DB.");
  }

  return databaseUrl;
}

function previewHash(hash: string) {
  return `${hash.slice(0, 12)}...`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  loadEnv();

  const databaseUrl = getDatabaseUrl();
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  const identifierHash = hashLoginRateLimitIdentifier(options.identifier);
  const ipHash = options.ipAddress
    ? hashLoginRateLimitIpAddress(options.ipAddress)
    : null;

  console.log("=== RESET LOGIN RATE LIMIT ===");
  console.log(`Surface        : ${options.surface}`);
  console.log(`Key version    : ${LOGIN_RATE_LIMIT_KEY_VERSION}`);
  console.log(`Identifier hash: ${previewHash(identifierHash)}`);
  console.log(`IP filter      : ${ipHash ? previewHash(ipHash) : "(none)"}`);
  console.log(`Mode           : ${options.force ? "FORCE" : "DRY-RUN"}`);

  try {
    const metadataRows = ipHash
      ? await sql<{
          key_hash: string;
          count: number;
          reset_at: Date;
          ip_hash: string | null;
        }[]>`
          SELECT key_hash, count, reset_at, ip_hash
          FROM login_rate_limits
          WHERE surface = ${options.surface}
            AND identifier_hash = ${identifierHash}
            AND ip_hash = ${ipHash}
          ORDER BY reset_at DESC
        `
      : await sql<{
          key_hash: string;
          count: number;
          reset_at: Date;
          ip_hash: string | null;
        }[]>`
          SELECT key_hash, count, reset_at, ip_hash
          FROM login_rate_limits
          WHERE surface = ${options.surface}
            AND identifier_hash = ${identifierHash}
          ORDER BY reset_at DESC
        `;

    const rows = [...metadataRows];

    if (rows.length === 0 && options.ipAddress) {
      const legacyKeyHash = hashRateLimitKey(
        buildLoginRateLimitKey({
          surface: options.surface,
          identifier: options.identifier,
          ipAddress: options.ipAddress,
        }),
      );
      const legacyRows = await sql<{
        key_hash: string;
        count: number;
        reset_at: Date;
        ip_hash: string | null;
      }[]>`
        SELECT key_hash, count, reset_at, ip_hash
        FROM login_rate_limits
        WHERE key_hash = ${legacyKeyHash}
        ORDER BY reset_at DESC
      `;

      if (legacyRows.length > 0) {
        console.log(
          "Legacy fallback: matched a pre-metadata row by exact IP-derived key hash.",
        );
        rows.push(...legacyRows);
      }
    }

    console.log(`Matched rows   : ${rows.length}`);

    for (const row of rows) {
      console.log(
        [
          `  hash=${previewHash(row.key_hash)}`,
          `count=${row.count}`,
          `reset_at=${row.reset_at.toISOString()}`,
          `ip_hash=${row.ip_hash ? previewHash(row.ip_hash) : "(legacy)"}`,
        ].join(" "),
      );
    }

    if (rows.length === 0) {
      console.log(
        options.ipAddress
          ? "No matching rows found for metadata or exact legacy key."
          : "No metadata rows found. Legacy rows cannot be reset by identifier without an exact IP.",
      );
      return;
    }

    if (!options.force) {
      console.log("Dry-run only. Re-run with --force to delete these rows.");
      return;
    }

    const keyHashes = rows.map((row) => row.key_hash);
    const deletedRows = await sql<{ key_hash: string }[]>`
      DELETE FROM login_rate_limits
      WHERE key_hash IN ${sql(keyHashes)}
      RETURNING key_hash
    `;

    console.log(`Deleted rows   : ${deletedRows.length}`);
    console.log(
      `Delete audit   : ${previewHash(sha256(deletedRows.map((row) => row.key_hash).join(":")))}`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`reset-login-rate-limit failed: ${message}`);
  process.exit(1);
});
