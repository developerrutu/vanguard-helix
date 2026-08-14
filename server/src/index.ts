import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  ACHIEVEMENTS,
  COSMETICS,
  EMOTES,
  ENGINE_NAME,
  ENGINE_VERSION,
  MSG,
  OPERATORS,
  PROTOCOL_VERSION,
  mapsPublic,
  mindsPublic,
  progressPublic,
  socialPublic,
  uxPublic,
  audioPublic,
  economyPublic,
  stackPublic,
  HTTP_MAX_BYTES,
  WS_MAX_BYTES,
  REGIONS,
  type C2S,
  type MatchMode,
  type S2C,
} from "../../shared/src/index";
import { Store } from "./persist/store";
import { Sessions } from "./net/session";
import { Matchmaker } from "./match/matchmaker";
import { Social } from "./social/social";
import { Directory } from "./region/directory";
import { FlagLog } from "./anticheat/flags";
import { telemetry } from "./combat/telemetry";
import type { Room, Wire } from "./sim/room";
import { RateGate } from "./security/rate";
import { audit } from "./security/audit";
import { Watch } from "./security/watch";
import { ModDesk } from "./security/mod";
import { handleSecurity } from "./security/http";
import { snapshotBackup } from "./security/backup";
import { mintToken } from "./security/crypto";
import { Vault } from "./economy/vault";
import { monitor } from "./ops/monitor";
import { liveDesk } from "./ops/live";
import { PUBLIC_DIR, tryStatic } from "./ops/static";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "";

const store = new Store();
const rate = new RateGate();
const watch = new Watch(audit);
const flags = new FlagLog();
flags.onFlag = (f) => watch.ingest(f);
const sessions = new Sessions(store, audit, watch);
const directory = new Directory();
const social = new Social(store);
const vault = new Vault(store);
const mod = new ModDesk(store, audit, watch);
const STAFF_KEY = process.env.HELIX_STAFF_KEY || mintToken(18);
if (!process.env.HELIX_STAFF_KEY) {
  console.log("[helix] staff key (dev only, never ship to client):", STAFF_KEY);
}
setInterval(() => snapshotBackup(), 6 * 60 * 60_000).unref();

const roomBind = new Map<string, Room>();

const matchmaker = new Matchmaker(store, social, flags, (playerId, room) => {
  roomBind.set(playerId, room);
});
social.hooks = {
  queued: (id) => matchmaker.isQueued(id),
  matched: (id) => Boolean(matchmaker.roomOfPlayer(id) || roomBind.get(id)),
  team: (id) => matchmaker.roomOfPlayer(id)?.teammates(id) ?? roomBind.get(id)?.teammates(id) ?? [],
};

interface Client {
  ws: WebSocket;
  accountId: string | null;
  room: Room | null;
  token: string | null;
  lastPing: number;
  region: string;
  ping: number;
  frames: number;
  frameMark: number;
}

