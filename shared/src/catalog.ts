export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type WeaponClass =
  | "melee"
  | "sidearm"
  | "machinepistol"
  | "revolver"
  | "smg"
  | "shotgun"
  | "rifle"
  | "lmg"
  | "dmr"
  | "sniper";
export type LootKind = "weapon" | "ammo" | "medical" | "armor" | "throwable" | "attachment" | "utility";
export type InvSlot = "primary" | "secondary" | "melee" | "grenade" | "medical" | "utility";
export type FireMode = "single" | "burst" | "auto";
export type Ballistic = "hitscan" | "projectile";
export type AttachSlot = "optic" | "barrel" | "mag" | "grip" | "stock";
export type NadeKind = "frag" | "smoke" | "flash" | "fire";

export interface WeaponDef {
  id: string;
  name: string;
  class: WeaponClass;
  slot: "primary" | "secondary" | "melee";
  interval: number;
  damage: number;
  range: number;
  spread: number;
  pellets: number;
  mag: number;
  reload: number;
  reloadEmpty: number;
  rarityMin: Rarity;
  headMul: number;
  fireModes: FireMode[];
  mode: FireMode;
  ballistic: Ballistic;
  speed: number;
  drop: number;
  pen: number;
  recoilV: number;
  recoilH: number;
  recov: number;
  adsSpread: number;
  adsMove: number;
  adsFov: number;
  weight: number;
  moveMul: number;
  swap: number;
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number;
  burst: number;
  lore: string;
  ricochet?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: LootKind;
  slot?: InvSlot;
  heal?: number;
  armorLevel?: 1 | 2 | 3;
  armorDura?: number;
  armorRepair?: number;
  nade?: boolean;
  nadeKind?: NadeKind;
  useTime?: number;
  desc: string;
  rarity: Rarity;
  attach?: AttachSlot;
}

export interface AttachDef {
  id: string;
  name: string;
  slot: AttachSlot;
  spread: number;
  recoil: number;
  ads: number;
  mag: number;
  reload: number;
  move: number;
  fov: number;
  suppress: boolean;
}

export interface SkuDef {
  id: string;
  name: string;
  costSoft: number;
  grants: { itemId: string; qty: number };
}

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b8c0cc",
  uncommon: "#3dff7a",
  rare: "#4da3ff",
  epic: "#c47dff",
  legendary: "#ffc14d",
};

function W(p: Partial<WeaponDef> & Pick<WeaponDef, "id" | "name" | "class" | "slot">): WeaponDef {
  const cls = p.class;
  const projectile = cls === "dmr" || cls === "sniper";
  return {
    interval: 0.16,
    damage: 16,
    range: 40,
    spread: 0.012,
    pellets: 1,
    mag: 24,
    reload: 1.6,
    reloadEmpty: 2.05,
    rarityMin: "common",
    headMul: 1.45,
    fireModes: ["auto"],
    mode: "auto",
    ballistic: projectile ? "projectile" : "hitscan",
    speed: projectile ? 420 : 0,
    drop: projectile ? 9 : 0,
    pen: 0,
    recoilV: 0.018,
    recoilH: 0.006,
    recov: 8,
    adsSpread: 0.45,
    adsMove: 0.62,
    adsFov: 0.82,
    weight: 3.4,
    moveMul: 1,
    swap: 0.42,
    falloffStart: 18,
    falloffEnd: 42,
    falloffMin: 0.62,
    burst: 3,
    lore: "",
    ...p,
  };
}

