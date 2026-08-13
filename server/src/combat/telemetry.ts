import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Row {
  id: string;
  picks: number;
  shots: number;
  hits: number;
  kills: number;
  damage: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "../../../.data/weapon_stats.json");

export class WeaponTelemetry {
  private rows = new Map<string, Row>();

  constructor() {
    try {
      if (existsSync(file)) {
        const raw = JSON.parse(readFileSync(file, "utf8")) as Row[];
        for (const r of raw) this.rows.set(r.id, r);
      }
    } catch {
      /* fresh */
    }
  }

  pick(id: string): void {
    this.row(id).picks += 1;
    this.flush();
  }

  shot(id: string): void {
    this.row(id).shots += 1;
  }

  hit(id: string, dmg: number): void {
    const r = this.row(id);
    r.hits += 1;
    r.damage += dmg;
    if (r.hits % 8 === 0) this.flush();
  }

  kill(id: string): void {
    this.row(id).kills += 1;
    this.flush();
  }

  snapshot(): Row[] {
    return [...this.rows.values()].map((r) => ({
      ...r,
      acc: r.shots ? r.hits / r.shots : 0,
    })) as Row[];
  }

  private row(id: string): Row {
    let r = this.rows.get(id);
    if (!r) {
      r = { id, picks: 0, shots: 0, hits: 0, kills: 0, damage: 0 };
      this.rows.set(id, r);
    }
    return r;
  }

  private flush(): void {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(this.snapshot(), null, 2));
    } catch {
      /* ignore */
    }
    void appendFileSync;
  }
}

export const telemetry = new WeaponTelemetry();
