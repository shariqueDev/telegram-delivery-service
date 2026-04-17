import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./config/env.js";
import { appendServiceLogLine } from "./utils/serviceLogger.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(projectRoot, ".env") });
import { createApp } from "./app.js";

export function startServer() {
  const env = loadEnv();
  const app = createApp(env);

  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
    console.log(`Access log file: ${env.serviceLogPath}`);
    appendServiceLogLine(env.serviceLogPath, {
      time: new Date().toISOString(),
      event: "server_listening",
      requestId: null,
      port: env.port,
      message: "Log file created or appended on each start.",
    });
  });
}
