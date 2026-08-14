import "./styles/main.css";
import { detectCapabilities, profileFor, type CapReport, type QualityId } from "./boot/capabilities";
import { loadSettings, saveSettings, resolveQuality, TOUCH_PRESETS, type Settings } from "./boot/settings";
import { bindDisplayGates, enterPlayDisplay } from "./boot/display";
import { registerPwa } from "./pwa/pwa";
import { InputManager } from "./input/input";
import { AudioEngine } from "./audio/audio";
import { NetClient } from "./net/net";
import { UI } from "./ui/ui";
import { GameRenderer } from "./render/renderer";
import { ClientGame } from "./game/clientGame";
import {
  guessRegion,
  regionById,
  REGIONS,
  type CurrencyState,
  type InventorySlot,
  type MatchOffer,
  type ProfileState,
  type SocialPack,
  type PlayerPublic,
  detectLang,
  setLang,
  t,
  defaultAppearance,
  ENGINE_VERSION,
  parseBrowser,
} from "@shared";

const ui = new UI();
const audio = new AudioEngine();
const net = new NetClient();
const input = new InputManager();
const pwa = registerPwa();

let settings = loadSettings();
let caps: CapReport;
let renderer: GameRenderer | null = null;
let game: ClientGame | null = null;
let profile: ProfileState | null = null;
let currency: CurrencyState = { soft: 0, hard: 0 };
let inventory: InventorySlot[] = [];
let playing = false;
let hudClock = 0;
let offer: MatchOffer | null = null;
let matchId = "";
let tabHeld = false;
let lastMode: "quick" | "ranked" | "bots" = "quick";
let pack: SocialPack | null = null;
let friendFilter = "all";
let mailFilter = "friends";
const mailNotes: { kind: string; text: string }[] = [];

const canvas = document.getElementById("view") as HTMLCanvasElement;

function activeQuality(): QualityId {
  const q = resolveQuality(settings);
  return q === "auto" ? caps.recommended : q;
}

