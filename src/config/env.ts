import { join, isAbsolute } from "node:path";
import { parseMtprotoAccounts, type MtprotoAccountConfig } from "./mtprotoAccounts.js";
import { getPackageRoot } from "./packageRoot.js";

const backendRoot = getPackageRoot(import.meta.url);

export interface AppEnv {
  nodeEnv: string;
  port: number;
  telegramBotToken: string;
  telegramApiId: number;
  telegramApiHash: string;
  mtprotoAccounts: MtprotoAccountConfig[];
  mtprotoMinSendIntervalMs: number;
  idempotencyTtlMs: number;
  serviceLogPath: string;
  logSkipHealth: boolean;
}

/** Centralized environment access (12-factor style). */
export function loadEnv(): AppEnv {
  const port = Number(process.env.PORT);
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const rawLogPath = process.env.SERVICE_LOG_PATH?.trim();
  const serviceLogPath = rawLogPath
    ? isAbsolute(rawLogPath)
      ? rawLogPath
      : join(backendRoot, rawLogPath)
    : join(backendRoot, "logs", "service-access.log");

  const skipRaw = process.env.LOG_SKIP_HEALTH;
  const logSkipHealth =
    skipRaw === undefined || skipRaw === "" ? true : !/^(0|false|no)$/i.test(skipRaw);

  const minInt = Number(process.env.MTPROTO_MIN_SEND_INTERVAL_MS);
  const mtprotoMinSendIntervalMs =
    Number.isFinite(minInt) && minInt >= 500 && minInt <= 60_000 ? minInt : 3000;

  const idemTtl = Number(process.env.IDEMPOTENCY_TTL_MS);
  const idempotencyTtlMs =
    Number.isFinite(idemTtl) && idemTtl >= 60_000 && idemTtl <= 7 * 24 * 60 * 60 * 1000
      ? idemTtl
      : 86_400_000;

  let mtprotoAccounts: MtprotoAccountConfig[];
  try {
    mtprotoAccounts = parseMtprotoAccounts();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[env] MTProto accounts config error:", msg);
    throw e;
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number.isFinite(port) && port > 0 ? port : 4000,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramApiId: Number.isFinite(apiId) && apiId > 0 ? apiId : 0,
    telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
    mtprotoAccounts,
    mtprotoMinSendIntervalMs,
    idempotencyTtlMs,
    serviceLogPath,
    logSkipHealth,
  };
}