export const WEAPONS: Record<string, WeaponDef> = {
  knife: W({
    id: "knife",
    name: "Edgefold",
    class: "melee",
    slot: "melee",
    interval: 0.42,
    damage: 26,
    range: 1.8,
    mag: 0,
    reload: 0,
    reloadEmpty: 0,
    headMul: 1.12,
    fireModes: ["single"],
    mode: "single",
    recoilV: 0,
    recoilH: 0,
    weight: 0.6,
    moveMul: 1.06,
    swap: 0.28,
    lore: "Folded ceramic. Last argument in a hallway.",
  }),
  razor: W({
    id: "razor",
    name: "Razorline",
    class: "melee",
    slot: "melee",
    interval: 0.36,
    damage: 22,
    range: 2.05,
    mag: 0,
    rarityMin: "uncommon",
    headMul: 1.18,
    fireModes: ["single"],
    mode: "single",
    weight: 0.8,
    moveMul: 1.04,
    lore: "Mono-edge ribbon. Faster, thinner, meaner.",
  }),
  baton: W({
    id: "baton",
    name: "Arc Cane",
    class: "melee",
    slot: "melee",
    interval: 0.62,
    damage: 38,
    range: 2.2,
    mag: 0,
    rarityMin: "rare",
    headMul: 1.08,
    fireModes: ["single"],
    mode: "single",
    weight: 1.4,
    moveMul: 0.96,
    lore: "Capacitor baton. Heavy hit, loud crack, no magazine.",
  }),
  stitch: W({
    id: "stitch",
    name: "Stitch .9",
    class: "sidearm",
    slot: "secondary",
    interval: 0.17,
    damage: 15,
    range: 28,
    spread: 0.015,
    mag: 12,
    reload: 1.28,
    reloadEmpty: 1.55,
    headMul: 1.42,
    fireModes: ["single"],
    mode: "single",
    recoilV: 0.014,
    recoilH: 0.005,
    adsFov: 0.9,
    weight: 1.1,
    moveMul: 1.04,
    falloffStart: 12,
    falloffEnd: 26,
    lore: "Helix sidearm. Stitches problems, not people.",
  }),
  orbit: W({
    id: "orbit",
    name: "Orbit Compact",
    class: "sidearm",
    slot: "secondary",
    interval: 0.14,
    damage: 12,
    range: 22,
    spread: 0.02,
    mag: 16,
    reload: 1.15,
    rarityMin: "uncommon",
    headMul: 1.35,
    fireModes: ["single", "auto"],
    mode: "single",
    recoilV: 0.016,
    weight: 0.95,
    moveMul: 1.05,
    lore: "Pocket orbit. Fast, thin, hates distance.",
  }),
  staccato: W({
    id: "staccato",
    name: "Staccato",
    class: "machinepistol",
    slot: "secondary",
    interval: 0.055,
    damage: 9,
    range: 18,
    spread: 0.028,
    mag: 20,
    reload: 1.4,
    rarityMin: "rare",
    headMul: 1.28,
    fireModes: ["auto", "burst"],
    mode: "auto",
    recoilV: 0.022,
    recoilH: 0.014,
    weight: 1.3,
    moveMul: 1.02,
    falloffStart: 8,
    falloffEnd: 18,
    falloffMin: 0.48,
    lore: "A sentence with no commas. Hold only if you mean it.",
  }),
  crown: W({
    id: "crown",
    name: "Crown-6",
    class: "revolver",
    slot: "secondary",
    interval: 0.38,
    damage: 34,
    range: 36,
    spread: 0.008,
    mag: 6,
    reload: 2.15,
    reloadEmpty: 2.15,
    rarityMin: "epic",
    headMul: 1.6,
    fireModes: ["single"],
    mode: "single",
    ballistic: "hitscan",
    pen: 0.45,
    recoilV: 0.04,
    recoilH: 0.01,
    adsFov: 0.86,
    weight: 1.6,
    moveMul: 0.98,
    ricochet: true,
    lore: "Six chambers. Each one a verdict.",
  }),
  wisp: W({
    id: "wisp",
    name: "Wisp-9",
    class: "smg",
    slot: "primary",
    interval: 0.072,
    damage: 11,
    range: 26,
    spread: 0.019,
    mag: 28,
    reload: 1.38,
    reloadEmpty: 1.72,
    rarityMin: "uncommon",
    headMul: 1.32,
    fireModes: ["auto", "single"],
    recoilV: 0.015,
    recoilH: 0.01,
    weight: 2.4,
    moveMul: 1.05,
    falloffStart: 12,
    falloffEnd: 24,
    lore: "Light polymer ghost. Rules corridors, loses fields.",
  }),
  sable: W({
    id: "sable",
    name: "Sable Rush",
    class: "smg",
    slot: "primary",
    interval: 0.088,
    damage: 13,
    range: 30,
    spread: 0.016,
    mag: 24,
    reload: 1.48,
    rarityMin: "rare",
    headMul: 1.36,
    fireModes: ["auto", "burst"],
    recoilV: 0.017,
    recoilH: 0.007,
    weight: 2.7,
    moveMul: 1.03,
    lore: "Heavier SMG. Trades spray for a grown-up mid-range.",
  }),
  breachwake: W({
    id: "breachwake",
    name: "Breachwake",
    class: "shotgun",
    slot: "primary",
    interval: 0.7,
    damage: 8,
    range: 15,
    spread: 0.082,
    pellets: 6,
    mag: 6,
    reload: 2.05,
    reloadEmpty: 2.4,
    rarityMin: "uncommon",
    headMul: 1.18,
    fireModes: ["single"],
    mode: "single",
    recoilV: 0.045,
    adsSpread: 0.7,
    adsFov: 0.92,
    weight: 3.8,
    moveMul: 0.94,
    falloffStart: 5,
    falloffEnd: 14,
    falloffMin: 0.22,
    lore: "Door opener. Past eight meters it becomes a rumor.",
  }),
  hollow: W({
    id: "hollow",
    name: "Hollow-12",
    class: "shotgun",
    slot: "primary",
    interval: 0.92,
    damage: 10,
    range: 18,
    spread: 0.06,
    pellets: 5,
    mag: 5,
    reload: 2.25,
    rarityMin: "rare",
    headMul: 1.22,
    fireModes: ["single"],
    mode: "single",
    recoilV: 0.05,
    weight: 4.1,
    moveMul: 0.92,
    falloffStart: 6,
    falloffEnd: 16,
    falloffMin: 0.28,
    lore: "Tighter cone. Slower. Still not a sniper.",
  }),
  virex: W({
    id: "virex",
    name: "Virex Pulse",
    class: "rifle",
    slot: "primary",
    interval: 0.108,
    damage: 16,
    range: 46,
    spread: 0.011,
    mag: 30,
    reload: 1.58,
    reloadEmpty: 2.0,
    rarityMin: "rare",
    headMul: 1.45,
    fireModes: ["auto", "single"],
    pen: 0.25,
    recoilV: 0.019,
    recoilH: 0.007,
    weight: 3.5,
    moveMul: 0.98,
    falloffStart: 22,
    falloffEnd: 48,
    lore: "House rifle of Helix. Honest recoil, no miracles.",
  }),
  aegis: W({
    id: "aegis",
    name: "Aegis Line",
    class: "rifle",
    slot: "primary",
    interval: 0.132,
    damage: 19,
    range: 52,
    spread: 0.009,
    mag: 26,
    reload: 1.7,
    rarityMin: "epic",
    headMul: 1.48,
    fireModes: ["auto", "burst", "single"],
    pen: 0.35,
    recoilV: 0.021,
    recoilH: 0.005,
    adsFov: 0.78,
    weight: 3.8,
    moveMul: 0.96,
    lore: "Heavier pulse. Burst mode for people who practice.",
  }),
  nadir: W({
    id: "nadir",
    name: "Nadir-C",
    class: "rifle",
    slot: "primary",
    interval: 0.095,
    damage: 14,
    range: 40,
    spread: 0.013,
    mag: 32,
    reload: 1.5,
    rarityMin: "uncommon",
    headMul: 1.4,
    fireModes: ["auto"],
    recoilV: 0.016,
    recoilH: 0.009,
    weight: 3.2,
    moveMul: 1.0,
    lore: "Budget line. More noise than authority.",
  }),
  maw: W({
    id: "maw",
    name: "Maw-220",
    class: "lmg",
    slot: "primary",
    interval: 0.095,
    damage: 15,
    range: 50,
    spread: 0.018,
    mag: 60,
    reload: 2.85,
    reloadEmpty: 3.4,
    rarityMin: "rare",
    headMul: 1.3,
    fireModes: ["auto"],
    pen: 0.4,
    recoilV: 0.024,
    recoilH: 0.012,
    adsMove: 0.45,
    adsFov: 0.84,
    weight: 7.2,
    moveMul: 0.82,
    swap: 0.7,
    lore: "A moving bunker. You do not sprint. You occupy.",
  }),
  circlet: W({
    id: "circlet",
    name: "Circlet Heavy",
    class: "lmg",
    slot: "primary",
    interval: 0.12,
    damage: 18,
    range: 55,
    spread: 0.014,
    mag: 48,
    reload: 3.05,
    rarityMin: "epic",
    headMul: 1.34,
    fireModes: ["auto", "single"],
    pen: 0.5,
    recoilV: 0.02,
    weight: 6.6,
    moveMul: 0.84,
    lore: "Belt-fed discipline. Anchors a lane.",
  }),
  kite: W({
    id: "kite",
    name: "Kite Spire",
    class: "dmr",
    slot: "primary",
    interval: 0.3,
    damage: 29,
    range: 78,
    spread: 0.004,
    mag: 12,
    reload: 1.85,
    reloadEmpty: 2.2,
    rarityMin: "epic",
    headMul: 1.58,
    fireModes: ["single"],
    mode: "single",
    ballistic: "projectile",
    speed: 460,
    drop: 8.5,
    pen: 0.55,
    recoilV: 0.028,
    adsFov: 0.62,
    weight: 4.4,
    moveMul: 0.93,
    falloffStart: 40,
    falloffEnd: 78,
    falloffMin: 0.78,
    lore: "Marks the wind. Misses teach faster than hits.",
  }),
  meridian: W({
    id: "meridian",
    name: "Meridian",
    class: "dmr",
    slot: "primary",
    interval: 0.24,
    damage: 24,
    range: 70,
    spread: 0.005,
    mag: 16,
    reload: 1.75,
    rarityMin: "rare",
    headMul: 1.5,
    fireModes: ["single", "burst"],
    mode: "single",
    ballistic: "projectile",
    speed: 430,
    drop: 9.2,
    pen: 0.4,
    adsFov: 0.68,
    weight: 4.0,
    lore: "Softer DMR. Burst if you can count.",
  }),
  longbow: W({
    id: "longbow",
    name: "Longbow Apex",
    class: "sniper",
    slot: "primary",
    interval: 1.12,
    damage: 52,
    range: 96,
    spread: 0.0015,
    mag: 5,
    reload: 2.45,
    reloadEmpty: 2.9,
    rarityMin: "legendary",
    headMul: 1.75,
    fireModes: ["single"],
    mode: "single",
    ballistic: "projectile",
    speed: 520,
    drop: 11,
    pen: 0.7,
    recoilV: 0.055,
    adsFov: 0.42,
    adsMove: 0.38,
    weight: 5.6,
    moveMul: 0.88,
    swap: 0.72,
    falloffStart: 60,
    falloffEnd: 96,
    falloffMin: 0.85,
    ricochet: true,
    lore: "One note, long silence. Precision is the magazine.",
  }),
  aperture: W({
    id: "aperture",
    name: "Aperture",
    class: "sniper",
    slot: "primary",
    interval: 1.35,
    damage: 62,
    range: 110,
    spread: 0.001,
    mag: 4,
    reload: 2.7,
    rarityMin: "legendary",
    headMul: 1.85,
    fireModes: ["single"],
    mode: "single",
    ballistic: "projectile",
    speed: 560,
    drop: 12.5,
    pen: 0.8,
    recoilV: 0.062,
    adsFov: 0.34,
    adsMove: 0.32,
    weight: 6.4,
    moveMul: 0.84,
    lore: "Sees further than you should. Punishes greed.",
  }),
};

