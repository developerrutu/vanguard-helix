import * as THREE from "three";
import {
  BTN,
  TICK_DT,
  applyInput,
  copyBody,
  defaultAppearance,
  liveMap,
  makeBody,
  syncBlockers,
  TRAINING_RANGE,
  worldById,
  hitscanBlocked,
  operatorById,
  weaponById,
  type Body,
  type GameEvent,
  type InputPayload,
  type MapData,
  type PlayerPublic,
  type Snapshot,
} from "@shared";
import { InputManager } from "../input/input";
import { NetClient } from "../net/net";
import { GameRenderer } from "../render/renderer";
import { AudioEngine } from "../audio/audio";
import { UI } from "../ui/ui";

interface Pending {
  input: InputPayload;
  body: Body;
}

export class ClientGame {
  running = false;
  lastYou: PlayerPublic | null = null;
  private lastSnap: Snapshot | null = null;
  private predicted = makeBody(0, 14, Math.PI);
  private pending: Pending[] = [];
  private acc = 0;
  private last = 0;
  private fps = 60;
  private frames = 0;
  private fpsMark = 0;
  private lastHp = 100;
  fpsCap = 0;
  private lastUse = 0;
  private lastInteract = 0;
  private lastFireSnd = 0;
  private map: MapData = TRAINING_RANGE;
  showBoard = false;

