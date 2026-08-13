import {
  CHARACTERS,
  COSMETICS,
  ITEMS,
  VAULT,
  quoteOf,
  OPERATORS,
  defaultAppearance,
  levelProgress,
  operatorById,
  pingBand,
  worldById,
  type Appearance,
  type CurrencyState,
  type FriendPublic,
  type InventorySlot,
  type InvitePublic,
  type LobbyState,
  type MatchOffer,
  type MatchResult,
  type PartyState,
  type ProfileState,
  type RosterMember,
  type SearchUpdate,
  type Snapshot,
  type FindHit,
  type SocialPack,
  t,
  netQuality,
  LOADING_TIPS,
} from "@shared";
import type { CapReport, QualityId } from "../boot/capabilities";
import type { Settings } from "../boot/settings";
import { DEFAULT_BINDS, type InputAction } from "../boot/settings";

export class UI {
  bootLog = document.getElementById("boot-log")!;
  bootFill = document.getElementById("boot-fill")!;
  bootStatus = document.getElementById("boot-status")!;
  boot = document.getElementById("boot")!;
  menu = document.getElementById("menu")!;
  hud = document.getElementById("hud")!;
  touch = document.getElementById("touch")!;
  settings = document.getElementById("settings")!;
  pause = document.getElementById("pause")!;
  rotate = document.getElementById("rotate")!;
  queueNote = document.getElementById("queue-note")!;
  netPill = document.getElementById("net-pill")!;
  fpsPill = document.getElementById("fps-pill")!;
  announce = document.getElementById("announce")!;
  killfeed = document.getElementById("killfeed")!;
  hint = document.getElementById("hint")!;
  hitmarker = document.getElementById("hitmarker")!;
  hurt = document.getElementById("hurt")!;
  search = document.getElementById("search")!;
  found = document.getElementById("found")!;
  lobby = document.getElementById("lobby")!;
  result = document.getElementById("result")!;
  social = document.getElementById("social")!;
  reconnect = document.getElementById("reconnect")!;
  lastDir = 0;

  setBoot(progress: number, status: string): void {
    this.bootFill.style.width = `${Math.round(progress * 100)}%`;
    this.bootStatus.textContent = status;
  }

  logBoot(label: string, value: string, ok: boolean | "warn" = true): void {
    const li = document.createElement("li");
    const cls = ok === true ? "ok" : ok === "warn" ? "warn" : "";
    li.innerHTML = `<span>${label}</span><span>${escapeHtml(value)}</span><span class="${cls}">${ok === true ? "OK" : ok === "warn" ? "WARN" : "FAIL"}</span>`;
    this.bootLog.appendChild(li);
    this.bootLog.scrollTop = this.bootLog.scrollHeight;
  }

  hideFlows(): void {
    this.search.classList.add("hidden");
    this.found.classList.add("hidden");
    this.lobby.classList.add("hidden");
    this.result.classList.add("hidden");
    this.social.classList.add("hidden");
    this.reconnect.classList.add("hidden");
    document.getElementById("loading")?.classList.add("hidden");
    document.getElementById("intro")?.classList.add("hidden");
    document.getElementById("barracks")?.classList.add("hidden");
    document.getElementById("welcome")?.classList.add("hidden");
    document.getElementById("start")?.classList.add("hidden");
    document.getElementById("inventory")?.classList.add("hidden");
    document.getElementById("store")?.classList.add("hidden");
    document.getElementById("mailbox")?.classList.add("hidden");
    document.getElementById("fault")?.classList.add("hidden");
  }