// Back-compat ids used by range / older loot.
WEAPONS.p9 = { ...WEAPONS.stitch, id: "p9" };
WEAPONS.vector = { ...WEAPONS.wisp, id: "vector" };
WEAPONS.carbine = { ...WEAPONS.virex, id: "carbine" };
WEAPONS.scatter = { ...WEAPONS.breachwake, id: "scatter" };
WEAPONS.dmr = { ...WEAPONS.kite, id: "dmr" };

export const ATTACH: Record<string, AttachDef> = {
  red_dot: { id: "red_dot", name: "Red Dot", slot: "optic", spread: 0.88, recoil: 1, ads: 1, mag: 1, reload: 1, move: 1, fov: 0.86, suppress: false },
  holo: { id: "holo", name: "Holo", slot: "optic", spread: 0.9, recoil: 1, ads: 0.96, mag: 1, reload: 1, move: 1, fov: 0.84, suppress: false },
  scope2: { id: "scope2", name: "2x Spire", slot: "optic", spread: 0.82, recoil: 1.04, ads: 0.92, mag: 1, reload: 1, move: 0.98, fov: 0.7, suppress: false },
  scope4: { id: "scope4", name: "4x Meridian", slot: "optic", spread: 0.75, recoil: 1.08, ads: 0.86, mag: 1, reload: 1, move: 0.95, fov: 0.52, suppress: false },
  scope8: { id: "scope8", name: "8x Aperture", slot: "optic", spread: 0.68, recoil: 1.12, ads: 0.78, mag: 1, reload: 1, move: 0.9, fov: 0.36, suppress: false },
  suppressor: { id: "suppressor", name: "Hush Barrel", slot: "barrel", spread: 0.96, recoil: 1.06, ads: 1, mag: 1, reload: 1, move: 0.99, fov: 1, suppress: true },
  compensator: { id: "compensator", name: "Compensator", slot: "barrel", spread: 0.94, recoil: 0.82, ads: 1, mag: 1, reload: 1, move: 1, fov: 1, suppress: false },
  flash_hider: { id: "flash_hider", name: "Veil Brake", slot: "barrel", spread: 0.97, recoil: 0.92, ads: 1, mag: 1, reload: 1, move: 1, fov: 1, suppress: false },
  mag_ext: { id: "mag_ext", name: "Deep Mag", slot: "mag", spread: 1, recoil: 1.04, ads: 1, mag: 1.32, reload: 1.08, move: 0.98, fov: 1, suppress: false },
  mag_fast: { id: "mag_fast", name: "Quick Mag", slot: "mag", spread: 1, recoil: 1, ads: 1, mag: 0.92, reload: 0.78, move: 1, fov: 1, suppress: false },
  grip_vert: { id: "grip_vert", name: "Vert Grip", slot: "grip", spread: 0.96, recoil: 0.78, ads: 1, mag: 1, reload: 1, move: 0.99, fov: 1, suppress: false },
  grip_angle: { id: "grip_angle", name: "Angle Grip", slot: "grip", spread: 0.93, recoil: 0.9, ads: 0.9, mag: 1, reload: 1, move: 1, fov: 1, suppress: false },
  grip_tac: { id: "grip_tac", name: "Tac Grip", slot: "grip", spread: 0.95, recoil: 0.88, ads: 0.94, mag: 1, reload: 0.96, move: 1, fov: 1, suppress: false },
  stock_stable: { id: "stock_stable", name: "Anchor Stock", slot: "stock", spread: 0.92, recoil: 0.84, ads: 0.96, mag: 1, reload: 1, move: 0.94, fov: 1, suppress: false },
  stock_light: { id: "stock_light", name: "Light Stock", slot: "stock", spread: 1.04, recoil: 1.08, ads: 1.06, mag: 1, reload: 1, move: 1.08, fov: 1, suppress: false },
  reflex: { id: "reflex", name: "Red Dot", slot: "optic", spread: 0.88, recoil: 1, ads: 1, mag: 1, reload: 1, move: 1, fov: 0.86, suppress: false },
};

