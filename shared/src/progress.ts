/** Part 8 — progression data. Cosmetic and rating only. Never mutates combat stats. */

export const SEASON_ID = 1;
export const SEASON_NAME = "ORBIT";
export const PLACEMENT_MATCHES = 8;
export const PROTECT_AFTER = 5;
export const LEVEL_PRESTIGE_AT = 100;
export const MASTERY_CAP = 50;
export const XP_MATCH_CAP = 420;
export const WELCOME_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
export const RANKED_SEARCH_MAX_MS = 120_000;
export const RANKED_BAND_START = 90;
export const RANKED_BAND_STEP = 70;
export const RANKED_BAND_EVERY = 15_000;
export const RANKED_BAND_MAX = 420;
export const DEFAULT_RD = 350;
export const MIN_RD = 50;
export const DEFAULT_RATING = 1200;

export interface RankDef {
  id: string;
  name: string;
  minMmr: number;
  divisions: number;
}

/** Bronze→Helix. Helix is the apex (Elite equivalent). Divisions V–I below Master. */
export const RANKS: RankDef[] = [
  { id: "bronze", name: "BRONZE", minMmr: 0, divisions: 5 },
  { id: "silver", name: "SILVER", minMmr: 1000, divisions: 5 },
  { id: "gold", name: "GOLD", minMmr: 1200, divisions: 5 },
  { id: "platinum", name: "PLATINUM", minMmr: 1400, divisions: 5 },
  { id: "diamond", name: "DIAMOND", minMmr: 1600, divisions: 5 },
  { id: "master", name: "MASTER", minMmr: 1800, divisions: 0 },
  { id: "grandmaster", name: "GRANDMASTER", minMmr: 2000, divisions: 0 },
  { id: "helix", name: "HELIX", minMmr: 2200, divisions: 0 },
];

export const DEFAULT_MMR = DEFAULT_RATING;

export const DIV_MARK = ["V", "IV", "III", "II", "I"] as const;

export interface SeasonSlice {
  id: number;
  name: string;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  xp: number;
  peak: number;
}

export interface MapMastery {
  id: string;
  matches: number;
  wins: number;
  kills: number;
  survival: number;
}

export interface Streaks {
  win: number;
  mvp: number;
  elim: number;
  bestWin: number;
  bestMvp: number;
  bestElim: number;
}

export interface ChallengeDef {
  id: string;
  name: string;
  kind: "daily" | "weekly" | "beginner";
  stat: "matches" | "wins" | "kills" | "revives" | "damage" | "range";
  goal: number;
  xp: number;
}

export interface ChallengeProg {
  id: string;
  progress: number;
  goal: number;
  done: boolean;
  claimed: boolean;
}

export interface Career {
  prestige: number;
  playtimeSec: number;
  title: string;
  badges: string[];
  shown: string[];
  country: string;
  seasonId: number;
  rd: number;
  placementsLeft: number;
  rankedMatches: number;
  protectLeft: number;
  season: SeasonSlice;
  mapMastery: MapMastery[];
  streaks: Streaks;
  rankHistory: { seasonId: number; peak: number; end: number }[];
  lastSeen: number;
  welcomeUntil: number;
  dayKey: string;
  weekKey: string;
  daily: ChallengeProg[];
  weekly: ChallengeProg[];
  beginner: ChallengeProg[];
  ranged: boolean;
  recentFoes: string;
  tradeHeat: number;
}

export const TITLES = [
  { id: "rookie", name: "ROOKIE", how: "Default." },
  { id: "survivor", name: "SURVIVOR", how: "Win a Team BR." },
  { id: "sharpshooter", name: "SHARPSHOOTER", how: "40% accuracy over 40 shots." },
  { id: "squad", name: "SQUAD LEADER", how: "Revive 5 teammates." },
  { id: "veteran", name: "VETERAN", how: "Reach operator level 25." },
  { id: "elite", name: "ELITE", how: "Reach Diamond." },
  { id: "champion", name: "CHAMPION", how: "Reach Helix or win a season." },
] as const;

