import {
  ENGINE_VERSION,
  PROTOCOL_VERSION,
  FEATURES,
  SEASONS,
  EVENTS,
  NOTES,
  KEEP_ACROSS_SEASONS,
  PIPELINE,
  FEEDBACK_KINDS,
  assetOriginalOk,
  ionDailyMul,
  livePublic,
  scrubFeedback,
} from "../shared/src/index.ts";

if (PROTOCOL_VERSION !== 15 || ENGINE_VERSION !== "15.0.0") throw new Error("version");

const keep = new Set(KEEP_ACROSS_SEASONS);
for (const k of ["player_id", "username", "friends", "clan", "inventory", "statistics", "achievements", "progression", "rank_history"]) {
  if (!keep.has(k)) throw new Error("keep " + k);
}

const s1 = SEASONS.find((s) => s.id === 1);
if (!s1 || s1.state !== "live" || s1.name !== "ORBIT") throw new Error("s1");
if (SEASONS.filter((s) => s.state === "planned").length !== 4) throw new Error("planned");
if (SEASONS.some((s) => s.keeps.length < 9)) throw new Error("season wipe");

const surge = EVENTS.find((e) => e.id === "ion_surge_s1");
if (!surge || surge.matchmaking !== "unchanged") throw new Error("event mm");
if (ionDailyMul(Date.parse("2026-08-13T12:00:00Z")) !== 2) throw new Error("ion mul live");
if (ionDailyMul(Date.parse("2026-10-01T00:00:00Z")) !== 1) throw new Error("ion mul off");

if (NOTES[0]?.version !== "15.0.0") throw new Error("notes");
if (!NOTES[0].known.some((k) => /launch|voice|payment/i.test(k))) throw new Error("known");

const byId = Object.fromEntries(FEATURES.map((f) => [f.id, f]));
if (byId.launch?.state !== "not_yet") throw new Error("launch claimed");
if (byId.payments?.state !== "not_yet") throw new Error("payments claimed");
if (byId.legal?.state !== "not_yet") throw new Error("legal claimed");
if (byId.closed_test?.state !== "not_yet") throw new Error("closed test claimed");
if (byId.voice?.state !== "partial") throw new Error("voice");
if (byId.match?.state !== "implemented") throw new Error("match");
if (byId.combat?.state !== "implemented") throw new Error("combat");

const pub = livePublic();
if (pub.launch !== "not_yet") throw new Error("public launch");
if (pub.protocol !== 15) throw new Error("pub proto");
if (pub.pipeline.join(">") !== PIPELINE.join(">")) throw new Error("pipeline");
if (!FEEDBACK_KINDS.includes("security")) throw new Error("kinds");
if (PIPELINE[0] !== "concept" || PIPELINE.at(-1) !== "release") throw new Error("pipe ends");

const scrub = scrubFeedback("write password: hunter2 to a@b.com please");
if (scrub.includes("hunter2") || scrub.includes("@")) throw new Error("scrub");
if (assetOriginalOk({ copied: true })) {
  /* ok */
} else throw new Error("copied");
if (assetOriginalOk({ licensed: false }) !== "rights") throw new Error("rights");
if (assetOriginalOk({ luma: 0.1 }) !== "invis") throw new Error("invis");
if (assetOriginalOk({ power: true }) !== "power") throw new Error("power");
if (assetOriginalOk({ luma: 0.3, licensed: true })) throw new Error("ok asset");

if (pub.counts.implemented < 8) throw new Error("counts");
if (pub.counts.not_yet < 3) throw new Error("honest gaps");

console.log("live ok", {
  proto: PROTOCOL_VERSION,
  engine: ENGINE_VERSION,
  launch: pub.launch,
  season: pub.season.name,
  implemented: pub.counts.implemented,
  partial: pub.counts.partial,
  not_yet: pub.counts.not_yet,
});
