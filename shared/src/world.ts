import { ARENA_WALL } from "./constants";
import type { MapData, Rect } from "./map";
import type { DeployPair } from "./brmap";

export type Surface = "concrete" | "dirt" | "sand" | "snow" | "metal" | "grass" | "water";
export type WeatherId =
  | "clear"
  | "rain"
  | "night"
  | "sunny"
  | "dust"
  | "sunset"
  | "snow"
  | "blizzard"
  | "winter";
export type MapId = "iron_city" | "red_sands" | "frost_haven" | "orbit_yard" | "range";

export interface Floor {
  x: number;
  z: number;
  hx: number;
  hz: number;
  y: number;
}

export interface DoorDef {
  id: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
}

export interface GlassDef {
  id: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
}

export interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface SurfacePatch {
  x: number;
  z: number;
  hx: number;
  hz: number;
  kind: Surface;
}

export interface Palette {
  ground: string;
  wall: string;
  accent: string;
  fog: string;
  sky: string;
  hemi: string;
  sun: string;
  water: string;
}

export interface WorldDef extends MapData {
  mapId: MapId;
  title: string;
  theme: string;
  combat: string;
  palette: Palette;
  weathers: WeatherId[];
  landmarks: Landmark[];
  floors: Floor[];
  doors: DoorDef[];
  glass: GlassDef[];
  surfaces: SurfacePatch[];
  deploys: DeployPair[];
  lootAnchors: { x: number; z: number; hot: boolean }[];
}

export interface PlaylistSlot {
  mapId: MapId;
  weather: WeatherId;
}

/**
 * Ranked map select = rotating playlist (Option C).
 * A (random) breaks practice/VODs. B (vote) adds lobby delay and stack-gaming.
 * C is knowable from match #, weather is a look not a stat, esports-ready.
 */
export const PLAYLIST: PlaylistSlot[] = [
  { mapId: "iron_city", weather: "clear" },
  { mapId: "red_sands", weather: "sunny" },
  { mapId: "frost_haven", weather: "winter" },
  { mapId: "iron_city", weather: "rain" },
  { mapId: "red_sands", weather: "sunset" },
  { mapId: "frost_haven", weather: "snow" },
  { mapId: "iron_city", weather: "night" },
  { mapId: "red_sands", weather: "dust" },
  { mapId: "frost_haven", weather: "blizzard" },
];

export function pickPlaylist(matchNumber: number): PlaylistSlot {
  const i = Math.abs(matchNumber - 1) % PLAYLIST.length;
  return PLAYLIST[i];
}

function wallBox(half: number): Rect[] {
  return [
    { x: 0, z: -half, hx: half + ARENA_WALL, hz: ARENA_WALL, h: 8 },
    { x: 0, z: half, hx: half + ARENA_WALL, hz: ARENA_WALL, h: 8 },
    { x: -half, z: 0, hx: ARENA_WALL, hz: half + ARENA_WALL, h: 8 },
    { x: half, z: 0, hx: ARENA_WALL, hz: half + ARENA_WALL, h: 8 },
  ];
}

function cluster(cx: number, cz: number, yaw: number): { x: number; z: number; yaw: number }[] {
  return [
    { x: cx - 3.2, z: cz - 1.4, yaw },
    { x: cx - 1.0, z: cz + 1.6, yaw },
    { x: cx + 1.4, z: cz - 1.2, yaw },
    { x: cx + 3.4, z: cz + 1.2, yaw },
  ];
}

function pair(id: string, ax: number, az: number, ay: number, bx: number, bz: number, by: number): DeployPair {
  return { id, alpha: cluster(ax, az, ay), bravo: cluster(bx, bz, by) };
}

function anchorsAround(spots: { x: number; z: number; r: number; hot: boolean }[]): { x: number; z: number; hot: boolean }[] {
  const out: { x: number; z: number; hot: boolean }[] = [];
  for (const s of spots) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({ x: s.x + Math.cos(a) * s.r, z: s.z + Math.sin(a) * s.r, hot: s.hot });
    }
  }
  return out;
}

function building(x: number, z: number, hx: number, hz: number, h: number, gap: "n" | "s" | "e" | "w"): Rect[] {
  const t = 0.55;
  const walls: Rect[] = [];
  if (gap !== "n") walls.push({ x, z: z + hz - t / 2, hx, hz: t, h });
  if (gap !== "s") walls.push({ x, z: z - hz + t / 2, hx, hz: t, h });
  if (gap !== "e") walls.push({ x: x + hx - t / 2, z, hx: t, hz, h });
  if (gap !== "w") walls.push({ x: x - hx + t / 2, z, hx: t, hz, h });
  return walls;
}

