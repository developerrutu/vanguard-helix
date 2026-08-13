import { randomBytes } from "node:crypto";
import {
  CHAT_BURST,
  CHAT_WINDOW,
  FRIEND_REQ_MAX,
  FRIEND_REQ_WINDOW,
  INVITE_BURST,
  INVITE_TTL_MS,
  INVITE_WINDOW,
  MSG,
  allowedBy,
  rankName,
  scrubChat,
  xpToLevel,
  type ChatChannel,
  type ClanRole,
  type FindHit,
  type InviteKind,
  type InvitePublic,
  type InviteWho,
  type PartyState,
  type PresenceId,
  type PrivacySettings,
  type ReportReason,
  type S2C,
  type SocialNote,
  type SocialOp,
  type SocialPack,
} from "../../../shared/src/index";
import type { Account, Store } from "../persist/store";
import type { Wire } from "../sim/room";

interface LiveInvite {
  id: string;
  kind: InviteKind;
  from: string;
  to: string;
  expires: number;
  detail: string;
  clanId?: string;
  matchId?: string;
  mode?: string;
}

interface Party {
  id: string;
  leaderId: string;
  members: string[];
  mode: string;
}

interface ChatRow {
  at: number;
  from: string;
  to: string;
  channel: ChatChannel;
  text: string;
}

export interface SocialHooks {
  queued?: (id: string) => boolean;
  matched?: (id: string) => boolean;
  team?: (id: string) => string[];
}

export class Social {
  private parties = new Map<string, Party>();
  private byPlayer = new Map<string, string>();
  private invites: LiveInvite[] = [];
  private wires = new Map<string, Wire>();
  private online = new Set<string>();
  private notes = new Map<string, SocialNote[]>();
  private bursts = new Map<string, number[]>();
  private chats: ChatRow[] = [];
  private reports: { at: number; from: string; target: string; reason: string; evidence: string }[] = [];
  hooks: SocialHooks = {};

  constructor(private store: Store) {
    setInterval(() => this.expire(), 500).unref();
  }

  bind(id: string, wire: Wire): void {
    this.wires.set(id, wire);
    this.online.add(id);
    const acc = this.store.byId(id);
    if (acc) {
      this.store.ensureContacts(acc);
      if (acc.ties.presence === "offline" || acc.ties.presence === "match" || acc.ties.presence === "queue") {
        acc.ties.presence = "online";
      }
    }
    this.ensureParty(id);
    this.pushAll(id);
  }

  unbind(id: string): void {
    this.wires.delete(id);
    this.online.delete(id);
    const p = this.partyOf(id);
    if (p) this.pushParty(p);
  }

  isOnline(id: string): boolean {
    return this.online.has(id);
  }

  wireOf(id: string): Wire | undefined {
    return this.wires.get(id);
  }

  ensureParty(id: string): Party {
    const existing = this.partyOf(id);
    if (existing) return existing;
    const party: Party = { id: "pt_" + randomBytes(4).toString("hex"), leaderId: id, members: [id], mode: "quick" };
    this.parties.set(party.id, party);
    this.byPlayer.set(id, party.id);
    return party;
  }

  partyOf(id: string): Party | undefined {
    const pid = this.byPlayer.get(id);
    return pid ? this.parties.get(pid) : undefined;
  }

  partyState(id: string): PartyState | null {
    const p = this.partyOf(id);
    if (!p) return null;
    return this.toPartyState(p);
  }

  leave(id: string): void {
    const p = this.partyOf(id);
    if (!p) return;
    p.members = p.members.filter((m) => m !== id);
    this.byPlayer.delete(id);
    if (p.leaderId === id) p.leaderId = p.members[0] ?? "";
    if (p.members.length === 0) this.parties.delete(p.id);
    else this.pushParty(p);
    this.ensureParty(id);
    this.pushAll(id);
  }

