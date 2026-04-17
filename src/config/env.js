import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Centralized environment access (12-factor style).
 * @returns {import('./env.types.js').AppEnv}
 */
export function loadEnv() {
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

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number.isFinite(port) && port > 0 ? port : 4000,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramApiId: Number.isFinite(apiId) && apiId > 0 ? apiId : 0,
    telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
    telegramMtprotoSession: process.env.TELEGRAM_MTPROTO_SESSION ?? "",
    serviceLogPath,
    logSkipHealth,
  };
}