const CITY_PAL: Palette = {
  ground: "#1a1d24",
  wall: "#2a3140",
  accent: "#3d4a5c",
  fog: "#0c1018",
  sky: "#141c28",
  hemi: "#8aa4c8",
  sun: "#d8e6ff",
  water: "#1a3a52",
};

const SAND_PAL: Palette = {
  ground: "#c4a06a",
  wall: "#8a6a44",
  accent: "#6b4e32",
  fog: "#d8c08a",
  sky: "#e8c878",
  hemi: "#f0d8a0",
  sun: "#ffe0a0",
  water: "#4a6a6a",
};

const FROST_PAL: Palette = {
  ground: "#d8e4ee",
  wall: "#8aa0b4",
  accent: "#5a7388",
  fog: "#c8d8e8",
  sky: "#b8cce0",
  hemi: "#e8f2ff",
  sun: "#f4fbff",
  water: "#7aa8c8",
};

export const IRON_CITY: WorldDef = {
  mapId: "iron_city",
  id: "iron_city",
  title: "IRON CITY",
  theme: "Futuristic urban warfare",
  combat: "Close / mid / vertical",
  half: 66,
  palette: CITY_PAL,
  weathers: ["clear", "rain", "night"],
  walls: [
    ...wallBox(66),
    ...building(0, 2, 9, 7, 6.2, "s"),
    ...building(30, 30, 6, 6, 9.5, "w"),
    ...building(-30, -26, 8, 5, 3.6, "n"),
    ...building(-32, 28, 7, 6, 4.2, "e"),
    ...building(32, -28, 7, 6, 5.0, "n"),
  ],
  props: [
    { x: -3, z: 2, hx: 1.1, hz: 1.1, h: 1.15 },
    { x: 3.2, z: 0.4, hx: 1.0, hz: 1.4, h: 1.1 },
    { x: 28, z: 30, hx: 0.9, hz: 0.9, h: 1.2 },
    { x: -30, z: -22, hx: 1.2, hz: 0.5, h: 1.0 },
    { x: -28, z: 26, hx: 1.4, hz: 0.45, h: 0.9 },
    { x: -28, z: 30, hx: 1.4, hz: 0.45, h: 0.9 },
    { x: 30, z: -24, hx: 1.2, hz: 1.2, h: 1.25 },
    { x: 34, z: -30, hx: 0.8, hz: 2.0, h: 2.4 },
    { x: 18, z: 0, hx: 1.2, hz: 4.2, h: 1.15 },
    { x: -16, z: 8, hx: 1.1, hz: 3.4, h: 1.1 },
    { x: 6, z: -18, hx: 2.2, hz: 0.7, h: 1.05 },
    { x: -8, z: -14, hx: 1.0, hz: 1.0, h: 1.2 },
    { x: 22, z: 16, hx: 1.3, hz: 1.3, h: 1.15 },
    { x: -22, z: 12, hx: 0.9, hz: 2.2, h: 1.1 },
    { x: 0, z: 22, hx: 2.6, hz: 0.55, h: 1.0 },
    { x: 10, z: 36, hx: 1.1, hz: 1.1, h: 1.2 },
    { x: -12, z: -36, hx: 1.4, hz: 0.8, h: 1.05 },
    { x: 40, z: 8, hx: 1.0, hz: 2.4, h: 1.3 },
    { x: -40, z: -8, hx: 1.0, hz: 2.4, h: 1.3 },
  ],
  floors: [
    { x: 0, z: 2, hx: 8.2, hz: 6.2, y: 3.35 },
    { x: 30, z: 30, hx: 5.2, hz: 5.2, y: 5.8 },
    { x: 32, z: -28, hx: 6.2, hz: 5.2, y: 3.4 },
  ],
  climbs: [
    { x: 0, z: 8.4, hx: 0.6, hz: 1.1, h: 3.35 },
    { x: 24.2, z: 30, hx: 1.1, hz: 0.55, h: 5.8 },
    { x: 32, z: -22.2, hx: 0.55, hz: 1.1, h: 3.4 },
  ],
  water: [{ x: -30, z: -32, hx: 5, hz: 3.2, h: 0.7 }],
  doors: [
    { id: "ic_grid_s", x: 0, z: -4.6, hx: 1.2, hz: 0.18, yaw: 0 },
    { id: "ic_spire_w", x: 24.2, z: 30, hx: 0.18, hz: 1.1, yaw: 1.57 },
    { id: "ic_metro_n", x: -30, z: -21.2, hx: 1.4, hz: 0.18, yaw: 0 },
    { id: "ic_lot_e", x: -25.2, z: 28, hx: 0.18, hz: 1.2, yaw: 1.57 },
    { id: "ic_site_n", x: 32, z: -22.2, hx: 1.3, hz: 0.18, yaw: 0 },
  ],
  glass: [
    { id: "ic_g1", x: 4.4, z: 8.4, hx: 1.6, hz: 0.08, h: 2.2 },
    { id: "ic_g2", x: -4.4, z: 8.4, hx: 1.6, hz: 0.08, h: 2.2 },
    { id: "ic_g3", x: 35.4, z: 30, hx: 0.08, hz: 1.8, h: 2.4 },
  ],
  surfaces: [
    { x: 0, z: 0, hx: 66, hz: 66, kind: "concrete" },
    { x: 32, z: -28, hx: 8, hz: 7, kind: "metal" },
    { x: -30, z: -32, hx: 6, hz: 4, kind: "metal" },
  ],
  landmarks: [
    { id: "grid", name: "GRID", x: 0, z: 2 },
    { id: "spire", name: "SPIRE", x: 30, z: 30 },
    { id: "metro", name: "METRO", x: -30, z: -26 },
    { id: "lot", name: "LOT", x: -32, z: 28 },
    { id: "site", name: "SITE", x: 32, z: -28 },
    { id: "rail", name: "RAIL", x: 18, z: 0 },
  ],
  deploys: [
    pair("n-s", 0, 56, Math.PI, 0, -56, 0),
    pair("e-w", -56, 0, Math.PI / 2, 56, 0, -Math.PI / 2),
    pair("ne-sw", 40, 48, -2.4, -40, -48, 0.7),
    pair("nw-se", -40, 48, 2.4, 40, -48, -0.7),
  ],
  lootAnchors: anchorsAround([
    { x: 0, z: 2, r: 10, hot: true },
    { x: 30, z: 30, r: 8, hot: true },
    { x: -30, z: -26, r: 8, hot: true },
    { x: -32, z: 28, r: 8, hot: true },
    { x: 32, z: -28, r: 8, hot: true },
    { x: 18, z: 0, r: 5, hot: false },
    { x: -18, z: 16, r: 5, hot: false },
    { x: 0, z: -40, r: 6, hot: false },
  ]),
  spawns: cluster(0, 56, Math.PI),
  pickups: [],
};

