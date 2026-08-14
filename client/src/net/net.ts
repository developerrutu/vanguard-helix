import {
  MSG,
  PROTOCOL_VERSION,
  type C2S,
  type CurrencyState,
  type FriendPublic,
  type GameEvent,
  type InputPayload,
  type InventorySlot,
  type InviteKind,
  type InvitePublic,
  type LobbyState,
  type MatchMode,
  type MatchOffer,
  type MatchResult,
  type PartyState,
  type ProfileState,
  type S2C,
  type SearchUpdate,
  type Snapshot,
  type PingKind,
  type QuickCode,
  type Appearance,
  type EmoteId,
  type FindHit,
  type SocialNote,
  type SocialPack,
} from "@shared";

export interface SessionPayload {
  token: string;
  profile: ProfileState;
  currency: CurrencyState;
  inventory: InventorySlot[];
  lastMatchId?: string;
}

export class NetClient {
  ws: WebSocket | null = null;
  playerId = "";
  rtt = 0;
  connected = false;
  region = "india";
  lastMatchId = "";
  onSnapshot: ((s: Snapshot) => void) | null = null;
  onEvent: ((e: GameEvent[]) => void) | null = null;
  onInventory: ((s: InventorySlot[]) => void) | null = null;
  onCurrency: ((c: CurrencyState) => void) | null = null;
  onProfile: ((p: ProfileState) => void) | null = null;
  onMatch: ((state: string, eta: number) => void) | null = null;
  onSearch: ((s: SearchUpdate) => void) | null = null;
  onOffer: ((o: MatchOffer) => void) | null = null;
  onLobby: ((l: LobbyState) => void) | null = null;
  onResult: ((r: MatchResult) => void) | null = null;
  onParty: ((p: PartyState) => void) | null = null;
  onSocial: ((f: FriendPublic[], clan: string) => void) | null = null;
  onPack: ((p: SocialPack) => void) | null = null;
  onFind: ((hits: FindHit[]) => void) | null = null;
  onNote: ((n: SocialNote) => void) | null = null;
  onInvite: ((i: InvitePublic) => void) | null = null;
  onWelcome: ((room: string) => void) | null = null;
  onError: ((code: string, message: string) => void) | null = null;
  onStatus: ((online: boolean) => void) | null = null;
  onIntro: ((m: { mapName: string; mapId?: string; weather?: string; matchNumber: number; duration: number; alpha: { name: string; rank: string; character: string }[]; bravo: { name: string; rank: string; character: string }[] }) => void) | null = null;
  onChat: ((from: string, text: string) => void) | null = null;
  private pingTimer: number | null = null;
  private pingSent = 0;
  private token = "";
  private name = "";

