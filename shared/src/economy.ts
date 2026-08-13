/** Part 13 — Orbit Vault. Cosmetic-only. Client never writes balances. */

import { SEASON_ID, SEASON_NAME, dayKey } from "./progress";

export const ION_NAME = "ION";
export const ORBIT_NAME = "ORBIT";
export const PASS_TIERS = 100;
export const PASS_XP_PER_TIER = 80;
export const DAILY_ION = 40;
export const DAILY_XP = 20;

export type PayCoin = "ion" | "orbit";
export type VaultKind =
  | "outfit"
  | "weapon"
  | "emote"
  | "banner"
  | "effect"
  | "title"
  | "frame"
  | "bundle"
  | "pass"
  | "topup";
export type VaultRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type VaultLane = "featured" | "operators" | "weapons" | "emotes" | "banners" | "effects" | "bundles" | "pass";

export interface VaultItem {
  id: string;
  name: string;
  kind: VaultKind;
  rarity: VaultRarity;
  coin: PayCoin;
  price: number;
  lane: VaultLane;
  collection: string;
  tint: string;
  luma: number;
  grants: string[];
  permanent: boolean;
  cosmetic: true;
  desc: string;
  listIon?: number;
  listOrbit?: number;
}

export interface Quote {
  sku: string;
  name: string;
  qty: number;
  coin: PayCoin;
  unit: number;
  total: number;
  list: number;
  save: number;
  permanent: boolean;
  cosmetic: boolean;
  restriction: string;
}

export interface PassTier {
  tier: number;
  free: { kind: string; id: string; qty: number; name: string };
  premium: { kind: string; id: string; qty: number; name: string };
}

export interface WalletPublic {
  ion: number;
  orbit: number;
  owned: string[];
  pass: { season: number; premium: boolean; tier: number; xp: number };
  daily: { ready: boolean; next: string; ionMul: number };
  trade: "disabled";
  gift: "disabled";
}

const V = (
  p: Omit<VaultItem, "cosmetic" | "permanent" | "grants"> & { grants?: string[]; permanent?: boolean },
): VaultItem => ({
  cosmetic: true,
  permanent: p.permanent !== false,
  grants: p.grants ?? [p.id],
  ...p,
});