async function probeRegions(): Promise<{ id: string; rtt: number }[]> {
  const out: { id: string; rtt: number }[] = [];
  await Promise.all(
    REGIONS.map(async (r) => {
      const t0 = performance.now();
      try {
        await fetch(`/api/regions/${r.id}/ping`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
        out.push({ id: r.id, rtt: performance.now() - t0 });
      } catch {
        out.push({ id: r.id, rtt: 999 });
      }
    }),
  );
  return out.sort((a, b) => a.rtt - b.rtt);
}

async function boot(): Promise<void> {
  setLang(settings.lang || detectLang());
  ui.applyI18n();
  ui.setBoot(0.08, t("boot_hw"));
  caps = await detectCapabilities();
  const br = parseBrowser(navigator.userAgent);
  ui.logBoot("HELIX", ENGINE_VERSION, true);
  ui.logBoot("BROWSER", `${br.name} ${br.version || "—"}`, br.ok ? true : "warn");
  ui.logBoot("WEBGL2", caps.webgl2 ? "AVAILABLE" : "MISSING", caps.webgl2);
  ui.logBoot("WEBGPU", caps.webgpu ? "AVAILABLE" : "NOT PRESENT", caps.webgpu ? true : "warn");
  ui.logBoot("GPU", caps.gpu.slice(0, 42), true);
  ui.logBoot("CORES", String(caps.cores), caps.cores >= 4);
  ui.logBoot("REFRESH", `${caps.refreshHz} Hz`, true);
  if (!caps.webgl2) {
    ui.showFault(t("err_webgl"), () => location.reload(), () => location.reload(), () => location.reload());
    return;
  }
  ui.setBoot(0.32, t("boot_regions"));

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const measured = await probeRegions();
  const best = measured[0]?.id || guessRegion(tz);
  net.region = best;
  const bestRtt = measured[0]?.rtt ?? 0;
  ui.logBoot("REGION", `${regionById(best).name.toUpperCase()} ${Math.round(bestRtt)}ms`, true);
  ui.setRegion(regionById(best).name);
  ui.setPing(bestRtt);

  bindDisplayGates({
    rotateEl: ui.rotate,
    preferFullscreen: () => settings.preferFullscreen,
  });

  const q = profileFor(activeQuality(), caps);
  ui.setBoot(0.55, t("boot_render"));
  renderer = new GameRenderer(canvas, q);

  ui.setBoot(0.7, t("boot_audio"));
  audio.setMobile(caps.mobile || caps.android);
  audio.onLine((text) => ui.chatLine("SQUAD", text));
  window.addEventListener("pointerdown", () => void audio.resume());

  ui.setBoot(0.8, t("boot_auth"));
  const storedName = localStorage.getItem("vanguard.name") || "";
  try {
    const session = await net.session(storedName);
    profile = session.profile;
    currency = session.currency;
    inventory = session.inventory;
    ui.setProfile(profile, currency);
    if (profile.welcome) {
      ui.showWelcome(true, `Away ${profile.welcome.days} days. Season ${profile.welcome.season}. ${profile.welcome.version} — dailies are up.`);
    }
    await net.connect(session.profile.name, session.lastMatchId);
    ui.logBoot("AUTHORITY", "CONNECTED", true);
    ui.setOnline(true);
  } catch {
    ui.logBoot("AUTHORITY", "UNREACHABLE", false);
    ui.setOnline(false);
  }

  try {
    const live = (await fetch("/api/live").then((r) => r.json())) as {
      season?: { name: string; state: string };
      launch?: string;
      events?: { name: string }[];
    };
    const sname = (live.season?.name || "ORBIT").toUpperCase();
    ui.logBoot("SEASON", `${sname} ${(live.season?.state || "live").toUpperCase()}`, true);
    ui.logBoot("LAUNCH", String(live.launch || "not_yet").replace("_", " ").toUpperCase(), "warn");
    const chip = document.getElementById("d-season");
    if (chip) chip.textContent = sname;
    if (live.events?.[0]) ui.logBoot("EVENT", live.events[0].name.toUpperCase(), true);
  } catch {
    ui.logBoot("LIVE DESK", "OFFLINE", "warn");
  }

  ui.setBoot(0.93, "WIRING CONTROLS…");
  input.attach({ canvas, touchRoot: ui.touch, isTouch: caps.touch });
  applySettings(settings, false);
  wireNet();
  wireMenu();
  ui.bindSettings(settings, caps, (next) => applySettings(next, true));
  ui.setBoot(1, t("boot_ok"));
  await wait(caps.reducedMotion ? 80 : 280);
  ui.showMenu();
  void audio.resume().then(() => audio.menuTheme(true));
  requestAnimationFrame(menuSpin);
}

function wireNet(): void {
  net.onStatus = (on) => {
    ui.setOnline(on);
    if (!on && playing) void attemptReconnect();
  };
  net.onProfile = (p) => {
    profile = p;
    ui.setProfile(p, currency);
  };
  net.onCurrency = (c) => {
    currency = c;
    if (profile) ui.setProfile(profile, c);
  };
  net.onInventory = (s) => {
    inventory = s;
    ui.setInventory(s, (id) => net.useItem(id));
  };
  net.onSnapshot = (s) => game?.onSnapshot(s);
  net.onEvent = (e) => game?.onEvents(e);
  net.onSearch = (s) => ui.showSearch(s);
  net.onOffer = (o) => {
    offer = o;
    matchId = o.matchId;
    audio.beep("found");
    ui.showOffer(o);
  };
  net.onLobby = (l) => {
    matchId = l.matchId;
    ui.showLobby(
      l,
      net.playerId || profile?.id || "",
      () => net.ready(l.matchId),
      (c) => net.selectCharacter(c),
    );
  };
  net.onMatch = (state) => {
    if (state === "queued") ui.setQueue(true, "SEARCHING FOR PLAYERS…");
    if (state === "cancelled") {
      ui.hideSearch();
      ui.hideOffer();
      ui.setQueue(false);
    }
  };
  net.onWelcome = () => {
    ui.hideSearch();
    ui.hideOffer();
    ui.hideLobby();
    ui.setQueue(false);
    ui.showLoading("PLAYLIST ROTATION");
    audio.setMusic("loading");
    enterMatch();
    window.setTimeout(() => ui.hideLoading(), 2800);
  };
  net.onResult = (r) => {
    playing = false;
    game?.stop();
    game = null;
    document.getElementById("btn-menu")?.classList.add("hidden");
    ui.openPause(false);
    ui.showResult(r);
    const me = r.cards.find((c) => c.id === net.playerId);
    const win = Boolean(me && r.winner !== "none" && me.team === r.winner);
    audio.setMusic(win ? "victory" : "defeat");
    audio.callout(win ? "win" : "lose");
  };
  net.onParty = (p) => {
    ui.setParty(p);
    document.getElementById("party-list")?.querySelectorAll<HTMLElement>("[data-kick]").forEach((b) => {
      b.onclick = () => net.kick(b.dataset.kick!);
    });
  };
  net.onSocial = (friends) => {
    if (!pack) {
      ui.setFriends(friends, (id) => {
        audio.beep("ui");
        net.invite("party", id);
      }, friendFilter);
    }
  };
  net.onPack = (next) => {
    pack = next;
    paintSocial();
  };
  net.onFind = (hits) => {
    ui.setFind(hits, {
      request: (id) => net.social("request", { targetId: id }),
      invite: (id) => net.invite("party", id),
      block: (id) => net.social("block", { targetId: id }),
    });
  };
  net.onNote = (n) => {
    mailNotes.unshift({ kind: n.kind, text: n.text });
    if (!playing) ui.toast(n.kind, n.text);
    else ui.say(n.text.toUpperCase());
  };
  net.onInvite = (inv) => {
    audio.beep("ui");
    ui.pushInvite(inv, (id, accept) => net.respondInvite(id, accept));
  };
  net.onError = (code, message) => {
    if (playing) {
      ui.say(message.toUpperCase());
      return;
    }
    ui.showFault(code === "bad_protocol" ? t("err_update") : code === "bad_session" ? t("err_session") : message || t("err_server"), () => {
      ui.hideFault();
      void net.connect(profile?.name);
    }, () => {
      ui.hideFault();
      void attemptReconnect();
    }, () => {
      ui.hideFault();
      ui.showMenu();
    });
  };
  net.onIntro = (info) => {
    ui.showIntro(info);
    renderer?.useWorld(info.mapId || "iron_city", (info.weather as "clear") || "clear");
    game?.useMap(info.mapId || "iron_city");
  };
  net.onChat = (from, text) => ui.chatLine(from, text);
}

function openStart(): void {
  ui.openSheet("start", true);
  const party = document.getElementById("start-party");
  if (party) party.textContent = document.getElementById("party-strip")?.textContent || "SOLO";
  const ping = document.getElementById("start-ping");
  if (ping) ping.textContent = `${Math.round(net.rtt || 20)} ms`;
}

async function beginQueue(mode: "quick" | "ranked" | "bots"): Promise<void> {
  audio.beep("ui");
  await audio.resume();
  await enterPlayDisplay();
  audio.menuTheme(false);
  lastMode = mode;
  ui.openSheet("start", false);
  if (mode === "bots") {
    net.matchmake("bots");
    return;
  }
  ui.showSearch({
    playersFound: 1,
    playersNeeded: 8,
    humans: 1,
    bots: mode === "ranked" ? 0 : 7,
    etaMs: mode === "ranked" ? 120000 : 8000,
    region: net.region,
    regionName: regionById(net.region).name,
    ping: net.rtt || 20,
    mode,
    note: mode === "ranked" ? "HUMANS ONLY · BAND EXPANDS" : "",
  });
  net.matchmake(mode);
}

function wireMenu(): void {
  document.getElementById("btn-start")!.addEventListener("click", () => {
    audio.beep("ui");
    openStart();
  });
  document.getElementById("btn-start-hero")?.addEventListener("click", () => {
    audio.beep("ui");
    openStart();
  });
  document.getElementById("start-close")?.addEventListener("click", () => ui.openSheet("start", false));
  document.getElementById("btn-go")?.addEventListener("click", () => {
    const mode = ((document.getElementById("start-mode") as HTMLSelectElement)?.value || "quick") as "quick" | "ranked" | "bots";
    void beginQueue(mode);
  });
  document.getElementById("btn-ranked")?.addEventListener("click", () => void beginQueue("ranked"));
  document.getElementById("btn-bots")!.addEventListener("click", () => void beginQueue("bots"));
  document.getElementById("btn-range")!.addEventListener("click", async () => {
    audio.beep("ui");
    await audio.resume();
    await enterPlayDisplay();
    net.matchmake("range");
  });
  document.getElementById("btn-cancel-search")!.addEventListener("click", () => {
    net.cancelSearch();
    ui.hideSearch();
  });
  document.getElementById("btn-accept")!.addEventListener("click", () => {
    if (offer) net.accept(offer.matchId);
  });
  document.getElementById("btn-decline")!.addEventListener("click", () => {
    if (offer) net.decline(offer.matchId);
    ui.hideOffer();
    ui.showMenu();
  });
  document.getElementById("btn-profile")?.addEventListener("click", () => void openBarracks());
  document.getElementById("btn-board")?.addEventListener("click", () => void openBarracks());
  document.getElementById("barracks-close")?.addEventListener("click", () => ui.openBarracks(false, null, () => {}));
  document.getElementById("btn-settings")!.addEventListener("click", () => ui.openSettings(true));
  document.getElementById("settings-close")!.addEventListener("click", () => ui.openSettings(false));
  document.getElementById("btn-social")!.addEventListener("click", () => {
    ui.openSocial(true);
    document.querySelector<HTMLElement>("#soc-tabs [data-soc='friends']")?.click();
  });
  document.getElementById("btn-clan")?.addEventListener("click", () => {
    ui.openSocial(true);
    document.querySelector<HTMLElement>("#soc-tabs [data-soc='clan']")?.click();
  });
  document.getElementById("social-close")!.addEventListener("click", () => ui.openSocial(false));
  document.getElementById("btn-inv")?.addEventListener("click", () => {
    ui.fillInvSheet(inventory);
    ui.openSheet("inventory", true);
  });
  document.getElementById("inv-close")?.addEventListener("click", () => ui.openSheet("inventory", false));
  document.getElementById("btn-store")?.addEventListener("click", () => {
    void openVault("featured");
  });
  document.getElementById("store-close")?.addEventListener("click", () => ui.openSheet("store", false));
  document.getElementById("btn-mail")?.addEventListener("click", () => {
    ui.openSheet("mailbox", true);
    void paintMail();
  });
  document.getElementById("mail-close")?.addEventListener("click", () => ui.openSheet("mailbox", false));
  document.getElementById("mail-tabs")?.querySelectorAll<HTMLElement>("[data-mail]").forEach((b) => {
    b.onclick = () => {
      mailFilter = b.dataset.mail || "friends";
      document.getElementById("mail-tabs")?.querySelectorAll(".btn").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      void paintMail();
    };
  });
  document.getElementById("btn-add-friend")!.addEventListener("click", () => {
    const name = (document.getElementById("friend-name") as HTMLInputElement).value.trim();
    if (name) net.social("request", { name });
  });
  document.getElementById("soc-tabs")?.querySelectorAll<HTMLElement>("[data-soc]").forEach((b) => {
    b.onclick = () => {
      document.getElementById("soc-tabs")?.querySelectorAll(".btn").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      for (const id of ["party", "friends", "find", "clan", "recent", "safety"]) {
        document.getElementById("soc-" + id)?.classList.toggle("hidden", id !== b.dataset.soc);
      }
    };
  });
  document.querySelectorAll<HTMLElement>("[data-ff]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll("[data-ff]").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      friendFilter = b.dataset.ff || "all";
      paintSocial();
    };
  });
  document.getElementById("btn-find")?.addEventListener("click", () => {
    const qv = (document.getElementById("find-q") as HTMLInputElement).value.trim();
    if (qv) net.social("search", { name: qv });
  });
  document.getElementById("btn-party-mode")?.addEventListener("click", () => {
    net.social("party_mode", { mode: (document.getElementById("party-mode") as HTMLSelectElement).value });
  });
  document.getElementById("btn-party-leave")?.addEventListener("click", () => net.leaveParty());
  document.getElementById("btn-party-chat")?.addEventListener("click", () => {
    const el = document.getElementById("party-chat") as HTMLInputElement;
    if (el.value.trim()) {
      net.social("chat", { channel: "party", text: el.value });
      el.value = "";
    }
  });
  document.getElementById("btn-clan-make")?.addEventListener("click", () => {
    net.social("clan_create", {
      tag: (document.getElementById("clan-tag") as HTMLInputElement).value,
      name: (document.getElementById("clan-name") as HTMLInputElement).value,
    });
  });
  document.getElementById("btn-clan-announce")?.addEventListener("click", () => {
    net.social("clan_announce", { text: (document.getElementById("clan-announce") as HTMLInputElement).value });
  });
  document.getElementById("btn-clan-leave")?.addEventListener("click", () => net.social("clan_leave"));
  document.getElementById("btn-clan-chat")?.addEventListener("click", () => {
    const el = document.getElementById("clan-chat") as HTMLInputElement;
    if (el.value.trim()) {
      net.social("chat", { channel: "clan", text: el.value });
      el.value = "";
    }
  });
  document.getElementById("btn-presence")?.addEventListener("click", () => {
    net.social("presence", { presence: (document.getElementById("set-presence") as HTMLSelectElement).value });
  });
  document.getElementById("btn-privacy")?.addEventListener("click", () => {
    net.social("privacy", {
      privacy: {
        invites: (document.getElementById("priv-invites") as HTMLSelectElement).value,
        whispers: (document.getElementById("priv-whispers") as HTMLSelectElement).value,
        showOnline: (document.getElementById("priv-online") as HTMLInputElement).checked,
        showMatch: (document.getElementById("priv-match") as HTMLInputElement).checked,
        showFriends: (document.getElementById("priv-friends") as HTMLInputElement).checked,
      },
    });
  });
  document.getElementById("btn-report")?.addEventListener("click", () => {
    const targetId = (document.getElementById("report-id") as HTMLInputElement).value.trim();
    const reason = (document.getElementById("report-reason") as HTMLSelectElement).value;
    if (targetId) net.social("report", { targetId, reason });
  });
  document.getElementById("set-tabs")?.querySelectorAll<HTMLElement>("[data-set]").forEach((b) => {
    b.onclick = () => {
      document.getElementById("set-tabs")?.querySelectorAll(".btn").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      for (const id of ["gfx", "audio", "controls", "game", "access", "account"]) {
        document.getElementById("set-" + id)?.classList.toggle("hidden", id !== b.dataset.set);
      }
    };
  });
  document.getElementById("btn-touch-std")?.addEventListener("click", () => applyTouch("standard"));
  document.getElementById("btn-touch-adv")?.addEventListener("click", () => applyTouch("advanced"));
  document.getElementById("btn-touch-left")?.addEventListener("click", () => applyTouch("left"));
  document.getElementById("btn-result-ok")!.addEventListener("click", () => {
    ui.showMenu();
    if (profile) ui.setProfile(profile, currency);
  });
  document.getElementById("btn-again")?.addEventListener("click", () => {
    ui.hideFlows();
    net.matchmake(lastMode);
  });
  document.getElementById("btn-alt-quick")?.addEventListener("click", () => {
    net.cancelSearch();
    lastMode = "quick";
    net.matchmake("quick");
  });
  document.getElementById("btn-alt-bots")?.addEventListener("click", () => {
    net.cancelSearch();
    lastMode = "bots";
    net.matchmake("bots");
  });
  document.getElementById("btn-welcome-ok")?.addEventListener("click", () => ui.showWelcome(false));
  document.getElementById("btn-prestige")?.addEventListener("click", () => net.progress({ prestige: true }));
  document.getElementById("br-tabs")?.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
    b.onclick = () => {
      document.getElementById("br-tabs")?.querySelectorAll(".btn").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      for (const id of ["tab-ops", "tab-career", "tab-challenges", "tab-boards"]) {
        document.getElementById(id)?.classList.toggle("hidden", id !== "tab-" + b.dataset.tab);
      }
    };
  });
  document.getElementById("board-scopes")?.querySelectorAll<HTMLElement>("[data-scope]").forEach((b) => {
    b.onclick = () => void loadBoards(b.dataset.scope || "global");
  });
  document.getElementById("btn-invite-end")?.addEventListener("click", () => ui.openSocial(true));
  document.getElementById("btn-resume")!.addEventListener("click", () => {
    ui.openPause(false);
    ui.openSettings(false);
    input.enabled = true;
  });
  document.getElementById("btn-leave")!.addEventListener("click", () => {
    ui.openPause(false);
    ui.openSettings(false);
    void leaveMatch();
  });
  document.getElementById("btn-pause-settings")?.addEventListener("click", () => {
    audio.beep("ui");
    ui.openSettings(true);
  });
  const menuBtn = document.getElementById("btn-menu");
  const openMatchMenu = (e?: Event) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!playing) return;
    void audio.resume();
    audio.beep("ui");
    ui.openPause(true);
    input.enabled = false;
    input.reset();
    document.exitPointerLock?.();
  };
  menuBtn?.addEventListener("pointerdown", openMatchMenu);
  document.getElementById("btn-install")!.addEventListener("click", () => pwa.promptInstall());
  document.getElementById("store-tabs")?.querySelectorAll<HTMLElement>("[data-lane]").forEach((b) => {
    b.onclick = () => {
      document.getElementById("store-tabs")?.querySelectorAll(".btn").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      void openVault(b.dataset.lane || "featured");
    };
  });
  document.getElementById("btn-daily")?.addEventListener("click", () => void claimDaily());
  wireAccount();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      tabHeld = true;
    }
    if (e.code === "Escape") {
      if (!playing) {
        ui.openSettings(ui.settings.classList.contains("hidden"));
        return;
      }
      if (!ui.settings.classList.contains("hidden")) {
        ui.openSettings(false);
        return;
      }
      const open = ui.pause.classList.contains("hidden");
      ui.openPause(open);
      input.enabled = !open;
      if (open) document.exitPointerLock?.();
    }
    if (e.code === "Digit2") net.buy("buy_repair");
    if (e.code === "Digit3") net.buy("buy_plates");
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Tab") tabHeld = false;
  });
}

