import { Router } from "express";
import { createTelegramDeliverController } from "../controllers/telegramDeliver.controller.js";
import { createMtprotoDeliverController } from "../controllers/mtprotoDeliver.controller.js";
import type { RootRouterDeps } from "./index.js";

export function createTelegramDeliverRouter(deps: Pick<RootRouterDeps, "telegramDeliverService" | "mtprotoDeliverService">) {
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
