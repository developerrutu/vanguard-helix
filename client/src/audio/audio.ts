import {
  AUDIO_PRIORITY,
  CALLOUTS,
  t as i18n,
  weaponVoice,
  type CalloutId,
  type ImpactSurf,
  type MusicState,
  type Surface,
} from "@shared";

type Bus = "weapons" | "effects" | "environment" | "character" | "voice" | "ui" | "voiceChat" | "music";

interface Live {
  stop: () => void;
  pri: number;
  at: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private duck!: GainNode;
  private buses: Record<Bus, GainNode> = {} as Record<Bus, GainNode>;
  private noise: AudioBuffer | null = null;
  private listenerSet = false;
  private live: Live[] = [];
  private maxVoices = 18;
  private musicTimer: number | null = null;
  private ambTimer: number | null = null;
  private ambTheme = "";
  private musicState: MusicState = "silence";
  private musicNodes: OscillatorNode[] = [];
  private musicGains: GainNode[] = [];
  private ambOsc: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private wxSrc: AudioBufferSourceNode | null = null;
  private wxGain: GainNode | null = null;
  private lastCall = 0;
  private lastUi = 0;
  private lastFireAt = 0;
  private lastListenAt = 0;
  private mobile = false;
  private spatial = true;
  private mono = false;
  private charVoice = true;
  private onCaption: ((text: string) => void) | null = null;

  masterGain = 0.8;
  musicGain = 0.45;
  weaponGain = 0.9;
  sfxGain = 0.85;
  envGain = 0.55;
  charGain = 0.6;
  voiceGain = 0.8;
  uiGain = 0.7;
  chatGain = 0.85;

  onLine(fn: (text: string) => void): void {
    this.onCaption = fn;
  }

  setMobile(on: boolean): void {
    this.mobile = on;
    this.maxVoices = on ? 10 : 22;
  }

  setSpatial(on: boolean): void {
    this.spatial = on;
  }

  setMono(on: boolean): void {
    this.mono = on;
  }

  setCharVoice(on: boolean): void {
    this.charVoice = on;
  }

  async resume(): Promise<void> {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    this.apply();
    if (this.ok()) {
      if (this.musicState !== "silence" && this.musicNodes.length === 0) this.holdPad(this.musicState);
      if (this.ambTheme && !this.ambOsc) {
        const [mapId, weather = ""] = this.ambTheme.split(":");
        this.holdDrone(mapId || "range", weather);
      }
    }
  }

  silence(): void {
    this.setMusic("silence");
    this.killAmb();
    this.ambTheme = "";
  }

