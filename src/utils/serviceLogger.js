import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Serialize file writes so lines are never interleaved. */
let writeChain = Promise.resolve();

/**
 * Append one JSON object per line (JSON Lines / NDJSON). No DB — works for local runs and log tailing.
 * @param {string} filePath Absolute or cwd-relative path
 * @param {Record<string, unknown>} record
 */
export function appendServiceLogLine(filePath, record) {
  const line = `${JSON.stringify(record)}\n`;
  writeChain = writeChain
    .then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, line, "utf8");
    })
    .catch((err) => {
      console.error("[serviceLogger] append failed:", err?.message ?? err);
    });
}


