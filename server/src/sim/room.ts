import {
  ARMOR_SOAK,
  ASSIST_WINDOW,
  BLEED_DPS,
  BTN,
  CRAWL_SCALE,
  DEPLOYS,
  DOWNED_TIME,
  DUMMY_ID,
  DUMMY_STRAFE_ID,
  DUMMY_RESPAWN,
  GRENADE_DAMAGE,
  GRENADE_FUSE,
  GRENADE_RADIUS,
  GRENADE_SPEED,
  INTRO_SEC,
  ITEMS,
  KILL_REWARD,
  KILL_XP,
  LAG_COMP_MAX_MS,
  LOADING_SEC,
  MATCH_SERIAL_START,
  MAX_HEALTH,
  MAX_PLAYERS_PER_ROOM,
  MSG,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  PLAYER_RESPAWN,
  REVIVE_TIME,
  SKUS,
  TEAM_SPAWNS,
  TICK_DT,
  TICK_HZ,
  TRAINING_RANGE,
  WEAPONS,
  ZONE_PHASES,
  applyInput,
  sanitizeInput,
  dist2,
  eyeHeight,
  hitscanBlocked,
  liveMap,
  makeBody,
  pickWorld,
  scaledPhases,
  segmentAabb,
  surfaceAt,
  syncBlockers,
  rankName,
  weaponById,
  xpToLevel,
  falloff,
  hitZone,
  zoneDamage,
  modsFrom,
  magSize,
  reloadTime,
  nextMode,
  recoilKick,
  cycleNade,
  defaultAppearance,
  mintMind,
  operatorById,
  hitHeight,
  fallDamage,
  fireSpreadMul,
  type Appearance,
  type EmoteId,
  type FireMode,
  type NadeKind,
  type Body,
  type C2S,
  type CombatCard,
  type DeployPair,
  type GameEvent,
  type InputPayload,
  type InvSlot,
  type LoadoutPublic,
  type MapData,
  type MatchPhase,
  type MatchResult,
  type PingKind,
  type WeatherId,
  type WorldDef,
  type PingPublic,
  type PlayerPublic,
  type QuickCode,
  type S2C,
  type Snapshot,
  type TeamId,
  type ZonePublic,
} from "../../../shared/src/index";
import type { Account, Store } from "../persist/store";
import { FlagLog } from "../anticheat/flags";
import { audit } from "../security/audit";
import { bindBrain, botInput, dropBrain, type BotWorld, type SoundCue } from "./bot";
import { RANGE_RULES, RANKED_RULES, type MatchRules } from "./rules";
import { generateLoot, type WorldLoot } from "./loot";
import { telemetry } from "../combat/telemetry";

export interface Wire {
  send(msg: S2C): void;
  close(): void;
}

interface Hist {
  tick: number;
  x: number;
  y: number;
  z: number;
}

interface Gun {
  id: string;
  ammo: number;
  reserves: number;
}

interface Pawn {
  account: Account;
  wire: Wire;
  body: Body;
  health: number;
  armor: number;
  alive: boolean;
  lastSeq: number;
  lastInputAt: number;
  fireCooldown: number;
  pending: InputPayload | null;
  inputsThisSecond: number;
  secondMark: number;
  dummy: boolean;
  bot: boolean;
  friend: boolean;
  team: TeamId;
  respawnIn: number;
  ammo: number;
  reserves: number;
  reloadIn: number;
  grenades: number;
  nadeCd: number;
  ping: number;
  hist: Hist[];
  match: {
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    shots: number;
    hits: number;
    revives: number;
  };
  assistsOn: { id: string; at: number }[];
  lastAimErr: number;
  aimHits: number;
  wallTries: number;
  disconnected: boolean;
  reservedUntil: number;
  spectator: boolean;
  downed: boolean;
  eliminated: boolean;
  downedLeft: number;
  reviveProg: number;
  revivingId: string;
  armorLevel: number;
  armorDura: number;
  primary: Gun | null;
  secondary: Gun;
  melee: Gun;
  active: "primary" | "secondary" | "melee";
  medical: { id: string; qty: number } | null;
  utility: { id: string; qty: number } | null;
  healLeft: number;
  speaking: boolean;
  attachments: string[];
  ads: boolean;
  fireMode: FireMode;
  burstLeft: number;
  chamber: boolean;
  swapLock: number;
  flashUntil: number;
  nadeId: string;
  nadeBag: string[];
  shotIndex: number;
  prevButtons: number;
  recoilP: number;
  recoilY: number;
  appearance: Appearance;
  emote: EmoteId | "";
  emoteLeft: number;
  stepT: number;
  travel: number;
  activeSec: number;
  bestDist: number;
  seenReq: Set<number>;
}

interface Nade {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  owner: string;
  team: TeamId;
  kind: NadeKind;
}

interface Bolt {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  dmg: number;
  owner: string;
  team: TeamId;
  weapon: string;
  pen: number;
}

interface Cloud {
  x: number;
  z: number;
  r: number;
  until: number;
  kind: "smoke" | "fire";
  dps: number;
}

let MATCH_SERIAL = MATCH_SERIAL_START;

export class Room {
  readonly id: string;
  readonly mode: string;
  readonly region: string;
  readonly ranked: boolean;
  readonly matchNumber: number;
  readonly mapName: string;
  readonly mapId: string;
  readonly weather: WeatherId | "";
  private rules: MatchRules;
  private map: MapData;
  private world: WorldDef | null = null;
  private deploy: DeployPair;
  private doorOpen: Record<string, boolean> = {};
  private broken = new Set<string>();
  private rubble = new Set<string>();
  private zones = ZONE_PHASES;
  private pawns = new Map<string, Pawn>();
  private spectators: Wire[] = [];
  private loot: WorldLoot[] = [];
  private nades: Nade[] = [];
  private bolts: Bolt[] = [];
  private clouds: Cloud[] = [];
  private pings: PingPublic[] = [];
  private tick = 0;
  private acc = 0;
  private last = performance.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private events: GameEvent[] = [];
  private scoreA = 0;
  private scoreB = 0;
  private startedAt = 0;
  private timeLeft = 0;
  private phase: "warmup" | "live" | "ended" = "warmup";
  private matchPhase: MatchPhase = "loading";
  private ended = false;
  private endReason: "wipe" | "circle" | "time" = "wipe";
  private introLeft = 0;
  private zoneI = 0;
  private zoneT = 0;
  private zoneCx = 0;
  private zoneCz = 0;
  private zoneR = 92;
  private nextCx = 0;
  private nextCz = 0;
  private nextR = 92;
  private fromCx = 0;
  private fromCz = 0;
  private fromR = 92;
  private shrinking = false;
  private finalCx = 0;
  private finalCz = 0;
  private seed: number;
  private cues: SoundCue[] = [];
  private protectMatches = 8;

  constructor(
    id: string,
    mode: string,
    region: string,
    private store: Store,
    private flags: FlagLog,
    private onEmpty: (room: Room) => void,
    private onSocialEnd?: (info: {
      matchId: string;
      winner: string;
      ids: string[];
      cards: { id: string; name: string; team: string }[];
    }) => void,
  ) {
    this.id = id;
    this.mode = mode;
    this.region = region;
    this.ranked = mode === "ranked" || mode === "bots" || mode === "quick";
    this.rules = this.ranked ? RANKED_RULES : RANGE_RULES;
    this.matchNumber = ++MATCH_SERIAL;
    this.seed = (Date.now() ^ (Math.random() * 1e9)) | 0;
    if (this.ranked) {
      const picked = pickWorld(this.matchNumber);
      this.world = liveMap(picked.world);
      this.map = this.world;
      this.mapName = `${picked.world.title} · ${picked.weather.toUpperCase()}`;
      this.mapId = picked.world.mapId;
      this.weather = picked.weather;
      this.deploy = picked.deploy;
      for (const d of this.world.doors) this.doorOpen[d.id] = false;
      syncBlockers(this.map, this.doorOpen, this.broken);
      this.zones = scaledPhases(this.map.half);
    } else {
      this.map = TRAINING_RANGE;
      this.mapName = "TRAINING RANGE";
      this.mapId = "range";
      this.weather = "";
      this.deploy = DEPLOYS[0];
    }
    const bound = this.map.half * 0.42;
    this.finalCx = Math.max(-bound, Math.min(bound, ((this.seed % 21) - 10) * 1.6));
    this.finalCz = Math.max(-bound, Math.min(bound, (((this.seed / 21) | 0) % 21 - 10) * 1.6));
    if (this.mapId === "frost_haven" && Math.hypot(this.finalCx, this.finalCz) < 12) {
      this.finalCx = -22;
      this.finalCz = 20;
    }
    this.zoneR = this.zones[0].radius;
    this.nextR = this.zones[1]?.radius ?? this.zoneR;
    this.nextCx = this.finalCx * 0.25;
    this.nextCz = this.finalCz * 0.25;
    if (this.ranked) this.loot = generateLoot(this.seed, this.world?.lootAnchors);
    else {
      this.loot = TRAINING_RANGE.pickups.map((p, i) => ({
        id: p.id,
        defId: p.kind,
        kind: p.kind,
        rarity: "common" as const,
        label: p.kind,
        x: p.x,
        z: p.z,
        live: true,
        ammo: 0,
      }));
    }
    if (mode === "range") this.makeTrainers();
  }

  start(): void {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => this.step(), 1000 / 60);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  noteFill(matches: number): void {
    this.protectMatches = Math.max(0, matches);
  }

  beginMatch(): void {
    this.phase = "live";
    this.startedAt = Date.now();
    this.timeLeft = this.rules.timeLimitSec ?? 0;
    this.start();
    audit.write({ kind: "match_start", actor: "room", matchId: this.id, detail: `${this.mode} ${this.region} ${this.mapId}` });
    if (this.ranked) {
      this.matchPhase = "loading";
      this.introLeft = LOADING_SEC;
    } else {
      this.matchPhase = "combat";
      this.events.push({ kind: "announce", text: "WEAPONS FREE" });
    }
  }

  hasPlayer(id: string): boolean {
    return this.pawns.has(id);
  }

  teammates(id: string): string[] {
    const p = this.pawns.get(id);
    if (!p) return [];
    return [...this.pawns.values()]
      .filter((o) => o.team === p.team && !o.dummy)
      .map((o) => o.account.id);
  }

