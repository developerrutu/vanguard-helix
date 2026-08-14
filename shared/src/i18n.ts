/** Part 10 — localization. UI strings never live in gameplay sim. */

export type LangId = "en" | "hi";

export const LANGS: { id: LangId; name: string }[] = [
  { id: "en", name: "English" },
  { id: "hi", name: "हिन्दी" },
];

const EN: Record<string, string> = {
  boot_hw: "READING HARDWARE…",
  boot_regions: "PROBING ORBIT LINKS…",
  boot_render: "LIGHTING THE YARD…",
  boot_audio: "OPENING SIGNAL BUS…",
  boot_auth: "CONTACTING AUTHORITY…",
  boot_ok: "SYSTEMS ONLINE",
  rotate_title: "ROTATE DEVICE",
  rotate_body: "Vanguard is landscape-only. Turn your device to continue.",
  brand_sub: "4v4 TEAM BATTLE ROYALE",
  hero_title: "Easy to learn.\nBrutal to master.",
  hero_lede:
    "One life. Shared loot. A closing circle. Skill, positioning and teamwork decide the yard — never a wallet.",
  nav_start: "START GAME",
  nav_profile: "PROFILE",
  nav_friends: "FRIENDS",
  nav_clan: "CLAN",
  nav_inventory: "INVENTORY",
  nav_board: "LEADERBOARD",
  nav_store: "STORE",
  nav_settings: "SETTINGS",
  nav_mail: "MAILBOX",
  nav_range: "RANGE",
  play_quick: "QUICK PLAY",
  play_ranked: "RANKED",
  play_bots: "PLAY WITH BOTS",
  play_start: "START GAME",
  play_mode: "MODE",
  play_map: "PLAYLIST",
  play_party: "PARTY",
  play_count: "PLAYERS",
  play_ping: "PING",
  search_title: "SEARCHING FOR PLAYERS",
  search_found: "PLAYERS FOUND",
  search_team: "TEAM STATUS",
  search_wait: "SEARCH TIME",
  search_ping: "EST. PING",
  search_cancel: "CANCEL",
  found_title: "MATCH FOUND",
  found_accept: "ACCEPT",
  found_decline: "DECLINE",
  lobby_title: "BATTLE LOBBY",
  lobby_ready: "READY",
  result_ok: "RETURN TO LOBBY",
  result_again: "PLAY AGAIN",
  close: "CLOSE",
  online: "LIVE",
  offline: "OFFLINE",
  level: "LEVEL",
  rank: "RANK",
  credits: "CREDITS",
  player_id: "PLAYER ID",
  settings_gfx: "GRAPHICS",
  settings_audio: "AUDIO",
  settings_controls: "CONTROLS",
  settings_game: "GAMEPLAY",
  settings_access: "ACCESS",
  preset_auto: "AUTO OPTIMIZE",
  preset_vlow: "VERY LOW",
  preset_low: "LOW",
  preset_med: "MEDIUM",
  preset_high: "HIGH",
  preset_vhigh: "VERY HIGH",
  preset_custom: "CUSTOM",
  net_excellent: "EXCELLENT",
  net_good: "GOOD",
  net_unstable: "UNSTABLE",
  net_poor: "POOR",
  err_lost: "Connection lost",
  err_join: "Unable to join match",
  err_server: "Server unavailable",
  err_session: "Session expired",
  err_update: "Update Required",
  err_webgl: "This browser cannot run Vanguard — WebGL2 is required.",
  err_retry: "RETRY",
  err_reconnect: "RECONNECT",
  err_lobby: "RETURN TO LOBBY",
  store_rule: "ION is earned. ORBIT is optional. The Vault is appearance only — never damage, health, or speed.",
  mail_empty: "No signals.",
  live_season: "SEASON",
  live_tab: "LIVE",
  live_notes: "NOTES",
  live_send: "SEND TICKET",
  live_never_pw: "Support never asks for a password. Do not type one here.",
  live_launch: "Public launch is not open. This is a playable core, not a ship claim.",
  live_feedback: "Feedback",
  tip_loot: "Spawn with a knife, P9 and one bandage. Loot the yard — the store never sells a gunfight.",
  tip_revive: "Hold interact for 7 seconds to revive a downed teammate.",
  tip_circle: "The ion storm only hurts outside the ring. Rotate early.",
  tip_comms: "Ping with F. Quick callouts keep the squad alive.",
  tip_slide: "Slide from a sprint to break an angle. Loud, fast, no stamina bar.",
  pause_title: "MENU",
  pause_body: "The yard is still live. Resume, open settings, or leave to the main menu.",
  resume: "RESUME",
  leave: "MAIN MENU",
  touch_std: "STANDARD",
  touch_adv: "ADVANCED",
  touch_left: "LEFT-HANDED",
  downed: "DOWNED — CRAWL OR WAIT",
  vo_spotted: "Enemy spotted.",
  vo_reload: "Reloading.",
  vo_help: "Need medical support.",
  vo_hurt: "Taking fire.",
  vo_moving: "Moving.",
  vo_clear: "Area clear.",
  vo_win: "We hold the yard.",
  vo_lose: "We drop. Reset.",
  vo_greet: "Squad up.",
  sec_guest: "Guest session. Claim with email to lock this Player ID.",
  sec_claimed: "Account claimed. Password is hashed on the authority.",
};

