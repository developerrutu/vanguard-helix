/** Part 11 — original Helix audio contracts. No third-party banks. */

export const AUDIO_BUSES = [
  "master",
  "music",
  "weapons",
  "effects",
  "environment",
  "character",
  "voice",
  "ui",
  "voiceChat",
] as const;

export type AudioBus = (typeof AUDIO_BUSES)[number];

export type MusicState =
  | "silence"
  | "menu"
  | "loading"
  | "intro"
  | "explore"
  | "contact"
  | "fight"
  | "final"
  | "victory"
  | "defeat"
  | "profile";

export type CalloutId = "spotted" | "reload" | "help" | "hurt" | "moving" | "clear" | "win" | "lose" | "greet";

export type ImpactSurf = "metal" | "concrete" | "wood" | "glass" | "dirt" | "sand" | "stone" | "water";

export const AUDIO_PRIORITY: Record<string, number> = {
  critical: 100,
  footstep: 90,
  weapon: 80,
  explosion: 70,
  comms: 60,
  character: 40,
  environment: 25,
  music: 10,
  ui: 8,
};

export interface WeaponVoice {
  id: string;
  kind: "smg" | "ar" | "shot" | "sniper" | "pistol" | "melee" | "lmg";
  muzzle: number;
  body: number;
  decay: number;
  grit: number;
  slap: number;
  report: number;
}

export function weaponVoice(id: string, cls: string): WeaponVoice {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = (h >>> 0) / 0xffffffff;
  const kind: WeaponVoice["kind"] =
    cls === "smg" || cls === "machinepistol"
      ? "smg"
      : cls === "shotgun"
        ? "shot"
        : cls === "sniper" || cls === "dmr"
          ? "sniper"
          : cls === "melee"
            ? "melee"
            : cls === "lmg"
              ? "lmg"
              : cls === "sidearm" || cls === "revolver"
                ? "pistol"
                : "ar";
  const base: Record<WeaponVoice["kind"], Omit<WeaponVoice, "id" | "kind">> = {
    smg: { muzzle: 210, body: 90, decay: 0.07, grit: 0.35, slap: 0.2, report: 0.35 },
    ar: { muzzle: 155, body: 72, decay: 0.1, grit: 0.5, slap: 0.28, report: 0.55 },
    lmg: { muzzle: 130, body: 58, decay: 0.14, grit: 0.62, slap: 0.22, report: 0.7 },
    shot: { muzzle: 88, body: 42, decay: 0.18, grit: 0.8, slap: 0.7, report: 0.5 },
    sniper: { muzzle: 96, body: 48, decay: 0.28, grit: 0.45, slap: 0.15, report: 0.95 },
    pistol: { muzzle: 240, body: 110, decay: 0.08, grit: 0.28, slap: 0.4, report: 0.3 },
    melee: { muzzle: 320, body: 80, decay: 0.09, grit: 0.15, slap: 0.85, report: 0.05 },
  };
  const b = base[kind];
  return {
    id,
    kind,
    muzzle: b.muzzle * (0.92 + u * 0.16),
    body: b.body * (0.9 + (1 - u) * 0.18),
    decay: b.decay,
    grit: b.grit,
    slap: b.slap,
    report: b.report,
  };
}

export const CALLOUTS: Record<CalloutId, string> = {
  spotted: "Enemy spotted.",
  reload: "Reloading.",
  help: "Need medical support.",
  hurt: "Taking fire.",
  moving: "Moving.",
  clear: "Area clear.",
  win: "We hold the yard.",
  lose: "We drop. Reset.",
  greet: "Squad up.",
};

export function audioPublic() {
  return {
    engine: "Web Audio API — Helix mixer. Oscillators + shared noise, no sampled banks.",
    rule: "All timbres are original Helix synthesis. No copyrighted samples. Gameplay audio is local from authority events. Voice chat never rides the game snapshot.",
    buses: AUDIO_BUSES,
    music: ["menu", "loading", "intro", "explore", "contact", "fight", "final", "victory", "defeat", "profile"],
    priority: ["critical", "footstep", "weapon", "explosion", "comms", "character", "environment", "music", "ui"],
    spatial: "PannerNode HRTF when the browser allows, equalpower fallback. Distance + occlusion lowpass.",
    voiceChat: "Optional. Mute / volume / disable now. Opus/WebRTC is the scale-out path — never raw PCM on the game wire.",
    license: "100% original Helix synthesis. Commercially usable. See LICENSE_AUDIO.md.",
  };
}