  size(): number {
    return [...this.pawns.values()].filter((p) => !p.dummy && !p.bot).length;
  }

  full(): boolean {
    return this.size() >= MAX_PLAYERS_PER_ROOM;
  }

  join(
    account: Account,
    wire: Wire,
    team: TeamId = "none",
    meta?: { bot?: boolean; friend?: boolean; ping?: number },
  ): void {
    const existing = this.pawns.get(account.id);
    if (existing) {
      existing.wire = wire;
      existing.disconnected = false;
      existing.reservedUntil = 0;
      this.welcome(existing);
      return;
    }
    const spawn = this.spawnFor(team, this.teamCount(team));
    const p9 = WEAPONS.stitch;
    const pawn: Pawn = {
      account,
      wire,
      body: makeBody(spawn.x, spawn.z, spawn.yaw),
      health: MAX_HEALTH,
      armor: 0,
      alive: true,
      lastSeq: 0,
      lastInputAt: Date.now(),
      fireCooldown: 0,
      pending: null,
      inputsThisSecond: 0,
      secondMark: Date.now(),
      dummy: false,
      bot: Boolean(meta?.bot || account.contact),
      friend: Boolean(meta?.friend),
      team,
      respawnIn: 0,
      ammo: p9.mag,
      reserves: p9.mag * 2,
      reloadIn: 0,
      grenades: this.ranked ? 0 : 2,
      nadeCd: 0,
      ping: meta?.ping ?? 30,
      hist: [],
      match: { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, revives: 0 },
      assistsOn: [],
      lastAimErr: 1,
      aimHits: 0,
      wallTries: 0,
      disconnected: false,
      reservedUntil: 0,
      spectator: false,
      downed: false,
      eliminated: false,
      downedLeft: 0,
      reviveProg: 0,
      revivingId: "",
      armorLevel: 0,
      armorDura: 0,
      primary: this.ranked ? null : { id: "virex", ammo: 30, reserves: 90 },
      secondary: { id: "stitch", ammo: p9.mag, reserves: p9.mag * 2 },
      melee: { id: "knife", ammo: 0, reserves: 0 },
      active: this.ranked ? "secondary" : "primary",
      medical: { id: "bandage", qty: 1 },
      utility: null,
      healLeft: 0,
      speaking: false,
      attachments: [],
      ads: false,
      fireMode: this.ranked ? p9.mode : WEAPONS.virex.mode,
      burstLeft: 0,
      chamber: true,
      swapLock: 0,
      flashUntil: 0,
      nadeId: "frag",
      nadeBag: this.ranked ? [] : ["frag", "smoke"],
      shotIndex: 0,
      prevButtons: 0,
      recoilP: 0,
      recoilY: 0,
      appearance: account.appearance ?? defaultAppearance(),
      emote: "",
      emoteLeft: 0,
      stepT: 0,
      travel: 0,
      activeSec: 0,
      bestDist: 0,
      seenReq: new Set(),
    };
    this.syncAmmo(pawn);
    pawn.fireMode = weaponById(this.gun(pawn).id).mode;
    this.pawns.set(account.id, pawn);
    if (pawn.bot && !pawn.dummy) this.attachMind(pawn);
    this.start();
    if (!pawn.bot) this.welcome(pawn);
    this.events.push({ kind: "spawn", id: account.id, x: spawn.x, z: spawn.z });
  }

  addSpectator(wire: Wire): void {
    this.spectators.push(wire);
  }

  leave(playerId: string): void {
    const p = this.pawns.get(playerId);
    if (!p) return;
    if (this.ranked && this.phase === "live" && !p.bot) {
      this.disconnect(playerId);
      return;
    }
    this.pawns.delete(playerId);
    dropBrain(playerId);
    this.maybeEmpty();
  }

  disconnect(playerId: string): void {
    const p = this.pawns.get(playerId);
    if (!p) return;
    p.disconnected = true;
    p.reservedUntil = Date.now() + 5 * 60_000;
    p.wire = { send() {}, close() {} };
    this.events.push({ kind: "announce", text: `${p.account.name} disconnected — slot reserved` });
  }

  reconnect(account: Account, wire: Wire): boolean {
    const p = this.pawns.get(account.id);
    if (!p || this.phase === "ended") return false;
    p.wire = wire;
    p.disconnected = false;
    p.reservedUntil = 0;
    this.welcome(p);
    return true;
  }

  botTakeover(playerId: string): void {
    const p = this.pawns.get(playerId);
    if (!p || this.phase === "ended") return;
    p.bot = true;
    p.disconnected = false;
    p.wire = { send() {}, close() {} };
    this.attachMind(p);
    this.events.push({ kind: "announce", text: `${p.account.name} dropped — covering` });
  }

  handle(playerId: string, msg: C2S): void {
    const p = this.pawns.get(playerId);
    if (!p) return;
    switch (msg.type) {
      case MSG.INPUT:
        this.queueInput(p, msg.input);
        break;
      case MSG.USE_ITEM:
        if (this.onceReq(p, msg.requestId)) this.useItem(p, msg.itemId);
        break;
      case MSG.BUY:
        if (this.onceReq(p, msg.requestId)) this.buy(p, msg.sku);
        break;
      case MSG.WORLD_PING:
        this.dropPing(p, msg.kind);
        break;
      case MSG.QUICK_CHAT:
        this.quickChat(p, msg.code);
        break;
      case MSG.SWAP_SLOT:
        this.swap(p, msg.slot);
        break;
      case MSG.REPORT:
        this.flags.note(msg.targetId, "reported", "client", `report by ${p.account.name}: ${msg.reason}`, 2);
        p.wire.send({ type: MSG.ERROR, code: "rejected", message: "Report filed for review" });
        break;
      case MSG.VOICE:
        p.speaking = msg.speaking;
        break;
      default:
        break;
    }
  }

  private welcome(p: Pawn): void {
    p.wire.send({
      type: MSG.WELCOME,
      playerId: p.account.id,
      serverTime: Date.now(),
      tickHz: TICK_HZ,
      room: this.id,
      region: this.region,
    });
    p.wire.send({ type: MSG.MATCH_START, room: this.id, mode: this.mode });
    this.pushEconomy(p);
  }

  private sendIntro(): void {
    const pack = (team: TeamId) =>
      [...this.pawns.values()]
        .filter((p) => p.team === team)
        .map((p) => ({
          name: p.account.name,
          rank: rankName(p.account.mmr),
          character: p.account.character,
        }));
    const msg: S2C = {
      type: MSG.INTRO,
      mapName: this.mapName,
      mapId: this.mapId,
      weather: this.weather,
      matchNumber: this.matchNumber,
      duration: INTRO_SEC,
      alpha: pack("alpha"),
      bravo: pack("bravo"),
    };
    for (const p of this.pawns.values()) if (!p.bot && !p.dummy) p.wire.send(msg);
  }

  private queueInput(p: Pawn, raw: InputPayload): void {
    const input = sanitizeInput(raw);
    if (!input) {
      this.flags.note(p.account.id, p.account.name, "packet", "malformed input", 2);
      return;
    }
    const now = Date.now();
    if (now - p.secondMark > 1000) {
      p.secondMark = now;
      p.inputsThisSecond = 0;
    }
    p.inputsThisSecond++;
    if (p.inputsThisSecond > TICK_HZ + 8) {
      this.flags.note(p.account.id, p.account.name, "rate", "input burst");
      return;
    }
    if (input.seq <= p.lastSeq) return;
    if (input.seq > p.lastSeq + 24) {
      this.flags.note(p.account.id, p.account.name, "packet", "seq jump", 2);
      return;
    }
    p.pending = input;
    p.lastInputAt = now;
  }

  private onceReq(p: Pawn, requestId: number): boolean {
    const id = Number(requestId) || 0;
    if (!id) return true;
    if (p.seenReq.has(id)) return false;
    p.seenReq.add(id);
    if (p.seenReq.size > 64) p.seenReq.delete(p.seenReq.values().next().value as number);
    return true;
  }

