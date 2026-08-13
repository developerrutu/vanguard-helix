import { randomBytes } from "node:crypto";
import {
  LOBBY_MS,
  MATCH_ACCEPT_MS,
  MAX_PLAYERS_PER_ROOM,
  MSG,
  SEARCH_HUMAN_MS,
  RANKED_SEARCH_MAX_MS,
  rankedBand,
  TEAM_SIZE,
  defaultAppearance,
  mintMind,
  rankName,
  regionById,
  xpToLevel,
  type LobbyState,
  type MatchMode,
  type MatchOffer,
  type RosterMember,
  type SearchUpdate,
  type TeamId,
} from "../../../shared/src/index";
import type { Account, Store } from "../persist/store";
import type { Wire } from "../sim/room";
import { Room } from "../sim/room";
import { Social } from "../social/social";
import { balanceTeams, type Assigned, type Seat } from "./balance";
import { FlagLog } from "../anticheat/flags";

interface Queued {
  account: Account;
  wire: Wire | null;
  bot: boolean;
  friend: boolean;
  ping: number;
  region: string;
  at: number;
  partyId: string;
  mode: MatchMode;
}

interface PendingMatch {
  id: string;
  region: string;
  mode: MatchMode;
  seats: Assigned[];
  wires: Map<string, Wire>;
  accepted: Set<string>;
  ready: Set<string>;
  offerUntil: number;
  lobbyUntil: number;
  phase: "offer" | "lobby";
}

export class Matchmaker {
  private queue: Queued[] = [];
  private pending = new Map<string, PendingMatch>();
  private rooms = new Map<string, Room>();
  private seq = 1;
  private reserved = new Map<string, { room: Room; until: number }>();

  constructor(
    private store: Store,
    private social: Social,
    private flags: FlagLog,
    private onBindRoom: (playerId: string, room: Room) => void,
  ) {
    setInterval(() => this.tick(), 200).unref();
  }

  enterRange(account: Account, wire: Wire, region: string): Room {
    this.cancel(account.id);
    this.store.markRange(account.id);
    const room = this.spawnRoom("range", region, []);
    room.join(account, wire, "none");
    this.onBindRoom(account.id, room);
    return room;
  }

  enqueue(account: Account, wire: Wire, mode: MatchMode, region: string, ping: number): void {
    if (this.store.isBanned(account)) {
      wire.send({ type: MSG.ERROR, code: "banned", message: account.banReason || "Account restricted" });
      return;
    }
    if (this.store.isQueueRestricted(account)) {
      wire.send({ type: MSG.ERROR, code: "restricted", message: "Queue restricted — review pending" });
      return;
    }
    this.cancel(account.id);
    if (mode === "bots") {
      this.launchBots(account, wire, region, ping);
      return;
    }
    const party = this.social.partyOf(account.id);
    const members = party?.members ?? [account.id];
    if (party && party.leaderId !== account.id) {
      wire.send({ type: MSG.ERROR, code: "rejected", message: "Only the party leader can queue" });
      return;
    }
    for (const mid of members) {
      const acc = this.store.byId(mid);
      if (!acc) continue;
      if (mode === "ranked" && acc.contact) continue;
      this.queue = this.queue.filter((q) => q.account.id !== mid);
      this.queue.push({
        account: acc,
        wire: mid === account.id ? wire : this.social.wireOf(mid) ?? null,
        bot: Boolean(acc.contact),
        friend: acc.contact || account.friends.includes(mid),
        ping: mid === account.id ? ping : ping + 8,
        region,
        at: Date.now(),
        partyId: party?.id ?? "solo_" + account.id,
        mode,
      });
    }
    this.broadcastSearch();
    this.tryForm(region, mode);
  }

  cancel(playerId: string): void {
    const party = this.social.partyOf(playerId);
    const ids = new Set(party?.members ?? [playerId]);
    this.queue = this.queue.filter((q) => !ids.has(q.account.id));
    for (const [mid, m] of this.pending) {
      if (m.seats.some((s) => ids.has(s.account.id))) {
        this.failOffer(m, playerId);
        this.pending.delete(mid);
      }
    }
    this.broadcastSearch();
  }

