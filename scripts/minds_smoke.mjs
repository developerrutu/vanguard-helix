import {
  mintMind,
  pickDifficulty,
  PERSONAS,
  SKILLS,
  weatherVisionMul,
  mindsPublic,
} from "../shared/src/minds.ts";
import { PROTOCOL_VERSION, ENGINE_VERSION } from "../shared/src/constants.ts";
import { bindBrain, botInput } from "../server/src/sim/bot.ts";

const names = new Set();
const personas = new Set();
for (let i = 0; i < 8; i++) {
  const m = mintMind(4242, i, 1100, 12, "ranked");
  names.add(m.callsign);
  personas.add(m.persona);
  if (/bot|ai|cpu/i.test(m.callsign)) throw new Error("leaky name " + m.callsign);
}
if (names.size !== 8) throw new Error("names not unique " + [...names]);
if (personas.size < 4) throw new Error("need all four personas " + [...personas]);

const easy = pickDifficulty({ mmr: 1400, matches: 2, mode: "ranked", slot: 1 });
if (easy !== "easy" && easy !== "normal") throw new Error("new player not protected " + easy);
const botsElite = pickDifficulty({ mmr: 1600, matches: 40, mode: "bots", slot: 0 });
if (botsElite !== "elite") throw new Error("bots mmr elite " + botsElite);

const self = {
  id: "bot_test",
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  team: "alpha",
  alive: true,
  ammo: 12,
  reloading: false,
  downed: false,
  health: 80,
  grenades: 1,
  hasMed: true,
  zoneCx: 0,
  zoneCz: 0,
  zoneR: 40,
  wantLoot: false,
  flash: 0,
};
bindBrain(self.id, mintMind(9, 0, 1200, 20, "bots"), 9);
const foe = { ...self, id: "foe", team: "bravo", x: 8, z: 2 };
const inp = botInput(self, [foe], [], 1, 30, {
  map: { half: 40, walls: [], props: [{ x: -2, z: 0, hx: 1, hz: 1, h: 1 }], doors: [], glass: [] },
  weather: "rain",
  tickTime: 1,
  sounds: [{ x: 8, z: 2, t: 0.9, kind: "shot", loud: true }],
  cover: [{ x: -2, z: 0 }],
  scoreDelta: -2,
  shrinking: true,
});
if (!inp || typeof inp.buttons !== "number") throw new Error("no input");
if (weatherVisionMul("blizzard") >= 1) throw new Error("weather mul");
const pub = mindsPublic();
if (pub.personas.length !== 4 || pub.difficulties.length !== 4) throw new Error("public");
if (PROTOCOL_VERSION < 7) throw new Error("version");
console.log("minds ok", { names: [...names], personas: [...personas], buttons: inp.buttons, skills: Object.keys(SKILLS), PERSONAS: PERSONAS.map((p) => p.id) });
