import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Directory that contains `package.json` (the `backend/` folder), from any compiled or source file. */
export function getPackageRoot(fromImportMetaUrl: string | URL): string {
  let dir = dirname(fileURLToPath(fromImportMetaUrl));
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`package.json not found above ${dirname(fileURLToPath(fromImportMetaUrl))}`);
}