export const RED_SANDS: WorldDef = {
  mapId: "red_sands",
  id: "red_sands",
  title: "RED SANDS",
  theme: "Desert military conflict",
  combat: "Long range / open rotations",
  half: 78,
  palette: SAND_PAL,
  weathers: ["sunny", "dust", "sunset"],
  walls: [
    ...wallBox(78),
    ...building(0, 36, 10, 7, 4.4, "s"),
    ...building(-8, -38, 6, 5, 3.2, "n"),
    ...building(8, -36, 5, 4, 3.0, "n"),
    ...building(42, 8, 5, 5, 7.2, "w"),
    ...building(4, 2, 7, 5, 3.8, "e"),
    { x: -44, z: 4, hx: 2.4, hz: 8, h: 4.6 },
  ],
  props: [
    { x: -4, z: 34, hx: 1.2, hz: 1.2, h: 1.15 },
    { x: 4, z: 32, hx: 1.4, hz: 0.7, h: 1.0 },
    { x: 0, z: -32, hx: 1.1, hz: 1.1, h: 1.1 },
    { x: 38, z: 8, hx: 0.8, hz: 0.8, h: 1.2 },
    { x: -38, z: 4, hx: 1.2, hz: 1.2, h: 1.15 },
    { x: 10, z: 2, hx: 0.7, hz: 1.6, h: 1.2 },
    { x: 22, z: -16, hx: 1.6, hz: 1.6, h: 1.25 },
    { x: -18, z: 16, hx: 1.4, hz: 1.4, h: 1.1 },
    { x: 16, z: 22, hx: 2.0, hz: 0.55, h: 1.0 },
    { x: -22, z: -12, hx: 0.7, hz: 3.2, h: 1.15 },
    { x: 0, z: -12, hx: 2.4, hz: 0.6, h: 0.95 },
    { x: 30, z: 30, hx: 1.1, hz: 1.1, h: 1.2 },
    { x: -30, z: -24, hx: 1.2, hz: 1.2, h: 1.1 },
    { x: 48, z: -20, hx: 1.5, hz: 0.7, h: 1.05 },
    { x: -50, z: 22, hx: 1.3, hz: 1.3, h: 1.2 },
  ],
  floors: [
    { x: 0, z: 36, hx: 9, hz: 6, y: 3.2 },
    { x: 42, z: 8, hx: 4.4, hz: 4.4, y: 5.4 },
    { x: -44, z: 4, hx: 2.0, hz: 7.2, y: 4.5 },
  ],
  climbs: [
    { x: 0, z: 29.2, hx: 0.7, hz: 1.0, h: 3.2 },
    { x: 37.2, z: 8, hx: 1.0, hz: 0.55, h: 5.4 },
    { x: -41.4, z: 4, hx: 0.7, hz: 1.0, h: 4.5 },
  ],
  water: [],
  doors: [
    { id: "rs_fort_s", x: 0, z: 29.2, hx: 1.4, hz: 0.18, yaw: 0 },
    { id: "rs_dish_w", x: 37.2, z: 8, hx: 0.18, hz: 1.1, yaw: 1.57 },
    { id: "rs_well_n", x: -8, z: -33.2, hx: 1.2, hz: 0.18, yaw: 0 },
    { id: "rs_rig_e", x: 10.6, z: 2, hx: 0.18, hz: 1.2, yaw: 1.57 },
  ],
  glass: [
    { id: "rs_g1", x: 6.4, z: 42.4, hx: 2.0, hz: 0.08, h: 2.0 },
    { id: "rs_g2", x: 46.4, z: 8, hx: 0.08, hz: 1.6, h: 2.2 },
  ],
  surfaces: [
    { x: 0, z: 0, hx: 78, hz: 78, kind: "sand" },
    { x: 0, z: 36, hx: 12, hz: 9, kind: "concrete" },
    { x: 42, z: 8, hx: 6, hz: 6, kind: "metal" },
    { x: -44, z: 4, hx: 4, hz: 9, kind: "dirt" },
  ],
  landmarks: [
    { id: "fort", name: "FORT", x: 0, z: 36 },
    { id: "well", name: "WELL", x: 0, z: -36 },
    { id: "dish", name: "DISH", x: 42, z: 8 },
    { id: "cut", name: "CUT", x: -44, z: 4 },
    { id: "rig", name: "RIG", x: 4, z: 2 },
  ],
  deploys: [
    pair("n-s", 0, 68, Math.PI, 0, -68, 0),
    pair("e-w", -68, 0, Math.PI / 2, 68, 0, -Math.PI / 2),
    pair("ne-sw", 50, 54, -2.4, -50, -54, 0.7),
    pair("nw-se", -50, 54, 2.4, 50, -54, -0.7),
  ],
  lootAnchors: anchorsAround([
    { x: 0, z: 36, r: 11, hot: true },
    { x: 0, z: -36, r: 9, hot: true },
    { x: 42, z: 8, r: 7, hot: true },
    { x: -44, z: 4, r: 8, hot: true },
    { x: 4, z: 2, r: 8, hot: true },
    { x: 22, z: -16, r: 5, hot: false },
    { x: -22, z: 18, r: 5, hot: false },
    { x: 50, z: -30, r: 6, hot: false },
  ]),
  spawns: cluster(0, 68, Math.PI),
  pickups: [],
};

