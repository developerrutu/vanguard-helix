# VANGUARD — Part 1 Technical Architecture

Working title: **VANGUARD**  
Runtime: **Helix**  
Document status: **Part 1 locked** — platform, authority model, and stack. Gameplay content arrives in Part 2.

This document is the decision record required by the AI Decision Rule. Every major choice was scored on performance, scalability, security, reliability, cost, future expansion, browser compatibility, and mobile compatibility.

---

## 1. What Part 1 delivers

Part 1 does **not** invent a genre, story, or art bible. It builds the **non-negotiable chassis** every later part must sit on:

| Requirement | Implementation |
|---|---|
| Web-only, no install | Browser client + optional PWA |
| Android / Windows / macOS / Linux | Single TypeScript client, capability-based quality |
| Chrome, Edge, Firefox, Safari | WebGL2 baseline, progressive APIs only |
| Mobile landscape + fullscreen + touch | Orientation lock, rotate overlay, virtual controls |
| Desktop KB/M + controller + ultrawide | Unified input + Hor+ FOV |
| Server authority | Server simulates; client predicts and is reconciled |
| < 10 s load | Tiny shell, code-split renderer, procedural Part 1 assets |
| 30 / 60 / 90 / 120 FPS | Uncapped rAF with selectable cap + adaptive quality |
| Memory / LOD / streaming | Quality profiles, pixel-ratio caps, asset pipeline hooks |

When Part 2 arrives, it should add **content and rules**, not rewrite the pipe.

---

## 2. Decision record

### 2.1 Language — TypeScript on client and server

| Option | Perf | Scale | Security | Mobile/Browser | Complexity | Cost |
|---|---|---|---|---|---|---|
| TypeScript | High enough for this class of game; WASM escape hatch | Excellent (one protocol, one math lib) | Strong typing on the wire contract | Native | Low | Low |
| JavaScript | Same runtime | Weaker contracts | More foot-guns | Native | Lowest | Low |
| Rust / WASM client | Highest | Harder shared logic with JS server | Excellent | Larger toolchain, Safari edge cases | High | Medium |
| C# Unity WebGL | Good once loaded | Slow iteration | Typical Unity | Heavy download, weak PWA, poor low-end Android | High | High (load-time fails the 10 s budget) |
| Godot HTML5 | Mixed | Smaller ecosystem | Mixed | Larger WASM, uneven mobile | Medium | Medium |

**Selection:** TypeScript everywhere, with a `shared/` package that both sides import. Hot simulation paths can move to WASM later without changing the protocol.

**Why not Unity/Godot for web:** their web exports routinely miss the **< 10 s** load target on average connections and fight PWA / landscape / low-end Android. They also hide the server, which we must own.

---

### 2.2 Client framework — Vite + custom loop, no React

| Option | Perf | Load | Game-loop fit |
|---|---|---|---|
| Vite + vanilla TS UI | Highest (no VDOM on the 120 FPS path) | Smallest | Excellent |
| React / Vue overlay | Good if isolated | Larger | Easy to accidentally render every frame |
| PlayCanvas editor stack | Good | Heavier opinion + larger kernel | Excellent, less control |
| Webpack | Fine | Slower dev, worse DX | Fine |

**Selection:** Vite 6, ES2022 target, manual chunk for `three`. HUD/menus are vanilla DOM updated from the game loop only when dirty.

---

### 2.3 Renderer — Three.js on WebGL2, WebGPU as a future path

| Option | Browser coverage | Mobile | Bundle | 2D *and* 3D | LOD / post |
|---|---|---|---|---|---|
| Three.js + WebGL2 | Universal among required browsers | Excellent if we cap pixel ratio | ~600 kB compressed, code-split | Orthographic or perspective | Full control |
| Babylon.js | Excellent | Excellent | Larger default kernel | Excellent | Batteries included |
| PlayCanvas | Excellent | Excellent | Engine + editor runtime | Excellent | Good |
| Raw WebGPU | Safari / Firefox / older Android gaps | Risky as baseline | Tiny if we write everything | We would write everything | High cost |
| PixiJS | Excellent | Excellent | Small | 2D only | If Part 2 is 2D we can still add it |

**Selection:** **Three.js + WebGL2** as the production baseline. Detect WebGPU and expose it as a quality flag; do not require it.

**Why:** Part 2 has not declared 2D vs 3D. Three.js can do both (ortho camera = 2.5D / top-down). Bundle stays inside the load budget. If Part 2 is a pure 2D brawler we can swap the renderer module without touching net, input, authority, or persistence.

---

### 2.4 Multiplayer — custom authoritative tick server (not P2P, not Colyseus)

| Option | Authority | Cheat resistance | Fit for inventory/economy | Ops cost |
|---|---|---|---|---|
| Custom Node + `ws` + shared sim | Total | We define every check | First-class transactions | Low |
| Colyseus | Good | Schema helps; combat still custom | Extra mapping layer | Low |
| Nakama | Excellent | Excellent | Excellent | Higher (Go runtime + ops) |
| Photon / PlayFab | Good | Vendor rules | Vendor economy | Recurring cost, less control |
| P2P / WebRTC host | None | Trivial to cheat | Unsafe | Looks cheap, fails the spec |

