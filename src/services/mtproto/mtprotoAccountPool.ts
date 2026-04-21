import type { AppEnv } from "../../config/env.js";
import { MtprotoAccountSession } from "./MtprotoAccountSession.js";

export interface PoolSnapshot {
  totalAccounts: number;
  activeAccounts: number;
  blockedAccounts: number;
}

export interface AccountHealthRow {
  id: string;
  status: "healthy" | "disabled" | "flood_wait";
  selectable: boolean;
  inFloodUntil: string | null;
  lastUsedAt: string | null;
  disabledReason: string | null;
}

export function createMtprotoAccountPool(env: AppEnv) {
  const accounts = env.mtprotoAccounts.map(
    (a) =>
      new MtprotoAccountSession(
        a.id,
        a.session,
        env.telegramApiId,
        env.telegramApiHash,
        env.mtprotoMinSendIntervalMs,
      ),
  );

  return {
    accounts,

    /**
     * Accounts that can be tried now: healthy, not disabled, past flood wait.
     * Least recently used first.
     */
    selectAccountsRoundRobin(): MtprotoAccountSession[] {
      const ready = accounts.filter((a) => a.isSelectable());
      ready.sort((x, y) => x.lastUsedAt - y.lastUsedAt);
      return ready;
    },

    getSnapshot(): PoolSnapshot {
      const total = accounts.length;
      let disabled = 0;
      let inFlood = 0;
      let active = 0;
      for (const a of accounts) {
        if (a.status === "disabled") {
          disabled++;
          continue;
        }
        if (a.isInFloodWait()) {
          inFlood++;
          continue;
        }
        active++;
      }
      return {
        totalAccounts: total,
        activeAccounts: active,
        blockedAccounts: disabled + inFlood,
      };
    },

    /** Ops-safe snapshot per pool account (no session strings). Protect in production. */
    getAccountsHealth(): AccountHealthRow[] {
      return accounts.map((a) => {
        let status: AccountHealthRow["status"] = "healthy";
        if (a.status === "disabled") status = "disabled";
        else if (a.isInFloodWait()) status = "flood_wait";

        return {
          id: a.id,
          status,
          selectable: a.isSelectable(),
          inFloodUntil: a.isInFloodWait() ? new Date(a.floodWaitUntil).toISOString() : null,
          lastUsedAt: a.lastUsedAt > 0 ? new Date(a.lastUsedAt).toISOString() : null,
          disabledReason: a.status === "disabled" ? a.disabledReason : null,
        };
      });
    },
  };
}

export type MtprotoAccountPool = ReturnType<typeof createMtprotoAccountPool>;
