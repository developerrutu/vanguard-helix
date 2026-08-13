# HTTP surface

All JSON. CORS open for the web client. Bodies capped. Sensitive routes rate-limited.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Engine, proto, env, uptime |
| GET | `/api/status` | CCU, rooms, queue, flags |
| GET | `/api/stack` | Stack decision record |
| GET | `/api/live` | Season, events, notes, honest feature matrix. `launch` is `not_yet` |
| GET | `/api/live/status` | Same desk payload |
| GET | `/api/live/season` | Live season row |
| GET | `/api/live/events` | Active events (MM unchanged) |
| GET | `/api/live/notes` | Patch notes |
| POST | `/api/live/feedback` | Session ticket. Never send a password |
| GET | `/api/monitor` | RSS, heap, errors, crashes |
| POST | `/api/crash` | Redacted client fault |
| POST | `/api/session` | Guest / resume |
| GET | `/api/security` | Security public |
| GET | `/api/economy` | Vault public |
| GET | `/api/vault` | Wallet + featured |
| POST | `/api/vault/quote` | Pre-purchase quote |
| POST | `/api/vault/buy` | Server grant |
| POST | `/api/vault/daily` | Daily ION |
| GET | `/api/audio` | Mixer public |
| GET | `/api/ux` | Orbit Trace public |
| GET | `/api/maps` | Worlds |
| GET | `/api/minds` | Bots |
| GET | `/api/progress` | Rating / seasons |
| GET | `/api/social` | Social pack |
| GET | `/api/find` | Player search |
| GET | `/api/clans` | Clan board |
| GET | `/api/boards` | Leaderboards |
| GET | `/api/history` | Match history |
| GET | `/api/regions` | Directory |
| GET | `/api/regions/:id/ping` | Probe |
| GET | `/api/weapons` | Telemetry |
| GET | `/api/operators` | Operators / cosmetics |
| WS | `/ws` | HELLO → snapshots |

Staff (`/api/staff/*`) needs `x-helix-staff`. Never call it from the game shell.
