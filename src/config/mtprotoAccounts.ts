import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { getPackageRoot } from "./packageRoot.js";

export interface MtprotoAccountConfig {
  id: string;
  session: string;
}

const backendRoot = getPackageRoot(import.meta.url);
const DEFAULT_ACCOUNTS_FILE = join(backendRoot, "config", "mtproto-accounts.json");

function normalizeAccountArray(parsed: unknown, sourceLabel: string): MtprotoAccountConfig[] {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${sourceLabel} must be a non-empty JSON array`);
  }
  const out: MtprotoAccountConfig[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const session = String(rec.session ?? rec.sessionString ?? "").trim();
    if (!session) continue;
    const id = String(rec.id ?? `acc_${i + 1}`).trim() || `acc_${i + 1}`;
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

/** Resolve path: absolute as-is; relative paths are relative to the `backend/` folder. */
function resolveAccountsFilePath(rawPath: string): string | null {
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
 */
export function parseMtprotoAccounts(): MtprotoAccountConfig[] {
  const fileEnv = process.env.TELEGRAM_MTPROTO_ACCOUNTS_FILE?.trim();
  if (fileEnv) {
    const filePath = resolveAccountsFilePath(fileEnv);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(
        `TELEGRAM_MTPROTO_ACCOUNTS_FILE: file not found: ${filePath ?? fileEnv}`,
      );
    }
    let parsed: unknown;
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON in TELEGRAM_MTPROTO_ACCOUNTS_JSON");
    }
    return normalizeAccountArray(parsed, "TELEGRAM_MTPROTO_ACCOUNTS_JSON");
  }

  if (existsSync(DEFAULT_ACCOUNTS_FILE)) {
    let parsed: unknown;
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