export const FROST_HAVEN: WorldDef = {
  mapId: "frost_haven",
  id: "frost_haven",
  title: "FROST HAVEN",
  theme: "Mountain and snow warfare",
  combat: "Mixed range / high ground",
  half: 70,
  palette: FROST_PAL,
  weathers: ["winter", "snow", "blizzard"],
  walls: [
    ...wallBox(70),
    ...building(-24, 28, 7, 6, 3.8, "s"),
    ...building(-10, 30, 5, 5, 3.4, "s"),
    ...building(28, 32, 4, 4, 8.4, "s"),
    ...building(30, -30, 8, 6, 4.0, "n"),
    { x: -36, z: -8, hx: 3.2, hz: 8, h: 5.2 },
  ],
  props: [
    { x: -18, z: 24, hx: 1.1, hz: 1.1, h: 1.1 },
    { x: 4, z: -2, hx: 10, hz: 0.7, h: 0.55 },
    { x: -4, z: 6, hx: 0.7, hz: 6, h: 0.55 },
    { x: 28, z: 28, hx: 0.8, hz: 0.8, h: 1.2 },
    { x: 26, z: -26, hx: 1.2, hz: 1.2, h: 1.15 },
    { x: -32, z: -8, hx: 1.0, hz: 1.4, h: 1.2 },
    { x: 16, z: 10, hx: 1.4, hz: 1.4, h: 1.1 },
    { x: -8, z: -22, hx: 1.2, hz: 1.2, h: 1.15 },
    { x: 12, z: -14, hx: 2.0, hz: 0.55, h: 1.0 },
    { x: -16, z: 8, hx: 0.7, hz: 2.6, h: 1.1 },
    { x: 40, z: 8, hx: 1.1, hz: 1.1, h: 1.2 },
    { x: -40, z: 24, hx: 1.3, hz: 0.8, h: 1.05 },
    { x: 8, z: 40, hx: 1.2, hz: 1.2, h: 1.1 },
  ],
  floors: [
    { x: 4, z: 2, hx: 9, hz: 7, y: 0.12 },
    { x: 28, z: 32, hx: 3.4, hz: 3.4, y: 6.2 },
    { x: 30, z: -30, hx: 7.2, hz: 5.2, y: 3.2 },
    { x: -36, z: -8, hx: 2.6, hz: 7.2, y: 5.1 },
    { x: -24, z: 28, hx: 6.2, hz: 5.2, y: 3.0 },
  ],
  climbs: [
    { x: 28, z: 28.2, hx: 0.55, hz: 1.0, h: 6.2 },
    { x: 30, z: -24.2, hx: 0.7, hz: 1.0, h: 3.2 },
    { x: -32.6, z: -8, hx: 0.8, hz: 1.0, h: 5.1 },
    { x: -24, z: 22.2, hx: 0.7, hz: 1.0, h: 3.0 },
  ],
  water: [{ x: 2, z: 2, hx: 11, hz: 9, h: 0.85 }],
  doors: [
    { id: "fh_hall_s", x: -24, z: 22.2, hx: 1.3, hz: 0.18, yaw: 0 },
    { id: "fh_mast_s", x: 28, z: 28.2, hx: 1.1, hz: 0.18, yaw: 0 },
    { id: "fh_lab_n", x: 30, z: -24.2, hx: 1.4, hz: 0.18, yaw: 0 },
  ],
  glass: [
    { id: "fh_g1", x: -24, z: 33.4, hx: 2.2, hz: 0.08, h: 2.0 },
    { id: "fh_g2", x: 31.6, z: 32, hx: 0.08, hz: 1.4, h: 2.4 },
    { id: "fh_g3", x: 30, z: -35.4, hx: 2.4, hz: 0.08, h: 2.0 },
  ],
  surfaces: [
    { x: 0, z: 0, hx: 70, hz: 70, kind: "snow" },
    { x: 2, z: 2, hx: 11, hz: 9, kind: "water" },
    { x: 28, z: 32, hx: 5, hz: 5, kind: "metal" },
    { x: 30, z: -30, hx: 9, hz: 7, kind: "concrete" },
  ],
  landmarks: [
    { id: "hall", name: "HALL", x: -24, z: 28 },
    { id: "mirror", name: "MIRROR", x: 2, z: 2 },
    { id: "mast", name: "MAST", x: 28, z: 32 },
    { id: "lab", name: "LAB", x: 30, z: -30 },
    { id: "pass", name: "PASS", x: -36, z: -8 },
  ],
  deploys: [
    pair("n-s", 0, 60, Math.PI, 0, -60, 0),
    pair("e-w", -60, 0, Math.PI / 2, 60, 0, -Math.PI / 2),
    pair("ne-sw", 44, 48, -2.4, -44, -48, 0.7),
    pair("nw-se", -44, 48, 2.4, 44, -48, -0.7),
  ],
  lootAnchors: anchorsAround([
    { x: -24, z: 28, r: 8, hot: true },
    { x: 2, z: 2, r: 10, hot: true },
    { x: 28, z: 32, r: 6, hot: true },
    { x: 30, z: -30, r: 8, hot: true },
    { x: -36, z: -8, r: 8, hot: true },
    { x: 16, z: 10, r: 5, hot: false },
    { x: -8, z: -22, r: 5, hot: false },
    { x: 40, z: 8, r: 5, hot: false },
  ]),
  spawns: cluster(0, 60, Math.PI),
  pickups: [],
};