export const ITEMS: Record<string, ItemDef> = {
  bandage: { id: "bandage", name: "Weave Patch", kind: "medical", slot: "medical", heal: 15, useTime: 2.2, rarity: "common", desc: "Field wrap. No regen." },
  medkit: { id: "medkit", name: "Helix Kit", kind: "medical", slot: "medical", heal: 55, useTime: 4.5, rarity: "rare", desc: "Trauma pack." },
  repair_kit: { id: "repair_kit", name: "Helix Kit", kind: "medical", slot: "medical", heal: 55, useTime: 4.5, rarity: "rare", desc: "Range alias." },
  armor_kit: { id: "armor_kit", name: "Plate Cement", kind: "utility", slot: "utility", armorRepair: 40, useTime: 3.2, rarity: "uncommon", desc: "Restores vest durability." },
  armor1: { id: "armor1", name: "Level 1 Vest", kind: "armor", armorLevel: 1, armorDura: 50, rarity: "common", desc: "20% soak." },
  armor2: { id: "armor2", name: "Level 2 Vest", kind: "armor", armorLevel: 2, armorDura: 80, rarity: "rare", desc: "35% soak." },
  armor3: { id: "armor3", name: "Level 3 Vest", kind: "armor", armorLevel: 3, armorDura: 110, rarity: "epic", desc: "45% soak." },
  plates: { id: "plates", name: "Level 1 Vest", kind: "armor", armorLevel: 1, armorDura: 50, rarity: "common", desc: "Range alias." },
  frag: { id: "frag", name: "Shiver Charge", kind: "throwable", slot: "grenade", nade: true, nadeKind: "frag", rarity: "uncommon", desc: "Bounce, roll, bite." },
  smoke: { id: "smoke", name: "Veil Can", kind: "throwable", slot: "grenade", nade: true, nadeKind: "smoke", rarity: "uncommon", desc: "Kills sight, not people." },
  flash: { id: "flash", name: "Whiteout", kind: "throwable", slot: "grenade", nade: true, nadeKind: "flash", rarity: "uncommon", desc: "Blind by angle and range." },
  incendiary: { id: "incendiary", name: "Cinder Pot", kind: "throwable", slot: "grenade", nade: true, nadeKind: "fire", rarity: "rare", desc: "Leaves a burning disk." },
  beacon: { id: "beacon", name: "Tactical Beacon", kind: "utility", slot: "utility", rarity: "rare", desc: "Pings your team a hold point." },
  recon: { id: "recon", name: "Recon Seed", kind: "utility", slot: "utility", rarity: "epic", desc: "Briefly marks nearest foe." },
  ammo_light: { id: "ammo_light", name: "Light Cells", kind: "ammo", rarity: "common", desc: "+18 light." },
  ammo_heavy: { id: "ammo_heavy", name: "Heavy Cells", kind: "ammo", rarity: "common", desc: "+12 heavy." },
};