**Selection:** **Custom server-authoritative simulation** in Node.js/TypeScript with `ws`.

- Client sends **inputs**, never positions, damage, or currency.
- Server runs a **fixed 30 Hz** tick (configurable to 60).
- Server broadcasts **snapshots**. Local player uses **prediction + reconciliation**. Remotes use **interpolation**.
- Matchmaker, inventory, currency, XP, and match results live only on the server.

**Why not Nakama yet:** it is a strong *later* scale-out option (Part N), but it would freeze Part 2 behind a heavy stack. The Store interface is written so we can slide Nakama or a Go sim behind it.

**Why 30 Hz tick, not 128:** browsers, mobile radios, and shared Node event loops. 30 Hz + interpolation is the right default; the clock is a constant, not a rewrite.

---

### 2.5 Persistence — interface now, Postgres + Redis in production

| Store | Role | Part 1 | Production |
|---|---|---|---|
| JSON file + memory | Profiles, inventory, currency, stats | **Active** (zero ops) | Dev only |
| PostgreSQL | Durable accounts, inventory, ledger, progression | Adapter ready | **Source of truth** |
| Redis | Sessions, matchmaking queues, rate limits, presence | In-memory equivalent | **Hot path** |

Currency and inventory mutations go through a single `ledger()` function. That is where Postgres transactions will sit. The client never writes these stores.

---

### 2.6 Audio — Web Audio graph, no giant banks in Part 1

Procedural / tiny buffers for UI and weapons in Part 1. Buses: `master → music / sfx / ui`. Compression and streaming hooks are in the audio engine for Part 2 banks (Opus recommended).

---

### 2.7 Deployment shape (future, not blocking Part 2)

```
CDN (client, hashed assets, Brotli)
    │
Edge anycast
    │
Node game process(es)  ── Redis (queue, presence)
    │
Postgres (accounts, ledger, stats)
```

Horizontal scale = **stateless HTTP + sharded rooms**. A room never splits mid-match. This is the standard authoritative model (Fortnite/Valorant-class, not their tick rate).

Cost efficiency: one Node process will hold Part 2 development CCU. No cloud lock-in.

---

## 3. Authority model (non-negotiable)

```
┌─────────────┐   inputs only    ┌──────────────────────┐
│   Client    │ ───────────────► │  Helix Authority     │
│  predict &  │                  │  tick 30 Hz          │
│  interpolate│ ◄─────────────── │  validate + simulate │
└─────────────┘    snapshots     │  persist results     │
                                 └──────────────────────┘
```

| System | Client may | Server does |
|---|---|---|
| Position | Predict | Integrate, clamp speed/accel, collide, reconcile |
| Aim | Send look deltas | Clamp turn rate, accept yaw/pitch |
| Damage | Send fire *intent* | Hitscan/projectile, LOS, fire-rate, apply health |
| Health | Render | Mutate |
| Inventory | Request use/equip | Grant, consume, reject |
| Currency | Request purchase | Ledger debit/credit |
| Stats / XP / match result | Display | Compute at match end, persist |
| Graphics / audio / HUD | Full authority | None |

Speed-hack, teleport, damage-hack, and gold-hack clients are rejected by construction.

---

## 4. Runtime loop

**Server** — canonical Fix-Your-Timestep:

```
accumulator += wallDt
while accumulator >= 1/30:
    drain inputs
    simulate(1/30)
    snapshot()
    accumulator -= 1/30
```

**Client**

```
rAF frame
  sample devices → InputFrame
  if due: send input, predict locally
  interpolate remotes
  render 3D
  flush dirty HUD
```

FPS caps (30/60/90/120/off) sleep against `rAF` timestamps. High-refresh panels just get more rAF; we do not invent frames.

---

## 5. Device & quality policy

On boot the client measures: WebGL2, optional WebGPU, GPU renderer string, core count, `deviceMemory`, touch, gamepad, pixel ratio, refresh-rate estimate, coarse network.

Profiles: `potato | low | medium | high | ultra`.

| Knob | potato | low | medium | high | ultra |
|---|---|---|---|---|---|
| Pixel ratio cap | 1.0 | 1.0 | 1.5 | 2.0 | native |
| Shadows | off | off | cheap | mid | high |
| Draw distance | 40 | 60 | 90 | 140 | 200 |
| Particles | 0 | low | mid | high | high |
| Antialias | off | off | off | on | on |
| Post | off | off | cheap | full | full |

Auto profile is conservative on Android (thermals). The player can override in Settings. This is how low-end and 120 Hz desktop share one build.

---

## 6. Display contract

**Mobile**

