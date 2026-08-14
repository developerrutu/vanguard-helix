import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ACHIEVEMENTS,
  BEGINNER_POOL,
  CHARACTERS,
  DAILY_POOL,
  DEFAULT_MMR,
  ENGINE_VERSION,
  LEVEL_PRESTIGE_AT,
  PLACEMENT_MATCHES,
  SEASON_ID,
  SEASON_NAME,
  STARTING_SOFT,
  WEEKLY_POOL,
  WELCOME_AFTER_MS,
  bumpChallenge,
  countryFromRegion,
  defaultAppearance,
  emptyCareer,
  masteryLevel,
  matchSoft,
  matchXp,
  mergeCareer,
  mergeTies,
  performanceScore,
  rankName,
  CLAN_CAP,
  clanNameOk,
  clanTagOk,
  roleRank,
  rotateChallenges,
  sanitizeAppearance,
  titleUnlocks,
  updateRating,
  xpToLevel,
  type Appearance,
  type Career,
  type CareerStats,
  type ClanMember,
  type ClanRole,
  type PrivacySettings,
  type RecentPlayer,
  type Ties,
  type CurrencyState,
  type InventorySlot,
  type MatchResult,
  type ProfileState,
} from "../../../shared/src/index";

export interface Account {
  id: string;
  name: string;
  token: string;
  xp: number;
  mmr: number;
  currency: CurrencyState;
  slots: InventorySlot[];
  stats: CareerStats;
  friends: string[];
  clanId: string;
  clanTag: string;
  character: string;
  appearance: Appearance;
  achievements: string[];
  mastery: { id: string; xp: number }[];
  lastMatchId: string;
  lastRegion: string;
  contact: boolean;
  createdAt: number;
  updatedAt: number;
  career: Career;
  ties: Ties;
  email?: string;
  passSalt?: string;
  passHash?: string;
  recoverySalt?: string;
  recoveryHash?: string;
  recoveryUntil?: number;
  bannedUntil?: number;
  banReason?: string;
  chatMuteUntil?: number;
  queueRestrictUntil?: number;
  deletedAt?: number;
  owned: string[];
  passPremium: boolean;
  passXp: number;
  passClaimed: number;
  lastDaily: string;
  receipts: { id: string; sku: string; at: number; ion: number; orbit: number; reason: string }[];
}

export interface Clan {
  id: string;
  tag: string;
  name: string;
  logo: string;
  desc: string;
  level: number;
  xp: number;
  leaderId: string;
  members: ClanMember[];
  announce: string;
  createdAt: number;
}

interface DiskShape {
  accounts: Account[];
  clans: Clan[];
  matches: MatchResult[];
}

const dataFile = join(process.env.HELIX_DATA || join(process.cwd(), ".data"), "accounts.json");

const CONTACT_NAMES = ["RAVI", "MIRA", "JUN"];

function emptyStats(): CareerStats {
  return { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, matches: 0, wins: 0, losses: 0, revives: 0 };
}

function normalize(raw: Partial<Account> & { id: string; name: string; token: string }): Account {
  const stats = { ...emptyStats(), ...(raw.stats || {}) };
  return {
    id: raw.id,
    name: raw.name,
    token: raw.token,
    xp: raw.xp ?? 0,
    mmr: raw.mmr ?? DEFAULT_MMR,
    currency: raw.currency ?? { soft: STARTING_SOFT, hard: 0 },
    slots: raw.slots ?? [
      { itemId: "repair_kit", qty: 1 },
      { itemId: "plates", qty: 0 },
    ],
    stats,
    friends: raw.friends ?? [],
    clanId: raw.clanId ?? "",
    clanTag: raw.clanTag ?? "",
    character: (CHARACTERS as readonly string[]).includes(raw.character || "") ? raw.character! : CHARACTERS[0],
    appearance: sanitizeAppearance(raw.appearance, xpToLevel(raw.xp ?? 0), raw.owned || ["duty", "em_hail", "bn_plain"]),
    achievements: raw.achievements ?? [],
    mastery: raw.mastery ?? [],
    lastMatchId: raw.lastMatchId ?? "",
    lastRegion: raw.lastRegion ?? "india",
    contact: Boolean(raw.contact),
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
    career: mergeCareer(raw.career, stats.matches, Date.now()),
    ties: mergeTies(raw.ties),
    email: raw.email,
    passSalt: raw.passSalt,
    passHash: raw.passHash,
    recoverySalt: raw.recoverySalt,
    recoveryHash: raw.recoveryHash,
    recoveryUntil: raw.recoveryUntil,
    bannedUntil: raw.bannedUntil,
    banReason: raw.banReason,
    chatMuteUntil: raw.chatMuteUntil,
    queueRestrictUntil: raw.queueRestrictUntil,
    deletedAt: raw.deletedAt,
    owned: raw.owned?.length ? [...raw.owned] : ["duty", "em_hail", "bn_plain"],
    passPremium: Boolean(raw.passPremium),
    passXp: raw.passXp ?? 0,
    passClaimed: raw.passClaimed ?? 0,
    lastDaily: raw.lastDaily ?? "",
    receipts: Array.isArray(raw.receipts) ? raw.receipts.slice(-40) : [],
  };
}