const clients = new Set<Client>();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    json(res, 200, {
      ok: true,
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      protocol: PROTOCOL_VERSION,
      env: monitor.env,
      uptime: process.uptime(),
      regions: REGIONS.map((r) => r.id),
    });
    return;
  }

  if (url.pathname === "/api/status") {
    json(res, 200, {
      ccu: [...clients].filter((c) => c.accountId).length,
      ...matchmaker.stats(),
      accounts: store.count(),
      flags: flags.list(8),
      alerts: watch.list(6),
    });
    return;
  }

  if (url.pathname === "/api/weapons") {
    json(res, 200, { weapons: telemetry.snapshot() });
    return;
  }

  if (url.pathname === "/api/operators") {
    json(res, 200, { operators: OPERATORS, cosmetics: COSMETICS, emotes: EMOTES, achievements: ACHIEVEMENTS });
    return;
  }

  if (url.pathname === "/api/maps") {
    json(res, 200, mapsPublic());
    return;
  }

  if (url.pathname === "/api/minds") {
    json(res, 200, mindsPublic());
    return;
  }

  if (url.pathname === "/api/progress") {
    json(res, 200, progressPublic());
    return;
  }

  if (url.pathname === "/api/social") {
    const token = url.searchParams.get("token") || "";
    const acc = sessions.resolve(token);
    json(res, 200, {
      ...socialPublic(),
      pack: acc ? social.packOf(acc.id) : null,
    });
    return;
  }

  if (url.pathname === "/api/find") {
    const token = url.searchParams.get("token") || "";
    const q = url.searchParams.get("q") || "";
    const acc = sessions.resolve(token);
    if (acc && !rate.allow("find", acc.id)) {
      json(res, 429, { error: "rate" });
      return;
    }
    json(res, 200, { hits: acc ? social.findHits(acc, q) : [] });
    return;
  }

  if (url.pathname === "/api/clans") {
    json(res, 200, { clans: social.clanBoard(), cap: 50 });
    return;
  }

  if (url.pathname === "/api/ux") {
    json(res, 200, uxPublic());
    return;
  }

  if (url.pathname === "/api/audio") {
    json(res, 200, audioPublic());
    return;
  }

  if (url.pathname === "/api/economy") {
    json(res, 200, economyPublic());
    return;
  }

  if (url.pathname === "/api/vault") {
    const acc = sessions.resolve(url.searchParams.get("token") || "");
    if (!acc) {
      json(res, 401, { error: "bad_session" });
      return;
    }
    json(res, 200, { ...economyPublic(), ...vault.pack(acc) });
    return;
  }

  if (url.pathname === "/api/vault/quote" && req.method === "POST") {
    void readBody(req).then((body) => {
      const q = vault.quote(String(body.sku || ""));
      json(res, q ? 200 : 404, q || { error: "missing" });
    });
    return;
  }

  if (url.pathname === "/api/vault/buy" && req.method === "POST") {
    void readBody(req).then((body) => {
      const acc = sessions.resolve(String(body.token || ""));
      if (!acc) return json(res, 401, { error: "bad_session" });
      if (!rate.allow("buy", acc.id)) return json(res, 429, { error: "rate" });
      const out = vault.buy(acc, String(body.sku || ""), String(body.requestId || Date.now()));
      const fresh = store.byId(acc.id);
      json(res, out.ok ? 200 : 400, {
        ...out,
        currency: fresh?.currency,
        profile: fresh ? store.profileOf(fresh) : undefined,
      });
    });
    return;
  }

  if (url.pathname === "/api/vault/daily" && req.method === "POST") {
    void readBody(req).then((body) => {
      const acc = sessions.resolve(String(body.token || ""));
      if (!acc) return json(res, 401, { error: "bad_session" });
      const out = vault.daily(acc);
      const fresh = store.byId(acc.id);
      json(res, out.ok ? 200 : 400, { ...out, currency: fresh?.currency, profile: fresh ? store.profileOf(fresh) : undefined });
    });
    return;
  }

  if (url.pathname === "/api/stack") {
    json(res, 200, stackPublic());
    return;
  }

  if (url.pathname === "/api/live") {
    json(res, 200, liveDesk.public());
    return;
  }

  if (url.pathname === "/api/live/events") {
    json(res, 200, { events: liveDesk.events() });
    return;
  }

  if (url.pathname === "/api/live/notes") {
    json(res, 200, { notes: liveDesk.notes() });
    return;
  }

  if (url.pathname === "/api/live/season") {
    json(res, 200, liveDesk.season());
    return;
  }

  if (url.pathname === "/api/live/status") {
    json(res, 200, liveDesk.public());
    return;
  }

  if (url.pathname === "/api/live/feedback" && req.method === "POST") {
    void readBody(req).then((body) => {
      const acc = sessions.resolve(String(body.token || ""));
      if (!acc) return json(res, 401, { error: "bad_session" });
      if (!rate.allow("report", acc.id)) return json(res, 429, { error: "rate" });
      const out = liveDesk.file(acc.id, String(body.kind || "suggest"), String(body.sev || "medium"), String(body.text || ""));
      if (typeof out === "string") return json(res, 400, { error: out });
      json(res, 200, { ok: true, id: out.id });
    });
    return;
  }

  if (url.pathname === "/api/monitor") {
    json(res, 200, monitor.snapshot({
      ccu: [...clients].filter((c) => c.accountId).length,
      ...matchmaker.stats(),
      accounts: store.count(),
    }));
    return;
  }

  if (url.pathname === "/api/crash" && req.method === "POST") {
    void readBody(req).then((body) => {
      if (!rate.allow("session", clientIp(req))) return json(res, 429, { error: "rate" });
      const note = monitor.crash(body as { message?: string; build?: string; browser?: string; device?: string; category?: string });
      json(res, note ? 200 : 400, note ? { ok: true } : { error: "empty" });
    });
    return;
  }

  if (
    handleSecurity(url, req, res, {
      store,
      sessions,
      rate,
      watch,
      mod,
      staffKey: STAFF_KEY,
      reports: () => social.reportsOf(40),
      ip: clientIp,
      json,
      readBody,
    })
  ) {
    return;
  }

  if (url.pathname === "/api/boards") {
    const token = url.searchParams.get("token") || "";
    const scope = url.searchParams.get("scope") || "global";
    const acc = sessions.resolve(token);
    json(res, 200, acc ? store.boards(scope, acc) : { scope, rows: [] });
    return;
  }

  if (url.pathname === "/api/history") {
    const token = url.searchParams.get("token") || "";
    const acc = sessions.resolve(token);
    json(res, 200, { matches: acc ? store.historyOf(acc.id) : [] });
    return;
  }

  if (url.pathname === "/api/regions") {
    json(res, 200, { regions: directory.list() });
    return;
  }

  const pingMatch = url.pathname.match(/^\/api\/regions\/([a-z]+)\/ping$/);
  if (pingMatch) {
    const extra = directory.extraMs(pingMatch[1]);
    setTimeout(() => {
      json(res, 200, { id: pingMatch[1], t: Date.now() });
    }, extra);
    return;
  }

  if (url.pathname === "/api/session" && req.method === "POST") {
    readBody(req)
      .then((body) => {
        const name = String(body.name || sessions.guestName());
        const existing = String(body.token || "");
        const issued = sessions.issue(name, existing);
        store.ensureContacts(issued.account);
        store.touchSeen(issued.account.id);
        json(res, 200, {
          token: issued.token,
          profile: store.profileOf(issued.account),
          currency: issued.account.currency,
          inventory: issued.account.slots,
          lastMatchId: issued.account.lastMatchId,
        });
      })
      .catch(() => json(res, 400, { error: "bad_json" }));
    return;
  }

  if (url.pathname.startsWith("/api/matches/") && req.method === "GET") {
    const id = url.pathname.slice("/api/matches/".length);
    const m = store.lastMatch(id);
    if (!m) {
      json(res, 404, { error: "not_found" });
      return;
    }
    json(res, 200, m);
    return;
  }

  if (tryStatic(req, res, url.pathname)) return;

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const html =
      "<!doctype html><meta charset=utf-8><title>VANGUARD</title><body style=\"font-family:sans-serif;background:#07080d;color:#e9eef6;padding:24px\"><p>Helix online. Client bundle missing — rebuild.</p></body>";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
    res.end(html);
    return;
  }

  json(res, 404, { error: "not_found" });
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const origin = String(req.headers.origin || "");
  if (origin && !originAllowed(origin)) {
    ws.close(1008, "origin");
    return;
  }

  const client: Client = {
    ws,
    accountId: null,
    room: null,
    token: null,
    lastPing: Date.now(),
    region: "india",
    ping: 30,
    frames: 0,
    frameMark: Date.now(),
  };
  clients.add(client);

  const wire: Wire = {
    send(msg: S2C) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };

  ws.on("message", (raw) => {
    const text = String(raw);
    if (text.length > WS_MAX_BYTES) {
      wire.send({ type: MSG.ERROR, code: "rejected", message: "Frame too large" });
      return;
    }
    const now = Date.now();
    if (now - client.frameMark > 1000) {
      client.frameMark = now;
      client.frames = 0;
    }
    client.frames++;
    if (client.frames > 90) {
      flags.note(client.accountId || "anon", "ws", "rate", "ws flood");
      return;
    }
    let msg: C2S;
    try {
      msg = JSON.parse(text);
    } catch {
      wire.send({ type: MSG.ERROR, code: "unknown", message: "Malformed frame" });
      return;
    }
    onMessage(client, wire, msg);
  });

  ws.on("close", () => {
    if (client.accountId) {
      const room = client.room || roomBind.get(client.accountId);
      if (room && room.ranked) {
        room.disconnect(client.accountId);
        matchmaker.reserve(client.accountId, room);
      } else if (room) {
        room.leave(client.accountId);
        roomBind.delete(client.accountId);
      }
      matchmaker.cancel(client.accountId);
      social.unbind(client.accountId);
    }
    clients.delete(client);
  });
});