- CSS + `screen.orientation.lock('landscape')` after a user gesture
- Portrait → full-screen “rotate device” gate (no gameplay in portrait)
- `requestFullscreen()` on first gesture
- `100dvh` / `env(safe-area-inset-*)`
- Touch: left stick, right look, action cluster
- `touch-action: none`, no bounce, no pull-to-refresh

**Desktop**

- Pointer lock for look
- Keyboard + mouse + standard-mapped gamepad
- Windowed or Fullscreen API
- Ultrawide: Hor+ vertical FOV, HUD limited to a 21:9 safe column, side fade

---

## 7. Performance budget

| Budget | Target | Part 1 tactic |
|---|---|---|
| First interactive | < 10 s on average | Shell < 50 kB, Three.js async chunk, no multi-MB textures |
| Match join after found | < 5 s | Room already warm; client only receives `match_start` + snapshot |
| Frame time | 8.3 / 11.1 / 16.6 / 33 ms | Adaptive pixel ratio if frame time slips |
| JS heap | Keep streaming hooks | Dispose unused Three objects; no texture atlas yet |

Asset pipeline (ready for Part 2, unused now):

- Textures → KTX2 / Basis Universal
- Audio → Opus
- Meshes → glTF + Draco, streamed by distance
- Dynamic LOD distances from the active quality profile

---

## 8. Security baseline

- Origin check on WebSocket upgrade
- Session token issued by HTTP, required on hello
- Input rate limit + sequence monotonicity
- Max speed, max accel, max turn rate
- Fire-rate and range checks
- Ledger-only economy
- No trust of client-reported health, hits, or gold
- Server time is the only match clock

Auth providers (Google, Apple, guest) are a later part; the session slot already exists.

---

## 9. Repository map

```
vanguard/
  ARCHITECTURE.md          ← this file
  README.md
  package.json             ← workspaces + dev orchestrator
  shared/src/              ← protocol, math, sim, items (single source of truth)
  server/src/              ← authority, matchmaker, ledger, rooms
  client/                  ← PWA + renderer + input + prediction
```

Extension points for Part 2 (do not fork these — fill them):

- `shared/src/catalog.ts` — weapons, items, economy SKUs
- `shared/src/map.ts` — collision / spawn data
- `server/src/sim/rules.ts` — win conditions, scoring
- `client/src/game/view/` — meshes, VFX, animation

---

## 10. What Part 2 should send

To implement without re-deciding Part 1, Part 2 should specify:

1. Genre and camera (FPS, TPS, top-down, etc.)
2. Modes and player counts
3. Combat rules and weapons
4. Movement model (sprint, slide, vehicles…)
5. Progression / economy / inventory
6. Maps and art direction
7. Audio / music intent
8. Monetization constraints (if any)
9. Target CCU for the first live environment

The Helix runtime is already running a **Training Range** that proves movement authority, hitscan authority, inventory authority, and currency authority. Part 2 replaces the range with the real game.

---

## 11. Part 1 requirement trace

| Spec item | Where it lives |
|---|---|
| Web / no install | `client/` Vite app |
| Android + desktop browsers | Single TS client, capability profiles |
| PWA | `client/public/manifest.webmanifest`, `sw.js`, install prompt |
| Chrome / Edge / Firefox / Safari | WebGL2 baseline, progressive WebGPU detect |
| Mobile landscape + rotate gate | `boot/display.ts`, `#rotate` overlay |
| Auto fullscreen | first gesture → Fullscreen API |
| Touch controls | `#touch` + `input/input.ts` |
| High refresh + 30/60/90/120 cap | rAF + `settings.fpsCap` |
| Low-end support | potato/low profiles, pixel-ratio cap |
| Keyboard / mouse / controller | unified `InputManager` |
| Ultrawide | Hor+ FOV in `GameRenderer.resize` |
| Windowed / fullscreen | Fullscreen API + setting |
| Adjustable graphics | Settings modal → quality profiles |
| Server authority: position | `server/src/sim/room.ts` + shared `applyInput` |
| Server authority: damage / health | hitscan + health only on server |
| Server authority: inventory / currency | `Store.ledger` / `consumeItem` |
| Server authority: stats / XP | `Store.grantXp` / `bumpStat` |
| Client never authoritative | client sends inputs only (`protocol.ts`) |
| < 10 s load | no heavy assets; Three.js code-split |
| < 5 s match join | room warm; range is instant; quick fills at 3.5 s |
| Asset streaming / LOD hooks | quality `drawDistance` + comments in ARCHITECTURE §7 |

Part 1 is **locked**. Part 2 (below) adds the 4v4 competitive pipe.

---

## 12. Part 2 — Multiplayer architecture

Genre lock: **online competitive shooter**. Camera stays third-person-over-shoulder until a later art/combat part says otherwise. Networking does **not** change if the camera does.

### 12.1 Dedicated authority only

Still no P2P. Every match is a `Room` on a region node. Clients send inputs. Bots are **server-side controllers**, not extra clients.

Supported occupants:

| Role | Implementation |
|---|---|
| Real player | Human account + WebSocket |
| AI bot | `sim/bot.ts` writes `InputPayload` on the tick |
| Friend / contact | Real friend or seeded AI contact (RAVI / MIRA / JUN) |
| Party | 1–4, leader queues the unit |
| Reconnect | Slot reserved 5 minutes, then bot takeover |
| Spectator | `Room.addSpectator` hook (no HUD yet) |

### 12.2 Regions and ping

Logical regions (one process today, one cluster later): India, Singapore, Japan, South Korea, Europe, Middle East, North America, South America, Oceania.

- Boot probes `GET /api/regions/:id/ping`
- Distant regions add documented extra latency so a single box still **selects the lowest measured RTT** (India from Asia/Kolkata)
- HUD ping colors: green 0–50, yellow 51–100, orange 101–150, red 151+
- Lag compensation: rewind targets by `min(150ms, rtt/2)` on hitscan. Remotes interpolate. Abuse: rewind capped, flags on speed / seq / wall / aim streaks

### 12.3 Matchmaking (4v4)

Priority when assembling 8 seats: **humans > friends/party > similar MMR > similar ping > bot fill**.

| Case | Result |
|---|---|
| 8 humans | Start |
| 7 / 5 / 1 humans | Fill 1 / 3 / 7 bots after 8s human window |
| PLAY WITH BOTS | Skip search, full bot match, lobby |

Flow: **START GAME → search HUD (found / ETA / region / ping) → MATCH FOUND 10s accept (timeout = decline) → lobby 30s (READY shortens to 3s if all humans ready) → live**.

Teams balanced with parties kept together, then snake-draft by MMR + K/D + accuracy + win rate.

### 12.4 Social

- Party: solo / duo / trio / squad of 4. Leader invites, kicks, starts queue.
- Invites: friend, party, clan, match. **60s TTL**.
- AI contacts auto-accept so a solo operator can squad up without a second device.

### 12.5 Match live + end

Server validates damage, health, position, **ammo, reload, grenades**, XP and rewards. Friendly fire off in ranked.

End screen: winner, duration, K/D/A, accuracy, damage, MVP. Career stats, XP, credits, MMR/rank committed **only on the server** at match end.

Win: first to 20 elims or 4:00.

### 12.6 Scale to 10M without a redesign

```
Anycast directory
  └─ Region cluster (k8s)
       ├─ WS gateway (sticky by session)
       ├─ Matchmaker (Redis queues, MMR buckets)   ← Matchmaker class
       ├─ Room workers (1 match / process)         ← Room class
       ├─ Social (global, party affinity)          ← Social class
       └─ Postgres ledger + Redis presence         ← Store interface
```

A room never splits. Horizontal scale = more region nodes + more room workers. This sandbox **is** one region node + embedded directory. Swap the transport, not the contracts.

### 12.7 Part 2 requirement trace

| Spec | Where |
|---|---|
| Dedicated servers, no P2P | `server/src/sim/room.ts` |
| Real / bot / friend / invite / matchmake / reconnect / spectator hook | `matchmaker.ts`, `social.ts`, `bot.ts` |
| Global regions + auto lowest RTT | `shared/src/regions.ts`, `/api/regions` |
| Ping colors + delay compensation | `pingBand`, rewind in `tryFire`, remote lerp |
| 4v4 + priority + bot cases | `matchmaker.ts` |
| Search / found 10s / lobby 30s | client overlays + `MATCH_ACCEPT_MS` / `LOBBY_MS` |
| Team balance | `match/balance.ts` |
| 5 min reconnect then bot | `disconnect` + `botTakeover` |
| Party 1–4 + 60s invites | `social/social.ts` |
| Ammo / reload / nade / results / XP | room + `Store.applyMatch` |
| Cheat flags | `anticheat/flags.ts` → `.data/flags.log` |

---

## 13. Part 3 — Team Battle Royale

Primary mode is **4v4 Team BR** on **ORBIT YARD**. No pay-to-win. Victory is a team wipe or last squad standing in the final circle.

Match sequence (server-driven):

1. Match found → accept → lobby  
2. Loading (3s) → cinematic intro (8s): map, match #, banners  
3. Fair opposite-side team deploy (4 randomized pairs, teammates together)  
4. Start loadout: **knife + P9 + bandage** only  
5. Dynamic loot (common→legendary), never the same seed  
6. Six zone phases, storm damage outside, no auto-heal  
7. Downed crawl / 7s revive / bleed-out / finish  
8. Team wipe ends it; otherwise the circle does  
9. Results + server rewards + Play Again  

Inventory is six slots (primary / secondary / melee / grenade / medical / utility). Armor L1–L3 soaks with durability. Headshots multiply; legendary is strong, not a win button.

Comms: **F** ping, **Z/X/C/V/B** quick chat, speaking flag for voice. Report is filed on the authority.

---

## 14. Part 4 — Combat

**Ballistics locked: hybrid.**