  apply(): void {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(v, t, 0.03);
      } catch {
        g.gain.value = v;
      }
    };
    set(this.master, this.masterGain);
    set(this.buses.music, this.musicGain);
    set(this.buses.weapons, this.weaponGain);
    set(this.buses.effects, this.sfxGain);
    set(this.buses.environment, this.envGain);
    set(this.buses.character, this.charGain);
    set(this.buses.voice, this.voiceGain);
    set(this.buses.ui, this.uiGain);
    set(this.buses.voiceChat, this.chatGain);
  }

  listener(x: number, y: number, z: number, yaw: number): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastListenAt < 50) return;
    this.lastListenAt = now;
    const l = this.ctx.listener;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const t = this.ctx.currentTime;
    try {
      l.positionX.setValueAtTime(x, t);
      l.positionY.setValueAtTime(y + 1.4, t);
      l.positionZ.setValueAtTime(z, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(0, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } catch {
      const old = l as AudioListener & { setPosition?: (a: number, b: number, c: number) => void; setOrientation?: (...n: number[]) => void };
      old.setPosition?.(x, y + 1.4, z);
      old.setOrientation?.(fx, 0, fz, 0, 1, 0);
    }
    this.listenerSet = true;
  }

  gun(kind: "smg" | "ar" | "shot" | "sniper" | "pistol" | "melee", id = kind): void {
    this.fire(id, kind, 0, 0, 0, 0, false, false);
  }

  fire(id: string, cls: string, x: number, y: number, z: number, dist: number, suppress: boolean, occluded: boolean): void {
    if (!this.ok()) return;
    const now = performance.now();
    if (now - this.lastFireAt < 70) return;
    this.lastFireAt = now;
    if (!this.take(AUDIO_PRIORITY.weapon)) return;
    const v = weaponVoice(id, cls);
    const t = this.ctx!.currentTime;
    const close = dist < 18;
    const far = dist > 42;
    const dest = this.route("weapons", x, y, z, occluded, far ? 0.55 : 1);
    const decay = v.decay * (far ? 1.8 : 1) * (suppress ? 0.7 : 1);
    const muzzle = this.osc(suppress ? "triangle" : "sawtooth", v.muzzle * (far ? 0.55 : 1), t, decay, v.grit * (close ? 0.08 : 0.04) * (suppress ? 0.45 : 1), dest);
    const body = this.osc("sine", v.body * (far ? 0.7 : 1), t, decay * 1.4, 0.05, dest);
    if (v.kind === "shot") this.burst(dest, t, 0.09, 0.07);
    if (v.kind === "sniper" && !suppress) this.osc("square", v.muzzle * 0.45, t + 0.02, 0.16, 0.03, dest);
    if (far || v.report > 0.4) this.osc("triangle", 62 + v.report * 20, t + 0.05, 0.22, 0.025 * v.report, dest);
    void muzzle;
    void body;
    if (v.kind === "melee") this.burst(dest, t, 0.04, 0.05);
  }

  dry(): void {
    if (!this.ok()) return;
    this.click(this.buses.weapons, 420, 0.04, 0.03);
  }

  reload(stage: "out" | "in" | "bolt" = "in"): void {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const f = stage === "out" ? 180 : stage === "bolt" ? 320 : 240;
    this.click(this.buses.weapons, f, 0.06, 0.035);
    if (stage === "in") this.click(this.buses.weapons, 140, 0.08, 0.02, t + 0.05);
  }

  ads(on: boolean): void {
    this.click(this.buses.ui, on ? 520 : 380, 0.04, 0.02);
  }

  swap(): void {
    this.click(this.buses.weapons, 210, 0.07, 0.03);
  }

  impact(surf: ImpactSurf, x: number, y: number, z: number, occluded = false): void {
    if (!this.ok() || !this.take(AUDIO_PRIORITY.weapon - 5)) return;
    const dest = this.route("effects", x, y, z, occluded, 0.9);
    const table: Record<ImpactSurf, number> = {
      metal: 420,
      concrete: 160,
      wood: 240,
      glass: 980,
      dirt: 90,
      sand: 70,
      stone: 140,
      water: 55,
    };
    this.osc(surf === "glass" || surf === "metal" ? "square" : "triangle", table[surf], this.ctx!.currentTime, 0.07, 0.04, dest);
    if (surf === "glass") this.osc("sine", 1600, this.ctx!.currentTime, 0.09, 0.02, dest);
  }

  nade(x: number, y: number, z: number, kind: "blast" | "fuse" = "blast"): void {
    if (!this.ok()) return;
    if (kind === "fuse") {
      this.click(this.buses.effects, 880, 0.04, 0.02);
      return;
    }
    if (!this.take(AUDIO_PRIORITY.explosion)) return;
    const dest = this.route("effects", x, y, z, false, 1);
    const t = this.ctx!.currentTime;
    this.burst(dest, t, 0.22, 0.11);
    this.osc("sine", 48, t, 0.35, 0.08, dest);
    this.osc("sawtooth", 90, t + 0.04, 0.18, 0.04, dest);
  }

  step(surface: Surface | string, loud: boolean, x = 0, z = 0, occluded = false): void {
    if (!this.ok() || !this.take(AUDIO_PRIORITY.footstep)) return;
    const dest = this.route("character", x, 0, z, occluded, loud ? 1 : 0.7);
    const table: Record<string, number> = {
      concrete: 140,
      metal: 220,
      dirt: 90,
      sand: 70,
      snow: 110,
      grass: 85,
      water: 60,
      wood: 190,
    };
    const t = this.ctx!.currentTime;
    this.osc(surface === "metal" ? "square" : "triangle", (table[surface] || 120) * (loud ? 1.12 : 0.85), t, 0.07, loud ? 0.04 : 0.022, dest);
  }

  land(heavy: boolean): void {
    if (!this.ok()) return;
    this.osc("sine", heavy ? 55 : 80, this.ctx!.currentTime, 0.12, heavy ? 0.06 : 0.03, this.buses.character);
  }

  jump(): void {
    this.osc("triangle", 180, this.ctx!.currentTime, 0.08, 0.025, this.buses.character);
  }

  pain(): void {
    if (!this.ok()) return;
    this.osc("sawtooth", 90, this.ctx!.currentTime, 0.14, 0.05, this.buses.character);
  }

  heal(): void {
    this.osc("sine", 520, this.ctx!.currentTime, 0.16, 0.03, this.buses.character);
  }

  revive(): void {
    this.osc("triangle", 330, this.ctx!.currentTime, 0.2, 0.035, this.buses.character);
  }

  callout(id: CalloutId, pitch = 1): void {
    const now = performance.now();
    if (now - this.lastCall < 900) return;
    this.lastCall = now;
    const line = i18n("vo_" + id, CALLOUTS[id]);
    this.onCaption?.(line);
    if (!this.charVoice || !this.ok()) return;
    this.duckTo(0.35, 0.35);
    const t = this.ctx!.currentTime;
    const dest = this.buses.voice;
    this.osc("sawtooth", 170 * pitch, t, 0.16, 0.03, dest);
    this.osc("triangle", 340 * pitch, t + 0.05, 0.14, 0.02, dest);
  }

  ambience(mapId: string, weather: string): void {
    const key = mapId + ":" + weather;
    if (this.ambTheme === key && this.ambOsc) return;
    this.ambTheme = key;
    if (!this.ok()) return;
    this.holdDrone(mapId, weather);
  }

  setMusic(state: MusicState): void {
    if (this.musicState === state && (state === "silence" || this.musicNodes.length > 0)) return;
    this.musicState = state;
    this.killMusic(state === "silence" ? 0.22 : 0.1);
    if (!this.ok() || state === "silence") return;
    this.holdPad(state);
  }

  menuTheme(on: boolean): void {
    this.setMusic(on ? "menu" : "silence");
  }

  beep(kind: "ui" | "fire" | "hit" | "kill" | "pickup" | "hurt" | "buy" | "found" | "error" | "ok" | "hover"): void {
    if (!this.ok()) return;
    const now = performance.now();
    if (kind === "hover" && now - this.lastUi < 40) return;
    if (kind === "ui" || kind === "hover") this.lastUi = now;
    if (kind === "fire") {
      this.gun("ar");
      return;
    }
    if (kind === "hit") {
      this.osc("square", 880, this.ctx!.currentTime, 0.05, 0.04, this.buses.effects);
      return;
    }
    if (kind === "hurt") {
      this.pain();
      return;
    }
    if (kind === "kill") {
      this.osc("sawtooth", 240, this.ctx!.currentTime, 0.16, 0.05, this.buses.effects);
      return;
    }
    const table: Record<string, { f: number; d: number; a: number }> = {
      ui: { f: 620, d: 0.05, a: 0.035 },
      hover: { f: 740, d: 0.03, a: 0.018 },
      pickup: { f: 520, d: 0.1, a: 0.04 },
      buy: { f: 440, d: 0.09, a: 0.03 },
      found: { f: 392, d: 0.22, a: 0.05 },
      error: { f: 160, d: 0.16, a: 0.05 },
      ok: { f: 523, d: 0.12, a: 0.04 },
    };
    const p = table[kind] || table.ui;
    this.osc("triangle", p.f, this.ctx!.currentTime, p.d, p.a, this.buses.ui);
    if (kind === "found") this.osc("sine", 523, this.ctx!.currentTime + 0.08, 0.16, 0.035, this.buses.ui);
  }

  private holdPad(state: MusicState): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.killMusic(0.04);
    const t = this.ctx.currentTime;
    const dest = this.buses.music;
    const chords: Record<MusicState, number[]> = {
      silence: [],
      menu: [110, 164.8, 220],
      loading: [98, 147],
      intro: [130.8, 196],
      explore: [98, 146.8],
      contact: [110, 164.8],
      fight: [82.4, 123.5, 164.8],
      final: [73.4, 110, 146.8],
      victory: [130.8, 196, 261.6],
      defeat: [87.3, 130.8],
      profile: [123.5, 196],
    };
    const notes = chords[state] || chords.menu;
    const tense = state === "fight" || state === "final";
    const peak = tense ? 0.02 : 0.016;
    for (let i = 0; i < notes.length; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = i === 0 && tense ? "triangle" : "sine";
      o.frequency.setValueAtTime(notes[i], t);
      f.type = "lowpass";
      f.frequency.setValueAtTime(tense ? 720 : 520, t);
      o.connect(f);
      f.connect(g);
      g.connect(dest);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.006, peak - i * 0.003), t + 0.35);
      o.start(t);
      this.musicNodes.push(o);
      this.musicGains.push(g);
    }
  }

  private killMusic(fade: number): void {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!this.ctx) {
      this.musicNodes = [];
      this.musicGains = [];
      return;
    }
    const t = this.ctx.currentTime;
    for (let i = 0; i < this.musicNodes.length; i++) {
      const g = this.musicGains[i];
      const o = this.musicNodes[i];
      try {
        const cur = Math.max(0.0001, g.gain.value);
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(cur, t);
        g.gain.linearRampToValueAtTime(0.0001, t + fade);
        o.stop(t + fade + 0.03);
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
    this.musicGains = [];
  }

  private holdDrone(mapId: string, weather: string): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.killAmb();
    const t = this.ctx.currentTime;
    const dest = this.buses.environment;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = "sine";
    o.frequency.setValueAtTime(mapId === "iron_city" ? 52 : mapId === "red_sands" ? 44 : mapId === "frost_haven" ? 48 : 56, t);
    f.type = "lowpass";
    f.frequency.value = 180;
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.6);
    o.start(t);
    this.ambOsc = o;
    this.ambGain = g;
    if ((weather === "rain" || weather === "blizzard" || weather === "snow") && this.noise) {
      const src = this.ctx.createBufferSource();
      const wg = this.ctx.createGain();
      const bp = this.ctx.createBiquadFilter();
      src.buffer = this.noise;
      src.loop = true;
      bp.type = "bandpass";
      bp.frequency.value = weather === "blizzard" ? 700 : 1100;
      src.connect(bp);
      bp.connect(wg);
      wg.connect(dest);
      wg.gain.setValueAtTime(0.0001, t);
      wg.gain.linearRampToValueAtTime(0.01, t + 0.8);
      src.start(t);
      this.wxSrc = src;
      this.wxGain = wg;
    }
  }

  private killAmb(): void {
    if (this.ambTimer) {
      window.clearInterval(this.ambTimer);
      this.ambTimer = null;
    }
    if (!this.ctx) {
      this.ambOsc = null;
      this.ambGain = null;
      this.wxSrc = null;
      this.wxGain = null;
      return;
    }
    const t = this.ctx.currentTime;
    try {
      if (this.ambGain && this.ambOsc) {
        const cur = Math.max(0.0001, this.ambGain.gain.value);
        this.ambGain.gain.cancelScheduledValues(t);
        this.ambGain.gain.setValueAtTime(cur, t);
        this.ambGain.gain.linearRampToValueAtTime(0.0001, t + 0.2);
        this.ambOsc.stop(t + 0.24);
      }
    } catch {
      /* already stopped */
    }
    try {
      if (this.wxGain && this.wxSrc) {
        this.wxGain.gain.cancelScheduledValues(t);
        this.wxGain.gain.setValueAtTime(Math.max(0.0001, this.wxGain.gain.value), t);
        this.wxGain.gain.linearRampToValueAtTime(0.0001, t + 0.2);
        this.wxSrc.stop(t + 0.24);
      }
    } catch {
      /* already stopped */
    }
    this.ambOsc = null;
    this.ambGain = null;
    this.wxSrc = null;
    this.wxGain = null;
  }

  private duckTo(mul: number, sec: number): void {
    if (!this.duck || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(this.duck.gain.value, t);
    this.duck.gain.linearRampToValueAtTime(mul, t + 0.06);
    this.duck.gain.linearRampToValueAtTime(1, t + sec);
  }

  private route(bus: Bus, x: number, y: number, z: number, occluded: boolean, gainMul: number): AudioNode {
    const g = this.ctx!.createGain();
    g.gain.value = gainMul;
    if (occluded) {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 620;
      g.connect(lp);
      lp.connect(this.place(bus, x, y, z));
      return g;
    }
    g.connect(this.place(bus, x, y, z));
    return g;
  }

  private place(bus: Bus, x: number, y: number, z: number): AudioNode {
    if (!this.spatial || this.mono || !this.listenerSet || (x === 0 && z === 0)) return this.buses[bus];
    const p = this.ctx!.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 4;
    p.maxDistance = 90;
    p.rolloffFactor = 0.85;
    try {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } catch {
      (p as PannerNode & { setPosition?: (a: number, b: number, c: number) => void }).setPosition?.(x, y, z);
    }
    p.connect(this.buses[bus]);
    return p;
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, amp: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.55), t + dur);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }

  private click(dest: AudioNode, freq: number, dur: number, amp: number, when?: number): void {
    if (!this.ctx) return;
    this.osc("square", freq, when ?? this.ctx.currentTime, dur, amp, dest);
  }

  private burst(dest: AudioNode, t: number, dur: number, amp: number): void {
    if (!this.noise || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    src.buffer = this.noise;
    f.type = "bandpass";
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private take(pri: number): boolean {
    const now = performance.now();
    this.live = this.live.filter((v) => now - v.at < 400);
    if (this.live.length < this.maxVoices) {
      this.live.push({ stop() {}, pri, at: now });
      return true;
    }
    let worst = 0;
    for (let i = 1; i < this.live.length; i++) if (this.live[i].pri < this.live[worst].pri) worst = i;
    if (this.live[worst].pri > pri) return false;
    this.live[worst] = { stop() {}, pri, at: now };
    return true;
  }

  private ok(): boolean {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  private build(): void {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 18;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.duck = this.ctx.createGain();
    this.duck.gain.value = 1;
    const names: Bus[] = ["weapons", "effects", "environment", "character", "voice", "ui", "voiceChat", "music"];
    for (const n of names) {
      this.buses[n] = this.ctx.createGain();
      if (n === "music") this.buses[n].connect(this.duck);
      else this.buses[n].connect(this.master);
    }
    this.duck.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.apply();
  }
}
