import type { InviteKind, MatchMode, MatchPhase, MSG, PingKind, QuickCode, TeamId } from "./constants";
import type { InvSlot, Rarity } from "./catalog";
import type { ZonePublic } from "./zone";
import type { Appearance, BodyType, EmoteId, Loco } from "./operators";
import type { Stance } from "./move";
import type { Surface, WeatherId } from "./world";

export type MsgType = (typeof MSG)[keyof typeof MSG];

export interface InputPayload {
  seq: number;
  dt: number;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  buttons: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  health: number;
  armor: number;
  alive: boolean;
  dummy: boolean;
  bot: boolean;
  team: TeamId;
  ammo: number;
  ammoMax: number;
  reserves: number;
  reloading: boolean;
  grenades: number;
  character: string;
  ping: number;
  level: number;
  rank: string;
  downed: boolean;
  eliminated: boolean;
  armorLevel: number;
  armorDura: number;
  weaponId: string;
  weaponName: string;
  slot: InvSlot;
  reviving: boolean;
  speaking: boolean;
  ads: boolean;
  fireMode: string;
  flash: number;
  opticFov: number;
  stance: Stance;
  loco: Loco;
  bodyType: BodyType;
  appearance: Appearance;
  emote: EmoteId | "";
}

export interface PickupPublic {
  id: string;
  kind: string;
  x: number;
  z: number;
  live: boolean;
  rarity?: Rarity;
  label?: string;
}

export interface PingPublic {
  id: string;
  from: string;
  name: string;
  kind: PingKind;
  x: number;
  y: number;
  z: number;
  until: number;
}

export interface LoadoutPublic {
  primary: string | null;
  secondary: string;
  melee: string;
  grenade: { id: string; qty: number } | null;
  medical: { id: string; qty: number } | null;
  utility: { id: string; qty: number } | null;
  active: "primary" | "secondary" | "melee";
}

export interface Snapshot {
  tick: number;
  ack: number;
  t: number;
  you: PlayerPublic;
  others: PlayerPublic[];
  pickups: PickupPublic[];
  scoreA: number;
  scoreB: number;
  timeLeft: number;
  phase: "warmup" | "live" | "ended";
  matchPhase: MatchPhase;
  zone: ZonePublic | null;
  pings: PingPublic[];
  loadout: LoadoutPublic;
  mapName: string;
  mapId: string;
  weather: WeatherId | "";
  matchNumber: number;
  downedLeft: number;
  reviveProg: number;
  smokes: { x: number; z: number; r: number }[];
  doors: { id: string; open: boolean }[];
  broken: string[];
  rubble: string[];
}

export interface InventorySlot {
  itemId: string;
  qty: number;
}

export interface CurrencyState {
  soft: number;
  hard: number;
}

export interface CareerStats {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  shots: number;
  hits: number;
  matches: number;
  wins: number;
  losses: number;
  revives?: number;
}

export interface SeasonPublic {
  id: number;
  name: string;
  rating: number;
  rd: number;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  peak: number;
  kd: number;
}

export interface ChallengePublic {
  id: string;
  name: string;
  kind: string;
  progress: number;
  goal: number;
  done: boolean;
  xp: number;
}

export interface ProfileState {
  id: string;
  name: string;
  xp: number;
  level: number;
  mmr: number;
  rank: string;
  clanTag: string;
  character: string;
  stats: CareerStats;
  appearance: Appearance;
  achievements: string[];
  mastery: { id: string; xp: number }[];
  prestige?: number;
  title?: string;
  badges?: string[];
  shown?: string[];
  playtimeSec?: number;
  createdAt?: number;
  placing?: { done: number; total: number } | null;
  season?: SeasonPublic;
  streaks?: {
    win: number;
    mvp: number;
    elim: number;
    bestWin: number;
    bestMvp: number;
    bestElim: number;
  };
  challenges?: ChallengePublic[];
  welcome?: { days: number; season: string; version: string } | null;
  favoriteWeapons?: { id: string; xp: number; level: number }[];
  favoriteMaps?: { id: string; matches: number; wins: number }[];
  accuracy?: number;
  kd?: number;
  winRate?: number;
  country?: string;
  claimed?: boolean;
  sanction?: string;
}

