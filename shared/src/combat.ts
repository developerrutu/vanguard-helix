import { ATTACH, ZONE_MUL, weaponById, type AttachDef, type FireMode, type WeaponDef } from "./catalog";

export type HitZone = keyof typeof ZONE_MUL;

export interface WeaponMods {
  spread: number;
  recoil: number;
  ads: number;
  mag: number;
  reload: number;
  move: number;
  fov: number;
  suppress: boolean;
}

export function modsFrom(ids: string[]): WeaponMods {
  const m: WeaponMods = { spread: 1, recoil: 1, ads: 1, mag: 1, reload: 1, move: 1, fov: 1, suppress: false };
  const used = new Set<string>();
  for (const id of ids) {
    const a: AttachDef | undefined = ATTACH[id];
    if (!a || used.has(a.slot)) continue;
    used.add(a.slot);
    m.spread *= a.spread;
    m.recoil *= a.recoil;
    m.ads *= a.ads;
    m.mag *= a.mag;
    m.reload *= a.reload;
    m.move *= a.move;
    m.fov *= a.fov;
    if (a.suppress) m.suppress = true;
  }
  return m;
}

export function magSize(w: WeaponDef, mods: WeaponMods): number {
  return Math.max(1, Math.round(w.mag * mods.mag));
}

export function reloadTime(w: WeaponDef, empty: boolean, mods: WeaponMods): number {
  return (empty ? w.reloadEmpty : w.reload) * mods.reload;
}

export function falloff(w: WeaponDef, dist: number): number {
  if (dist <= w.falloffStart) return 1;
  if (dist >= w.falloffEnd) return w.falloffMin;
  const t = (dist - w.falloffStart) / Math.max(0.01, w.falloffEnd - w.falloffStart);
  return 1 - t * (1 - w.falloffMin);
}

export function hitZone(localY: number, radial: number, radius: number): HitZone {
  if (localY > 1.32) return "head";
  if (radial > radius * 0.7) return localY < 0.55 ? "legs" : "arms";
  if (localY > 0.92) return "upper";
  if (localY > 0.52) return "lower";
  return "legs";
}

export function zoneDamage(base: number, zone: HitZone, headMul: number): number {
  if (zone === "head") return base * headMul;
  return base * ZONE_MUL[zone];
}

export function nextMode(w: WeaponDef, cur: FireMode): FireMode {
  const i = w.fireModes.indexOf(cur);
  return w.fireModes[(i + 1 + w.fireModes.length) % w.fireModes.length] ?? w.mode;
}

export function recoilKick(w: WeaponDef, mods: WeaponMods, ads: boolean, shot: number): { yaw: number; pitch: number } {
  const scale = mods.recoil * (ads ? 0.72 : 1);
  const sign = shot % 2 === 0 ? 1 : -1;
  return {
    pitch: w.recoilV * scale * (0.85 + Math.random() * 0.3),
    yaw: w.recoilH * scale * sign * (0.6 + Math.random() * 0.8),
  };
}

export function cycleNade(cur: string, owned: string[]): string {
  if (!owned.length) return cur;
  const i = owned.indexOf(cur);
  return owned[(i + 1) % owned.length];
}

export function soundFor(id: string): "smg" | "ar" | "shot" | "sniper" | "pistol" | "melee" {
  const c = weaponById(id).class;
  if (c === "smg" || c === "machinepistol") return "smg";
  if (c === "shotgun") return "shot";
  if (c === "sniper" || c === "dmr") return "sniper";
  if (c === "melee") return "melee";
  if (c === "sidearm" || c === "revolver") return "pistol";
  return "ar";
}
