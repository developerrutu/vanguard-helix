import type { PenaltyKind, StaffRole } from "../../../shared/src/index";
import type { Store } from "../persist/store";
import type { Audit } from "./audit";
import type { Watch } from "./watch";

export interface Sanction {
  id: string;
  target: string;
  kind: PenaltyKind;
  reason: string;
  by: string;
  at: number;
  until: number;
  reversed?: { by: string; at: number };
}

export class ModDesk {
  private log: Sanction[] = [];

  constructor(
    private store: Store,
    private audit: Audit,
    private watch: Watch,
  ) {}

  issue(actor: string, target: string, kind: PenaltyKind, reason: string, hours: number): Sanction | string {
    const acc = this.store.byId(target);
    if (!acc || acc.contact) return "missing";
    const until = kind === "ban" ? Date.now() + 1000 * 60 * 60 * 24 * 365 * 40 : Date.now() + Math.max(1, hours) * 3600_000;
    const row: Sanction = {
      id: "sn_" + Date.now().toString(36),
      target,
      kind,
      reason: (reason || "policy").slice(0, 160),
      by: actor,
      at: Date.now(),
      until,
    };
    this.store.applySanction(target, kind, until, row.reason);
    this.log.push(row);
    this.audit.write({ kind: "sanction", actor, target, detail: `${kind} until=${until} ${row.reason}` });
    return row;
  }

  reverse(actor: string, target: string): string | null {
    const acc = this.store.byId(target);
    if (!acc) return "missing";
    this.store.clearSanction(target);
    const last = [...this.log].reverse().find((s) => s.target === target && !s.reversed);
    if (last) last.reversed = { by: actor, at: Date.now() };
    this.audit.write({ kind: "reverse", actor, target, detail: "sanction cleared" });
    return null;
  }

  of(target: string): Sanction[] {
    return this.log.filter((s) => s.target === target).slice(-20);
  }

  list(limit = 40): Sanction[] {
    return this.log.slice(-limit);
  }

  playerCard(id: string) {
    const acc = this.store.byId(id);
    if (!acc) return null;
    return {
      id: acc.id,
      name: acc.name,
      createdAt: acc.createdAt,
      lastRegion: acc.lastRegion,
      claimed: Boolean(acc.email),
      deleted: Boolean(acc.deletedAt),
      sanction: this.store.publicSanction(acc),
      watch: this.watch.dossier(id),
      stats: { matches: acc.stats.matches, wins: acc.stats.wins, mmr: Math.round(acc.mmr) },
      sanctions: this.of(id),
    };
  }
}

export function staffRoleOf(key: string | undefined, envKey: string): StaffRole | null {
  if (!key || !envKey) return null;
  if (key === envKey) return "admin";
  if (key === envKey + ":mod") return "moderator";
  if (key === envKey + ":view") return "viewer";
  return null;
}

export function staffCan(role: StaffRole, op: "read" | "write" | "admin"): boolean {
  if (op === "read") return true;
  if (op === "write") return role === "moderator" || role === "admin";
  return role === "admin";
}