export const WORLDS: Record<string, WorldDef> = {
  iron_city: IRON_CITY,
  red_sands: RED_SANDS,
  frost_haven: FROST_HAVEN,
};

export function worldById(id: string): WorldDef {
  return WORLDS[id] ?? IRON_CITY;
}

export function pickWorld(matchNumber: number): { world: WorldDef; weather: WeatherId; deploy: DeployPair } {
  const slot = pickPlaylist(matchNumber);
  const world = worldById(slot.mapId);
  const deploy = world.deploys[Math.abs(matchNumber) % world.deploys.length];
  return { world, weather: slot.weather, deploy };
}

export function liveMap(w: WorldDef): WorldDef {
  return {
    ...w,
    walls: w.walls.map((r) => ({ ...r })),
    props: w.props.map((r) => ({ ...r })),
    floors: w.floors.map((r) => ({ ...r })),
    doors: w.doors.map((r) => ({ ...r })),
    glass: w.glass.map((r) => ({ ...r })),
    surfaces: w.surfaces.map((r) => ({ ...r })),
    water: (w.water || []).map((r) => ({ ...r })),
    climbs: (w.climbs || []).map((r) => ({ ...r })),
    blockers: [],
  };
}

export function syncBlockers(map: MapData, open: Record<string, boolean>, broken: Set<string> | string[]): void {
  const dead = broken instanceof Set ? broken : new Set(broken);
  const blockers: Rect[] = [];
  for (const d of map.doors || []) {
    if (!open[d.id]) blockers.push({ x: d.x, z: d.z, hx: d.hx, hz: d.hz, h: 2.4 });
  }
  for (const g of map.glass || []) {
    if (!dead.has(g.id)) blockers.push({ x: g.x, z: g.z, hx: g.hx, hz: g.hz, h: g.h });
  }
  map.blockers = blockers;
}

