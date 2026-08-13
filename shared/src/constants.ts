export const PROTOCOL_VERSION = 15;
export const GAME_TITLE = "VANGUARD";
export const ENGINE_NAME = "HELIX";
export const ENGINE_VERSION = "15.0.0";

export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;
export const INPUT_HZ = 30;

export const MAX_PLAYERS_PER_ROOM = 8;
export const TEAM_SIZE = 4;
export const SEARCH_HUMAN_MS = 8000;
export const MATCH_ACCEPT_MS = 10_000;
export const LOBBY_MS = 30_000;
export const INVITE_TTL_MS = 60_000;
export const RECONNECT_MS = 5 * 60_000;
export const MATCH_JOIN_BUDGET_MS = 5000;

export const ARENA_HALF = 22;
export const ARENA_WALL = 1.2;
export const PLAYER_RADIUS = 0.45;
export const PLAYER_HEIGHT = 1.7;

export const WALK_SPEED = 6.2;
export const SPRINT_SPEED = 9.0;
export const MAX_ACCEL = 48;
export const MAX_TURN_RATE = 14;
export const GRAVITY = 22;
export const JUMP_SPEED = 7.4;
export const GROUND_Y = 0;

export const MAX_HEALTH = 100;
export const MAX_ARMOR = 50;

export const FIRE_INTERVAL = 0.16;
export const HITSCAN_RANGE = 48;
export const HITSCAN_DAMAGE = 18;
export const HITSCAN_SPREAD = 0.008;

export const MAG_SIZE = 24;
export const AMMO_RESERVE = 72;
export const RELOAD_TIME = 1.55;
export const GRENADE_MAX = 2;
export const GRENADE_FUSE = 1.55;
export const GRENADE_RADIUS = 5.2;
export const GRENADE_DAMAGE = 78;
export const GRENADE_SPEED = 16;

export const PICKUP_RADIUS = 1.35;
export const DUMMY_ID = "dummy-01";
export const DUMMY_STRAFE_ID = "dummy-02";
export const DUMMY_RESPAWN = 3.2;
export const PLAYER_RESPAWN = 4.0;

export const INTRO_SEC = 8;
export const LOADING_SEC = 3;
export const DOWNED_TIME = 22;
export const REVIVE_TIME = 7.2;
export const BLEED_DPS = 1.6;
export const CRAWL_SCALE = 0.22;
export const FINISH_MELEE = 34;
export const MATCH_SERIAL_START = 2401;

export const STARTING_SOFT = 100;
export const KILL_REWARD = 25;
export const HIT_XP = 4;
export const KILL_XP = 40;

export const RANKED_SCORE_WIN = 20;
export const RANKED_TIME_SEC = 240;
export const LAG_COMP_MAX_MS = 150;
export const ASSIST_WINDOW = 4.0;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export const BTN = {
  JUMP: 1 << 0,
  FIRE: 1 << 1,
  AIM: 1 << 2,
  RELOAD: 1 << 3,
  SPRINT: 1 << 4,
  INTERACT: 1 << 5,
  USE: 1 << 6,
  GRENADE: 1 << 7,
  PING: 1 << 8,
  SLOT1: 1 << 9,
  SLOT2: 1 << 10,
  SLOT3: 1 << 11,
  MODE: 1 << 12,
  CYCLE_NADE: 1 << 13,
  CROUCH: 1 << 14,
  PRONE: 1 << 15,
  EMOTE: 1 << 16,
} as const;

export const MSG = {
  HELLO: "hello",
  WELCOME: "welcome",
  INPUT: "input",
  SNAPSHOT: "snapshot",
  EVENT: "event",
  PING: "ping",
  PONG: "pong",
  MATCHMAKE: "matchmake",
  MATCH_STATUS: "match_status",
  MATCH_START: "match_start",
  SEARCH_UPDATE: "search_update",
  MATCH_OFFER: "match_offer",
  MATCH_ACCEPT: "match_accept",
  MATCH_DECLINE: "match_decline",
  CANCEL_SEARCH: "cancel_search",
  LOBBY: "lobby",
  LOBBY_READY: "lobby_ready",
  SELECT_CHARACTER: "select_character",
  MATCH_END: "match_end",
  PARTY: "party",
  PARTY_LEAVE: "party_leave",
  PARTY_KICK: "party_kick",
  INVITE_SEND: "invite_send",
  INVITE: "invite",
  INVITE_RESPOND: "invite_respond",
  SOCIAL: "social",
  FRIEND_ADD: "friend_add",
  RECONNECT: "reconnect",
  USE_ITEM: "use_item",
  BUY: "buy",
  INVENTORY: "inventory",
  CURRENCY: "currency",
  PROFILE: "profile",
  ERROR: "error",
  WORLD_PING: "world_ping",
  QUICK_CHAT: "quick_chat",
  SWAP_SLOT: "swap_slot",
  REPORT: "report",
  VOICE: "voice",
  INTRO: "intro",
  CHAT: "chat",
  COSMETIC: "cosmetic",
  EMOTE: "emote",
  PROGRESS: "progress",
  SOCIAL_CMD: "social_cmd",
  SOCIAL_PACK: "social_pack",
  SOCIAL_NOTE: "social_note",
  FIND: "find",
} as const;

export type PingKind = "enemy" | "loot" | "go" | "danger" | "help" | "objective" | "weapon" | "ammo" | "medical";
export type QuickCode =
  | "enemy"
  | "ammo"
  | "heal"
  | "defend"
  | "move"
  | "follow"
  | "retreat"
  | "attack"
  | "thanks"
  | "nice";
export type MatchPhase =
  | "loading"
  | "intro"
  | "loot"
  | "combat"
  | "circle"
  | "final"
  | "ended";

export const ERROR = {
  BAD_PROTOCOL: "bad_protocol",
  BAD_SESSION: "bad_session",
  RATE: "rate",
  REJECTED: "rejected",
  UNKNOWN: "unknown",
} as const;

export type TeamId = "alpha" | "bravo" | "none";
export type MatchMode = "range" | "ranked" | "bots" | "quick";
export type InviteKind = "friend" | "party" | "clan" | "match";