  applyI18n(): void {
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n!);
    });
  }

  showMenu(): void {
    this.boot.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.touch.classList.add("hidden");
    this.hideFlows();
    this.menu.classList.remove("hidden");
  }

  showGame(touch: boolean): void {
    this.menu.classList.add("hidden");
    this.boot.classList.add("hidden");
    this.hideFlows();
    this.hud.classList.remove("hidden");
    this.touch.classList.toggle("hidden", !touch);
    this.hint.textContent = touch
      ? "STICK · LOOK · FIRE · CTRL CROUCH · P PRONE · E LOOT"
      : "WASD · SHIFT SPRINT · CTRL CROUCH · P PRONE · SPACE JUMP · H EMOTE · RMB ADS";
  }

  setOnline(on: boolean): void {
    this.netPill.textContent = on ? "AUTHORITY LIVE" : "AUTHORITY OFFLINE";
    this.netPill.classList.toggle("live", on);
  }

  setRegion(name: string): void {
    document.getElementById("region-pill")!.textContent = name.toUpperCase();
  }

  setPing(ms: number): void {
    const el = document.getElementById("ping-pill")!;
    el.textContent = `${Math.round(ms)} ms`;
    el.className = "pill ping-" + pingBand(ms);
  }

  setFps(fps: number, show: boolean): void {
    const t = `${Math.round(fps)} FPS`;
    this.fpsPill.textContent = t;
    this.fpsPill.style.display = show ? "" : "none";
    const hud = document.getElementById("hud-fps")!;
    hud.textContent = t;
    hud.style.opacity = show ? "1" : "0";
  }

  setNet(rtt: number, show: boolean): void {
    const el = document.getElementById("hud-net")!;
    el.textContent = `${Math.round(rtt)} ms · 30 TICK`;
    el.style.color = pingColorCss(rtt);
    el.style.opacity = show ? "1" : "0";
    this.setPing(rtt);
    const q = document.getElementById("hud-qual");
    if (q) {
      const band = netQuality(rtt);
      q.textContent = t("net_" + band).toUpperCase();
      q.style.color = band === "excellent" || band === "good" ? "#3dffc0" : band === "unstable" ? "#ffc14d" : "#ff4d6a";
    }
  }

  setPos(x: number, z: number): void {
    document.getElementById("hud-pos")!.textContent = `${x.toFixed(1)}  ${z.toFixed(1)}`;
  }

  setVitals(hp: number, ar: number): void {
    document.getElementById("hp-fill")!.style.width = `${hp}%`;
    document.getElementById("ar-fill")!.style.width = `${(ar / 50) * 100}%`;
    document.getElementById("hp-num")!.textContent = String(Math.round(hp));
    document.getElementById("ar-num")!.textContent = String(Math.round(ar));
  }

  setCombatHud(snap: Snapshot): void {
    const board = document.getElementById("hud-score")!;
    board.style.display = snap.you.team === "none" ? "none" : "flex";
    const aLive = [snap.you, ...snap.others].filter((p) => p.team === "alpha" && !p.eliminated).length;
    const bLive = [snap.you, ...snap.others].filter((p) => p.team === "bravo" && !p.eliminated).length;
    document.getElementById("score-a")!.textContent = String(aLive);
    document.getElementById("score-b")!.textContent = String(bLive);
    document.getElementById("score-clock")!.textContent = (snap.matchPhase || "live").toUpperCase();
    const y = snap.you;
    document.getElementById("hud-ammo")!.textContent = y.reloading
      ? "RELOADING"
      : `${y.ammo} / ${y.reserves}`;
    const nadeName = (snap.loadout.grenade && ITEMS[snap.loadout.grenade.id]?.name) || "NADE";
    document.getElementById("hud-nade")!.textContent = `${nadeName.toUpperCase()} ×${y.grenades}`;
    const wpn = document.querySelector(".weapon strong");
    if (wpn) wpn.textContent = `${y.weaponName || "STITCH"} · ${(y.fireMode || "auto").toUpperCase()}`;
    document.getElementById("crosshair")?.classList.toggle("ads", Boolean(y.ads));

    const zone = document.getElementById("zone-chip");
    if (zone && snap.zone) {
      zone.textContent = snap.zone.shrinking
        ? `CLOSING · ${snap.zone.phaseName}`
        : `${snap.zone.phaseName} · ${Math.ceil(snap.zone.waitLeft)}s`;
    }
    document.getElementById("downed")?.classList.toggle("hidden", !y.downed);

    const squad = document.getElementById("squad");
    if (squad) {
      const mates = [snap.you, ...snap.others].filter((p) => p.team === snap.you.team && !p.dummy);
      squad.innerHTML = mates
        .map((m) => {
          const st = m.eliminated ? "dead" : m.downed ? "down" : m.speaking ? "talk" : "";
          const dist = Math.round(Math.hypot(m.x - y.x, m.z - y.z));
          return `<div class="${st}"><i></i>${escapeHtml(m.name)} ${m.downed ? "DOWN" : m.eliminated ? "OUT" : Math.round(m.health)} · ${dist}m</div>`;
        })
        .join("");
    }
    this.drawCompass(y.yaw, snap);

    const bar = document.getElementById("loadout");
    if (bar && snap.loadout) {
      const L = snap.loadout;
      const cells = [
        ["1 PRI", L.primary ?? "—", L.active === "primary"],
        ["2 PIS", L.secondary, L.active === "secondary"],
        ["3 MEL", L.melee, L.active === "melee"],
        ["G", L.grenade ? `${ITEMS[L.grenade.id]?.name ?? "NADE"} ${L.grenade.qty}` : "—", false],
        ["Q", L.medical ? `${L.medical.id} ${L.medical.qty}` : "—", false],
      ];
      bar.innerHTML = cells
        .map((c) => `<div class="slot-br ${c[2] ? "on" : ""}"><b>${c[0]}</b><div>${c[1]}</div></div>`)
        .join("");
    }
    this.drawMinimap(snap);
  }

  showLoading(map: string): void {
    const el = document.getElementById("loading");
    if (!el) return;
    el.classList.remove("hidden");
    const m = document.getElementById("load-map");
    if (m) m.textContent = map;
  }

  hideLoading(): void {
    document.getElementById("loading")?.classList.add("hidden");
  }

  showIntro(data: {
    mapName: string;
    weather?: string;
    matchNumber: number;
    alpha: { name: string; rank: string; character: string }[];
    bravo: { name: string; rank: string; character: string }[];
  }): void {
    this.hideLoading();
    const el = document.getElementById("intro");
    if (!el) return;
    el.classList.remove("hidden");
    document.getElementById("intro-match")!.textContent = `MATCH #${data.matchNumber}`;
    document.getElementById("intro-map")!.textContent = data.weather
      ? `${data.mapName}`
      : data.mapName;
    document.getElementById("intro-alpha")!.innerHTML =
      `<strong>ALPHA</strong>` + data.alpha.map((p) => `<b>${escapeHtml(p.name)}</b><em>${p.rank} · ${p.character}</em>`).join("");
    document.getElementById("intro-bravo")!.innerHTML =
      `<strong>BRAVO</strong>` + data.bravo.map((p) => `<b>${escapeHtml(p.name)}</b><em>${p.rank} · ${p.character}</em>`).join("");
    window.setTimeout(() => el.classList.add("hidden"), 8000);
  }

  killCard(text: string): void {
    const el = document.getElementById("killcard");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  chatLine(from: string, text: string): void {
    const el = document.getElementById("comms");
    if (el) el.textContent = `${from}: ${text}`;
    const log = document.getElementById("party-log");
    if (log) {
      const row = document.createElement("div");
      row.textContent = `${from}: ${text}`;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
  }

  private drawMinimap(snap: Snapshot): void {
    const c = document.getElementById("minimap") as HTMLCanvasElement | null;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width;
    const world = snap.mapId && snap.mapId !== "range" ? worldById(snap.mapId) : null;
    const half = world?.half ?? 64;
    ctx.fillStyle = world?.mapId === "red_sands" ? "#2a2014" : world?.mapId === "frost_haven" ? "#1a2430" : "#07090f";
    ctx.fillRect(0, 0, W, W);
    const to = (x: number, z: number) => [((x + half) / (half * 2)) * W, ((z + half) / (half * 2)) * W] as const;
    if (world) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.font = "7px sans-serif";
      for (const lm of world.landmarks) {
        const [x, z] = to(lm.x, lm.z);
        ctx.fillRect(x - 1, z - 1, 2, 2);
        ctx.fillText(lm.name[0], x + 2, z - 1);
      }
    }
    if (snap.zone) {
      ctx.strokeStyle = "rgba(255,193,77,0.85)";
      ctx.beginPath();
      const [cx, cz] = to(snap.zone.cx, snap.zone.cz);
      ctx.arc(cx, cz, (snap.zone.radius / (half * 2)) * W, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(61,255,192,0.35)";
      ctx.beginPath();
      const [nx, nz] = to(snap.zone.nextCx, snap.zone.nextCz);
      ctx.arc(nx, nz, (snap.zone.nextRadius / (half * 2)) * W, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const g of snap.pings || []) {
      const [x, z] = to(g.x, g.z);
      ctx.strokeStyle = g.kind === "enemy" || g.kind === "danger" ? "#ff4d6a" : "#3dffc0";
      ctx.beginPath();
      ctx.arc(x, z, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of [snap.you, ...snap.others]) {
      if (p.dummy || p.eliminated) continue;
      const [x, z] = to(p.x, p.z);
      ctx.fillStyle = p.id === snap.you.id ? "#fff" : p.team === snap.you.team ? "#3dffc0" : "#ff4d6a";
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
  }

  setProfile(p: ProfileState, c: CurrencyState): void {
    document.getElementById("d-name")!.textContent = p.name;
    const idEl = document.getElementById("d-id");
    if (idEl) idEl.textContent = p.id;
    const pill = document.getElementById("id-pill");
    if (pill) pill.textContent = p.id;
    document.getElementById("d-level")!.textContent = String(p.level);
    document.getElementById("d-rank")!.textContent = p.rank;
    const titleEl = document.getElementById("d-title");
    if (titleEl) titleEl.textContent = (p.title || "ROOKIE").toUpperCase();
    document.getElementById("d-mmr")!.textContent = String(Math.round(p.mmr));
    document.getElementById("d-clan")!.textContent = p.clanTag || "—";
    document.getElementById("d-soft")!.textContent = String(c.soft);
    const hardEl = document.getElementById("d-hard");
    if (hardEl) hardEl.textContent = String(c.hard);
    document.getElementById("d-wl")!.textContent = `${p.stats.wins} / ${p.stats.losses}`;
    document.getElementById("d-kd")!.textContent = `${p.stats.kills} / ${p.stats.deaths}`;
    document.getElementById("d-xp-fill")!.style.width = `${Math.round(levelProgress(p.xp) * 100)}%`;
    document.getElementById("hud-soft")!.textContent = String(c.soft);
    const hh = document.getElementById("hud-hard");
    if (hh) hh.textContent = String(c.hard);
    const st = document.getElementById("d-status");
    if (st) st.textContent = this.netPill.classList.contains("live") ? "LIVE" : "OFFLINE";
  }

  setInventory(slots: InventorySlot[], onUse: (id: string) => void): void {
    const root = document.getElementById("inv-slots")!;
    root.innerHTML = "";
    for (const s of slots) {
      if (s.qty <= 0) continue;
      const def = ITEMS[s.itemId];
      const el = document.createElement("button");
      el.className = "slot";
      el.innerHTML = `<b>${def?.name ?? s.itemId}</b><em>×${s.qty}</em>`;
      el.addEventListener("click", () => onUse(s.itemId));
      root.appendChild(el);
    }
  }

  flashHit(): void {
    this.hitmarker.classList.remove("on");
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add("on");
  }

  flashHurt(): void {
    this.hurt.classList.add("on");
    window.setTimeout(() => this.hurt.classList.remove("on"), 180);
  }

  say(text: string): void {
    this.announce.textContent = text;
    this.announce.classList.remove("show");
    void this.announce.offsetWidth;
    this.announce.classList.add("show");
  }

  feed(text: string): void {
    const row = document.createElement("div");
    row.textContent = text;
    this.killfeed.prepend(row);
    while (this.killfeed.children.length > 5) this.killfeed.lastChild?.remove();
    window.setTimeout(() => row.remove(), 3500);
  }

  setQueue(on: boolean, text?: string): void {
    this.queueNote.classList.toggle("hidden", !on);
    if (text) this.queueNote.textContent = text;
  }

  showSearch(s: SearchUpdate): void {
    this.search.classList.remove("hidden");
    this.found.classList.add("hidden");
    document.getElementById("s-found")!.textContent = `${s.playersFound} / ${s.playersNeeded}`;
    document.getElementById("s-mix")!.textContent = `${s.humans} / ${s.bots}`;
    document.getElementById("s-region")!.textContent = s.regionName.toUpperCase();
    document.getElementById("s-ping")!.textContent = `${Math.round(s.ping)} ms`;
    document.getElementById("s-eta")!.textContent = fmtTime(s.etaMs / 1000);
    const note = document.getElementById("s-note");
    if (note) note.textContent = s.note || "";
    const alt = document.getElementById("s-alt");
    if (alt) alt.classList.toggle("hidden", !s.alt);
    const h2 = this.search.querySelector("h2");
    if (h2) h2.textContent = s.mode === "ranked" ? "SEARCHING RANKED…" : "SEARCHING FOR PLAYERS…";
    const span = s.mode === "ranked" ? 120000 : 8000;
    const pct = 1 - Math.min(1, s.etaMs / span);
    (document.getElementById("search-fill") as HTMLElement).style.width = `${Math.round(pct * 100)}%`;
  }

  hideSearch(): void {
    this.search.classList.add("hidden");
  }

  showOffer(o: MatchOffer): void {
    this.search.classList.add("hidden");
    this.found.classList.remove("hidden");
    document.getElementById("found-meta")!.textContent = `4v4 · ${o.regionName.toUpperCase()} · ${Math.round(o.ping)} ms`;
    document.getElementById("found-clock")!.textContent = String(Math.ceil(o.acceptMs / 1000));
  }

  hideOffer(): void {
    this.found.classList.add("hidden");
  }

  showLobby(l: LobbyState, me: string, onReady: () => void, onChar: (c: string) => void): void {
    this.found.classList.add("hidden");
    this.lobby.classList.remove("hidden");
    document.getElementById("lobby-clock")!.textContent = String(Math.ceil(l.remainMs / 1000));
    const root = document.getElementById("lobby-teams")!;
    root.innerHTML = `${teamCol("ALPHA", l.roster.filter((r) => r.team === "alpha"))}${teamCol("BRAVO", l.roster.filter((r) => r.team === "bravo"))}`;
    const readyBtn = document.getElementById("btn-lobby-ready")!;
    readyBtn.onclick = onReady;
    const mine = l.roster.find((r) => r.id === me);
    const chars = document.getElementById("char-picks")!;
    chars.innerHTML = "";
    for (const c of CHARACTERS) {
      const b = document.createElement("button");
      b.className = "btn slim" + (mine?.character === c ? " on" : "");
      b.textContent = c;
      b.onclick = () => onChar(c);
      chars.appendChild(b);
    }
  }

  hideLobby(): void {
    this.lobby.classList.add("hidden");
  }

  showResult(r: MatchResult): void {
    this.result.classList.remove("hidden");
    const title =
      r.winner === "none" ? "DRAW" : r.winner === "alpha" ? "ALPHA WINS" : "BRAVO WINS";
    document.getElementById("result-title")!.textContent = title;
    document.getElementById("result-sub")!.textContent =
      `MVP ${r.mvpName} · ${r.mapName ?? "YARD"} #${r.matchNumber ?? ""} · ${fmtTime(r.durationSec)}`;
    const rows = r.cards
      .map(
        (c) =>
          `<tr class="${c.mvp ? "mvp" : ""}"><td>${c.mvp ? "★ " : ""}${escapeHtml(c.name)}</td><td>${c.team}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.assists}</td><td>${c.revives ?? 0}</td><td>${c.accuracy}%</td><td>${c.damage}</td></tr>`,
      )
      .join("");
    document.getElementById("result-table")!.innerHTML =
      `<table><thead><tr><th>OP</th><th>TEAM</th><th>K</th><th>D</th><th>A</th><th>REV</th><th>ACC</th><th>DMG</th></tr></thead><tbody>${rows}</tbody></table>`;
    const extra = r.rewards.placing ? " · PLACEMENT" : "";
    const afk = r.rewards.afk ? " · AFK — NO XP" : "";
    document.getElementById("result-reward")!.textContent =
      `+${r.rewards.xp} XP · +${r.rewards.soft} ION · HR ${r.rewards.mmrDelta >= 0 ? "+" : ""}${Math.round(r.rewards.mmrDelta)}${extra}${afk}`;
  }

  setParty(p: PartyState | null): void {
    const strip = document.getElementById("party-strip")!;
    const list = document.getElementById("party-list");
    if (!p) {
      strip.innerHTML = "";
      if (list) list.innerHTML = "";
      return;
    }
    const mode = (document.getElementById("party-mode") as HTMLSelectElement | null);
    if (mode && p.mode) mode.value = p.mode;
    strip.innerHTML = p.members
      .map((m) => `<span class="chip ${m.bot ? "bot" : ""} ${m.leader ? "you" : ""}">${escapeHtml(m.name)}${m.leader ? " ★" : ""}</span>`)
      .join("");
    if (list) {
      list.innerHTML = p.members
        .map(
          (m) =>
            `<div class="row"><div><b>${escapeHtml(m.name)}</b><div class="fine">${m.rank} · ${m.character} · ${(m.presence || "online").toUpperCase()}</div></div>${
              p.leaderId !== m.id
                ? `<button class="btn slim" data-kick="${m.id}">KICK</button>`
                : "<span class=\"fine\">LEAD</span>"
            }</div>`,
        )
        .join("");
    }
  }

  setFriends(friends: FriendPublic[], onInvite: (id: string, kind: "party" | "friend") => void, filter = "all"): void {
    const list = document.getElementById("friend-list");
    if (!list) return;
    const shown = friends.filter((f) => {
      if (filter === "online") return f.online && f.presence !== "match";
      if (filter === "offline") return !f.online;
      if (filter === "match") return f.presence === "match";
      if (filter === "free") return f.online && (f.presence === "online" || f.activity === "AVAILABLE");
      if (filter === "fav") return Boolean(f.favorite);
      return true;
    });
    list.innerHTML = shown
      .map(
        (f) =>
          `<div class="row"><div><b>${f.favorite ? "★ " : ""}${escapeHtml(f.name)}</b><div class="fine">${escapeHtml(f.activity || (f.online ? "ONLINE" : "OFFLINE"))} · ${f.rank}${f.bot ? " · CONTACT" : ""} · ${f.id}</div></div><div class="inline tight"><button class="btn slim" data-inv="${f.id}">INVITE</button><button class="btn slim" data-fav="${f.id}">${f.favorite ? "UNPIN" : "PIN"}</button><button class="btn slim" data-rm="${f.id}">REMOVE</button><button class="btn slim" data-blk="${f.id}">BLOCK</button></div></div>`,
      )
      .join("") || `<div class="fine">NO OPERATORS IN THIS FILTER</div>`;
    list.querySelectorAll<HTMLElement>("[data-inv]").forEach((b) => {
      b.onclick = () => onInvite(b.dataset.inv!, "party");
    });
  }

  setPack(
    pack: SocialPack,
    hooks: {
      invite: (id: string) => void;
      accept: (id: string) => void;
      reject: (id: string) => void;
      cancel: (id: string) => void;
      fav: (id: string, on: boolean) => void;
      remove: (id: string) => void;
      block: (id: string) => void;
      unblock: (id: string) => void;
      request: (id: string) => void;
      clanInvite: (id: string) => void;
      clanKick: (id: string) => void;
      report: (id: string) => void;
    },
    filter = "all",
  ): void {
    this.setFriends(pack.friends, (id) => hooks.invite(id), filter);
    const req = document.getElementById("req-list");
    if (req) {
      const inRows = pack.incoming.map(
        (r) =>
          `<div class="row"><div><b>${escapeHtml(r.name)}</b><div class="fine">INCOMING · ${r.id}</div></div><div class="inline tight"><button class="btn slim" data-ok="${r.id}">ACCEPT</button><button class="btn slim" data-no="${r.id}">REJECT</button></div></div>`,
      );
      const outRows = pack.outgoing.map(
        (r) =>
          `<div class="row"><div><b>${escapeHtml(r.name)}</b><div class="fine">OUTGOING</div></div><button class="btn slim" data-cx="${r.id}">CANCEL</button></div>`,
      );
      req.innerHTML = [...inRows, ...outRows].join("");
      req.querySelectorAll<HTMLElement>("[data-ok]").forEach((b) => (b.onclick = () => hooks.accept(b.dataset.ok!)));
      req.querySelectorAll<HTMLElement>("[data-no]").forEach((b) => (b.onclick = () => hooks.reject(b.dataset.no!)));
      req.querySelectorAll<HTMLElement>("[data-cx]").forEach((b) => (b.onclick = () => hooks.cancel(b.dataset.cx!)));
    }
    const list = document.getElementById("friend-list");
    list?.querySelectorAll<HTMLElement>("[data-fav]").forEach((b) => {
      const id = b.dataset.fav!;
      const on = pack.friends.find((f) => f.id === id)?.favorite;
      b.onclick = () => hooks.fav(id, !on);
    });
    list?.querySelectorAll<HTMLElement>("[data-rm]").forEach((b) => (b.onclick = () => hooks.remove(b.dataset.rm!)));
    list?.querySelectorAll<HTMLElement>("[data-blk]").forEach((b) => (b.onclick = () => hooks.block(b.dataset.blk!)));

    const sug = document.getElementById("suggest-list");
    if (sug) {
      sug.innerHTML = pack.suggest.map((h) => findRow(h)).join("") || `<div class="fine">NO SUGGESTIONS</div>`;
      bindFind(sug, hooks);
    }
    const rec = document.getElementById("recent-list");
    if (rec) {
      rec.innerHTML =
        pack.recent
          .map(
            (r) =>
              `<div class="row"><div><b>${escapeHtml(r.name)}</b><div class="fine">${r.team.toUpperCase()} · ${r.result.toUpperCase()} · ${r.matchId}</div></div><div class="inline tight"><button class="btn slim" data-add="${r.id}">ADD</button><button class="btn slim" data-inv="${r.id}">INVITE</button><button class="btn slim" data-blk="${r.id}">BLOCK</button><button class="btn slim" data-rep="${r.id}">REPORT</button></div></div>`,
          )
          .join("") || `<div class="fine">NO RECENT PLAYERS</div>`;
      rec.querySelectorAll<HTMLElement>("[data-add]").forEach((b) => (b.onclick = () => hooks.request(b.dataset.add!)));
      rec.querySelectorAll<HTMLElement>("[data-inv]").forEach((b) => (b.onclick = () => hooks.invite(b.dataset.inv!)));
      rec.querySelectorAll<HTMLElement>("[data-blk]").forEach((b) => (b.onclick = () => hooks.block(b.dataset.blk!)));
      rec.querySelectorAll<HTMLElement>("[data-rep]").forEach((b) => (b.onclick = () => hooks.report(b.dataset.rep!)));
    }
    const blocks = document.getElementById("block-list");
    if (blocks) {
      blocks.innerHTML =
        pack.blocked
          .map((b) => `<div class="row"><div><b>${escapeHtml(b.name)}</b><div class="fine">${b.id}</div></div><button class="btn slim" data-ub="${b.id}">UNBLOCK</button></div>`)
          .join("") || `<div class="fine">NO BLOCKS</div>`;
      blocks.querySelectorAll<HTMLElement>("[data-ub]").forEach((b) => (b.onclick = () => hooks.unblock(b.dataset.ub!)));
    }
    const card = document.getElementById("clan-card");
    const clanList = document.getElementById("clan-list");
    if (card) {
      if (!pack.clan) card.textContent = "NO CLAN — FOUND ONE BELOW. CAP 50. RANK IS RATING / WINS / ACTIVITY, NEVER SPEND.";
      else card.textContent = `[${pack.clan.tag}] ${pack.clan.name} · L${pack.clan.level} · ${pack.clan.role.toUpperCase()} · ${pack.clan.announce || "NO ANNOUNCE"}`;
    }
    if (clanList) {
      clanList.innerHTML = pack.clan
        ? pack.clan.members
            .map(
              (m) =>
                `<div class="row"><div><b>${escapeHtml(m.name)}</b><div class="fine">${m.role.toUpperCase()} · ${m.online ? "ONLINE" : "OFF"}</div></div><div class="inline tight"><button class="btn slim" data-cinv="${m.id}">INVITE</button><button class="btn slim" data-ck="${m.id}">KICK</button></div></div>`,
            )
            .join("")
        : "";
      clanList.querySelectorAll<HTMLElement>("[data-cinv]").forEach((b) => (b.onclick = () => hooks.invite(b.dataset.cinv!)));
      clanList.querySelectorAll<HTMLElement>("[data-ck]").forEach((b) => (b.onclick = () => hooks.clanKick(b.dataset.ck!)));
    }
    const inv = document.getElementById("priv-invites") as HTMLSelectElement | null;
    const wh = document.getElementById("priv-whispers") as HTMLSelectElement | null;
    const on = document.getElementById("priv-online") as HTMLInputElement | null;
    const mt = document.getElementById("priv-match") as HTMLInputElement | null;
    const fr = document.getElementById("priv-friends") as HTMLInputElement | null;
    const pr = document.getElementById("set-presence") as HTMLSelectElement | null;
    if (inv) inv.value = pack.privacy.invites;
    if (wh) wh.value = pack.privacy.whispers;
    if (on) on.checked = pack.privacy.showOnline;
    if (mt) mt.checked = pack.privacy.showMatch;
    if (fr) fr.checked = pack.privacy.showFriends;
    if (pr) pr.value = pack.presence;
  }

  setFind(hits: FindHit[], hooks: { request: (id: string) => void; invite: (id: string) => void; block: (id: string) => void }): void {
    const list = document.getElementById("find-list");
    if (!list) return;
    list.innerHTML = hits.map((h) => findRow(h)).join("") || `<div class="fine">NO HITS — TRY A PERMANENT ID</div>`;
    bindFind(list, hooks);
  }

  pushInvite(inv: InvitePublic, onRespond: (id: string, accept: boolean) => void): void {
    const root = document.getElementById("invites")!;
    const card = document.createElement("div");
    card.className = "invite-card";
    card.innerHTML = `<strong>${inv.kind.toUpperCase()} INVITE</strong><p>${escapeHtml(inv.detail)}</p><div class="cta-row"><button class="btn slim primary" data-a="1">ACCEPT</button><button class="btn slim" data-a="0">DECLINE</button></div>`;
    card.querySelector("[data-a='1']")!.addEventListener("click", () => {
      onRespond(inv.id, true);
      card.remove();
    });
    card.querySelector("[data-a='0']")!.addEventListener("click", () => {
      onRespond(inv.id, false);
      card.remove();
    });
    root.appendChild(card);
    window.setTimeout(() => card.remove(), inv.expiresIn || 60000);
  }

  openSocial(open: boolean): void {
    this.social.classList.toggle("hidden", !open);
  }

  showReconnect(on: boolean): void {
    this.reconnect.classList.toggle("hidden", !on);
  }

  setScoreboard(snap: Snapshot, show: boolean): void {
    const el = document.getElementById("scoreboard")!;
    el.classList.toggle("hidden", !show);
    if (!show) return;
    const rows = [snap.you, ...snap.others]
      .filter((p) => !p.dummy)
      .map(
        (p) =>
          `<tr class="${p.team === "alpha" ? "a" : "b"}"><td>${escapeHtml(p.name)}</td><td>${p.team}</td><td>${Math.round(p.health)}</td><td>${p.rank}</td></tr>`,
      )
      .join("");
    el.innerHTML = `<table><thead><tr><th>OP</th><th>TEAM</th><th>HP</th><th>RANK</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  bindSettings(s: Settings, caps: CapReport, onChange: (next: Settings) => void): void {
    const val = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    const q = val("set-quality") as HTMLSelectElement;
    const fps = val("set-fps") as HTMLSelectElement;
    const sens = val("set-sens") as HTMLInputElement;
    const inv = val("set-invert") as HTMLInputElement;
    const show = val("set-fps-show") as HTMLInputElement;
    const fs = val("set-fullscreen") as HTMLInputElement;
    const master = val("set-master") as HTMLInputElement;
    const sfx = val("set-sfx") as HTMLInputElement;
    const cb = val("set-cb") as HTMLSelectElement | null;
    const left = val("set-left") as HTMLInputElement | null;
    q.value = s.quality === "vlow" ? "potato" : s.quality === "vhigh" ? "ultra" : s.quality;
    fps.value = String(s.fpsCap);
    sens.value = String(s.sensitivity);
    inv.checked = s.invertY;
    show.checked = s.showFps;
    fs.checked = s.preferFullscreen;
    master.value = String(s.master);
    sfx.value = String(s.sfx);
    if (cb) cb.value = s.colorblind || "none";
    if (left) left.checked = Boolean(s.leftHanded);
    const music = val("set-music") as HTMLInputElement | null;
    const uivol = val("set-uivol") as HTMLInputElement | null;
    const voice = val("set-voice") as HTMLInputElement | null;
    const ads = val("set-ads") as HTMLInputElement | null;
    const stick = val("set-stick") as HTMLInputElement | null;
    const gyro = val("set-gyro") as HTMLInputElement | null;
    const rumble = val("set-rumble") as HTMLInputElement | null;
    const lang = val("set-lang") as HTMLSelectElement | null;
    const uiscale = val("set-uiscale") as HTMLInputElement | null;
    const text = val("set-text") as HTMLInputElement | null;
    const contrast = val("set-contrast") as HTMLInputElement | null;
    const noshake = val("set-noshake") as HTMLInputElement | null;
    const noflash = val("set-noflash") as HTMLInputElement | null;
    const subs = val("set-subs") as HTMLInputElement | null;
    const hits = val("set-hits") as HTMLInputElement | null;
    const dmg = val("set-dmg") as HTMLInputElement | null;
    const autos = val("set-autosprint") as HTMLInputElement | null;
    const autop = val("set-autopick") as HTMLInputElement | null;
    const res = val("set-res") as HTMLInputElement | null;
    const aa = val("set-aa") as HTMLInputElement | null;
    const weapon = val("set-weapon") as HTMLInputElement | null;
    const env = val("set-env") as HTMLInputElement | null;
    const charvol = val("set-charvol") as HTMLInputElement | null;
    const chatvol = val("set-chatvol") as HTMLInputElement | null;
    const spatial = val("set-spatial") as HTMLInputElement | null;
    const mono = val("set-mono") as HTMLInputElement | null;
    const charvoice = val("set-charvoice") as HTMLInputElement | null;
    if (music) music.value = String(s.music);
    if (uivol) uivol.value = String(s.uiVol);
    if (voice) voice.value = String(s.voice);
    if (ads) ads.value = String(s.adsSens);
    if (stick) stick.value = String(s.stickSens);
    if (gyro) gyro.checked = s.gyro;
    if (rumble) rumble.checked = s.rumble;
    if (lang) lang.value = s.lang;
    if (uiscale) uiscale.value = String(s.uiScale);
    if (text) text.value = String(s.textScale);
    if (contrast) contrast.checked = s.highContrast;
    if (noshake) noshake.checked = s.reduceShake;
    if (noflash) noflash.checked = s.reduceFlash;
    if (subs) subs.checked = s.subtitles;
    if (hits) hits.checked = s.hitMarkers;
    if (dmg) dmg.checked = s.dmgNumbers;
    if (autos) autos.checked = s.autoSprint;
    if (autop) autop.checked = s.autoPickup;
    if (res) res.value = String(s.resolutionScale);
    if (aa) aa.checked = s.aa;
    if (weapon) weapon.value = String(s.weaponVol);
    if (env) env.value = String(s.envVol);
    if (charvol) charvol.value = String(s.charVol);
    if (chatvol) chatvol.value = String(s.chatVol);
    if (spatial) spatial.checked = s.spatial;
    if (mono) mono.checked = s.mono;
    if (charvoice) charvoice.checked = s.charVoice;
    document.getElementById("cap-summary")!.textContent =
      `GPU ${caps.gpu} · ${caps.cores} cores · ~${caps.memoryGB} GB · ${caps.refreshHz} Hz · auto=${caps.recommended.toUpperCase()}` +
      (caps.webgpu ? " · WEBGPU READY" : " · WEBGL2");
    this.fillBinds(s, onChange);

    const flush = () => {
      const next: Settings = {
        ...s,
        quality: q.value as Settings["quality"],
        fpsCap: Number(fps.value) as Settings["fpsCap"],
        sensitivity: Number(sens.value),
        invertY: inv.checked,
        showFps: show.checked,
        preferFullscreen: fs.checked,
        master: Number(master.value),
        sfx: Number(sfx.value),
        colorblind: (cb?.value as Settings["colorblind"]) || "none",
        leftHanded: Boolean(left?.checked),
        music: music ? Number(music.value) : s.music,
        uiVol: uivol ? Number(uivol.value) : s.uiVol,
        voice: voice ? Number(voice.value) : s.voice,
        adsSens: ads ? Number(ads.value) : s.adsSens,
        stickSens: stick ? Number(stick.value) : s.stickSens,
        gyro: Boolean(gyro?.checked),
        rumble: rumble ? rumble.checked : s.rumble,
        lang: (lang?.value as Settings["lang"]) || s.lang,
        uiScale: uiscale ? Number(uiscale.value) : s.uiScale,
        textScale: text ? Number(text.value) : s.textScale,
        highContrast: Boolean(contrast?.checked),
        reduceShake: Boolean(noshake?.checked),
        reduceFlash: Boolean(noflash?.checked),
        subtitles: Boolean(subs?.checked),
        hitMarkers: hits ? hits.checked : s.hitMarkers,
        dmgNumbers: dmg ? dmg.checked : s.dmgNumbers,
        autoSprint: Boolean(autos?.checked),
        autoPickup: Boolean(autop?.checked),
        resolutionScale: res ? Number(res.value) : s.resolutionScale,
        aa: aa ? aa.checked : s.aa,
      };
      onChange(next);
    };
    const els = [q, fps, sens, inv, show, fs, master, sfx, cb, left, music, uivol, voice, ads, stick, gyro, rumble, lang, uiscale, text, contrast, noshake, noflash, subs, hits, dmg, autos, autop, res, aa, weapon, env, charvol, chatvol, spatial, mono, charvoice].filter(Boolean) as HTMLElement[];
    els.forEach((el) => el.addEventListener("change", flush));
    [sens, master, sfx, music, uivol, voice, ads, stick, uiscale, text, res, weapon, env, charvol, chatvol].forEach((el) => el?.addEventListener("input", flush));
  }

  private fillBinds(s: Settings, onChange: (next: Settings) => void): void {
    const list = document.getElementById("bind-list");
    if (!list) return;
    const acts = Object.keys(DEFAULT_BINDS) as InputAction[];
    list.innerHTML = acts
      .map((a) => `<div class="row"><b>${a.toUpperCase()}</b><button class="btn slim" data-bind="${a}">${s.binds[a] || DEFAULT_BINDS[a]}</button></div>`)
      .join("");
    list.querySelectorAll<HTMLElement>("[data-bind]").forEach((b) => {
      b.onclick = () => {
        b.textContent = "…";
        const once = (e: KeyboardEvent) => {
          window.removeEventListener("keydown", once, true);
          e.preventDefault();
          const act = b.dataset.bind as InputAction;
          onChange({ ...s, binds: { ...s.binds, [act]: e.code } });
          b.textContent = e.code;
        };
        window.addEventListener("keydown", once, true);
      };
    });
  }

  toast(kind: string, text: string): void {
    const root = document.getElementById("toasts");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = `<strong>${kind.toUpperCase()}</strong><p>${escapeHtml(text)}</p>`;
    root.appendChild(el);
    window.setTimeout(() => el.remove(), 4200);
  }

  showFault(title: string, onRetry: () => void, onRecon: () => void, onLobby: () => void): void {
    const el = document.getElementById("fault");
    if (!el) return;
    el.classList.remove("hidden");
    document.getElementById("fault-title")!.textContent = title;
    document.getElementById("fault-retry")!.onclick = onRetry;
    document.getElementById("fault-recon")!.onclick = onRecon;
    document.getElementById("fault-lobby")!.onclick = onLobby;
  }

  hideFault(): void {
    document.getElementById("fault")?.classList.add("hidden");
  }

  openSheet(id: string, open: boolean): void {
    document.getElementById(id)?.classList.toggle("hidden", !open);
  }

  fillStore(
    lane: string,
    wallet: { ion: number; orbit: number; owned: string[]; featured?: string[] },
    onBuy: (sku: string) => void,
  ): void {
    const g = document.getElementById("store-grid");
    if (!g) return;
    const ion = document.getElementById("store-ion");
    const orb = document.getElementById("store-orbit");
    if (ion) ion.textContent = "ION " + wallet.ion;
    if (orb) orb.textContent = "ORBIT " + wallet.orbit;
    const featured = new Set(wallet.featured || []);
    const rows = VAULT.filter((v) => {
      if (lane === "featured") return featured.has(v.id) || v.kind === "topup";
      if (lane === "pass") return v.lane === "pass" || v.kind === "pass";
      return v.lane === lane;
    });
    g.innerHTML = rows
      .map((c) => {
        const own = wallet.owned.includes(c.id);
        const price = c.kind === "topup" ? "SANDBOX" : c.price === 0 ? "FREE" : c.price + " " + c.coin.toUpperCase();
        return `<button class="op-card" data-sku="${c.id}"><b>${c.name}</b><em>${c.rarity.toUpperCase()} · ${c.collection}</em><p>${c.desc}</p><span>${own ? "OWNED" : price} · NO POWER</span></button>`;
      })
      .join("") || `<div class="fine">EMPTY LANE</div>`;
    g.querySelectorAll<HTMLElement>("[data-sku]").forEach((b) => {
      b.onclick = () => {
        const q = quoteOf(b.dataset.sku || "");
        const box = document.getElementById("store-quote");
        if (box && q) {
          box.textContent = q.name + " x" + q.qty + " · " + q.coin.toUpperCase() + " " + q.total + (q.save ? " · save " + q.save : "") + " · " + q.restriction;
        }
        if (!wallet.owned.includes(b.dataset.sku || "")) onBuy(b.dataset.sku || "");
      };
    });
  }

  fillMail(notes: { kind: string; text: string }[], filter: string): void {
    const list = document.getElementById("mail-list");
    if (!list) return;
    const rows = notes.filter((n) => filter === "system" || n.kind === filter || (filter === "friends" && n.kind === "friend"));
    list.innerHTML = rows.map((n) => `<div class="row"><div><b>${n.kind.toUpperCase()}</b><div class="fine">${escapeHtml(n.text)}</div></div></div>`).join("") || `<div class="fine">${t("mail_empty")}</div>`;
  }

  fillLive(
    data: {
      rule?: string;
      version?: string;
      launch?: string;
      season?: { id: number; name: string; theme: string; state: string };
      events?: { id: string; name: string; note: string; ionMul: number }[];
      notes?: { version: string; title: string; at: string; fixes: string[]; balance: string[]; content: string[]; known: string[] }[];
      features?: { id: string; name: string; state: string; note: string }[];
      counts?: { implemented: number; partial: number; not_yet: number };
      pipeline?: string[];
      feedback?: string[];
    },
    pane: "live" | "notes",
    onSend?: (kind: string, sev: string, text: string) => void,
  ): void {
    const list = document.getElementById("mail-list");
    if (!list) return;
    const season = data.season;
    const notes = data.notes || [];
    if (pane === "notes") {
      list.innerHTML =
        notes
          .map((n) => {
            const block = (title: string, rows: string[]) =>
              rows.length ? `<div class="fine"><b>${title}</b> ${rows.map(escapeHtml).join(" · ")}</div>` : "";
            return `<div class="row"><div><b>${escapeHtml(n.version)} · ${escapeHtml(n.title)}</b><div class="fine">${escapeHtml(n.at)}</div>${block("FIXES", n.fixes)}${block("BALANCE", n.balance)}${block("CONTENT", n.content)}${block("KNOWN", n.known)}</div></div>`;
          })
          .join("") || `<div class="fine">${t("mail_empty")}</div>`;
      return;
    }
    const counts = data.counts || { implemented: 0, partial: 0, not_yet: 0 };
    const events =
      (data.events || [])
        .map((e) => `<div class="row"><div><b>${escapeHtml(e.name)}</b><div class="fine">${escapeHtml(e.note)} · ION ×${e.ionMul} · MM UNCHANGED</div></div></div>`)
        .join("") || `<div class="fine">NO LIVE EVENT — MATCHMAKING UNCHANGED</div>`;
    const feats = (data.features || [])
      .map(
        (f) =>
          `<div class="row"><div><b>${escapeHtml(f.name)}</b><div class="fine">${escapeHtml(f.note)}</div></div><span class="st ${escapeHtml(f.state)}">${f.state.replace("_", " ").toUpperCase()}</span></div>`,
      )
      .join("");
    const kinds = (data.feedback || ["bug", "suggest", "balance", "support", "security"])
      .map((k) => `<option value="${escapeHtml(k)}">${k.toUpperCase()}</option>`)
      .join("");
    list.innerHTML = `
      <div class="row"><div><b>S${season?.id ?? 1} ${escapeHtml((season?.name || "ORBIT").toUpperCase())}</b><div class="fine">${escapeHtml(season?.theme || "")} · ${(season?.state || "live").toUpperCase()} · HELIX ${escapeHtml(data.version || "")}</div></div><span class="st ${(data.launch || "not_yet").replace("_", "-")}">${(data.launch || "not_yet").replace("_", " ").toUpperCase()}</span></div>
      <p class="fine">${escapeHtml(data.rule || t("live_launch"))}</p>
      <p class="fine">${t("live_launch")}</p>
      <p class="fine">IMPLEMENTED ${counts.implemented} · PARTIAL ${counts.partial} · NOT YET ${counts.not_yet}</p>
      ${events}
      <div class="live-grid">${feats}</div>
      <p class="fine">${t("live_feedback").toUpperCase()} · ${t("live_never_pw")}</p>
      <div class="live-form">
        <label>KIND <select id="fb-kind">${kinds}</select></label>
        <label>SEV <select id="fb-sev"><option>critical</option><option>high</option><option selected>medium</option><option>low</option><option>cosmetic</option></select></label>
        <textarea id="fb-text" maxlength="400" rows="3" placeholder="${t("live_never_pw")}"></textarea>
        <button id="fb-send" class="btn slim primary">${t("live_send")}</button>
      </div>`;
    const send = document.getElementById("fb-send");
    if (send && onSend) {
      send.onclick = () => {
        const kind = (document.getElementById("fb-kind") as HTMLSelectElement | null)?.value || "suggest";
        const sev = (document.getElementById("fb-sev") as HTMLSelectElement | null)?.value || "medium";
        const text = (document.getElementById("fb-text") as HTMLTextAreaElement | null)?.value || "";
        onSend(kind, sev, text);
      };
    }
  }

  fillInvSheet(slots: InventorySlot[]): void {
    const g = document.getElementById("inv-grid");
    if (!g) return;
    g.innerHTML = slots.map((s) => `<div class="row"><b>${ITEMS[s.itemId]?.name || s.itemId}</b><span>×${s.qty}</span></div>`).join("") || `<div class="fine">EMPTY</div>`;
  }

  setInputDevice(kind: string): void {
    const el = document.getElementById("input-pill");
    if (el) el.textContent = kind.toUpperCase();
  }

  private drawCompass(yaw: number, snap: Snapshot): void {
    const el = document.getElementById("compass");
    if (!el) return;
    const deg = ((yaw * 180) / Math.PI + 360) % 360;
    const marks = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round(deg / 45) % 8;
    const ping = (snap.pings || [])[0];
    const pingTxt = ping ? ` · ${ping.kind.toUpperCase()}` : "";
    el.innerHTML = `<b>${marks[idx]}</b>  ${Math.round(deg)}°${pingTxt}`;
  }

  flashDir(fromX: number, fromZ: number, youX: number, youZ: number, youYaw: number): void {
    const el = document.getElementById("dmg-dir");
    if (!el) return;
    const ang = Math.atan2(fromX - youX, fromZ - youZ) - youYaw;
    el.style.setProperty("--dir", `${(ang * 180) / Math.PI}deg`);
    el.classList.add("on");
    window.setTimeout(() => el.classList.remove("on"), 280);
  }

  openSettings(open: boolean): void {
    this.settings.classList.toggle("hidden", !open);
  }

  openPause(open: boolean): void {
    this.pause.classList.toggle("hidden", !open);
  }

  openBarracks(
    open: boolean,
    profile: ProfileState | null,
    onPick: (character: string, appearance: Appearance) => void,
    history: { mapName: string; winner: string; durationSec: number }[] = [],
  ): void {
    const el = document.getElementById("barracks");
    if (!el) return;
    el.classList.toggle("hidden", !open);
    if (!open || !profile) return;
    const grid = document.getElementById("op-grid");
    if (grid) {
      grid.innerHTML = OPERATORS.map((o) => {
        const on = profile.character === o.id ? "on" : "";
        return `<button class="op-card ${on}" data-op="${o.id}"><b>${o.callsign}</b><em>${o.name} · ${o.body.toUpperCase()}</em><p>${o.personality}</p><span>${o.voiceLine}</span></button>`;
      }).join("");
      grid.querySelectorAll<HTMLElement>("[data-op]").forEach((b) => {
        b.onclick = () => onPick(b.dataset.op!, { ...(profile.appearance || defaultAppearance()) });
      });
    }
    const cg = document.getElementById("cosmetic-grid");
    if (cg) {
      const a = profile.appearance || defaultAppearance();
      cg.innerHTML = (["hair", "skin", "eyes", "face"] as const)
        .map((k) => `<label>${k}<input data-cos="${k}" type="range" min="0" max="5" step="1" value="${a[k]}" /></label>`)
        .join("");
      cg.innerHTML += COSMETICS.filter((c) => c.slot === "outfit" || c.slot === "emblem" || c.slot === "banner")
        .map((c) => `<button class="btn slim" data-fit="${c.id}" data-slot="${c.slot}">${c.name}</button>`)
        .join("");
      cg.querySelectorAll<HTMLInputElement>("[data-cos]").forEach((inp) => {
        inp.oninput = () => {
          const next = { ...(profile.appearance || defaultAppearance()) };
          (next as unknown as Record<string, number>)[inp.dataset.cos!] = Number(inp.value);
          onPick(profile.character, next);
        };
      });
      cg.querySelectorAll<HTMLElement>("[data-fit]").forEach((b) => {
        b.onclick = () => {
          const next = { ...(profile.appearance || defaultAppearance()) };
          if (b.dataset.slot === "outfit") next.outfit = b.dataset.fit!;
          if (b.dataset.slot === "emblem") next.emblem = b.dataset.fit!;
          if (b.dataset.slot === "banner") next.banner = b.dataset.fit!;
          onPick(profile.character, next);
        };
      });
    }
    const ach = document.getElementById("ach-list");
    if (ach) ach.textContent = "ACHIEVEMENTS · " + (profile.achievements || []).join(", ") + (profile.prestige ? ` · PRESTIGE ${profile.prestige}` : "");
    const hist = document.getElementById("hist-list");
    if (hist) hist.innerHTML = history.slice(0, 8).map((h) => `<div>${h.mapName} · ${h.winner} · ${h.durationSec}s</div>`).join("");
    const career = document.getElementById("career-card");
    if (career) {
      const ssn = profile.season;
      career.innerHTML = [
        `ID ${profile.id} · JOINED ${profile.createdAt ? new Date(profile.createdAt).toISOString().slice(0, 10) : "—"} · ${profile.country || ""}`,
        `LEVEL ${profile.level}${profile.prestige ? " · P" + profile.prestige : ""} · ${profile.rank} · HR ${profile.mmr}${profile.placing ? ` · PLACING ${profile.placing.done}/${profile.placing.total}` : ""}`,
        `LIFETIME ${profile.stats.matches} GP · ${profile.stats.wins}W ${profile.stats.losses}L · ${profile.kd ?? 0} K/D · ${profile.winRate ?? 0}% WR · ${profile.accuracy ?? 0}% ACC · ${Math.round((profile.playtimeSec || 0) / 60)} MIN`,
        ssn ? `SEASON ${ssn.name} · ${ssn.matches} GP · ${ssn.wins}W · PEAK ${ssn.peak} · RD ${ssn.rd}` : "",
        `STREAK W${profile.streaks?.win ?? 0} · BEST W${profile.streaks?.bestWin ?? 0}`,
        `WEAPONS ${(profile.favoriteWeapons || []).map((w) => `${w.id} L${w.level}`).join(" · ") || "—"}`,
        `MAPS ${(profile.favoriteMaps || []).map((m) => `${m.id} ${m.wins}/${m.matches}`).join(" · ") || "—"}`,
      ].filter(Boolean).join("<br/>");
    }
    const prest = document.getElementById("btn-prestige");
    if (prest) prest.classList.toggle("hidden", (profile.level || 0) < 100);
    const chal = document.getElementById("chal-list");
    if (chal) {
      chal.innerHTML = (profile.challenges || [])
        .map((c) => `<div class="row"><div><b>${escapeHtml(c.name)}</b><div class="fine">${c.kind.toUpperCase()} · ${c.progress}/${c.goal}${c.done ? " · DONE" : ""}</div></div><span>${c.xp} XP</span></div>`)
        .join("");
    }
    void operatorById;
  }

  showWelcome(on: boolean, text?: string): void {
    const el = document.getElementById("welcome");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (text) {
      const b = document.getElementById("welcome-body");
      if (b) b.textContent = text;
    }
  }

  fillBoards(rows: { name: string; rating: number; rank: string; wins: number; kd: number; winRate: number }[]): void {
    const el = document.getElementById("board-list");
    if (!el) return;
    el.innerHTML = rows
      .map((r, i) => `<div class="row"><div><b>${i + 1}. ${escapeHtml(r.name)}</b><div class="fine">${r.rank} · ${r.wins}W · ${r.kd} K/D · ${r.winRate}%</div></div><span>${r.rating}</span></div>`)
      .join("") || "<div class=\"fine\">NO ROWS</div>";
  }

  setFlash(t: number): void {
    let el = document.getElementById("flashbang");
    if (!el) {
      el = document.createElement("div");
      el.id = "flashbang";
      el.style.cssText = "position:fixed;inset:0;z-index:15;pointer-events:none;background:#fff;transition:opacity .12s";
      document.body.appendChild(el);
    }
    el.style.opacity = String(Math.min(1, t * 0.85));
  }
}

function teamCol(title: string, seats: RosterMember[]): string {
  const cls = title === "ALPHA" ? "alpha" : "bravo";
  const rows = seats
    .map((s) => {
      const mark = s.ready ? "READY" : s.accepted ? "ACCEPTED" : "…";
      return `<div class="seat"><div class="avatar">${s.name.slice(0, 1)}</div><div><b>${escapeHtml(s.name)}${s.friend ? " · FR" : ""}</b><em>${s.rank} · LV ${s.level} · ${s.character} · ${Math.round(s.ping)}ms</em></div><span class="ok">${mark}</span></div>`;
    })
    .join("");
  return `<div class="team ${cls}"><h3>${title}</h3>${rows}</div>`;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pingColorCss(ms: number): string {
  const b = pingBand(ms);
  if (b === "green") return "#3dffc0";
  if (b === "yellow") return "#e8e05a";
  if (b === "orange") return "#ff9a3d";
  return "#ff4d6a";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function findRow(h: FindHit): string {
  return `<div class="row"><div><b>${escapeHtml(h.name)}</b><div class="fine">${h.id} · LV ${h.level} · ${h.rank} · ${h.presence.toUpperCase()} · ${h.character}</div></div><div class="inline tight"><button class="btn slim" data-add="${h.id}">ADD</button><button class="btn slim" data-inv="${h.id}">INVITE</button><button class="btn slim" data-blk="${h.id}">BLOCK</button></div></div>`;
}

function bindFind(
  root: HTMLElement,
  hooks: { request: (id: string) => void; invite: (id: string) => void; block: (id: string) => void },
): void {
  root.querySelectorAll<HTMLElement>("[data-add]").forEach((b) => (b.onclick = () => hooks.request(b.dataset.add!)));
  root.querySelectorAll<HTMLElement>("[data-inv]").forEach((b) => (b.onclick = () => hooks.invite(b.dataset.inv!)));
  root.querySelectorAll<HTMLElement>("[data-blk]").forEach((b) => (b.onclick = () => hooks.block(b.dataset.blk!)));
}
