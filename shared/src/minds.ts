export type PersonaId = "aggressive" | "defensive" | "support" | "strategist";
export type DifficultyId = "easy" | "normal" | "hard" | "elite";
export type WeaponTaste = "smg" | "rifle" | "shotgun" | "sniper" | "dmr" | "lmg" | "sidearm";

export interface SkillCard {
  id: DifficultyId;
  reaction: number;
  accuracy: number;
  vision: number;
  hear: number;
  memory: number;
  fire: number;
  jitter: number;
  aggression: number;
  nade: number;
  slide: number;
  crouch: number;
}

export interface PersonaDef {
  id: PersonaId;
  name: string;
  blurb: string;
  prefer: WeaponTaste[];
  holdDist: number;
  reviveBias: number;
  rotateEarly: number;
  flank: number;
}

export interface MindCard {
  persona: PersonaId;
  difficulty: DifficultyId;
  callsign: string;
  operator: string;
  taste: WeaponTaste[];
}

export const PERSONAS: PersonaDef[] = [
  {
    id: "aggressive",
    name: "Pusher",
    blurb: "Closes space, takes the first fight, accepts bad trades.",
    prefer: ["smg", "shotgun", "rifle"],
    holdDist: 7,
    reviveBias: 0.35,
    rotateEarly: 0.35,
    flank: 0.45,
  },
  {
    id: "defensive",
    name: "Anchor",
    blurb: "Holds cover, peeks short, keeps the squad's back.",
    prefer: ["lmg", "rifle", "sidearm"],
    holdDist: 16,
    reviveBias: 0.7,
    rotateEarly: 0.7,
    flank: 0.15,
  },
  {
    id: "support",
    name: "Medic",
    blurb: "Revives first, shares space, fights second.",
    prefer: ["rifle", "sidearm", "smg"],
    holdDist: 12,
    reviveBias: 1,
    rotateEarly: 0.55,
    flank: 0.25,
  },
  {
    id: "strategist",
    name: "Caller",
    blurb: "Rotates early, takes angles, pings before pushing.",
    prefer: ["dmr", "sniper", "rifle"],
    holdDist: 22,
    reviveBias: 0.55,
    rotateEarly: 0.9,
    flank: 0.8,
  },
];

export const SKILLS: Record<DifficultyId, SkillCard> = {
  easy: {
    id: "easy",
    reaction: 0.48,
    accuracy: 0.2,
    vision: 26,
    hear: 16,
    memory: 3.2,
    fire: 0.26,
    jitter: 0.46,
    aggression: 0.22,
    nade: 0.08,
    slide: 0.04,
    crouch: 0.18,
  },
  normal: {
    id: "normal",
    reaction: 0.28,
    accuracy: 0.4,
    vision: 38,
    hear: 24,
    memory: 6,
    fire: 0.48,
    jitter: 0.24,
    aggression: 0.5,
    nade: 0.18,
    slide: 0.1,
    crouch: 0.28,
  },
  hard: {
    id: "hard",
    reaction: 0.16,
    accuracy: 0.6,
    vision: 48,
    hear: 30,
    memory: 9,
    fire: 0.68,
    jitter: 0.13,
    aggression: 0.7,
    nade: 0.32,
    slide: 0.18,
    crouch: 0.34,
  },
  elite: {
    id: "elite",
    reaction: 0.1,
    accuracy: 0.76,
    vision: 56,
    hear: 36,
    memory: 12,
    fire: 0.82,
    jitter: 0.07,
    aggression: 0.84,
    nade: 0.42,
    slide: 0.22,
    crouch: 0.38,
  },
};

/** Human-looking tags. Never contain BOT / AI / CPU. */
const TAGS_A = [
  "Kite", "Rim", "Dock", "Quiet", "Yard", "Ash", "Volt", "Nim", "Cove", "Hexa",
  "Slate", "Wren", "Pith", "Gale", "Moth", "Ichor", "Nox", "Brine", "Loom", "Veld",
];
const TAGS_B = [
  "Walk", "chalk", "wire", "mag", "left", "row", "cut", "line", "fold", "step",
  "hash", "drift", "lock", "veil", "spur", "lane", "mark", "rise", "shade", "cast",
];

export function mintCallsign(seed: number): string {
  const a = TAGS_A[Math.abs(seed) % TAGS_A.length];
  const b = TAGS_B[Math.abs((seed * 17) >> 3) % TAGS_B.length];
  const n = 7 + (Math.abs(seed * 13) % 90);
  if ((seed & 3) === 0) return a + n;
  if ((seed & 3) === 1) return a + b;
  return a + b + n;
}

export function personaById(id: string): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export function skillOf(id: DifficultyId): SkillCard {
  return SKILLS[id] ?? SKILLS.normal;
}

export function pickDifficulty(opts: {
  mmr: number;
  matches: number;
  mode: string;
  slot: number;
}): DifficultyId {
  if (opts.matches < 5 && opts.mode !== "bots") {
    return opts.slot % 3 === 0 ? "normal" : "easy";
  }
  if (opts.mode === "bots") {
    if (opts.mmr < 880) return "easy";
    if (opts.mmr < 1180) return "normal";
    if (opts.mmr < 1480) return "hard";
    return "elite";
  }
  if (opts.mmr < 900) return opts.slot % 2 ? "easy" : "normal";
  if (opts.mmr < 1250) return opts.slot % 3 === 0 ? "hard" : "normal";
  if (opts.mmr < 1550) return opts.slot % 2 ? "hard" : "normal";
  return opts.slot % 4 === 0 ? "elite" : "hard";
}

export function pickPersona(slot: number, seed: number): PersonaId {
  return PERSONAS[(slot + (seed & 3)) % PERSONAS.length].id;
}

const OPS = ["VANGUARD", "SPECTRE", "WARDEN", "NOMAD", "CIRCLET", "HEX", "SABLE", "VOSS"];

export function mintMind(seed: number, slot: number, mmr: number, matches: number, mode: string): MindCard {
  const persona = pickPersona(slot, seed);
  const difficulty = pickDifficulty({ mmr, matches, mode, slot });
  return {
    persona,
    difficulty,
    callsign: mintCallsign(seed ^ (slot * 7919)),
    operator: OPS[(slot + (seed & 7)) % OPS.length],
    taste: personaById(persona).prefer,
  };
}

export function weatherVisionMul(weather: string): number {
  if (weather === "blizzard" || weather === "dust") return 0.68;
  if (weather === "rain" || weather === "night" || weather === "snow") return 0.8;
  return 1;
}

export function mindsPublic() {
  return {
    rule: "Bots write the same InputPayload humans do. No wallhacks, no smoke sight, no instant positions. Difficulty follows player matches/MMR. New operators (under 5 matches) get Easy/Normal fill.",
    personas: PERSONAS,
    difficulties: Object.values(SKILLS),
  };
}