function onMessage(client: Client, wire: Wire, msg: C2S): void {
  if (msg.type === MSG.PING) {
    client.lastPing = Date.now();
    if (typeof msg.rtt === "number" && msg.rtt >= 0 && msg.rtt < 2000) client.ping = msg.rtt;
    wire.send({ type: MSG.PONG, t: msg.t, serverTime: Date.now() });
    return;
  }

  if (msg.type === MSG.HELLO) {
    if (msg.protocol !== PROTOCOL_VERSION) {
      wire.send({ type: MSG.ERROR, code: "bad_protocol", message: "Update Required" });
      return;
    }
    const account = sessions.resolve(msg.token);
    if (!account) {
      wire.send({ type: MSG.ERROR, code: "bad_session", message: "Session expired" });
      return;
    }
    if (store.isBanned(account)) {
      wire.send({ type: MSG.ERROR, code: "banned", message: account.banReason || "Account restricted" });
      return;
    }
    if (msg.name) store.rename(account.id, msg.name);
    client.accountId = account.id;
    client.token = msg.token;
    if (msg.region) {
      client.region = msg.region;
      store.setRegion(account.id, msg.region);
    }
    store.ensureContacts(account);
    social.bind(account.id, wire);
    matchmaker.attachWire(account.id, wire);
    wire.send({ type: MSG.PROFILE, profile: store.profileOf(account) });
    wire.send({ type: MSG.INVENTORY, slots: account.slots.map((s) => ({ ...s })) });
    wire.send({ type: MSG.CURRENCY, currency: { ...account.currency } });

    const reconId = msg.reconnectMatch || account.lastMatchId;
    if (reconId) {
      const reserved = matchmaker.takeReserve(account.id);
      const room = reserved || matchmaker.roomById(reconId) || matchmaker.roomOfPlayer(account.id);
      if (room && room.reconnect(account, wire)) {
        client.room = room;
        roomBind.set(account.id, room);
        return;
      }
    }
    return;
  }

  if (!client.accountId) {
    wire.send({ type: MSG.ERROR, code: "bad_session", message: "HELLO required" });
    return;
  }

  const account = store.byId(client.accountId);
  if (!account) return;

  if (msg.type === MSG.MATCHMAKE) {
    if (!rate.allow("matchmake", account.id)) {
      wire.send({ type: MSG.ERROR, code: "rate", message: "Slow down" });
      return;
    }
    if (client.room) {
      client.room.leave(account.id);
      client.room = null;
      roomBind.delete(account.id);
    }
    const mode = msg.mode as MatchMode;
    if (mode === "range") {
      wire.send({ type: MSG.MATCH_STATUS, state: "found", etaMs: 0 });
      client.room = matchmaker.enterRange(account, wire, client.region);
      return;
    }
    const play: MatchMode = mode === "bots" || mode === "ranked" || mode === "quick" ? mode : "quick";
    matchmaker.enqueue(account, wire, play, client.region, client.ping);
    return;
  }

  if (msg.type === MSG.CANCEL_SEARCH) {
    matchmaker.cancel(account.id);
    wire.send({ type: MSG.MATCH_STATUS, state: "cancelled", etaMs: 0 });
    return;
  }

  if (msg.type === MSG.MATCH_ACCEPT) {
    matchmaker.accept(account.id, msg.matchId);
    return;
  }
  if (msg.type === MSG.MATCH_DECLINE) {
    matchmaker.decline(account.id, msg.matchId);
    return;
  }
  if (msg.type === MSG.LOBBY_READY) {
    matchmaker.ready(account.id, msg.matchId);
    return;
  }
  if (msg.type === MSG.SELECT_CHARACTER) {
    store.setCharacter(account.id, msg.character);
    wire.send({ type: MSG.PROFILE, profile: store.profileOf(store.byId(account.id)!) });
    social.pushAll(account.id);
    return;
  }
  if (msg.type === MSG.PARTY_LEAVE) {
    social.leave(account.id);
    return;
  }
  if (msg.type === MSG.PARTY_KICK) {
    social.kick(account.id, msg.playerId);
    return;
  }
  if (msg.type === MSG.INVITE_SEND) {
    const ok = social.sendInvite(account, msg.kind, msg.targetId, {
      matchId: account.lastMatchId,
    });
    if (!ok) wire.send({ type: MSG.ERROR, code: "rejected", message: "Invite failed" });
    return;
  }
  if (msg.type === MSG.INVITE_RESPOND) {
    social.respond(account.id, msg.inviteId, msg.accept);
    return;
  }
  if (msg.type === MSG.FRIEND_ADD) {
    if (!social.addFriendByName(account, msg.name)) {
      wire.send({ type: MSG.ERROR, code: "rejected", message: "Operator not found" });
    }
    return;
  }
  if (msg.type === MSG.SOCIAL_CMD) {
    if (msg.op === "report") {
      const abuse = watch.reportFrom(account.id);
      if (abuse !== "ok") {
        wire.send({ type: MSG.ERROR, code: "rate", message: "Report limit" });
        return;
      }
      audit.write({ kind: "report", actor: account.id, target: msg.targetId, matchId: msg.matchId || account.lastMatchId, detail: msg.reason || "other" });
    }
    if (msg.op === "search" && !rate.allow("find", account.id)) {
      wire.send({ type: MSG.ERROR, code: "rate", message: "Search limit" });
      return;
    }
    const err = social.command(account, msg);
    if (err) wire.send({ type: MSG.ERROR, code: "rejected", message: err });
    return;
  }
  if (msg.type === MSG.REPORT) {
    const err = social.command(account, {
      op: "report",
      targetId: msg.targetId,
      reason: msg.reason,
      matchId: account.lastMatchId,
    });
    flags.note(msg.targetId, account.name, "client", `report by ${account.id}: ${msg.reason}`, 2);
    if (err) wire.send({ type: MSG.ERROR, code: "rejected", message: err });
    else wire.send({ type: MSG.ERROR, code: "rejected", message: "Report filed for review" });
    return;
  }
  if (msg.type === MSG.RECONNECT) {
    const room = matchmaker.takeReserve(account.id) || matchmaker.roomById(msg.matchId);
    if (room && room.reconnect(account, wire)) {
      client.room = room;
      roomBind.set(account.id, room);
    } else {
      wire.send({ type: MSG.ERROR, code: "rejected", message: "No reserved slot" });
    }
    return;
  }

  if (msg.type === MSG.COSMETIC) {
    store.setAppearance(account.id, msg.appearance, msg.character);
    const fresh = store.byId(account.id);
    if (fresh) wire.send({ type: MSG.PROFILE, profile: store.profileOf(fresh) });
    const room = client.room || roomBind.get(account.id);
    if (room) room.handle(account.id, msg);
    return;
  }

  const room = client.room || roomBind.get(account.id);
  if (room) {
    client.room = room;
    room.handle(account.id, msg);
  }
}

function cors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let n = 0;
    req.on("data", (c) => {
      n += (c as Buffer).length;
      if (n > HTTP_MAX_BYTES) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c as Buffer);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req: http.IncomingMessage): string {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket.remoteAddress || "0";
}

function originAllowed(_origin: string): boolean {
  return true;
}

function onListen(): void {
  console.log(`[helix] authority ${ENGINE_VERSION} port ${PORT}${HOST ? " host " + HOST : " (all interfaces)"}`);
  console.log(`[helix] site ${PUBLIC_DIR}`);
}
if (HOST) server.listen(PORT, HOST, onListen);
else server.listen(PORT, "::", onListen);

process.on("uncaughtException", (err) => {
  console.error("[helix] crash", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[helix] reject", err);
});

process.on("SIGINT", () => {
  store.flush();
  process.exit(0);
});