  kick(leaderId: string, targetId: string): void {
    const p = this.partyOf(leaderId);
    if (!p || p.leaderId !== leaderId) return;
    if (targetId === leaderId) return;
    if (!p.members.includes(targetId)) return;
    p.members = p.members.filter((m) => m !== targetId);
    this.byPlayer.delete(targetId);
    this.pushParty(p);
    this.ensureParty(targetId);
    this.pushAll(targetId);
  }

  setPartyMode(leaderId: string, mode: string): string | null {
    const p = this.partyOf(leaderId);
    if (!p || p.leaderId !== leaderId) return "leader only";
    if (!["quick", "ranked", "bots"].includes(mode)) return "bad mode";
    p.mode = mode;
    this.pushParty(p);
    return null;
  }

  sendInvite(from: Account, kind: InviteKind, targetId: string, extra?: { matchId?: string; mode?: string }): string | null {
    const to = this.store.byId(targetId);
    if (!to) return null;
    if (from.id === to.id) return null;
    if (from.ties.blocked.includes(to.id) || to.ties.blocked.includes(from.id)) return null;
    if (!this.allowInvite(from, to, kind)) return null;
    if (!this.rate(from.id, "inv", INVITE_BURST, INVITE_WINDOW)) return null;
    if (kind === "party") {
      const p = this.ensureParty(from.id);
      if (p.leaderId !== from.id) return null;
      if (p.members.length >= 4) return null;
    }
    if (kind === "clan" && !from.clanId) return null;
    const mode = extra?.mode || this.partyOf(from.id)?.mode || "";
    const invite: LiveInvite = {
      id: "inv_" + randomBytes(4).toString("hex"),
      kind,
      from: from.id,
      to: targetId,
      expires: Date.now() + INVITE_TTL_MS,
      detail: detailFor(kind, from, mode),
      clanId: from.clanId || undefined,
      matchId: extra?.matchId,
      mode,
    };
    this.invites.push(invite);
    this.pushInvite(invite);
    if (to.contact && (kind === "party" || kind === "match" || kind === "friend")) {
      setTimeout(() => this.respond(to.id, invite.id, true), 700).unref?.();
    }
    if (to.ties.notif.party || kind === "friend") {
      this.note(to.id, kind, invite.detail);
    }
    return invite.id;
  }

  inviteByName(from: Account, kind: InviteKind, name: string): string | null {
    const to = this.store.byCallsign(name) || this.store.byId(name.trim());
    if (!to) return null;
    return this.sendInvite(from, kind, to.id);
  }

  respond(playerId: string, inviteId: string, accept: boolean): void {
    const inv = this.invites.find((i) => i.id === inviteId && i.to === playerId);
    if (!inv) return;
    this.invites = this.invites.filter((i) => i !== inv);
    if (!accept) return;
    const from = this.store.byId(inv.from);
    const to = this.store.byId(inv.to);
    if (!from || !to) return;
    if (from.ties.blocked.includes(to.id) || to.ties.blocked.includes(from.id)) return;
    if (inv.kind === "friend") {
      this.store.addFriend(from.id, to.id);
      from.ties.outgoing = from.ties.outgoing.filter((x) => x !== to.id);
      to.ties.incoming = to.ties.incoming.filter((x) => x !== from.id);
      this.pushSocial(from.id);
      this.pushSocial(to.id);
      this.note(from.id, "friend", `${to.name} is now a contact`);
    } else if (inv.kind === "party" || inv.kind === "match") {
      this.mergeInto(from.id, to.id);
    } else if (inv.kind === "clan") {
      if (inv.clanId) this.store.joinClan(to.id, inv.clanId);
      else if (from.clanId) this.store.joinClan(to.id, from.clanId);
      this.pushSocial(to.id);
      this.pushSocial(from.id);
    }
  }

  addFriendByName(from: Account, name: string): boolean {
    const to = this.store.byCallsign(name) || this.store.byId(name.trim());
    if (!to || to.id === from.id) return false;
    return this.requestFriend(from, to.id) === null;
  }