| Class | Model | Why |
|---|---|---|
| SMG / AR / LMG / pistol / shotgun / melee | Hitscan + falloff + penetration + 150ms rewind | Fair at 30 Hz on mobile |
| DMR / sniper | Projectile + travel + drop | Skill ceiling without simulating mag-dumps |
| Throwables | Bounce / roll / fuse | Shiver Charge, Veil Can, Whiteout, Cinder Pot |

All names are original Helix designs. No real-world copies. Catalog is data-only (`shared/src/catalog.ts`) so new guns/attachments/nades are rows, not rewrites.

Combat features: body zones, recoil V/H + recovery, ADS FOV, attachments, tactical vs empty reload (interruptible), swap lock, single/burst/auto, pellet shotguns with falloff, sniper projectiles, light/heavy melee, smoke LOS (bots too), flash by angle, kill feed, `GET /api/weapons` telemetry.

---

## 15. Part 5 — Operators, movement, cosmetics

**Stamina: Option A — unlimited.** Sprint already costs weapon readiness and footstep noise; slide has a cooldown. A stamina bar would punish aggression more than it adds skill and fights the “responsive over realistic” rule. Esports titles in this class (Valorant / Apex-like) keep sprint as a stance, not a resource.

| Choice | Why |
|---|---|
| Unlimited sprint | Predictable, no “out of breath” deaths |
| Sprint trade-offs | +speed, −readiness, louder steps |
| Slide cooldown 1.35s | Aggressive entry without spam |
| Fair hitboxes | Same radius; stance changes height only (stand 1.75 / crouch 1.12 / prone 0.48) |

Operators are original Helix dossiers (`shared/src/operators.ts`): Vanguard, Spectre, Warden, Nomad, Circlet, Hex, Sable, Voss. Unique look, voice pitch, personality, lore. No real-world copies. Cosmetics (face/hair/skin/eyes/outfit/gloves/boots/pack/emblem/banner/skins) are **server-validated** and never change combat. Invisible / ultra-dark skins rejected (`luma < 0.18`).

Locomotion lives in shared `applyInput` so client prediction matches the authority: walk/run/sprint, crouch, prone, jump, auto-vault (low props), climb volumes, slide (sprint+crouch), swim/dive, fall damage over 5.4 m. Animations are original procedural rigs (no Mixamo, no copyrighted dances). Emotes: hail / hold / rally / win / mourn.

Progression still unlocks **cosmetics and achievements only**. `GET /api/operators` · `GET /api/history`. Accessibility: sensitivity, invert Y, colorblind modes, left-handed touch, remappable intent via settings.

---

## 16. Part 6 — Worlds

Launch maps are original Helix arenas. Ranked does **not** vote and does **not** roll a private RNG for the map.

| Option | Verdict |
|---|---|
| A Random | Rejected — VODs and practice cannot target the next map |
| B Vote | Rejected — +lobby time, stack-gaming, weather would need a second vote |
| **C Rotating playlist** | **Selected** — match `#` indexes a 9-slot cycle (3 maps × 3 weathers). Knowable, fair, esports-ready |

Weather is a **look** (static lighting + particles + fog). It never changes damage, spread, or move speed. Lighting is static per weather variant (dynamic day/night would be unfair mid-round and expensive on mobile).

| Map | Scale (half) | Identity | Weather |
|---|---|---|---|
| **IRON CITY** | 66 | Urban CQC + rooftops + metro | clear / rain / night |
| **RED SANDS** | 78 | Open desert, long sightlines | sunny / dust / sunset |
| **FROST HAVEN** | 70 | Ice lake, ridges, mixed range | winter / snow / blizzard |

Buildings are wall shells + interior cover + walkable floors + climb volumes (stairs / ladders / lifts). Doors toggle on **E**. Glass and waist-high crates are the only destructibles — large-scale building collapse was rejected (2.5D collision, mobile fill-rate, and it would invalidate practice sightlines). Surfaces (concrete / metal / sand / snow / dirt / water) drive footstep pitch. Zone radii scale with `map.half`; final circles are clamped on-map and off the Frost lake. `GET /api/maps` publishes the playlist and the selection rationale. New seasonal maps are a row in `WORLDS` + `PLAYLIST`.

---

## 17. Part 7 — Minds

Bots are teammates and opponents, not fodder. They write the **same `InputPayload`** humans do. The authority never gives them wallhacks, smoke sight, or instant positions.

| Choice | Why |
|---|---|
| Server-side brain only | Mobile/browser CPU stays on render; one tick loop already owns combat |
| Same InputPayload | Fairness is mechanical — no hidden aimbot API |
| Data personas + skills | New playstyles are rows in `shared/src/minds.ts`, not a rewrite |
| Imperfect perception | Vision cone/range + weather mul, sound linger, fading last-known. Smoke still hides `alive` |
| No cheat elite | Elite is faster reaction / tighter jitter / earlier rotate — still LOS and the same guns |

**Personas** (mixed every match by slot): Aggressive closer, Defensive anchor, Support medic, Strategist caller.