function enterMatch(): void {
  if (!renderer) return;
  if (game) game.stop();
  audio.menuTheme(false);
  void enterPlayDisplay();
  game = new ClientGame(net, input, renderer, audio, ui);
  game.fpsCap = settings.fpsCap;
  playing = true;
  ui.showGame(caps.touch);
  ui.setInventory(inventory, (id) => net.useItem(id));
  if (profile) ui.setProfile(profile, currency);
  game.start();
}

async function leaveMatch(): Promise<void> {
  playing = false;
  game?.stop();
  game = null;
  audio.silence();
  audio.menuTheme(true);
  ui.showMenu();
  if (profile) ui.setProfile(profile, currency);
  try {
    net.ws?.close();
    await net.connect(profile?.name);
  } catch {
    ui.setOnline(false);
  }
}

async function attemptReconnect(): Promise<void> {
  ui.showReconnect(true);
  for (let i = 0; i < 8; i++) {
    await wait(800 + i * 200);
    try {
      await net.connect(profile?.name, net.lastMatchId);
      ui.showReconnect(false);
      return;
    } catch {
      /* retry */
    }
  }
  ui.showReconnect(false);
  ui.say("RECONNECT FAILED");
  ui.showMenu();
}

function applyTouch(preset: Settings["touchPreset"]): void {
  const next = { ...settings, touchPreset: preset, touch: { ...TOUCH_PRESETS[preset] }, leftHanded: preset === "left" };
  applySettings(next, true);
}