  requestFriend(from: Account, targetId: string): string | null {
    if (!this.rate(from.id, "fr", FRIEND_REQ_MAX, FRIEND_REQ_WINDOW)) return "rate";
    const err = this.store.requestFriend(from.id, targetId);
    if (err) return err;
    const to = this.store.byId(targetId);
    if (to?.contact) this.store.acceptFriend(targetId, from.id);
    else if (to) {
      this.sendInvite(from, "friend", targetId);
      if (to.ties.notif.friend) this.note(to.id, "friend", `${from.name} sent a friend request`);
    }
    this.pushSocial(from.id);
    if (to) this.pushSocial(to.id);
    return null;
  }

  command(
    from: Account,
    msg: {
      op: string;
      targetId?: string;
      name?: string;
      text?: string;
      channel?: string;
      mode?: string;
      reason?: string;
      matchId?: string;
      role?: string;
      tag?: string;
      desc?: string;
      presence?: string;
      privacy?: Record<string, string | boolean>;
    },
  ): string | null {
    const op = msg.op as SocialOp;
    const target = msg.targetId || "";
    if (op === "search") {
      this.pushFind(from.id, msg.name || target);
      return null;
    }
    if (op === "request") {
      const id = target || this.store.byCallsign(msg.name || "")?.id || "";
      return this.requestFriend(from, id);
    }
    if (op === "accept") return this.store.acceptFriend(from.id, target) || this.refreshPair(from.id, target);
    if (op === "reject") {
      this.store.rejectFriend(from.id, target);
      return this.refreshPair(from.id, target);
    }
    if (op === "cancel") {
      this.store.cancelFriend(from.id, target);
      return this.refreshPair(from.id, target);
    }
    if (op === "remove") {
      this.store.removeFriend(from.id, target);
      return this.refreshPair(from.id, target);
    }
    if (op === "block") {
      this.store.block(from.id, target);
      const p = this.partyOf(from.id);
      if (p?.members.includes(target)) this.kick(p.leaderId === from.id ? from.id : p.leaderId, target);
      return this.refreshPair(from.id, target);
    }
    if (op === "unblock") {
      this.store.unblock(from.id, target);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "favorite") {
      this.store.setFavorite(from.id, target, true);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "unfavorite") {
      this.store.setFavorite(from.id, target, false);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "chat") return this.chat(from, (msg.channel || "party") as ChatChannel, msg.text || "", target);
    if (op === "presence") {
      const next = (msg.presence || "online") as PresenceId;
      if (!["online", "lobby", "away", "dnd", "offline"].includes(next)) return "bad presence";
      from.ties.presence = next;
      from.ties.hideOnline = next === "offline";
      this.pushSocial(from.id);
      return null;
    }
    if (op === "privacy") {
      const next: Partial<PrivacySettings> = {};
      const p = msg.privacy || {};
      if (typeof p.invites === "string") next.invites = p.invites as InviteWho;
      if (typeof p.whispers === "string") next.whispers = p.whispers as InviteWho;
      if (typeof p.showOnline === "boolean") next.showOnline = p.showOnline;
      if (typeof p.showMatch === "boolean") next.showMatch = p.showMatch;
      if (typeof p.showProfile === "boolean") next.showProfile = p.showProfile;
      if (typeof p.showStats === "boolean") next.showStats = p.showStats;
      if (typeof p.showFriends === "boolean") next.showFriends = p.showFriends;
      this.store.setPrivacy(from.id, next);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "mute") {
      if (target && !from.ties.muted.includes(target)) from.ties.muted.push(target);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "unmute") {
      from.ties.muted = from.ties.muted.filter((x) => x !== target);
      this.pushSocial(from.id);
      return null;
    }
    if (op === "clan_create") {
      const clan = this.store.createClan(from.id, msg.tag || msg.name || "", msg.name, msg.desc);
      if (!clan) return "clan failed";
      this.pushSocial(from.id);
      this.note(from.id, "clan", `Clan [${clan.tag}] ${clan.name} founded`);
      return null;
    }
    if (op === "clan_invite") {
      return this.sendInvite(from, "clan", target) ? null : "invite failed";
    }
    if (op === "clan_kick") {
      const err = this.store.clanKick(from.id, target);
      if (err) return err;
      this.pushSocial(from.id);
      this.pushSocial(target);
      return null;
    }
    if (op === "clan_role") {
      const err = this.store.clanSetRole(from.id, target, (msg.role || "member") as ClanRole);
      if (err) return err;
      this.pushSocial(from.id);
      this.pushSocial(target);
      return null;
    }
    if (op === "clan_announce") {
      const err = this.store.clanAnnounce(from.id, msg.text || "");
      if (err) return err;
      const clan = this.store.clanOf(from.id);
      if (clan) {
        for (const m of clan.members) {
          this.note(m.id, "clan", clan.announce);
          this.pushSocial(m.id);
        }
      }
      return null;
    }
    if (op === "clan_leave") {
      const err = this.store.leaveClan(from.id);
      if (err) return err;
      this.pushSocial(from.id);
      return null;
    }
    if (op === "party_mode") return this.setPartyMode(from.id, msg.mode || "quick");
    if (op === "report") return this.report(from, target, msg.reason || "other", msg.matchId || "");
    return "unknown";
  }

