import { createRequire } from "node:module";
import bigInt from "big-integer";
import { tryTelegramAppDeepLinkForHttpsTmeUrl } from "./telegramClient.js";

const require = createRequire(import.meta.url);
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

function isValidTelegramUserId(raw) {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return false;
  const n = BigInt(s);
  return n > 0n;
}

/** @param {unknown} raw */
function normalizeTelegramUsername(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim().replace(/^@+/u, "").replace(/\s+/gu, "");
  if (s.length < 4 || s.length > 32) return "";
  if (!/^[a-zA-Z0-9_]+$/u.test(s)) return "";
  return s;
}

function isMtprotoConfigured(env) {
  return (
    Number.isFinite(env.telegramApiId) &&
    env.telegramApiId > 0 &&
    Boolean(env.telegramApiHash) &&
    Boolean(env.telegramMtprotoSession)
  );
}

let sharedClient = null;

/**
 * Sends a DM using a **user** Telegram session (MTProto), not the Bot HTTP API.
 * Requires one-time login (see `scripts/mtproto-login.mjs`) and Telegram ToS–aware use.
 *
 * Numeric `telegramUserId` alone often fails with “Could not find the input entity” unless
 * that user is already in your dialogs (see https://docs.telethon.dev/en/stable/concepts/entities.html ).
 * Prefer **`telegramUsername`** (without @) when you have it — GramJS can resolve it over the network.
 *
 * @param {import('../config/env.types.js').AppEnv} env
 */
export function createMtprotoDeliverService(env) {
  return {
    async deliverLink({ telegramUserId, telegramUsername, link, text }) {
      const tg = String(telegramUserId ?? "").trim();
      const uname = normalizeTelegramUsername(telegramUsername);
      const linkStr = String(link ?? "").trim();

      if (!uname && !isValidTelegramUserId(tg)) {
        return {
          ok: false,
          httpStatus: 400,
          error: "missing_or_invalid_recipient",
        };
      }
      if (!linkStr) {
        return { ok: false, httpStatus: 400, error: "missing_link" };
      }
      if (!isMtprotoConfigured(env)) {
        return { ok: false, httpStatus: 503, error: "mtproto_not_configured" };
      }

      const intro = (text && String(text).trim()) || "Here is your link.";
      const message = `${intro}\n\n${linkStr}`;
      const telegramAppDeepLink = tryTelegramAppDeepLinkForHttpsTmeUrl(linkStr);

      const base = {
        transport: "mtproto",
        link: linkStr,
        ...(telegramAppDeepLink ? { telegramAppDeepLink } : {}),
        message:
          "Same URL echoed for clients that cannot open Telegram in-app. MTProto uses your logged-in **user** account, not a bot.",
      };

      try {
        if (!sharedClient) {
          const session = new StringSession(env.telegramMtprotoSession);
          sharedClient = new TelegramClient(session, env.telegramApiId, env.telegramApiHash, {
            connectionRetries: 5,
          });
          await sharedClient.connect();
          if (!(await sharedClient.isUserAuthorized())) {
            await sharedClient.disconnect();
            sharedClient = null;
            return {
              ok: false,
              httpStatus: 503,
              error: "mtproto_session_unauthorized",
            };
          }
        }

        if (uname) {
          await sharedClient.sendMessage(uname, { message });
        } else {
          await sharedClient.sendMessage(bigInt(tg), { message });
        }

        return {
          ok: true,
          delivered: true,
          ...base,
          ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
        };
      } catch (err) {
        const errText = String(err?.message ?? err);
        console.error("[mtproto] sendMessage failed:", errText);
        const hint =
          !uname && errText.includes("input entity")
            ? " For strangers, pass telegramUsername (without @) instead of numeric id, or the user must appear in your Telegram dialogs first."
            : " Check server logs for the exact RPC message.";
        return {
          ok: true,
          delivered: false,
          ...base,
          ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
          detail: errText.slice(0, 400),
          message: base.message + " Telegram did not accept the send." + hint,
        };
      }
    },
  };
}
