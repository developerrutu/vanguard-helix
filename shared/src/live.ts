/** Part 15 — live ops. Honest status. Player data survives seasons. */

import { ENGINE_VERSION, PROTOCOL_VERSION } from "./constants";
import { SEASON_ID, SEASON_NAME } from "./progress";

export type ShipState = "implemented" | "partial" | "not_yet";
export type FeedbackKind = "bug" | "suggest" | "balance" | "support" | "security";
export type BugSev = "critical" | "high" | "medium" | "low" | "cosmetic";
export type Channel = "dev" | "staging" | "beta" | "prod";

export interface FeatureRow {
  id: string;
  name: string;
  state: ShipState;
  note: string;
}

export interface SeasonPlan {
  id: number;
  name: string;
  theme: string;
  state: "live" | "planned";
  keeps: string[];
}

export interface LiveEvent {
  id: string;
  name: string;
  kind: "ion_surge" | "challenge" | "cosmetic" | "community";
  start: string;
  end: string;
  ionMul: number;
  note: string;
  matchmaking: "unchanged";
}

export interface PatchNote {
  version: string;
  at: string;
  title: string;
  fixes: string[];
  balance: string[];
  content: string[];
  known: string[];
}

export const KEEP_ACROSS_SEASONS = [
  "player_id",
  "username",
  "friends",
  "clan",
  "inventory",
  "statistics",
  "achievements",
  "progression",
  "rank_history",
] as const;

export const FEATURES: FeatureRow[] = [
  { id: "web", name: "Website + boot", state: "implemented", note: "Vite shell, PWA, landscape overlay." },
  { id: "account", name: "Account + Player ID", state: "implemented", note: "Guest + claim. Server-minted p_[12 hex]." },
  { id: "menu", name: "Main menu / profile", state: "implemented", note: "Orbit Trace. Barracks, boards." },
  { id: "social", name: "Friends / party / clan", state: "implemented", note: "Search, invites, block, report, chat." },
  { id: "voice", name: "Voice chat", state: "partial", note: "Speaking flag + mute. No WebRTC media yet." },
  { id: "matchmake", name: "Matchmaking", state: "implemented", note: "Quick / ranked / bots / range. Ping region." },
  { id: "match", name: "4v4 match loop", state: "implemented", note: "Queue → lobby → deploy → circle → results." },
  { id: "bots", name: "Bot fill", state: "implemented", note: "Minds, cover, loot, revive. Ranked is humans-only." },
  { id: "combat", name: "Core combat", state: "implemented", note: "Hitscan + projectile, nades, revive, authority ammo." },
  { id: "maps", name: "Maps", state: "implemented", note: "Iron City, Red Sands, Frost Haven. Playlist rotates." },
  { id: "modes", name: "Extra modes", state: "not_yet", note: "Only Team BR + range. LTMs are data-ready, not wired." },
  { id: "hud", name: "HUD / audio", state: "implemented", note: "Orbit Trace + Helix mixer." },
  { id: "progress", name: "XP / rank / mastery", state: "implemented", note: "Helix Rating, challenges, achievements." },
  { id: "economy", name: "ION / ORBIT / Vault", state: "implemented", note: "Cosmetic only. Sandbox top-up." },
  { id: "payments", name: "Real payments", state: "not_yet", note: "No PSP. Card data must never hit Helix." },
  { id: "security", name: "Sessions / Watch / staff", state: "implemented", note: "No auto-ban. Staff API exists." },
  { id: "db", name: "Durable database", state: "partial", note: "Transactional JSON store. Postgres is the scale-out." },
  { id: "regions", name: "Multi-region hosts", state: "partial", note: "Directory + probes. Demo is one box." },
  { id: "support", name: "Human support desk", state: "partial", note: "In-game ticket. No password ever asked." },
  { id: "legal", name: "ToS / privacy pages", state: "not_yet", note: "Architecture ready. Counsel not shipped." },
  { id: "closed_test", name: "Closed test / open beta", state: "not_yet", note: "Playable now. Population not opened." },
  { id: "launch", name: "Public launch", state: "not_yet", note: "Do not call this release-ready." },
];

