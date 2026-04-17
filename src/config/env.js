/**
 * Centralized environment access (12-factor style).
 * @returns {import('./env.types.js').AppEnv}
 */
export function loadEnv() {
  const port = Number(process.env.PORT);
  const apiId = Number(process.env.TELEGRAM_API_ID);
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number.isFinite(port) && port > 0 ? port : 4000,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramApiId: Number.isFinite(apiId) && apiId > 0 ? apiId : 0,
    telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
    telegramMtprotoSession: process.env.TELEGRAM_MTPROTO_SESSION ?? "",
  };
}