function applySettings(next: Settings, persist: boolean): void {
  const prevQ = settings.quality;
  const prevLang = settings.lang;
  settings = next;
  if (persist) saveSettings(next);
  input.settings = next;
  input.sensitivity = next.sensitivity;
  input.adsSens = next.adsSens;
  input.invertY = next.invertY;
  input.gyro = next.gyro;
  input.stickSens = next.stickSens;
  input.autoSprint = next.autoSprint;
  input.leftHanded = next.leftHanded;
  audio.masterGain = next.master;
  audio.sfxGain = next.sfx;
  audio.musicGain = next.music;
  audio.uiGain = next.uiVol;
  audio.voiceGain = next.voice;
  audio.weaponGain = next.weaponVol;
  audio.envGain = next.envVol;
  audio.charGain = next.charVol;
  audio.chatGain = next.chatVol;
  audio.setSpatial(next.spatial);
  audio.setMono(next.mono);
  audio.setCharVoice(next.charVoice);
  audio.apply();
  if (game) game.fpsCap = next.fpsCap;
  if (renderer) {
    renderer.colorblind = next.colorblind;
    renderer.reduceShake = next.reduceShake;
    renderer.setMenuLite(caps?.recommended === "potato" || next.quality === "potato");
    if (next.quality !== prevQ || !persist) renderer.applyQuality(profileFor(activeQuality(), caps));
    renderer.setPixelRatioSafe?.(next.resolutionScale);
  }
  ui.setFps(game?.getFps() ?? 0, next.showFps);
  document.body.classList.toggle("cb-protan", next.colorblind === "protan");
  document.body.classList.toggle("cb-deutan", next.colorblind === "deutan");
  document.body.classList.toggle("cb-tritan", next.colorblind === "tritan");
  document.body.classList.toggle("left-handed", next.leftHanded || next.touchPreset === "left");
  document.body.classList.toggle("touch-adv", next.touchPreset === "advanced");
  document.body.classList.toggle("hi-contrast", next.highContrast);
  document.body.classList.toggle("reduce-flash", next.reduceFlash);
  document.documentElement.style.setProperty("--ui-scale", String(next.uiScale));
  document.documentElement.style.setProperty("--text-scale", String(next.textScale));
  if (next.lang !== prevLang) {
    setLang(next.lang);
    ui.applyI18n();
  }
  ui.touch.querySelectorAll<HTMLElement>("[data-act]").forEach((el) => {
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.transform = "";
    el.style.opacity = "";
  });
  void TOUCH_PRESETS;
}

