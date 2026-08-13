import { cpus } from "node:os";
import { ENGINE_NAME, ENGINE_VERSION, PROTOCOL_VERSION, TICK_HZ } from "../../../shared/src/index";

export type HelixEnv = "dev" | "test" | "staging" | "prod";

export interface CrashNote {
  at: number;
  build: string;
  browser: string;
  device: string;
  category: string;
  message: string;
}

export class Monitor {
  readonly env: HelixEnv = (process.env.HELIX_ENV as HelixEnv) || "dev";
  private crashes: CrashNote[] = [];
  private errors = 0;
  readonly started = Date.now();

  snapshot(extra: { ccu: number; rooms: number; queued: number; pending: number; accounts: number }) {
    const mem = process.memoryUsage();
    return {
      ok: true,
      env: this.env,
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      protocol: PROTOCOL_VERSION,
      tickHz: TICK_HZ,
      uptime: process.uptime(),
      cores: cpus().length,
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      errors: this.errors,
      crashes: this.crashes.slice(-8),
      ...extra,
    };
  }

  crash(raw: Partial<CrashNote>): CrashNote | null {
    const message = String(raw.message || "").replace(/\S+@\S+/g, "[redacted]").slice(0, 240);
    if (!message) return null;
    const note: CrashNote = {
      at: Date.now(),
      build: String(raw.build || ENGINE_VERSION).slice(0, 24),
      browser: String(raw.browser || "unknown").slice(0, 80),
      device: String(raw.device || "unknown").slice(0, 40),
      category: String(raw.category || "client").slice(0, 24),
      message,
    };
    this.crashes.push(note);
    this.errors += 1;
    if (this.crashes.length > 40) this.crashes.shift();
    return note;
  }
}

export const monitor = new Monitor();
