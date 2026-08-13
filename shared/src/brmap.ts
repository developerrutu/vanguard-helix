import { ARENA_WALL } from "./constants";
import type { MapData, Rect } from "./map";

export const BR_HALF = 64;
export const MAP_NAME = "ORBIT YARD";

export interface Poi {
  id: string;
  name: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
}

export interface DeployPair {
  id: string;
  alpha: { x: number; z: number; yaw: number }[];
  bravo: { x: number; z: number; yaw: number }[];
}

function wallBox(half: number): Rect[] {
  return [
    { x: 0, z: -half, hx: half + ARENA_WALL, hz: ARENA_WALL },
    { x: 0, z: half, hx: half + ARENA_WALL, hz: ARENA_WALL },
    { x: -half, z: 0, hx: ARENA_WALL, hz: half + ARENA_WALL },
    { x: half, z: 0, hx: ARENA_WALL, hz: half + ARENA_WALL },
  ];
}

export const POIS: Poi[] = [
  { id: "depot", name: "DEPOT", x: -28, z: -22, hx: 6, hz: 5 },
  { id: "gardens", name: "GARDENS", x: 26, z: -24, hx: 7, hz: 5 },
  { id: "tower", name: "TOWER", x: 2, z: 4, hx: 4, hz: 4 },
  { id: "yard", name: "YARD", x: -24, z: 26, hx: 6, hz: 6 },
  { id: "docks", name: "DOCKS", x: 30, z: 22, hx: 7, hz: 4 },
  { id: "ruin", name: "RUIN", x: -4, z: -36, hx: 5, hz: 4 },
];

const props: Rect[] = [
  ...POIS.map((p) => ({ x: p.x, z: p.z, hx: p.hx, hz: p.hz })),
  { x: -12, z: 0, hx: 1.4, hz: 3.2 },
  { x: 14, z: 12, hx: 2.2, hz: 1.2 },
  { x: 8, z: -14, hx: 1.6, hz: 1.6 },
  { x: -36, z: 8, hx: 1.8, hz: 1.2 },
  { x: 40, z: -8, hx: 1.4, hz: 2.4 },
  { x: -8, z: 40, hx: 2.6, hz: 1.1 },
  { x: 18, z: 36, hx: 1.3, hz: 1.3, h: 1.1 },
  { x: -40, z: -36, hx: 2, hz: 1.4, h: 1.2 },
  { x: -12, z: 0, hx: 1.4, hz: 3.2, h: 1.2 },
  { x: 14, z: 12, hx: 2.2, hz: 1.2, h: 1.15 },
  { x: 8, z: -14, hx: 1.6, hz: 1.6, h: 1.1 },
];

const climbs = [
  { x: 2, z: 8.6, hx: 0.6, hz: 1.2, h: 3.4 },
  { x: -28, z: -16.2, hx: 0.55, hz: 1.1, h: 3.0 },
];

const water = [{ x: 30, z: 28, hx: 8, hz: 5, h: 0.85 }];

function cluster(cx: number, cz: number, yaw: number): { x: number; z: number; yaw: number }[] {
  return [
    { x: cx - 3.2, z: cz - 1.4, yaw },
    { x: cx - 1.0, z: cz + 1.6, yaw },
    { x: cx + 1.4, z: cz - 1.2, yaw },
    { x: cx + 3.4, z: cz + 1.2, yaw },
  ];
}

export const DEPLOYS: DeployPair[] = [
  {
    id: "n-s",
    alpha: cluster(0, 52, Math.PI),
    bravo: cluster(0, -52, 0),
  },
  {
    id: "e-w",
    alpha: cluster(-52, 0, Math.PI / 2),
    bravo: cluster(52, 0, -Math.PI / 2),
  },
  {
    id: "ne-sw",
    alpha: cluster(40, 40, -2.4),
    bravo: cluster(-40, -40, 0.7),
  },
  {
    id: "nw-se",
    alpha: cluster(-40, 40, 2.4),
    bravo: cluster(40, -40, -0.7),
  },
];

export function makeLootAnchors(): { x: number; z: number; hot: boolean }[] {
  const out: { x: number; z: number; hot: boolean }[] = [];
  for (const p of POIS) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({
        x: p.x + Math.cos(a) * (p.hx + 2.4),
        z: p.z + Math.sin(a) * (p.hz + 2.4),
        hot: true,
      });
    }
  }
  const rim = [
    [-48, -12],
    [-44, 18],
    [46, 8],
    [42, -30],
    [10, 50],
    [-16, -50],
    [0, 20],
    [-18, -8],
    [22, 0],
  ];
  for (const [x, z] of rim) out.push({ x, z, hot: false });
  return out;
}

export const ORBIT_YARD: MapData = {
  id: "orbit_yard",
  half: BR_HALF,
  walls: wallBox(BR_HALF),
  props,
  spawns: DEPLOYS[0].alpha,
  pickups: [],
  water,
  climbs,
};

export function pickDeploy(seed: number): DeployPair {
  return DEPLOYS[Math.abs(seed) % DEPLOYS.length];
}
