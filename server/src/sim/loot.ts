import {
  ITEMS,
  RARITY_ORDER,
  RARITY_WEIGHT,
  WEAPONS,
  makeLootAnchors,
  rarityAtLeast,
  type Rarity,
} from "../../../shared/src/index";

export interface WorldLoot {
  id: string;
  defId: string;
  kind: string;
  rarity: Rarity;
  label: string;
  x: number;
  z: number;
  live: boolean;
  ammo: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRarity(rand: () => number, hot: boolean): Rarity {
  const weights = RARITY_ORDER.map((r) => {
    let w = RARITY_WEIGHT[r];
    if (hot && (r === "rare" || r === "epic" || r === "legendary")) w *= 1.55;
    if (!hot && r === "common") w *= 1.5;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let n = rand() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    n -= weights[i];
    if (n <= 0) return RARITY_ORDER[i];
  }
  return "common";
}

const POOL: { defId: string; kind: string; min: Rarity }[] = [
  { defId: "stitch", kind: "weapon", min: "common" },
  { defId: "orbit", kind: "weapon", min: "uncommon" },
  { defId: "staccato", kind: "weapon", min: "rare" },
  { defId: "crown", kind: "weapon", min: "epic" },
  { defId: "wisp", kind: "weapon", min: "uncommon" },
  { defId: "sable", kind: "weapon", min: "rare" },
  { defId: "breachwake", kind: "weapon", min: "uncommon" },
  { defId: "hollow", kind: "weapon", min: "rare" },
  { defId: "nadir", kind: "weapon", min: "uncommon" },
  { defId: "virex", kind: "weapon", min: "rare" },
  { defId: "aegis", kind: "weapon", min: "epic" },
  { defId: "maw", kind: "weapon", min: "rare" },
  { defId: "circlet", kind: "weapon", min: "epic" },
  { defId: "meridian", kind: "weapon", min: "rare" },
  { defId: "kite", kind: "weapon", min: "epic" },
  { defId: "longbow", kind: "weapon", min: "legendary" },
  { defId: "aperture", kind: "weapon", min: "legendary" },
  { defId: "razor", kind: "weapon", min: "uncommon" },
  { defId: "baton", kind: "weapon", min: "rare" },
  { defId: "bandage", kind: "medical", min: "common" },
  { defId: "medkit", kind: "medical", min: "rare" },
  { defId: "armor_kit", kind: "utility", min: "uncommon" },
  { defId: "armor1", kind: "armor", min: "common" },
  { defId: "armor2", kind: "armor", min: "rare" },
  { defId: "armor3", kind: "armor", min: "epic" },
  { defId: "frag", kind: "throwable", min: "uncommon" },
  { defId: "smoke", kind: "throwable", min: "uncommon" },
  { defId: "flash", kind: "throwable", min: "uncommon" },
  { defId: "incendiary", kind: "throwable", min: "rare" },
  { defId: "beacon", kind: "utility", min: "rare" },
  { defId: "recon", kind: "utility", min: "epic" },
  { defId: "ammo_light", kind: "ammo", min: "common" },
  { defId: "ammo_heavy", kind: "ammo", min: "common" },
  { defId: "red_dot", kind: "attachment", min: "uncommon" },
  { defId: "holo", kind: "attachment", min: "uncommon" },
  { defId: "scope2", kind: "attachment", min: "rare" },
  { defId: "scope4", kind: "attachment", min: "rare" },
  { defId: "scope8", kind: "attachment", min: "epic" },
  { defId: "suppressor", kind: "attachment", min: "rare" },
  { defId: "compensator", kind: "attachment", min: "uncommon" },
  { defId: "mag_ext", kind: "attachment", min: "rare" },
  { defId: "mag_fast", kind: "attachment", min: "uncommon" },
  { defId: "grip_vert", kind: "attachment", min: "uncommon" },
  { defId: "stock_stable", kind: "attachment", min: "rare" },
  { defId: "stock_light", kind: "attachment", min: "uncommon" },
];

export function generateLoot(seed: number, anchorsIn?: { x: number; z: number; hot: boolean }[]): WorldLoot[] {
  const rand = rng(seed);
  const anchors = anchorsIn && anchorsIn.length ? anchorsIn : makeLootAnchors();
  const out: WorldLoot[] = [];
  let n = 0;
  for (const a of anchors) {
    if (rand() < 0.1) continue;
    const rarity = pickRarity(rand, a.hot);
    const options = POOL.filter((p) => rarityAtLeast(rarity, p.min));
    const pick = options[Math.floor(rand() * options.length)] ?? POOL[0];
    const w = WEAPONS[pick.defId];
    const item = ITEMS[pick.defId];
    out.push({
      id: "lt_" + n++,
      defId: pick.defId,
      kind: pick.kind,
      rarity,
      label: (w?.name || item?.name || pick.defId) + (rarity === "legendary" ? " ★" : ""),
      x: a.x + (rand() - 0.5) * 1.4,
      z: a.z + (rand() - 0.5) * 1.4,
      live: true,
      ammo: w ? w.mag : 0,
    });
  }
  return out;
}
