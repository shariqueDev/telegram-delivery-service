import { MtprotoAccountSession } from "./MtprotoAccountSession.js";

/**
 * @param {import('../../config/env.types.js').AppEnv} env
 */
export function createMtprotoAccountPool(env) {
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
    selectAccountsRoundRobin() {
      const ready = accounts.filter((a) => a.isSelectable());
      ready.sort((x, y) => x.lastUsedAt - y.lastUsedAt);
      return ready;
    },

    getSnapshot() {
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
        /** Disabled sessions plus accounts currently in flood wait (unavailable to send). */
        blockedAccounts: disabled + inFlood,
      };
    },
  };
}
