export type BodyType = "male" | "female";
export type SkinRarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type EmoteId = "hail" | "hold" | "rally" | "win" | "mourn";
export type FaceId = 0 | 1 | 2 | 3 | 4 | 5;
export type Loco =
  | "idle"
  | "walk"
  | "run"
  | "sprint"
  | "crouch"
  | "prone"
  | "slide"
  | "vault"
  | "climb"
  | "swim"
  | "jump"
  | "fall"
  | "revive"
  | "emote";

export interface Appearance {
  face: FaceId;
  hair: number;
  skin: number;
  eyes: number;
  outfit: string;
  gloves: number;
  boots: number;
  pack: number;
  emblem: string;
  banner: string;
  skinId: string;
}

export interface OperatorDef {
  id: string;
  name: string;
  callsign: string;
  body: BodyType;
  accent: string;
  visor: string;
  voice: number;
  role: string;
  personality: string;
  voiceLine: string;
  lore: string;
}

export interface CosmeticDef {
  id: string;
  name: string;
  slot: "outfit" | "gloves" | "boots" | "pack" | "emblem" | "banner" | "skin";
  rarity: SkinRarity;
  unlockLevel: number;
  tint: string;
  /** Minimum perceived luminance 0–1. Skins below 0.18 are rejected (no invis). */
  luma: number;
}

export interface EmoteDef {
  id: EmoteId;
  name: string;
  duration: number;
  unlockLevel: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  xp: number;
  unlock?: string;
}

export const OPERATORS: OperatorDef[] = [
  {
    id: "VANGUARD",
    name: "Kael Rho",
    callsign: "VANGUARD",
    body: "male",
    accent: "#3dffc0",
    visor: "#7cffd4",
    voice: 0.92,
    role: "Strike lead",
    personality: "Dry, steady, counts to three before he talks.",
    voiceLine: "Hold the line. Then take it.",
    lore: "Helix's first yard captain. Lost a squad on Orbit-1 and never bought the myth that gear wins fights. He trains operators to win ugly and leave together.",
  },
  {
    id: "SPECTRE",
    name: "Nyx Vale",
    callsign: "SPECTRE",
    body: "female",
    accent: "#c47dff",
    visor: "#e0b3ff",
    voice: 1.18,
    role: "Recon",
    personality: "Quiet, exact, allergic to speeches.",
    voiceLine: "I already saw them.",
    lore: "Grew up in the under-grid of Meridian Docks. Maps rooms by sound. Refuses cloaks — if you cannot be seen fairly, you should not be in the yard.",
  },
  {
    id: "WARDEN",
    name: "Iori Kane",
    callsign: "WARDEN",
    body: "male",
    accent: "#ffc14d",
    visor: "#ffe08a",
    voice: 0.82,
    role: "Anchor",
    personality: "Gruff, protective, keeps extra bandages for other people.",
    voiceLine: "Nobody drops on my watch.",
    lore: "Ex-harbor marshal who walked off a desk job the day Helix opened the yard. He is the wall you put a squad behind, not a shop skin.",
  },
  {
    id: "NOMAD",
    name: "Reza Quill",
    callsign: "NOMAD",
    body: "female",
    accent: "#ff9a3d",
    visor: "#ffc38a",
    voice: 1.08,
    role: "Pathfinder",
    personality: "Warm, restless, narrates the next fifty meters.",
    voiceLine: "Door's this way. Trust me.",
    lore: "Walked the rim settlements as a courier. Treats every circle like a trail. Her pack is full of chalk, not miracles.",
  },
  {
    id: "CIRCLET",
    name: "Sera Lin",
    callsign: "CIRCLET",
    body: "female",
    accent: "#7aa7ff",
    visor: "#c5d8ff",
    voice: 1.14,
    role: "Field reader",
    personality: "Calm, curious, names every constellation she can see.",
    voiceLine: "Breathe. Then move.",
    lore: "Astrometrics intern who learned trauma kits because the sky does not stop bleeding. No passive heal — she just talks people back onto their feet.",
  },
  {
    id: "HEX",
    name: "Oren Pax",
    callsign: "HEX",
    body: "male",
    accent: "#3dff7a",
    visor: "#9dffc0",
    voice: 0.98,
    role: "Systems",
    personality: "Fast talker, hates mystery boxes, loves clean wiring.",
    voiceLine: "If it glows, I can break it.",
    lore: "Helix bench tech who kept sneaking onto live ranges. He treats guns like sentences: period, not exclamation.",
  },
  {
    id: "SABLE",
    name: "Ora Venn",
    callsign: "SABLE",
    body: "female",
    accent: "#ff6b8a",
    visor: "#ffb3c2",
    voice: 1.02,
    role: "Night runner",
    personality: "Low voice, fewer words, never late.",
    voiceLine: "Don't light up.",
    lore: "Ran blackout drills in the old rail cuts. Matte plates, rust trim, no shimmer. Camouflage stops where fairness starts.",
  },
  {
    id: "VOSS",
    name: "Eden Voss",
    callsign: "VOSS",
    body: "male",
    accent: "#4ecdc4",
    visor: "#a8fff8",
    voice: 0.88,
    role: "Marshal",
    personality: "Even keel. Counts lives, not clips.",
    voiceLine: "We leave with the same number we brought.",
    lore: "Pulled crews out of a flooded dock during the Circlet storm. Swims like he still has a rope in his hand.",
  },
];