async function openBarracks(): Promise<void> {
  let history: { mapName: string; winner: string; durationSec: number }[] = [];
  try {
    const token = localStorage.getItem("vanguard.token") || "";
    const res = await fetch("/api/history?token=" + encodeURIComponent(token));
    const data = (await res.json()) as { matches?: { mapName: string; winner: string; durationSec: number }[] };
    history = data.matches || [];
  } catch {
    /* offline */
  }
  ui.openBarracks(true, profile, (character, appearance) => {
    net.cosmetic(appearance, character);
    if (profile) {
      profile.character = character;
      profile.appearance = appearance;
    }
  }, history);
  void loadBoards("global");
}

async function loadBoards(scope: string): Promise<void> {
  try {
    const token = localStorage.getItem("vanguard.token") || "";
    const res = await fetch(`/api/boards?scope=${encodeURIComponent(scope)}&token=${encodeURIComponent(token)}`);
    const data = (await res.json()) as { rows?: { name: string; rating: number; rank: string; wins: number; kd: number; winRate: number }[] };
    ui.fillBoards(data.rows || []);
  } catch {
    ui.fillBoards([]);
  }
}

function menuSpin(now: number): void {
  if (!playing && renderer) {
    const t = now * 0.00015;
    renderer.camera.position.set(Math.sin(t) * 18, 9, Math.cos(t) * 18);
    renderer.camera.lookAt(0, 0.4, -2);
    renderer.render(null);
  }
  if (game) game.showBoard = tabHeld;
  if (now - hudClock > 250) {
    hudClock = now;
    ui.setFps(game?.getFps() ?? 60, settings.showFps);
    ui.setNet(net.rtt, settings.showFps);
  }
  requestAnimationFrame(menuSpin);
}

