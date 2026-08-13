/** Part 9 — social contracts. Client never writes relationships. */

export const CLAN_CAP = 50;
export const FRIEND_REQ_MAX = 8;
export const FRIEND_REQ_WINDOW = 60_000;
export const CHAT_BURST = 5;
export const CHAT_WINDOW = 8_000;
export const INVITE_BURST = 4;
export const INVITE_WINDOW = 20_000;

export type PresenceId = "online" | "queue" | "lobby" | "match" | "away" | "dnd" | "offline";
export type InviteWho = "anyone" | "friends" | "clan" | "nobody";
export type ClanRole = "leader" | "colead" | "officer" | "member";
export type ChatChannel = "global" | "team" | "party" | "clan" | "whisper";
export type ReportReason =
  | "cheat"
  | "harass"
  | "hate"
  | "language"
  | "grief"
  | "exploit"
  | "name"
  | "clan"
  | "spam"
  | "other";

export type SocialOp =
  | "search"
  | "request"
  | "accept"
  | "reject"
  | "cancel"
  | "remove"
  | "block"
  | "unblock"
  | "favorite"
  | "unfavorite"
  | "chat"
  | "presence"
  | "privacy"
  | "mute"
  | "unmute"
  | "clan_create"
  | "clan_invite"
  | "clan_kick"
  | "clan_role"
  | "clan_announce"
  | "clan_leave"
  | "party_mode"
  | "report";

export interface PrivacySettings {
  invites: InviteWho;
  whispers: InviteWho;
  showOnline: boolean;
  showMatch: boolean;
  showProfile: boolean;
  showStats: boolean;
  showFriends: boolean;
}

export interface NotifPrefs {
  friend: boolean;
  party: boolean;
  clan: boolean;
  match: boolean;
  achieve: boolean;
}

export interface RecentPlayer {
  id: string;
  name: string;
  matchId: string;
  team: string;
  result: string;
  at: number;
}

export interface Ties {
  blocked: string[];
  incoming: string[];
  outgoing: string[];
  favorites: string[];
  muted: string[];
  recent: RecentPlayer[];
  privacy: PrivacySettings;
  presence: PresenceId;
  hideOnline: boolean;
  notif: NotifPrefs;
}

export interface ClanMember {
  id: string;
  role: ClanRole;
  contrib: number;
}

export interface ClanPublic {
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
  rating: number;
  wins: number;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  invites: "friends",
  whispers: "friends",
  showOnline: true,
  showMatch: true,
  showProfile: true,
  showStats: true,
  showFriends: false,
};

export const DEFAULT_NOTIF: NotifPrefs = {
  friend: true,
  party: true,
  clan: true,
  match: true,
  achieve: true,
};

export function emptyTies(): Ties {
  return {
    blocked: [],
    incoming: [],
    outgoing: [],
    favorites: [],
    muted: [],
    recent: [],
    privacy: { ...DEFAULT_PRIVACY },
    presence: "online",
    hideOnline: false,
    notif: { ...DEFAULT_NOTIF },
  };
}

export function mergeTies(raw: Partial<Ties> | undefined): Ties {
  const b = emptyTies();
  if (!raw) return b;
  return {
    blocked: raw.blocked ?? [],
    incoming: raw.incoming ?? [],
    outgoing: raw.outgoing ?? [],
    favorites: raw.favorites ?? [],
    muted: raw.muted ?? [],
    recent: raw.recent ?? [],
    privacy: { ...DEFAULT_PRIVACY, ...(raw.privacy || {}) },
    presence: raw.presence || "online",
    hideOnline: Boolean(raw.hideOnline),
    notif: { ...DEFAULT_NOTIF, ...(raw.notif || {}) },
  };
}

const BAD = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "rape", "kys", "nazi",
  "puta", "mierda", "joder", "concha",
  "merde", "putain",
  "scheisse", "arschloch",
  "chutiya", "madarchod", "bhenchod", "harami",
];

export function scrubChat(raw: string): { text: string; flagged: boolean } {
  let text = (raw || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 160);
  if (!text) return { text: "", flagged: false };
  const lower = text.toLowerCase().replace(/[@4]/g, "a").replace(/1/g, "i").replace(/0/g, "o").replace(/\$/g, "s");
  let flagged = false;
  for (const w of BAD) {
    if (lower.includes(w)) {
      flagged = true;
      const re = new RegExp(w.split("").join("\\W*"), "ig");
      text = text.replace(re, "•••");
    }
  }
  return { text, flagged };
}

export function clanTagOk(tag: string): string | null {
  const clean = tag.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4);
  if (clean.length < 2) return null;
  const low = clean.toLowerCase();
  if (BAD.some((w) => low.includes(w))) return null;
  return clean;
}

export function clanNameOk(name: string): string | null {
  const clean = (name || "").replace(/[^\w \-]/g, "").trim().slice(0, 24);
  if (clean.length < 3) return null;
  const low = clean.toLowerCase();
  if (BAD.some((w) => low.includes(w))) return null;
  return clean;
}

export function allowedBy(who: InviteWho, rel: { friend: boolean; clan: boolean }): boolean {
  if (who === "anyone") return true;
  if (who === "nobody") return false;
  if (who === "friends") return rel.friend;
  return rel.clan;
}

export function roleRank(role: ClanRole): number {
  if (role === "leader") return 4;
  if (role === "colead") return 3;
  if (role === "officer") return 2;
  return 1;
}

export function socialPublic() {
  return {
    rule: "All friend, clan, invite, block, and report writes are server-authorized. Search by permanent id is canonical. Default privacy is friends-only invites and hidden friend lists.",
    clanCap: CLAN_CAP,
    presence: ["online", "queue", "lobby", "match", "away", "dnd", "offline"],
    invites: ["anyone", "friends", "clan", "nobody"],
    roles: ["leader", "colead", "officer", "member"],
    chat: ["global", "team", "party", "clan", "whisper"],
    voice: "Team/party speaking flag + per-player mute. No proximity — team comms stay clear.",
  };
}
