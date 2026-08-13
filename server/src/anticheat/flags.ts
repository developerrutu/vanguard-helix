import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type FlagKind =
  | "speed"
  | "teleport"
  | "aim"
  | "wall"
  | "packet"
  | "client"
  | "ammo"
  | "rate"
  | "afk"
  | "farm"
  | "trade"
  | "exploit"
  | "report_abuse"
  | "economy"
  | "login"
  | "session"
  | "grief";

export interface Flag {
  at: number;
  playerId: string;
  name: string;
  kind: FlagKind;
  detail: string;
  severity: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const logFile = join(here, "../../../../.data/flags.log");

export class FlagLog {
  private recent: Flag[] = [];
  private heat = new Map<string, number>();
  onFlag: ((flag: Flag) => void) | null = null;

  note(playerId: string, name: string, kind: FlagKind, detail: string, severity = 1): void {
    const flag: Flag = { at: Date.now(), playerId, name, kind, detail, severity };
    this.recent.push(flag);
    if (this.recent.length > 400) this.recent.shift();
    const next = (this.heat.get(playerId) || 0) + severity;
    this.heat.set(playerId, next);
    this.onFlag?.(flag);
    try {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(logFile, JSON.stringify(flag) + "\n");
    } catch {
      /* ignore disk */
    }
  }

  heatOf(id: string): number {
    return this.heat.get(id) || 0;
  }

  list(limit = 40): Flag[] {
    return this.recent.slice(-limit);
  }
}
