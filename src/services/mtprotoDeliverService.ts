import bigInt from "big-integer";
import { tryTelegramAppDeepLinkForHttpsTmeUrl } from "./telegramClient.js";
import { classifyTelegramSendError, type ClassifiedError } from "./mtproto/telegramErrors.js";
import type { AppEnv } from "../config/env.js";
import type { MtprotoAccountPool } from "./mtproto/mtprotoAccountPool.js";
import type { IdempotencyStore } from "./mtproto/idempotencyStore.js";

function isValidTelegramUserId(raw: unknown): boolean {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return false;
  const n = BigInt(s);
  return n > 0n;
}

function normalizeTelegramUsername(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim().replace(/^@+/u, "").replace(/\s+/gu, "");
  if (s.length < 4 || s.length > 32) return "";
  if (!/^[a-zA-Z0-9_]+$/u.test(s)) return "";
  return s;
}

function isMtprotoConfigured(env: AppEnv): boolean {
  return (
    Number.isFinite(env.telegramApiId) &&
    env.telegramApiId > 0 &&
    Boolean(env.telegramApiHash) &&
    env.mtprotoAccounts.length > 0
  );
}

export interface MtprotoDeliverDeps {
  pool: MtprotoAccountPool;
  idempotencyStore: IdempotencyStore;
}

export type MtprotoDeliverFailure = { ok: false; httpStatus: number; error: string };

export type MtprotoDeliverSuccess = Record<string, unknown> & { ok: true };

export type MtprotoDeliverResult = MtprotoDeliverFailure | MtprotoDeliverSuccess;

export function createMtprotoDeliverService(env: AppEnv, deps: MtprotoDeliverDeps) {
  const { pool, idempotencyStore } = deps;

  return {
    async deliverLink({
      telegramUserId,
      telegramUsername,
      link,
      text,
      messageId,
    }: {
      telegramUserId?: unknown;
      telegramUsername?: unknown;
      link?: unknown;
      text?: unknown;
      messageId?: unknown;
    }): Promise<MtprotoDeliverResult> {
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
          } as MtprotoDeliverSuccess;
        }
      }

      const intro = (text && String(text).trim()) || "Here is your link.";
      const message = `${intro}\n\n${linkStr}`;
      const telegramAppDeepLink = tryTelegramAppDeepLinkForHttpsTmeUrl(linkStr);

      const base: Record<string, unknown> = {
        transport: "mtproto",
        link: linkStr,
        ...(telegramAppDeepLink ? { telegramAppDeepLink } : {}),
        message:
          "Same URL echoed for clients that cannot open Telegram in-app. MTProto uses your logged-in **user** account, not a bot.",
      };

      const peer = uname ? uname : bigInt(tg);
      const ordered = pool.selectAccountsRoundRobin();

      if (ordered.length === 0) {
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
        } as MtprotoDeliverSuccess;
      }

      let attempts = 0;
      let lastClassified: ClassifiedError | null = null;
      let lastErrText = "";
      const attemptsByAccount: { accountId: string; reason: string }[] = [];
      let lastTriedAccountId: string | null = null;

      for (const acc of ordered) {
        attempts++;
        try {
          await acc.sendMessage(peer, message);

          const successPayload: Record<string, unknown> = {
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
          } as MtprotoDeliverSuccess;
        } catch (err: unknown) {
          lastErrText = String(err instanceof Error ? err.message : err);
          const c = classifyTelegramSendError(err);
          lastClassified = c;
          lastTriedAccountId = acc.id;
          attemptsByAccount.push({ accountId: acc.id, reason: c.reason });

          console.info(
            `[INFO] Attempt ${attempts}: ${acc.id} → ${c.reason}${c.telegramCode ? ` (${c.telegramCode})` : ""}`,
          );

          if (c.floodSeconds != null) {
            acc.markFloodWait(c.floodSeconds);
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

          if (c.permanent) {
            const failPayload: Record<string, unknown> = {
              delivered: false,
              reason: c.reason,
              attempts,
              accountId: acc.id,
              attemptsByAccount,
              ...base,
              ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
              detail: lastErrText.slice(0, 400),
              message:
                String(base.message) +
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
            } as MtprotoDeliverSuccess;
          }
        }
      }

      const failPayload: Record<string, unknown> = {
        delivered: false,
        reason: lastClassified?.reason ?? "all_accounts_failed",
        attempts,
        accountId: lastTriedAccountId,
        attemptsByAccount,
        ...base,
        ...(uname ? { telegramUsername: uname } : { telegramUserId: tg }),
        detail: lastErrText.slice(0, 400),
        message:
          String(base.message) +
          " Telegram did not accept the send after trying available accounts." +
          " Check server logs for the exact RPC message.",
      };

      if (idemKey) {
        idempotencyStore.set(idemKey, { ...failPayload, idempotentReplay: false });
      }

      return {
        ok: true,
        ...failPayload,
      } as MtprotoDeliverSuccess;
    },
  };
}

export type MtprotoDeliverService = ReturnType<typeof createMtprotoDeliverService>;
