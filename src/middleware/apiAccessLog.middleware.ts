import type { IncomingHttpHeaders } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { appendServiceLogLine } from "../utils/serviceLogger.js";
import type { AppEnv } from "../config/env.js";

/** Header names whose values are replaced in logs (case-insensitive). */
const REDACT_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
]);

function sanitizeHeadersForLog(headers: IncomingHttpHeaders): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    out[key] = REDACT_HEADER_NAMES.has(lower) ? "[redacted]" : value;
  }
  return out;
}

/**
 * Logs each HTTP request to a file (JSON Lines): request headers, JSON payload, and JSON response.
 */
export function createApiAccessLogMiddleware(env: AppEnv) {
  const logPath = env.serviceLogPath;
  const skipHealth = env.logSkipHealth;

  return function apiAccessLog(req: Request, res: Response, next: NextFunction): void {
    if (skipHealth && req.method === "GET") {
      const p = req.path || req.url?.split("?")[0] || "";
      if (p === "/" || p === "/health" || p === "/health/accounts") {
        next();
        return;
      }
    }

    const started = Date.now();
    const origJson = res.json.bind(res) as Response["json"];
    res.json = function jsonWithCapture(body: unknown) {
      res.locals._accessLogJsonBody = body;
      return origJson(body);
    };

    res.on("finish", () => {
      const durationMs = Date.now() - started;
      const payload =
        req.body !== undefined && req.body !== null
          ? typeof req.body === "object"
            ? (req.body as Record<string, unknown>)
            : { _raw: String(req.body) }
          : null;

      const out = res.locals._accessLogJsonBody;

      const record: Record<string, unknown> = {
        requestId: req.requestId ?? null,
        time: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        durationMs,
        requestHeaders: sanitizeHeadersForLog(req.headers),
        payload,
        response: out !== undefined ? out : null,
      };

      appendServiceLogLine(logPath, record);
    });

    next();
  };
}