export const SEASONS: SeasonPlan[] = [
  { id: 1, name: "ORBIT", theme: "Launch yard. Three maps. Honest guns.", state: "live", keeps: [...KEEP_ACROSS_SEASONS] },
  { id: 2, name: "RIME", theme: "Cosmetics + weekend events.", state: "planned", keeps: [...KEEP_ACROSS_SEASONS] },
  { id: 3, name: "GRID", theme: "New map content.", state: "planned", keeps: [...KEEP_ACROSS_SEASONS] },
  { id: 4, name: "SPIRE", theme: "Weapons + competitive tweaks.", state: "planned", keeps: [...KEEP_ACROSS_SEASONS] },
  { id: 5, name: "APEX", theme: "Major map expansion.", state: "planned", keeps: [...KEEP_ACROSS_SEASONS] },
];

export const EVENTS: LiveEvent[] = [
  {
    id: "ion_surge_s1",
    name: "Ion Surge",
    kind: "ion_surge",
    start: "2026-08-01T00:00:00Z",
    end: "2026-09-01T00:00:00Z",
    ionMul: 2,
    note: "Daily ION ×2. Matchmaking unchanged.",
    matchmaking: "unchanged",
  },
];

export const NOTES: PatchNote[] = [
  {
    version: "15.0.0",
    at: "2026-08-13",
    title: "Live ops desk",
    fixes: ["Protocol 15. Season desk, events, notes, feedback."],
    balance: ["No weapon numbers changed without telemetry."],
    content: ["Season 1 ORBIT remains live. S2–S5 planned only."],
    known: ["Voice is mute-only. Payments are sandbox. Not a public launch."],
  },
  {
    version: "14.0.0",
    at: "2026-08-13",
    title: "Stack lock",
    fixes: ["WebGL2 gate. Update Required on proto mismatch."],
    balance: [],
    content: [],
    known: ["Single-box regions."],
  },
];

export const QUALITY_TARGETS = {
  loadSec: 10,
  fpsMin: 30,
  fpsStd: 60,
  tickHz: 30,
  joinAfterFoundSec: 5,
  crashRate: "measure, do not assume",
};

export const PIPELINE = ["concept", "design", "prototype", "production", "optimize", "test", "integrate", "qa", "release"] as const;

export const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "suggest", "balance", "support", "security"];

export function liveNow(iso: string, now = Date.now()): boolean {
  const a = Date.parse(iso);
  return Number.isFinite(a) && a <= now;
}

export function liveBetween(start: string, end: string, now = Date.now()): boolean {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && now >= a && now < b;
}

export function activeEvents(now = Date.now()): LiveEvent[] {
  return EVENTS.filter((e) => liveBetween(e.start, e.end, now));
}

export function ionDailyMul(now = Date.now()): number {
  return activeEvents(now).reduce((n, e) => Math.max(n, e.ionMul || 1), 1);
}

export function currentSeason(): SeasonPlan {
  return SEASONS.find((s) => s.id === SEASON_ID) || SEASONS[0];
}

export function scrubFeedback(raw: string): string {
  return (raw || "").replace(/\S+@\S+/g, "[redacted]").replace(/password\s*[:=]\s*\S+/gi, "[redacted]").slice(0, 400);
}

export function assetOriginalOk(meta: { copied?: boolean; licensed?: boolean; luma?: number; power?: boolean }): string | null {
  if (meta.copied) return "copied";
  if (meta.power) return "power";
  if (meta.luma !== undefined && meta.luma < 0.18) return "invis";
  if (meta.licensed === false) return "rights";
  return null;
}

export function counts(): { implemented: number; partial: number; not_yet: number } {
  return {
    implemented: FEATURES.filter((f) => f.state === "implemented").length,
    partial: FEATURES.filter((f) => f.state === "partial").length,
    not_yet: FEATURES.filter((f) => f.state === "not_yet").length,
  };
}

export function livePublic() {
  const season = currentSeason();
  return {
    rule: "Ship a playable slice. Do not fake launch. Seasons never wipe Player ID, friends, clan, inventory, stats, or rank history.",
    version: ENGINE_VERSION,
    protocol: PROTOCOL_VERSION,
    season: { id: season.id, name: season.name || SEASON_NAME, theme: season.theme, state: season.state },
    roadmap: SEASONS,
    events: activeEvents(),
    notes: NOTES,
    features: FEATURES,
    counts: counts(),
    quality: QUALITY_TARGETS,
    pipeline: PIPELINE,
    feedback: FEEDBACK_KINDS,
    launch: "not_yet" as ShipState,
    channels: ["dev", "staging", "beta", "prod"] as Channel[],
  };
}

export type LivePublic = ReturnType<typeof livePublic>;