  async session(name: string): Promise<SessionPayload> {
    const existing = localStorage.getItem("vanguard.token") || "";
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token: existing }),
    });
    if (!res.ok) throw new Error("session failed");
    const data = (await res.json()) as SessionPayload;
    localStorage.setItem("vanguard.token", data.token);
    if (!localStorage.getItem("vanguard.name")) localStorage.setItem("vanguard.name", data.profile.name);
    this.token = data.token;
    this.name = data.profile.name;
    this.lastMatchId = data.lastMatchId || "";
    return data;
  }

  authToken(): string {
    return this.token || localStorage.getItem("vanguard.token") || "";
  }

  async auth(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token: this.authToken(), device: navigator.userAgent.slice(0, 80) }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.token === "string") {
      localStorage.setItem("vanguard.token", data.token);
      this.token = data.token;
    }
    return data;
  }

  connect(name?: string, reconnectMatch?: string): Promise<void> {
    this.name = name || this.name;
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const t = window.setTimeout(() => reject(new Error("ws timeout")), 5000);
      ws.onopen = () => {
        window.clearTimeout(t);
        this.connected = true;
        this.onStatus?.(true);
        this.send({
          type: MSG.HELLO,
          protocol: PROTOCOL_VERSION,
          name: this.name,
          token: this.token,
          device: navigator.userAgent.slice(0, 80),
          region: this.region,
          reconnectMatch: reconnectMatch || this.lastMatchId,
        });
        this.pingTimer = window.setInterval(() => {
          this.pingSent = performance.now();
          this.send({ type: MSG.PING, t: this.pingSent, rtt: this.rtt });
        }, 1500);
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(t);
        reject(new Error("ws error"));
      };
      ws.onclose = () => {
        this.connected = false;
        this.onStatus?.(false);
        if (this.pingTimer) window.clearInterval(this.pingTimer);
      };
      ws.onmessage = (ev) => this.ingest(String(ev.data));
    });
  }

  sendInput(input: InputPayload): void {
    this.send({ type: MSG.INPUT, input });
  }

  matchmake(mode: MatchMode): void {
    this.send({ type: MSG.MATCHMAKE, mode });
  }

  cancelSearch(): void {
    this.send({ type: MSG.CANCEL_SEARCH });
  }

  accept(matchId: string): void {
    this.send({ type: MSG.MATCH_ACCEPT, matchId });
  }

  decline(matchId: string): void {
    this.send({ type: MSG.MATCH_DECLINE, matchId });
  }

  ready(matchId: string): void {
    this.send({ type: MSG.LOBBY_READY, matchId });
  }

  selectCharacter(character: string): void {
    this.send({ type: MSG.SELECT_CHARACTER, character });
  }

  invite(kind: InviteKind, targetId: string): void {
    this.send({ type: MSG.INVITE_SEND, kind, targetId });
  }

  respondInvite(inviteId: string, accept: boolean): void {
    this.send({ type: MSG.INVITE_RESPOND, inviteId, accept });
  }

  addFriend(name: string): void {
    this.send({ type: MSG.FRIEND_ADD, name });
  }

  social(op: string, extra: Record<string, string | boolean | Record<string, string | boolean>> = {}): void {
    this.send({ type: MSG.SOCIAL_CMD, op, ...extra } as C2S);
  }

  kick(playerId: string): void {
    this.send({ type: MSG.PARTY_KICK, playerId });
  }

  leaveParty(): void {
    this.send({ type: MSG.PARTY_LEAVE });
  }

  useItem(itemId: string): void {
    this.send({ type: MSG.USE_ITEM, itemId, requestId: Date.now() });
  }

  buy(sku: string): void {
    this.send({ type: MSG.BUY, sku, requestId: Date.now() });
  }

  worldPing(kind: PingKind): void {
    this.send({ type: MSG.WORLD_PING, kind });
  }

  quickChat(code: QuickCode): void {
    this.send({ type: MSG.QUICK_CHAT, code });
  }

  swap(slot: "primary" | "secondary" | "melee"): void {
    this.send({ type: MSG.SWAP_SLOT, slot });
  }

  report(targetId: string, reason: string): void {
    this.send({ type: MSG.REPORT, targetId, reason });
  }

  voice(speaking: boolean): void {
    this.send({ type: MSG.VOICE, speaking });
  }

  cosmetic(appearance: Appearance, character: string): void {
    this.send({ type: MSG.COSMETIC, appearance, character });
  }

  emote(emote: EmoteId): void {
    this.send({ type: MSG.EMOTE, emote });
  }

  progress(next: { title?: string; shown?: string[]; prestige?: boolean }): void {
    this.send({ type: MSG.PROGRESS, ...next });
  }

  private send(msg: C2S): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private ingest(raw: string): void {
    let msg: S2C;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case MSG.WELCOME:
        this.playerId = msg.playerId;
        this.lastMatchId = msg.room;
        this.onWelcome?.(msg.room);
        break;
      case MSG.SNAPSHOT:
        this.onSnapshot?.(msg.snap);
        break;
      case MSG.EVENT:
        this.onEvent?.(msg.events);
        break;
      case MSG.PONG: {
        const sent = this.pingSent || msg.t;
        const ms = performance.now() - sent;
        if (Number.isFinite(ms) && ms >= 0 && ms < 8000) this.rtt = ms;
        break;
      }
      case MSG.INVENTORY:
        this.onInventory?.(msg.slots);
        break;
      case MSG.CURRENCY:
        this.onCurrency?.(msg.currency);
        break;
      case MSG.PROFILE:
        this.onProfile?.(msg.profile);
        break;
      case MSG.MATCH_STATUS:
        this.onMatch?.(msg.state, msg.etaMs);
        break;
      case MSG.SEARCH_UPDATE:
        this.onSearch?.(msg.search);
        break;
      case MSG.MATCH_OFFER:
        this.onOffer?.(msg.offer);
        break;
      case MSG.LOBBY:
        this.onLobby?.(msg.lobby);
        break;
      case MSG.MATCH_START:
        this.lastMatchId = msg.room;
        this.onWelcome?.(msg.room);
        break;
      case MSG.MATCH_END:
        this.onResult?.(msg.result);
        break;
      case MSG.PARTY:
        this.onParty?.(msg.party);
        break;
      case MSG.SOCIAL:
        this.onSocial?.(msg.friends, msg.clanTag);
        break;
      case MSG.INVITE:
        this.onInvite?.(msg.invite);
        break;
      case MSG.ERROR:
        this.onError?.(msg.code, msg.message);
        break;
      case MSG.INTRO:
        this.onIntro?.(msg);
        break;
      case MSG.CHAT:
        this.onChat?.(msg.from, msg.text);
        break;
      case MSG.SOCIAL_PACK:
        this.onPack?.(msg.pack);
        break;
      case MSG.SOCIAL_NOTE:
        this.onNote?.(msg.note);
        break;
      case MSG.FIND:
        this.onFind?.(msg.hits);
        break;
    }
  }
}