export const CHARACTERS = OPERATORS.map((o) => o.id);
export type CharacterId = (typeof CHARACTERS)[number];

export function operatorById(id: string): OperatorDef {
  return OPERATORS.find((o) => o.id === id) ?? OPERATORS[0];
}

export const DEFAULT_APPEARANCE: Appearance = {
  face: 0,
  hair: 0,
  skin: 2,
  eyes: 1,
  outfit: "duty",
  gloves: 0,
  boots: 0,
  pack: 0,
  emblem: "helix",
  banner: "plain",
  skinId: "duty",
};

export const SKIN_TONES = ["#f6e0c8", "#e8c39e", "#c9956b", "#8d5a36", "#5c3a24", "#3b2416"];
export const EYE_TONES = ["#3b2a1a", "#4a6b3a", "#3a5a8c", "#6b4a2a", "#2a2a2a", "#5a7a8c"];
export const HAIR_TONES = ["#1a1a1a", "#3b2a1a", "#6b3a1a", "#c4a574", "#d8d0c4", "#2a3a4a", "#8a2a2a", "#4a2a4a"];

export const COSMETICS: CosmeticDef[] = [
  { id: "duty", name: "Duty Plate", slot: "outfit", rarity: "common", unlockLevel: 1, tint: "#1b2430", luma: 0.22 },
  { id: "field", name: "Field Weave", slot: "outfit", rarity: "rare", unlockLevel: 5, tint: "#243428", luma: 0.24 },
  { id: "spire", name: "Spire Trim", slot: "outfit", rarity: "epic", unlockLevel: 10, tint: "#2a2438", luma: 0.23 },
  { id: "apex", name: "Apex Line", slot: "outfit", rarity: "legendary", unlockLevel: 16, tint: "#2e2618", luma: 0.26 },
  { id: "myth", name: "Helix Mythic", slot: "skin", rarity: "mythic", unlockLevel: 24, tint: "#203028", luma: 0.28 },
  { id: "glove0", name: "Issue Gloves", slot: "gloves", rarity: "common", unlockLevel: 1, tint: "#222", luma: 0.2 },
  { id: "glove1", name: "Grip Wraps", slot: "gloves", rarity: "rare", unlockLevel: 4, tint: "#333", luma: 0.22 },
  { id: "boot0", name: "Issue Boots", slot: "boots", rarity: "common", unlockLevel: 1, tint: "#1a1a1a", luma: 0.2 },
  { id: "boot1", name: "Trail Soles", slot: "boots", rarity: "rare", unlockLevel: 6, tint: "#2a2218", luma: 0.22 },
  { id: "pack0", name: "Slim Rig", slot: "pack", rarity: "common", unlockLevel: 1, tint: "#222", luma: 0.2 },
  { id: "pack1", name: "Courier Pack", slot: "pack", rarity: "epic", unlockLevel: 8, tint: "#2a2420", luma: 0.22 },
  { id: "helix", name: "Helix Mark", slot: "emblem", rarity: "common", unlockLevel: 1, tint: "#3dffc0", luma: 0.7 },
  { id: "orbit", name: "Orbit Ring", slot: "emblem", rarity: "rare", unlockLevel: 7, tint: "#7aa7ff", luma: 0.65 },
  { id: "plain", name: "Plain Banner", slot: "banner", rarity: "common", unlockLevel: 1, tint: "#11151c", luma: 0.2 },
  { id: "stripe", name: "Strike Banner", slot: "banner", rarity: "epic", unlockLevel: 12, tint: "#1a2430", luma: 0.24 },
  { id: "dune", name: "Dune Shell", slot: "outfit", rarity: "rare", unlockLevel: 99, tint: "#3a2a18", luma: 0.26 },
  { id: "rime", name: "Rime Coat", slot: "outfit", rarity: "epic", unlockLevel: 99, tint: "#1a2834", luma: 0.27 },
  { id: "grid", name: "Gridline", slot: "outfit", rarity: "epic", unlockLevel: 99, tint: "#222830", luma: 0.24 },
  { id: "circuit", name: "Circuit Veil", slot: "outfit", rarity: "legendary", unlockLevel: 99, tint: "#142820", luma: 0.28 },
];

