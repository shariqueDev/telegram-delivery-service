import { Router } from "express";
import { createHealthRouter } from "./health.routes.js";
import { createTelegramDeliverRouter } from "./telegramDeliver.routes.js";
import type { TelegramDeliverService } from "../services/telegramDeliverService.js";
import type { MtprotoDeliverService } from "../services/mtprotoDeliverService.js";
import type { MtprotoAccountPool } from "../services/mtproto/mtprotoAccountPool.js";

export interface RootRouterDeps {
  telegramDeliverService: TelegramDeliverService;
  mtprotoDeliverService: MtprotoDeliverService;
  mtprotoAccountPool?: MtprotoAccountPool;
}

export function createRootRouter(deps: RootRouterDeps) {
  const r = Router();
  r.use(createHealthRouter({ mtprotoAccountPool: deps.mtprotoAccountPool }));
  r.use("/api/telegram", createTelegramDeliverRouter(deps));
  return r;
}
