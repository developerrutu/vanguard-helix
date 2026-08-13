import {
  BTN,
  TICK_DT,
  dist2,
  hitscanBlocked,
  personaById,
  skillOf,
  weatherVisionMul,
  type DifficultyId,
  type InputPayload,
  type MapData,
  type PersonaId,
  type SkillCard,
  type WeaponTaste,
} from "../../../shared/src/index";

export interface BotView {
  id: string;
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch: number;
  team: string;
  alive: boolean;
  ammo: number;
  reloading: boolean;
  downed?: boolean;
  health?: number;
  weaponClass?: string;
  grenades?: number;
  hasMed?: boolean;
  zoneCx?: number;
  zoneCz?: number;
  zoneR?: number;
  wantLoot?: boolean;
  flash?: number;
}

export interface LootView {
  id: string;
  x: number;
  z: number;
  kind?: string;
}

export interface SoundCue {
  x: number;
  z: number;
  t: number;
  kind: "shot" | "step" | "nade";
  loud?: boolean;
}

export interface BotWorld {
  map: MapData;
  weather: string;
  tickTime: number;
  sounds: SoundCue[];
  cover: { x: number; z: number }[];
  scoreDelta: number;
  shrinking: boolean;
}

export interface Brain {
  persona: PersonaId;
  difficulty: DifficultyId;
  skill: SkillCard;
  taste: WeaponTaste[];
  reactUntil: number;
  lastSeen: { id: string; x: number; z: number; t: number }[];
  goalX: number;
  goalZ: number;
  goalT: number;
  stuckX: number;
  stuckZ: number;
  stuckT: number;
  underFire: number;
  adapt: number;
  seed: number;
}

const brains = new Map<string, Brain>();

export function bindBrain(
  id: string,
  card: { persona: PersonaId; difficulty: DifficultyId; taste: WeaponTaste[] },
  seed: number,
): Brain {
  const b: Brain = {
    persona: card.persona,
    difficulty: card.difficulty,
    skill: { ...skillOf(card.difficulty) },
    taste: card.taste,
    reactUntil: 0,
    lastSeen: [],
    goalX: 0,
    goalZ: 0,
    goalT: 0,
    stuckX: 0,
    stuckZ: 0,
    stuckT: 0,
    underFire: 0,
    adapt: 0,
    seed,
  };
  brains.set(id, b);
  return b;
}

export function brainOf(id: string): Brain | undefined {
  return brains.get(id);
}

export function dropBrain(id: string): void {
  brains.delete(id);
}