function normClan(raw: Partial<Clan> & { id: string; tag: string; leaderId: string }): Clan {
  const members: ClanMember[] = (raw.members || []).map((m) =>
    typeof m === "string"
      ? { id: m, role: (m === raw.leaderId ? "leader" : "member") as ClanRole, contrib: 0 }
      : { id: m.id, role: m.role || "member", contrib: m.contrib || 0 },
  );
  if (!members.some((m) => m.id === raw.leaderId)) {
    members.unshift({ id: raw.leaderId, role: "leader", contrib: 0 });
  }
  return {
    id: raw.id,
    tag: raw.tag,
    name: raw.name || raw.tag,
    logo: raw.logo || "helix",
    desc: raw.desc || "",
    level: raw.level || 1,
    xp: raw.xp || 0,
    leaderId: raw.leaderId,
    members,
    announce: raw.announce || "",
    createdAt: raw.createdAt || Date.now(),
  };
}

export class Store {
  private accounts = new Map<string, Account>();
  private byToken = new Map<string, string>();
  private byName = new Map<string, string>();
  private byMail = new Map<string, string>();
  private clans = new Map<string, Clan>();
  private matches: MatchResult[] = [];
  private dirty = false;

  constructor() {
    this.load();
    setInterval(() => this.flush(), 4000).unref();
  }

