/** Part 12 — security contracts. The client is untrusted. */

import type { InputPayload } from "./protocol";

export const SESSION_IDLE_MS = 1000 * 60 * 60 * 4;
export const SESSION_ABS_MS = 1000 * 60 * 60 * 12;
export const SESSION_ROTATE_MS = 1000 * 60 * 60 * 2;
export const RECOVERY_TTL_MS = 1000 * 60 * 20;
export const MAX_SESSIONS = 6;
export const WS_MAX_BYTES = 16_384;
export const HTTP_MAX_BYTES = 32_768;

export const REPORT_REASONS = [
  "cheat",
  "harass",
  "hate",
  "grief",
  "exploit",
  "name",
  "clan",
  "spam",
  "language",
  "other",
] as const;
export type SecReportReason = (typeof REPORT_REASONS)[number];

export const PENALTIES = ["warning", "chat_mute", "queue_restrict", "suspend", "ban"] as const;
export type PenaltyKind = (typeof PENALTIES)[number];

export const STAFF_ROLES = ["viewer", "moderator", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const WATCH_KINDS = [
  "speed",
  "teleport",
  "aim",
  "wall",
  "packet",
  "ammo",
  "rate",
  "afk",
  "farm",
  "trade",
  "exploit",
  "report_abuse",
  "economy",
  "login",
  "session",
  "grief",
] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

export const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  session: { max: 10, window: 60_000 },
  register: { max: 4, window: 600_000 },
  login: { max: 8, window: 600_000 },
  recover: { max: 3, window: 600_000 },
  report: { max: 4, window: 600_000 },
  find: { max: 20, window: 60_000 },
  matchmake: { max: 6, window: 60_000 },
  friend: { max: 8, window: 60_000 },
  invite: { max: 6, window: 20_000 },
  chat: { max: 5, window: 8_000 },
  ws: { max: 90, window: 1_000 },
  staff: { max: 80, window: 60_000 },
  buy: { max: 12, window: 30_000 },
};

export type WatchAction = "observe" | "flag" | "review" | "restrict";

export function recommendAction(heat: number, signals: number): WatchAction {
  if (heat >= 20 && signals >= 3) return "restrict";
  if (heat >= 12 && signals >= 2) return "review";
  if (heat >= 6) return "flag";
  return "observe";
}

export function autoPunishForbidden(_action: WatchAction): boolean {
  return true;
}

export function playerIdOk(id: string): boolean {
  return /^p_[a-f0-9]{12}$/.test(id) || /^c_p_[a-f0-9]{12}_\d$/.test(id);
}

export function emailOk(raw: string): string | null {
  const e = (raw || "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return null;
  if (e.length > 80) return null;
  return e;
}

export function passwordOk(raw: string): boolean {
  return typeof raw === "string" && raw.length >= 8 && raw.length <= 72;
}

export function sanitizeInput(raw: Partial<InputPayload> | null | undefined): InputPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const seq = Number(raw.seq);
  const dt = Number(raw.dt);
  const moveX = Number(raw.moveX);
  const moveY = Number(raw.moveY);
  const lookX = Number(raw.lookX);
  const lookY = Number(raw.lookY);
  const buttons = Number(raw.buttons);
  if (![seq, dt, moveX, moveY, lookX, lookY, buttons].every((n) => Number.isFinite(n))) return null;
  if (seq < 0 || seq > 1e9) return null;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    seq: Math.floor(seq),
    dt: clamp(dt, 0, 0.08),
    moveX: clamp(moveX, -1, 1),
    moveY: clamp(moveY, -1, 1),
    lookX: clamp(lookX, -4, 4),
    lookY: clamp(lookY, -4, 4),
    buttons: buttons >>> 0,
  };
}

export function securityPublic() {
  return {
    rule: "The client is untrusted. Authority validates damage, health, position, ammo, results, XP, rank, currency, and inventory. No secrets ship in the browser.",
    layers: [
      "server_validation",
      "integrity_checks",
      "statistical",
      "behavioral",
      "network_anomaly",
      "client_integrity_optional",
      "manual_review",
    ],
    penalties: PENALTIES,
    reports: REPORT_REASONS,
    sessions: { expire: SESSION_ABS_MS, idle: SESSION_IDLE_MS, rotate: SESSION_ROTATE_MS, revoke: true },
    voice: "No auto-punish from a single statistic. Low confidence = more evidence or staff review.",
    privacy: ["export", "correct", "delete"],
    staff: STAFF_ROLES,
  };
}
