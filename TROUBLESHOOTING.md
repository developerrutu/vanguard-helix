# Troubleshooting

## Update Required

HELLO protocol mismatch. Hard-refresh the client so it ships proto **15**. The authority rejects older shells from ranked and quick play.

## WebGL2 missing

Vanguard will not boot. Use a current Chrome / Edge / Firefox / Safari / Samsung Internet. IE and old Android WebViews are unsupported — that is a message, not a crash.

## Authority offline

`GET /api/health` should return `15.0.0`. If the client is on `:5173`, Vite must proxy `/api` and `/ws` to `:8787`.

## Reconnect loop

Ranked reserves the pawn for 5 minutes. Token must still resolve. If the room already ended, you land in the menu — you do not invent a result.

## ION / ORBIT did not move

Purchases are server-side. Check the quote confirm, then `GET /api/vault`. Duplicate `requestId` is a no-op, not a second grant.

## Audio silent

Browsers block AudioContext until a gesture. Click once. Check the Audio settings bus sliders.

## Landscape overlay stuck

Rotate the device. Some Android browsers cannot lock orientation; the overlay is the fallback.

## Staff 401

`x-helix-staff` must match `HELIX_STAFF_KEY`. The key is never in the client. Dev prints it once at boot.

## High ping

The directory picks the lowest probe. A single-box demo adds `extraMs` so India still wins from IST. Real deploys should be regional processes.

## Crash reports

`POST /api/crash` stores a redacted line (no emails). Tail them on `GET /api/monitor`.