  private load(): void {
    try {
      if (!existsSync(dataFile)) return;
      const raw = JSON.parse(readFileSync(dataFile, "utf8")) as DiskShape;
      for (const a of raw.accounts ?? []) {
        const n = normalize(a);
        this.accounts.set(n.id, n);
        this.byToken.set(n.token, n.id);
        this.byName.set(n.name.toLowerCase(), n.id);
        if (n.email) this.byMail.set(n.email, n.id);
      }
      for (const c of raw.clans ?? []) {
        const n = normClan(c as Clan);
        this.clans.set(n.id, n);
      }
      this.matches = raw.matches ?? [];
    } catch {
      /* fresh */
    }
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(dataFile), { recursive: true });
    const payload: DiskShape = {
      accounts: [...this.accounts.values()],
      clans: [...this.clans.values()],
      matches: this.matches.slice(-80),
    };
    writeFileSync(dataFile, JSON.stringify(payload, null, 2));
    this.dirty = false;
  }

  createGuest(name: string): Account {
    const id = "p_" + randomBytes(6).toString("hex");
    const token = randomBytes(18).toString("base64url");
    const account = normalize({
      id,
      name: this.uniqueName(sanitizeName(name)),
      token,
      xp: 0,
      mmr: DEFAULT_MMR + Math.floor(Math.random() * 80) - 20,
    });
    this.put(account);
    this.seedContacts(account);
    return account;
  }

  createContact(owner: Account, callsign: string, index: number): Account {
    const id = `c_${owner.id}_${index}`;
    const existing = this.accounts.get(id);
    if (existing) return existing;
    const acc = normalize({
      id,
      name: callsign,
      token: "contact-" + id,
      xp: 200 + index * 90,
      mmr: owner.mmr + (index - 1) * 30,
      contact: true,
      character: CHARACTERS[(index + 1) % CHARACTERS.length],
    });
    this.put(acc);
    return acc;
  }

  private seedContacts(owner: Account): void {
    for (let i = 0; i < CONTACT_NAMES.length; i++) {
      const c = this.createContact(owner, CONTACT_NAMES[i], i);
      if (!owner.friends.includes(c.id)) owner.friends.push(c.id);
      if (!c.friends.includes(owner.id)) c.friends.push(owner.id);
    }
    this.touch(owner);
  }

  ensureContacts(owner: Account): void {
    if (owner.contact) return;
    const missing = CONTACT_NAMES.some((_, i) => !this.accounts.has(`c_${owner.id}_${i}`));
    if (missing || owner.friends.length === 0) this.seedContacts(owner);
  }

  private put(a: Account): void {
    this.accounts.set(a.id, a);
    this.byToken.set(a.token, a.id);
    this.byName.set(a.name.toLowerCase(), a.id);
    this.dirty = true;
  }

  private touch(a: Account): void {
    a.updatedAt = Date.now();
    this.dirty = true;
  }

  private uniqueName(base: string): string {
    let name = base;
    let n = 1;
    while (this.byName.has(name.toLowerCase())) {
      name = (base.slice(0, 12) + n).slice(0, 16);
      n++;
    }
    return name;
  }

  byId(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  bySession(token: string): Account | undefined {
    const id = this.byToken.get(token);
    return id ? this.accounts.get(id) : undefined;
  }

  byCallsign(name: string): Account | undefined {
    const id = this.byName.get(name.trim().toLowerCase());
    return id ? this.accounts.get(id) : undefined;
  }

  rename(id: string, name: string): void {
    const a = this.accounts.get(id);
    if (!a || a.contact) return;
    this.byName.delete(a.name.toLowerCase());
    a.name = this.uniqueName(sanitizeName(name));
    this.byName.set(a.name.toLowerCase(), a.id);
    this.touch(a);
  }

  setCharacter(id: string, character: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    if (!(CHARACTERS as readonly string[]).includes(character)) return;
    a.character = character;
    this.touch(a);
  }

  setAppearance(id: string, next: Partial<Appearance>, character?: string): Appearance | null {
    const a = this.accounts.get(id);
    if (!a) return null;
    if (character && (CHARACTERS as readonly string[]).includes(character)) a.character = character;
    a.appearance = sanitizeAppearance({ ...a.appearance, ...next }, xpToLevel(a.xp));
    this.touch(a);
    return a.appearance;
  }

  grantAchievement(id: string, achId: string): boolean {
    const a = this.accounts.get(id);
    const def = ACHIEVEMENTS.find((x) => x.id === achId);
    if (!a || !def || a.achievements.includes(achId)) return false;
    a.achievements.push(achId);
    a.xp += def.xp;
    this.touch(a);
    return true;
  }

  addMastery(id: string, weaponId: string, xp: number): void {
    const a = this.accounts.get(id);
    if (!a) return;
    const row = a.mastery.find((m) => m.id === weaponId);
    if (row) row.xp += xp;
    else a.mastery.push({ id: weaponId, xp });
    this.touch(a);
  }

  historyOf(id: string): MatchResult[] {
    return this.matches.filter((m) => m.cards.some((c) => c.id === id)).slice(-24).reverse();
  }

  setRegion(id: string, region: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.lastRegion = region;
    a.career.country = countryFromRegion(region);
    this.touch(a);
  }

  markRange(id: string): void {
    const a = this.accounts.get(id);
    if (!a || a.contact) return;
    rotateChallenges(a.career, Date.now());
    a.career.ranged = true;
    const xp = bumpChallenge(a.career.beginner, BEGINNER_POOL, "range", 1);
    if (xp) a.xp += xp;
    this.touch(a);
  }

  touchSeen(id: string): { welcome: boolean; days: number } {
    const a = this.accounts.get(id);
    if (!a) return { welcome: false, days: 0 };
    const now = Date.now();
    rotateChallenges(a.career, now);
    const gap = now - (a.career.lastSeen || a.updatedAt || now);
    const days = Math.floor(gap / 86400000);
    let welcome = false;
    if (gap >= WELCOME_AFTER_MS && !a.contact) {
      a.career.welcomeUntil = now + 7 * 86400000;
      a.xp += 80;
      welcome = true;
    }
    a.career.lastSeen = now;
    this.touch(a);
    return { welcome, days };
  }

  setProgress(id: string, next: { title?: string; shown?: string[]; prestige?: boolean }): boolean {
    const a = this.accounts.get(id);
    if (!a || a.contact) return false;
    const unlocked = titleUnlocks({
      wins: a.stats.wins,
      level: xpToLevel(a.xp),
      sharp: a.achievements.includes("sharp"),
      revives: a.stats.revives ?? 0,
      rating: a.mmr,
      prestige: a.career.prestige,
    });
    if (next.title && unlocked.includes(next.title)) a.career.title = next.title;
    if (next.shown) a.career.shown = next.shown.filter((b) => a.career.badges.includes(b) || a.achievements.includes(b)).slice(0, 3);
    if (next.prestige && xpToLevel(a.xp) >= LEVEL_PRESTIGE_AT) {
      a.career.prestige += 1;
      const cut = 80 * 99 * 99;
      a.xp = Math.max(0, a.xp - cut);
      this.grantAchievement(id, "prestige");
    }
    this.touch(a);
    return true;
  }

  setLastMatch(id: string, matchId: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.lastMatchId = matchId;
    this.touch(a);
  }

  ledger(id: string, softDelta: number, reason: string): CurrencyState | null {
    const a = this.accounts.get(id);
    if (!a) return null;
    const next = a.currency.soft + softDelta;
    if (next < 0) return null;
    a.currency.soft = next;
    this.touch(a);
    void reason;
    return { ...a.currency };
  }

  addItem(id: string, itemId: string, qty: number): InventorySlot[] {
    const a = this.accounts.get(id);
    if (!a) return [];
    const slot = a.slots.find((s) => s.itemId === itemId);
    if (slot) slot.qty += qty;
    else a.slots.push({ itemId, qty });
    this.touch(a);
    return a.slots.map((s) => ({ ...s }));
  }

  consumeItem(id: string, itemId: string, qty = 1): boolean {
    const a = this.accounts.get(id);
    if (!a) return false;
    const slot = a.slots.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < qty) return false;
    slot.qty -= qty;
    this.touch(a);
    return true;
  }

  grantXp(id: string, amount: number): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.xp += amount;
    this.touch(a);
  }

  bumpStat(id: string, key: keyof CareerStats, amount: number): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.stats[key] += amount;
    this.touch(a);
  }

  applyMatch(id: string, card: { kills: number; deaths: number; assists: number; damage: number; shots: number; hits: number }, won: boolean, xp: number, soft: number, mmrDelta: number): void {
    const a = this.accounts.get(id);
    if (!a || a.contact) return;
    a.stats.kills += card.kills;
    a.stats.deaths += card.deaths;
    a.stats.assists += card.assists;
    a.stats.damage += card.damage;
    a.stats.shots += card.shots;
    a.stats.hits += card.hits;
    a.stats.matches += 1;
    if (won) a.stats.wins += 1;
    else a.stats.losses += 1;
    a.xp += xp;
    a.mmr = Math.max(0, a.mmr + mmrDelta);
    a.currency.soft += soft;
    this.touch(a);
  }

  addFriend(a: string, b: string): void {
    const A = this.accounts.get(a);
    const B = this.accounts.get(b);
    if (!A || !B) return;
    if (!A.friends.includes(b)) A.friends.push(b);
    if (!B.friends.includes(a)) B.friends.push(a);
    this.touch(A);
    this.touch(B);
  }

  friendsOf(id: string): Account[] {
    const a = this.accounts.get(id);
    if (!a) return [];
    return a.friends.map((f) => this.accounts.get(f)).filter((x): x is Account => Boolean(x));
  }

  createClan(leaderId: string, tag: string, name?: string, desc?: string): Clan | null {
    const clean = clanTagOk(tag);
    const title = clanNameOk(name || tag);
    if (!clean || !title) return null;
    if ([...this.clans.values()].some((c) => c.tag === clean)) return null;
    const leader = this.accounts.get(leaderId);
    if (!leader || leader.clanId) return null;
    const id = "cl_" + randomBytes(3).toString("hex");
    const clan: Clan = {
      id,
      tag: clean,
      name: title,
      logo: "helix",
      desc: (desc || "").slice(0, 160),
      level: 1,
      xp: 0,
      leaderId,
      members: [{ id: leaderId, role: "leader", contrib: 0 }],
      announce: "",
      createdAt: Date.now(),
    };
    this.clans.set(id, clan);
    leader.clanId = id;
    leader.clanTag = clean;
    this.touch(leader);
    return clan;
  }

  joinClan(playerId: string, clanId: string): boolean {
    const clan = this.clans.get(clanId);
    const a = this.accounts.get(playerId);
    if (!clan || !a) return false;
    if (clan.members.length >= CLAN_CAP) return false;
    if (!clan.members.some((m) => m.id === playerId)) clan.members.push({ id: playerId, role: "member", contrib: 0 });
    a.clanId = clan.id;
    a.clanTag = clan.tag;
    this.touch(a);
    return true;
  }

  clanById(id: string): Clan | undefined {
    return this.clans.get(id);
  }

  saveMatch(result: MatchResult): void {
    this.matches.push(result);
    this.dirty = true;
  }

  lastMatch(id: string): MatchResult | undefined {
    for (let i = this.matches.length - 1; i >= 0; i--) {
      if (this.matches[i].cards.some((c) => c.id === id) || this.matches[i].matchId === id) return this.matches[i];
    }
    return undefined;
  }

  profileOf(a: Account): ProfileState {
    const c = a.career;
    const placing = c.placementsLeft > 0;
    const acc = a.stats.shots ? a.stats.hits / a.stats.shots : 0;
    const kd = a.stats.deaths ? a.stats.kills / a.stats.deaths : a.stats.kills;
    const wr = a.stats.matches ? a.stats.wins / a.stats.matches : 0;
    const chal = [
      ...c.daily.map((d) => {
        const def = DAILY_POOL.find((x) => x.id === d.id);
        return { id: d.id, name: def?.name ?? d.id, kind: "daily", progress: d.progress, goal: d.goal, done: d.done, xp: def?.xp ?? 0 };
      }),
      ...c.weekly.map((d) => {
        const def = WEEKLY_POOL.find((x) => x.id === d.id);
        return { id: d.id, name: def?.name ?? d.id, kind: "weekly", progress: d.progress, goal: d.goal, done: d.done, xp: def?.xp ?? 0 };
      }),
      ...c.beginner.map((d) => {
        const def = BEGINNER_POOL.find((x) => x.id === d.id);
        return { id: d.id, name: def?.name ?? d.id, kind: "beginner", progress: d.progress, goal: d.goal, done: d.done, xp: def?.xp ?? 0 };
      }),
    ];
    const welcome =
      c.welcomeUntil > Date.now()
        ? { days: Math.max(14, Math.round((Date.now() - (c.lastSeen || a.createdAt)) / 86400000)), season: SEASON_NAME, version: ENGINE_VERSION }
        : null;
    return {
      id: a.id,
      name: a.name,
      xp: a.xp,
      level: xpToLevel(a.xp),
      mmr: Math.round(a.mmr),
      rank:
        c.placementsLeft > 0
          ? c.rankedMatches === 0
            ? "UNRANKED"
            : `PLACING ${PLACEMENT_MATCHES - c.placementsLeft}/${PLACEMENT_MATCHES}`
          : rankName(a.mmr),
      clanTag: a.clanTag,
      character: a.character,
      stats: { ...a.stats },
      appearance: a.appearance ?? defaultAppearance(),
      achievements: [...(a.achievements || [])],
      mastery: [...(a.mastery || [])],
      prestige: c.prestige,
      title: c.title,
      badges: [...c.badges],
      shown: [...c.shown],
      playtimeSec: c.playtimeSec,
      createdAt: a.createdAt,
      placing: placing ? { done: PLACEMENT_MATCHES - c.placementsLeft, total: PLACEMENT_MATCHES } : null,
      season: {
        id: c.season.id,
        name: c.season.name,
        rating: Math.round(a.mmr),
        rd: Math.round(c.rd),
        matches: c.season.matches,
        wins: c.season.wins,
        kills: c.season.kills,
        deaths: c.season.deaths,
        assists: c.season.assists,
        damage: Math.round(c.season.damage),
        peak: Math.round(c.season.peak),
        kd: c.season.deaths ? Math.round((c.season.kills / c.season.deaths) * 100) / 100 : c.season.kills,
      },
      streaks: { ...c.streaks },
      challenges: chal,
      welcome,
      favoriteWeapons: [...a.mastery].sort((x, y) => y.xp - x.xp).slice(0, 3).map((m) => ({ id: m.id, xp: m.xp, level: masteryLevel(m.xp) })),
      favoriteMaps: [...c.mapMastery].sort((x, y) => y.matches - x.matches).slice(0, 3).map((m) => ({ id: m.id, matches: m.matches, wins: m.wins })),
      accuracy: Math.round(acc * 100),
      kd: Math.round(kd * 100) / 100,
      winRate: Math.round(wr * 100),
      country: c.country,
      claimed: Boolean(a.email),
      sanction: this.publicSanction(a),
    };
  }

  commitMatch(rep: {
    id: string;
    card: { kills: number; deaths: number; assists: number; damage: number; shots: number; hits: number; revives: number; mvp: boolean; survival: number; accuracy: number };
    won: boolean;
    afk: boolean;
    botHeavy: boolean;
    competitive: boolean;
    mapId: string;
    durationSec: number;
    bestDist: number;
    foes: string;
    oppRating: number;
    oppRd: number;
  }): { xp: number; soft: number; mmrDelta: number; placing: boolean; challenges: string[]; afk: boolean; title: string } {
    const a = this.accounts.get(rep.id);
    const empty = { xp: 0, soft: 0, mmrDelta: 0, placing: false, challenges: [] as string[], afk: rep.afk, title: "rookie" };
    if (!a || a.contact) return empty;
    rotateChallenges(a.career, Date.now());
    const c = a.career;
    a.stats.kills += rep.card.kills;
    a.stats.deaths += rep.card.deaths;
    a.stats.assists += rep.card.assists;
    a.stats.damage += rep.card.damage;
    a.stats.shots += rep.card.shots;
    a.stats.hits += rep.card.hits;
    a.stats.matches += 1;
    a.stats.revives = (a.stats.revives ?? 0) + rep.card.revives;
    if (rep.won) a.stats.wins += 1;
    else a.stats.losses += 1;
    c.playtimeSec += rep.durationSec;
    c.season.matches += 1;
    c.season.kills += rep.card.kills;
    c.season.deaths += rep.card.deaths;
    c.season.assists += rep.card.assists;
    c.season.damage += rep.card.damage;
    if (rep.won) c.season.wins += 1;
    let chalXp = 0;
    const popped: string[] = [];
    const bump = (stat: "matches" | "wins" | "kills" | "revives" | "damage", n: number) => {
      const before = chalXp;
      chalXp += bumpChallenge(c.daily, DAILY_POOL, stat, n);
      chalXp += bumpChallenge(c.weekly, WEEKLY_POOL, stat, n);
      chalXp += bumpChallenge(c.beginner, BEGINNER_POOL, stat, n);
      if (chalXp > before) popped.push(stat);
    };
    if (!rep.afk) {
      bump("matches", 1);
      if (rep.won) bump("wins", 1);
      bump("kills", rep.card.kills);
      bump("revives", rep.card.revives);
      bump("damage", Math.round(rep.card.damage));
    }
    const xp = matchXp({
      won: rep.won,
      kills: rep.card.kills,
      assists: rep.card.assists,
      revives: rep.card.revives,
      damage: rep.card.damage,
      mvp: rep.card.mvp,
      afk: rep.afk,
      botHeavy: rep.botHeavy,
      competitive: rep.competitive,
      challengeXp: chalXp,
    });
    const soft = matchSoft(rep.won, rep.card.kills, rep.card.mvp, rep.afk, rep.botHeavy);
    a.xp += xp;
    a.currency.soft += soft;
    a.passXp = (a.passXp || 0) + xp;
    c.season.xp += xp;
    let mmrDelta = 0;
    const placing = rep.competitive && c.placementsLeft > 0;
    if (rep.competitive && !rep.afk) {
      const score = performanceScore({
        won: rep.won,
        kills: rep.card.kills,
        assists: rep.card.assists,
        revives: rep.card.revives,
        damage: rep.card.damage,
        mvp: rep.card.mvp,
        survival: rep.card.survival,
        duration: rep.durationSec,
      });
      const protect = !placing && c.protectLeft > 0 && !rep.won;
      const next = updateRating(a.mmr, c.rd, score, rep.oppRating, rep.oppRd, protect);
      mmrDelta = next.delta;
      a.mmr = next.rating;
      c.rd = next.rd;
      c.rankedMatches += 1;
      if (placing) c.placementsLeft = Math.max(0, c.placementsLeft - 1);
      if (protect) c.protectLeft = Math.max(0, c.protectLeft - 1);
      if (a.mmr > c.season.peak) c.season.peak = a.mmr;
    }
    if (rep.mapId) {
      let row = c.mapMastery.find((m) => m.id === rep.mapId);
      if (!row) {
        row = { id: rep.mapId, matches: 0, wins: 0, kills: 0, survival: 0 };
        c.mapMastery.push(row);
      }
      row.matches += 1;
      if (rep.won) row.wins += 1;
      row.kills += rep.card.kills;
      row.survival += rep.card.survival;
    }
    if (rep.won) c.streaks.win += 1;
    else {
      c.streaks.bestWin = Math.max(c.streaks.bestWin, c.streaks.win);
      c.streaks.win = 0;
    }
    if (rep.card.mvp) c.streaks.mvp += 1;
    else {
      c.streaks.bestMvp = Math.max(c.streaks.bestMvp, c.streaks.mvp);
      c.streaks.mvp = 0;
    }
    c.streaks.elim = rep.card.kills > 0 ? c.streaks.elim + 1 : 0;
    c.streaks.bestElim = Math.max(c.streaks.bestElim, c.streaks.elim);
    c.streaks.bestWin = Math.max(c.streaks.bestWin, c.streaks.win);
    if (rep.foes && rep.foes === c.recentFoes) c.tradeHeat += 1;
    else c.tradeHeat = Math.max(0, c.tradeHeat - 1);
    c.recentFoes = rep.foes;
    const titles = titleUnlocks({
      wins: a.stats.wins,
      level: xpToLevel(a.xp),
      sharp: a.achievements.includes("sharp") || (rep.card.accuracy >= 40 && rep.card.shots >= 40),
      revives: a.stats.revives ?? 0,
      rating: a.mmr,
      prestige: c.prestige,
    });
    for (const t of titles) if (!c.badges.includes(t)) c.badges.push(t);
    if (!titles.includes(c.title)) c.title = titles[titles.length - 1] || "rookie";
    this.touch(a);
    return { xp, soft, mmrDelta: Math.round(mmrDelta), placing, challenges: popped, afk: rep.afk, title: c.title };
  }

  boards(scope: string, viewer: Account): { scope: string; rows: { id: string; name: string; rating: number; rank: string; wins: number; kills: number; matches: number; kd: number; winRate: number }[] } {
    let pool = [...this.accounts.values()].filter((a) => !a.contact);
    if (scope === "region") pool = pool.filter((a) => a.lastRegion === viewer.lastRegion);
    if (scope === "country") pool = pool.filter((a) => a.career.country === viewer.career.country);
    if (scope === "clan" && viewer.clanId) {
      const clan = this.clans.get(viewer.clanId);
      const ids = new Set((clan?.members ?? []).map((m) => m.id));
      pool = pool.filter((a) => ids.has(a.id));
    }
    if (scope === "friends") {
      const ids = new Set([viewer.id, ...viewer.friends]);
      pool = pool.filter((a) => ids.has(a.id));
    }
    const rows = pool
      .map((a) => {
        const kd = a.stats.deaths ? a.stats.kills / a.stats.deaths : a.stats.kills;
        const winRate = a.stats.matches ? a.stats.wins / a.stats.matches : 0;
        return {
          id: a.id,
          name: a.name,
          rating: Math.round(a.mmr),
          rank: rankName(a.mmr, a.career.placementsLeft > 0),
          wins: a.stats.wins,
          kills: a.stats.kills,
          matches: a.stats.matches,
          kd: Math.round(kd * 100) / 100,
          winRate: Math.round(winRate * 100),
        };
      })
      .sort((x, y) => y.rating - x.rating || y.wins - x.wins)
      .slice(0, 50);
    return { scope, rows };
  }

  count(): number {
    return [...this.accounts.values()].filter((a) => !a.contact).length;
  }

  allAccounts(): Account[] {
    return [...this.accounts.values()];
  }

  clanList(): Clan[] {
    return [...this.clans.values()];
  }

  clanOf(id: string): Clan | undefined {
    const a = this.accounts.get(id);
    return a?.clanId ? this.clans.get(a.clanId) : undefined;
  }

  clanRole(clan: Clan, id: string): ClanRole | null {
    return clan.members.find((m) => m.id === id)?.role ?? null;
  }

  clanSetRole(actorId: string, targetId: string, role: ClanRole): string | null {
    const clan = this.clanOf(actorId);
    if (!clan) return "no clan";
    const actor = this.clanRole(clan, actorId);
    const target = clan.members.find((m) => m.id === targetId);
    if (!actor || !target) return "not found";
    if (roleRank(actor) < 3) return "need leader";
    if (target.role === "leader") return "cannot demote leader";
    if (role === "leader") {
      const prev = clan.members.find((m) => m.role === "leader");
      if (prev) prev.role = "colead";
      target.role = "leader";
      clan.leaderId = targetId;
    } else target.role = role;
    this.dirty = true;
    return null;
  }

  clanKick(actorId: string, targetId: string): string | null {
    const clan = this.clanOf(actorId);
    if (!clan) return "no clan";
    const actor = this.clanRole(clan, actorId);
    const target = clan.members.find((m) => m.id === targetId);
    if (!actor || !target) return "not found";
    if (roleRank(actor) < 2 || roleRank(actor) <= roleRank(target.role)) return "rank";
    clan.members = clan.members.filter((m) => m.id !== targetId);
    const t = this.accounts.get(targetId);
    if (t) {
      t.clanId = "";
      t.clanTag = "";
      this.touch(t);
    }
    this.dirty = true;
    return null;
  }

  clanAnnounce(actorId: string, text: string): string | null {
    const clan = this.clanOf(actorId);
    if (!clan) return "no clan";
    const role = this.clanRole(clan, actorId);
    if (!role || roleRank(role) < 2) return "rank";
    clan.announce = text.slice(0, 240);
    this.dirty = true;
    return null;
  }

  leaveClan(id: string): string | null {
    const a = this.accounts.get(id);
    if (!a?.clanId) return "no clan";
    const clan = this.clans.get(a.clanId);
    if (!clan) {
      a.clanId = "";
      a.clanTag = "";
      this.touch(a);
      return null;
    }
    const me = clan.members.find((m) => m.id === id);
    if (me?.role === "leader" && clan.members.length > 1) {
      const next = [...clan.members].sort((x, y) => roleRank(y.role) - roleRank(x.role) || y.contrib - x.contrib).find((m) => m.id !== id);
      if (next) {
        next.role = "leader";
        clan.leaderId = next.id;
      }
    }
    clan.members = clan.members.filter((m) => m.id !== id);
    a.clanId = "";
    a.clanTag = "";
    this.touch(a);
    if (clan.members.length === 0) this.clans.delete(clan.id);
    this.dirty = true;
    return null;
  }

  clanAddXp(clanId: string, n: number): void {
    const clan = this.clans.get(clanId);
    if (!clan) return;
    clan.xp += n;
    clan.level = 1 + Math.floor(clan.xp / 400);
    this.dirty = true;
  }

  addContrib(id: string, n: number): void {
    const a = this.accounts.get(id);
    if (!a?.clanId) return;
    const clan = this.clans.get(a.clanId);
    const m = clan?.members.find((x) => x.id === id);
    if (m) m.contrib += n;
    if (clan) this.clanAddXp(clan.id, n);
  }

  setPrivacy(id: string, next: Partial<PrivacySettings>): PrivacySettings | null {
    const a = this.accounts.get(id);
    if (!a) return null;
    a.ties.privacy = { ...a.ties.privacy, ...next };
    this.touch(a);
    return a.ties.privacy;
  }

  addRecent(id: string, row: RecentPlayer): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.ties.recent = [row, ...a.ties.recent.filter((r) => r.id !== row.id)].slice(0, 24);
    this.touch(a);
  }

  setFavorite(id: string, target: string, on: boolean): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.ties.favorites = a.ties.favorites.filter((x) => x !== target);
    if (on && a.friends.includes(target)) a.ties.favorites.unshift(target);
    this.touch(a);
  }

  block(a: string, b: string): void {
    const A = this.accounts.get(a);
    const B = this.accounts.get(b);
    if (!A || !B) return;
    if (!A.ties.blocked.includes(b)) A.ties.blocked.push(b);
    A.friends = A.friends.filter((x) => x !== b);
    B.friends = B.friends.filter((x) => x !== a);
    A.ties.outgoing = A.ties.outgoing.filter((x) => x !== b);
    A.ties.incoming = A.ties.incoming.filter((x) => x !== b);
    B.ties.outgoing = B.ties.outgoing.filter((x) => x !== a);
    B.ties.incoming = B.ties.incoming.filter((x) => x !== a);
    A.ties.favorites = A.ties.favorites.filter((x) => x !== b);
    this.touch(A);
    this.touch(B);
  }

  unblock(a: string, b: string): void {
    const A = this.accounts.get(a);
    if (!A) return;
    A.ties.blocked = A.ties.blocked.filter((x) => x !== b);
    this.touch(A);
  }

  requestFriend(from: string, to: string): string | null {
    if (from === to) return "self";
    const A = this.accounts.get(from);
    const B = this.accounts.get(to);
    if (!A || !B) return "missing";
    if (A.ties.blocked.includes(to) || B.ties.blocked.includes(from)) return "blocked";
    if (A.friends.includes(to)) return "already";
    if (B.ties.incoming.includes(from) || A.ties.outgoing.includes(to)) return "pending";
    if (A.ties.incoming.includes(to)) {
      this.addFriend(from, to);
      A.ties.incoming = A.ties.incoming.filter((x) => x !== to);
      B.ties.outgoing = B.ties.outgoing.filter((x) => x !== from);
      this.touch(A);
      this.touch(B);
      return null;
    }
    A.ties.outgoing.push(to);
    B.ties.incoming.push(from);
    this.touch(A);
    this.touch(B);
    return null;
  }

  acceptFriend(me: string, from: string): string | null {
    const A = this.accounts.get(me);
    const B = this.accounts.get(from);
    if (!A || !B) return "missing";
    if (!A.ties.incoming.includes(from)) return "none";
    A.ties.incoming = A.ties.incoming.filter((x) => x !== from);
    B.ties.outgoing = B.ties.outgoing.filter((x) => x !== me);
    this.addFriend(me, from);
    return null;
  }

  rejectFriend(me: string, from: string): void {
    const A = this.accounts.get(me);
    const B = this.accounts.get(from);
    if (A) {
      A.ties.incoming = A.ties.incoming.filter((x) => x !== from);
      this.touch(A);
    }
    if (B) {
      B.ties.outgoing = B.ties.outgoing.filter((x) => x !== me);
      this.touch(B);
    }
  }

  cancelFriend(me: string, to: string): void {
    this.rejectFriend(to, me);
  }

  removeFriend(a: string, b: string): void {
    const A = this.accounts.get(a);
    const B = this.accounts.get(b);
    if (A) {
      A.friends = A.friends.filter((x) => x !== b);
      A.ties.favorites = A.ties.favorites.filter((x) => x !== b);
      this.touch(A);
    }
    if (B) {
      B.friends = B.friends.filter((x) => x !== a);
      B.ties.favorites = B.ties.favorites.filter((x) => x !== a);
      this.touch(B);
    }
  }

  findPlayers(q: string, viewerId: string): Account[] {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const exact = this.accounts.get(q.trim()) || this.byCallsign(q);
    const out: Account[] = [];
    if (exact && exact.id !== viewerId) out.push(exact);
    for (const a of this.accounts.values()) {
      if (a.id === viewerId || a.contact) continue;
      if (out.some((x) => x.id === a.id)) continue;
      if (a.id.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)) out.push(a);
      if (out.length >= 12) break;
    }
    return out.slice(0, 12);
  }

  setSessionToken(id: string, token: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    if (a.token) this.byToken.delete(a.token);
    a.token = token;
    this.byToken.set(token, a.id);
    this.touch(a);
  }

  byEmail(email: string): Account | undefined {
    const id = this.byMail.get(email.trim().toLowerCase());
    return id ? this.accounts.get(id) : undefined;
  }

  claimEmail(id: string, email: string, salt: string, hash: string): string | null {
    const a = this.accounts.get(id);
    if (!a || a.contact || a.deletedAt) return "missing";
    const taken = this.byMail.get(email);
    if (taken && taken !== id) return "taken";
    if (a.email) this.byMail.delete(a.email);
    a.email = email;
    a.passSalt = salt;
    a.passHash = hash;
    this.byMail.set(email, id);
    this.touch(a);
    return null;
  }

  setPass(id: string, salt: string, hash: string): boolean {
    const a = this.accounts.get(id);
    if (!a || !a.email) return false;
    a.passSalt = salt;
    a.passHash = hash;
    a.recoveryHash = undefined;
    a.recoverySalt = undefined;
    a.recoveryUntil = undefined;
    this.touch(a);
    return true;
  }

  setRecovery(id: string, salt: string, hash: string, until: number): boolean {
    const a = this.accounts.get(id);
    if (!a || !a.email) return false;
    a.recoverySalt = salt;
    a.recoveryHash = hash;
    a.recoveryUntil = until;
    this.touch(a);
    return true;
  }

  applySanction(id: string, kind: string, until: number, reason: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    if (kind === "chat_mute") a.chatMuteUntil = until;
    else if (kind === "queue_restrict") a.queueRestrictUntil = until;
    else if (kind === "suspend" || kind === "ban") {
      a.bannedUntil = until;
      a.banReason = reason;
    }
    this.touch(a);
  }

  clearSanction(id: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.bannedUntil = 0;
    a.banReason = "";
    a.chatMuteUntil = 0;
    a.queueRestrictUntil = 0;
    this.touch(a);
  }

  isBanned(a: Account): boolean {
    return Boolean(a.deletedAt) || Boolean(a.bannedUntil && a.bannedUntil > Date.now());
  }

  isMuted(a: Account): boolean {
    return Boolean(a.chatMuteUntil && a.chatMuteUntil > Date.now());
  }

  isQueueRestricted(a: Account): boolean {
    return Boolean(a.queueRestrictUntil && a.queueRestrictUntil > Date.now());
  }

  publicSanction(a: Account): string {
    if (a.deletedAt) return "deleted";
    if (this.isBanned(a)) return a.bannedUntil && a.bannedUntil - Date.now() > 365 * 86400000 ? "ban" : "suspend";
    if (this.isQueueRestricted(a)) return "queue_restrict";
    if (this.isMuted(a)) return "chat_mute";
    return "none";
  }

  exportSafe(id: string): Record<string, unknown> | null {
    const a = this.accounts.get(id);
    if (!a) return null;
    return {
      id: a.id,
      name: a.name,
      email: a.email || null,
      createdAt: a.createdAt,
      lastRegion: a.lastRegion,
      xp: a.xp,
      mmr: Math.round(a.mmr),
      stats: a.stats,
      friends: [...a.friends],
      clanTag: a.clanTag,
      character: a.character,
      achievements: [...a.achievements],
      privacy: a.ties.privacy,
      matches: this.historyOf(id).map((m) => ({
        matchId: m.matchId,
        winner: m.winner,
        mapName: m.mapName,
        durationSec: m.durationSec,
      })),
    };
  }

  deleteAccount(id: string): boolean {
    const a = this.accounts.get(id);
    if (!a || a.contact) return false;
    if (a.email) this.byMail.delete(a.email);
    this.byName.delete(a.name.toLowerCase());
    a.name = "DELETED-" + a.id.slice(-4).toUpperCase();
    a.email = undefined;
    a.passHash = undefined;
    a.passSalt = undefined;
    a.recoveryHash = undefined;
    a.recoverySalt = undefined;
    a.token = "revoked-" + a.id;
    a.deletedAt = Date.now();
    a.friends = [];
    a.ties = { ...a.ties, incoming: [], outgoing: [], favorites: [], recent: [] };
    this.byName.set(a.name.toLowerCase(), a.id);
    this.touch(a);
    return true;
  }

  transact(id: string, ion: number, orbit: number, reason: string, requestId = ""): CurrencyState | null {
    const a = this.accounts.get(id);
    if (!a || a.contact || a.deletedAt) return null;
    if (requestId && a.receipts.some((r) => r.id === requestId)) return { ...a.currency };
    const nextIon = a.currency.soft + ion;
    const nextOrbit = a.currency.hard + orbit;
    if (nextIon < 0 || nextOrbit < 0) return null;
    a.currency.soft = nextIon;
    a.currency.hard = nextOrbit;
    if (requestId) {
      a.receipts.push({ id: requestId, sku: reason, at: Date.now(), ion, orbit, reason });
      if (a.receipts.length > 40) a.receipts.shift();
    }
    this.touch(a);
    return { ...a.currency };
  }

  grantOwned(id: string, sku: string): boolean {
    const a = this.accounts.get(id);
    if (!a) return false;
    if (!a.owned.includes(sku)) a.owned.push(sku);
    this.touch(a);
    return true;
  }

  owns(id: string, sku: string): boolean {
    return Boolean(this.accounts.get(id)?.owned.includes(sku));
  }

  walletOf(id: string) {
    const a = this.accounts.get(id);
    if (!a) return null;
    return {
      ion: a.currency.soft,
      orbit: a.currency.hard,
      owned: [...a.owned],
      pass: { season: a.career.seasonId, premium: a.passPremium, tier: Math.floor((a.passXp || 0) / 80), xp: a.passXp || 0 },
      lastDaily: a.lastDaily,
      receipts: a.receipts.slice(-8),
    };
  }

  setPassPremium(id: string): boolean {
    const a = this.accounts.get(id);
    if (!a) return false;
    a.passPremium = true;
    this.touch(a);
    return true;
  }

  setPassClaimed(id: string, tier: number): void {
    const a = this.accounts.get(id);
    if (!a) return;
    a.passClaimed = Math.max(a.passClaimed || 0, tier);
    this.touch(a);
  }

  addPassXp(id: string, xp: number): { before: number; after: number } {
    const a = this.accounts.get(id);
    if (!a || xp <= 0) return { before: 0, after: 0 };
    const before = a.passXp || 0;
    a.passXp = before + xp;
    this.touch(a);
    return { before, after: a.passXp };
  }

  claimDaily(id: string, day: string): boolean {
    const a = this.accounts.get(id);
    if (!a || a.contact) return false;
    if (a.lastDaily === day) return false;
    a.lastDaily = day;
    this.touch(a);
    return true;
  }
}

function sanitizeName(name: string): string {
  const cleaned = (name || "Operator").replace(/[^\w \-]/g, "").trim().slice(0, 16);
  return cleaned || "Operator";
}
