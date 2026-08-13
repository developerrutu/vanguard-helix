# VANGUARD

**Complete A–Z game overview** — this is the README, so GitHub shows it first on the repo home.

**Built by [developerrutu](https://github.com/developerrutu)**  
Repository: [github.com/developerrutu/vanguard-helix](https://github.com/developerrutu/vanguard-helix) (private)  
Engine **HELIX 15.0.0** · Protocol **15** · Season **1 ORBIT** · Date **2026-08-13**

This is the A-to-Z record of what Vanguard is, how it plays, how it is built, and what is **not** shipped.  
It is a **playable web 4v4 core**. It is **not** a public launch. `GET /api/live` reports `launch: "not_yet"`.

---

## A — What it is

**Vanguard** is a browser-native, **server-authoritative** competitive shooter.

- Mode: **4v4 Team Battle Royale** (plus a solo Training Range).
- One life. Shared loot. A closing ion storm. Win by wiping the other squad or surviving the final circle.
- Easy to learn, hard to master. Skill, positioning, teamwork, accuracy, and communication decide the yard — **never a wallet**.
- **No pay-to-win.** Cosmetics only. Victory is player skill and squad play.
- **No install required.** It runs in the browser. Optional Android PWA.
- **No peer-to-peer.** Every gunfight, health number, inventory change, currency move, and match result is decided on the Helix authority.

The product identity is **Orbit Trace** (hex-cut ion on ink). The runtime is **Helix**. The game title is **Vanguard**.

---

## B — Built by

| | |
|---|---|
| Builder | **developerrutu** |
| GitHub | [github.com/developerrutu](https://github.com/developerrutu) |
| Repo | [developerrutu/vanguard-helix](https://github.com/developerrutu/vanguard-helix) |
| Visibility | Private |
| Branch | `main` |
| Credit | All game source, original operators, original arsenal, original maps, original audio, and this overview are published under this account. |

---

## C — Design rules (non-negotiable)

1. **Web first.** Chrome, Edge, Firefox, Safari, Samsung Internet, Android browsers, Android PWA, Windows / macOS / Linux. Future iOS must not break the web client.
2. **Server is gospel.** The browser predicts movement. The snap is truth. The client never owns damage, health, position, ammo, results, ION, ORBIT, rank, or inventory.
3. **Fairness.** Same hitboxes. Same guns. Same storm. Cosmetics do not change combat.
4. **Honesty.** A feature is implemented only if it runs in the integrated game and was tested. Menus and mocks do not count.
5. **Expand later, do not wipe.** New maps, guns, characters, cosmetics, modes, events, and seasons ship as data + authority patches. Players keep Player ID, username, friends, clan, inventory, stats, achievements, progression, and rank history.

---

## D — How a player’s first session goes

1. Open the site (dev `:5173`, or one production URL that serves the built client + `/api` + `/ws`).
2. Boot: hardware read → region probe → WebGL2 gate → Helix mixer → guest session.
3. If WebGL2 is missing: a clear message, not a crash.
4. If protocol mismatches: **Update Required**.
5. Welcome sheet if the operator has been away 14+ days.
6. **Orbit Trace** main menu: dossier (callsign, Player ID, level, title, rank, Helix Rating, clan, ION, ORBIT, W/L, K/D), Start, Profile, Friends, Clan, Inventory, Leaderboard, Store, Mailbox, Settings.
7. Pick **Play with bots** (fastest real match), **Quick Play**, **Ranked**, or **Training Range**.
8. Search → accept (10 s) → 30 s lobby → 8 s intro → load → deploy.
9. Spawn with **Edgefold (knife)**, **Stitch .9 / P9**, and one **Weave Patch**.
10. Loot the yard. Storm closes. One life. Hold **E** 7.2 s to revive. Wipe the other four or live in the final circle.
11. Results: K / D / A / revives / accuracy / damage, MVP, XP, ION, Helix Rating delta.
12. Back to menu. Player ID and lifetime stats persist.

That loop is the launch-version definition. Extra modes and public population are later.

---

## E — Platforms and devices

| Surface | Support |
|---|---|
| Desktop browsers | Chrome 111+, Edge 111+, Firefox 115+, Safari 16.4+ |
| Android browsers | Chrome, Edge, Firefox, Samsung Internet 21+ |
| Android PWA | Installable. Manifest + service worker `vanguard-helix-15` |
| iOS | Web-first only. Not a native App Store build. |
| Input | Keyboard + mouse, touch, gamepad-ready settings |
| Display | Landscape **only** on mobile. Auto fullscreen preferred. Ultrawide Hor+. Windowed or fullscreen on desktop. |
| Quality | Auto from GPU / cores / RAM / refresh. Potato → Ultra, plus custom. 30 min / 60 standard / 90–120 supported. |
| Languages | English + हिन्दी (`en` / `hi`) |

Mobile: 100% landscape overlay if the phone is portrait. Touch sticks, fire, ADS, crouch, prone, loot. Left-handed preset exists.

---

## F — Tech stack (why these choices)

| Layer | Choice | Rejected |
|---|---|---|
| Language | TypeScript — client, authority, shared protocol | Split-brain stacks |
| Client | Vite + Three.js + WebGL2. WebGPU detected, never required | Unity / Godot web (load budget) |
| Net | **WebSocket + JSON, 30 Hz** | WebRTC datachannel as the game wire (TURN, hotel Wi-Fi) |
| Audio | Original Web Audio synthesis. No sample banks | Copyrighted kits |
| Store | Transactional in-process JSON (`.data/`) | Exposing a database to the browser |
| Host | One Node process serves site + `/api` + `/ws` | Vercel serverless (cannot hold a room) |

**Why 30 Hz.** Eight pawns, rewind ≤ 150 ms, mobile radios. 20 Hz feels slack on guns. 60 Hz doubles CPU and snapshot cost for almost no 4v4 gain.

Workspaces: `shared/` · `client/` · `server/`.

---

## G — Authority model

The Helix process owns:

- Position, velocity, stance, jump, slide, vault
- Hitscan and projectile traces, damage, head/limb multipliers, armor soak
- Magazines, reserves, reload, fire mode, attachments
- Health, armor durability, downed / bleed / revive / finish
- Loot spawns, pickups, inventory slots
- Storm phases and storm damage
- Match start, teams, spawn, `MATCH_END`, XP, ION, Helix Rating
- Friends, clans, invites, blocks, reports
- Vault quotes, buys, dailies, pass grants
- Sessions, rate limits, Watch flags, staff actions

The browser:

- Predicts local movement
- Interpolates remotes
- Renders Orbit Trace HUD
- Sends input at 30 Hz (button bitfield + look)
- **Never** writes currency, rank, or results

Lag compensation is capped at **150 ms**. Sequence replay is rejected.

---

## H — Account and identity

- Fast path: **guest session**.
- Permanent **Player ID**: server-minted `p_` + 12 hex (example shape: `p_b13ce192e265`).
- Claim later with email + password. Same ID. Password is **scrypt** (N=16384) on the authority. Plaintext never hits disk or `localStorage`.
- Recovery codes are hashed. Shown once.
- Tokens are opaque, idle/absolute TTL, rotatable, listable, revocable.
- Simultaneous devices flag; they do not auto-kick.
- Export / correct / delete. Delete anonymizes the callsign and revokes sessions. Match rows stay for integrity.
- Support **never** asks for a password.

---

## I — Modes

| Mode | Humans | Bots | Rating | XP | Notes |
|---|---|---|---|---|---|
| **Quick Play** | Search 8 s | Fill to 4v4 | No | Yes | Default playlist |
| **Ranked** | Humans only | None | Helix Rating | Yes | 8 placements. Band expands 2 min, then offers Quick / Bots |
| **Play with bots** | You | 7 minds | No | Reduced | Instant 4v4 |
| **Training Range** | Solo | Still dummy + strafe dummy | No | No farm | ION kits for plates / meds only. Ranked rejects them |

Extra modes / LTMs: **not_yet**. Data-ready, not wired.

Party size: **4**. Room size: **8**. Team size: **4** (Alpha vs Bravo).

---

## J — Match lifecycle

1. Process up.
2. `HELLO` (protocol 15 + session token + region).
3. Queue / search updates (found / humans / bots / ETA / ping / region).
4. Offer — **10 s** to accept.
5. Lobby — **30 s**, pick operator, ready up.
6. Loading ~3 s → intro **8 s** (roster, map, weather, match # from 2401).
7. Deploy. Phases: `loading → intro → loot → combat → circle → final → ended`.
8. 30 Hz sim until wipe or final circle.
9. Verified `MATCH_END`. Rewards persist.
10. Room empty → stop.

Match ids are server-minted. Display tag: `MATCH-` + 8 hex.

**Reconnect:** ranked reserves the pawn **5 minutes**. Token must still resolve. If the room ended, you land in the menu — you do not invent a result.

Join-after-found budget: **5 s** (accept window is 10 s).

---

## K — Maps (playlist)

Three original yards rotate. Weather is a look, not a stat. Knowable from match number (esports-ready).

### Iron City
- Theme: dense urban yard.
- Half-extent **66**.
- Weather: clear / rain / night.
- Landmarks: **GRID · SPIRE · METRO · LOT · SITE · RAIL**.
- Doors, glass, climbs, cover props.

### Red Sands
- Theme: desert / industrial.
- Half-extent **78**.
- Weather: sunny / dust / sunset.
- Landmarks: **FORT · WELL · DISH · CUT · RIG**.

### Frost Haven
- Theme: mountain and snow.
- Combat: mixed range / high ground.
- Half-extent **70**.
- Weather: winter / snow / blizzard.
- Landmarks: **HALL · MIRROR · MAST · LAB · PASS**.
- Water volume at Mirror.

Doors open with **E**. Low cover auto-vaults on jump. Water slows. Storm only hurts **outside** the ring.

---

## L — The ion storm

Seven phases (radii scale with map size):

| Phase | Name | Wait | Shrink | Radius (base) | DPS |
|---|---|---|---|---|---|
| 0 | LOOT | 70 s | 0 | 92 | 0 |
| 1 | LARGE ZONE | 48 s | 34 s | 58 | 2 |
| 2 | REDUCED ZONE | 42 s | 30 s | 40 | 4 |
| 3 | MEDIUM ZONE | 38 s | 26 s | 26 | 7 |
| 4 | SMALL ZONE | 30 s | 22 s | 15 | 11 |
| 5 | CRITICAL ZONE | 24 s | 18 s | 8 | 16 |
| 6 | FINAL CIRCLE | 36 s | 14 s | 3.4 | 25 |

HUD chip shows phase name and close timer. Minimap draws current and next rings.

---

## M — Movement

No stamina bar. Sprint is a **loud, inaccurate** trade.

| Action | Value |
|---|---|
| Walk | 6.2 |
| Sprint | 9.0 |
| Crouch | 3.05 |
| Prone | 1.32 |
| Slide | 11.1 for 0.42 s, cooldown 1.35 s |
| Jump | 7.4, gravity 22 |
| Vault | 0.38 s, height 0.42–1.35 |
| Downed crawl | 0.22 × speed |

Hit heights change with stance (stand / crouch / prone / slide / vault / downed). Spread tightens crouched/prone, opens on sprint/slide.

Default desktop binds:

**WASD** move · **Shift** sprint · **Ctrl** crouch · **P** prone · **Space** jump/vault · **H** emote · **LMB** fire · **RMB** ADS · **R** reload · **T** fire-mode · **N** nade cycle · **1 / 2 / 3** weapons · **E** loot / door / revive · **Q** med · **G** throw · **F** ping · **Z / X / V / B** quick chat · **TAB** roster · **Esc** pause.

All binds remappable in Settings.

---

## N — Combat

Hybrid ballistics:

- **Hitscan:** melee, sidearm, SMG, shotgun, AR, LMG (CQC family).
- **Projectile:** DMR and sniper (speed + drop).
- **Grenades:** bounce, roll, fuse **1.55 s**.

Health **100**. Armor **50** durability with soak:

| Vest | Soak | Durability |
|---|---|---|
| None | 0% | 0 |
| Level 1 | 20% | 50 |
| Level 2 | 35% | 80 |
| Level 3 | 45% | 110 |

Body multipliers: head 1.00 · upper 0.78 · lower 0.62 · arms 0.48 · legs 0.42. Per-weapon head multipliers also apply.

Downed **22 s**, bleed **1.6 DPS**, revive **7.2 s** (hold interact). Finish melee **34**. Assist window **4 s**.

Authority owns ammo, reload (tactical vs empty), fire-mode, and swap times.

---

## O — Original Helix arsenal

Original names only. Range aliases (`p9`, `vector`, `carbine`, `scatter`, `dmr`) map to the same defs.

| Id | Name | Class |
|---|---|---|
| `knife` | Edgefold | Melee |
| `razor` | Razorline | Melee |
| `baton` | Arc Cane | Melee |
| `stitch` / `p9` | Stitch .9 | Sidearm |
| `orbit` | Orbit Compact | Sidearm |
| `staccato` | Staccato | Machine pistol |
| `crown` | Crown-6 | Revolver |
| `wisp` / `vector` | Wisp-9 | SMG |
| `sable` | Sable Rush | SMG |
| `breachwake` / `scatter` | Breachwake | Shotgun |
| `hollow` | Hollow-12 | Shotgun |
| `virex` / `carbine` | Virex Pulse | Rifle |
| `aegis` | Aegis Line | Rifle |
| `nadir` | Nadir-C | Rifle |
| `maw` | Maw-220 | LMG |
| `circlet` | Circlet Heavy | LMG |
| `kite` / `dmr` | Kite Spire | DMR |
| `meridian` | Meridian | DMR |
| `longbow` | Longbow Apex | Sniper |
| `aperture` | Aperture | Sniper |

**Throwables:** Shiver Charge (frag) · Veil Can (smoke) · Whiteout (flash) · Cinder Pot (fire disk).

**Medical / armor / ammo:** Weave Patch (+15, 2.2 s) · Helix Kit (+55, 4.5 s) · Plate Cement (repair 40, 3.2 s) · Light / Heavy Cells.

**Attachments (optic / barrel / mag / grip / stock):** Red Dot, Holo, 2x Spire, 4x Meridian, 8x Aperture, Hush Barrel, Compensator, Veil Brake, Deep Mag, Quick Mag, Vert / Angle / Tac grips, Anchor Stock, Light Stock.

Loot rarity weights: common 46 · uncommon 28 · rare 16 · epic 8 · legendary 2.

Range-only ION SKUs: `buy_repair` (30 ION) · `buy_plates` (40 ION). Ranked rejects the buy phase.

Telemetry: `GET /api/weapons` (pick / win / accuracy). Balance numbers change from this + tickets, not from a hunch.

---

## P — Operators (original)

Cosmetics never change hitboxes or damage.

| Callsign | Name | Role | Voice line |
|---|---|---|---|
| **VANGUARD** | Kael Rho | Strike lead | “Hold the line. Then take it.” |
| **SPECTRE** | Nyx Vale | Recon | “I already saw them.” |
| **WARDEN** | Iori Kane | Anchor | “Nobody drops on my watch.” |
| **NOMAD** | Reza Quill | Pathfinder | “Door's this way. Trust me.” |
| **CIRCLET** | Sera Lin | Field reader | “Breathe. Then move.” |
| **HEX** | Oren Pax | Systems | “If it glows, I can break it.” |
| **SABLE** | Ora Venn | Night runner | “Don't light up.” |
| **VOSS** | Eden Voss | Marshal | “We leave with the same number we brought.” |

Appearance sliders: hair, skin, eyes, face. Outfits / gloves / boots / pack / emblem / banner. Luma floor **0.18** — invisible kits are rejected.

**Emotes:** Open Palm · Hold Fast · Rally Arc · Quiet Win · Downed Honor.

---

## Q — Minds (bots)

Used to fill Quick Play and **Play with bots**. **Ranked is humans-only.**

Personas:

| Id | Name | Prefers |
|---|---|---|
| aggressive | Pusher | SMG / shotgun / rifle |
| defensive | Anchor | LMG / rifle / sidearm |
| support | Medic | Rifle / sidearm / SMG — revives first |
| strategist | Caller | DMR / sniper / rifle — rotates early |

Difficulties: **easy · normal · hard · elite** (reaction, accuracy, vision, hear, memory, fire, jitter, nades, slides).

Minds loot, take cover, revive, rotate from the storm, and ping. Names are generated (never copied celebrity kits).

---

## R — HUD, audio, UX

**Orbit Trace** chrome: hex panels, ion accent `#3dffc0`, orbit violet `#8b7cff`.

In match:

- HP / armor bars, ammo, nade, loadout strip
- Alpha / Bravo live count + phase clock
- Zone chip, compass, squad list (HP, down, speaking flag, distance)
- Minimap (landmarks, rings, pings, friendlies / hostiles)
- Crosshair, hitmarker, hurt flash, damage direction
- Killfeed, announce, killcard, comms line
- FPS / RTT / net quality (excellent / good / unstable / poor)
- ION / ORBIT readout
- Flashbang overlay, downed banner
- Pause does **not** stop the authority

**Helix mixer** (Web Audio, original synthesis — see `LICENSE_AUDIO.md`):

- Weapon fire per family, reload, hit, footstep, slide, storm
- UI beeps, found-match sting, victory / defeat beds
- Character callouts (spotted, reload, help, hurt, moving, clear, win, lose, greet)
- Buses: master, SFX, music, UI, voice, weapon, env, character, chat
- Spatial and mono toggles. No copyrighted samples.

**Settings tabs:** Graphics · Audio · Controls · Gameplay · Access · Account.

Access: UI scale, text scale, high contrast, reduce shake / flash, subtitles, colorblind (protan / deutan / tritan), left-handed touch.

---

## S — Progression (never buys a gunfight)

- **XP** from matches, hits, kills, challenges, dailies. Match XP cap **420**.
- **Operator level** → prestige at **100** (Second Orbit).
- **Weapon mastery** cap **50**.
- **Helix Rating** (Glicko-style): default 1200, RD 350 → min 50. Placements: **8**. Protect after 5.
- Ranked search band starts at 90, steps +70 every 15 s, max 420, over 120 s.

Ranks (divisions V–I below Master):

| Rank | Min HR |
|---|---|
| BRONZE | 0 |
| SILVER | 1000 |
| GOLD | 1200 |
| PLATINUM | 1400 |
| DIAMOND | 1600 |
| MASTER | 1800 |
| GRANDMASTER | 2000 |
| HELIX | 2200 |

Titles: Rookie · Survivor · Sharpshooter · Squad Leader · Veteran · Elite · Champion.

Challenges: daily / weekly / beginner (play, elims, revives, damage, range visit).

Achievements include First Mark, Yard Walker, Clean Hands, Get Up, Last Light, Pathfinder, Called Shot, Long Hand, Three Mark, On a Run, Gilded, Helix Peak, Second Orbit.

Boards: global / friends / clan / season. History: last matches (map, winner, duration).

Welcome-back after 14 days. AFK in a match: **no XP**.

---

## T — Economy (Orbit Vault)

| Coin | How | Spends on |
|---|---|---|
| **ION** | Matches, challenges, dailies (40 + 20 XP), free pass | Cosmetics |
| **ORBIT** | Optional. Sandbox packs 300 / 800 / 2000 | Cosmetics, premium pass, bundles |

- Starting ION: **100**. Kill reward **25**.
- Daily ION **40** (×2 during Ion Surge). Claim once per UTC day.
- Pass: **100** tiers, **80** XP each. Free track is real. Premium is cosmetic.
- Quotes always show item, qty, coin, total, bundle save, permanence, **cosmetic only**.
- Trading: **off**. Gifting: **off**. Loot boxes are **not** the store.
- Invisible luma and power skins are rejected (`assetOriginalOk`).
- **Real payments: not_yet.** Card data must never touch Helix. Razorpay / Stripe later, off-box.

Featured rotation is a UTC-day hash with an honest end time — no fake scarcity.

---

## U — Social

All writes are server-authorized. Search by **permanent Player ID** is canonical.

- Friends: request, accept, reject, cancel, favorite, remove, block / unblock.
- Default privacy: friends-only invites, hidden friend lists, optional online / match visibility.
- Party of 4. Leader kicks. Party chat. Party mode (quick / ranked / bots).
- Clans: tag + name, cap **50**, roles, announce, invite, kick, clan chat. Rank is rating / wins / activity — **never spend**.
- Recent players after a match (add / invite / block / report).
- Invites: friend / party / clan / match. TTL **60 s**.
- Chat channels: global / team / party / clan / whisper. Burst 5 / 8 s.
- Reports: reasons + Watch abuse gate. **No auto-ban** from one report or one stat.
- **Voice:** mute / speaking flag / volume. **No WebRTC media yet** (partial).

Mailbox tabs: Friends · Clan · Match · Rewards · System · **LIVE** · **NOTES**.

---

## V — Live ops

Season **1 ORBIT** is live. Soft reset later keeps lifetime history.

| Season | Theme | State |
|---|---|---|
| 1 ORBIT | Launch yard. Three maps. Honest guns. | **live** |
| 2 RIME | Cosmetics + weekend events. | planned |
| 3 GRID | New map content. | planned |
| 4 SPIRE | Weapons + competitive tweaks. | planned |
| 5 APEX | Major map expansion. | planned |

**Ion Surge** (2026-08-01 → 2026-09-01): daily ION ×2. **Matchmaking unchanged.** Events must not retune guns or ranked rules.

Patch notes: version, title, fixes, balance, content, known issues (`GET /api/live/notes`).

Feedback tickets: bug / suggest / balance / support / security. Severity critical → cosmetic. Emails and `password:` text are scrubbed. Password-shaped tickets are rejected (`never_send_password`).

Pipeline: concept → design → prototype → production → optimize → test → integrate → qa → release.

Channels: **dev → test (`npm run smoke`) → staging → beta → prod**.

Emergency order: currency dupe / auth / match / host → **security first**. Staff: `x-helix-staff` + `HELIX_STAFF_KEY`.

---

## W — Security and trust

Assume a fully patched client.

- Opaque sessions. Size-capped HTTP bodies and WS frames.
- Rate buckets: session, register, login, recover, report, find, matchmake, friend, invite, chat, ws, staff, buy.
- Watch: movement, aim, walls, packets, AFK, report-abuse, economy → heat → observe / flag / review / restrict. **Restrict is a staff recommendation. Nothing auto-bans.**
- Staff API is never in the game shell.
- Backups: timed copies of `accounts.json` under `.data/backups/` (last 8).
- Crash lines: `POST /api/crash` (redacted). Tail on `GET /api/monitor`.
- CORS open for the web client. Origin check on `/ws` (currently allow).

---

## X — Regions (directory)

Probes pick the lowest RTT. Demo is **one box**; `extraMs` keeps geography honest.

| Id | Name | City |
|---|---|---|
| india | India | Mumbai |
| singapore | Singapore | Singapore |
| japan | Japan | Tokyo |
| korea | South Korea | Seoul |
| europe | Europe | Frankfurt |
| middleeast | Middle East | Bahrain |
| na | North America | Virginia |
| sa | South America | São Paulo |
| oceania | Oceania | Sydney |

Multi-region production hosts: **partial**. Scale-out is more processes + Postgres + Redis, not a client rewrite.

---

## Y — HTTP / WS surface

JSON. Sensitive routes rate-limited.

`GET` `/api/health` `/api/status` `/api/stack` `/api/live` `/api/live/status` `/api/live/season` `/api/live/events` `/api/live/notes` `/api/monitor` `/api/security` `/api/economy` `/api/vault` `/api/audio` `/api/ux` `/api/maps` `/api/minds` `/api/progress` `/api/social` `/api/find` `/api/clans` `/api/boards` `/api/history` `/api/regions` `/api/regions/:id/ping` `/api/weapons` `/api/operators`

`POST` `/api/session` `/api/live/feedback` `/api/crash` `/api/vault/quote` `/api/vault/buy` `/api/vault/daily` plus auth / me / staff.

`WS` `/ws` — HELLO → PROFILE / INVENTORY / CURRENCY → snapshots, events, search, lobby, intro, results, social.

In production the same process also serves `client/dist` (SPA + hashed assets).

---

## Z — How to run, how to ship, what is not done

### Local

```bash
git clone https://github.com/developerrutu/vanguard-helix.git
cd vanguard-helix
npm install
npm run dev          # Vite :5173 + authority :8787
npm run smoke        # stack, live, economy, security, audio, ux, social, progress, minds
```

Dual typecheck: `npx tsc --noEmit -p client/tsconfig.json` and `server/tsconfig.json`.

### One-box production (the playable URL)

```bash
npm install && npm run build
HELIX_ENV=prod npm start
```

The authority serves the site + `/api` + `/ws`. `PORT` comes from the host.

**Use Render or Railway** (`render.yaml` / `railway.json`). **Do not use Vercel** as the game host — it cannot keep a 30 Hz WebSocket room.

### Honest status (2026-08-13)

| Implemented | Partial | Not yet |
|---|---|---|
| Boot, account, menu, social, MM, 4v4, bots, combat, 3 maps, HUD/audio, XP/rank, Vault, sessions/Watch | Voice mute, JSON DB, one-box regions, in-game tickets | Extra modes, real payments, ToS/privacy, closed test, open beta, **public launch** |

Quality budgets (**<10 s** load, **30/60/120** FPS, **5 s** join) are **targets to measure**, not claimed SLOs.

### What players keep forever

Player ID · username · friends · clan · inventory · statistics · achievements · progression · rank history.

### Repo map

```
shared/     protocol, combat, maps, minds, economy, live desk
server/     authority, matchmaker, rooms, vault, security, static site
client/     Orbit Trace PWA, input, Three.js, Helix mixer
scripts/    smoke tests
docs/       API.md
README.md   this A–Z overview (shown first on GitHub)
STATUS.md LAUNCH.md ROADMAP.md ARCHITECTURE.md DEPLOY.md
```

---

## Builder’s note

Vanguard was built to be a **real original web 4v4** — playable in a phone browser, authoritative in one Node process, expandable without wiping the operator.

It is working over pretty. It is not “fully release ready.”

**— developerrutu**