function paintSocial(): void {
  if (!pack) return;
  ui.setPack(
    pack,
    {
      invite: (id) => net.invite("party", id),
      accept: (id) => net.social("accept", { targetId: id }),
      reject: (id) => net.social("reject", { targetId: id }),
      cancel: (id) => net.social("cancel", { targetId: id }),
      fav: (id, on) => net.social(on ? "favorite" : "unfavorite", { targetId: id }),
      remove: (id) => net.social("remove", { targetId: id }),
      block: (id) => net.social("block", { targetId: id }),
      unblock: (id) => net.social("unblock", { targetId: id }),
      request: (id) => net.social("request", { targetId: id }),
      clanInvite: (id) => net.social("clan_invite", { targetId: id }),
      clanKick: (id) => net.social("clan_kick", { targetId: id }),
      report: (id) => {
        const box = document.getElementById("report-id") as HTMLInputElement | null;
        if (box) box.value = id;
        net.social("report", { targetId: id, reason: "other" });
      },
    },
    friendFilter,
  );
}

let vaultLane = "featured";
let vaultWallet = { ion: 0, orbit: 0, owned: ["duty"], featured: [] as string[] };

async function openVault(lane: string): Promise<void> {
  vaultLane = lane;
  try {
    const res = await fetch("/api/vault?token=" + encodeURIComponent(net.authToken()));
    const data = (await res.json()) as { wallet?: typeof vaultWallet; featured?: string[] };
    if (data.wallet) vaultWallet = { ...data.wallet, featured: data.featured || data.wallet.featured || [] };
    const mul = (data.wallet as { daily?: { ionMul?: number } } | undefined)?.daily?.ionMul || 1;
    const dailyBtn = document.getElementById("btn-daily");
    if (dailyBtn) dailyBtn.textContent = mul > 1 ? `CLAIM DAILY ×${mul}` : "CLAIM DAILY";
  } catch {
    vaultWallet = { ion: currency.soft, orbit: currency.hard, owned: ["duty"], featured: [] };
  }
  ui.fillStore(lane, vaultWallet, (sku) => void buyVault(sku));
  ui.openSheet("store", true);
}