  private step(): void {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= TICK_DT && guard++ < 5) {
      this.simulate();
      this.acc -= TICK_DT;
    }
  }

  private simulate(): void {
    this.tick++;
    this.events.length = 0;
    if (this.phase === "live" && this.rules.timeLimitSec) {
      this.timeLeft = Math.max(0, this.timeLeft - TICK_DT);
    }
    this.stepFlow();
    if (this.ranked && this.matchPhase !== "loading" && this.matchPhase !== "intro") this.stepZone();

    const frozen = this.matchPhase === "loading" || this.matchPhase === "intro";

    for (const p of this.pawns.values()) {
      if (p.dummy) {
        this.tickDummy(p);
        continue;
      }
      if (p.spectator || p.eliminated) continue;

      if (p.downed) {
        this.tickDowned(p);
        continue;
      }
      if (!p.alive) {
        if (this.rules.respawn) {
          p.respawnIn -= TICK_DT;
          if (p.respawnIn <= 0) this.respawn(p);
        }
        continue;
      }

      p.fireCooldown = Math.max(0, p.fireCooldown - TICK_DT);
      p.nadeCd = Math.max(0, p.nadeCd - TICK_DT);
      p.swapLock = Math.max(0, p.swapLock - TICK_DT);
      if (p.flashUntil > 0) p.flashUntil = Math.max(0, p.flashUntil - TICK_DT);
      if (p.reloadIn > 0) {
        p.reloadIn -= TICK_DT;
        if (p.reloadIn <= 0) this.finishReload(p);
      }
      if (p.healLeft > 0) {
        p.healLeft -= TICK_DT;
        if (p.healLeft <= 0) this.finishHeal(p);
      }

      if (p.bot || p.disconnected) {
        p.pending = botInput(
          {
            id: p.account.id,
            x: p.body.x,
            y: p.body.y,
            z: p.body.z,
            yaw: p.body.yaw,
            pitch: p.body.pitch,
            team: p.team,
            alive: p.alive && !p.downed,
            ammo: p.ammo,
            reloading: p.reloadIn > 0,
            downed: p.downed,
            health: p.health,
            weaponClass: weaponById(this.gun(p).id).class,
            grenades: p.grenades,
            hasMed: Boolean(p.medical),
            zoneCx: this.zoneCx,
            zoneCz: this.zoneCz,
            zoneR: this.zoneR,
            wantLoot: this.matchPhase === "loot" || !p.primary,
            flash: p.flashUntil,
          },
          this.botViews(p),
          this.loot.filter((l) => l.live).map((l) => ({ x: l.x, z: l.z, id: l.id, kind: l.defId })),
          p.lastSeq + 1,
          this.tick,
          this.botWorld(p),
        );
      }

      if (p.pending) {
        const input = p.pending;
        p.pending = null;
        p.lastSeq = input.seq;
        const rose = (bit: number) => Boolean(input.buttons & bit) && !(p.prevButtons & bit);
        if (!frozen) {
          if (rose(BTN.SLOT1)) this.swap(p, "primary");
          if (rose(BTN.SLOT2)) this.swap(p, "secondary");
          if (rose(BTN.SLOT3)) this.swap(p, "melee");
          if (rose(BTN.MODE)) this.cycleMode(p);
          if (rose(BTN.CYCLE_NADE)) this.cycleNadeKind(p);
        }
        p.ads =
          Boolean(input.buttons & BTN.AIM) &&
          p.active !== "melee" &&
          p.body.stance !== "prone" &&
          p.body.slide <= 0 &&
          p.emoteLeft <= 0;
        if (p.emoteLeft > 0) {
          p.emoteLeft = Math.max(0, p.emoteLeft - TICK_DT);
          if (p.emoteLeft <= 0) p.emote = "";
          input.moveX = 0;
          input.moveY = 0;
        }
        if (rose(BTN.EMOTE)) this.playEmote(p, "hail");
        const wdef = weaponById(this.gun(p).id);
        const mods = modsFrom(p.attachments);
        if (p.ads && (wdef.class === "sniper" || wdef.class === "dmr")) {
          const still = Math.hypot(p.body.vx, p.body.vz) < 0.35;
          const amp = still ? 0.0011 : 0.0036;
          p.body.pitch = Math.max(-1.2, Math.min(1.2, p.body.pitch + Math.sin(this.tick * 0.21) * amp));
          p.body.yaw += Math.cos(this.tick * 0.17) * amp * 0.55;
        }
        const moveScale = wdef.moveMul * mods.move * (p.ads ? wdef.adsMove * mods.ads : 1);
        const safe: InputPayload = {
          ...input,
          dt: TICK_DT,
          moveX: clampUnit(input.moveX) * moveScale,
          moveY: clampUnit(input.moveY) * moveScale,
        };
        if (frozen) {
          safe.moveX = 0;
          safe.moveY = 0;
          safe.buttons = 0;
        }
        const before = { x: p.body.x, z: p.body.z };
        applyInput(p.body, safe, this.map);
        const stepped = dist2(before.x, before.z, p.body.x, p.body.z);
        p.travel += stepped;
        if (stepped > 0.02 || safe.buttons & (BTN.FIRE | BTN.JUMP | BTN.INTERACT | BTN.USE | BTN.GRENADE)) {
          p.activeSec += TICK_DT;
        }
        if (p.body.landDrop > 0) {
          const fd = fallDamage(p.body.landDrop);
          if (fd > 0) {
            this.applyRaw(p, fd, "fall", null);
            this.events.push({ kind: "fall", id: p.account.id, dmg: fd });
          }
        }
        if (p.body.loco === "sprint" || p.body.loco === "run") {
          p.stepT += TICK_DT;
          if (p.stepT >= (p.body.loco === "sprint" ? 0.28 : 0.42)) {
            p.stepT = 0;
            this.events.push({
              kind: "step",
              id: p.account.id,
              loud: p.body.loco === "sprint",
              surface: surfaceAt(p.body.x, p.body.z, this.map),
            });
          }
        }
        const rec = 1 - Math.exp(-wdef.recov * TICK_DT);
        const dp = p.recoilP * rec;
        const dy = p.recoilY * rec;
        p.body.pitch = Math.max(-1.2, Math.min(1.2, p.body.pitch + dp));
        p.body.yaw -= dy;
        p.recoilP -= dp;
        p.recoilY -= dy;
        if (dist2(before.x, before.z, p.body.x, p.body.z) > 9.2 * TICK_DT + 0.2) {
          this.flags.note(p.account.id, p.account.name, "speed", "step");
        }
        if (!frozen) {
          if (rose(BTN.RELOAD)) this.startReload(p);
          if (safe.buttons & BTN.FIRE) this.tryFire(p);
          else p.burstLeft = 0;
          if (rose(BTN.GRENADE)) this.tryNade(p);
          if (safe.buttons & BTN.INTERACT) this.tryInteract(p);
          if (rose(BTN.USE)) this.useMedical(p);
          if (rose(BTN.PING)) this.dropPing(p, "go");
        }
        p.prevButtons = input.buttons;
      } else {
        applyInput(
          p.body,
          { seq: p.lastSeq, dt: TICK_DT, moveX: 0, moveY: 0, lookX: 0, lookY: 0, buttons: 0 },
          this.map,
        );
      }
      if (p.revivingId) this.tickRevive(p);
      p.hist.push({ tick: this.tick, x: p.body.x, y: p.body.y, z: p.body.z });
      if (p.hist.length > 10) p.hist.shift();
    }

    this.stepNades();
    this.stepBolts();
    this.stepClouds();
    this.pings = this.pings.filter((x) => x.until > Date.now());
    if (!this.ranked) {
      for (const pk of this.loot) {
        if (pk.live) continue;
        // range restock handled via id reuse — skip
      }
    }
    if (this.phase === "live") this.checkEnd();
    this.collectCues();
    this.broadcast();
  }

  private stepFlow(): void {
    if (!this.ranked || this.phase !== "live") return;
    if (this.matchPhase === "loading") {
      this.introLeft -= TICK_DT;
      if (this.introLeft <= 0) {
        this.matchPhase = "intro";
        this.introLeft = INTRO_SEC;
        this.sendIntro();
      }
      return;
    }
    if (this.matchPhase === "intro") {
      this.introLeft -= TICK_DT;
      if (this.introLeft <= 0) {
        this.matchPhase = "loot";
        this.events.push({ kind: "announce", text: "LOOT PHASE — FIND YOUR EDGE" });
      }
    }
  }

  private stepZone(): void {
    const def = this.zones[this.zoneI];
    if (!def) return;
    this.zoneT += TICK_DT;
    if (!this.shrinking) {
      if (this.zoneT >= def.wait && this.zoneI < this.zones.length - 1) {
        this.shrinking = true;
        this.zoneT = 0;
        this.fromCx = this.zoneCx;
        this.fromCz = this.zoneCz;
        this.fromR = this.zoneR;
        const nxt = this.zones[this.zoneI + 1];
        const pull = (this.zoneI + 1) / (this.zones.length - 1);
        this.nextCx = this.finalCx * pull;
        this.nextCz = this.finalCz * pull;
        this.nextR = nxt.radius;
        this.events.push({ kind: "announce", text: "ZONE CLOSING — " + nxt.name });
        if (this.zoneI >= 1) this.matchPhase = "circle";
        if (nxt.id === 6) this.matchPhase = "final";
      }
    } else {
      const dur = Math.max(0.1, def.shrink);
      const k = Math.min(1, this.zoneT / dur);
      this.zoneCx = this.fromCx + (this.nextCx - this.fromCx) * k;
      this.zoneCz = this.fromCz + (this.nextCz - this.fromCz) * k;
      this.zoneR = this.fromR + (this.nextR - this.fromR) * k;
      if (k >= 1) {
        this.shrinking = false;
        this.zoneT = 0;
        this.zoneI = Math.min(this.zoneI + 1, this.zones.length - 1);
        this.zoneCx = this.nextCx;
        this.zoneCz = this.nextCz;
        this.zoneR = this.nextR;
      }
    }
    const dps = this.zones[this.zoneI].dps;
    if (dps <= 0) return;
    for (const p of this.pawns.values()) {
      if (p.eliminated || p.dummy || !p.alive && !p.downed) continue;
      if (p.downed && !p.alive) continue;
      const d = dist2(p.body.x, p.body.z, this.zoneCx, this.zoneCz);
      if (d <= this.zoneR) continue;
      this.applyRaw(p, dps * TICK_DT, "zone", null);
    }
  }

  private gun(p: Pawn): Gun {
    if (p.active === "primary") return p.primary ?? p.secondary;
    if (p.active === "melee") return p.melee;
    return p.secondary;
  }

  private syncAmmo(p: Pawn): void {
    const g = this.gun(p);
    p.ammo = g.ammo;
    p.reserves = g.reserves;
  }

  private swap(p: Pawn, slot: "primary" | "secondary" | "melee"): void {
    if (slot === p.active) return;
    if (slot === "primary" && !p.primary) return;
    if (p.swapLock > 0) return;
    if (p.reloadIn > 0) p.reloadIn = 0;
    this.gun(p).ammo = p.ammo;
    this.gun(p).reserves = p.reserves;
    p.active = slot;
    const w = weaponById(this.gun(p).id);
    p.swapLock = w.swap;
    p.fireMode = w.fireModes.includes(p.fireMode) ? p.fireMode : w.mode;
    p.burstLeft = 0;
    this.syncAmmo(p);
    telemetry.pick(w.id);
  }

  private cycleMode(p: Pawn): void {
    const w = weaponById(this.gun(p).id);
    p.fireMode = nextMode(w, p.fireMode);
    p.burstLeft = 0;
  }

  private cycleNadeKind(p: Pawn): void {
    const owned = [...new Set(p.nadeBag.length ? p.nadeBag : p.grenades > 0 ? [p.nadeId] : [])];
    if (!owned.length) return;
    p.nadeId = cycleNade(p.nadeId, owned);
  }

  private startReload(p: Pawn): void {
    if (p.reloadIn > 0 || p.active === "melee" || p.swapLock > 0) return;
    const w = weaponById(this.gun(p).id);
    const mods = modsFrom(p.attachments);
    const mag = magSize(w, mods);
    if (!w.mag || p.ammo >= mag || p.reserves <= 0) return;
    p.reloadIn = reloadTime(w, p.ammo <= 0, mods);
    p.chamber = p.ammo > 0;
    this.events.push({ kind: "reload", id: p.account.id });
  }

  private finishReload(p: Pawn): void {
    const g = this.gun(p);
    const w = weaponById(g.id);
    const mag = magSize(w, modsFrom(p.attachments)) + (p.chamber ? 1 : 0);
    const need = mag - g.ammo;
    const take = Math.min(need, g.reserves);
    g.ammo += take;
    g.reserves -= take;
    p.reloadIn = 0;
    p.chamber = true;
    this.syncAmmo(p);
  }

  private tryFire(p: Pawn): void {
    if (p.fireCooldown > 0 || p.healLeft > 0 || p.swapLock > 0) return;
    if (p.reloadIn > 0) {
      p.reloadIn = 0;
      return;
    }
    const g = this.gun(p);
    const weapon = weaponById(g.id);
    const mods = modsFrom(p.attachments);
    const heavy = p.ads && weapon.class === "melee";
    const held = Boolean(p.prevButtons & BTN.FIRE);
    if (weapon.class !== "melee" && p.fireMode === "single" && held) return;
    if (weapon.class !== "melee" && p.fireMode === "burst" && p.burstLeft <= 0 && held) return;
    if (weapon.class !== "melee") {
      if (g.ammo <= 0) {
        this.startReload(p);
        return;
      }
      if (p.fireMode === "burst" && p.burstLeft <= 0) p.burstLeft = weapon.burst;
      g.ammo -= 1;
      this.syncAmmo(p);
    }
    const interval =
      p.fireMode === "single" && weapon.class !== "melee"
        ? Math.max(weapon.interval, 0.12)
        : weapon.interval;
    p.fireCooldown = weapon.class === "melee" && heavy ? interval * 1.55 : interval;
    if (p.fireMode === "burst") {
      p.burstLeft -= 1;
      if (p.burstLeft > 0) p.fireCooldown = Math.min(interval, 0.07);
    }
    p.match.shots += 1;
    telemetry.shot(weapon.id);
    if (!this.ranked) this.store.bumpStat(p.account.id, "shots", 1);

    const kick = recoilKick(weapon, mods, p.ads, p.shotIndex++);
    p.recoilP += kick.pitch;
    p.recoilY += kick.yaw;
    p.body.pitch = Math.max(-1.2, Math.min(1.2, p.body.pitch - kick.pitch));
    p.body.yaw += kick.yaw;

    const originX = p.body.x;
    const originY = p.body.y + eyeHeight(p.body);
    const originZ = p.body.z;
    const adsMul = (p.ads ? weapon.adsSpread * mods.ads : 1) * fireSpreadMul(p.body.stance, p.body.loco === "sprint", p.body.slide);
    const pellets = weapon.pellets;
    const rewind = this.rewindTicks(p.ping);
    const dmgBase = weapon.class === "melee" && heavy ? weapon.damage * 1.55 : weapon.damage;

    for (let i = 0; i < pellets; i++) {
      const spr = weapon.spread * mods.spread * adsMul;
      const yawJ = (Math.random() - 0.5) * spr * 2;
      const pitJ = (Math.random() - 0.5) * spr;
      const sx = Math.sin(p.body.yaw + yawJ) * Math.cos(p.body.pitch + pitJ);
      const sy = -Math.sin(p.body.pitch + pitJ);
      const sz = Math.cos(p.body.yaw + yawJ) * Math.cos(p.body.pitch + pitJ);
      if (weapon.ballistic === "projectile") {
        this.bolts.push({
          x: originX + sx * 0.6,
          y: originY,
          z: originZ + sz * 0.6,
          vx: sx * weapon.speed,
          vy: sy * weapon.speed,
          vz: sz * weapon.speed,
          life: weapon.range / Math.max(80, weapon.speed),
          dmg: dmgBase,
          owner: p.account.id,
          team: p.team,
          weapon: weapon.id,
          pen: weapon.pen,
        });
      } else {
        this.hitscan(p, weapon, originX, originY, originZ, sx, sy, sz, weapon.range, rewind, dmgBase, heavy);
      }
    }
  }

  private hitscan(
    p: Pawn,
    weapon: (typeof WEAPONS)[string],
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    range: number,
    rewind: number,
    dmgBase: number,
    heavy: boolean,
  ): void {
    const endX = ox + dx * range;
    const endZ = oz + dz * range;
    if (this.shatterAlong(ox, oz, endX, endZ) && weapon.pen <= 0) return;
    const blocked = hitscanBlocked(ox, oz, endX, endZ, this.map);
    if (blocked && weapon.pen <= 0) return;
    let best: Pawn | null = null;
    let bestT = range;
    let bestPos = { x: 0, y: 0, z: 0 };
    for (const other of this.pawns.values()) {
      if (other === p || other.eliminated || other.spectator) continue;
      if (!other.alive && !other.downed) continue;
      if (!this.rules.friendlyFire && other.team === p.team && p.team !== "none") continue;
      const pos = this.rewound(other, rewind);
      const hh = hitHeight(other.body.stance, { slide: other.body.slide, downed: other.downed, vault: other.body.vault });
      const t = rayHitCylinder(ox, oy, oz, dx, dy, dz, pos.x, pos.y, pos.z, PLAYER_RADIUS + 0.08, hh);
      if (t !== null && t < bestT && t > 0.15) {
        bestT = t;
        best = other;
        bestPos = pos;
      }
    }
    if (!best) return;
    if (hitscanBlocked(ox, oz, bestPos.x, bestPos.z, this.map) && weapon.pen <= 0) {
      p.wallTries++;
      if (p.wallTries === 8 || p.wallTries === 24) {
        this.flags.note(p.account.id, p.account.name, "wall", `occluded hits ${p.wallTries}`, 2);
      }
      return;
    }
    const hitY = oy + dy * bestT;
    const radial = Math.hypot(bestPos.x - (ox + dx * bestT), bestPos.z - (oz + dz * bestT));
    const zone = hitZone(hitY - bestPos.y, radial, PLAYER_RADIUS);
    let dmg = zoneDamage(dmgBase, zone, weapon.headMul);
    dmg *= falloff(weapon, bestT);
    if (blocked) dmg *= weapon.pen;
    if (weapon.class === "melee" && best.downed) dmg = 42;
    telemetry.hit(weapon.id, dmg);
    if (weapon.class === "melee") {
      const k = heavy ? 7.5 : 3.6;
      best.body.vx += dx * k;
      best.body.vz += dz * k;
    }
    this.applyDamage(p, best, dmg, weapon.name, bestT, zone === "head");
    this.events.push({
      kind: "hit",
      src: p.account.id,
      dst: best.account.id,
      dmg: Math.round(dmg),
      x: ox + dx * bestT,
      y: hitY,
      z: oz + dz * bestT,
    });
  }

  private tryNade(p: Pawn): void {
    if (p.nadeCd > 0 || p.grenades <= 0) return;
    p.grenades -= 1;
    p.nadeCd = 1.15;
    const bagAt = p.nadeBag.indexOf(p.nadeId);
    if (bagAt >= 0) p.nadeBag.splice(bagAt, 1);
    else if (p.nadeBag.length) p.nadeBag.pop();
    const kind = (ITEMS[p.nadeId]?.nadeKind ?? "frag") as NadeKind;
    if (p.nadeBag.length) p.nadeId = p.nadeBag[0];
    const cy = Math.cos(p.body.pitch);
    const dx = Math.sin(p.body.yaw) * cy;
    const dy = -Math.sin(p.body.pitch) + 0.32;
    const dz = Math.cos(p.body.yaw) * cy;
    this.nades.push({
      x: p.body.x + dx * 0.6,
      y: p.body.y + 1.3,
      z: p.body.z + dz * 0.6,
      vx: dx * GRENADE_SPEED,
      vy: dy * GRENADE_SPEED,
      vz: dz * GRENADE_SPEED,
      fuse: kind === "flash" ? 1.15 : GRENADE_FUSE,
      owner: p.account.id,
      team: p.team,
      kind,
    });
  }

  private stepNades(): void {
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.vy -= 18 * TICK_DT;
      n.x += n.vx * TICK_DT;
      n.y += n.vy * TICK_DT;
      n.z += n.vz * TICK_DT;
      if (n.y < 0.18) {
        n.y = 0.18;
        n.vy *= -0.32;
        n.vx *= 0.62;
        n.vz *= 0.62;
        if (Math.hypot(n.vx, n.vz) < 0.8) {
          n.vx = 0;
          n.vz = 0;
        }
      }
      n.fuse -= TICK_DT;
      if (n.fuse > 0) continue;
      this.detonate(n);
      this.nades.splice(i, 1);
    }
  }

  private detonate(n: Nade): void {
    this.events.push({ kind: "nade", x: n.x, y: n.y, z: n.z });
    this.blastWorld(n.x, n.z, n.kind === "smoke" ? 2.2 : GRENADE_RADIUS);
    const owner = this.pawns.get(n.owner);
    if (n.kind === "smoke") {
      this.clouds.push({ x: n.x, z: n.z, r: 6.2, until: this.tick * TICK_DT + 14, kind: "smoke", dps: 0 });
      return;
    }
    if (n.kind === "fire") {
      this.clouds.push({ x: n.x, z: n.z, r: 4.2, until: this.tick * TICK_DT + 8, kind: "fire", dps: 12 });
    }
    for (const o of this.pawns.values()) {
      if (o.eliminated) continue;
      if (!o.alive && !o.downed) continue;
      const d = Math.hypot(o.body.x - n.x, o.body.y + 0.9 - n.y, o.body.z - n.z);
      if (n.kind === "flash") {
        if (d > 16) continue;
        const look = Math.cos(o.body.yaw) * (n.z - o.body.z) + Math.sin(o.body.yaw) * (n.x - o.body.x);
        o.flashUntil = Math.max(o.flashUntil, (1.6 - d / 16) * (look > 0 ? 1 : 0.35));
        continue;
      }
      if (d > GRENADE_RADIUS) continue;
      if (!this.rules.friendlyFire && o.team === n.team && o.account.id !== n.owner) continue;
      const dmg = Math.round((n.kind === "fire" ? 42 : GRENADE_DAMAGE) * (1 - d / GRENADE_RADIUS));
      if (owner) this.applyDamage(owner, o, dmg, n.kind === "fire" ? "Cinder Pot" : "Shiver Charge", d, false);
      else this.applyRaw(o, dmg, "explosive", null);
    }
  }

  private stepBolts(): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const nx = b.x + b.vx * TICK_DT;
      const ny = b.y + b.vy * TICK_DT;
      const nz = b.z + b.vz * TICK_DT;
      b.vy -= (weaponById(b.weapon).drop || 9) * TICK_DT;
      if (this.shatterAlong(b.x, b.z, nx, nz) && b.pen <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      if (hitscanBlocked(b.x, b.z, nx, nz, this.map) && b.pen <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      const owner = this.pawns.get(b.owner);
      let hit = false;
      for (const o of this.pawns.values()) {
        if (!owner || o === owner || o.eliminated) continue;
        if (!o.alive && !o.downed) continue;
        if (!this.rules.friendlyFire && o.team === b.team) continue;
        const hh = hitHeight(o.body.stance, { slide: o.body.slide, downed: o.downed, vault: o.body.vault });
        const t = rayHitCylinder(b.x, b.y, b.z, b.vx, b.vy, b.vz, o.body.x, o.body.y, o.body.z, PLAYER_RADIUS + 0.1, hh);
        if (t === null || t > TICK_DT) continue;
        const w = weaponById(b.weapon);
        const dmg = zoneDamage(b.dmg, "upper", w.headMul) * falloff(w, dist2(owner.body.x, owner.body.z, o.body.x, o.body.z));
        telemetry.hit(b.weapon, dmg);
        this.applyDamage(owner, o, dmg, w.name, dist2(owner.body.x, owner.body.z, o.body.x, o.body.z), false);
        this.events.push({
          kind: "hit",
          src: owner.account.id,
          dst: o.account.id,
          dmg: Math.round(dmg),
          x: o.body.x,
          y: o.body.y + 1.2,
          z: o.body.z,
        });
        hit = true;
        break;
      }
      if (hit || ny < 0 || b.life - TICK_DT <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      b.x = nx;
      b.y = ny;
      b.z = nz;
      b.life -= TICK_DT;
    }
  }

  private stepClouds(): void {
    const now = this.tick * TICK_DT;
    this.clouds = this.clouds.filter((c) => c.until > now);
    for (const c of this.clouds) {
      if (c.kind !== "fire" || c.dps <= 0) continue;
      for (const p of this.pawns.values()) {
        if (p.eliminated || (!p.alive && !p.downed)) continue;
        if (dist2(p.body.x, p.body.z, c.x, c.z) > c.r) continue;
        this.applyRaw(p, c.dps * TICK_DT, "fire", null);
      }
    }
  }

  private smokeBlocks(ax: number, az: number, bx: number, bz: number): boolean {
    for (const c of this.clouds) {
      if (c.kind !== "smoke") continue;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        if (dist2(ax + (bx - ax) * t, az + (bz - az) * t, c.x, c.z) < c.r * 0.92) return true;
      }
    }
    return false;
  }

  private applyDamage(src: Pawn, dst: Pawn, amount: number, weapon: string, dist: number, _head: boolean): void {
    if (dst.eliminated) return;
    const soaked = this.applyRaw(dst, amount, "bullet", src);
    src.match.damage += soaked;
    src.match.hits += 1;
    dst.assistsOn.push({ id: src.account.id, at: this.tick * TICK_DT });
    if (!this.ranked && !src.dummy) {
      this.store.bumpStat(src.account.id, "damage", soaked);
      this.store.bumpStat(src.account.id, "hits", 1);
    }
    if (dst.eliminated || (dst.downed && !dst.alive && this.rules.battleRoyale)) {
      /* down handled in applyRaw */
    }
    if (dst.eliminated && src) {
      this.events.push({
        kind: "elim",
        src: src.account.id,
        dst: dst.account.id,
        weapon,
        dist: Math.round(dist),
        dmg: Math.round(amount),
      });
    }
  }

  private applyRaw(dst: Pawn, amount: number, kind: string, src: Pawn | null): number {
    if (dst.eliminated) return 0;
    let left = amount;
    if (kind !== "zone" && dst.armorLevel > 0 && dst.armorDura > 0) {
      const soak = ARMOR_SOAK[dst.armorLevel as 0 | 1 | 2 | 3] ?? 0;
      const absorbed = left * soak;
      dst.armorDura -= absorbed;
      left -= absorbed;
      if (dst.armorDura <= 0) {
        dst.armorLevel = 0;
        dst.armorDura = 0;
        dst.armor = 0;
      } else {
        dst.armor = dst.armorDura;
      }
    }
    if (dst.downed) {
      dst.downedLeft -= left * 0.08;
      if (dst.downedLeft <= 0) this.eliminate(src, dst);
      return amount;
    }
    dst.health -= left;
    if (dst.health <= 0) {
      dst.health = 0;
      if (this.rules.battleRoyale && !dst.dummy) this.down(src, dst);
      else this.kill(src, dst);
    }
    return amount;
  }

  private down(src: Pawn | null, dst: Pawn): void {
    dst.downed = true;
    dst.alive = true;
    dst.health = 0;
    dst.downedLeft = DOWNED_TIME;
    dst.reloadIn = 0;
    dst.healLeft = 0;
    dst.revivingId = "";
    this.events.push({ kind: "down", src: src?.account.id ?? "zone", dst: dst.account.id });
    if (src) this.events.push({ kind: "announce", text: `${dst.account.name} DOWN` });
  }

  private tickDowned(p: Pawn): void {
    p.downedLeft -= TICK_DT;
    p.downedLeft -= BLEED_DPS * TICK_DT * 0.15;
    if (p.pending) {
      const input = p.pending;
      p.pending = null;
      p.lastSeq = input.seq;
      const crawl: InputPayload = {
        ...input,
        dt: TICK_DT,
        moveX: clampUnit(input.moveX) * CRAWL_SCALE,
        moveY: clampUnit(input.moveY) * CRAWL_SCALE,
        buttons: input.buttons & BTN.PING,
      };
      applyInput(p.body, crawl, this.map);
      if (input.buttons & BTN.PING) this.dropPing(p, "help");
    }
    if (p.downedLeft <= 0) this.eliminate(null, p);
  }

  private tryInteract(p: Pawn): void {
    for (const o of this.pawns.values()) {
      if (o === p || !o.downed || o.eliminated || o.team !== p.team) continue;
      if (dist2(p.body.x, p.body.z, o.body.x, o.body.z) > 2.1) continue;
      p.revivingId = o.account.id;
      return;
    }
    if (this.toggleDoor(p)) return;
    this.tryLoot(p);
  }

  private toggleDoor(p: Pawn): boolean {
    const doors = this.map.doors || [];
    let best: (typeof doors)[number] | null = null;
    let bd = 1.85;
    for (const d of doors) {
      const dist = dist2(p.body.x, p.body.z, d.x, d.z);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    if (!best) return false;
    this.doorOpen[best.id] = !this.doorOpen[best.id];
    syncBlockers(this.map, this.doorOpen, this.broken);
    this.events.push({ kind: "door", id: best.id, open: this.doorOpen[best.id] });
    return true;
  }

  private shatterAlong(ax: number, az: number, bx: number, bz: number): boolean {
    let hit = false;
    for (const g of this.map.glass || []) {
      if (this.broken.has(g.id)) continue;
      if (!segmentAabb(ax, az, bx, bz, g)) continue;
      this.broken.add(g.id);
      this.events.push({ kind: "glass", id: g.id });
      hit = true;
    }
    if (hit) syncBlockers(this.map, this.doorOpen, this.broken);
    return hit;
  }

  private blastWorld(x: number, z: number, r: number): void {
    let dirty = false;
    for (const g of this.map.glass || []) {
      if (this.broken.has(g.id)) continue;
      if (dist2(x, z, g.x, g.z) > r) continue;
      this.broken.add(g.id);
      this.events.push({ kind: "glass", id: g.id });
      dirty = true;
    }
    if (dirty) syncBlockers(this.map, this.doorOpen, this.broken);
    const keep = [];
    for (const prop of this.map.props) {
      const h = prop.h ?? 1.1;
      const small = h <= 1.25 && prop.hx * prop.hz < 4;
      if (small && dist2(x, z, prop.x, prop.z) < Math.min(3.4, r)) {
        const key = `${prop.x.toFixed(1)}_${prop.z.toFixed(1)}`;
        if (!this.rubble.has(key)) {
          this.rubble.add(key);
          this.events.push({ kind: "break", key });
        }
        continue;
      }
      keep.push(prop);
    }
    this.map.props = keep;
  }

  private tickRevive(p: Pawn): void {
    const t = this.pawns.get(p.revivingId);
    if (!t || !t.downed || t.eliminated || dist2(p.body.x, p.body.z, t.body.x, t.body.z) > 2.3) {
      p.revivingId = "";
      p.reviveProg = 0;
      return;
    }
    p.reviveProg += TICK_DT / REVIVE_TIME;
    t.reviveProg = p.reviveProg;
    if (p.reviveProg >= 1) {
      t.downed = false;
      t.alive = true;
      t.health = 35;
      t.downedLeft = 0;
      t.reviveProg = 0;
      p.reviveProg = 0;
      p.revivingId = "";
      p.match.revives += 1;
      this.events.push({ kind: "revive", src: p.account.id, dst: t.account.id });
      if (p.match.revives >= 5) this.store.grantAchievement(p.account.id, "medic");
      this.events.push({ kind: "announce", text: `${t.account.name} REVIVED` });
    }
  }

  private tryLoot(p: Pawn): void {
    for (const pk of this.loot) {
      if (!pk.live) continue;
      if (dist2(p.body.x, p.body.z, pk.x, pk.z) > PICKUP_RADIUS) continue;
      pk.live = false;
      this.giveLoot(p, pk);
      this.events.push({ kind: "pickup", id: pk.id, playerId: p.account.id, itemId: pk.defId });
      break;
    }
  }

  private giveLoot(p: Pawn, pk: WorldLoot): void {
    const w = WEAPONS[pk.defId];
    const item = ITEMS[pk.defId];
    if (w) {
      const gun: Gun = { id: w.id, ammo: w.mag, reserves: Math.max(w.mag, pk.ammo) };
      if (w.slot === "primary") {
        if (p.primary) this.dropGun(p, p.primary);
        p.primary = gun;
        p.active = "primary";
      } else if (w.slot === "secondary") {
        this.dropGun(p, p.secondary);
        p.secondary = gun;
        p.active = "secondary";
      } else if (w.slot === "melee") {
        p.melee = { id: w.id, ammo: 0, reserves: 0 };
        p.active = "melee";
      }
      p.fireMode = w.fireModes.includes(p.fireMode) ? p.fireMode : w.mode;
      p.swapLock = w.swap;
      this.syncAmmo(p);
      telemetry.pick(w.id);
      return;
    }
    if (!item) return;
    if (item.kind === "armor" && item.armorLevel) {
      if (item.armorLevel >= p.armorLevel) {
        p.armorLevel = item.armorLevel;
        p.armorDura = item.armorDura ?? 50;
        p.armor = p.armorDura;
      }
      return;
    }
    if (item.kind === "medical") {
      if (!p.medical || p.medical.id === item.id) {
        p.medical = { id: item.id, qty: (p.medical?.qty ?? 0) + 1 };
      } else if (ITEMS[item.id].heal! > (ITEMS[p.medical.id].heal ?? 0)) {
        p.medical = { id: item.id, qty: 1 };
      }
      return;
    }
    if (item.nade) {
      p.grenades = Math.min(4, p.grenades + 1);
      p.nadeId = item.id;
      if (p.nadeBag.length < 4) p.nadeBag.push(item.id);
      return;
    }
    if (item.id === "armor_kit" && p.armorLevel > 0) {
      p.armorDura = Math.min(p.armorDura + (item.armorRepair ?? 40), 110);
      p.armor = p.armorDura;
      return;
    }
    if (item.id === "beacon") {
      this.dropPing(p, "objective");
      return;
    }
    if (item.id === "recon") {
      let best: Pawn | null = null;
      let bd = 40;
      for (const o of this.pawns.values()) {
        if (o.team === p.team || o.eliminated || o.dummy) continue;
        const d = dist2(p.body.x, p.body.z, o.body.x, o.body.z);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) this.events.push({ kind: "announce", text: `RECON: ${best.account.name}` });
      return;
    }
    if (item.kind === "utility") {
      p.utility = { id: item.id, qty: (p.utility?.qty ?? 0) + 1 };
      return;
    }
    if (item.kind === "ammo") {
      const add = item.id === "ammo_heavy" ? 12 : 18;
      if (p.primary) p.primary.reserves += add;
      else p.secondary.reserves += add;
      this.syncAmmo(p);
      return;
    }
    if (item.kind === "attachment" && !p.attachments.includes(item.id)) p.attachments.push(item.id);
  }

  private dropGun(p: Pawn, g: Gun): void {
    const w = weaponById(g.id);
    this.loot.push({
      id: "drop_" + p.account.id + "_" + this.tick,
      defId: g.id,
      kind: "weapon",
      rarity: w.rarityMin,
      label: w.name,
      x: p.body.x + 0.6,
      z: p.body.z,
      live: true,
      ammo: g.ammo,
    });
  }

  private useMedical(p: Pawn): void {
    if (!p.medical || p.healLeft > 0 || p.health >= MAX_HEALTH) return;
    const def = ITEMS[p.medical.id];
    p.healLeft = def?.useTime ?? 2;
  }

  private finishHeal(p: Pawn): void {
    if (!p.medical) {
      p.healLeft = 0;
      return;
    }
    const def = ITEMS[p.medical.id];
    const heal = def?.heal ?? 15;
    p.health = Math.min(MAX_HEALTH, p.health + heal);
    p.medical.qty -= 1;
    if (p.medical.qty <= 0) p.medical = null;
    p.healLeft = 0;
    this.events.push({ kind: "heal", id: p.account.id, amount: heal });
  }

  private useItem(p: Pawn, itemId: string): void {
    if (itemId === "bandage" || itemId === "medkit" || itemId === "repair_kit") {
      this.useMedical(p);
      return;
    }
    const def = ITEMS[itemId];
    if (!def) return;
    if (this.ranked) {
      this.useMedical(p);
      return;
    }
    if (!this.store.consumeItem(p.account.id, itemId, 1)) {
      p.wire.send({ type: MSG.ERROR, code: "rejected", message: "Item not in inventory" });
      return;
    }
    if (def.heal) p.health = Math.min(MAX_HEALTH, p.health + def.heal);
    this.pushEconomy(p);
  }

  private buy(p: Pawn, skuId: string): void {
    if (this.ranked) {
      p.wire.send({ type: MSG.ERROR, code: "rejected", message: "No buy phase — loot the yard" });
      return;
    }
    const sku = SKUS[skuId];
    if (!sku) return;
    const cur = this.store.ledger(p.account.id, -sku.costSoft, "buy:" + sku.id);
    if (!cur) {
      p.wire.send({ type: MSG.ERROR, code: "rejected", message: "Insufficient credits" });
      return;
    }
    const slots = this.store.addItem(p.account.id, sku.grants.itemId, sku.grants.qty);
    p.wire.send({ type: MSG.CURRENCY, currency: cur });
    p.wire.send({ type: MSG.INVENTORY, slots });
  }

  private dropPing(p: Pawn, kind: PingKind): void {
    const dist = 18;
    const x = p.body.x + Math.sin(p.body.yaw) * dist;
    const z = p.body.z + Math.cos(p.body.yaw) * dist;
    const ping: PingPublic = {
      id: "pg_" + p.account.id + "_" + this.tick,
      from: p.account.id,
      name: p.account.name,
      kind,
      x,
      y: 1.2,
      z,
      until: Date.now() + 6000,
    };
    this.pings = this.pings.filter((q) => q.from !== p.account.id).concat(ping);
    this.events.push({ kind: "ping", from: p.account.id, pingKind: kind, x, z });
  }

  private quickChat(p: Pawn, code: QuickCode): void {
    const text = {
      enemy: "ENEMY SPOTTED",
      ammo: "NEED AMMO",
      heal: "NEED HEALING",
      defend: "DEFEND HERE",
      move: "MOVE HERE",
      follow: "FOLLOW ME",
      retreat: "RETREAT",
      attack: "ATTACK HERE",
      thanks: "THANKS",
      nice: "NICE",
    }[code];
    for (const o of this.pawns.values()) {
      if (o.team !== p.team || o.bot) continue;
      o.wire.send({ type: MSG.CHAT, from: p.account.name, text, team: true });
    }
    this.events.push({ kind: "chat", from: p.account.id, team: p.team, text });
  }

  private kill(src: Pawn | null, dst: Pawn): void {
    dst.health = 0;
    dst.alive = false;
    dst.respawnIn = dst.dummy ? DUMMY_RESPAWN : PLAYER_RESPAWN;
    dst.match.deaths += 1;
    if (src) {
      src.match.kills += 1;
      this.events.push({ kind: "kill", src: src.account.id, dst: dst.account.id });
      if (!src.dummy) this.store.grantAchievement(src.account.id, "first_blood");
      if (!src.dummy) this.store.addMastery(src.account.id, this.gun(src).id, 8);
      if (src.team === "alpha") this.scoreA += 1;
      if (src.team === "bravo") this.scoreB += 1;
      src.bestDist = Math.max(src.bestDist, dist2(src.body.x, src.body.z, dst.body.x, dst.body.z));
    }
    this.creditAssists(src, dst);
  }

  private eliminate(src: Pawn | null, dst: Pawn): void {
    if (dst.eliminated) return;
    dst.eliminated = true;
    dst.downed = false;
    dst.alive = false;
    dst.health = 0;
    dst.match.deaths += 1;
    if (src) {
      src.match.kills += 1;
      telemetry.kill(this.gun(src).id);
      if (src.team === "alpha") this.scoreA += 1;
      if (src.team === "bravo") this.scoreB += 1;
      src.bestDist = Math.max(src.bestDist, dist2(src.body.x, src.body.z, dst.body.x, dst.body.z));
    }
    this.events.push({
      kind: "elim",
      src: src?.account.id ?? "zone",
      dst: dst.account.id,
      weapon: src ? weaponById(this.gun(src).id).name : "ZONE",
      dist: src ? Math.round(dist2(src.body.x, src.body.z, dst.body.x, dst.body.z)) : 0,
      dmg: 0,
    });
    this.creditAssists(src, dst);
    const remain = [...this.pawns.values()].filter((x) => x.team === dst.team && !x.eliminated && !x.dummy);
    if (remain.length === 0) this.events.push({ kind: "wipe", team: dst.team });
  }

  private creditAssists(src: Pawn | null, dst: Pawn): void {
    const now = this.tick * TICK_DT;
    for (const a of dst.assistsOn) {
      if (now - a.at > ASSIST_WINDOW) continue;
      if (src && a.id === src.account.id) continue;
      const helper = this.pawns.get(a.id);
      if (!helper) continue;
      helper.match.assists += 1;
      this.events.push({ kind: "assist", src: helper.account.id, dst: dst.account.id });
    }
    dst.assistsOn = [];
  }

  private respawn(p: Pawn): void {
    const spawn = this.spawnFor(p.team, Math.floor(Math.random() * 4));
    p.body = makeBody(spawn.x, spawn.z, spawn.yaw);
    p.health = MAX_HEALTH;
    p.alive = true;
    p.respawnIn = 0;
    this.events.push({ kind: "spawn", id: p.account.id, x: spawn.x, z: spawn.z });
  }

  private tickDummy(d: Pawn): void {
    const still = d.account.id === DUMMY_ID;
    const homeX = still ? 0 : 5;
    const homeZ = still ? -8 : -6;
    if (!d.alive) {
      d.respawnIn -= TICK_DT;
      if (d.respawnIn <= 0) {
        d.body = makeBody(homeX, homeZ, 0);
        d.health = MAX_HEALTH;
        d.alive = true;
      }
      return;
    }
    d.body.yaw += 0.35 * TICK_DT;
    if (still) {
      d.body.x = homeX;
      d.body.z = homeZ;
      return;
    }
    d.body.x = homeX + Math.sin(this.tick * 0.02) * 3.2;
    d.body.z = homeZ + Math.cos(this.tick * 0.017) * 1.4;
  }

  private makeDummy(): Pawn {
    const account = {
      id: DUMMY_ID,
      name: "RANGE DUMMY",
      token: "",
      xp: 0,
      mmr: 0,
      currency: { soft: 0, hard: 0 },
      slots: [],
      stats: { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, matches: 0, wins: 0, losses: 0 },
      friends: [],
      clanId: "",
      clanTag: "",
      character: "VANGUARD",
      lastMatchId: "",
      lastRegion: this.region,
      contact: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Account;
    const pawn = {
      account,
      wire: { send() {}, close() {} },
      body: makeBody(0, -6, 0),
      health: MAX_HEALTH,
      dummy: true,
      bot: true,
      team: "none" as TeamId,
      alive: true,
      downed: false,
      eliminated: false,
      primary: null,
      secondary: { id: "p9", ammo: 0, reserves: 0 },
      melee: { id: "knife", ammo: 0, reserves: 0 },
      active: "secondary" as const,
      match: { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, revives: 0 },
    } as unknown as Pawn;
    Object.assign(pawn, {
      armor: 0,
      lastSeq: 0,
      lastInputAt: Date.now(),
      fireCooldown: 0,
      pending: null,
      inputsThisSecond: 0,
      secondMark: Date.now(),
      friend: false,
      respawnIn: 0,
      ammo: 0,
      reserves: 0,
      reloadIn: 0,
      grenades: 0,
      nadeCd: 0,
      ping: 0,
      hist: [],
      assistsOn: [],
      lastAimErr: 1,
      aimHits: 0,
      wallTries: 0,
      disconnected: false,
      reservedUntil: 0,
      spectator: false,
      downedLeft: 0,
      reviveProg: 0,
      revivingId: "",
      armorLevel: 0,
      armorDura: 0,
      medical: null,
      utility: null,
      healLeft: 0,
      speaking: false,
      attachments: [],
      ads: false,
      fireMode: "single",
      burstLeft: 0,
      chamber: true,
      swapLock: 0,
      flashUntil: 0,
      nadeId: "frag",
      nadeBag: [],
      shotIndex: 0,
      prevButtons: 0,
      recoilP: 0,
      recoilY: 0,
      appearance: defaultAppearance(),
      emote: "",
      emoteLeft: 0,
      stepT: 0,
      travel: 0,
      activeSec: 0,
      bestDist: 0,
    });
    this.pawns.set(account.id, pawn);
    this.phase = "live";
    this.matchPhase = "combat";
    return pawn;
  }

  private checkEnd(): void {
    if (this.ended) return;
    if (this.ranked && this.rules.battleRoyale) {
      const a = this.teamLive("alpha");
      const b = this.teamLive("bravo");
      if (a === 0 && b === 0) {
        this.endReason = "wipe";
        this.finish(this.scoreA >= this.scoreB ? "alpha" : "bravo");
        return;
      }
      if (a === 0) {
        this.endReason = "wipe";
        this.finish("bravo");
        return;
      }
      if (b === 0) {
        this.endReason = "wipe";
        this.finish("alpha");
        return;
      }
      if (this.timeLeft <= 0) {
        this.endReason = "time";
        this.finish(a === b ? (this.scoreA >= this.scoreB ? "alpha" : "bravo") : a > b ? "alpha" : "bravo");
      }
      return;
    }
    if (!this.ranked) return;
    if (this.rules.timeLimitSec && this.timeLeft <= 0) this.finish(this.scoreA >= this.scoreB ? "alpha" : "bravo");
  }

  private teamLive(team: TeamId): number {
    return [...this.pawns.values()].filter((p) => p.team === team && !p.eliminated && !p.dummy).length;
  }

  private finish(winner: TeamId): void {
    this.ended = true;
    this.phase = "ended";
    this.matchPhase = "ended";
    const durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    const cards: CombatCard[] = [...this.pawns.values()]
      .filter((p) => !p.dummy)
      .map((p) => ({
        id: p.account.id,
        name: p.account.name,
        team: p.team,
        bot: p.bot,
        kills: p.match.kills,
        deaths: p.match.deaths,
        assists: p.match.assists,
        damage: Math.round(p.match.damage),
        accuracy: p.match.shots ? Math.round((p.match.hits / p.match.shots) * 100) : 0,
        mvp: false,
        revives: p.match.revives,
        survival: durationSec,
      }));
    cards.sort((a, b) => scoreCard(b) - scoreCard(a));
    if (cards[0]) cards[0].mvp = true;
    const mvp = cards[0];
    let saved = false;
    const foesOf = (team: TeamId) =>
      [...this.pawns.values()]
        .filter((o) => o.team !== team && !o.dummy)
        .map((o) => o.account.id)
        .sort()
        .join(",");
    const oppOf = (team: TeamId) => {
      const foes = [...this.pawns.values()].filter((o) => o.team !== team && !o.dummy && !o.account.contact);
      if (!foes.length) return { rating: 1200, rd: 90 };
      return {
        rating: foes.reduce((n, o) => n + o.account.mmr, 0) / foes.length,
        rd: foes.reduce((n, o) => n + (o.account.career?.rd ?? 90), 0) / foes.length,
      };
    };
    for (const p of this.pawns.values()) {
      if (p.dummy || p.account.contact) continue;
      const card = cards.find((c) => c.id === p.account.id);
      if (!card) continue;
      const won = winner !== "none" && p.team === winner;
      const afk = p.travel < 12 && p.match.shots < 4 && p.match.damage < 25 && p.activeSec < 8;
      const botHeavy = [...this.pawns.values()].filter((o) => o.team !== p.team && o.bot && !o.dummy).length >= 3;
      if (afk) this.flags.note(p.account.id, p.account.name, "afk", "zero activity match", 2);
      if (card.accuracy >= 88 && p.match.shots >= 40) {
        this.flags.note(p.account.id, p.account.name, "aim", `acc ${card.accuracy} shots ${p.match.shots}`, 2);
      }
      const opp = oppOf(p.team);
      let xp = 0;
      let soft = 0;
      let mmrDelta = 0;
      let placing = false;
      let chal: string[] = [];
      let title = "";
      if (this.rules.persistAtEnd) {
        const out = this.store.commitMatch({
          id: p.account.id,
          card: {
            kills: card.kills,
            deaths: card.deaths,
            assists: card.assists,
            damage: card.damage,
            shots: p.match.shots,
            hits: p.match.hits,
            revives: card.revives,
            mvp: card.mvp,
            survival: card.survival,
            accuracy: card.accuracy,
          },
          won,
          afk,
          botHeavy,
          competitive: this.mode === "ranked",
          mapId: this.mapId,
          durationSec,
          bestDist: p.bestDist,
          foes: foesOf(p.team),
          oppRating: opp.rating,
          oppRd: opp.rd,
        });
        xp = out.xp;
        soft = out.soft;
        mmrDelta = out.mmrDelta;
        placing = out.placing;
        chal = out.challenges;
        title = out.title;
        const accTrade = this.store.byId(p.account.id);
        if (accTrade && accTrade.career.tradeHeat >= 3) {
          this.flags.note(p.account.id, p.account.name, "trade", "repeat lobby", 3);
        }
      }
      if (won) this.store.grantAchievement(p.account.id, "survivor");
      const accn = this.store.byId(p.account.id);
      if (accn && accn.stats.matches >= 10) this.store.grantAchievement(p.account.id, "yard_walker");
      if (card.accuracy >= 40 && p.match.shots >= 40) this.store.grantAchievement(p.account.id, "sharp");
      if (xpToLevel(accn?.xp ?? 0) >= 8) this.store.grantAchievement(p.account.id, "pathfinder");
      if (card.mvp) this.store.grantAchievement(p.account.id, "first_mvp");
      if (p.bestDist >= 40) this.store.grantAchievement(p.account.id, "longshot");
      if (card.kills >= 3) this.store.grantAchievement(p.account.id, "triple");
      if ((accn?.career.streaks.win ?? 0) >= 3) this.store.grantAchievement(p.account.id, "streak3");
      if ((accn?.mmr ?? 0) >= 1200) this.store.grantAchievement(p.account.id, "gold_mark");
      if ((accn?.mmr ?? 0) >= 2200) this.store.grantAchievement(p.account.id, "helix_mark");
      const result: MatchResult = {
        matchId: this.id,
        winner,
        durationSec,
        scoreA: this.scoreA,
        scoreB: this.scoreB,
        mvpId: mvp?.id ?? "",
        mvpName: mvp?.name ?? "",
        cards,
        rewards: { xp, soft, mmrDelta, placing, afk, challenges: chal, title },
        mapName: this.mapName,
        matchNumber: this.matchNumber,
        reason: this.endReason,
        weather: this.weather,
      };
      p.wire.send({ type: MSG.MATCH_END, result });
      const acc = this.store.byId(p.account.id);
      if (acc) {
        p.wire.send({ type: MSG.PROFILE, profile: this.store.profileOf(acc) });
        p.wire.send({ type: MSG.CURRENCY, currency: { ...acc.currency } });
      }
      if (!saved) {
        this.store.saveMatch(result);
        audit.write({
          kind: "match_end",
          actor: "room",
          matchId: this.id,
          detail: `winner=${winner} reason=${this.endReason} n=${cards.length}`,
        });
        saved = true;
        const humans = [...this.pawns.values()].filter((x) => !x.dummy && !x.account.contact && !x.bot);
        this.onSocialEnd?.({
          matchId: this.id,
          winner,
          ids: humans.map((x) => x.account.id),
          cards: cards.map((c) => ({ id: c.id, name: c.name, team: c.team })),
        });
      }
    }
    setTimeout(() => {
      this.stop();
      this.onEmpty(this);
    }, 10000).unref?.();
  }

  private spawnFor(team: TeamId, index: number): { x: number; z: number; yaw: number } {
    if (this.ranked && (team === "alpha" || team === "bravo")) {
      return this.deploy[team][index % 4];
    }
    if (team === "alpha") return TEAM_SPAWNS.alpha[index % 4];
    if (team === "bravo") return TEAM_SPAWNS.bravo[index % 4];
    return TRAINING_RANGE.spawns[index % TRAINING_RANGE.spawns.length];
  }

  private teamCount(team: TeamId): number {
    return [...this.pawns.values()].filter((p) => p.team === team).length;
  }

  private rewindTicks(ping: number): number {
    const ms = Math.min(LAG_COMP_MAX_MS, Math.max(0, ping * 0.5));
    return Math.round(ms / (1000 / TICK_HZ));
  }

  private rewound(p: Pawn, ticks: number): { x: number; y: number; z: number } {
    if (ticks <= 0 || p.hist.length === 0) return { x: p.body.x, y: p.body.y, z: p.body.z };
    const h = p.hist[Math.max(0, p.hist.length - 1 - ticks)];
    return { x: h.x, y: h.y, z: h.z };
  }

  private botViews(self: Pawn) {
    return [...this.pawns.values()]
      .filter((p) => p !== self)
      .map((p) => ({
        id: p.account.id,
        x: p.body.x,
        y: p.body.y,
        z: p.body.z,
        yaw: p.body.yaw,
        pitch: p.body.pitch,
        team: p.team,
        alive:
          (p.alive || p.downed) &&
          !p.eliminated &&
          !this.smokeBlocks(self.body.x, self.body.z, p.body.x, p.body.z),
        ammo: p.ammo,
        reloading: p.reloadIn > 0,
        downed: p.downed,
      }));
  }

  private pushEconomy(p: Pawn): void {
    const fresh = this.store.byId(p.account.id);
    if (!fresh) return;
    p.account = fresh;
    p.wire.send({ type: MSG.INVENTORY, slots: fresh.slots.map((s) => ({ ...s })) });
    p.wire.send({ type: MSG.CURRENCY, currency: { ...fresh.currency } });
    p.wire.send({ type: MSG.PROFILE, profile: this.store.profileOf(fresh) });
  }

  private maybeEmpty(): void {
    const humans = [...this.pawns.values()].filter((p) => !p.bot && !p.dummy && !p.disconnected);
    if (humans.length === 0 && !this.ranked) {
      this.stop();
      this.onEmpty(this);
    }
  }

  private loadoutOf(p: Pawn): LoadoutPublic {
    return {
      primary: p.primary?.id ?? null,
      secondary: p.secondary.id,
      melee: p.melee.id,
      grenade: p.grenades > 0 ? { id: p.nadeId || "frag", qty: p.grenades } : null,
      medical: p.medical,
      utility: p.utility,
      active: p.active,
    };
  }

  private zonePublic(): ZonePublic {
    const def = this.zones[this.zoneI];
    return {
      cx: this.zoneCx,
      cz: this.zoneCz,
      radius: this.zoneR,
      nextCx: this.nextCx,
      nextCz: this.nextCz,
      nextRadius: this.nextR,
      phase: this.zoneI,
      phaseName: def?.name ?? "ZONE",
      waitLeft: this.shrinking ? 0 : Math.max(0, (def?.wait ?? 0) - this.zoneT),
      shrinking: this.shrinking,
      dps: def?.dps ?? 0,
    };
  }

  private broadcast(): void {
    const all = [...this.pawns.values()];
    const pickups = this.loot.filter((l) => l.live).map((l) => ({
      id: l.id,
      kind: l.defId,
      x: l.x,
      z: l.z,
      live: true,
      rarity: l.rarity,
      label: l.label,
    }));
    for (const p of all) {
      if (p.dummy || p.bot || p.disconnected) continue;
      const snap: Snapshot = {
        tick: this.tick,
        ack: p.lastSeq,
        t: Date.now(),
        you: this.pub(p),
        others: all.filter((o) => o !== p).map((o) => this.pub(o)),
        pickups,
        scoreA: this.scoreA,
        scoreB: this.scoreB,
        timeLeft: this.timeLeft,
        phase: this.phase,
        matchPhase: this.matchPhase,
        zone: this.ranked ? this.zonePublic() : null,
        pings: this.pings.filter((g) => {
          const src = this.pawns.get(g.from);
          return src && src.team === p.team;
        }),
        loadout: this.loadoutOf(p),
        mapName: this.mapName,
        mapId: this.mapId,
        weather: this.weather,
        matchNumber: this.matchNumber,
        downedLeft: p.downedLeft,
        reviveProg: p.reviveProg,
        smokes: this.clouds.filter((c) => c.kind === "smoke").map((c) => ({ x: c.x, z: c.z, r: c.r })),
        doors: (this.map.doors || []).map((d) => ({ id: d.id, open: Boolean(this.doorOpen[d.id]) })),
        broken: [...this.broken],
        rubble: [...this.rubble],
      };
      p.wire.send({ type: MSG.SNAPSHOT, snap });
      if (this.events.length) p.wire.send({ type: MSG.EVENT, tick: this.tick, events: this.events });
    }
  }

  private pub(p: Pawn): PlayerPublic {
    const w = weaponById(this.gun(p).id);
    return {
      id: p.account.id,
      name: p.account.name,
      x: p.body.x,
      y: p.body.y,
      z: p.body.z,
      yaw: p.body.yaw,
      pitch: p.body.pitch,
      vx: p.body.vx,
      vz: p.body.vz,
      health: p.health,
      armor: p.armor,
      alive: p.alive && !p.eliminated,
      dummy: p.dummy,
      bot: p.bot,
      team: p.team,
      ammo: p.ammo,
      ammoMax: w.mag || 0,
      reserves: p.reserves,
      reloading: p.reloadIn > 0,
      grenades: p.grenades,
      character: p.account.character,
      ping: p.ping,
      level: xpToLevel(p.account.xp),
      rank: rankName(p.account.mmr),
      downed: p.downed,
      eliminated: p.eliminated,
      armorLevel: p.armorLevel,
      armorDura: p.armorDura,
      weaponId: w.id,
      weaponName: w.name,
      slot: p.active,
      reviving: Boolean(p.revivingId),
      speaking: p.speaking,
      ads: p.ads,
      fireMode: p.fireMode,
      flash: p.flashUntil,
      opticFov: weaponById(this.gun(p).id).adsFov * modsFrom(p.attachments).fov,
      stance: p.body.stance || "stand",
      loco: p.body.loco || "idle",
      bodyType: operatorById(p.account.character).body,
      appearance: p.appearance || defaultAppearance(),
      emote: p.emote || "",
    };
  }


  private attachMind(p: Pawn): void {
    const humans = [...this.pawns.values()].filter((x) => !x.bot && !x.dummy);
    const live = humans.length ? Math.min(...humans.map((h) => h.account.stats.matches)) : this.protectMatches;
    const matches = Math.min(this.protectMatches, live);
    let seed = 0;
    for (const ch of p.account.id) seed = (seed * 33 + ch.charCodeAt(0)) | 0;
    const mind = mintMind(seed || this.seed, this.pawns.size, p.account.mmr, matches, this.mode);
    bindBrain(p.account.id, mind, seed || this.seed);
    if (p.account.contact) p.account.character = mind.operator;
  }

  private botWorld(p: Pawn): BotWorld {
    const delta = p.team === "bravo" ? this.scoreB - this.scoreA : this.scoreA - this.scoreB;
    return {
      map: this.map,
      weather: this.weather,
      tickTime: this.tick * TICK_DT,
      sounds: this.cues,
      cover: this.map.props.map((c) => ({ x: c.x, z: c.z })),
      scoreDelta: delta,
      shrinking: this.shrinking,
    };
  }

  private collectCues(): void {
    const now = this.tick * TICK_DT;
    this.cues = this.cues.filter((c) => now - c.t < 0.55);
    for (const e of this.events) {
      if (e.kind === "step") {
        const src = this.pawns.get(e.id);
        if (src) this.cues.push({ x: src.body.x, z: src.body.z, t: now, kind: "step", loud: e.loud });
      } else if (e.kind === "nade") {
        this.cues.push({ x: e.x, z: e.z, t: now, kind: "nade" });
      } else if (e.kind === "hit") {
        this.cues.push({ x: e.x, z: e.z, t: now, kind: "shot" });
      }
    }
  }

  private makeTrainers(): void {
    this.makeDummy();
    const still = this.pawns.get(DUMMY_ID);
    if (still) still.body = makeBody(0, -8, 0);
    const strafeAcc = {
      id: DUMMY_STRAFE_ID,
      name: "STRAFE DUMMY",
      token: "",
      xp: 0,
      mmr: 0,
      currency: { soft: 0, hard: 0 },
      slots: [],
      stats: { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, matches: 0, wins: 0, losses: 0 },
      friends: [],
      clanId: "",
      clanTag: "",
      character: "SPECTRE",
      lastMatchId: "",
      lastRegion: this.region,
      contact: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Account;
    const clone = { ...still } as Pawn;
    const pawn = Object.assign({}, still, {
      account: strafeAcc,
      body: makeBody(5, -6, 0),
      dummy: true,
      bot: true,
    }) as Pawn;
    void clone;
    this.pawns.set(DUMMY_STRAFE_ID, pawn);
  }

  private playEmote(p: Pawn, emote: EmoteId): void {
    if (!p.alive || p.downed || p.eliminated || p.body.slide > 0) return;
    p.emote = emote;
    p.emoteLeft = 2.2;
    this.events.push({ kind: "emote", id: p.account.id, emote });
  }

  private applyCosmetic(p: Pawn, appearance: Appearance, character: string): void {
    const next = this.store.setAppearance(p.account.id, appearance, character);
    if (!next) return;
    p.appearance = next;
    if (character) p.account.character = character;
    this.pushEconomy(p);
  }
}

function clampUnit(v: number): number {
  if (v < -1) return -1;
  if (v > 1) return 1;
  return v;
}

function scoreCard(c: CombatCard): number {
  return c.kills * 100 + c.assists * 40 + c.revives * 70 + c.damage * 0.2 + c.accuracy * 0.4;
}

function rayHitCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
): number | null {
  const ex = ox - cx;
  const ez = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (ex * dx + ez * dz);
  const c = ex * ex + ez * ez - radius * radius;
  let t = 0;
  if (a < 1e-8) {
    if (c > 0) return null;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t0 = (-b - s) / (2 * a);
    const t1 = (-b + s) / (2 * a);
    t = t0 >= 0 ? t0 : t1;
    if (t < 0) return null;
  }
  const y = oy + dy * t;
  if (y < cy - 0.05 || y > cy + height) return null;
  return t;
}