  packOf(id: string): SocialPack | null {
    const a = this.store.byId(id);
    if (!a) return null;
    const friends = this.store
      .friendsOf(id)
      .map((f) => this.friendView(a, f))
      .sort((x, y) => Number(y.favorite) - Number(x.favorite) || Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
    const named = (ids: string[]) =>
      ids
        .map((fid) => {
          const f = this.store.byId(fid);
          return f ? { id: f.id, name: f.name } : null;
        })
        .filter((x): x is { id: string; name: string } => Boolean(x));
    const clan = this.store.clanOf(id);
    return {
      friends,
      incoming: named(a.ties.incoming),
      outgoing: named(a.ties.outgoing),
      blocked: named(a.ties.blocked),
      recent: a.ties.recent.map((r) => ({ id: r.id, name: r.name, matchId: r.matchId, team: r.team, result: r.result })),
      suggest: this.recs(a),
      clan: clan
        ? {
            id: clan.id,
            tag: clan.tag,
            name: clan.name,
            logo: clan.logo,
            desc: clan.desc,
            level: clan.level,
            announce: clan.announce,
            role: this.store.clanRole(clan, id) || "member",
            members: clan.members.map((m) => {
              const acc = this.store.byId(m.id);
              return {
                id: m.id,
                name: acc?.name ?? m.id,
                role: m.role,
                online: this.online.has(m.id),
              };
            }),
          }
        : null,
      privacy: { ...a.ties.privacy },
      presence: this.realPresence(id),
      notes: (this.notes.get(id) || []).slice(-8),
    };
  }

  findHits(viewer: Account, q: string): FindHit[] {
    return this.store.findPlayers(q, viewer.id).map((a) => this.hitOf(viewer, a));
  }

  clanBoard(): { id: string; tag: string; name: string; level: number; members: number; rating: number; wins: number }[] {
    return this.store
      .clanList()
      .map((c) => {
        const accs = c.members.map((m) => this.store.byId(m.id)).filter(Boolean) as Account[];
        const rating = accs.length ? Math.round(accs.reduce((n, a) => n + a.mmr, 0) / accs.length) : 0;
        const wins = accs.reduce((n, a) => n + a.stats.wins, 0);
        return { id: c.id, tag: c.tag, name: c.name, level: c.level, members: c.members.length, rating, wins };
      })
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      .slice(0, 40);
  }

  recordMatch(ids: string[], cards: { id: string; name: string; team: string }[], winner: string, matchId: string): void {
    for (const id of ids) {
      const me = cards.find((c) => c.id === id);
      if (!me) continue;
      const won = winner !== "none" && me.team === winner;
      for (const o of cards) {
        if (o.id === id) continue;
        this.store.addRecent(id, {
          id: o.id,
          name: o.name,
          matchId,
          team: o.team === me.team ? "ally" : "foe",
          result: won ? "win" : "loss",
          at: Date.now(),
        });
      }
      this.store.addContrib(id, won ? 4 : 1);
      this.pushSocial(id);
    }
  }

  reportsOf(limit = 20): typeof this.reports {
    return this.reports.slice(-limit);
  }

  private report(from: Account, targetId: string, reason: string, matchId: string): string | null {
    const target = this.store.byId(targetId);
    if (!target) return "missing";
    if (!this.rate(from.id, "rep", 4, 600_000)) return "rate";
    const ok: ReportReason[] = ["cheat", "harass", "hate", "language", "grief", "exploit", "name", "clan", "spam", "other"];
    const why = (ok.includes(reason as ReportReason) ? reason : "other") as ReportReason;
    const chat = this.chats
      .filter((c) => c.from === targetId || c.to === targetId)
      .slice(-8)
      .map((c) => `${c.channel}:${c.text}`)
      .join(" | ");
    const evidence = [
      `reporter=${from.id}`,
      `target=${target.id}`,
      `match=${matchId || from.lastMatchId || "-"}`,
      `t=${new Date().toISOString()}`,
      `reason=${why}`,
      `chat=${chat || "none"}`,
    ].join(" ");
    this.reports.push({ at: Date.now(), from: from.id, target: target.id, reason: why, evidence });
    this.note(from.id, "report", `Report filed on ${target.name}`);
    return null;
  }

  private chat(from: Account, channel: ChatChannel, raw: string, targetId: string): string | null {
    if (this.store.isMuted(from)) return "muted";
    if (!this.rate(from.id, "chat", CHAT_BURST, CHAT_WINDOW)) return "flood";
    const scrubbed = scrubChat(raw);
    if (!scrubbed.text) return "empty";
    const row: ChatRow = { at: Date.now(), from: from.id, to: targetId, channel, text: scrubbed.text };
    this.chats.push(row);
    if (this.chats.length > 400) this.chats.shift();
    const msg: S2C = {
      type: MSG.CHAT,
      from: from.name,
      fromId: from.id,
      text: scrubbed.text,
      team: channel === "team",
      channel,
    };
    const send = (id: string) => {
      const acc = this.store.byId(id);
      if (!acc) return;
      if (acc.ties.blocked.includes(from.id) || from.ties.blocked.includes(id)) return;
      if (acc.ties.muted.includes(from.id)) return;
      this.wires.get(id)?.send(msg);
    };
    if (channel === "whisper") {
      const to = this.store.byId(targetId);
      if (!to) return "missing";
      if (!this.allowWhisper(from, to)) return "privacy";
      send(from.id);
      send(to.id);
      return null;
    }
    if (channel === "party") {
      const p = this.partyOf(from.id);
      for (const m of p?.members ?? [from.id]) send(m);
      return null;
    }
    if (channel === "clan") {
      const clan = this.store.clanOf(from.id);
      if (!clan) return "no clan";
      for (const m of clan.members) send(m.id);
      return null;
    }
    if (channel === "team") {
      const mates = this.hooks.team?.(from.id) ?? [from.id];
      for (const m of mates) send(m);
      return null;
    }
    for (const id of this.online) send(id);
    return null;
  }

  private recs(viewer: Account): FindHit[] {
    const seen = new Set<string>([viewer.id, ...viewer.friends, ...viewer.ties.blocked]);
    const out: FindHit[] = [];
    const push = (a: Account | undefined) => {
      if (!a || seen.has(a.id) || a.contact) return;
      seen.add(a.id);
      out.push(this.hitOf(viewer, a));
    };
    for (const r of viewer.ties.recent) push(this.store.byId(r.id));
    const clan = this.store.clanOf(viewer.id);
    if (clan) for (const m of clan.members) push(this.store.byId(m.id));
    for (const a of this.store.allAccounts()) {
      if (out.length >= 8) break;
      if (a.contact || seen.has(a.id)) continue;
      if (Math.abs(a.mmr - viewer.mmr) < 180 || a.character === viewer.character) push(a);
    }
    return out.slice(0, 8);
  }

  private hitOf(viewer: Account, a: Account): FindHit {
    return {
      id: a.id,
      name: a.name,
      level: xpToLevel(a.xp),
      rank: rankName(a.mmr),
      character: a.character,
      online: this.visibleOnline(viewer, a),
      presence: this.presenceFor(viewer, a),
    };
  }

  private friendView(viewer: Account, f: Account) {
    const presence = this.presenceFor(viewer, f);
    return {
      id: f.id,
      name: f.name,
      online: this.visibleOnline(viewer, f),
      bot: f.contact,
      level: xpToLevel(f.xp),
      rank: rankName(f.mmr),
      presence,
      activity: this.activityOf(f.id, presence),
      favorite: viewer.ties.favorites.includes(f.id),
      character: f.character,
    };
  }

  private activityOf(id: string, presence: string): string {
    if (presence === "match") return "IN MATCH";
    if (presence === "queue") return "QUEUING";
    if (presence === "lobby") return "LOBBY";
    if (presence === "away") return "AWAY";
    if (presence === "dnd") return "DND";
    if (presence === "online" || this.online.has(id)) return "AVAILABLE";
    void id;
    return "OFFLINE";
  }

  private realPresence(id: string): PresenceId {
    const a = this.store.byId(id);
    if (a?.contact) return "online";
    if (!this.online.has(id)) return "offline";
    if (this.hooks.matched?.(id)) return "match";
    if (this.hooks.queued?.(id)) return "queue";
    if (a?.ties.presence === "away" || a?.ties.presence === "dnd" || a?.ties.presence === "lobby") return a.ties.presence;
    return "online";
  }

  private presenceFor(viewer: Account, target: Account): PresenceId {
    if (viewer.id === target.id) return this.realPresence(target.id);
    if (target.ties.blocked.includes(viewer.id) || viewer.ties.blocked.includes(target.id)) return "offline";
    if (target.ties.hideOnline || !target.ties.privacy.showOnline) return "offline";
    const real = this.realPresence(target.id);
    if (real === "match" && !target.ties.privacy.showMatch) return "online";
    return real;
  }

  private visibleOnline(viewer: Account, target: Account): boolean {
    const p = this.presenceFor(viewer, target);
    return p !== "offline";
  }

  private allowInvite(from: Account, to: Account, kind: InviteKind): boolean {
    if (kind === "friend") return !to.ties.blocked.includes(from.id);
    const rel = { friend: from.friends.includes(to.id) || to.friends.includes(from.id), clan: Boolean(from.clanId && from.clanId === to.clanId) };
    return allowedBy(to.ties.privacy.invites, rel);
  }

  private allowWhisper(from: Account, to: Account): boolean {
    if (to.ties.blocked.includes(from.id) || from.ties.blocked.includes(to.id)) return false;
    const rel = { friend: from.friends.includes(to.id), clan: Boolean(from.clanId && from.clanId === to.clanId) };
    return allowedBy(to.ties.privacy.whispers, rel);
  }

  private mergeInto(leaderId: string, joinerId: string): void {
    const dest = this.ensureParty(leaderId);
    if (dest.members.length >= 4) return;
    const src = this.partyOf(joinerId);
    if (src && src.id !== dest.id) {
      src.members = src.members.filter((m) => m !== joinerId);
      if (src.leaderId === joinerId) src.leaderId = src.members[0] ?? "";
      if (src.members.length === 0) this.parties.delete(src.id);
      else this.pushParty(src);
    }
    if (!dest.members.includes(joinerId)) dest.members.push(joinerId);
    this.byPlayer.set(joinerId, dest.id);
    this.pushParty(dest);
  }

  pushAll(id: string): void {
    this.pushParty(this.ensureParty(id));
    this.pushSocial(id);
  }

  pushParty(p: Party): void {
    const state = this.toPartyState(p);
    const msg: S2C = { type: MSG.PARTY, party: state };
    for (const mid of p.members) this.wires.get(mid)?.send(msg);
  }

  pushSocial(id: string): void {
    const a = this.store.byId(id);
    if (!a) return;
    const pack = this.packOf(id);
    if (!pack) return;
    this.wires.get(id)?.send({ type: MSG.SOCIAL, friends: pack.friends, clanTag: a.clanTag });
    this.wires.get(id)?.send({ type: MSG.SOCIAL_PACK, pack });
  }

  private pushFind(id: string, q: string): void {
    const a = this.store.byId(id);
    if (!a) return;
    this.wires.get(id)?.send({ type: MSG.FIND, hits: this.findHits(a, q) });
  }

  private pushInvite(inv: LiveInvite): void {
    const from = this.store.byId(inv.from);
    const payload: InvitePublic = {
      id: inv.id,
      kind: inv.kind,
      fromId: inv.from,
      fromName: from?.name ?? "OP",
      expiresIn: Math.max(0, inv.expires - Date.now()),
      detail: inv.detail,
      mode: inv.mode,
    };
    this.wires.get(inv.to)?.send({ type: MSG.INVITE, invite: payload });
  }

  private toPartyState(p: Party): PartyState {
    return {
      id: p.id,
      leaderId: p.leaderId,
      mode: p.mode,
      members: p.members.map((mid) => {
        const a = this.store.byId(mid);
        return {
          id: mid,
          name: a?.name ?? "OP",
          leader: mid === p.leaderId,
          bot: Boolean(a?.contact),
          online: this.online.has(mid) || Boolean(a?.contact),
          level: a ? xpToLevel(a.xp) : 1,
          rank: a ? rankName(a.mmr) : "BRONZE",
          character: a?.character ?? "VANGUARD",
          presence: a ? this.realPresence(mid) : "offline",
        };
      }),
    };
  }

  private note(id: string, kind: string, text: string): void {
    const acc = this.store.byId(id);
    if (acc) {
      if (kind === "friend" && !acc.ties.notif.friend) return;
      if (kind === "party" && !acc.ties.notif.party) return;
      if (kind === "clan" && !acc.ties.notif.clan) return;
    }
    const note: SocialNote = { id: "nt_" + randomBytes(3).toString("hex"), kind, text, at: Date.now() };
    const list = this.notes.get(id) || [];
    list.push(note);
    this.notes.set(id, list.slice(-16));
    this.wires.get(id)?.send({ type: MSG.SOCIAL_NOTE, note });
  }

  private refreshPair(a: string, b: string): null {
    this.pushSocial(a);
    if (b) this.pushSocial(b);
    return null;
  }

  private rate(id: string, key: string, max: number, window: number): boolean {
    const now = Date.now();
    const k = id + ":" + key;
    const list = (this.bursts.get(k) || []).filter((t) => now - t < window);
    if (list.length >= max) {
      this.bursts.set(k, list);
      return false;
    }
    list.push(now);
    this.bursts.set(k, list);
    return true;
  }

  private expire(): void {
    const now = Date.now();
    this.invites = this.invites.filter((i) => i.expires > now);
  }
}

function detailFor(kind: InviteKind, from: Account, mode: string): string {
  const who = `${from.name} [${from.id}]`;
  if (kind === "friend") return `${who} wants to add you`;
  if (kind === "party") return `${who} invited you to a ${mode || "squad"}`;
  if (kind === "clan") return `${who} invited you to [${from.clanTag || "CLAN"}]`;
  return `${who} invited you to a match${mode ? " · " + mode : ""}`;
}