  constructor(
    private net: NetClient,
    private input: InputManager,
    private render: GameRenderer,
    private audio: AudioEngine,
    private ui: UI,
  ) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    this.input.enabled = true;
    this.input.reset();
    this.loop(this.last);
  }

  stop(): void {
    this.running = false;
    this.input.enabled = false;
    this.input.reset();
    document.exitPointerLock?.();
  }

  onSnapshot(snap: Snapshot): void {
    const prevYou = this.lastYou;
    const prevSnap = this.lastSnap;
    this.lastYou = snap.you;
    this.lastSnap = snap;
    if (prevYou && prevYou.ads !== snap.you.ads) this.audio.ads(Boolean(snap.you.ads));
    if (prevYou && prevYou.weaponId !== snap.you.weaponId) this.audio.swap();
    if (prevSnap) {
      for (const o of snap.others) {
        const was = prevSnap.others.find((p) => p.id === o.id);
        if (!was || !o.alive || o.ammo >= was.ammo) continue;
        const dist = Math.hypot(o.x - snap.you.x, o.z - snap.you.z);
        this.audio.fire(o.weaponId, weaponById(o.weaponId).class, o.x, o.y, o.z, dist, false, this.occ(o.x, o.z));
      }
    }
    this.render.setLocal(snap.you.id);
    if (snap.mapId && snap.mapId !== "range") {
      this.map = liveMap(worldById(snap.mapId));
      const open: Record<string, boolean> = {};
      for (const d of snap.doors || []) open[d.id] = d.open;
      syncBlockers(this.map, open, snap.broken || []);
      if (snap.rubble?.length) {
        this.map.props = this.map.props.filter((p) => !snap.rubble.includes(`${p.x.toFixed(1)}_${p.z.toFixed(1)}`));
      }
    } else {
      this.map = TRAINING_RANGE;
    }
    this.render.useWorld(snap.mapId || "range", snap.weather || "clear", snap.doors, snap.broken, snap.rubble);
    this.audio.ambience(snap.mapId || "range", snap.weather || "");
    this.audio.listener(snap.you.x, snap.you.y, snap.you.z, snap.you.yaw);
    this.mixMusic(snap);
    this.render.syncPlayers(snap.you, snap.others);
    this.render.syncPickups(snap.pickups);
    this.render.syncZone(snap.zone);
    this.render.setAds(snap.you.ads ? snap.you.opticFov || 0.72 : 1);
    this.render.syncSmokes(snap.smokes || []);
    this.ui.setFlash(snap.you.flash || 0);
    this.reconcile(snap);
    this.ui.setVitals(snap.you.health, snap.you.armor);
    this.ui.setPos(snap.you.x, snap.you.z);
    this.ui.setCombatHud(snap);
    this.ui.setScoreboard(snap, this.showBoard);
    this.input.ads = Boolean(snap.you.ads);
    if (snap.you.health < this.lastHp) {
      this.ui.flashHurt();
      this.audio.pain();
      this.audio.callout("hurt", operatorById(snap.you.character).voice);
      this.render.impulse(0.18);
    }
    this.lastHp = snap.you.health;
  }

  onEvents(events: GameEvent[]): void {
    for (const e of events) {
      if (e.kind === "hit") {
        this.ui.flashHit();
        this.audio.beep("hit");
        this.audio.impact(this.surfAt(e.x, e.z), e.x, e.y, e.z, this.occ(e.x, e.z));
        this.render.impulse(0.08);
        if (this.lastYou) {
          const from = new THREE.Vector3(this.lastYou.x, this.lastYou.y + 1.35, this.lastYou.z);
          this.render.tracer(from, new THREE.Vector3(e.x, e.y, e.z), "#3dffc0");
        }
      } else if (e.kind === "kill") {
        this.audio.beep("kill");
        this.ui.feed("ELIMINATION");
        this.ui.say("TARGET DOWN");
      } else if (e.kind === "nade") {
        this.audio.nade(e.x, e.y, e.z, "blast");
        this.render.impulse(0.22);
      } else if (e.kind === "reload") {
        this.audio.reload("in");
        this.audio.callout("reload", this.pitchOf(e.id));
        this.ui.say("RELOADING");
      } else if (e.kind === "pickup") {
        this.audio.beep("pickup");
        this.ui.say("ACQUIRED " + e.itemId.replace("_", " ").toUpperCase());
      } else if (e.kind === "heal") {
        this.audio.heal();
        this.ui.say("INTEGRITY RESTORED");
      } else if (e.kind === "announce") {
        this.ui.say(e.text.toUpperCase());
      } else if (e.kind === "elim") {
        const killer = this.nameOf(e.src);
        const victim = this.nameOf(e.dst);
        this.ui.killCard(`${e.weapon}  ·  ${e.dist}m`);
        this.ui.feed(`${killer}  [${e.weapon}]  ${victim}`);
      } else if (e.kind === "down") {
        this.audio.pain();
        this.ui.say("OPERATOR DOWN");
      } else if (e.kind === "revive") {
        this.audio.revive();
        this.ui.say("REVIVED");
      } else if (e.kind === "wipe") {
        this.ui.say("TEAM WIPED");
      } else if (e.kind === "step") {
        const p = this.posOf(e.id);
        this.audio.step(e.surface || "concrete", e.loud, p.x, p.z, this.occ(p.x, p.z));
      } else if (e.kind === "emote") {
        this.audio.callout("greet", this.pitchOf(e.id));
        this.ui.say("SIGNAL");
      } else if (e.kind === "fall") {
        this.audio.land(e.dmg > 20);
        this.ui.say("HARD LANDING");
      } else if (e.kind === "door") {
        this.audio.beep("ui");
        this.ui.say(e.open ? "DOOR OPEN" : "DOOR SEALED");
      } else if (e.kind === "glass") {
        this.audio.impact("glass", this.lastYou?.x || 0, 1, this.lastYou?.z || 0);
      } else if (e.kind === "break") {
        this.audio.impact("wood", this.lastYou?.x || 0, 1, this.lastYou?.z || 0);
      } else if (e.kind === "ping") {
        this.audio.callout("spotted", this.pitchOf(e.from));
      } else if (e.kind === "chat" && e.text.toLowerCase().includes("reload")) {
        this.audio.callout("reload");
      }
    }
  }

  useMap(mapId: string): void {
    this.map = mapId && mapId !== "range" ? liveMap(worldById(mapId)) : TRAINING_RANGE;
  }

  private reconcile(snap: Snapshot): void {
    this.pending = this.pending.filter((p) => p.input.seq > snap.ack);
    const err = Math.hypot(this.predicted.x - snap.you.x, this.predicted.z - snap.you.z);
    if (err < 0.55) {
      this.predicted.vx = snap.you.vx;
      this.predicted.vz = snap.you.vz;
      this.predicted.y = snap.you.y;
      this.predicted.stance = snap.you.stance || this.predicted.stance;
      this.predicted.loco = snap.you.loco || this.predicted.loco;
      return;
    }
    this.predicted.x = snap.you.x;
    this.predicted.y = snap.you.y;
    this.predicted.z = snap.you.z;
    this.predicted.vx = snap.you.vx;
    this.predicted.vz = snap.you.vz;
    this.predicted.yaw = snap.you.yaw;
    this.predicted.pitch = snap.you.pitch;
    this.predicted.grounded = snap.you.loco !== "jump" && snap.you.loco !== "fall" && snap.you.loco !== "swim";
    this.predicted.stance = snap.you.stance || "stand";
    this.predicted.loco = snap.you.loco || "idle";
    for (const p of this.pending) {
      applyInput(this.predicted, p.input, this.map);
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const cap = this.fpsCap;
    if (cap > 0) {
      const min = 1000 / cap;
      if (now - this.last < min - 0.5) {
        requestAnimationFrame(this.loop);
        return;
      }
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    this.frames++;
    if (now - this.fpsMark > 400) {
      this.fps = (this.frames * 1000) / (now - this.fpsMark);
      this.frames = 0;
      this.fpsMark = now;
    }

    while (this.acc >= TICK_DT) {
      const frame = this.input.sample(TICK_DT);
      if (frame.buttons & BTN.USE && now - this.lastUse > 250) {
        this.lastUse = now;
        this.net.useItem("repair_kit");
      }
      if (frame.buttons & BTN.INTERACT && now - this.lastInteract > 250) {
        this.lastInteract = now;
      }
      if (frame.buttons & BTN.FIRE && now - this.lastFireSnd > 90) {
        this.lastFireSnd = now;
        const you = this.lastYou;
        const id = you?.weaponId || "stitch";
        if (you && you.ammo <= 0) this.audio.dry();
        else this.audio.fire(id, weaponById(id).class, you?.x || 0, you?.y || 0, you?.z || 0, 0, false, false);
        this.render.impulse(you?.ads ? 0.02 : 0.035);
      }
      applyInput(this.predicted, frame, this.map);
      this.pending.push({ input: frame, body: copyBody(this.predicted) });
      if (this.pending.length > 64) this.pending.shift();
      this.net.sendInput(frame);
      this.acc -= TICK_DT;
    }

    const you: PlayerPublic = this.lastYou
      ? {
          ...this.lastYou,
          x: this.predicted.x,
          y: this.predicted.y,
          z: this.predicted.z,
          yaw: this.predicted.yaw,
          pitch: this.predicted.pitch,
          vx: this.predicted.vx,
          vz: this.predicted.vz,
        }
      : {
          id: this.net.playerId || "local",
          name: "YOU",
          x: this.predicted.x,
          y: this.predicted.y,
          z: this.predicted.z,
          yaw: this.predicted.yaw,
          pitch: this.predicted.pitch,
          vx: this.predicted.vx,
          vz: this.predicted.vz,
          health: 100,
          armor: 0,
          alive: true,
          dummy: false,
          bot: false,
          team: "none",
          ammo: 24,
          ammoMax: 24,
          reserves: 72,
          reloading: false,
          grenades: 2,
          character: "VANGUARD",
          ping: 0,
          level: 1,
          rank: "BRONZE",
          downed: false,
          eliminated: false,
          armorLevel: 0,
          armorDura: 0,
          weaponId: "p9",
          weaponName: "P9 Sidearm",
          slot: "secondary",
          reviving: false,
          speaking: false,
          ads: false,
          fireMode: "single",
          flash: 0,
          opticFov: 0.86,
          stance: this.predicted.stance,
          loco: this.predicted.loco,
          bodyType: "male",
          appearance: defaultAppearance(),
          emote: "",
        };

    this.render.render(you);
    requestAnimationFrame(this.loop);
  };

  private nameOf(id: string): string {
    if (this.lastYou?.id === id) return this.lastYou.name;
    return this.lastSnap?.others.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  }

  getFps(): number {
    return this.fps;
  }

  private mixMusic(snap: Snapshot): void {
    const phase = snap.matchPhase;
    if (phase === "loading") this.audio.setMusic("loading");
    else if (phase === "intro") this.audio.setMusic("intro");
    else if (phase === "final") this.audio.setMusic("final");
    else if (phase === "ended") return;
    else {
      const foes = snap.others.filter((o) => o.team !== snap.you.team && o.alive && !o.dummy);
      const near = foes.some((o) => Math.hypot(o.x - snap.you.x, o.z - snap.you.z) < 28);
      const shots = snap.you.reloading || snap.you.ads;
      this.audio.setMusic(near && shots ? "fight" : near ? "contact" : "explore");
    }
  }

  private posOf(id: string): { x: number; z: number } {
    if (this.lastYou?.id === id) return { x: this.lastYou.x, z: this.lastYou.z };
    const o = this.lastSnap?.others.find((p) => p.id === id);
    return { x: o?.x || 0, z: o?.z || 0 };
  }

  private occ(x: number, z: number): boolean {
    const y = this.lastYou;
    if (!y) return false;
    return hitscanBlocked(y.x, y.z, x, z, this.map, true);
  }

  private surfAt(x: number, z: number): "metal" | "concrete" | "wood" | "glass" | "dirt" | "sand" | "stone" | "water" {
    const s = this.map.surfaces?.find((p) => Math.abs(x - p.x) <= p.hx && Math.abs(z - p.z) <= p.hz);
    const k = s?.kind || "concrete";
    if (k === "metal" || k === "sand" || k === "dirt" || k === "water") return k;
    if (k === "snow") return "dirt";
    if (k === "grass") return "wood";
    return "concrete";
  }

  private pitchOf(id: string): number {
    const you = this.lastYou;
    const char = you?.id === id ? you.character : this.lastSnap?.others.find((p) => p.id === id)?.character;
    return operatorById(char || "VANGUARD").voice;
  }
}
