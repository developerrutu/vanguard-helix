export type Vec3 = { x: number; y: number; z: number };

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function length2(x: number, z: number): number {
  return Math.hypot(x, z);
}

export function normalize2(x: number, z: number): { x: number; z: number } {
  const l = Math.hypot(x, z);
  if (l < 1e-6) return { x: 0, z: 0 };
  return { x: x / l, z: z / l };
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

export function xpToLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 80)) + 1);
}

export function levelProgress(xp: number): number {
  const lvl = xpToLevel(xp);
  const lo = (lvl - 1) * (lvl - 1) * 80;
  const hi = lvl * lvl * 80;
  return clamp((xp - lo) / Math.max(1, hi - lo), 0, 1);
}