  accept(playerId: string, matchId: string): void {
    const m = this.pending.get(matchId);
    if (!m || m.phase !== "offer") return;
    if (!m.seats.some((s) => s.account.id === playerId)) return;
    m.accepted.add(playerId);
    this.pushOffer(m);
    this.maybeLobby(m);
  }

  decline(playerId: string, matchId: string): void {
    const m = this.pending.get(matchId);
    if (!m) return;
    this.failOffer(m, playerId);
    this.pending.delete(matchId);
  }

  ready(playerId: string, matchId: string): void {
    const m = this.pending.get(matchId);
    if (!m || m.phase !== "lobby") return;
    m.ready.add(playerId);
    this.pushLobby(m);
    const humans = m.seats.filter((s) => !s.bot);
    if (humans.every((h) => m.ready.has(h.account.id))) {
      m.lobbyUntil = Math.min(m.lobbyUntil, Date.now() + 3000);
    }
  }

  roomById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  roomOfPlayer(playerId: string): Room | undefined {
    for (const r of this.rooms.values()) {
      if (r.hasPlayer(playerId)) return r;
    }
    return undefined;
  }

  isQueued(playerId: string): boolean {
    if (this.queue.some((q) => q.account.id === playerId)) return true;
    for (const m of this.pending.values()) {
      if (m.seats.some((s) => s.account.id === playerId)) return true;
    }
    return false;
  }

  reserve(playerId: string, room: Room): void {
    this.reserved.set(playerId, { room, until: Date.now() + 5 * 60_000 });
  }

  takeReserve(playerId: string): Room | null {
    const r = this.reserved.get(playerId);
    if (!r) return null;
    if (Date.now() > r.until) {
      this.reserved.delete(playerId);
      return null;
    }
    return r.room;
  }

  stats(): { rooms: number; queued: number; pending: number } {
    return { rooms: this.rooms.size, queued: this.queue.length, pending: this.pending.size };
  }

  attachWire(playerId: string, wire: Wire): void {
    for (const q of this.queue) if (q.account.id === playerId) q.wire = wire;
    for (const m of this.pending.values()) {
      if (m.seats.some((s) => s.account.id === playerId)) {
        m.wires.set(playerId, wire);
        if (m.phase === "offer") this.pushOffer(m);
        if (m.phase === "lobby") this.pushLobby(m);
      }
    }
  }

  private tick(): void {
    const now = Date.now();
    this.tryFormAll();
    for (const [id, m] of this.pending) {
      if (m.phase === "offer" && now >= m.offerUntil) {
        const humans = m.seats.filter((s) => !s.bot);
        const missing = humans.filter((h) => !m.accepted.has(h.account.id));
        if (missing.length) {
          this.failOffer(m, missing[0].account.id);
          this.pending.delete(id);
        } else {
          this.maybeLobby(m);
        }
      } else if (m.phase === "lobby") {
        this.pushLobby(m);
        if (now >= m.lobbyUntil) {
          this.startMatch(m);
          this.pending.delete(id);
        }
      }
    }
    for (const [pid, r] of this.reserved) {
      if (now > r.until) {
        r.room.botTakeover(pid);
        this.reserved.delete(pid);
      }
    }
    this.broadcastSearch();
  }

  private tryFormAll(): void {
    const keys = new Set(this.queue.map((q) => q.region + "|" + q.mode));
    for (const key of keys) {
      const [region, mode] = key.split("|") as [string, MatchMode];
      this.tryForm(region, mode);
    }
  }

