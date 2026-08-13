import { PLAYER_HEIGHT, PLAYER_RADIUS } from "./constants";
import type { MapData, Rect } from "./map";
import type { Loco } from "./operators";

export type Stance = "stand" | "crouch" | "prone";

export const MOVE = {
  walk: 3.4,
  run: 6.2,
  sprint: 9.0,
  crouch: 3.05,
  prone: 1.32,
  slide: 11.1,
  swim: 3.35,
  dive: 2.35,
  climb: 3.15,
  jump: 7.4,
  slideTime: 0.42,
  slideCd: 1.35,
  vaultTime: 0.38,
  vaultMaxH: 1.35,
  vaultMinH: 0.42,
  fallSafe: 5.4,
  fallDmg: 9,
  fallCap: 68,
  sprintSpread: 1.38,
  crouchSpread: 0.72,
  proneSpread: 0.55,
  slideSpread: 1.55,
} as const;

export function hitHeight(stance: Stance, flags: { slide?: number; downed?: boolean; vault?: number }): number {
  if (flags.downed) return 0.52;
  if ((flags.slide || 0) > 0) return 0.7;
  if ((flags.vault || 0) > 0) return 1.35;
  if (stance === "prone") return 0.48;
  if (stance === "crouch") return 1.12;
  return 1.75;
}

export function eyeOf(stance: Stance, slide = 0): number {
  if (slide > 0) return 0.55;
  if (stance === "prone") return 0.28;
  if (stance === "crouch") return 0.92;
  return PLAYER_HEIGHT * 0.88;
}

export function stanceSpeed(stance: Stance, sprint: boolean, slide: number, swim: boolean, dive: boolean): number {
  if (slide > 0) return MOVE.slide;
  if (swim) return dive ? MOVE.dive : MOVE.swim;
  if (stance === "prone") return MOVE.prone;
  if (stance === "crouch") return MOVE.crouch;
  if (sprint) return MOVE.sprint;
  return MOVE.run;
}

export function fireSpreadMul(stance: Stance, sprint: boolean, slide: number): number {
  if (slide > 0) return MOVE.slideSpread;
  if (sprint && stance === "stand") return MOVE.sprintSpread;
  if (stance === "prone") return MOVE.proneSpread;
  if (stance === "crouch") return MOVE.crouchSpread;
  return 1;
}

export function fallDamage(drop: number): number {
  if (drop <= MOVE.fallSafe) return 0;
  return Math.min(MOVE.fallCap, Math.round((drop - MOVE.fallSafe) * MOVE.fallDmg));
}

export function inRect(x: number, z: number, r: Rect): boolean {
  return Math.abs(x - r.x) <= r.hx && Math.abs(z - r.z) <= r.hz;
}

export function inWater(x: number, z: number, map: MapData): Rect | null {
  for (const w of map.water || []) if (inRect(x, z, w)) return w;
  return null;
}

export function climbAt(x: number, z: number, map: MapData): { x: number; z: number; hx: number; hz: number; h: number } | null {
  for (const c of map.climbs || []) if (inRect(x, z, c)) return c;
  return null;
}

export function findVault(
  x: number,
  z: number,
  yaw: number,
  map: MapData,
): { tx: number; tz: number; h: number } | null {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const ax = x + fx * 0.85;
  const az = z + fz * 0.85;
  for (const p of map.props) {
    const h = p.h ?? 1.6;
    if (h > MOVE.vaultMaxH || h < MOVE.vaultMinH) continue;
    if (!inRect(ax, az, p)) continue;
    return {
      tx: x + fx * (p.hx + p.hz + PLAYER_RADIUS * 2 + 0.35),
      tz: z + fz * (p.hx + p.hz + PLAYER_RADIUS * 2 + 0.35),
      h,
    };
  }
  return null;
}

export function locoOf(opts: {
  grounded: boolean;
  stance: Stance;
  sprint: boolean;
  slide: number;
  vault: number;
  climb: number;
  swim: boolean;
  speed: number;
  reviving?: boolean;
  emote?: boolean;
}): Loco {
  if (opts.emote) return "emote";
  if (opts.reviving) return "revive";
  if (opts.vault > 0) return "vault";
  if (opts.climb > 0) return "climb";
  if (opts.slide > 0) return "slide";
  if (!opts.grounded && !opts.swim) return opts.speed > 0.2 ? "jump" : "fall";
  if (opts.swim) return "swim";
  if (opts.stance === "prone") return "prone";
  if (opts.stance === "crouch") return "crouch";
  if (opts.sprint) return "sprint";
  if (opts.speed > 4.2) return "run";
  if (opts.speed > 0.35) return "walk";
  return "idle";
}
