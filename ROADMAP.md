# Roadmap — live ops, not a rebuild

Vanguard is a continuously expandable web 4v4. New maps, weapons, characters, cosmetics, modes, events, challenges, seasons, audio, VFX, and social ship as data + authority patches. Players keep Player ID, username, friends, clan, inventory, stats, achievements, progression, and rank history.

## Seasons

| Id | Name | Theme | State |
|---|---|---|---|
| 1 | ORBIT | Launch yard. Three maps. Honest guns. | **live** |
| 2 | RIME | Cosmetics + weekend events. | planned |
| 3 | GRID | New map content. | planned |
| 4 | SPIRE | Weapons + competitive tweaks. | planned |
| 5 | APEX | Major map expansion. | planned |

Soft reset between seasons: seasonal XP / pass / placing can roll. Lifetime history does not.

## Events

Live events are multipliers and cosmetics. They **do not** change matchmaking, damage, or ranked rules.
Ion Surge (S1, Aug 2026): daily ION ×2.

## Content pipeline

`concept → design → prototype → production → optimize → test → integrate → qa → release`

- Original assets only. Rights must be clean. Copied kits and power skins are rejected (`assetOriginalOk`).
- AI-generated output is reviewed and tested before it is live. It is not a ship gate by itself.
- Balance from telemetry (`/api/weapons`) and tickets (`POST /api/live/feedback`), never from a single clip.

## Feedback

In-game ticket: bug / suggest / balance / support / security.
Severity: critical → high → medium → low → cosmetic.
Support never asks for a password. Tickets are scrubbed of emails and password-shaped text.

## Tech debt

Regular, not heroic. Backward-compatible stores. Tested migrations. Prefer a small honest patch over a rewrite of combat, operators, movement, worlds, minds, progress, social, audio, security, or economy.

## Platforms

Web-first: Chrome, Edge, Firefox, Safari, Android browsers, Android PWA, desktop windowed/fullscreen.
Future iOS / other browsers must not compromise the web client or the 30 Hz WebSocket authority.

## What this roadmap is not

A promise that S2–S5 exist in the binary. They are **planned**. Extra modes are **not_yet**. Public launch is **not_yet**.
See `STATUS.md` and `GET /api/live`.