**Difficulty** (Easy / Normal / Hard / Elite): reaction, accuracy, vision, hear, memory, fire rate, jitter, nade use. New operators (`matches < 5`) get Easy/Normal fill so ranked is not a slaughter. PLAY WITH BOTS scales by MMR. Ranked fill uses MMR + slot so a lobby is not one personality or one skill.

**Identity:** unique id, human callsign (`KiteWalk12` style — never BOT/AI/CPU), operator, appearance. Lobby/results/TAB do not stamp “AI” on the name. Search still shows humans/bots count so new-player protection is not a lie.

**Behavior on the tick:** hear shots/steps/nades → last-known memory → LOS via `hitscanBlocked` → cover under fire → flank (strategist / hard+) → heal / revive if safe → loot by weapon taste → rotate early when the circle bites → stuck recover. Accuracy and aggression adapt ±0.06 from the score delta, still capped. Dropped humans get a covering mind; the announce says they dropped, not “tactical AI”.

**Training:** still dummy + strafe dummy on the range. Combat sim is PLAY WITH BOTS at the chosen difficulty.

`GET /api/minds` publishes personas, skill cards, and the fairness rule. Protocol **7** / HELIX **7.0.0**.

---

## 18. Part 8 — Progression

Progression must make operators feel proud, not stronger. **Level, prestige, titles, badges, mastery, and challenges never change health, damage, speed, armor, or accuracy.** The authority computes every XP, rating, and unlock. The client only displays.

### 18.1 Rating — Helix Rating (Glicko-1 team)

| Option | Verdict |
|---|---|
| Elo | Rejected — no uncertainty; placements and returners get crushed |
| TrueSkill | Rejected — extra draw/β parameters, opaque for a published 4v4 ladder |
| Glicko-2 full | Volatility σ is a third hidden number players cannot read |
| **Glicko-1 team + residual** | **Selected** — visible HR + hidden RD. Opponent is the enemy squad average. Individual K/A/revives/damage is a **bounded residual** (±0.22), so you cannot farm rating by padding stats while throwing |

8 placement matches. First 5 ranked losses after placement take half the rating drop. Soft season reset: `1200 + 0.45*(HR-1200)`, RD opens, lifetime stats stay. Season 1 is **ORBIT**.

Tiers: Bronze V–I → Silver → Gold → Platinum → Diamond → Master → Grandmaster → **Helix** (apex).

### 18.2 Modes

| Queue | Bots | Rating |
|---|---|---|
| **QUICK PLAY** | Fill after 8s | XP yes, HR no |
| **RANKED** | Never. Extend search, expand ±band every 15s, then offer Quick/Bots | HR yes |
| **PLAY WITH BOTS** | Full lobby | XP reduced (0.55), HR no |
| **RANGE** | Dummies | No XP (anti-farm) |

Ranked never secretly fills high lobbies. Contacts are stripped from a ranked party.

### 18.3 Anti-exploit

AFK (no travel / shots / damage) → 0 XP, flag. Bot-heavy lobbies → XP cut. Repeat foe sets → trade heat → flag. Range dummy kills grant no credits.

`GET /api/progress` · `GET /api/boards?scope=` · Barracks career / challenges / boards. Protocol **8** / HELIX **8.0.0**.

---

## 19. Part 9 — Social

Social is a **server-authorized graph**. The client never writes friends, clans, blocks, invites, reports, or permissions. Permanent player id is the canonical search key; callsign is a convenience alias.

### 19.1 Why this shape

| Option | Verdict |
|---|---|
| Client-owned friend lists | Rejected — impersonation and silent unfriend races |
| Open global chat as default | Rejected — spam/harass surface |
| Proximity voice | **Skipped** — team comms stay clear; speaking flag + mute only |
| Paid clan ranks | Rejected — no pay-to-win, no spend-to-rank |
| **Authority Social + privacy defaults** | **Selected** — friends-only invites/whispers, hidden friend lists, rate limits |

### 19.2 Surfaces

| Surface | Rule |
|---|---|
| Search | Exact id first, then callsign. Returns name, id, avatar/operator, level, rank, online/presence |
| Friends | request / accept / reject / cancel / remove / block. 8 requests / 60s |
| List filters | online / offline / in-match / available / favorites (pinned) |
| Party | 1–4. Leader queues, invites, kicks, sets mode. Leadership auto-transfers on leave |
| Invites | friend / party / clan / match. 60s TTL. Sender name+id, mode. 4 / 20s |
| Recent | last 24 humans in a match — add / block / report |
| Clan | unique tag+name, 50 cap, roles leader/colead/officer/member. Rank by HR / wins / activity. Contribution is cosmetic |
| Chat | global / team / party / clan / whisper. Filter (en/es/fr/de/hi) + 5 / 8s flood |
| Voice | team/party speaking flag, mute list. No proximity |
| Presence | online / queue / lobby / match / away / dnd / offline. Hide optional |
| Reports | cheat/harass/language/grief/exploit/name/clan/other + server evidence (ids, match, time, chat) |