export function botInput(
  self: BotView,
  others: BotView[],
  loot: LootView[],
  seq: number,
  tick: number,
  world?: BotWorld,
): InputPayload {
  if (!self.alive) return blank(seq);
  const brain = brains.get(self.id) ?? bindBrain(self.id, { persona: "aggressive", difficulty: "normal", taste: ["rifle"] }, seq);
  const now = world?.tickTime ?? tick * TICK_DT;
  adapt(brain, world?.scoreDelta ?? 0);
  const skill = brain.skill;
  const persona = personaById(brain.persona);
  const map = world?.map;

  if (dist2(self.x, self.z, brain.stuckX, brain.stuckZ) < 0.45) {
    if (now - brain.stuckT > 1.15) {
      const a = hash(brain.seed + tick) * Math.PI * 2;
      brain.goalX = self.x + Math.cos(a) * 8;
      brain.goalZ = self.z + Math.sin(a) * 8;
      brain.goalT = now + 1.6;
      brain.stuckT = now;
    }
  } else {
    brain.stuckX = self.x;
    brain.stuckZ = self.z;
    brain.stuckT = now;
  }

  hear(brain, world?.sounds || [], self, now, skill);
  const visMul = weatherVisionMul(world?.weather || "");
  const vision = skill.vision * visMul;
  const visible = others.filter((o) => {
    if (!o.alive || o.team === self.team || o.team === "none") return false;
    const d = dist2(self.x, self.z, o.x, o.z);
    if (d > vision) return false;
    if (map && hitscanBlocked(self.x, self.z, o.x, o.z, map)) return false;
    return true;
  });
  for (const v of visible) {
    const row = brain.lastSeen.find((s) => s.id === v.id);
    if (row) {
      row.x = v.x;
      row.z = v.z;
      row.t = now;
    } else brain.lastSeen.push({ id: v.id, x: v.x, z: v.z, t: now });
  }
  brain.lastSeen = brain.lastSeen.filter((s) => now - s.t < skill.memory);

  const mates = others.filter((o) => o.team === self.team && o.alive);
  const downed = mates.find((o) => o.downed);
  const foeVis = closest(self, visible.filter((o) => !o.downed));
  const memory = brain.lastSeen[0];
  const hp = self.health ?? 100;

  let aimX = self.x + Math.sin(self.yaw);
  let aimZ = self.z + Math.cos(self.yaw);
  let moveX = 0;
  let moveY = 0;
  let buttons = 0;
  let foeD = 1e9;
  let fighting = false;

  if (world?.sounds.some((s) => s.kind === "shot" && now - s.t < 0.4 && dist2(self.x, self.z, s.x, s.z) < 22)) {
    brain.underFire = now + 1.4;
  }

  const needHeal = Boolean(self.hasMed) && hp < (brain.persona === "support" ? 70 : 42) && !foeVis;
  const zoneOut =
    self.zoneR !== undefined &&
    dist2(self.x, self.z, self.zoneCx ?? 0, self.zoneCz ?? 0) > Math.max(4, (self.zoneR ?? 90) - (persona.rotateEarly > 0.6 ? 8 : 2));

  if (needHeal) {
    buttons |= BTN.USE;
    moveY = 0.15;
    if (skill.crouch > 0.2) buttons |= BTN.CROUCH;
  } else if (downed && dist2(self.x, self.z, downed.x, downed.z) < 30 * persona.reviveBias && (!foeVis || foeVis.d > 12)) {
    aimX = downed.x;
    aimZ = downed.z;
    const s = steerToward(self, downed.x, downed.z);
    moveX = s.x;
    moveY = 0.85;
    if (dist2(self.x, self.z, downed.x, downed.z) < 1.8) buttons |= BTN.INTERACT;
  } else if (zoneOut && (!foeVis || foeVis.d > 16 || persona.rotateEarly > 0.6)) {
    aimX = self.zoneCx ?? 0;
    aimZ = self.zoneCz ?? 0;
    const s = steerToward(self, aimX, aimZ);
    moveX = s.x;
    moveY = 0.9;
    buttons |= BTN.SPRINT;
  } else if (self.wantLoot && loot.length && (!foeVis || foeVis.d > 18)) {
    const best = pickLoot(self, loot, brain.taste);
    aimX = best.x;
    aimZ = best.z;
    const s = steerToward(self, best.x, best.z);
    moveX = s.x;
    moveY = 0.8;
    if (dist2(self.x, self.z, best.x, best.z) < 1.5) buttons |= BTN.INTERACT;
  } else if (foeVis || memory) {
    const tx = foeVis ? foeVis.o.x : memory!.x;
    const tz = foeVis ? foeVis.o.z : memory!.z;
    foeD = foeVis ? foeVis.d : dist2(self.x, self.z, tx, tz);
    fighting = Boolean(foeVis);
    if (foeVis && brain.reactUntil <= 0) brain.reactUntil = now + skill.reaction;
    const flank = persona.flank > 0.5 && skill.aggression > 0.55 && foeD > 10;
    if (flank) {
      const px = -(tz - self.z);
      const pz = tx - self.x;
      const pl = Math.hypot(px, pz) || 1;
      aimX = tx + (px / pl) * 10;
      aimZ = tz + (pz / pl) * 10;
    } else {
      aimX = tx;
      aimZ = tz;
    }
    const s = steerToward(self, aimX, aimZ);
    if (brain.underFire > now && world?.cover.length) {
      const c = nearest(self, world.cover);
      const cs = steerToward(self, c.x, c.z);
      moveX = cs.x;
      moveY = 0.7;
      if (skill.crouch > 0.2) buttons |= BTN.CROUCH;
    } else if (foeD > persona.holdDist + 4) {
      moveX = s.x;
      moveY = 0.75 + skill.aggression * 0.2;
      if (foeD > 20) buttons |= BTN.SPRINT;
      if (skill.slide > 0.15 && (tick % 37 === (brain.seed % 11))) buttons |= BTN.CROUCH | BTN.SPRINT;
    } else if (foeD < persona.holdDist - 4) {
      moveY = -0.25;
      moveX = Math.sin(tick * 0.11 + brain.seed) * 0.65;
      if (skill.crouch > 0.25) buttons |= BTN.CROUCH;
    } else {
      moveX = Math.sin(tick * 0.09 + self.x) * 0.55;
      moveY = 0.12;
      if (hash(tick + brain.seed) < skill.crouch) buttons |= BTN.CROUCH;
    }
  } else if (brain.goalT > now) {
    const s = steerToward(self, brain.goalX, brain.goalZ);
    moveX = s.x;
    moveY = 0.55;
    aimX = brain.goalX;
    aimZ = brain.goalZ;
  } else {
    moveX = Math.sin(tick * 0.03 + seq) * 0.3;
    moveY = 0.35;
  }

  const jx = (hash(tick * 3 + brain.seed) - 0.5) * skill.jitter * 14;
  const jz = (hash(tick * 7 + brain.seed) - 0.5) * skill.jitter * 14;
  const dx = aimX + jx - self.x;
  const dz = aimZ + jz - self.z;
  const desiredYaw = Math.atan2(dx, dz);
  let dyaw = desiredYaw - self.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const lookCap = 0.22 + skill.accuracy * 0.18;
  const lookX = clamp(dyaw, -lookCap, lookCap);
  const lookY = clamp(Math.atan2(-(1.15), Math.hypot(dx, dz)) - self.pitch, -0.18, 0.18);

  if (self.ammo <= 0 && !self.reloading) buttons |= BTN.RELOAD;
  const canShoot = fighting && now >= brain.reactUntil && Math.abs(dyaw) < 0.28 + skill.jitter && foeD < vision * 0.95;
  if (canShoot && self.ammo > 0 && !self.reloading && (self.flash ?? 0) <= 0) {
    if (hash(tick + seq + brain.seed) < skill.fire * skill.accuracy) {
      buttons |= BTN.FIRE;
      if (foeD > 16) buttons |= BTN.AIM;
    }
  }
  if (fighting && (self.grenades ?? 0) > 0 && foeD < 22 && foeD > 7 && hash(tick + 19) < skill.nade) {
    buttons |= BTN.GRENADE;
  }
  if (brain.persona === "strategist" && fighting && tick % 48 === 0) buttons |= BTN.PING;
  if (map?.doors?.length && hash(tick) < 0.04) {
    const door = map.doors.find((d) => dist2(self.x, self.z, d.x, d.z) < 1.7);
    if (door) buttons |= BTN.INTERACT;
  }

  void persona;
  return { seq, dt: TICK_DT, moveX, moveY, lookX, lookY, buttons };
}

