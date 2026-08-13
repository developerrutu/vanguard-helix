/** Part 14 — stack contracts. The game stays a real-time web multiplayer, not a mock. */

import { ENGINE_NAME, ENGINE_VERSION, PROTOCOL_VERSION, TICK_HZ } from "./constants";

export const SEMVER = ENGINE_VERSION;
export const MIN_PROTOCOL = 15;

export type HelixEnv = "dev" | "test" | "staging" | "prod";

export const BROWSERS = [
  { id: "chrome", name: "Chrome", min: 111, desktop: true, android: true },
  { id: "edge", name: "Edge", min: 111, desktop: true, android: true },
  { id: "firefox", name: "Firefox", min: 115, desktop: true, android: true },
  { id: "safari", name: "Safari", min: 16.4, desktop: true, android: false },
  { id: "samsung", name: "Samsung Internet", min: 21, desktop: false, android: true },
] as const;

export const LAYERS = [
  "web_client",
  "render_runtime",
  "gameplay_sim",
  "net_client",
  "authority",
  "matchmaking",
  "auth",
  "player_services",
  "social",
  "economy",
  "store",
  "cdn",
  "monitor",
  "staff",
] as const;

export function parseBrowser(ua: string): { id: string; name: string; version: number; ok: boolean } {
  const raw = ua || "";
  const pick = (id: string, name: string, re: RegExp, min: number) => {
    const m = raw.match(re);
    const version = m ? Number(m[1]) : 0;
    return { id, name, version, ok: version >= min };
  };
  if (/Edg\//.test(raw)) return pick("edge", "Edge", /Edg\/(\d+)/, 111);
  if (/SamsungBrowser\//.test(raw)) return pick("samsung", "Samsung Internet", /SamsungBrowser\/(\d+)/, 21);
  if (/Firefox\//.test(raw)) return pick("firefox", "Firefox", /Firefox\/(\d+)/, 115);
  if (/Chrome\//.test(raw) && !/Edg\//.test(raw)) return pick("chrome", "Chrome", /Chrome\/(\d+)/, 111);
  if (/Safari\//.test(raw) && /Version\//.test(raw)) return pick("safari", "Safari", /Version\/(\d+(?:\.\d+)?)/, 16.4);
  return { id: "other", name: "Unknown", version: 0, ok: false };
}

export function needsWebgl2(webgl2: boolean): boolean {
  return !webgl2;
}

export function matchTag(id: string): string {
  const hex = id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase().padStart(8, "0");
  return "MATCH-" + hex;
}

export function protocolOk(client: number): boolean {
  return client === PROTOCOL_VERSION;
}

export function stackPublic() {
  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    protocol: PROTOCOL_VERSION,
    tickHz: TICK_HZ,
    transport: "WebSocket over TLS (wss). JSON frames. No UDP in the browser.",
    whyTick:
      "30 Hz: 8 pawns, rewind ≤150 ms, mobile radios. 20 Hz feels slack on guns. 60 Hz doubles CPU and snapshot cost for almost no 4v4 gain.",
    whyWs:
      "WebSocket is universal (Chrome/Edge/Firefox/Safari/Android). WebRTC datachannels can be faster but need TURN, fail more on hotel Wi-Fi, and we already reserved WebRTC for optional voice.",
    whyTs:
      "One language for client, authority, and the shared protocol. WASM remains an escape hatch for hot sim — not a rewrite.",
    whyThree:
      "WebGL2 baseline covers the required browsers. Three.js is code-split. WebGPU is detected, never required. Unity/Godot web exports miss the <10 s load budget.",
    whyJsonStore:
      "Single-region demo: transactional in-process JSON. Scale-out is Postgres (accounts/economy) + Redis (sessions/queues) + object logs. The client never sees a database.",
    render: "Three.js + WebGL2. Adaptive pixel ratio, LOD distances from quality profile, Hor+ FOV.",
    audio: "Web Audio Helix mixer. No sample banks.",
    prediction: "Local movement predicted. Server snap reconciles. Remote pawns interpolated. Lag comp capped.",
    offline: "Settings, cached shell, range if already loaded. Never offline rank, ION, or results.",
    browsers: BROWSERS,
    layers: LAYERS,
    envs: ["dev", "test", "staging", "prod"],
    cdn: "Hashed Vite assets. Future: Cloudflare/R2 in front of /assets. API and /ws stay off the CDN.",
    secrets: "HELIX_STAFF_KEY and DB URLs are env-only. Never in the client bundle.",
  };
}
