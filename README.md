# VANGUARD

> ## CRITICAL NOTE — READ THIS FIRST
>
> **This is an experiment. It is not a finished product and it does not guarantee a real game.**
>
> Vanguard exists **entirely to test Claude Fable 5** and to see what that model can build in one repo: a browser client, a server-authoritative 4v4 loop, and a one-box host. It is a **playable prototype / research build**, not a studio title, not an esports ship, and not a public launch.
>
> **This game is built by Claude Fable 5.**
>
> The GitHub account that publishes the source is **[developerrutu](https://github.com/developerrutu)**. Clone it, fork it, host it yourself if you want. Do not treat menus, bots, or a working WebSocket room as “release ready.”
>
> | | |
> |---|---|
> | **Total files in this repository** | **106** |
> | **Total lines of code (all tracked text)** | **23,667** |
> | **Source lines (TypeScript / JS / CSS / HTML)** | **19,546** |
> | **TypeScript only** | **17,686** |
> | **Counted on** | 2026-08-14 · `git ls-files` after this README + MIT `LICENSE` · 4 PNG icons excluded from line totals |
>
> There is **no warranty**. Matches can desync. Audio is procedural synth, not a soundtrack. Persistence is a local JSON file. Voice chat media is not implemented. Real payments are not implemented. If you host a copy, you own that copy — including its bugs.

---

Repository: [github.com/developerrutu/vanguard-helix](https://github.com/developerrutu/vanguard-helix)  
Runtime **Helix 15.0.0** · Protocol **15** · Season **1 ORBIT** (soft-live on this build)  
License **MIT** · Audio record [`LICENSE_AUDIO.md`](LICENSE_AUDIO.md)

`GET /api/live` reports `launch: "not_yet"`. That is intentional.

---

## What this experiment is

A **browser-native, server-authoritative** 4v4 Team Battle Royale prototype:

- One life. Shared loot. A closing ion storm.
- Skill / positioning / teamwork only. **No pay-to-win.** Cosmetics never change damage, health, or speed.
- No install. Chrome / Edge / Firefox / Safari / Samsung Internet / Android PWA.
- The browser **predicts** movement. The Node process is gospel for damage, health, ammo, inventory, ION, rank, and results.

It is easy to click around. It is **not** a promise that Vanguard will become a real commercial game.

---

## Clone and play on your own host

Anyone can run a private copy. You need **Node 20+**.

```bash
git clone https://github.com/developerrutu/vanguard-helix.git
cd vanguard-helix
npm install
npm run dev          # Vite :5173 + authority :8787
```

Open `http://localhost:5173`. Fastest real match: **Play with bots**.

```bash
npm run build
HELIX_ENV=prod npm start    # one process: site + /api + /ws
```

`PORT` comes from the host. Bind all interfaces so healthchecks work. **Do not use Vercel** as the game host — it cannot keep a 30 Hz WebSocket room. Use **Railway** (`railway.json`) or **Render** (`render.yaml`), or any VPS that runs `npm start`.

Copy `.env.example` if you need staff tools. **Never** put `HELIX_STAFF_KEY` in the client. Runtime data is `.data/` (gitignored).

```bash
npm run smoke
npx tsc --noEmit -p client/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json
```

---

## Open-source safety (what is in this tree)

Scanned before this README was written. **No GitHub PATs, no private keys, no `.env`, no player database, no payment keys.**

| In the repo | Not in the repo |
|---|---|
| Game source, maps, operators, synth mixer, docs | `.env`, `.data/`, `node_modules/`, `dist/` |
| `.env.example` with empty comments | Live session tokens, password hashes |
| MIT license + original-audio record | Railway / Render account secrets |

Session tokens and password hashes are **created at runtime** on your machine. The staff key is minted at boot unless you set `HELIX_STAFF_KEY` yourself.

If you fork this: rotate any keys **you** add. Do not commit `.data/accounts.json`.

---

## How a session goes (when it works)

1. Boot: hardware read → region probe → WebGL2 gate → guest session.
2. Orbit Trace menu: dossier, Start, Profile, Friends, Clan, Inventory, Boards, Store, Mail, Settings.
3. **Play with bots** / Quick / Ranked / Training Range.
4. Search → accept (10 s) → lobby (30 s) → intro (8 s) → deploy.
5. Spawn with **Edgefold**, **Stitch .9 / P9**, one **Weave Patch**. Loot. Storm closes.
6. In-match **MENU** (top-left) or **Esc**: Resume / Settings / Main Menu. Authority keeps simulating.
7. Results: K/D/A, MVP, XP, ION, Helix Rating delta. Player ID persists on **that host’s** `.data` folder.

---

## What is implemented vs not

| Implemented (runs in the integrated build) | Partial | Not yet — do not claim |
|---|---|---|
| Boot, guest account, menu, social, MM, 4v4, bots, combat, 3 maps, HUD / synth audio, XP / rank, cosmetic Vault, sessions / Watch | Voice **mute only** (no WebRTC media), JSON DB, one-box regions, in-game tickets | Extra modes, real payments, ToS / privacy counsel, closed test, open beta, **public launch** |

Quality numbers (**<10 s** load, **30/60/120** FPS, **5 s** join) are **targets to measure**, not SLOs.

---

## Stack (why this, not Unity / Vercel)

| Layer | Choice |
|---|---|
| Language | TypeScript — client, authority, shared protocol |
| Client | Vite + Three.js + WebGL2. WebGPU detected, never required |
| Net | WebSocket + JSON, **30 Hz**. Server validates the gunfight |
| Audio | Original Web Audio synthesis. No sample banks (`LICENSE_AUDIO.md`) |
| Store | Transactional JSON under `.data/` |
| Host | One Node process serves the site + `/api` + `/ws` |

Workspaces: `shared/` · `client/` · `server/`.

---

## Modes and maps

| Mode | Humans | Bots | Rating |
|---|---|---|---|
| Quick Play | Search ~8 s | Fill to 4v4 | No |
| Ranked | Humans only | None | Helix Rating |
| Play with bots | You | 7 minds | No |
| Training Range | Solo | Dummies | No farm |

Maps (playlist rotates): **Iron City** · **Red Sands** · **Frost Haven**. Weather is a look, not a stat.

Storm: seven ion-ring phases. HUD chip + minimap show current and next rings.

---

## Combat (short)

Hitscan for CQC family. Projectile for DMR / sniper. Grenades fuse **1.55 s**. Health **100**. Armor soak by vest level. Downed **22 s**, revive **7.2 s**. Authority owns ammo, reload, and swap.

Original arsenal and operators only (VANGUARD, SPECTRE, WARDEN, NOMAD, CIRCLET, HEX, SABLE, VOSS). Cosmetics never change hitboxes.

Desktop: WASD · Shift sprint · Ctrl crouch · P prone · Space jump · LMB fire · RMB ADS · R reload · E loot / door / revive · Esc / **MENU**. Touch: stick, look pad, FIRE.

---

## Economy

**ION** is earned. **ORBIT** is optional / sandbox. Vault is **appearance only**. Trading off. Gifting off. Real card data must never touch this process.

---

## Repo map

```
shared/     protocol, combat, maps, minds, economy
server/     authority, matchmaker, rooms, vault, security
client/     Orbit Trace PWA, input, Three.js, Helix mixer
scripts/    smoke tests
docs/       API.md
LICENSE     MIT
README.md   this file
```

How the line count was taken (re-run after you edit):

```bash
git ls-files | wc -l
git ls-files | grep -vE '\.png$' | xargs wc -l | tail -1
git ls-files '*.ts' '*.js' '*.mjs' '*.css' '*.html' | xargs wc -l | tail -1
```

---

## Builder’s note

Vanguard was generated as a **Claude Fable 5 experiment** — a single original web 4v4 to stress what that model can wire: prediction, authority, mobile HUD, synth audio, bots, and a one-box deploy.

It is working-over-pretty. It is **not** “fully release ready.” It does **not** guarantee a real game.

**— Claude Fable 5**  
Published by [developerrutu](https://github.com/developerrutu)