export interface RosterMember {
  id: string;
  name: string;
  team: TeamId;
  bot: boolean;
  friend: boolean;
  level: number;
  rank: string;
  ping: number;
  character: string;
  ready: boolean;
  accepted: boolean;
}

export interface PartyMember {
  id: string;
  name: string;
  leader: boolean;
  bot: boolean;
  online: boolean;
  level: number;
  rank: string;
  character: string;
  presence?: string;
}

export interface PartyState {
  id: string;
  leaderId: string;
  members: PartyMember[];
  mode?: string;
}

export interface FriendPublic {
  id: string;
  name: string;
  online: boolean;
  bot: boolean;
  level: number;
  rank: string;
  presence?: string;
  activity?: string;
  favorite?: boolean;
  character?: string;
}

export interface InvitePublic {
  id: string;
  kind: InviteKind;
  fromId: string;
  fromName: string;
  expiresIn: number;
  detail: string;
  mode?: string;
}

export interface FindHit {
  id: string;
  name: string;
  level: number;
  rank: string;
  character: string;
  online: boolean;
  presence: string;
}

export interface SocialNote {
  id: string;
  kind: string;
  text: string;
  at: number;
}

export interface SocialPack {
  friends: FriendPublic[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
  blocked: { id: string; name: string }[];
  recent: { id: string; name: string; matchId: string; team: string; result: string }[];
  suggest: FindHit[];
  clan: {
    id: string;
    tag: string;
    name: string;
    logo: string;
    desc: string;
    level: number;
    announce: string;
    role: string;
    members: { id: string; name: string; role: string; online: boolean }[];
  } | null;
  privacy: {
    invites: string;
    whispers: string;
    showOnline: boolean;
    showMatch: boolean;
    showProfile: boolean;
    showStats: boolean;
    showFriends: boolean;
  };
  presence: string;
  notes: SocialNote[];
}

export interface SearchUpdate {
  playersFound: number;
  playersNeeded: number;
  humans: number;
  bots: number;
  etaMs: number;
  region: string;
  regionName: string;
  ping: number;
  band?: number;
  alt?: "quick" | "bots" | "";
  note?: string;
  mode?: string;
}

export interface MatchOffer {
  matchId: string;
  region: string;
  regionName: string;
  ping: number;
  acceptMs: number;
  roster: RosterMember[];
}

export interface LobbyState {
  matchId: string;
  region: string;
  remainMs: number;
  roster: RosterMember[];
}

export interface CombatCard {
  id: string;
  name: string;
  team: TeamId;
  bot: boolean;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  accuracy: number;
  mvp: boolean;
  revives: number;
  survival: number;
}

export interface MatchResult {
  matchId: string;
  winner: TeamId;
  durationSec: number;
  scoreA: number;
  scoreB: number;
  mvpId: string;
  mvpName: string;
  cards: CombatCard[];
  rewards: {
    xp: number;
    soft: number;
    mmrDelta: number;
    placing?: boolean;
    afk?: boolean;
    challenges?: string[];
    title?: string;
  };
  mapName: string;
  matchNumber: number;
  reason: "wipe" | "circle" | "time";
  weather?: string;
}

export type GameEvent =
  | { kind: "hit"; src: string; dst: string; dmg: number; x: number; y: number; z: number }
  | { kind: "kill"; src: string; dst: string }
  | { kind: "spawn"; id: string; x: number; z: number }
  | { kind: "pickup"; id: string; playerId: string; itemId: string }
  | { kind: "heal"; id: string; amount: number }
  | { kind: "announce"; text: string }
  | { kind: "reload"; id: string }
  | { kind: "nade"; x: number; y: number; z: number }
  | { kind: "assist"; src: string; dst: string }
  | { kind: "down"; src: string; dst: string }
  | { kind: "revive"; src: string; dst: string }
  | { kind: "elim"; src: string; dst: string; weapon: string; dist: number; dmg: number }
  | { kind: "wipe"; team: TeamId }
  | { kind: "chat"; from: string; team: TeamId; text: string }
  | { kind: "ping"; from: string; pingKind: PingKind; x: number; z: number }
  | { kind: "step"; id: string; loud: boolean; surface?: Surface }
  | { kind: "emote"; id: string; emote: EmoteId }
  | { kind: "fall"; id: string; dmg: number }
  | { kind: "door"; id: string; open: boolean }
  | { kind: "glass"; id: string }
  | { kind: "break"; key: string };

export type C2S =
  | {
      type: typeof MSG.HELLO;
      protocol: number;
      name: string;
      token: string;
      device?: string;
      region?: string;
      reconnectMatch?: string;
    }
  | { type: typeof MSG.INPUT; input: InputPayload }
  | { type: typeof MSG.PING; t: number; rtt?: number }
  | { type: typeof MSG.MATCHMAKE; mode: MatchMode }
  | { type: typeof MSG.CANCEL_SEARCH }
  | { type: typeof MSG.MATCH_ACCEPT; matchId: string }
  | { type: typeof MSG.MATCH_DECLINE; matchId: string }
  | { type: typeof MSG.LOBBY_READY; matchId: string }
  | { type: typeof MSG.SELECT_CHARACTER; character: string }
  | { type: typeof MSG.PARTY_LEAVE }
  | { type: typeof MSG.PARTY_KICK; playerId: string }
  | { type: typeof MSG.INVITE_SEND; kind: InviteKind; targetId: string }
  | { type: typeof MSG.INVITE_RESPOND; inviteId: string; accept: boolean }
  | { type: typeof MSG.FRIEND_ADD; name: string }
  | { type: typeof MSG.RECONNECT; matchId: string }
  | { type: typeof MSG.USE_ITEM; itemId: string; requestId: number }
  | { type: typeof MSG.BUY; sku: string; requestId: number }
  | { type: typeof MSG.WORLD_PING; kind: PingKind }
  | { type: typeof MSG.QUICK_CHAT; code: QuickCode }
  | { type: typeof MSG.SWAP_SLOT; slot: "primary" | "secondary" | "melee" }
  | { type: typeof MSG.REPORT; targetId: string; reason: string }
  | { type: typeof MSG.VOICE; speaking: boolean }
  | { type: typeof MSG.COSMETIC; appearance: Appearance; character: string }
  | { type: typeof MSG.EMOTE; emote: EmoteId }
  | { type: typeof MSG.PROGRESS; title?: string; shown?: string[]; prestige?: boolean }
  | {
      type: typeof MSG.SOCIAL_CMD;
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
    };

export type S2C =
  | { type: typeof MSG.WELCOME; playerId: string; serverTime: number; tickHz: number; room: string; region: string }
  | { type: typeof MSG.SNAPSHOT; snap: Snapshot }
  | { type: typeof MSG.EVENT; tick: number; events: GameEvent[] }
  | { type: typeof MSG.PONG; t: number; serverTime: number }
  | { type: typeof MSG.MATCH_STATUS; state: "queued" | "found" | "cancelled"; etaMs: number }
  | { type: typeof MSG.SEARCH_UPDATE; search: SearchUpdate }
  | { type: typeof MSG.MATCH_OFFER; offer: MatchOffer }
  | { type: typeof MSG.LOBBY; lobby: LobbyState }
  | { type: typeof MSG.MATCH_START; room: string; mode: string }
  | { type: typeof MSG.MATCH_END; result: MatchResult }
  | { type: typeof MSG.PARTY; party: PartyState }
  | { type: typeof MSG.INVITE; invite: InvitePublic }
  | { type: typeof MSG.SOCIAL; friends: FriendPublic[]; clanTag: string }
  | { type: typeof MSG.INVENTORY; slots: InventorySlot[] }
  | { type: typeof MSG.CURRENCY; currency: CurrencyState }
  | { type: typeof MSG.PROFILE; profile: ProfileState }
  | { type: typeof MSG.ERROR; code: string; message: string }
  | {
      type: typeof MSG.INTRO;
      mapName: string;
      mapId: string;
      weather: string;
      matchNumber: number;
      duration: number;
      alpha: { name: string; rank: string; character: string }[];
      bravo: { name: string; rank: string; character: string }[];
    }
  | { type: typeof MSG.CHAT; from: string; text: string; team: boolean; channel?: string; fromId?: string }
  | { type: typeof MSG.SOCIAL_PACK; pack: SocialPack }
  | { type: typeof MSG.SOCIAL_NOTE; note: SocialNote }
  | { type: typeof MSG.FIND; hits: FindHit[] };
