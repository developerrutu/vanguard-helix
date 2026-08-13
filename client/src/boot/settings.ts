import type { QualityId } from "./capabilities";
import type { LangId } from "@shared";

export type GfxPreset = QualityId | "auto" | "vlow" | "vhigh" | "custom";

export type InputAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "sprint"
  | "crouch"
  | "prone"
  | "fire"
  | "aim"
  | "reload"
  | "interact"
  | "use"
  | "grenade"
  | "ping"
  | "slot1"
  | "slot2"
  | "slot3"
  | "mode"
  | "nadeCycle"
  | "emote"
  | "voice";

export type TouchAct = "fire" | "aim" | "jump" | "sprint" | "crouch" | "prone" | "reload" | "interact" | "use" | "nade" | "swap" | "ping";

export interface TouchSlot {
  x: number;
  y: number;
  s: number;
  a: number;
}

export interface Settings {
  quality: GfxPreset;
  fpsCap: 0 | 30 | 60 | 90 | 120;
  resolutionScale: number;
  shadows: "off" | "cheap" | "mid" | "high" | "auto";
  effects: "low" | "med" | "high" | "auto";
  viewDistance: "auto" | "near" | "mid" | "far";
  aa: boolean;
  sensitivity: number;
  adsSens: number;
  scopeSens: number;
  invertY: boolean;
  gyro: boolean;
  gyroSens: number;
  showFps: boolean;
  preferFullscreen: boolean;
  master: number;
  music: number;
  sfx: number;
  voice: number;
  uiVol: number;
  weaponVol: number;
  envVol: number;
  charVol: number;
  chatVol: number;
  spatial: boolean;
  mono: boolean;
  charVoice: boolean;
  colorblind: "none" | "protan" | "deutan" | "tritan";
  leftHanded: boolean;
  uiScale: number;
  textScale: number;
  highContrast: boolean;
  reduceShake: boolean;
  reduceFlash: boolean;
  subtitles: boolean;
  autoSprint: boolean;
  autoPickup: boolean;
  hitMarkers: boolean;
  dmgNumbers: boolean;
  lang: LangId;
  touchPreset: "standard" | "advanced" | "left";
  touch: Partial<Record<TouchAct, TouchSlot>>;
  binds: Partial<Record<InputAction, string>>;
  stickSens: number;
  triggerSens: number;
  rumble: boolean;
}

export const DEFAULT_BINDS: Record<InputAction, string> = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  sprint: "ShiftLeft",
  crouch: "ControlLeft",
  prone: "KeyP",
  fire: "Mouse0",
  aim: "Mouse2",
  reload: "KeyR",
  interact: "KeyE",
  use: "KeyQ",
  grenade: "KeyG",
  ping: "KeyF",
  slot1: "Digit1",
  slot2: "Digit2",
  slot3: "Digit3",
  mode: "KeyT",
  nadeCycle: "KeyN",
  emote: "KeyH",
  voice: "KeyV",
};

