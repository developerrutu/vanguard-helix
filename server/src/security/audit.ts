import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type AuditKind =
  | "match_start"
  | "match_end"
  | "join"
  | "leave"
  | "damage"
  | "elim"
  | "reward"
  | "purchase"
  | "rank"
  | "report"
  | "login"
  | "logout"
  | "register"
  | "sanction"
  | "reverse"
  | "export"
  | "delete"
  | "backup"
  | "alert"
  | "session";

export interface AuditRow {
  at: number;
  kind: AuditKind;
  actor: string;
  target?: string;
  matchId?: string;
  detail: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const logFile = join(here, "../../../../.data/audit.log");

export class Audit {
  private recent: AuditRow[] = [];

  write(row: Omit<AuditRow, "at">): void {
    const full: AuditRow = { at: Date.now(), ...row };
    this.recent.push(full);
    if (this.recent.length > 800) this.recent.shift();
    try {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(logFile, JSON.stringify(full) + "\n");
    } catch {
      /* disk */
    }
  }

  list(limit = 60, kind?: string, player?: string): AuditRow[] {
    return this.recent
      .filter((r) => (!kind || r.kind === kind) && (!player || r.actor === player || r.target === player))
      .slice(-limit);
  }
}

export const audit = new Audit();