function adapt(brain: Brain, delta: number): void {
  const base = skillOf(brain.difficulty);
  let k = 0;
  if (delta <= -2) k = 0.06;
  if (delta >= 3) k = -0.05;
  brain.adapt = k;
  brain.skill.accuracy = clamp(base.accuracy + k, 0.16, 0.8);
  brain.skill.reaction = Math.max(0.09, base.reaction - k * 0.4);
  brain.skill.fire = clamp(base.fire + k * 0.5, 0.2, 0.85);
}

function hear(brain: Brain, sounds: SoundCue[], self: BotView, now: number, skill: SkillCard): void {
  for (const s of sounds) {
    const r = s.kind === "shot" || s.kind === "nade" ? skill.hear * (s.loud ? 1.25 : 1) : skill.hear * 0.45;
    if (dist2(self.x, self.z, s.x, s.z) > r) continue;
    if (!brain.lastSeen.some((m) => dist2(m.x, m.z, s.x, s.z) < 3)) {
      brain.lastSeen.push({ id: "snd_" + s.t, x: s.x, z: s.z, t: now });
    }
  }
}

function pickLoot(self: BotView, loot: LootView[], taste: WeaponTaste[]): LootView {
  let best = loot[0];
  let bd = 1e9;
  for (const l of loot) {
    let d = dist2(self.x, self.z, l.x, l.z);
    const kind = (l.kind || "").toLowerCase();
    if (taste.some((t) => kind.includes(t) || weaponMatches(kind, t))) d *= 0.55;
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

function weaponMatches(kind: string, taste: WeaponTaste): boolean {
  if (taste === "rifle") return kind.includes("virex") || kind.includes("aegis") || kind.includes("nadir");
  if (taste === "smg") return kind.includes("wisp") || kind.includes("sable");
  if (taste === "shotgun") return kind.includes("breach") || kind.includes("hollow");
  if (taste === "sniper") return kind.includes("longbow") || kind.includes("aperture");
  if (taste === "dmr") return kind.includes("kite") || kind.includes("meridian");
  if (taste === "lmg") return kind.includes("maw") || kind.includes("circlet");
  return kind.includes("stitch") || kind.includes("orbit");
}

function closest(self: BotView, list: BotView[]): { o: BotView; d: number } | null {
  let best: BotView | null = null;
  let bd = 1e9;
  for (const o of list) {
    const d = dist2(self.x, self.z, o.x, o.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best ? { o: best, d: bd } : null;
}

function nearest(self: BotView, list: { x: number; z: number }[]): { x: number; z: number } {
  let best = list[0];
  let bd = 1e9;
  for (const c of list) {
    const d = dist2(self.x, self.z, c.x, c.z);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best || { x: self.x, z: self.z };
}

function steerToward(self: BotView, x: number, z: number): { x: number; y: number } {
  const dx = x - self.x;
  const dz = z - self.z;
  const localX = Math.cos(self.yaw) * dx - Math.sin(self.yaw) * dz;
  const localY = Math.sin(self.yaw) * dx + Math.cos(self.yaw) * dz;
  const l = Math.hypot(localX, localY) || 1;
  return { x: localX / l, y: localY / l };
}

function blank(seq: number): InputPayload {
  return { seq, dt: TICK_DT, moveX: 0, moveY: 0, lookX: 0, lookY: 0, buttons: 0 };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
