import { recommendAction, type WatchAction, type WatchKind } from "../../../shared/src/index";
import type { Flag, FlagKind } from "../anticheat/flags";
import type { Audit } from "./audit";

export interface Alert {
  at: number;
  playerId: string;
  name: string;
  heat: number;
  signals: number;
  action: WatchAction;
  kinds: WatchKind[];
  detail: string;
}

export class Watch {
  private heat = new Map<string, number>();
  private kinds = new Map<string, Set<WatchKind>>();
  private names = new Map<string, string>();
  private reportsFrom = new Map<string, number[]>();
  private afk = new Map<string, number[]>();
  private alerts: Alert[] = [];

  constructor(private audit: Audit) {}

  ingest(flag: Flag): void {
    const kind = (flag.kind as WatchKind) || "exploit";
    const next = (this.heat.get(flag.playerId) || 0) + flag.severity;
    this.heat.set(flag.playerId, next);
    const set = this.kinds.get(flag.playerId) || new Set<WatchKind>();
    set.add(kind);
    this.kinds.set(flag.playerId, set);
    this.names.set(flag.playerId, flag.name);
    const action = recommendAction(next, set.size);
    if (action === "observe") return;
    const alert: Alert = {
      at: Date.now(),
      playerId: flag.playerId,
      name: flag.name,
      heat: next,
      signals: set.size,
      action,
      kinds: [...set],
      detail: flag.detail,
    };
    this.alerts.push(alert);
    if (this.alerts.length > 200) this.alerts.shift();
    this.audit.write({
      kind: "alert",
      actor: "watch",
      target: flag.playerId,
      detail: `${action} heat=${next} ${kind} ${flag.detail}`,
    });
  }

  reportFrom(reporterId: string): "ok" | "rate" | "abuse" {
    const now = Date.now();
    const list = (this.reportsFrom.get(reporterId) || []).filter((t) => now - t < 600_000);
    if (list.length >= 8) {
      this.ingest({
        at: now,
        playerId: reporterId,
        name: this.names.get(reporterId) || reporterId,
        kind: "client" as FlagKind,
        detail: "mass reports",
        severity: 3,
      });
      this.reportsFrom.set(reporterId, list);
      return "abuse";
    }
    if (list.length >= 4) {
      this.reportsFrom.set(reporterId, list);
      return "rate";
    }
    list.push(now);
    this.reportsFrom.set(reporterId, list);
    return "ok";
  }

  noteAfk(id: string, name: string): void {
    const now = Date.now();
    const list = (this.afk.get(id) || []).filter((t) => now - t < 86_400_000);
    list.push(now);
    this.afk.set(id, list);
    if (list.length >= 3) {
      this.ingest({
        at: now,
        playerId: id,
        name,
        kind: "afk",
        detail: `${list.length} AFK matches in 24h — review only`,
        severity: 1,
      });
    }
  }

  heatOf(id: string): number {
    return this.heat.get(id) || 0;
  }

  dossier(id: string): { heat: number; kinds: WatchKind[]; action: WatchAction } {
    const kinds = [...(this.kinds.get(id) || [])];
    const heat = this.heat.get(id) || 0;
    return { heat, kinds, action: recommendAction(heat, kinds.length) };
  }

  list(limit = 40): Alert[] {
    return this.alerts.slice(-limit);
  }
}
