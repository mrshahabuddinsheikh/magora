import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import addFormats from "ajv-formats";
import { config, store } from "./config";
import { ApiError } from "./lib/errors";
import { catalogRoutes } from "./modules/catalog";
import { cartRoutes } from "./modules/cart";
import { orderRoutes } from "./modules/orders";
import { accountRoutes } from "./modules/account";
import { adminRoutes } from "./modules/admin";
import { adminEngageRoutes, engageRoutes } from "./modules/engage";
import { deskRoutes } from "./modules/desk";
import { reviewInviteRoutes } from "./modules/reviewInvite";
import { trackingRoutes } from "./modules/tracking";
import { returnRoutes } from "./modules/returns";
import { uploadRoutes } from "./modules/uploads";
import { leadsRoutes } from "./modules/leads";
import { pushRoutes } from "./modules/push";
import { reelRoutes } from "./modules/reels";
import { databaseBackupRoutes } from "./modules/databaseBackup";
import { marketingRoutes } from "./modules/marketing";
import { registerBlueTeamSecurity } from "./lib/security";
import multipart from "@fastify/multipart";

export async function buildApp() {
  const app = Fastify({
    logger: config.isProd ? { level: "info" } : { level: "warn" },
    trustProxy: true,
    ajv: {
      customOptions: { removeAdditional: "all", coerceTypes: true, useDefaults: true },
      plugins: [addFormats as never],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors, {
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  });
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

  // Blue Team WAF, Threat Detection & Hardened Security Headers
  registerBlueTeamSecurity(app);

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${store.name} Store API`,
        version: "1.0.0",
        description:
          "Versioned REST API used by the website and the mobile apps (Flutter / React Native — Android, iOS, Huawei AppGallery).\n\n" +
          "• All responses are `{ data, meta? }`; errors are `{ error: { code, message } }`.\n" +
          "• Auth: `Authorization: Bearer <token>` from /auth/login.\n" +
          "• Guest cart: POST /carts once, keep the returned id on the device.",
      },
      servers: [{ url: "/" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    },
  });
  // API docs page: always in development, in production only when API_DOCS=true
  if (!config.isProd || process.env.API_DOCS === "true") await app.register(swaggerUi, { routePrefix: "/docs" });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown; code?: string }, req, reply) => {
    if (err instanceof ApiError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.validation) {
      return reply.code(400).send({ error: { code: "validation_error", message: err.message, details: err.validation } });
    }
    if (err.statusCode === 429) {
      return reply.code(429).send({ error: { code: "rate_limited", message: "Too many requests, please slow down" } });
    }
    req.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: { code: "server_error", message: err.message, stack: err.stack } });
  });

  app.get("/health", { schema: { hide: true } }, async () => ({ ok: true }));
  app.post("/internal/restart", { schema: { hide: true } }, async (_req, reply) => {
    setTimeout(() => process.exit(0), 100);
    return reply.send({ ok: true });
  });

  // photo uploads (POST /api/v1/uploads) + static /uploads/*
  await app.register(uploadRoutes);

  // Every route lives under /api/v1 — a future v2 can run side-by-side without breaking old app versions
  await app.register(
    async (v1) => {
      await v1.register(catalogRoutes);
      await v1.register(cartRoutes);
      await v1.register(orderRoutes);
      await v1.register(accountRoutes);
      await v1.register(trackingRoutes);
      await v1.register(returnRoutes);
      await v1.register(engageRoutes);
      await v1.register(leadsRoutes);
      await v1.register(pushRoutes);
      await v1.register(reelRoutes);
      await v1.register(reviewInviteRoutes);
      await v1.register(adminRoutes, { prefix: "/admin" });
      await v1.register(adminEngageRoutes, { prefix: "/admin" });
      await v1.register(deskRoutes, { prefix: "/admin" });
      await v1.register(databaseBackupRoutes, { prefix: "/admin" });
      await v1.register(marketingRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
