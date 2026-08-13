import { AUDIO_BUSES, AUDIO_PRIORITY, CALLOUTS, audioPublic, weaponVoice } from "../shared/src/audio.ts";
import { ENGINE_VERSION, PROTOCOL_VERSION } from "../shared/src/constants.ts";

if (PROTOCOL_VERSION < 11) throw new Error("version");
if (AUDIO_BUSES.length !== 9) throw new Error("buses");
if (AUDIO_PRIORITY.footstep <= AUDIO_PRIORITY.music) throw new Error("priority");
const a = weaponVoice("virex", "rifle");
const b = weaponVoice("wisp", "smg");
if (a.kind !== "ar" || b.kind !== "smg") throw new Error("kind");
if (a.muzzle === b.muzzle && a.body === b.body) throw new Error("identity");
if (!CALLOUTS.reload.includes("Reload")) throw new Error("callout");
const pub = audioPublic();
if (!pub.license.toLowerCase().includes("original")) throw new Error("license");
if (!pub.voiceChat.toLowerCase().includes("webrtc")) throw new Error("vc");
console.log("audio ok", { proto: PROTOCOL_VERSION, engine: ENGINE_VERSION, virex: Math.round(a.muzzle), wisp: Math.round(b.muzzle) });
