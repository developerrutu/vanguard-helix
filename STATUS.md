# Status — honest, 2026-08-13

Helix **15.0.0** / protocol **15**. This is a **playable core**, not a public launch.
`livePublic().launch === "not_yet"`. Do not call the build release-ready because menus exist.

A row is **implemented** only if it runs in the integrated game and was exercised (smoke, curl, or a match).
Code, screenshots, and mock sheets do not count.

## Feature matrix

| Area | State | Note |
|---|---|---|
| Website + boot | implemented | Vite shell, PWA, landscape overlay |
| Account + Player ID | implemented | Guest + claim. Server-minted `p_[12 hex]` |
| Main menu / profile | implemented | Orbit Trace, barracks, boards |
| Friends / party / clan | implemented | Search, invites, block, report, chat |
| Voice chat | partial | Speaking flag + mute. No WebRTC media |
| Matchmaking | implemented | Quick / ranked / bots / range. Ping region |
| 4v4 match loop | implemented | Queue → lobby → deploy → circle → results |
| Bot fill | implemented | Minds, cover, loot, revive. Ranked humans-only |
| Core combat | implemented | Hitscan + projectile, nades, revive, authority ammo |
| Maps | implemented | Iron City, Red Sands, Frost Haven. Playlist rotates |
| Extra modes | not_yet | Team BR + range only. LTMs are data, not wired |
| HUD / audio | implemented | Orbit Trace + Helix mixer |
| XP / rank / mastery | implemented | Helix Rating, challenges, achievements |
| ION / ORBIT / Vault | implemented | Cosmetic only. Sandbox top-up |
| Real payments | not_yet | No PSP. Card data must never hit Helix |
| Sessions / Watch / staff | implemented | No auto-ban. Staff API exists |
| Durable database | partial | Transactional JSON store. Postgres is scale-out |
| Multi-region hosts | partial | Directory + probes. Demo is one box |
| Human support desk | partial | In-game ticket. Password never asked |
| ToS / privacy pages | not_yet | Architecture ready. Counsel not shipped |
| Closed test / open beta | not_yet | Playable now. Population not opened |
| Public launch | not_yet | Do not call this release-ready |

## Quality targets (measured, not assumed)

| Target | Budget | Status |
|---|---|---|
| Average load | < 10 s | Measure on a cold cache. Not claimed. |
| Join after match found | < 5 s | Accept window is 10 s. Not load-tested at pop. |
| Frame rate | 30 min / 60 std / 90–120 supported | Adaptive quality exists. Device-dependent. |
| Tick | 30 Hz | Locked on the authority. |
| Crash rate | measure | `/api/crash` + `/api/monitor`. No SLO yet. |

## What is open

- Local / single-box **dev** channel.
- Season **1 ORBIT** (soft-live on this build).
- Event **Ion Surge** (2026-08-01 → 2026-09-01): daily ION ×2. Matchmaking unchanged.

## What is not open

- Closed test, open beta, public launch.
- Real money. Voice media. Extra modes. Legal pages.
- Multi-region production hosts. Postgres. A human ticket queue with SLAs.

See `LAUNCH.md` and `ROADMAP.md`. Query `GET /api/live`.