  private tryForm(region: string, mode: MatchMode = "quick"): void {
    const now = Date.now();
    const pool = this.queue.filter((q) => q.region === region && q.mode === mode);
    if (!pool.length) return;
    const oldestAt = Math.min(...pool.map((q) => q.at));
    const waited = now - oldestAt;
    if (mode === "ranked") {
      const oldest = pool.reduce((a, b) => (a.at <= b.at ? a : b));
      const band = rankedBand(waited);
      const close = pool.filter(
        (q) => Math.abs(q.account.mmr - oldest.account.mmr) <= band || q.partyId === oldest.partyId,
      );
      const humans = uniqueHumans(close);
      if (humans >= MAX_PLAYERS_PER_ROOM) this.buildOffer(region, close, false, "ranked");
      return;
    }
    const humans = uniqueHumans(pool);
    if (humans >= MAX_PLAYERS_PER_ROOM || waited >= SEARCH_HUMAN_MS) {
      this.buildOffer(region, pool, waited >= SEARCH_HUMAN_MS, mode);
    }
  }

  private buildOffer(region: string, pool: Queued[], allowBots: boolean, mode: MatchMode = "quick"): void {
    const picked = pickUnits(pool, allowBots);
    if (!picked.length) return;
    const ids = new Set(picked.map((p) => p.account.id));
    this.queue = this.queue.filter((q) => !ids.has(q.account.id));

    let seats: Seat[] = picked.map((p) => ({
      account: p.account,
      bot: p.bot,
      friend: p.friend,
      ping: p.ping,
      partyId: p.partyId,
    }));

    if (mode === "ranked") {
      if (seats.filter((s) => !s.bot).length < MAX_PLAYERS_PER_ROOM) return;
    } else {
      const matches = seats.filter((s) => !s.bot).reduce((n, s) => Math.min(n, s.account.stats.matches), 99);
      while (seats.length < MAX_PLAYERS_PER_ROOM) {
        seats.push(this.makeBotSeat(region, seats[0]?.account.mmr ?? 1000, seats.length, matches, mode, seats));
      }
    }
    seats = seats.slice(0, MAX_PLAYERS_PER_ROOM);
    const assigned = balanceTeams(seats);
    const id = "m_" + this.seq++;
    const wires = new Map<string, Wire>();
    const accepted = new Set<string>();
    for (const s of assigned) {
      if (s.bot) accepted.add(s.account.id);
      const w = picked.find((p) => p.account.id === s.account.id)?.wire;
      if (w) wires.set(s.account.id, w);
    }
    const match: PendingMatch = {
      id,
      region,
      mode,
      seats: assigned,
      wires,
      accepted,
      ready: new Set(),
      offerUntil: Date.now() + MATCH_ACCEPT_MS,
      lobbyUntil: 0,
      phase: "offer",
    };
    this.pending.set(id, match);
    this.pushOffer(match);
    this.maybeLobby(match);
  }

  private launchBots(account: Account, wire: Wire, region: string, ping: number): void {
    const party = this.social.partyOf(account.id);
    const members = (party?.members ?? [account.id]).map((id) => this.store.byId(id)).filter(Boolean) as Account[];
    const seats: Seat[] = members.map((a) => ({
      account: a,
      bot: Boolean(a.contact),
      friend: a.contact || account.friends.includes(a.id),
      ping,
      partyId: party?.id ?? "solo_" + account.id,
    }));
    while (seats.length < MAX_PLAYERS_PER_ROOM) {
      seats.push(this.makeBotSeat(region, account.mmr, seats.length, account.stats.matches, "bots", seats));
    }
    const assigned = balanceTeams(seats.slice(0, MAX_PLAYERS_PER_ROOM));
    const id = "m_" + this.seq++;
    const wires = new Map<string, Wire>([[account.id, wire]]);
    for (const m of members) {
      const w = this.social.wireOf(m.id);
      if (w) wires.set(m.id, w);
    }
    const accepted = new Set(assigned.map((s) => s.account.id));
    const match: PendingMatch = {
      id,
      region,
      mode: "bots",
      seats: assigned,
      wires,
      accepted,
      ready: new Set(),
      offerUntil: 0,
      lobbyUntil: Date.now() + LOBBY_MS,
      phase: "lobby",
    };
    this.pending.set(id, match);
    this.pushLobby(match);
  }