for (const a of Object.values(ATTACH)) {
  ITEMS[a.id] = {
    id: a.id,
    name: a.name,
    kind: "attachment",
    rarity: a.slot === "optic" && a.fov < 0.5 ? "epic" : "uncommon",
    desc: a.slot + " attachment",
    attach: a.slot,
  };
}

export const SKUS: Record<string, SkuDef> = {
  buy_repair: { id: "buy_repair", name: "Helix Kit", costSoft: 30, grants: { itemId: "medkit", qty: 1 } },
  buy_plates: { id: "buy_plates", name: "Level 1 Vest", costSoft: 40, grants: { itemId: "armor1", qty: 1 } },
};

export const ARMOR_SOAK = { 0: 0, 1: 0.2, 2: 0.35, 3: 0.45 } as const;

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 46,
  uncommon: 28,
  rare: 16,
  epic: 8,
  legendary: 2,
};

export const ZONE_MUL = {
  head: 1.0,
  upper: 0.78,
  lower: 0.62,
  arms: 0.48,
  legs: 0.42,
} as const;

export function rarityAtLeast(have: Rarity, need: Rarity): boolean {
  return RARITY_ORDER.indexOf(have) >= RARITY_ORDER.indexOf(need);
}

export function weaponById(id: string): WeaponDef {
  return WEAPONS[id] ?? WEAPONS.stitch;
}