export const VAULT: VaultItem[] = [
  V({ id: "duty", name: "Duty Plate", kind: "outfit", rarity: "common", coin: "ion", price: 0, lane: "operators", collection: "tactical", tint: "#1b2430", luma: 0.22, desc: "Issue kit. Free with every operator." }),
  V({ id: "field", name: "Field Weave", kind: "outfit", rarity: "rare", coin: "ion", price: 240, lane: "operators", collection: "tactical", tint: "#243428", luma: 0.24, desc: "Trail mesh. Earned or bought with ION." }),
  V({ id: "dune", name: "Dune Shell", kind: "outfit", rarity: "rare", coin: "ion", price: 280, lane: "operators", collection: "desert", tint: "#3a2a18", luma: 0.26, desc: "Sand-cut plates. No camo cheat." }),
  V({ id: "rime", name: "Rime Coat", kind: "outfit", rarity: "epic", coin: "orbit", price: 600, lane: "operators", collection: "arctic", tint: "#1a2834", luma: 0.27, desc: "Frost trim. Looks cold. Hits the same." }),
  V({ id: "grid", name: "Gridline", kind: "outfit", rarity: "epic", coin: "orbit", price: 620, lane: "operators", collection: "urban", tint: "#222830", luma: 0.24, desc: "Night city stencil." }),
  V({ id: "spire", name: "Spire Trim", kind: "outfit", rarity: "epic", coin: "orbit", price: 640, lane: "operators", collection: "futuristic", tint: "#2a2438", luma: 0.23, desc: "Ion-edge panels." }),
  V({ id: "circuit", name: "Circuit Veil", kind: "outfit", rarity: "legendary", coin: "orbit", price: 900, lane: "operators", collection: "cyber", tint: "#142820", luma: 0.28, desc: "Trace glow. Never a cloak." }),
  V({ id: "apex", name: "Apex Line", kind: "outfit", rarity: "legendary", coin: "orbit", price: 980, lane: "operators", collection: "experimental", tint: "#2e2618", luma: 0.26, desc: "Season showcase." }),
  V({ id: "myth", name: "Helix Mythic", kind: "outfit", rarity: "mythic", coin: "orbit", price: 1400, lane: "operators", collection: "experimental", tint: "#203028", luma: 0.28, desc: "Collectable. Zero power." }),
  V({ id: "skin_virex_ion", name: "Virex Ion Wash", kind: "weapon", rarity: "rare", coin: "ion", price: 180, lane: "weapons", collection: "tactical", tint: "#3dffc0", luma: 0.5, desc: "Paint only. Recoil unchanged." }),
  V({ id: "skin_wisp_dune", name: "Wisp Dune", kind: "weapon", rarity: "rare", coin: "ion", price: 180, lane: "weapons", collection: "desert", tint: "#c9956b", luma: 0.42, desc: "Sand anodize." }),
  V({ id: "skin_longbow_rime", name: "Longbow Rime", kind: "weapon", rarity: "epic", coin: "orbit", price: 520, lane: "weapons", collection: "arctic", tint: "#a8d4ff", luma: 0.55, desc: "Frost wrap. Same drop." }),
  V({ id: "skin_aegis_grid", name: "Aegis Grid", kind: "weapon", rarity: "epic", coin: "orbit", price: 540, lane: "weapons", collection: "urban", tint: "#7aa7ff", luma: 0.48, desc: "Stencil receiver." }),
  V({ id: "em_hail", name: "Open Palm", kind: "emote", rarity: "common", coin: "ion", price: 0, lane: "emotes", collection: "tactical", tint: "#3dffc0", luma: 0.6, desc: "Default hail." }),
  V({ id: "em_hold", name: "Hold Fast", kind: "emote", rarity: "uncommon", coin: "ion", price: 80, lane: "emotes", collection: "military", tint: "#ffc14d", luma: 0.55, desc: "Fist to chest." }),
  V({ id: "em_rally", name: "Rally Arc", kind: "emote", rarity: "rare", coin: "orbit", price: 220, lane: "emotes", collection: "urban", tint: "#7aa7ff", luma: 0.5, desc: "Arc salute." }),
  V({ id: "bn_plain", name: "Plain Banner", kind: "banner", rarity: "common", coin: "ion", price: 0, lane: "banners", collection: "tactical", tint: "#11151c", luma: 0.2, desc: "Default strip." }),
  V({ id: "bn_stripe", name: "Strike Banner", kind: "banner", rarity: "epic", coin: "ion", price: 160, lane: "banners", collection: "military", tint: "#1a2430", luma: 0.24, desc: "Earned or ION." }),
  V({ id: "bn_orbit", name: "Orbit Frame", kind: "frame", rarity: "legendary", coin: "orbit", price: 400, lane: "banners", collection: "futuristic", tint: "#3dffc0", luma: 0.4, desc: "Profile hex." }),
  V({ id: "fx_ion", name: "Ion Trace", kind: "effect", rarity: "rare", coin: "orbit", price: 300, lane: "effects", collection: "cyber", tint: "#3dffc0", luma: 0.5, desc: "Spawn sparkle. No aim assist." }),
  V({ id: "fx_win", name: "Quiet Win", kind: "effect", rarity: "epic", coin: "orbit", price: 360, lane: "effects", collection: "experimental", tint: "#ffc14d", luma: 0.5, desc: "Victory sting." }),
  V({ id: "title_yard", name: "Title: Yard Hand", kind: "title", rarity: "uncommon", coin: "ion", price: 60, lane: "banners", collection: "tactical", tint: "#b8c0cc", luma: 0.6, desc: "Callsign paint." }),
  V({
    id: "bundle_dune",
    name: "Dune Packet",
    kind: "bundle",
    rarity: "rare",
    coin: "ion",
    price: 380,
    listIon: 460,
    lane: "bundles",
    collection: "desert",
    tint: "#c9956b",
    luma: 0.3,
    grants: ["dune", "skin_wisp_dune"],
    desc: "Outfit + Wisp skin. Savings shown on the quote.",
  }),
  V({
    id: "bundle_rime",
    name: "Rime Packet",
    kind: "bundle",
    rarity: "epic",
    coin: "orbit",
    price: 980,
    listOrbit: 1120,
    lane: "bundles",
    collection: "arctic",
    tint: "#a8d4ff",
    luma: 0.32,
    grants: ["rime", "skin_longbow_rime", "fx_ion"],
    desc: "Coat + Longbow wrap + Ion Trace.",
  }),
  V({
    id: "bundle_apex",
    name: "Apex Packet",
    kind: "bundle",
    rarity: "legendary",
    coin: "orbit",
    price: 1600,
    listOrbit: 1940,
    lane: "bundles",
    collection: "experimental",
    tint: "#ffc14d",
    luma: 0.34,
    grants: ["apex", "bn_orbit", "fx_win"],
    desc: "Apex Line + Orbit Frame + Quiet Win.",
  }),
  V({ id: "pass_s1", name: "Orbit Pass — Premium", kind: "pass", rarity: "legendary", coin: "orbit", price: 800, lane: "pass", collection: "season", tint: "#3dffc0", luma: 0.45, grants: ["pass_premium"], desc: "Unlocks the premium track. Free track stays free." }),
  V({ id: "orbit_300", name: "300 ORBIT", kind: "topup", rarity: "common", coin: "orbit", price: 0, lane: "featured", collection: "topup", tint: "#7aa7ff", luma: 0.5, grants: [], desc: "Sandbox pack. Live payments use a licensed provider — never the game client." }),
  V({ id: "orbit_800", name: "800 ORBIT", kind: "topup", rarity: "rare", coin: "orbit", price: 0, lane: "featured", collection: "topup", tint: "#7aa7ff", luma: 0.5, grants: [], desc: "Sandbox pack." }),
  V({ id: "orbit_2000", name: "2000 ORBIT", kind: "topup", rarity: "epic", coin: "orbit", price: 0, lane: "featured", collection: "topup", tint: "#7aa7ff", luma: 0.5, grants: [], desc: "Sandbox pack." }),
];