export const DAILY_POOL: ChallengeDef[] = [
  { id: "d_play", name: "Play 3 matches", kind: "daily", stat: "matches", goal: 3, xp: 60 },
  { id: "d_elim", name: "Get 5 eliminations", kind: "daily", stat: "kills", goal: 5, xp: 70 },
  { id: "d_rev", name: "Revive 3 teammates", kind: "daily", stat: "revives", goal: 3, xp: 80 },
  { id: "d_dmg", name: "Deal 2,000 damage", kind: "daily", stat: "damage", goal: 2000, xp: 70 },
];

export const WEEKLY_POOL: ChallengeDef[] = [
  { id: "w_win", name: "Win 10 matches", kind: "weekly", stat: "wins", goal: 10, xp: 220 },
  { id: "w_elim", name: "Get 50 eliminations", kind: "weekly", stat: "kills", goal: 50, xp: 200 },
  { id: "w_dmg", name: "Deal 15,000 damage", kind: "weekly", stat: "damage", goal: 15000, xp: 200 },
  { id: "w_rev", name: "Revive 20 teammates", kind: "weekly", stat: "revives", goal: 20, xp: 240 },
];

export const BEGINNER_POOL: ChallengeDef[] = [
  { id: "b_range", name: "Visit the Training Range", kind: "beginner", stat: "range", goal: 1, xp: 40 },
  { id: "b_play", name: "Play 1 match", kind: "beginner", stat: "matches", goal: 1, xp: 40 },
  { id: "b_elim", name: "Get 1 elimination", kind: "beginner", stat: "kills", goal: 1, xp: 40 },
  { id: "b_dmg", name: "Deal 500 damage", kind: "beginner", stat: "damage", goal: 500, xp: 40 },
];

export function emptySeason(id = SEASON_ID): SeasonSlice {
  return { id, name: SEASON_NAME, matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, xp: 0, peak: DEFAULT_RATING };
}

export function emptyStreaks(): Streaks {
  return { win: 0, mvp: 0, elim: 0, bestWin: 0, bestMvp: 0, bestElim: 0 };
}

export function emptyCareer(now = Date.now()): Career {
  return {
    prestige: 0,
    playtimeSec: 0,
    title: "rookie",
    badges: [],
    shown: [],
    country: "IN",
    seasonId: SEASON_ID,
    rd: DEFAULT_RD,
    placementsLeft: PLACEMENT_MATCHES,
    rankedMatches: 0,
    protectLeft: PROTECT_AFTER,
    season: emptySeason(),
    mapMastery: [],
    streaks: emptyStreaks(),
    rankHistory: [],
    lastSeen: now,
    welcomeUntil: 0,
    dayKey: dayKey(now),
    weekKey: weekKey(now),
    daily: rollChallenges(DAILY_POOL, now),
    weekly: rollChallenges(WEEKLY_POOL, now),
    beginner: BEGINNER_POOL.map((c) => ({ id: c.id, progress: 0, goal: c.goal, done: false, claimed: false })),
    ranged: false,
    recentFoes: "",
    tradeHeat: 0,
  };
}

export function mergeCareer(raw: Partial<Career> | undefined, matches: number, now = Date.now()): Career {
  const base = emptyCareer(now);
  const c = { ...base, ...(raw || {}) };
  c.season = { ...emptySeason(c.seasonId || SEASON_ID), ...(raw?.season || {}) };
  c.streaks = { ...emptyStreaks(), ...(raw?.streaks || {}) };
  c.mapMastery = raw?.mapMastery ? raw.mapMastery.map((m) => ({ ...m })) : [];
  c.rankHistory = raw?.rankHistory ? [...raw.rankHistory] : [];
  c.daily = Array.isArray(raw?.daily) ? raw!.daily : base.daily;
  c.weekly = Array.isArray(raw?.weekly) ? raw!.weekly : base.weekly;
  c.beginner = Array.isArray(raw?.beginner) ? raw!.beginner : base.beginner;
  if (c.seasonId !== SEASON_ID) softReset(c);
  rotateChallenges(c, now);
  if (raw == null && matches >= PLACEMENT_MATCHES) {
    c.placementsLeft = 0;
    c.rd = 90;
    c.rankedMatches = matches;
  }
  return c;
}

