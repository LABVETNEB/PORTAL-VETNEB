var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) =>
  function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
  };
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activeSessions: () => activeSessions,
  clinicUsers: () => clinicUsers,
  clinics: () => clinics,
  reports: () => reports,
  users: () => users,
});
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
var users, clinics, clinicUsers, reports, activeSessions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      /**
       * Surrogate primary key. Auto-incremented numeric value managed by the database.
       * Use this for relations between tables.
       */
      id: int("id").autoincrement().primaryKey(),
      /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
    });
    clinics = mysqlTable("clinics", {
      id: int("id").autoincrement().primaryKey(),
      clinicId: varchar("clinic_id", { length: 50 }).notNull().unique(),
      name: varchar("name", { length: 255 }).notNull(),
      driveFolderId: varchar("drive_folder_id", { length: 255 }),
      status: mysqlEnum("status", ["active", "inactive"])
        .default("active")
        .notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    });
    clinicUsers = mysqlTable("clinic_users", {
      id: int("id").autoincrement().primaryKey(),
      clinicId: int("clinic_id").notNull(),
      username: varchar("username", { length: 100 }).notNull().unique(),
      passwordHash: varchar("password_hash", { length: 255 }).notNull(),
      authProId: varchar("auth_pro_id", { length: 100 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    });
    reports = mysqlTable("reports", {
      id: int("id").autoincrement().primaryKey(),
      clinicId: int("clinic_id").notNull(),
      uploadDate: timestamp("upload_date"),
      studyType: varchar("study_type", { length: 100 }),
      patientName: varchar("patient_name", { length: 255 }),
      fileName: varchar("file_name", { length: 255 }),
      driveFileId: varchar("drive_file_id", { length: 255 }).unique(),
      previewUrl: text("preview_url"),
      downloadUrl: text("download_url"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    });
    activeSessions = mysqlTable("active_sessions", {
      id: int("id").autoincrement().primaryKey(),
      clinicUserId: int("clinic_user_id").notNull(),
      token: varchar("token", { length: 255 }).notNull().unique(),
      lastAccess: timestamp("last_access"),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    });
  },
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
init_schema();
import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId,
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getClinicByClinicId(clinicId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db
    .select()
    .from(clinics)
    .where(eq(clinics.clinicId, clinicId))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function upsertClinic(clinic) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getClinicByClinicId(clinic.clinicId);
  if (existing) {
    const updated = await db
      .update(clinics)
      .set({
        name: clinic.name,
        driveFolderId: clinic.driveFolderId,
        status: clinic.status || "active",
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq(clinics.clinicId, clinic.clinicId));
    return await getClinicByClinicId(clinic.clinicId);
  } else {
    await db.insert(clinics).values({
      clinicId: clinic.clinicId,
      name: clinic.name,
      driveFolderId: clinic.driveFolderId,
      status: clinic.status || "active",
    });
    return await getClinicByClinicId(clinic.clinicId);
  }
}
async function getClinicUserByUsername(username) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getClinicUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createClinicUser(user) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clinicUsers).values(user);
  return await getClinicUserById(Number(result[0].insertId));
}
async function upsertClinicUser(user) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getClinicUserByUsername(user.username);
  if (existing) {
    await db
      .update(clinicUsers)
      .set({
        passwordHash: user.passwordHash,
        authProId: user.authProId,
      })
      .where(eq(clinicUsers.id, existing.id));
    return await getClinicUserById(existing.id);
  } else {
    return await createClinicUser(user);
  }
}
async function getReportsByClinicId(clinicId, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(reports)
    .where(eq(reports.clinicId, clinicId))
    .orderBy(desc(reports.uploadDate))
    .limit(limit)
    .offset(offset);
}
async function searchReports(
  clinicId,
  query,
  studyType,
  limit = 100,
  offset = 0,
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(reports.clinicId, clinicId)];
  if (query) {
    conditions.push(
      sql`MATCH(${reports.patientName}) AGAINST(${query} IN BOOLEAN MODE) OR ${reports.fileName} LIKE ${`%${query}%`}`,
    );
  }
  if (studyType) {
    conditions.push(eq(reports.studyType, studyType));
  }
  return await db
    .select()
    .from(reports)
    .where(and(...conditions))
    .orderBy(desc(reports.uploadDate))
    .limit(limit)
    .offset(offset);
}
async function upsertReport(report) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!report.driveFileId) {
    throw new Error("driveFileId is required for upsert");
  }
  const existing = await db
    .select()
    .from(reports)
    .where(eq(reports.driveFileId, report.driveFileId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(reports)
      .set({
        uploadDate: report.uploadDate,
        studyType: report.studyType,
        patientName: report.patientName,
        fileName: report.fileName,
        previewUrl: report.previewUrl,
        downloadUrl: report.downloadUrl,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq(reports.driveFileId, report.driveFileId));
    const updated = await db
      .select()
      .from(reports)
      .where(eq(reports.driveFileId, report.driveFileId))
      .limit(1);
    return updated[0];
  } else {
    await db.insert(reports).values(report);
    const created = await db
      .select()
      .from(reports)
      .where(eq(reports.driveFileId, report.driveFileId))
      .limit(1);
    return created[0];
  }
}
async function getReportById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createActiveSession(session) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(activeSessions).values({
    clinicUserId: session.clinicUserId,
    token: session.token,
    expiresAt: session.expiresAt,
    lastAccess: /* @__PURE__ */ new Date(),
  });
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.token, session.token))
    .limit(1);
  return result[0];
}
async function getActiveSessionByToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.token, token))
    .limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateSessionLastAccess(token) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(activeSessions)
    .set({ lastAccess: /* @__PURE__ */ new Date() })
    .where(eq(activeSessions.token, token));
}
async function getStudyTypes(clinicId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .selectDistinct({ studyType: reports.studyType })
    .from(reports)
    .where(
      and(
        eq(reports.clinicId, clinicId),
        sql`${reports.studyType} IS NOT NULL`,
      ),
    );
  return result.map((r) => r.studyType).filter(Boolean);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable.",
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };
    const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(GET_USER_INFO_PATH, {
      accessToken: token.accessToken,
    });
    return data;
  }
};
var createOAuthHttpClient = () =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(platforms.filter((p) => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null,
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod,
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options,
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload;
      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId,
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload,
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null,
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod,
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date(),
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) =>
  typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase,
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured.",
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured.",
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson,
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),
  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      };
    }),
});