`GET /api/find?q=` · `GET /api/social` · `GET /api/clans` · `MSG.SOCIAL_CMD` / `SOCIAL_PACK`. Protocol **9** / HELIX **9.0.0**.

---

## 20. Part 10 — Orbit Trace UI

The chrome is **Orbit Trace**: hex-cut ion on ink, Rajdhani display + IBM Plex Mono data. It is not a website skin and not another title's HUD.

| Choice | Why |
|---|---|
| Vanilla DOM + dirty updates | HUD must not run a VDOM on the 120 FPS path |
| Hex clip + 160ms ease | Distinct identity, cheap on mobile (no blur-heavy glass stacks) |
| i18n table (`shared/src/i18n.ts`) | Strings never live in sim. English default; Hindi shipping for the India audience. Expand by adding a table |
| Menu 3D = live Iron City + operator | Seasonal rotation is a `useWorld` swap. Potato disables weather/showcase extras |
| Procedural menu theme | No licensed bank; music bus is independent of SFX |
| Store / mailbox shells | Appearance-only vault. No power SKUs. Mail is social/system notes — later parts fill catalogs |

HUD stays competitive-readable: HP/AR, weapon+mag+mode, 4-man squad with distance + voice pip, minimap, compass, zone, kill feed, hit/hurt/dir. Ultrawide keeps HUD in a 21:9 safe column. Touch presets (standard / advanced / left) + remappable keys + gyro + pad rumble. AUTO OPTIMIZE still picks the capability profile.

`GET /api/ux`. Protocol **10** / HELIX **10.0.0**. The client still never writes currency, rank, XP, inventory, or results.

---

## 21. Part 11 — Helix mixer

Audio is **original synthesis** on the Web Audio API. No sampled banks, no copyrighted recreations. That choice wins browser coverage, the <10 s load budget, and commercial clearance in one move.

| Option | Verdict |
|---|---|
| Licensed sample pack | Rejected — license tracking + multi-MB download |
| Recreate famous FPS guns | Forbidden |
| **Helix mixer (oscillators + one noise buffer)** | **Selected** — original, tiny, mobile-safe, new weapons are a row |

**Buses:** master (limited) → music (ducked) / weapons / effects / environment / character / voice / UI / voice chat.

**3D:** `PannerNode` HRTF when the browser allows, equalpower fallback. Distance inverse rolloff. Occlusion = wall hitscan → lowpass. Indoor/outdoor is the same occlusion path.

**Fairness:** footsteps, muzzle, and distant report tell direction, range band, surface, and weapon *class*. They do not reveal a hidden enemy through walls beyond what a line of sight / sound would allow.

**Voice chat:** mute / volume / disable now. Opus/WebRTC is the scale-out path. Raw PCM never rides the game snapshot. Reports stay on the social authority — no auto-ban from audio classifiers.

`GET /api/audio` · `LICENSE_AUDIO.md`. Protocol **11** / HELIX **11.0.0**.

---

## 22. Part 12 — Trust nothing the browser says

The client can be fully inspected and patched. Security is therefore **authority-first**, not obfuscation.

| Option | Verdict |
|---|---|
| JWT in localStorage + client-signed results | Rejected — unrevocable, client-writable |
| Browser anti-cheat / WASM integrity as the gate | Rejected — attackers patch it |
| Cloud WAF + Redis rate limit as the only layer | Later scale-out, not the first lock |
| **Opaque sessions + scrypt + Watch + staff RBAC** | **Selected** — revoke, rotate, review; no auto-ban from one stat |

**Authority already owns** damage, health, position, ammo, reload, results, XP, rank, currency, inventory. Part 12 adds the account and investigation surface around that.

**Accounts.** Guest remains the fast path. Register/login claims the same server-minted `p_[12 hex]` id. Passwords are scrypt (N=16384). Recovery codes are hashed. Plaintext never touches disk or the browser store. Tokens are opaque, idle/absolute TTL, rotatable, listable, revocable. Simultaneous devices flag; they do not kick.

**Network.** Every HTTP body and WS frame is size-capped. Sensitive routes are token-bucketed (login, register, report, search, matchmake). Malformed input is dropped. Seq replay is still rejected in the room.

**Watch.** Flags from movement, aim, walls, packets, AFK, report-abuse, and economy feed a heat score. `recommendAction` is observe → flag → review → restrict. **Restrict is a staff recommendation.** Nothing auto-bans.

**Staff.** `/api/staff/*` behind `x-helix-staff` + `HELIX_STAFF_KEY` (never in the client). Roles: viewer / moderator / admin. Sanctions and reversals are audited.

**Privacy.** Export / correct / delete. Delete anonymizes the callsign and revokes sessions; match rows stay for integrity.

**Backups.** Timed copies of `accounts.json` under `.data/backups/` (last 8). Restore is an ops procedure, not a client button.

`GET /api/security`. Protocol **12** / HELIX **12.0.0**.

---

