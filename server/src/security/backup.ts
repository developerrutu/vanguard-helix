import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "../../../../.data");
const src = join(dataDir, "accounts.json");
const dir = join(dataDir, "backups");

export function snapshotBackup(): { file: string; kept: number } | null {
  if (!existsSync(src)) return null;
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(dir, `accounts-${stamp}.json`);
  copyFileSync(src, dest);
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("accounts-"))
    .sort();
  while (files.length > 8) {
    const drop = files.shift();
    if (drop) unlinkSync(join(dir, drop));
  }
  return { file: dest, kept: files.length };
}

export function listBackups(): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("accounts-"))
    .sort()
    .reverse();
}
