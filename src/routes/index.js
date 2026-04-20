import { Router } from "express";
import { createHealthRouter } from "./health.routes.js";
import { createTelegramDeliverRouter } from "./telegramDeliver.routes.js";

/**
 * @param {object} deps
 * @param {ReturnType<import('../services/telegramDeliverService.js').createTelegramDeliverService>} deps.telegramDeliverService
 * @param {ReturnType<import('../services/mtprotoDeliverService.js').createMtprotoDeliverService>} deps.mtprotoDeliverService
 * @param {ReturnType<import('../services/mtproto/mtprotoAccountPool.js').createMtprotoAccountPool>} [deps.mtprotoAccountPool]
 */
export function createRootRouter(deps) {
  const r = Router();
  r.use(createHealthRouter({ mtprotoAccountPool: deps.mtprotoAccountPool }));
  r.use("/api/telegram", createTelegramDeliverRouter(deps));
  return r;
}
