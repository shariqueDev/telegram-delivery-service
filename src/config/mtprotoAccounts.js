import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ id: string, session: string }} MtprotoAccountConfig
 */

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_ACCOUNTS_FILE = join(backendRoot, "config", "mtproto-accounts.json");

/**
 * @param {unknown} parsed
 * @param {string} sourceLabel For error messages
 * @returns {MtprotoAccountConfig[]}
 */
function normalizeAccountArray(parsed, sourceLabel) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${sourceLabel} must be a non-empty JSON array`);
  }
  const out = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") continue;
    const session = String(row.session ?? row.sessionString ?? "").trim();
    if (!session) continue;
    const id = String(row.id ?? `acc_${i + 1}`).trim() || `acc_${i + 1}`;
    out.push({ id, session });
  }
  if (out.length === 0) {
    throw new Error(`${sourceLabel}: no entries with a non-empty session`);
  }
  if (out.length > 5) {
    throw new Error(`${sourceLabel}: at most 5 accounts are supported`);
  }
  return out;
}

/**
 * Resolve path: absolute paths as-is; relative paths are relative to the `backend/` folder.
 * @param {string} rawPath
 */
function resolveAccountsFilePath(rawPath) {
  const p = rawPath.trim();
  if (!p) return null;
  return isAbsolute(p) ? p : join(backendRoot, p);
}

/**
 * Load MTProto account definitions. Priority:
 * 1. `TELEGRAM_MTPROTO_ACCOUNTS_FILE` — path to a JSON file (optional override)
 * 2. `TELEGRAM_MTPROTO_ACCOUNTS_JSON` — inline JSON array in env (optional, e.g. CI)
 * 3. Default: `backend/config/mtproto-accounts.json` if the file exists
 *
 * Session strings are **not** read from `TELEGRAM_MTPROTO_SESSION` in `.env` (use the JSON config only).
 *
 * @returns {MtprotoAccountConfig[]}
 */
export function parseMtprotoAccounts() {
  const fileEnv = process.env.TELEGRAM_MTPROTO_ACCOUNTS_FILE?.trim();
  if (fileEnv) {
    const filePath = resolveAccountsFilePath(fileEnv);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(
        `TELEGRAM_MTPROTO_ACCOUNTS_FILE: file not found: ${filePath ?? fileEnv}`,
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`TELEGRAM_MTPROTO_ACCOUNTS_FILE: invalid JSON (${msg})`);
    }
    return normalizeAccountArray(parsed, `File ${filePath}`);
  }

  const raw = process.env.TELEGRAM_MTPROTO_ACCOUNTS_JSON?.trim();
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON in TELEGRAM_MTPROTO_ACCOUNTS_JSON");
    }
    return normalizeAccountArray(parsed, "TELEGRAM_MTPROTO_ACCOUNTS_JSON");
  }

  if (existsSync(DEFAULT_ACCOUNTS_FILE)) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(DEFAULT_ACCOUNTS_FILE, "utf8"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`config/mtproto-accounts.json: invalid JSON (${msg})`);
    }
    return normalizeAccountArray(parsed, `File ${DEFAULT_ACCOUNTS_FILE}`);
  }

  return [];
}
