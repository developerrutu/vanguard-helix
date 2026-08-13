import { ARENA_HALF, ARENA_WALL, PLAYER_RADIUS } from "./constants";

export interface Rect {
  x: number;
  z: number;
  hx: number;
  hz: number;
  h?: number;
}

export interface ClimbVol {
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
}

export interface MapData {
  id: string;
  half: number;
  walls: Rect[];
  props: Rect[];
  spawns: { x: number; z: number; yaw: number }[];
  pickups: { id: string; kind: string; x: number; z: number }[];
  water?: Rect[];
  climbs?: ClimbVol[];
  floors?: { x: number; z: number; hx: number; hz: number; y: number }[];
  doors?: { id: string; x: number; z: number; hx: number; hz: number; yaw: number }[];
  glass?: { id: string; x: number; z: number; hx: number; hz: number; h: number }[];
  surfaces?: { x: number; z: number; hx: number; hz: number; kind: string }[];
  landmarks?: { id: string; name: string; x: number; z: number }[];
  blockers?: Rect[];
}

export const TRAINING_RANGE: MapData = {
  id: "range",
  half: ARENA_HALF,
  walls: [
    { x: 0, z: -ARENA_HALF, hx: ARENA_HALF + ARENA_WALL, hz: ARENA_WALL },
    { x: 0, z: ARENA_HALF, hx: ARENA_HALF + ARENA_WALL, hz: ARENA_WALL },
    { x: -ARENA_HALF, z: 0, hx: ARENA_WALL, hz: ARENA_HALF + ARENA_WALL },
    { x: ARENA_HALF, z: 0, hx: ARENA_WALL, hz: ARENA_HALF + ARENA_WALL },
  ],
  props: [
    { x: -8, z: -6, hx: 1.4, hz: 1.4, h: 1.15 },
    { x: 7, z: -4, hx: 1.1, hz: 2.2, h: 1.2 },
    { x: 0, z: 8, hx: 2.4, hz: 0.7, h: 1.05 },
    { x: -12, z: 10, hx: 1.2, hz: 1.2, h: 1.1 },
    { x: 11, z: 6, hx: 1.6, hz: 1.0, h: 1.15 },
    { x: -16, z: -2, hx: 1.0, hz: 1.0, h: 3.2 },
  ],
  water: [{ x: 14, z: 14, hx: 4.2, hz: 3.6, h: 0.9 }],
  climbs: [{ x: -16, z: -0.2, hx: 0.55, hz: 1.4, h: 3.2 }],
  spawns: [
    { x: 0, z: 14, yaw: Math.PI },
    { x: -10, z: 12, yaw: 2.4 },
    { x: 10, z: 12, yaw: -2.4 },
    { x: 0, z: -14, yaw: 0 },
  ],
  pickups: [
    { id: "pk-repair-a", kind: "repair_kit", x: -6, z: 2 },
    { id: "pk-plates-a", kind: "plates", x: 6, z: 2 },
    { id: "pk-smoke-a", kind: "smoke", x: -4, z: 6 },
    { id: "pk-flash-a", kind: "flash", x: 4, z: 6 },
    { id: "pk-grip-a", kind: "grip_vert", x: 0, z: 4 },
  ],
};

export function circleHitsRect(px: number, pz: number, r: number, b: Rect): boolean {
  const dx = Math.max(Math.abs(px - b.x) - b.hx, 0);
  const dz = Math.max(Math.abs(pz - b.z) - b.hz, 0);
  return dx * dx + dz * dz < r * r;
}

export function resolveCircle(px: number, pz: number, r: number, map: MapData): { x: number; z: number } {
  let x = px;
  let z = pz;
  const solids = map.walls.concat(map.props, map.blockers || []);
  for (let i = 0; i < 3; i++) {
    for (const b of solids) {
      if (!circleHitsRect(x, z, r, b)) continue;
      const nx = x - b.x;
      const nz = z - b.z;
      const cx = clampAbs(nx, b.hx);
      const cz = clampAbs(nz, b.hz);
      let dx = x - (b.x + cx);
      let dz = z - (b.z + cz);
      const d = Math.hypot(dx, dz);
      if (d < 1e-6) {
        const pushX = Math.abs(nx) > Math.abs(nz);
        if (pushX) x = b.x + Math.sign(nx || 1) * (b.hx + r);
        else z = b.z + Math.sign(nz || 1) * (b.hz + r);
      } else {
        const pen = r - d;
        if (pen > 0) {
          x += (dx / d) * pen;
          z += (dz / d) * pen;
        }
      }
    }
  }
  return { x, z };
}

function clampAbs(v: number, h: number): number {
  if (v < -h) return -h;
  if (v > h) return h;
  return v;
}

export function hitscanBlocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  map: MapData,
  includeProps = false,
): boolean {
  const solids = includeProps ? map.walls.concat(map.props, map.blockers || []) : map.walls.concat(map.blockers || []);
  for (const s of solids) {
    if (segmentAabb(ax, az, bx, bz, s)) return true;
  }
  return false;
}

export function segmentAabb(ax: number, az: number, bx: number, bz: number, r: Rect): boolean {
  const xmin = r.x - r.hx;
  const xmax = r.x + r.hx;
  const zmin = r.z - r.hz;
  const zmax = r.z + r.hz;
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const planes: [number, number][] = [
    [-dx, ax - xmin],
    [dx, xmax - ax],
    [-dz, az - zmin],
    [dz, zmax - az],
  ];
  for (const [p, q] of planes) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

export const TEAM_SPAWNS = {
  alpha: [
    { x: -6, z: 16, yaw: Math.PI },
    { x: -2, z: 16, yaw: Math.PI },
    { x: 2, z: 16, yaw: Math.PI },
    { x: 6, z: 16, yaw: Math.PI },
  ],
  bravo: [
    { x: -6, z: -16, yaw: 0 },
    { x: -2, z: -16, yaw: 0 },
    { x: 2, z: -16, yaw: 0 },
    { x: 6, z: -16, yaw: 0 },
  ],
};

export { PLAYER_RADIUS };
