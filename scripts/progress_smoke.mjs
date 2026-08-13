import {
  rankName,
  rankFor,
  rankedBand,
  matchXp,
  updateRating,
  performanceScore,
  mergeCareer,
  PLACEMENT_MATCHES,
  SEASON_NAME,
  progressPublic,
} from "../shared/src/progress.ts";
import { PROTOCOL_VERSION, ENGINE_VERSION } from "../shared/src/constants.ts";

if (PROTOCOL_VERSION < 8) throw new Error("version");
if (rankFor(1250).id !== "gold") throw new Error("gold");
if (!rankName(1250).includes("GOLD")) throw new Error("name " + rankName(1250));
if (rankedBand(0) >= rankedBand(45000)) throw new Error("band");
const xpWin = matchXp({ won: true, kills: 4, assists: 2, revives: 1, damage: 800, mvp: true, afk: false, botHeavy: false, competitive: true, challengeXp: 0 });
const xpAfk = matchXp({ won: true, kills: 0, assists: 0, revives: 0, damage: 0, mvp: false, afk: true, botHeavy: false, competitive: true, challengeXp: 0 });
if (xpAfk !== 0) throw new Error("afk xp");
if (xpWin < 100 || xpWin > 420) throw new Error("xp " + xpWin);
const r = updateRating(1200, 350, 1, 1200, 350, false);
if (r.delta <= 0) throw new Error("win should climb");
const lose = updateRating(1200, 80, 0, 1200, 80, true);
const rawLose = updateRating(1200, 80, 0, 1200, 80, false);
if (Math.abs(lose.delta) >= Math.abs(rawLose.delta) - 0.01) throw new Error("protect");
const c = mergeCareer(undefined, 0);
if (c.placementsLeft !== PLACEMENT_MATCHES) throw new Error("place");
const pub = progressPublic();
if (pub.ranks.length !== 8 || pub.season.name !== SEASON_NAME) throw new Error("public");
const score = performanceScore({ won: true, kills: 3, assists: 1, revives: 1, damage: 600, mvp: false, survival: 400, duration: 500 });
if (score < 0.55 || score > 1) throw new Error("score");
console.log("progress ok", { xpWin, delta: Math.round(r.delta), rank: rankName(1650), band: rankedBand(30000) });
