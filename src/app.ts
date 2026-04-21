import express, { type ErrorRequestHandler } from "express";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { requestIdMiddleware } from "./middleware/requestId.middleware.js";
import { createApiAccessLogMiddleware } from "./middleware/apiAccessLog.middleware.js";
import { createTelegramDeliverService } from "./services/telegramDeliverService.js";
import { createMtprotoDeliverService } from "./services/mtprotoDeliverService.js";
import { createMtprotoAccountPool } from "./services/mtproto/mtprotoAccountPool.js";
import { createIdempotencyStore } from "./services/mtproto/idempotencyStore.js";
import { createRootRouter } from "./routes/index.js";
import type { AppEnv } from "./config/env.js";

export function createApp(env: AppEnv) {
  const app = express();
  app.disable("x-powered-by");

  app.use(corsMiddleware);
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(createApiAccessLogMiddleware(env));

  const mtprotoAccountPool = createMtprotoAccountPool(env);
  const idempotencyStore = createIdempotencyStore(env.idempotencyTtlMs);

  const telegramDeliverService = createTelegramDeliverService(env);
  const mtprotoDeliverService = createMtprotoDeliverService(env, {
    pool: mtprotoAccountPool,
    idempotencyStore,
  });

  app.use(
    createRootRouter({
      telegramDeliverService,
      mtprotoDeliverService,
      mtprotoAccountPool,
    }),
  );

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", requestId: req.requestId });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal_error", requestId: req.requestId });
  };
  app.use(onError);

  return app;
}