## 23. Part 13 — Orbit Vault

Money must never buy a gunfight. The competitive loadout is looted or earned in the yard.

| Option | Verdict |
|---|---|
| One currency for kits and skins | Rejected — blurs power and paint |
| Loot boxes as the store | Rejected — odds, regulation, feel |
| Energy / ads in match | Forbidden |
| **ION (earned) + ORBIT (optional) + direct cosmetic SKUs** | **Selected** — transparent, skill-first |

**ION** drops from matches, dailies, challenges, and the free pass. **ORBIT** is optional and only spends on cosmetics, bundles, and the premium track. Range ION kits (`buy_repair` / `buy_plates`) stay training-only; ranked already rejects the buy phase.

Quotes always show item, qty, coin, total, list vs bundle save, permanence, and “cosmetic only.” Sandbox ORBIT packs exist so the ledger can be tested; live card data never touches Helix (Razorpay/Stripe later).

Trading and gifting are **off**. Pass is 100 tiers, free track is real. Featured rotation is a UTC-day hash with an honest end time — no fake scarcity.

`GET /api/economy` · `GET /api/vault`. Protocol **13** / HELIX **13.0.0**.

---

## 24. Part 14 — Keep it a web game

This is still a **browser match**, not a native port wearing a website. The stack was picked for coverage, 4v4 cost, and a <10 s shell — not for fashion.

| Layer | Choice | Rejected |
|---|---|---|
| Language | TypeScript shared + client + authority | Unity/Godot web (load), Rust-first (split brain) |
| Render | Three.js / WebGL2, WebGPU optional | Raw WebGPU baseline (Safari/Android gaps) |
| Net | **WebSocket / JSON / 30 Hz** | WebRTC datachannel as the game wire (TURN, hotel Wi-Fi) |
| Store | In-process JSON (`Store`) | Exposing Postgres to the browser |
| Tick | **30 Hz** | 20 (slack guns) / 60 (double cost, same 4v4 feel) |

**Why 30 Hz.** Eight pawns, rewind ≤ 150 ms, mobile radios. Snapshot size stays in the tens of KB/s. Doubling the tick doubles CPU and battery for almost no gunfeel on this mode.

**Why WebSocket.** Every required browser speaks it through HTTPS proxies. WebRTC stays reserved for optional voice (Part 11). Prediction is local; the snap is gospel; remotes interpolate.

**Scale path (not the demo lock).** Regional room hosts, Postgres for ION/ORBIT/accounts, Redis for sessions and queues, CDN for `/assets` only. Interfaces already exist: `Store`, `Sessions`, `Vault`, `Directory`.

**Ship path.** `dev → test (npm run smoke) → staging → prod`. `HELIX_ENV` labels the box. Protocol mismatch → **Update Required**. No WebGL2 → a clear matrix message. Crashes POST redacted lines to `/api/crash`. `GET /api/monitor` is RSS / heap / CCU / rooms / errors.

**Offline.** Cached shell, settings, range if loaded. Never offline rank or currency.

`GET /api/stack` · `GET /api/monitor`. Protocol **14** / HELIX **14.0.0**. `SETUP.md` · `DEPLOY.md` · `TROUBLESHOOTING.md` · `docs/API.md`.

---

## 25. Part 15 — Live ops, not a launch claim

The playable core is expandable. It is **not** a public ship. `livePublic().launch` is `"not_yet"` until a human opens the population.

| Option | Verdict |
|---|---|
| Fake “1.0 complete” because menus exist | Rejected — status is implemented / partial / not_yet only |
| Season wipe of Player ID / friends / inventory | Rejected — `KEEP_ACROSS_SEASONS` is the contract |
| Events that retune matchmaking or damage | Rejected — events are ION/cosmetic only |
| Balance from vibes | Rejected — usage / win / pick / tickets |
| **Desk + seasons + notes + tickets + honest matrix** | **Selected** — ops without rewriting combat |

**Seasons.** S1 ORBIT is live. S2 RIME / S3 GRID / S4 SPIRE / S5 APEX are planned. Soft reset keeps lifetime history.

**Events.** `ion_surge_s1` (Aug 2026) multiplies daily ION. `matchmaking: "unchanged"`. Vault `daily()` calls `ionDailyMul()`.

**Patches.** Version, notes, fixes, balance, content, known issues on `GET /api/live/notes`. Emergency order: currency / auth / match / host — security first.

**Feedback.** `POST /api/live/feedback` (session, rate-limited). Scrubs emails and password-shaped text. Support never asks for a password.

**Pipeline.** concept → … → release. Original assets; `assetOriginalOk` rejects copies, unlicensed kits, invisible luma, power skins. AI output is reviewed.

**Channels.** `dev / staging / beta / prod`. Closed test, open beta, public launch, payments, ToS: **not_yet**. Voice and the JSON store: **partial**.

`GET /api/live` · `STATUS.md` · `LAUNCH.md` · `ROADMAP.md`. Protocol **15** / HELIX **15.0.0**.
