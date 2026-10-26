# Adding a game to the portal — checklist

A game may appear in `games.json` as `"status": "live"` only when **every** box is ticked.
Until then keep it out, or list it as `"status": "coming-soon"` with `"verified": false`.

## 1. Math (done in the private math repo, never here)
- [ ] Final math generated (lookup tables + books for every mode) and frozen.
- [ ] Run the gate on the exact folder the demo RGS will load:
      ```bash
      node tools/verify-rtp.mjs /path/to/private/publish_files --id <game-id> \
           --min <target-low> --max <target-high> --max-win-x <cap> --json /tmp/<game-id>-rtp.json
      ```
- [ ] Result is **PASS** (exit code 0): every mode RTP within the game's agreed target range, max win ≤ cap,
      tables valid (no duplicate ids, integer weights/payouts).
- [ ] Books cross-check is `ok` (if books are `.zst`, decompress to `.jsonl` or use Node ≥ 22.15),
      otherwise note why it was skipped.
- [ ] Do **not** commit the math folder or the JSON report to this repo.

## 2. Demo RGS (private infrastructure)
- [ ] The game's math is deployed to the demo RGS (server-side only).
- [ ] The RGS fingerprint equals `mathSha256` printed by the gate.
- [ ] Fun-money only: demo balance, no payments, no accounts.
- [ ] Spot-check: play ≥ 1,000 demo rounds per mode in a script and confirm payouts only take
      values that exist in the lookup table (sanity, not an RTP proof).

## 3. Game build (private hosting)
- [ ] Front-end build hosted on HTTPS at a stable URL; it contains **no** lookup tables/weights.
- [ ] Works on PC, phone portrait and phone landscape; all text English.
- [ ] Opens correctly inside an iframe (no `X-Frame-Options: DENY`; CSP `frame-ancestors`
      allows `games.taxiro.ai` and the GitHub Pages origin).

## 4. Portal entry (this repo)
- [ ] Add the entry to `games.json` with the fields printed by the gate:
      ```json
      {
        "id": "<game-id>",
        "name": "<Game Name>",
        "status": "live",
        "tagline": "<one line>",
        "embedUrl": "https://<rgs>/launch/<game-id>",
        "rtp": { "base": 96.25, "bonus": 96.25 },
        "maxWinX": 5000,
        "verified": true,
        "verifiedAt": "<ISO timestamp from the gate>",
        "mathSha256": "<fingerprint from the gate>",
        "thumbnail": "assets/games/<game-id>.webp"
      }
      ```
- [ ] Cover art only in `assets/games/` (an image, no game code).
- [ ] Add the game host origin to `allowedEmbedOrigins` in `js/config.js` (the demo RGS origin is already there) and to the CSP `frame-src`
      in `index.html` and `play.html`.
- [ ] Run `tools/screenshots.cjs` (PC / portrait / landscape), check the screenshots.
- [ ] Owner approval before pushing / publishing.

## Re-verification
Any change to the math (even weights only) → re-run the gate, update `rtp`, `maxWinX`,
`verifiedAt`, `mathSha256`, and redeploy the same tables to the demo RGS.