export const TOPUP_ORBIT: Record<string, number> = { orbit_300: 300, orbit_800: 800, orbit_2000: 2000 };

export function vaultById(id: string): VaultItem | undefined {
  return VAULT.find((v) => v.id === id);
}

export function isCombatSku(id: string): boolean {
  return id === "buy_repair" || id === "buy_plates";
}

export function quoteOf(id: string, qty = 1): Quote | null {
  const v = vaultById(id);
  if (!v || v.kind === "topup") {
    if (TOPUP_ORBIT[id]) {
      return {
        sku: id,
        name: vaultById(id)?.name || id,
        qty: 1,
        coin: "orbit",
        unit: 0,
        total: 0,
        list: TOPUP_ORBIT[id],
        save: 0,
        permanent: true,
        cosmetic: true,
        restriction: "Sandbox top-up. No card data touches Helix.",
      };
    }
    return null;
  }
  const n = Math.max(1, Math.min(1, qty | 0));
  const list = v.coin === "ion" ? v.listIon ?? v.price : v.listOrbit ?? v.price;
  const total = v.price * n;
  return {
    sku: v.id,
    name: v.name,
    qty: n,
    coin: v.coin,
    unit: v.price,
    total,
    list,
    save: Math.max(0, list - total),
    permanent: v.permanent,
    cosmetic: true,
    restriction: v.kind === "pass" ? "Cosmetic track only." : "Appearance only. No combat stats.",
  };
}

export function featuredIds(now = Date.now()): string[] {
  const key = dayKey(now);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const pool = VAULT.filter((v) => v.kind !== "topup" && v.price > 0);
  const out: string[] = [];
  for (let i = 0; out.length < 4 && i < pool.length * 2; i++) {
    const idx = Math.abs(h + i * 97) % pool.length;
    if (!out.includes(pool[idx].id)) out.push(pool[idx].id);
  }
  return out;
}

export function passTiers(): PassTier[] {
  const out: PassTier[] = [];
  for (let t = 1; t <= PASS_TIERS; t++) {
    const free =
      t % 10 === 0
        ? { kind: "ion", id: "ion", qty: 40, name: "+40 ION" }
        : t % 5 === 0
          ? { kind: "xp", id: "xp", qty: 30, name: "+30 XP" }
          : { kind: "xp", id: "xp", qty: 12, name: "+12 XP" };
    const premium =
      t === 1
        ? { kind: "item", id: "em_hold", qty: 1, name: "Hold Fast" }
        : t === 25
          ? { kind: "item", id: "field", qty: 1, name: "Field Weave" }
          : t === 50
            ? { kind: "item", id: "skin_virex_ion", qty: 1, name: "Virex Ion Wash" }
            : t === 75
              ? { kind: "item", id: "bn_stripe", qty: 1, name: "Strike Banner" }
              : t === 100
                ? { kind: "item", id: "circuit", qty: 1, name: "Circuit Veil" }
                : t % 10 === 0
                  ? { kind: "orbit", id: "orbit", qty: 20, name: "+20 ORBIT" }
                  : { kind: "ion", id: "ion", qty: 15, name: "+15 ION" };
    out.push({ tier: t, free, premium });
  }
  return out;
}

export function passTierOf(xp: number): number {
  return Math.max(0, Math.min(PASS_TIERS, Math.floor(xp / PASS_XP_PER_TIER)));
}

export function emptyWallet(): WalletPublic {
  return {
    ion: 0,
    orbit: 0,
    owned: ["duty", "em_hail", "bn_plain"],
    pass: { season: SEASON_ID, premium: false, tier: 0, xp: 0 },
    daily: { ready: true, next: dayKey(Date.now()), ionMul: 1 },
    trade: "disabled",
    gift: "disabled",
  };
}

export function economyPublic() {
  return {
    rule: "ION is earned. ORBIT is optional and cosmetic. Nothing in the Vault changes damage, health, armor, speed, accuracy, or ammo. Trading is off. Loot boxes are not the store.",
    coins: [
      { id: "ion", name: ION_NAME, how: "Matches, challenges, dailies, free pass. Never sold as power." },
      { id: "orbit", name: ORBIT_NAME, how: "Optional. Skins, pass, bundles. Payments never hit the game client." },
    ],
    lanes: ["featured", "operators", "weapons", "emotes", "banners", "effects", "bundles", "pass"],
    rarities: ["common", "uncommon", "rare", "epic", "legendary", "mythic"],
    pass: { season: SEASON_ID, name: SEASON_NAME, tiers: PASS_TIERS, free: true, premiumSku: "pass_s1" },
    trade: "disabled",
    gift: "disabled",
    lootBoxes: "not primary — none shipping",
    ads: "none in match",
    rangeKits: "ION-only training SKUs. Ranked rejects them.",
    items: VAULT.length,
  };
}