export const EMOTES: EmoteDef[] = [
  { id: "hail", name: "Open Palm", duration: 2.2, unlockLevel: 1 },
  { id: "hold", name: "Hold Fast", duration: 2.0, unlockLevel: 3 },
  { id: "rally", name: "Rally Arc", duration: 2.4, unlockLevel: 6 },
  { id: "win", name: "Quiet Win", duration: 2.6, unlockLevel: 8 },
  { id: "mourn", name: "Downed Honor", duration: 2.8, unlockLevel: 10 },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", name: "First Mark", desc: "Record your first elimination.", xp: 40, unlock: "orbit" },
  { id: "yard_walker", name: "Yard Walker", desc: "Finish 10 matches.", xp: 80 },
  { id: "sharp", name: "Clean Hands", desc: "Land 40% accuracy over 40 shots in a match.", xp: 60 },
  { id: "medic", name: "Get Up", desc: "Revive teammates 5 times.", xp: 70, unlock: "field" },
  { id: "survivor", name: "Last Light", desc: "Win a Team BR.", xp: 100, unlock: "stripe" },
  { id: "pathfinder", name: "Pathfinder", desc: "Reach operator level 8.", xp: 50, unlock: "pack1" },
  { id: "first_mvp", name: "Called Shot", desc: "Finish a match as MVP.", xp: 50 },
  { id: "longshot", name: "Long Hand", desc: "Eliminate from 40m+.", xp: 55 },
  { id: "triple", name: "Three Mark", desc: "Record 3 eliminations in one match.", xp: 60 },
  { id: "streak3", name: "On a Run", desc: "Win 3 matches in a row.", xp: 70 },
  { id: "gold_mark", name: "Gilded", desc: "Reach Gold in Ranked.", xp: 80 },
  { id: "helix_mark", name: "Helix Peak", desc: "Reach Helix rank.", xp: 120 },
  { id: "prestige", name: "Second Orbit", desc: "Prestige once.", xp: 100 },
];

export function defaultAppearance(): Appearance {
  return { ...DEFAULT_APPEARANCE };
}

export function sanitizeAppearance(raw: Partial<Appearance> | undefined, level: number, owned: string[] = []): Appearance {
  const a = { ...DEFAULT_APPEARANCE, ...(raw || {}) };
  a.face = (Math.max(0, Math.min(5, a.face | 0)) as FaceId);
  a.hair = clampInt(a.hair, 0, HAIR_TONES.length - 1);
  a.skin = clampInt(a.skin, 0, SKIN_TONES.length - 1);
  a.eyes = clampInt(a.eyes, 0, EYE_TONES.length - 1);
  a.gloves = clampInt(a.gloves, 0, 3);
  a.boots = clampInt(a.boots, 0, 3);
  a.pack = clampInt(a.pack, 0, 3);
  a.outfit = unlockedCosmetic(a.outfit || "duty", "outfit", level, owned);
  a.skinId = unlockedCosmetic(a.skinId || a.outfit, "skin", level, owned) === a.skinId ? a.skinId : a.outfit;
  a.emblem = unlockedCosmetic(a.emblem || "helix", "emblem", level, owned);
  a.banner = unlockedCosmetic(a.banner || "plain", "banner", level, owned);
  return a;
}

function unlockedCosmetic(id: string, slot: CosmeticDef["slot"], level: number, owned: string[]): string {
  const c = COSMETICS.find((x) => x.id === id);
  if (c && c.luma >= 0.18 && (c.unlockLevel <= level || owned.includes(id))) return id;
  return COSMETICS.find((x) => x.slot === slot && x.unlockLevel <= 1)?.id ?? id;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Number.isFinite(v) ? Math.round(v) : lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export function cosmeticById(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export function outfitTint(a: Appearance): string {
  return cosmeticById(a.outfit)?.tint || "#1b2430";
}
