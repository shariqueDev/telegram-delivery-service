import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Serialize file writes so lines are never interleaved. */
let writeChain: Promise<void> = Promise.resolve();

/** Append one JSON object per line (JSON Lines / NDJSON). */
export function appendServiceLogLine(filePath: string, record: Record<string, unknown>): void {
  const line = `${JSON.stringify(record)}\n`;
  writeChain = writeChain
    .then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, line, "utf8");
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[serviceLogger] append failed:", msg);
    });
}
