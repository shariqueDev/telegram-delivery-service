import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./config/env.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(projectRoot, ".env") });
import { createApp } from "./app.js";

export function startServer() {
  const env = loadEnv();
  const app = createApp(env);

  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
  });
}