  private maybeLobby(m: PendingMatch): void {
    const humans = m.seats.filter((s) => !s.bot);
    if (!humans.every((h) => m.accepted.has(h.account.id))) return;
    if (m.phase === "lobby") return;
    m.phase = "lobby";
    m.lobbyUntil = Date.now() + LOBBY_MS;
    this.pushLobby(m);
  }

  private failOffer(m: PendingMatch, leaver: string): void {
    const party = this.social.partyOf(leaver);
    const leaveIds = new Set(party?.members ?? [leaver]);
    for (const s of m.seats) {
      if (s.bot) continue;
      const w = m.wires.get(s.account.id);
      if (!w) continue;
      if (leaveIds.has(s.account.id)) {
        w.send({ type: MSG.MATCH_STATUS, state: "cancelled", etaMs: 0 });
      } else {
        this.queue.unshift({
          account: s.account,
          wire: w,
          bot: false,
          friend: s.friend,
          ping: s.ping,
          region: m.region,
          at: Date.now() - 2000,
          partyId: s.partyId,
          mode: m.mode,
        });
        w.send({ type: MSG.MATCH_STATUS, state: "queued", etaMs: 4000 });
      }
    }
  }

  private startMatch(m: PendingMatch): void {
    const room = this.spawnRoom(m.mode, m.region, m.seats);
    const humans = m.seats.filter((s) => !s.bot);
    const matches = humans.length ? Math.min(...humans.map((s) => s.account.stats.matches)) : 8;
    room.noteFill(matches);
    for (const s of m.seats) {
      const wire = m.wires.get(s.account.id) ?? { send() {}, close() {} };
      room.join(s.account, wire, s.team, { bot: s.bot, friend: s.friend, ping: s.ping });
      if (!s.bot) {
        this.onBindRoom(s.account.id, room);
        this.store.setLastMatch(s.account.id, room.id);
      }
    }
    room.beginMatch();
  }

  private spawnRoom(mode: string, region: string, seats: Assigned[]): Room {
    const id = `rm_${mode}_${this.seq++}`;
    const room = new Room(id, mode, region, this.store, this.flags, (r) => this.rooms.delete(r.id), (info) => {
      this.social.recordMatch(info.ids, info.cards, info.winner, info.matchId);
    });
    this.rooms.set(id, room);
    void seats;
    return room;
  }