// server/routers.ts
import { z as z2 } from "zod";
import * as crypto from "crypto";
import { TRPCError as TRPCError3 } from "@trpc/server";
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(
        z2.object({
          username: z2.string().min(1),
          password: z2.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const clinicUser = await getClinicUserByUsername(input.username);
          if (!clinicUser) {
            throw new TRPCError3({
              code: "UNAUTHORIZED",
              message: "Usuario o contrase\xF1a inv\xE1lidos",
            });
          }
          const passwordHash = hashPassword(input.password);
          if (clinicUser.passwordHash !== passwordHash) {
            throw new TRPCError3({
              code: "UNAUTHORIZED",
              message: "Usuario o contrase\xF1a inv\xE1lidos",
            });
          }
          const clinic = await getDb().then(async (dbInstance) => {
            if (!dbInstance) throw new Error("Database not available");
            const { clinics: clinics2 } = await Promise.resolve().then(
              () => (init_schema(), schema_exports),
            );
            const { eq: eq2 } = await import("drizzle-orm");
            const result = await dbInstance
              .select()
              .from(clinics2)
              .where(eq2(clinics2.id, clinicUser.clinicId))
              .limit(1);
            return result[0];
          });
          if (!clinic) {
            throw new TRPCError3({
              code: "NOT_FOUND",
              message: "Cl\xEDnica no encontrada",
            });
          }
          const token = generateToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
          await createActiveSession({
            clinicUserId: clinicUser.id,
            token,
            expiresAt,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, {
            ...cookieOptions,
            maxAge: 24 * 60 * 60 * 1e3,
          });
          return {
            success: true,
            token,
            clinic: {
              id: clinic.id,
              name: clinic.name,
              clinicId: clinic.clinicId,
            },
          };
        } catch (error) {
          if (error instanceof TRPCError3) throw error;
          console.error("[Auth] Login error:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al iniciar sesi\xF3n",
          });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      };
    }),
  }),
  reports: router({
    list: protectedProcedure
      .input(
        z2.object({
          limit: z2.number().default(50),
          offset: z2.number().default(0),
        }),
      )
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError3({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }
          const reportsList = await getReportsByClinicId(
            ctx.clinicId,
            input.limit,
            input.offset,
          );
          return {
            reports: reportsList,
            count: reportsList.length,
          };
        } catch (error) {
          console.error("[Reports] List error:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al obtener informes",
          });
        }
      }),
    search: protectedProcedure
      .input(
        z2.object({
          query: z2.string().optional(),
          studyType: z2.string().optional(),
          limit: z2.number().default(50),
          offset: z2.number().default(0),
        }),
      )
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError3({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }
          const results = await searchReports(
            ctx.clinicId,
            input.query || "",
            input.studyType,
            input.limit,
            input.offset,
          );
          return {
            reports: results,
            count: results.length,
          };
        } catch (error) {
          console.error("[Reports] Search error:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al buscar informes",
          });
        }
      }),
    getStudyTypes: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.clinicId) {
          throw new TRPCError3({
            code: "UNAUTHORIZED",
            message: "No clinic associated with session",
          });
        }
        const studyTypes = await getStudyTypes(ctx.clinicId);
        return studyTypes;
      } catch (error) {
        console.error("[Reports] getStudyTypes error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al obtener tipos de estudio",
        });
      }
    }),
    getDownloadUrl: protectedProcedure
      .input(z2.object({ reportId: z2.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError3({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }
          const report = await getReportById(input.reportId);
          if (!report) {
            throw new TRPCError3({
              code: "NOT_FOUND",
              message: "Informe no encontrado",
            });
          }
          if (report.clinicId !== ctx.clinicId) {
            throw new TRPCError3({
              code: "FORBIDDEN",
              message: "No tienes acceso a este informe",
            });
          }
          if (!report.downloadUrl && report.driveFileId) {
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${report.driveFileId}`;
            return { downloadUrl };
          }
          return { downloadUrl: report.downloadUrl || "" };
        } catch (error) {
          if (error instanceof TRPCError3) throw error;
          console.error("[Reports] getDownloadUrl error:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al obtener URL de descarga",
          });
        }
      }),
  }),
  sync: router({
    syncFromSheets: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return {
          success: true,
          message: "Sincronizaci\xF3n completada",
        };
      } catch (error) {
        console.error("[Sync] syncFromSheets error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al sincronizar datos",
        });
      }
    }),
    uploadData: publicProcedure
      .input(
        z2.object({
          clinics: z2.array(
            z2.object({
              clinicId: z2.string(),
              name: z2.string(),
              driveFolderId: z2.string().optional(),
            }),
          ),
          clinicUsers: z2.array(
            z2.object({
              clinicId: z2.string(),
              username: z2.string(),
              password: z2.string(),
              authProId: z2.string().optional(),
            }),
          ),
          reports: z2.array(
            z2.object({
              clinicId: z2.string(),
              uploadDate: z2.string().optional(),
              studyType: z2.string().optional(),
              patientName: z2.string().optional(),
              fileName: z2.string().optional(),
              driveFileId: z2.string(),
              previewUrl: z2.string().optional(),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const results = {
            clinicsCreated: 0,
            usersCreated: 0,
            reportsCreated: 0,
            errors: [],
          };
          for (const clinic of input.clinics) {
            try {
              await upsertClinic({
                clinicId: clinic.clinicId,
                name: clinic.name,
                driveFolderId: clinic.driveFolderId,
              });
              results.clinicsCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear cl\xEDnica ${clinic.clinicId}: ${error}`,
              );
            }
          }
          for (const user of input.clinicUsers) {
            try {
              const clinic = await getClinicByClinicId(user.clinicId);
              if (!clinic) {
                results.errors.push(
                  `Cl\xEDnica no encontrada: ${user.clinicId}`,
                );
                continue;
              }
              const passwordHash = hashPassword(user.password);
              await upsertClinicUser({
                clinicId: clinic.id,
                username: user.username,
                passwordHash,
                authProId: user.authProId,
              });
              results.usersCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear usuario ${user.username}: ${error}`,
              );
            }
          }
          for (const report of input.reports) {
            try {
              const clinic = await getClinicByClinicId(report.clinicId);
              if (!clinic) {
                results.errors.push(
                  `Cl\xEDnica no encontrada: ${report.clinicId}`,
                );
                continue;
              }
              await upsertReport({
                clinicId: clinic.id,
                uploadDate: report.uploadDate
                  ? new Date(report.uploadDate)
                  : void 0,
                studyType: report.studyType,
                patientName: report.patientName,
                fileName: report.fileName,
                driveFileId: report.driveFileId,
                previewUrl: report.previewUrl,
                downloadUrl: `https://drive.google.com/uc?export=download&id=${report.driveFileId}`,
              });
              results.reportsCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear informe ${report.driveFileId}: ${error}`,
              );
            }
          }
          return results;
        } catch (error) {
          console.error("[Sync] uploadData error:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al cargar datos",
          });
        }
      }),
  }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  let clinicId;
  let clinicUserId;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  try {
    const cookies = opts.req.headers.cookie || "";
    const cookieMatch = cookies
      .split(";")
      .find((c) => c.trim().startsWith(COOKIE_NAME));
    if (cookieMatch) {
      const token = cookieMatch.split("=")[1]?.trim();
      if (token) {
        const session = await getActiveSessionByToken(token);
        if (session) {
          await updateSessionLastAccess(token);
          const clinicUser = await getClinicUserById(session.clinicUserId);
          if (clinicUser) {
            clinicId = clinicUser.clinicId;
            clinicUserId = clinicUser.id;
          }
        }
      }
    }
  } catch (error) {}
  return {
    req: opts.req,
    res: opts.res,
    user,
    clinicId,
    clinicUserId,
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";
var plugins = [
  react(),
  tailwindcss(),
  // jsxLocPlugin(), // ❌ mantener comentado
];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html",
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path2.resolve(import.meta.dirname, "../..", "dist", "public")
      : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
