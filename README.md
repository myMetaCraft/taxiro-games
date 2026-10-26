# taxiro-games — Taxiro partner demo portal

Static site where casinos and aggregators can try Taxiro's original slot games
**in fun-money demo mode only**. Plain HTML/CSS/JS, no build step, no dependencies.
Works on GitHub Pages at the root of a custom domain (planned: `games.taxiro.ai`)
and under a project sub-path (`https://<user>.github.io/taxiro-games/`) — all links are relative.

> **This repository must contain only the portal shell.**
> Games are built and hosted **separately** and are only **embedded** here via iframe.
> **Never commit game bundles, game source, or math** (lookup tables, books, configs, weights)
> to this repo. `.gitignore` blocks the usual file names, but check every commit.

## Structure

| Path | What |
|---|---|
| `index.html` | Landing: hero, pillars, game gallery, how it works, partner contact, footer |
| `play.html?game=<id>` | Player page: embeds the game's `embedUrl` in a sandboxed iframe |
| `games.json` | Game catalogue (see `docs/games.schema.json`). Now: one "Coming soon" placeholder |
| `js/config.js` | Public settings: `contactEmail` (**TODO, empty — owner must supply**), demo RGS base URL, site/embed origins, RTP policy |
| `js/site.js`, `js/gallery.js`, `js/player.js` | UI logic |
| `css/style.css` | All styles (dark premium theme, responsive PC / phone portrait / phone landscape) |
| `assets/` | Logo v3 "Medallion" (SVG), simplified coin-T favicon, self-hosted fonts (Inter, Space Grotesk — SIL OFL, licences included) |
| `brand/` | Taxiro logo variants v1–v3 (SVG + PNG; **v3 is the main logo**), favicon set, generator script |
| `docs/ARCHITECTURE.md` | How demos are served: separate demo RGS, math only on the server |
| `docs/ADDING_A_GAME.md` | Checklist that must be completed before a game goes into `games.json` |
| `tools/verify-rtp.mjs` | RTP / max-win gate (Node ≥ 18, no deps). Must PASS before listing a game |
| `tools/examples/` | **Synthetic** example math for testing the gate only — not a real game |
| `tools/screenshots.cjs` | Playwright visual/behaviour check (needs Playwright installed locally) |

## Rules

1. **Fun money only.** No real-money play, wallets, deposits or payments on this site or its demo RGS.
2. **Math never reaches the browser.** The demo RGS draws outcomes server-side (see `docs/ARCHITECTURE.md`).
3. **RTP gate.** Every mode must be inside the game's agreed target RTP range (sanity limits 85–99 %) and the max win within the cap, proven by
   `node tools/verify-rtp.mjs <mathDir>` on the *exact* tables the demo RGS loads. The gallery
   shows RTP and the *Verified* badge only when `verified: true`; the Play button only appears
   when the game is `live`, verified, every mode is within policy and `embedUrl` is HTTPS.
4. Brand is **Taxiro** only. All player-visible text in English.

## Local preview

```bash
python3 -m http.server 8765      # then open http://127.0.0.1:8765/
```
(`games.json` is loaded with `fetch`, so opening the file directly via `file://` will not list games.)

## Deploying (not done yet — needs the owner's go-ahead)

- GitHub Pages from the default branch root. `.nojekyll` is included.
- Custom domain: the `CNAME` file (`games.taxiro.ai`) is ready; the DNS record `games` → `mymetacraft.github.io` is set only when the owner says so.
- Before going public: set `contactEmail` in `js/config.js`, and narrow the CSP `frame-src https:` in
  `index.html` / `play.html` plus `allowedEmbedOrigins` in `js/config.js` to the real game host.