export function surfaceAt(x: number, z: number, map: MapData): Surface {
  const patches = map.surfaces || [];
  for (let i = patches.length - 1; i >= 0; i--) {
    const s = patches[i];
    if (Math.abs(x - s.x) <= s.hx && Math.abs(z - s.z) <= s.hz) return s.kind as Surface;
  }
  return "concrete";
}

export function floorAt(x: number, z: number, y: number, floors: Floor[] | undefined): Floor | null {
  if (!floors) return null;
  let best: Floor | null = null;
  for (const f of floors) {
    if (Math.abs(x - f.x) > f.hx || Math.abs(z - f.z) > f.hz) continue;
    if (y + 0.18 < f.y) continue;
    if (y - f.y > 1.85) continue;
    if (!best || f.y > best.y) best = f;
  }
  return best;
}

export const WEATHER_LOOK: Record<
  WeatherId,
  { fog: number; fogFar: number; dim: number; particles: "none" | "rain" | "snow" | "dust"; sky?: string; sun?: string }
> = {
  clear: { fog: 28, fogFar: 160, dim: 1, particles: "none" },
  rain: { fog: 18, fogFar: 120, dim: 0.82, particles: "rain", sky: "#10161e" },
  night: { fog: 16, fogFar: 110, dim: 0.52, particles: "none", sky: "#05070c", sun: "#6a7a9a" },
  sunny: { fog: 32, fogFar: 180, dim: 1.08, particles: "none" },
  dust: { fog: 14, fogFar: 100, dim: 0.8, particles: "dust", sky: "#c9b07a" },
  sunset: { fog: 22, fogFar: 140, dim: 0.9, particles: "none", sky: "#c86840", sun: "#ffb070" },
  snow: { fog: 16, fogFar: 110, dim: 0.88, particles: "snow" },
  blizzard: { fog: 12, fogFar: 90, dim: 0.74, particles: "snow", sky: "#9aacbc" },
  winter: { fog: 24, fogFar: 140, dim: 1, particles: "none" },
};

export function mapsPublic() {
  return {
    selection: "playlist" as const,
    reason:
      "Ranked uses a rotating playlist seeded by match number. Random would break practice and VOD review. Voting adds lobby delay and can be stacked. Weather is a visual variant on the same geometry — never a damage or movement change.",
    playlist: PLAYLIST,
    maps: [IRON_CITY, RED_SANDS, FROST_HAVEN].map((m) => ({
      id: m.mapId,
      title: m.title,
      theme: m.theme,
      combat: m.combat,
      half: m.half,
      weathers: m.weathers,
      landmarks: m.landmarks.map((l) => l.name),
    })),
  };
}
