# VANGUARD

Browser-native, **server-authoritative** 4v4 competitive shooter. Dedicated regions. No peer-to-peer.

**Built by [developerrutu](https://github.com/developerrutu).** Full A–Z record: [`GAME_OVERVIEW.md`](GAME_OVERVIEW.md).

## Quick start

```bash
cd vanguard
npm install
npm run dev
```

Open the **client** port. Vite proxies `/api` and `/ws` to the authority on `:8787`.

**Phone / public URL:** do **not** use Vercel for the live game (no persistent WebSocket). Push this repo to GitHub, then connect **Render** or **Railway**. One process serves the site, `/api`, and `/ws`. See `DEPLOY.md`.

## Play

| Button | What happens |
|---|---|
| **QUICK PLAY** | Search 8s for humans, then bot-fill to 4v4. XP yes, ranked rating no. |
| **RANKED** | Humans only. Band expands for 2 min, then offers Quick/Bots. 8 placements. Helix Rating. |
| **PLAY WITH BOTS** | Instant 4v4 vs AI. Reduced XP. |
| **TRAINING RANGE** | Solo sandbox: still dummy + strafe dummy. No XP farm. |
| **SQUAD** | Find by player id or callsign. Friend requests, parties of 4, clans (cap 50), recent players, reports. |

Boot picks the **lowest-latency region** (India from this timezone). Ping pill is green / yellow / orange / red.

**Team Battle Royale:** spawn with a knife, P9 and one bandage. Loot the playlist map (Iron City, Red Sands, or Frost Haven). Storm closes. One life — teammates can revive a downed operator (hold **E**, 7s). **E** also opens doors.

In match: **WASD** · **Shift** sprint · **Ctrl** crouch · **P** prone · **Space** jump (auto-vaults low cover) · **H** emote · **LMB** fire · **RMB** ADS · **T** fire-mode · **N** nade cycle · **1/2/3** weapons · **E** loot/revive · **Q** med · **G** throw · **F** ping · **Z/X/V/B** quick chat · **TAB** roster.

**Barracks** (menu): pick an original operator and cosmetics. Nothing there changes hitboxes or damage. Stamina is unlimited — sprint is a loud, inaccurate trade.

Combat is hybrid: hitscan for CQC/AR/SMG/shotgun/sidearm, projectiles for DMR/sniper, bounce/roll grenades (Shiver Charge, Veil Can, Whiteout, Cinder Pot). Original Helix arsenal only. `GET /api/weapons` dumps pick/win/accuracy telemetry.

Win by wiping the other squad or surviving the final circle. Rewards are server-only. No pay-to-win.

## Layout

```
shared/    protocol v2, regions, ranks, sim
server/    directory, matchmaker, social, room, bots, flags
client/    PWA, search / accept / lobby / results
```

Maps rotate **IRON CITY / RED SANDS / FROST HAVEN**. Ranked is humans-only Helix Rating. Quick Play may fill minds. Progression never buys a gunfight. `GET /api/maps` · `GET /api/minds` · `GET /api/progress` · `GET /api/boards`.

Maps rotate **IRON CITY / RED SANDS / FROST HAVEN**. Ranked is humans-only Helix Rating. Quick Play may fill minds. Progression never buys a gunfight. Social is server-authorized — search by permanent id, friends-only invites by default. `GET /api/maps` · `GET /api/minds` · `GET /api/progress` · `GET /api/boards` · `GET /api/find` · `GET /api/social` · `GET /api/clans`.

Orbit Trace UI is landscape-first, remappable, and localized (`en` / `hi`). Store and mailbox are cosmetic/system shells — they cannot buy a gunfight. `GET /api/ux`.

Audio is original Helix synthesis (Web Audio). No copyrighted samples. `GET /api/audio`.

Security assumes a compromised client. Sessions rotate and revoke. Passwords are scrypt. Watch flags for review — never a single-stat auto-ban. `GET /api/security`.

The Vault sells paint, not power. **ION** is earned. **ORBIT** is optional cosmetics. `GET /api/economy`.

The stack is TypeScript, WebGL2, WebSocket, 30 Hz authority. `GET /api/stack` · `GET /api/monitor`. Setup: `SETUP.md`. Ship: `DEPLOY.md`.

Live ops live on `GET /api/live` (season, events, notes, honest feature matrix, feedback). Season 1 ORBIT is live; S2–S5 are planned. Public launch, closed test, payments, and ToS are **not_yet**. Read `STATUS.md`, `LAUNCH.md`, `ROADMAP.md` before calling anything shipped.

`ARCHITECTURE.md` is the decision record for Parts 1–15. Protocol **15** / HELIX **15.0.0**.
