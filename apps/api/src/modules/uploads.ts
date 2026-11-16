import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config";
import { badRequest } from "../lib/errors";
import { requireAdmin } from "../lib/auth";
import { optimizeGlb } from "../lib/glb";

const MAX_MODEL = 60 * 1024 * 1024;

const MAX = 15 * 1024 * 1024;

/** Recognise real image files by their first bytes (never trust the file name / mimetype). */
function sniff(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

/**
 * Shrink a photo for the web: fix phone rotation, max 2400 px (still sharp enough to print a skin),
 * WebP 85 % (keeps transparency), and strip EXIF/GPS. Returns null if it wouldn't get smaller.
 */
async function compressPhoto(buf: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
    return out.length < buf.length ? out : null;
  } catch {
    return null;
  }
}

/**
 * Customer photo uploads (custom skins). Files are stored on disk and served at
 * /uploads/... — swap for S3 / Cloudflare R2 in production (same URL contract).
 */
export async function uploadRoutes(app: FastifyInstance) {
  const root = resolve(config.uploadDir);
  mkdirSync(root, { recursive: true });

  await app.register(fastifyStatic, {
    root,
    prefix: "/uploads/",
    decorateReply: false,
    maxAge: "30d",
    immutable: true,
    setHeaders: (reply, path) => {
      if (path.endsWith(".glb")) reply.header("content-type", "model/gltf-binary");
    },
  });

  /* admin: a product's own 3D model (GLB) — compressed on upload */
  app.post(
    "/api/v1/uploads/model",
    {
      preHandler: requireAdmin,
      config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Uploads"],
        summary: "Upload a product 3D model (.glb, max 60 MB) — it's optimised to ~1 MB. Returns { url, bytes, originalBytes }.",
        consumes: ["multipart/form-data"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const file = await req.file({ limits: { fileSize: MAX_MODEL, files: 1 } }).catch(() => null);
      if (!file) throw badRequest("Please choose a .glb file", "no_file");
      const buf = await file.toBuffer().catch(() => {
        throw badRequest("Model is larger than 60 MB", "too_large");
      });
      if (buf.subarray(0, 4).toString("ascii") !== "glTF") throw badRequest("Please upload a .glb 3D model (binary glTF)", "bad_type");
      let out: Buffer;
      let size: number[] | null = null;
      try {
        ({ out, size } = await optimizeGlb(buf));
      } catch (e) {
        req.log.warn({ err: e }, "glb optimise failed");
        throw badRequest("This 3D file couldn't be read. Export it again as .glb (glTF binary) and retry.", "bad_model");
      }
      const month = new Date().toISOString().slice(0, 7);
      mkdirSync(join(root, month), { recursive: true });
      const name = `${nanoid(18)}.glb`;
      await writeFile(join(root, month, name), out);
      reply.code(201);
      return { data: { url: `${config.publicApiUrl}/uploads/${month}/${name}`, bytes: out.length, originalBytes: buf.length, size, name: file.filename?.slice(0, 120) } };
    },
  );

  app.post(
    "/api/v1/uploads",
    {
      config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Uploads"],
        summary: "Upload a customer photo (JPG/PNG/WebP, max 15 MB) — multipart field `file`. Returns { url } to send with the cart item.",
        consumes: ["multipart/form-data"],
      },
    },
    async (req, reply) => {
      const file = await req.file({ limits: { fileSize: MAX, files: 1 } }).catch(() => null);
      if (!file) throw badRequest("Please choose a photo", "no_file");
      const buf = await file.toBuffer().catch(() => {
        throw badRequest("Photo is larger than 15 MB", "too_large");
      });
      const ext = sniff(buf);
      if (!ext) throw badRequest("Please upload a JPG, PNG or WebP photo", "bad_type");
      const month = new Date().toISOString().slice(0, 7);
      mkdirSync(join(root, month), { recursive: true });
      const small = await compressPhoto(buf);
      const out = small ?? buf;
      const name = `${nanoid(18)}.${small ? "webp" : ext}`;
      await writeFile(join(root, month, name), out);
      reply.code(201);
      return { data: { url: `${config.publicApiUrl}/uploads/${month}/${name}`, size: out.length, originalSize: buf.length, name: file.filename?.slice(0, 120) } };
    },
  );

  /* Admin or creator: Upload short product reel video (MP4/WebM, max 60 MB) */
  app.post(
    "/api/v1/uploads/video",
    {
      config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Uploads"],
        summary: "Upload a short video clip (MP4 / WebM, max 60 MB)",
        consumes: ["multipart/form-data"],
      },
    },
    async (req, reply) => {
      const file = await req.file({ limits: { fileSize: 60 * 1024 * 1024, files: 1 } }).catch(() => null);
      if (!file) throw badRequest("Please choose a video file", "no_file");
      const filename = file.filename || "reel.mp4";
      const extMatch = filename.match(/\.(mp4|webm|mov)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
      const buf = await file.toBuffer().catch(() => {
        throw badRequest("Video is larger than 60 MB", "too_large");
      });
      const month = new Date().toISOString().slice(0, 7);
      mkdirSync(join(root, month), { recursive: true });
      const name = `${nanoid(18)}.${ext}`;
      await writeFile(join(root, month, name), buf);
      reply.code(201);
      return { data: { url: `${config.publicApiUrl}/uploads/${month}/${name}`, size: buf.length, name: filename } };
    },
  );
}
