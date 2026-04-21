import { sendTelegramMessage, tryTelegramAppDeepLinkForHttpsTmeUrl } from "./telegramClient.js";
import type { AppEnv } from "../config/env.js";

function isValidTelegramUserId(raw: unknown): boolean {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return false;
  const n = BigInt(s);
  return n > 0n;
}

export interface TelegramDeliverFailure {
  ok: false;
  httpStatus: number;
  error: string;
}

export interface TelegramDeliverSuccess {
  ok: true;
  delivered: boolean;
  link: string;
  telegramAppDeepLink?: string;
  message: string;
}

export type TelegramDeliverResult = TelegramDeliverFailure | TelegramDeliverSuccess;

/**
 * Sends a plain Telegram DM with a URL the client chooses (any link for now).
 * Echoes the URL in the JSON so bot-blocked markets can show/copy it in-app when needed.
 */
export function createTelegramDeliverService(env: AppEnv) {
  return {
    async deliverLink({
      telegramUserId,
      link,
      text,
    }: {
      telegramUserId?: unknown;
      link?: unknown;
      text?: unknown;
    }): Promise<TelegramDeliverResult> {
      const tg = String(telegramUserId).trim();
      const linkStr = String(link ?? "").trim();

      if (!isValidTelegramUserId(tg)) {
        return { ok: false, httpStatus: 400, error: "invalid_telegram_user_id" };
      }
      if (!linkStr) {
        return { ok: false, httpStatus: 400, error: "missing_link" };
      }
      if (!env.telegramBotToken) {
        return { ok: false, httpStatus: 503, error: "telegram_not_configured" };
      }

      const intro = (text && String(text).trim()) || "Here is your link.";
      const message = `${intro}\n\n${linkStr}`;

      const telegramAppDeepLink = tryTelegramAppDeepLinkForHttpsTmeUrl(linkStr);

      const base = {
        link: linkStr,
        ...(telegramAppDeepLink ? { telegramAppDeepLink } : {}),
        message:
          "The same URL is returned in this response so your client can display or copy it when the in-game browser cannot open Telegram or HTTPS.",
      };

      try {
        await sendTelegramMessage(env.telegramBotToken, tg, message);
        return {
          ok: true,
          delivered: true,
          ...base,
        };
      } catch {
        return {
          ok: true,
          delivered: false,
          ...base,
          message:
            base.message +
            " No Telegram DM was sent from the server; still show the URL in your UI.",
        };
      }
    },
  };
}

export type TelegramDeliverService = ReturnType<typeof createTelegramDeliverService>;