export function softReset(c: Career): void {
  c.rankHistory.push({ seasonId: c.seasonId, peak: c.season.peak, end: c.season.matches });
  c.seasonId = SEASON_ID;
  c.season = emptySeason();
  c.rd = Math.min(DEFAULT_RD, c.rd + 80);
  c.placementsLeft = 0;
  c.protectLeft = 2;
}

export function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function weekKey(t: number): string {
  const d = new Date(t);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

export function rollChallenges(pool: ChallengeDef[], seed: number): ChallengeProg[] {
  return pool.map((c) => ({ id: c.id, progress: 0, goal: c.goal, done: false, claimed: false }));
}

export function rotateChallenges(c: Career, now: number): void {
  const d = dayKey(now);
  const w = weekKey(now);
  if (c.dayKey !== d) {
    c.dayKey = d;
    c.daily = rollChallenges(DAILY_POOL, now);
  }
  if (c.weekKey !== w) {
    c.weekKey = w;
    c.weekly = rollChallenges(WEEKLY_POOL, now);
  }
}

export function rankFor(mmr: number): RankDef {
  let found = RANKS[0];
  for (const r of RANKS) if (mmr >= r.minMmr) found = r;
  return found;
}

export function rankDivision(mmr: number): string {
  const r = rankFor(mmr);
  if (!r.divisions) return "";
  const next = RANKS.find((x) => x.minMmr > r.minMmr);
  const span = (next?.minMmr ?? r.minMmr + 200) - r.minMmr;
  const step = span / r.divisions;
  const i = Math.min(r.divisions - 1, Math.max(0, Math.floor((mmr - r.minMmr) / step)));
  return DIV_MARK[i];
}

export function rankName(mmr: number, placing?: boolean): string {
  if (placing) return "PLACING";
  const r = rankFor(mmr);
  const d = rankDivision(mmr);
  return d ? `${r.name} ${d}` : r.name;
}

export function rankedBand(waitedMs: number): number {
  const steps = Math.floor(waitedMs / RANKED_BAND_EVERY);
  return Math.min(RANKED_BAND_MAX, RANKED_BAND_START + steps * RANKED_BAND_STEP);
}

export function countryFromRegion(region: string): string {
  const map: Record<string, string> = {
    india: "IN",
    singapore: "SG",
    japan: "JP",
    korea: "KR",
    europe: "DE",
    middleeast: "BH",
    na: "US",
    sa: "BR",
    oceania: "AU",
  };
  return map[region] || "IN";
}

export function masteryLevel(xp: number): number {
  return Math.max(1, Math.min(MASTERY_CAP, Math.floor(xp / 120) + 1));
}

export interface MatchXpIn {
  won: boolean;
  kills: number;
  assists: number;
  revives: number;
  damage: number;
  mvp: boolean;
  afk: boolean;
  botHeavy: boolean;
  competitive: boolean;
  challengeXp: number;
}

export function matchXp(in_: MatchXpIn): number {
  if (in_.afk) return 0;
  let xp =
    40 +
    (in_.won ? 90 : 25) +
    in_.kills * 12 +
    in_.assists * 8 +
    in_.revives * 16 +
    Math.min(2000, in_.damage) * 0.04 +
    (in_.mvp ? 30 : 0) +
    in_.challengeXp;
  if (in_.botHeavy) xp *= 0.55;
  if (in_.competitive) xp *= 1.12;
  return Math.max(0, Math.min(XP_MATCH_CAP, Math.round(xp)));
}

export function matchSoft(won: boolean, kills: number, mvp: boolean, afk: boolean, botHeavy: boolean): number {
  if (afk) return 0;
  let n = (won ? 80 : 24) + kills * 8 + (mvp ? 20 : 0);
  if (botHeavy) n = Math.round(n * 0.5);
  return n;
}

/** Glicko-1 team update. Opponent is the enemy squad average. */
export function updateRating(
  rating: number,
  rd: number,
  score: number,
  oppRating: number,
  oppRd: number,
  protect: boolean,
): { rating: number; rd: number; delta: number } {
  const q = Math.log(10) / 400;
  const g = (d: number) => 1 / Math.sqrt(1 + (3 * q * q * d * d) / (Math.PI * Math.PI));
  const gop = g(oppRd);
  const exp = 1 / (1 + Math.pow(10, (-gop * (rating - oppRating)) / 400));
  const d2 = 1 / (q * q * gop * gop * exp * (1 - exp) + 1e-9);
  const k = 1 / (1 / (rd * rd) + 1 / d2);
  let next = rating + q * k * gop * (score - exp);
  let nextRd = Math.sqrt(1 / (1 / (rd * rd) + 1 / d2));
  if (protect && next < rating) next = rating + (next - rating) * 0.5;
  next = clamp(next, 0, 3600);
  nextRd = clamp(nextRd, MIN_RD, DEFAULT_RD);
  return { rating: next, rd: nextRd, delta: next - rating };
}

export function performanceScore(input: {
  won: boolean;
  kills: number;
  assists: number;
  revives: number;
  damage: number;
  mvp: boolean;
  survival: number;
  duration: number;
}): number {
  const raw =
    input.kills * 0.11 +
    input.assists * 0.05 +
    input.revives * 0.09 +
    (Math.min(1800, input.damage) / 1800) * 0.25 +
    (input.duration > 0 ? input.survival / input.duration : 0) * 0.08 +
    (input.mvp ? 0.08 : 0);
  const delta = clamp(raw - 0.42, -0.22, 0.22);
  if (input.won) return clamp(0.72 + delta, 0.55, 1);
  return clamp(0.28 + delta, 0, 0.45);
}

export function bumpChallenge(list: ChallengeProg[], pool: ChallengeDef[], stat: ChallengeDef["stat"], amount: number): number {
  let xp = 0;
  for (const row of list) {
    if (row.done) continue;
    const def = pool.find((d) => d.id === row.id);
    if (!def || def.stat !== stat) continue;
    row.progress = Math.min(row.goal, row.progress + amount);
    if (row.progress >= row.goal) {
      row.done = true;
      if (!row.claimed) {
        row.claimed = true;
        xp += def.xp;
      }
    }
  }
  return xp;
}

export function titleUnlocks(opts: {
  wins: number;
  level: number;
  sharp: boolean;
  revives: number;
  rating: number;
  prestige: number;
}): string[] {
  const out = ["rookie"];
  if (opts.wins > 0) out.push("survivor");
  if (opts.sharp) out.push("sharpshooter");
  if (opts.revives >= 5) out.push("squad");
  if (opts.level >= 25) out.push("veteran");
  if (opts.rating >= 1600) out.push("elite");
  if (opts.rating >= 2200 || opts.prestige > 0) out.push("champion");
  return out;
}

export function progressPublic() {
  return {
    rule: "Progression is cosmetic and rating-only. Level, prestige, titles, badges, and mastery never change health, damage, speed, armor, or accuracy.",
    rating: "Helix Rating — Glicko-1 team rating. Visible number + hidden RD. Team outcome is the signal; individual performance is a bounded residual. Chosen over Elo (no uncertainty) and full TrueSkill (opaque, draw/beta extras we do not need at 4v4).",
    season: { id: SEASON_ID, name: SEASON_NAME },
    placements: PLACEMENT_MATCHES,
    ranks: RANKS,
    titles: TITLES,
    daily: DAILY_POOL,
    weekly: WEEKLY_POOL,
    beginner: BEGINNER_POOL,
    prestigeAt: LEVEL_PRESTIGE_AT,
    ranked: { noBots: true, searchMaxMs: RANKED_SEARCH_MAX_MS, bandStart: RANKED_BAND_START },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
