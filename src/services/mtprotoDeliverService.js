import bigInt from "big-integer";
import { tryTelegramAppDeepLinkForHttpsTmeUrl } from "./telegramClient.js";
import { classifyTelegramSendError } from "./mtproto/telegramErrors.js";

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
    env.mtprotoAccounts.length > 0
  );
}

/**
 * @param {import('../config/env.types.js').AppEnv} env
 * @param {object} deps
 * @param {ReturnType<import('./mtproto/mtprotoAccountPool.js').createMtprotoAccountPool>} deps.pool
 * @param {ReturnType<import('./mtproto/idempotencyStore.js').createIdempotencyStore>} deps.idempotencyStore
 * @param {ReturnType<import('./mtproto/mtprotoMetrics.js').createMtprotoMetrics>} deps.metrics
 */
export function createMtprotoDeliverService(env, deps) {
  const { pool, idempotencyStore, metrics } = deps;

  return {
    /**
     * @param {object} params
     * @param {string} [params.telegramUserId]
     * @param {string} [params.telegramUsername]
     * @param {string} params.link
     * @param {string} [params.text]
     * @param {string} [params.messageId] Client idempotency key
     */
    async deliverLink({ telegramUserId, telegramUsername, link, text, messageId }) {
      const tg = String(telegramUserId ?? "").trim();
      const uname = normalizeTelegramUsername(telegramUsername);
      const linkStr = String(link ?? "").trim();
      const idemKey = messageId != null ? String(messageId).trim() : "";

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

      if (idemKey) {
        const prev = idempotencyStore.get(idemKey);
        if (prev) {
          return {
            ok: true,
            idempotentReplay: true,
            ...prev,
          };
        }
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

      const peer = uname ? uname : bigInt(tg);
      const ordered = pool.selectAccountsRoundRobin();

      if (ordered.length === 0) {
        metrics.deliveriesTotal.inc({ status: "failure" });
        metrics.attemptsHistogram.observe(0);
        const snap = pool.getSnapshot();
        return {
          ok: true,
          delivered: false,
          ...base,
          ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
          reason: "all_accounts_unavailable",
          attempts: 0,
          accountId: null,
          detail: `No accounts available (total=${snap.totalAccounts}, blocked=${snap.blockedAccounts}).`,
        };
      }

      let attempts = 0;
      let lastClassified = /** @type {import('./mtproto/telegramErrors.js').ClassifiedError | null} */ (null);
      let lastErrText = "";

      for (const acc of ordered) {
        attempts++;
        try {
          await acc.sendMessage(peer, message);
          metrics.attempts.inc({ account_id: acc.id, result: "success" });
          metrics.deliveriesTotal.inc({ status: "success" });
          metrics.attemptsHistogram.observe(attempts);

          const successPayload = {
            delivered: true,
            reason: null,
            attempts,
            accountId: acc.id,
            ...base,
            ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
          };

          if (idemKey) {
            idempotencyStore.set(idemKey, {
              ...successPayload,
              idempotentReplay: false,
            });
          }

          console.info(`[INFO] Attempt ${attempts}: ${acc.id} → SUCCESS`);

          return {
            ok: true,
            ...successPayload,
          };
        } catch (err) {
          lastErrText = String(err?.message ?? err);
          const c = classifyTelegramSendError(err);
          lastClassified = c;

          console.info(`[INFO] Attempt ${attempts}: ${acc.id} → ${c.reason}${c.telegramCode ? ` (${c.telegramCode})` : ""}`);
          metrics.attempts.inc({ account_id: acc.id, result: c.reason });

          if (c.floodSeconds != null) {
            acc.markFloodWait(c.floodSeconds);
            metrics.floodWait.inc({ account_id: acc.id });
          }

          if (c.disableAccount) {
            await acc.markDisabled(c.reason);
            console.error(
              `[ERROR] Account disabled ${acc.id} (${c.reason}) — Telegram session no longer usable; remaining pool accounts will be used on the next send.`,
            );
          } else if (c.tryNextAccount && !c.permanent) {
            console.info(
              `[INFO] Rotating: ${acc.id} failed with ${c.reason} — trying next Telegram account if available.`,
            );
          }

          if (
            c.reason === "invalid_username" ||
            c.reason === "peer_invalid" ||
            c.reason === "peer_unresolved"
          ) {
            metrics.invalidUsername.inc();
          }

          if (c.permanent) {
            metrics.deliveriesTotal.inc({ status: "failure" });
            metrics.attemptsHistogram.observe(attempts);

            const failPayload = {
              delivered: false,
              reason: c.reason,
              attempts,
              accountId: acc.id,
              ...base,
              ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
              detail: lastErrText.slice(0, 400),
              message:
                base.message +
                " Telegram did not accept the send." +
                (c.reason === "peer_unresolved" && !uname
                  ? " For strangers, pass telegramUsername (without @) instead of numeric id, or the user must appear in your Telegram dialogs first."
                  : " Check server logs for the exact RPC message."),
            };

            if (idemKey) {
              idempotencyStore.set(idemKey, { ...failPayload, idempotentReplay: false });
            }

            return {
              ok: true,
              ...failPayload,
            };
          }

        }
      }

      metrics.deliveriesTotal.inc({ status: "failure" });
      metrics.attemptsHistogram.observe(attempts);

      const failPayload = {
        delivered: false,
        reason: lastClassified?.reason ?? "all_accounts_failed",
        attempts,
        accountId: null,
        ...base,
        ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
        detail: lastErrText.slice(0, 400),
        message:
          base.message +
          " Telegram did not accept the send after trying available accounts." +
          " Check server logs for the exact RPC message.",
      };

      if (idemKey) {
        idempotencyStore.set(idemKey, { ...failPayload, idempotentReplay: false });
      }

      return {
        ok: true,
        ...failPayload,
      };
    },
  };
}
