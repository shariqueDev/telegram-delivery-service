import express from "express";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { createTelegramDeliverService } from "./services/telegramDeliverService.js";
import { createMtprotoDeliverService } from "./services/mtprotoDeliverService.js";
import { createRootRouter } from "./routes/index.js";

/**
 * @param {import('./config/env.types.js').AppEnv} env
 */
export function createApp(env) {
  const app = express();
  app.disable("x-powered-by");

  app.use(corsMiddleware);
  app.use(express.json({ limit: "100kb" }));

  const telegramDeliverService = createTelegramDeliverService(env);
  const mtprotoDeliverService = createMtprotoDeliverService(env);

  app.use(createRootRouter({ telegramDeliverService, mtprotoDeliverService }));

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
