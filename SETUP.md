# Setup

Node **20+**. One repo, three workspaces: `shared`, `client`, `server`.

```bash
cd vanguard
npm install
npm run dev
```

- Client: `http://localhost:5173` (Vite, proxies `/api` and `/ws` to the authority)
- Authority: `http://127.0.0.1:8787`

Or split:

```bash
npm run dev:server
npm run dev:client
```

## What you get

A **real** 4v4 web match: guest session → region ping → queue → lobby → 30 Hz room → results → ION. Not a video, not a mock.

## Checks

```bash
npm run smoke
```

Dual typecheck: `npx tsc --noEmit -p client/tsconfig.json` and `server/tsconfig.json`.

## Environment

Copy `.env.example` if you need staff tools. Never put keys in the client.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Authority HTTP + WS |
| `HOST` | `0.0.0.0` | Bind address |
| `HELIX_ENV` | `dev` | `dev` / `test` / `staging` / `prod` |
| `HELIX_STAFF_KEY` | generated at boot | Staff API. Printed once in dev. |

Data lives in `.data/` (gitignored). Backups rotate under `.data/backups/`.

## Browser floor

WebGL2 + a current Chrome / Edge / Firefox / Safari / Samsung Internet. See `GET /api/stack`.
