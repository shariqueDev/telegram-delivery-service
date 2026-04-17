import { Router } from "express";
import { createTelegramDeliverController } from "../controllers/telegramDeliver.controller.js";
import { createMtprotoDeliverController } from "../controllers/mtprotoDeliver.controller.js";

/**
 * @param {object} deps
 * @param {ReturnType<import('../services/telegramDeliverService.js').createTelegramDeliverService>} deps.telegramDeliverService
 * @param {ReturnType<import('../services/mtprotoDeliverService.js').createMtprotoDeliverService>} deps.mtprotoDeliverService
 */
export function createTelegramDeliverRouter(deps) {
  const r = Router();
  const botController = createTelegramDeliverController(deps.telegramDeliverService);
  const mtprotoController = createMtprotoDeliverController(deps.mtprotoDeliverService);

  r.post("/deliver", (req, res, next) => {
    botController.deliver(req, res).catch(next);
  });

  r.post("/deliver-mtproto", (req, res, next) => {
    mtprotoController.deliver(req, res).catch(next);
  });

  return r;
}