const HI: Record<string, string> = {
  ...EN,
  rotate_title: "डिवाइस घुमाएँ",
  rotate_body: "वैंगार्ड केवल लैंडस्केप में चलता है। जारी रखने के लिए डिवाइस घुमाएँ।",
  nav_start: "खेल शुरू",
  nav_profile: "प्रोफ़ाइल",
  nav_friends: "मित्र",
  nav_clan: "क्लान",
  nav_inventory: "इन्वेंटरी",
  nav_board: "लीडरबोर्ड",
  nav_store: "स्टोर",
  nav_settings: "सेटिंग्स",
  nav_mail: "मेल",
  play_start: "खेल शुरू",
  play_quick: "क्विक प्ले",
  play_ranked: "रैंक्ड",
  found_title: "मैच मिला",
  found_accept: "स्वीकार",
  found_decline: "अस्वीकार",
  search_cancel: "रद्द",
  close: "बंद",
  err_lost: "कनेक्शन टूट गया",
  err_join: "मैच में शामिल नहीं हो सके",
  err_server: "सर्वर उपलब्ध नहीं",
  err_session: "सत्र समाप्त",
  err_update: "अपडेट आवश्यक",
  err_webgl: "यह ब्राउज़र वैंगार्ड नहीं चला सकता — WebGL2 चाहिए।",
  err_retry: "फिर कोशिश",
  err_reconnect: "फिर जुड़ें",
  err_lobby: "लॉबी पर लौटें",
  vo_spotted: "दुश्मन नज़र आया।",
  vo_reload: "रीलोड।",
  vo_help: "मेडिकल चाहिए।",
  vo_hurt: "आग लग रही है।",
  vo_moving: "चल रहे हैं।",
  vo_clear: "क्षेत्र साफ़।",
  vo_win: "यार्ड हमारा है।",
  vo_lose: "गिरा। फिर से।",
  vo_greet: "स्क्वॉड तैयार।",
  sec_guest: "अतिथि सत्र। इस आईडी को लॉक करने के लिए ईमेल से दावा करें।",
  sec_claimed: "खाता दावा हुआ। पासवर्ड सर्वर पर हैश है।",
  live_season: "सीज़न",
  live_tab: "लाइव",
  live_notes: "नोट्स",
  live_send: "टिकट भेजें",
  live_never_pw: "सपोर्ट कभी पासवर्ड नहीं माँगता। यहाँ न लिखें।",
  live_launch: "पब्लिक लॉन्च खुला नहीं है। यह खेलने योग्य कोर है, शिप दावा नहीं।",
  live_feedback: "फ़ीडबैक",
};

const TABLES: Record<LangId, Record<string, string>> = { en: EN, hi: HI };

let current: LangId = "en";

export function detectLang(nav = ""): LangId {
  const raw = (nav || (typeof navigator !== "undefined" ? navigator.language : "en")).toLowerCase();
  if (raw.startsWith("hi")) return "hi";
  return "en";
}

export function setLang(id: LangId): void {
  current = TABLES[id] ? id : "en";
}

export function getLang(): LangId {
  return current;
}

export function t(key: string, fallback?: string): string {
  return TABLES[current][key] || EN[key] || fallback || key;
}

export const LOADING_TIPS = ["tip_loot", "tip_revive", "tip_circle", "tip_comms", "tip_slide"] as const;

export function netQuality(rtt: number, loss = 0): "excellent" | "good" | "unstable" | "poor" {
  if (loss > 0.08 || rtt > 180) return "poor";
  if (loss > 0.03 || rtt > 110) return "unstable";
  if (rtt > 55) return "good";
  return "excellent";
}

export function uxPublic() {
  return {
    identity: "ORBIT TRACE — hex-cut ion on ink. Original Helix chrome, not another title's HUD.",
    rule: "UI displays server truth. Currency, rank, XP, inventory, and results are never client-written.",
    langs: LANGS,
    firstRun: ["launch", "session", "menu", "start", "matchmake", "match"],
  };
}
