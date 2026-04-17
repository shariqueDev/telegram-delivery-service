import { appendServiceLogLine } from "../utils/serviceLogger.js";

/** Header names whose values are replaced in logs (case-insensitive). */
const REDACT_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
]);

/**
 * @param {import('http').IncomingHttpHeaders} headers
 * @returns {Record<string, string | string[] | undefined>}
 */
function sanitizeHeadersForLog(headers) {
  /** @type {Record<string, string | string[] | undefined>} */
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    out[key] = REDACT_HEADER_NAMES.has(lower) ? "[redacted]" : value;
  }
  return out;
}

/**
 * Logs each HTTP request to a file (JSON Lines): request headers, JSON payload, and JSON response.
 *
 * @param {import('../config/env.types.js').AppEnv} env
 */
export function createApiAccessLogMiddleware(env) {
  const logPath = env.serviceLogPath;
  const skipHealth = env.logSkipHealth;

  return function apiAccessLog(req, res, next) {
    if (skipHealth && req.method === "GET") {
      const p = req.path || req.url?.split("?")[0] || "";
      if (p === "/" || p === "/health") {
        return next();
      }
    }

    const started = Date.now();
    const origJson = res.json.bind(res);
    res.json = function jsonWithCapture(body) {
      res.locals._accessLogJsonBody = body;
      return origJson(body);
    };

    res.on("finish", () => {
      const durationMs = Date.now() - started;
      const payload =
        req.body !== undefined && req.body !== null
          ? typeof req.body === "object"
            ? req.body
            : { _raw: String(req.body) }
          : null;

      const out = res.locals._accessLogJsonBody;

      /** @type {Record<string, unknown>} */
      const record = {
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
