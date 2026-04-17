/**
 * One-time interactive login for GramJS (MTProto).
 *
 * 1. Create an app at https://my.telegram.org → copy api_id and api_hash into `.env`.
 * 2. Run: `npm run mtproto:login`
 * 3. Paste the printed TELEGRAM_MTPROTO_SESSION=... into `.env`.
 *
 * Using a user account to send automated messages may violate Telegram ToS if abused.
 * Store the session string like a password; never commit it.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (!existsSync(envPath)) {
  console.error(`Missing file: ${envPath}`);
  console.error("Create it (e.g. copy .env.example) and add TELEGRAM_API_ID and TELEGRAM_API_HASH from https://my.telegram.org/apps");
  process.exit(1);
}
dotenv.config({ path: envPath });

const rl = readline.createInterface({ input, output });

const rawId = process.env.TELEGRAM_API_ID?.trim() ?? "";
const apiId = Number(rawId.replace(/^["']|["']$/g, ""));
const apiHash = process.env.TELEGRAM_API_HASH?.trim().replace(/^["']|["']$/g, "") ?? "";

if (!Number.isFinite(apiId) || apiId <= 0 || !apiHash) {
  console.error("Could not read valid MTProto app credentials from .env.");
  console.error(`Loaded from: ${envPath}`);
  console.error("Required (exact names, no spaces around '='):");
  console.error("  TELEGRAM_API_ID=<number from my.telegram.org, e.g. 12345678>");
  console.error("  TELEGRAM_API_HASH=<long hex string from the same page>");
  console.error("");
  console.error("Checks:");
  console.error(`  TELEGRAM_API_ID: ${rawId ? `"${rawId}" parses to ${apiId}` : "MISSING or empty"}`);
  console.error(`  TELEGRAM_API_HASH: ${apiHash ? `set (${apiHash.length} chars)` : "MISSING or empty"}`);
  console.error("");
  console.error('Do not use names like "api_id" in .env — use TELEGRAM_API_ID and TELEGRAM_API_HASH.');
  process.exit(1);
}

const existingSession = (process.env.TELEGRAM_MTPROTO_SESSION ?? "").trim();
const session = new StringSession(existingSession);
const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

try {
  await client.start({
    phoneNumber: async () => (await rl.question("Phone (+country code, e.g. +14155552671): ")).trim(),
    phoneCode: async () => (await rl.question("Code from Telegram / SMS: ")).trim(),
    password: async (hint) =>
      (await rl.question(`Cloud password (2FA) if any (hint: ${hint ?? "n/a"}): `)).trim(),
    onError: async (err) => {
      console.error(err);
      return false;
    },
  });

  const saved = client.session.save();
  console.log("\nAdd or replace this line in .env (treat as a secret):\n");
  console.log(`TELEGRAM_MTPROTO_SESSION=${saved}\n`);
} finally {
  await client.disconnect();
  rl.close();
}
