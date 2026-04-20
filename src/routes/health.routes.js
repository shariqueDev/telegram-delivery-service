import { Router } from "express";

/**
 * @param {object} [deps]
 * @param {ReturnType<import('../services/mtproto/mtprotoAccountPool.js').createMtprotoAccountPool>} [deps.mtprotoAccountPool]
 */
export function createHealthRouter(deps = {}) {
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

  return r;
}
