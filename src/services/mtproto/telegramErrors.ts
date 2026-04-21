import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { FloodWaitError, AuthKeyError } = require("telegram/errors") as typeof import("telegram/errors");

export interface ClassifiedError {
  reason: string;
  telegramCode?: string;
  permanent: boolean;
  tryNextAccount: boolean;
  disableAccount: boolean;
  floodSeconds: number | null;
}

interface ErrShape {
  message?: unknown;
  errorMessage?: unknown;
  seconds?: unknown;
}

function readErrShape(err: unknown): ErrShape {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    return {
      message: o.message,
      errorMessage: o.errorMessage,
      seconds: o.seconds,
    };
  }
  return {};
}

export function classifyTelegramSendError(err: unknown): ClassifiedError {
  const { message: m, errorMessage: emRaw, seconds: secRaw } = readErrShape(err);
  const msg = String(m ?? err);
  const em = typeof emRaw === "string" ? emRaw : "";
  const code = `${em} ${msg}`.toUpperCase();

  if (err instanceof FloodWaitError || /FLOOD_WAIT_\d+|FLOOD_PREMIUM_WAIT_\d+/i.test(code)) {
    const seconds =
      typeof secRaw === "number"
        ? secRaw
        : (() => {
            const match = code.match(/FLOOD_(?:PREMIUM_)?WAIT_(\d+)/i);
            return match ? parseInt(match[1] ?? "60", 10) : 60;
          })();
    return {
      reason: "flood_wait",
      telegramCode: "FLOOD_WAIT",
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: Math.min(Math.max(seconds, 1), 86400),
    };
  }

  if (err instanceof AuthKeyError) {
    return {
      reason: "session_invalid",
      telegramCode: em || "AUTH_KEY",
      permanent: false,
      tryNextAccount: true,
      disableAccount: true,
      floodSeconds: null,
    };
  }

  if (
    /AUTH_KEY_UNREGISTERED|AUTH_KEY_INVALID|SESSION_REVOKED|AUTH_KEY_PERM_EMPTY|SESSION_EXPIRED|SESSION_UNAUTHORIZED/i.test(
      code,
    )
  ) {
    return {
      reason: "session_invalid",
      telegramCode: em || "SESSION",
      permanent: false,
      tryNextAccount: true,
      disableAccount: true,
      floodSeconds: null,
    };
  }

  if (
    /USERNAME_NOT_OCCUPIED|USERNAME_INVALID|USERNAME_PURCHASE_AVAILABLE/i.test(code) ||
    /* GramJS often surfaces only English text */
    /NO USER HAS .+ AS USERNAME/i.test(code)
  ) {
    return {
      reason: "invalid_username",
      telegramCode: em,
      permanent: true,
      tryNextAccount: false,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/PEER_ID_INVALID|INPUT_USER_DEACTIVATED|USER_ID_INVALID/i.test(code)) {
    return {
      reason: "peer_invalid",
      telegramCode: em,
      permanent: true,
      tryNextAccount: false,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/USER_PRIVACY_RESTRICTED/i.test(code)) {
    return {
      reason: "privacy_restricted",
      telegramCode: em,
      permanent: true,
      tryNextAccount: false,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/USER_IS_BLOCKED|YOU_BLOCKED_USER|CONTACT_BLOCKED/i.test(code)) {
    return {
      reason: "user_blocked",
      telegramCode: em,
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/CHAT_WRITE_FORBIDDEN|CHAT_ADMIN_REQUIRED|USER_BANNED_IN_CHANNEL/i.test(code)) {
    return {
      reason: "chat_write_forbidden",
      telegramCode: em,
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (
    /PEER_FLOOD|USER_RESTRICTED|CHAT_SEND_PLAIN_FORBIDDEN|CHAT_SEND_MEDIA_FORBIDDEN|CHAT_RESTRICTED|RIGHTS_FORBIDDEN|CHAT_SEND_GIFS_FORBIDDEN/i.test(
      code,
    )
  ) {
    return {
      reason: "account_limited",
      telegramCode: em,
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/PHONE_NUMBER_BANNED|ACCOUNT_RESTRICTED|USER_DEACTIVATED_BAN|SPAM\b/i.test(code)) {
    return {
      reason: "telegram_account_blocked",
      telegramCode: em,
      permanent: false,
      tryNextAccount: true,
      disableAccount: true,
      floodSeconds: null,
    };
  }

  if (/^ACCOUNT_DISABLED$/i.test(msg.trim())) {
    return {
      reason: "account_disabled",
      telegramCode: em,
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (/INPUT_ENTITY|INPUT_USER|PEER_ID_INVALID|ENTITY_RESOLVE/i.test(msg) && /input entity/i.test(msg)) {
    return {
      reason: "peer_unresolved",
      telegramCode: em,
      permanent: true,
      tryNextAccount: false,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  if (
    /ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|ENETUNREACH|TIMEOUT|TIMED_OUT/i.test(code) ||
    /timeout/i.test(msg)
  ) {
    return {
      reason: "network_error",
      telegramCode: em || "NETWORK",
      permanent: false,
      tryNextAccount: true,
      disableAccount: false,
      floodSeconds: null,
    };
  }

  return {
    reason: "unknown_error",
    telegramCode: em || undefined,
    permanent: false,
    tryNextAccount: true,
    disableAccount: false,
    floodSeconds: null,
  };
}