export const TOUCH_PRESETS: Record<Settings["touchPreset"], Partial<Record<TouchAct, TouchSlot>>> = {
  standard: {
    fire: { x: 88, y: 78, s: 1, a: 0.92 },
    aim: { x: 76, y: 70, s: 0.85, a: 0.8 },
    jump: { x: 88, y: 58, s: 0.8, a: 0.8 },
    sprint: { x: 76, y: 54, s: 0.75, a: 0.75 },
    crouch: { x: 68, y: 78, s: 0.7, a: 0.75 },
    prone: { x: 60, y: 78, s: 0.7, a: 0.7 },
    reload: { x: 88, y: 42, s: 0.7, a: 0.75 },
    interact: { x: 76, y: 42, s: 0.7, a: 0.75 },
    use: { x: 68, y: 64, s: 0.7, a: 0.75 },
    nade: { x: 60, y: 64, s: 0.7, a: 0.75 },
    swap: { x: 88, y: 28, s: 0.65, a: 0.7 },
    ping: { x: 52, y: 70, s: 0.65, a: 0.7 },
  },
  advanced: {
    fire: { x: 90, y: 74, s: 1.1, a: 0.95 },
    aim: { x: 78, y: 62, s: 0.9, a: 0.85 },
    jump: { x: 90, y: 52, s: 0.75, a: 0.8 },
    sprint: { x: 80, y: 48, s: 0.7, a: 0.75 },
    crouch: { x: 70, y: 74, s: 0.65, a: 0.7 },
    prone: { x: 62, y: 74, s: 0.65, a: 0.7 },
    reload: { x: 90, y: 36, s: 0.65, a: 0.75 },
    interact: { x: 80, y: 36, s: 0.65, a: 0.75 },
    use: { x: 70, y: 58, s: 0.65, a: 0.75 },
    nade: { x: 62, y: 58, s: 0.65, a: 0.75 },
    swap: { x: 90, y: 22, s: 0.6, a: 0.7 },
    ping: { x: 54, y: 64, s: 0.6, a: 0.7 },
  },
  left: {
    fire: { x: 12, y: 78, s: 1, a: 0.92 },
    aim: { x: 24, y: 70, s: 0.85, a: 0.8 },
    jump: { x: 12, y: 58, s: 0.8, a: 0.8 },
    sprint: { x: 24, y: 54, s: 0.75, a: 0.75 },
    crouch: { x: 32, y: 78, s: 0.7, a: 0.75 },
    prone: { x: 40, y: 78, s: 0.7, a: 0.7 },
    reload: { x: 12, y: 42, s: 0.7, a: 0.75 },
    interact: { x: 24, y: 42, s: 0.7, a: 0.75 },
    use: { x: 32, y: 64, s: 0.7, a: 0.75 },
    nade: { x: 40, y: 64, s: 0.7, a: 0.75 },
    swap: { x: 12, y: 28, s: 0.65, a: 0.7 },
    ping: { x: 48, y: 70, s: 0.65, a: 0.7 },
  },
};

const KEY = "vanguard.settings.v2";

const DEFAULTS: Settings = {
  quality: "auto",
  fpsCap: 0,
  resolutionScale: 1,
  shadows: "auto",
  effects: "auto",
  viewDistance: "auto",
  aa: true,
  sensitivity: 1,
  adsSens: 0.85,
  scopeSens: 0.7,
  invertY: false,
  gyro: false,
  gyroSens: 1,
  showFps: true,
  preferFullscreen: true,
  master: 0.8,
  music: 0.45,
  sfx: 0.85,
  voice: 0.8,
  uiVol: 0.7,
  weaponVol: 0.9,
  envVol: 0.55,
  charVol: 0.6,
  chatVol: 0.85,
  spatial: true,
  mono: false,
  charVoice: true,
  colorblind: "none",
  leftHanded: false,
  uiScale: 1,
  textScale: 1,
  highContrast: false,
  reduceShake: false,
  reduceFlash: false,
  subtitles: false,
  autoSprint: false,
  autoPickup: false,
  hitMarkers: true,
  dmgNumbers: true,
  lang: "en",
  touchPreset: "standard",
  touch: {},
  binds: {},
  stickSens: 1,
  triggerSens: 1,
  rumble: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("vanguard.settings.v1");
    if (!raw) return { ...DEFAULTS, binds: { ...DEFAULT_BINDS } };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      binds: { ...DEFAULT_BINDS, ...(parsed.binds || {}) },
      touch: parsed.touch || {},
    };
  } catch {
    return { ...DEFAULTS, binds: { ...DEFAULT_BINDS } };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function bindOf(s: Settings, act: InputAction): string {
  return s.binds[act] || DEFAULT_BINDS[act];
}

export function resolveQuality(s: Settings): QualityId | "auto" {
  switch (s.quality) {
    case "auto":
      return "auto";
    case "vlow":
    case "potato":
      return "potato";
    case "low":
      return "low";
    case "medium":
    case "custom":
      return "medium";
    case "high":
      return "high";
    case "vhigh":
    case "ultra":
      return "ultra";
    default:
      return "medium";
  }
}