async function paintMail(): Promise<void> {
  if (mailFilter !== "live" && mailFilter !== "notes") {
    ui.fillMail(mailNotes, mailFilter);
    return;
  }
  try {
    const res = await fetch("/api/live");
    const data = (await res.json()) as Parameters<UI["fillLive"]>[0];
    ui.fillLive(data, mailFilter === "notes" ? "notes" : "live", (kind, sev, text) => void sendFeedback(kind, sev, text));
  } catch {
    ui.fillMail([{ kind: "system", text: "Live desk unreachable." }], "system");
  }
}

async function sendFeedback(kind: string, sev: string, text: string): Promise<void> {
  if (!text.trim()) {
    ui.toast("error", "Empty ticket");
    return;
  }
  const data = await net.auth("/api/live/feedback", { kind, sev, text });
  if (data.error) {
    ui.toast("error", data.error === "never_send_password" ? t("live_never_pw") : String(data.error));
    return;
  }
  audio.beep("ok");
  ui.toast("ok", "Ticket " + String(data.id || "filed"));
  const box = document.getElementById("fb-text") as HTMLTextAreaElement | null;
  if (box) box.value = "";
}

async function buyVault(sku: string): Promise<void> {
  const qres = await fetch("/api/vault/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku }),
  });
  const q = (await qres.json()) as { name?: string; total?: number; coin?: string; restriction?: string; error?: string };
  if (q.error || !q.name) {
    ui.toast("error", "Not for sale");
    return;
  }
  if (!confirm(`${q.name}\n${(q.coin || "").toUpperCase()} ${q.total}\n${q.restriction}\nConfirm purchase?`)) return;
  const data = await net.auth("/api/vault/buy", { sku, requestId: "b_" + Date.now() });
  if (data.error) {
    ui.toast("error", String(data.error));
    return;
  }
  if (data.currency) {
    currency = data.currency as CurrencyState;
    if (profile) ui.setProfile(profile, currency);
  }
  audio.beep("ok");
  ui.toast("ok", "Owned — cosmetic only");
  void openVault(vaultLane);
}