  private makeBotSeat(
    region: string,
    mmr: number,
    i: number,
    matches: number,
    mode: string,
    taken: Seat[],
  ): Seat {
    let seed = (Date.now() ^ (i * 9973) ^ (mmr * 13) ^ (taken.length * 131)) | 0;
    let mind = mintMind(seed, i, mmr, matches, mode);
    const used = new Set(taken.map((s) => s.account.name.toLowerCase()));
    let guard = 0;
    while (used.has(mind.callsign.toLowerCase()) && guard++ < 24) {
      seed = (seed + 7919) | 0;
      mind = mintMind(seed, i, mmr, matches, mode);
    }
    const acc = {
      id: "bot_" + randomBytes(5).toString("hex"),
      name: mind.callsign,
      token: "",
      xp: 180 + i * 40,
      mmr: mmr + ((i * 17) % 80) - 40,
      currency: { soft: 0, hard: 0 },
      slots: [],
      stats: { kills: 0, deaths: 0, assists: 0, damage: 0, shots: 0, hits: 0, matches: 0, wins: 0, losses: 0 },
      friends: [],
      clanId: "",
      clanTag: "",
      character: mind.operator,
      appearance: {
        ...defaultAppearance(),
        face: (Math.abs(seed) % 6) as 0 | 1 | 2 | 3 | 4 | 5,
        hair: Math.abs(seed >> 2) % 6,
        skin: Math.abs(seed >> 4) % 6,
        eyes: Math.abs(seed >> 5) % 6,
      },
      achievements: [],
      mastery: [],
      lastMatchId: "",
      lastRegion: region,
      contact: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Account;
    return {
      account: acc,
      bot: true,
      friend: false,
      ping: 20 + (i * 7) % 40,
      partyId: "bot_" + randomBytes(2).toString("hex"),
    };
  }

  private roster(m: PendingMatch): RosterMember[] {
    return m.seats.map((s) => ({
      id: s.account.id,
      name: s.account.name,
      team: s.team,
      bot: s.bot,
      friend: s.friend,
      level: xpToLevel(s.account.xp),
      rank: rankName(s.account.mmr),
      ping: s.ping,
      character: s.account.character,
      ready: m.ready.has(s.account.id) || s.bot,
      accepted: m.accepted.has(s.account.id),
    }));
  }

  private pushOffer(m: PendingMatch): void {
    const offer: MatchOffer = {
      matchId: m.id,
      region: m.region,
      regionName: regionById(m.region).name,
      ping: median(m.seats.map((s) => s.ping)),
      acceptMs: Math.max(0, m.offerUntil - Date.now()),
      roster: this.roster(m),
    };
    for (const s of m.seats) {
      if (s.bot) continue;
      m.wires.get(s.account.id)?.send({ type: MSG.MATCH_OFFER, offer });
    }
  }

  private pushLobby(m: PendingMatch): void {
    const lobby: LobbyState = {
      matchId: m.id,
      region: m.region,
      remainMs: Math.max(0, m.lobbyUntil - Date.now()),
      roster: this.roster(m),
    };
    for (const s of m.seats) {
      if (s.bot) continue;
      m.wires.get(s.account.id)?.send({ type: MSG.LOBBY, lobby });
    }
  }

  private broadcastSearch(): void {
    const now = Date.now();
    const byRegion = new Map<string, Queued[]>();
    for (const q of this.queue) {
      const list = byRegion.get(q.region) || [];
      list.push(q);
      byRegion.set(q.region, list);
    }
    for (const [region, list] of byRegion) {
      const humans = uniqueHumans(list);
      const oldest = Math.min(...list.map((q) => q.at));
      const remain = Math.max(0, SEARCH_HUMAN_MS - (now - oldest));
      const search: SearchUpdate = {
        playersFound: Math.min(MAX_PLAYERS_PER_ROOM, humans),
        playersNeeded: MAX_PLAYERS_PER_ROOM,
        humans,
        bots: Math.max(0, MAX_PLAYERS_PER_ROOM - humans),
        etaMs: remain,
        region,
        regionName: regionById(region).name,
        ping: median(list.map((q) => q.ping)),
      };
      for (const q of list) {
        q.wire?.send({ type: MSG.SEARCH_UPDATE, search });
        q.wire?.send({ type: MSG.MATCH_STATUS, state: "queued", etaMs: remain });
      }
    }
  }
}

function uniqueHumans(pool: Queued[]): number {
  return new Set(pool.filter((q) => !q.bot).map((q) => q.account.id)).size;
}

function pickUnits(pool: Queued[], allowBots: boolean): Queued[] {
  const groups = new Map<string, Queued[]>();
  for (const q of pool) {
    const g = groups.get(q.partyId) || [];
    g.push(q);
    groups.set(q.partyId, g);
  }
  const units = [...groups.values()].sort((a, b) => scoreUnit(b) - scoreUnit(a));
  const out: Queued[] = [];
  for (const u of units) {
    const humans = u.filter((x) => !x.bot).length;
    if (!allowBots && humans === 0) continue;
    if (out.length + u.length > MAX_PLAYERS_PER_ROOM) continue;
    out.push(...u);
    if (out.filter((x) => !x.bot).length >= MAX_PLAYERS_PER_ROOM) break;
  }
  return out;
}

function scoreUnit(u: Queued[]): number {
  const humans = u.filter((x) => !x.bot).length;
  const friends = u.filter((x) => x.friend).length;
  const mmr = u.reduce((n, x) => n + x.account.mmr, 0) / u.length;
  const ping = u.reduce((n, x) => n + x.ping, 0) / u.length;
  return humans * 1000 + friends * 200 - Math.abs(mmr - 1000) * 0.2 - ping * 0.5;
}

function median(n: number[]): number {
  if (!n.length) return 0;
  const s = [...n].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export type { TeamId };
