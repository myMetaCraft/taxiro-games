# SYNTHETIC EXAMPLE DATA — NOT A REAL GAME

These folders contain tiny, hand-made lookup tables that exist only to test
`tools/verify-rtp.mjs`. They are not the math of any Taxiro game and must
never be used for a real game.

- `SYNTHETIC-pass/` — 2 modes, both exactly 96.30 % RTP, max win 600x → PASS.
- `SYNTHETIC-fail/` — base 95.50 % RTP, bonus 102.1978 % RTP and a 6000x win → FAIL; its base books also
  deliberately disagree with the table for id 1 (150 vs 146) to show the books cross-check.

Format matches the real math output: `index.json` + one `id,weight,payoutMultiplier`
CSV per mode (payoutMultiplier in hundredths of the base bet), optional
`books_<mode>.jsonl` with `{ "id", "payoutMultiplier", ... }` per line.
