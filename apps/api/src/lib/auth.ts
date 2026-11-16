import type { FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "./errors";

export interface JwtUser {
  id: number;
  role: "customer" | "admin";
  name: string;
  email: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

/** Sets request.user when a valid Bearer token is present; never fails. */
export async function optionalAuth(req: FastifyRequest) {
  if (!req.headers.authorization) return;
  try {
    await req.jwtVerify();
  } catch {
    /* ignore bad token for optional routes */
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    throw unauthorized();
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (req.user.role !== "admin") throw forbidden("Admin only");
}