async function claimDaily(): Promise<void> {
  const data = await net.auth("/api/vault/daily", {});
  if (data.error) {
    ui.toast("error", data.error === "claimed" ? "Already claimed today" : String(data.error));
    return;
  }
  if (data.currency) {
    currency = data.currency as CurrencyState;
    if (profile) ui.setProfile(profile, currency);
  }
  audio.beep("ok");
  ui.toast("ok", "Daily ION claimed");
  void openVault(vaultLane);
}

function wireAccount(): void {
  const note = (text: string) => {
    const el = document.getElementById("acct-note");
    if (el) el.textContent = text;
  };
  const paint = () => {
    const st = document.getElementById("acct-status");
    if (st) {
      st.textContent = profile?.claimed
        ? `CLAIMED · ${profile.id} · ${profile.sanction || "none"}`
        : `GUEST · ${profile?.id || "—"} — register to lock this id.`;
    }
  };
  paint();
  document.getElementById("btn-acct-register")?.addEventListener("click", async () => {
    const email = (document.getElementById("acct-email") as HTMLInputElement).value;
    const password = (document.getElementById("acct-pass") as HTMLInputElement).value;
    const data = await net.auth("/api/auth/register", { email, password });
    if (data.error) {
      note(String(data.error));
      return;
    }
    if (data.profile) profile = data.profile as ProfileState;
    note("Account claimed. Password is hashed on the authority — never stored here.");
    paint();
  });
  document.getElementById("btn-acct-login")?.addEventListener("click", async () => {
    const email = (document.getElementById("acct-email") as HTMLInputElement).value;
    const password = (document.getElementById("acct-pass") as HTMLInputElement).value;
    const data = await net.auth("/api/auth/login", { email, password });
    if (data.error) {
      note(String(data.error));
      return;
    }
    if (data.profile) profile = data.profile as ProfileState;
    note("Session rotated. Reload if you switched accounts.");
    paint();
  });
  document.getElementById("btn-acct-logout")?.addEventListener("click", async () => {
    await net.auth("/api/auth/logout", {});
    localStorage.removeItem("vanguard.token");
    note("Session revoked on the authority.");
  });
  document.getElementById("btn-acct-recover")?.addEventListener("click", async () => {
    const email = (document.getElementById("acct-email") as HTMLInputElement).value;
    const data = await net.auth("/api/auth/recover", { email });
    note(data.code ? `Recovery code (show once): ${data.code}` : "If that inbox exists, a code was issued.");
  });
  document.getElementById("btn-acct-export")?.addEventListener("click", async () => {
    const res = await fetch("/api/me/export?token=" + encodeURIComponent(net.authToken()));
    const data = await res.json();
    note("Export ready — " + JSON.stringify(data).slice(0, 120) + "…");
  });
  document.getElementById("btn-acct-delete")?.addEventListener("click", async () => {
    if (!profile || !confirm("Delete this account? Matches stay anonymized.")) return;
    const data = await net.auth("/api/me/delete", { confirm: profile.id });
    note(data.error ? String(data.error) : "Account deleted. Token revoked.");
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

boot().catch((err) => {
  console.error(err);
  ui.setBoot(1, "BOOT FAULT — CHECK CONSOLE");
});
