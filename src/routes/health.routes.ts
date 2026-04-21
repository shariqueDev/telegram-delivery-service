import { Router } from "express";
import type { MtprotoAccountPool } from "../services/mtproto/mtprotoAccountPool.js";

export interface HealthRouterDeps {
  mtprotoAccountPool?: MtprotoAccountPool;
}

export function createHealthRouter(deps: HealthRouterDeps = {}) {
  const r = Router();
  const pool = deps.mtprotoAccountPool;

  r.get("/", (_req, res) => {
    res.type("text/plain").send("Telegram link delivery API");
  });

  r.get("/health", (req, res) => {
    const snap = pool ? pool.getSnapshot() : { activeAccounts: 0, blockedAccounts: 0 };
    res.json({
      status: "ok",
      activeAccounts: snap.activeAccounts,
      blockedAccounts: snap.blockedAccounts,
      requestId: req.requestId,
    });
  });

  /** Per MTProto pool account: id, status, flood window, last use (no secrets). Protect in production. */
  r.get("/health/accounts", (req, res) => {
    if (!pool || pool.accounts.length === 0) {
      res.json({
        status: "ok",
        requestId: req.requestId,
        accounts: [],
        message: "No MTProto accounts configured.",
      });
      return;
    }
    const snap = pool.getSnapshot();
    res.json({
      status: "ok",
      requestId: req.requestId,
      totalAccounts: snap.totalAccounts,
      activeAccounts: snap.activeAccounts,
      blockedAccounts: snap.blockedAccounts,
      accounts: pool.getAccountsHealth(),
    });
  });

  return r;
}
