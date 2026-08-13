# Launch — do not fake completion

## Launch version (definition)

A launch version is a **stable playable core**:

site → load → welcome → account → Player ID → menu → profile → friends → matchmaking → 4v4 → bots → combat → ≥1 map → weapons → characters → HUD → audio → results → XP → basic rank → settings → security → servers.

That loop exists on this box. **That is not a public launch.**

Extra maps, modes, cosmetics, seasons, events, and platforms ship later without wiping:

Player ID, username, friends, clan, inventory, stats, achievements, progression, rank history.

## Gates that are still closed

| Gate | State | Why it is closed |
|---|---|---|
| Closed test | not_yet | No allowlist, no NDA flow, no population cap ops |
| Open beta | not_yet | No ToS/privacy, no support SLA, no crash SLO |
| Public launch | not_yet | Payments, legal, regions, and voice media are not done |
| Real payments | not_yet | Sandbox ORBIT only. Card data must never touch Helix |
| Voice | partial | Mute / speaking flag. No WebRTC media |
| Legal | not_yet | Counsel has not shipped pages |

If a deck, screenshot, or menu says otherwise, the menu is wrong.

## Emergency order

Currency dupe, auth break, match desync, or host failure: **security first**.
Take the economy or matchmaker offline before a cosmetic hotfix.
Staff: `x-helix-staff` + `HELIX_STAFF_KEY`. Never ask a player for a password.

## Patches

Every patch publishes version, notes, fixes, balance, content, known issues on `GET /api/live/notes`.
Balance numbers change only from usage / win / pick / feedback — not from a hunch.
Events must not retune matchmaking.

## Channels

`dev` → smoke (`npm run smoke`) → `staging` → `beta` → `prod`.

`HELIX_ENV` labels the box. Protocol mismatch → **Update Required**.

## What “done” is not

- Code exists
- A menu exists
- A mock or screenshot exists
- The AI said it was finished

A feature is implemented only if it functions in the integrated game and was tested.

Query `GET /api/live`. The `launch` field is `"not_yet"` until a human opens the population.
