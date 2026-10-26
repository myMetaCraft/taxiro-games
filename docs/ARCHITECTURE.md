# Architecture — how a Taxiro demo is served

```
 Browser (partner)
 ┌──────────────────────────┐ 1. iframe src = https://<demo-rgs>/launch/<game-id>
 │ games.taxiro.ai (this    │ ─────────────────────────────────┐
 │ repo, GitHub Pages)      │                                  ▼
 │  - gallery, play.html    │      ┌───────────────────────────────────────────────┐
 └──────────────────────────┘      │ Demo RGS (fun money, private repo, Railway)    │
                                   │  GET /launch/<id> → new demo session, 302 to   │
             2. 302 redirect       │    game host ?sessionID=…&rgs_url=<rgs>/g/<id>  │
   ┌───────────────────────────────│  POST /wallet/authenticate → demo balance      │
   ▼                               │  POST /wallet/play {mode, amount}              │
 ┌──────────────────────────────┐  │       → draws ONE outcome by official weight,  │
 │ Game host (static build)     │  │         returns only that round's book         │
 │ https://<game-host>/<id>/    │  │  POST /wallet/end-round → credits win once     │
 │ art, animation, sound,       │──│  POST /bet/event, /wallet/balance              │
 │ book-player; no math         │3.│  loads index.json + lookUpTable_*.csv +        │
 └──────────────────────────────┘  │  books_* at start-up, server-side only         │
        HTTPS JSON (CORS allowlist)└───────────────────────────────────────────────┘
```

## Principles

- **Same math as the real game.** The demo RGS loads the game's official math output
  (the same `index.json`, lookup tables and books that the release uses). Outcome selection is
  `P(id) = weight / Σweight` per mode, exactly like production, so the demo has the same RTP
  (the game's own target RTP in every mode) and the same max win.
- **Fingerprint match.** At start-up the demo RGS computes the SHA-256 fingerprint of its lookup
  tables the same way `tools/verify-rtp.mjs` does (mode name + cost + table bytes, in index order)
  and refuses to serve a game whose fingerprint differs from the `mathSha256` pinned in the
  game's server-side `game.json` (set it to the same value as in `games.json`). It also refuses any
  game whose RTP gate fails (same rules as `tools/verify-rtp.mjs`).
- **Math never reaches the browser.** The browser receives only the book (event list) of the
  round it just played. Lookup tables, weights, full books and configs stay on the server.
  No endpoint lists outcomes or weights.
- **Fun money only.** Demo balance (e.g. 10,000.00 demo credits) per anonymous session, resettable,
  no cash value, no deposits, withdrawals, payment providers or accounts.
- **Front-end only on the game host.** The hosted game build contains art, animation and the
  book-player; it contains no lookup tables or weights.
- **Isolation.** The portal embeds games in a sandboxed iframe (`allow-scripts allow-same-origin
  allow-pointer-lock`, `referrerpolicy=no-referrer`). CSP `frame-src` should be narrowed to the
  game host before launch.
- **Abuse limits.** The demo RGS rate-limits `/wallet/play` and session launches per IP, expires
  idle sessions and only answers allowlisted origins (CORS), so nobody can quickly sample millions
  of rounds to reconstruct the distribution.
- **Launch flow.** A game's `embedUrl` in `games.json` is the demo RGS launch URL
  (`https://<demo-rgs>/launch/<game-id>`). The RGS mints the session and redirects the iframe to the
  game host with `sessionID` and `rgs_url`. Therefore `allowedEmbedOrigins` (js/config.js) and CSP
  `frame-src` must list both the demo RGS origin and the game host origin; the demo RGS's
  `ALLOWED_ORIGINS` must list the game host origin (the game, not this site, calls the API).

## Not part of this repo

The demo RGS server (`taxiro-demo-server`, private repo, deployed on Railway), game builds and all
math live in private repositories / private storage. Nothing from them is ever committed here.
