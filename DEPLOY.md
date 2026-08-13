# Deploy

Path that must stay real:

**source → build → HTTPS site → session → matchmake → authority room → results → progression**

## Vercel will not run this game

Vercel is a **static / serverless** host. Vanguard’s authority is a **long-lived Node process**: HTTP `/api`, WebSocket `/ws`, and a 30 Hz match sim.

If you only connect this repo to Vercel you may get a menu. You will **not** get matchmaking, rooms, XP, or ION. That is not a bug in the game — Vercel cannot keep a WebSocket room alive.

**Playable hosts (pick one):** [Render](https://render.com) (Blueprint = `render.yaml`) or [Railway](https://railway.app) (`railway.json`). Both take the GitHub repo, build, and start one process. Open the public URL on your phone.

```bash
npm install
npm run build    # Vite client → client/dist
npm start        # authority serves the site + /api + /ws
```

`PORT` comes from the host. `HELIX_ENV=prod`. Data is `.data/` (ephemeral on free tiers unless you add a disk).

## Environments

| Env | Use |
|---|---|
| `dev` | Local `npm run dev` |
| `test` | `npm run smoke` + device passes |
| `staging` | Production-like boxes, fake players |
| `prod` | Live. Never point casual tools at prod data |

Set `HELIX_ENV` on the authority. Do not promote untested builds.

## Build

```bash
npm run build
```

Client: Vite hashed assets in `client/dist`.  
Server: `tsx src/index.ts` (or a compiled start if you add one). Protocol **15** must match on both sides.

## Website

- Terminate **HTTPS** in front (Caddy / nginx / Cloudflare).
- Serve `client/dist` as the public origin.
- Reverse-proxy `/api` and `/ws` to the authority. Keep WebSocket upgrades.
- Put `/assets/*` on a CDN. **Do not** CDN `/api` or `/ws`.
- Separate the public site from the sim hosts.

## Regions

One authority process per region at scale. The directory + ping probes already pick India / Singapore / Japan / Korea / Europe / Middle East / NA / SA / Oceania. Staging can still be one box — `extraMs` keeps geographic preference honest.

## Match lifecycle

1. Process up  
2. HELLO (protocol + session)  
3. Queue / accept / lobby  
4. Room start, teams, spawn  
5. 30 Hz sim  
6. Verified `MATCH_END`  
7. Persist rewards  
8. Room empty → stop  

Match ids stay server-minted. Display tag: `MATCH-` + 8 hex (`matchTag`).

## Scale-out (when CCU demands it)

- Horizontal room hosts behind a matchmaker queue  
- Postgres for accounts / ION / ORBIT (transactions)  
- Redis for sessions and queues  
- Object store for audit / match logs  
- Autoscaling on queue depth, not on vanity CPU  

The JSON store is the **demo lock**. The interfaces (`Store`, `Sessions`, `Vault`) are the swap points.

## Rollback

Tag every ship (`v14.0.0`). Keep the previous `client/dist` and authority image. If matchmaking, economy, or crash rate breaks: revert the tag, keep `.data` unless the schema itself is the fault.

## Secrets

`HELIX_STAFF_KEY`, future DB URLs, payment secrets — env or a vault. Never commit. Never ship in Vite.

## Load before public

8-player rooms, login spikes, queue spikes, vault traffic, boards, reconnects. Watch `GET /api/monitor` (rss, heap, ccu, rooms, errors).
