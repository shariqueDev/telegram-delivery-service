import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Accept client/proxy ids; otherwise generate a UUID. */
const INCOMING_ID = /^[\w-]{8,128}$/;

/**
 * Assigns a unique id per request (`req.requestId`), sets `X-Request-Id` on the response,
 * and honors a valid incoming `X-Request-Id` header when present.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw = req.get("x-request-id")?.trim();
  const id = raw && INCOMING_ID.test(raw) ? raw : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
