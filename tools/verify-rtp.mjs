#!/usr/bin/env node
/**
 * verify-rtp.mjs — Taxiro math gate.
 *
 * Verifies a game's math output BEFORE the game may be listed in games.json.
 * Reads the math folder LOCALLY (it is never committed to this repo):
 *
 *   <mathDir>/index.json                 { "modes": [ { name, cost, weights, events? } ] }
 *   <mathDir>/<weights>.csv              lookup table rows:  id,weight,payoutMultiplier
 *                                        payoutMultiplier is in hundredths of the BASE bet
 *                                        (250 = 2.5x base bet), weight is an integer.
 *   <mathDir>/<events>.jsonl[.zst]       optional books; if readable, every book's
 *                                        payoutMultiplier is cross-checked with the table.
 *
 * Per mode:  RTP = sum(weight * payout) / (sum(weight) * 100 * cost)
 *            maxWinX = max(payout) / 100   (multiples of the base bet)
 *
 * Usage:
 *   node tools/verify-rtp.mjs <mathDir> [--min 96.0] [--max 96.7] [--max-win-x 5000]
 *                             [--id game-id] [--json report.json] [--skip-books]
 *
 * Exit code 0 = PASS (all modes in range, max win within cap, tables valid).
 * Exit code 1 = FAIL, 2 = usage / input error.
 * On PASS it prints the exact games.json fields to paste (rtp, maxWinX, verified, verifiedAt, mathSha256).
 * No dependencies. Node >= 18. Exact integer arithmetic (BigInt), no sampling.
 */
import { readFileSync, existsSync, writeFileSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, basename } from 'node:path';
import * as zlib from 'node:zlib';
import { createInterface } from 'node:readline';

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error('usage: node tools/verify-rtp.mjs <mathDir> [--min 96.0] [--max 96.7] [--max-win-x 5000] [--id game-id] [--json out.json] [--skip-books]');
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = { min: 96.0, max: 96.7, maxWinX: 5000, id: null, json: null, skipBooks: false };
let mathDir = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => { if (i + 1 >= args.length) usage(`missing value for ${a}`); return args[++i]; };
  if (a === '--min') opts.min = Number(next());
  else if (a === '--max') opts.max = Number(next());
  else if (a === '--max-win-x') opts.maxWinX = Number(next());
  else if (a === '--id') opts.id = next();
  else if (a === '--json') opts.json = next();
  else if (a === '--skip-books') opts.skipBooks = true;
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('--')) usage(`unknown option ${a}`);
  else if (!mathDir) mathDir = a;
  else usage(`unexpected argument ${a}`);
}
if (!mathDir) usage('mathDir is required');
for (const k of ['min', 'max', 'maxWinX']) if (!Number.isFinite(opts[k]) || opts[k] <= 0) usage(`invalid --${k}`);
if (opts.min > opts.max) usage('--min is greater than --max');
mathDir = resolve(mathDir);

const indexPath = join(mathDir, 'index.json');
if (!existsSync(indexPath)) usage(`no index.json in ${mathDir}`);
let index;
try { index = JSON.parse(readFileSync(indexPath, 'utf8')); } catch (e) { usage(`index.json is not valid JSON: ${e.message}`); }
if (!Array.isArray(index.modes) || index.modes.length === 0) usage('index.json has no "modes" array');

// Exact decimal formatting of a BigInt ratio, `digits` decimals.
function ratio(num, den, digits = 6) {
  const scale = 10n ** BigInt(digits);
  const q = (num * scale * 2n + den) / (den * 2n); // rounded
  const s = q.toString().padStart(digits + 1, '0');
  return Number(`${s.slice(0, -digits)}.${s.slice(-digits)}`);
}

function readTable(file) {
  const text = readFileSync(file, 'utf8');
  const errors = [];
  const rows = new Map();
  let totalW = 0n, totalWP = 0n, hitW = 0n, maxP = 0n, zeroWeightRows = 0, lineNo = 0;
  for (const raw of text.split(/\r?\n/)) {
    lineNo++;
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',');
    if (lineNo === 1 && !/^\d+$/.test(parts[0])) continue; // optional header
    if (parts.length !== 3 || !parts.every(p => /^\d+$/.test(p.trim()))) {
      if (errors.length < 10) errors.push(`line ${lineNo}: expected "id,weight,payoutMultiplier" non-negative integers, got "${line.slice(0, 60)}"`);
      continue;
    }
    const [id, w, p] = parts.map(p => BigInt(p.trim()));
    if (rows.has(id)) { if (errors.length < 10) errors.push(`line ${lineNo}: duplicate id ${id}`); continue; }
    rows.set(id, p);
    if (w === 0n) zeroWeightRows++;
    totalW += w; totalWP += w * p;
    if (p > 0n) hitW += w;
    if (w > 0n && p > maxP) maxP = p;
  }
  if (rows.size === 0) errors.push('table has no rows');
  if (totalW === 0n) errors.push('total weight is 0');
  return { rows, totalW, totalWP, hitW, maxP, zeroWeightRows, errors };
}

async function checkBooks(file, rows) {
  // Returns { status: 'ok'|'mismatch'|'skipped', detail }
  let stream = createReadStream(file);
  if (file.endsWith('.zst')) {
    if (typeof zlib.createZstdDecompress !== 'function') {
      return { status: 'skipped', detail: 'books are .zst and this Node has no zstd; decompress to .jsonl or use Node >= 22.15 to cross-check' };
    }
    stream = stream.pipe(zlib.createZstdDecompress());
  }
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0, mismatches = 0, missing = 0;
  const examples = [];
  const seen = new Set();
  for await (const line of rl) {
    if (!line.trim()) continue;
    n++;
    let book;
    try { book = JSON.parse(line); } catch { mismatches++; if (examples.length < 5) examples.push(`line ${n}: invalid JSON`); continue; }
    const id = BigInt(book.id);
    seen.add(id);
    const p = rows.get(id);
    if (p === undefined) { missing++; if (examples.length < 5) examples.push(`book id ${id} not in lookup table`); continue; }
    if (BigInt(book.payoutMultiplier) !== p) { mismatches++; if (examples.length < 5) examples.push(`book id ${id}: book ${book.payoutMultiplier} vs table ${p}`); }
  }
  const notInBooks = [...rows.keys()].filter(id => !seen.has(id)).length;
  const ok = mismatches === 0 && missing === 0 && notInBooks === 0;
  return { status: ok ? 'ok' : 'mismatch', detail: `${n} books, ${mismatches} payout mismatches, ${missing} unknown ids, ${notInBooks} table rows without a book`, examples };
}

const sha = createHash('sha256');
const report = {
  tool: 'verify-rtp.mjs', gameId: opts.id, mathDir: basename(mathDir),
  limits: { rtpMin: opts.min, rtpMax: opts.max, maxWinX: opts.maxWinX },
  checkedAt: new Date().toISOString(), modes: [], pass: true,
};

for (const mode of index.modes) {
  const r = { name: mode.name, cost: mode.cost, problems: [] };
  report.modes.push(r);
  const fail = (m) => { r.problems.push(m); report.pass = false; };
  if (typeof mode.name !== 'string' || !mode.name) { fail('mode has no name'); continue; }
  if (!(typeof mode.cost === 'number' && mode.cost > 0)) { fail(`invalid cost ${mode.cost}`); continue; }
  const tablePath = mode.weights ? join(mathDir, mode.weights) : null;
  if (!tablePath || !existsSync(tablePath)) { fail(`lookup table not found: ${mode.weights}`); continue; }
  sha.update(`${mode.name}:${mode.cost}:`); sha.update(readFileSync(tablePath));
  const t = readTable(tablePath);
  t.errors.forEach(fail);
  if (t.totalW === 0n) continue;
  // cost as exact rational: cost * 10000 (costs like 1.25 are exact at 4 decimals)
  const costScaled = BigInt(Math.round(mode.cost * 10000));
  if (Math.abs(Number(costScaled) / 10000 - mode.cost) > 1e-12) fail(`cost ${mode.cost} has more than 4 decimals`);
  r.rows = t.rows.size;
  r.rtp = ratio(t.totalWP * 10000n * 100n, t.totalW * 100n * costScaled, 4); // percent, 4 decimals
  r.hitRate = ratio(t.hitW * 100n, t.totalW, 4);                         // percent of rounds paying > 0
  r.maxWinX = ratio(t.maxP, 100n, 2);
  if (t.zeroWeightRows) r.zeroWeightRows = t.zeroWeightRows;
  if (r.rtp < opts.min || r.rtp > opts.max) fail(`RTP ${r.rtp}% outside ${opts.min}-${opts.max}%`);
  if (r.maxWinX > opts.maxWinX) fail(`max win ${r.maxWinX}x above cap ${opts.maxWinX}x`);
  if (!opts.skipBooks && mode.events) {
    const candidates = [mode.events, mode.events.replace(/\.zst$/, '')].map(f => join(mathDir, f));
    const booksFile = candidates.find(existsSync);
    if (!booksFile) r.books = { status: 'skipped', detail: `books file ${mode.events} not present` };
    else {
      r.books = await checkBooks(booksFile, t.rows);
      if (r.books.status === 'mismatch') fail(`books do not match lookup table (${r.books.detail})`);
    }
  }
}
report.mathSha256 = sha.digest('hex');

// ---- output ----
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nTaxiro RTP gate — ${report.gameId ?? report.mathDir}`);
console.log(`limits: RTP ${opts.min}-${opts.max}% in every mode, max win <= ${opts.maxWinX}x base bet\n`);
console.log(`${pad('mode', 14)}${pad('cost', 8)}${pad('rows', 10)}${pad('RTP %', 11)}${pad('hit %', 10)}${pad('max win', 11)}result`);
for (const m of report.modes) {
  console.log(`${pad(m.name, 14)}${pad(m.cost, 8)}${pad(m.rows ?? '-', 10)}${pad(m.rtp ?? '-', 11)}${pad(m.hitRate ?? '-', 10)}${pad(m.maxWinX != null ? m.maxWinX + 'x' : '-', 11)}${m.problems.length ? 'FAIL' : 'ok'}`);
  for (const p of m.problems) console.log(`    - ${p}`);
  if (m.books) console.log(`    books: ${m.books.status} — ${m.books.detail}`);
}
console.log(`\nmath fingerprint (sha256 of all lookup tables): ${report.mathSha256}`);

if (report.pass) {
  const snippet = {
    rtp: Object.fromEntries(report.modes.map(m => [m.name, m.rtp])),
    maxWinX: Math.max(...report.modes.map(m => m.maxWinX)),
    verified: true,
    verifiedAt: report.checkedAt,
    mathSha256: report.mathSha256,
  };
  report.gamesJsonFields = snippet;
  console.log('\nPASS. Paste these fields into the game entry in games.json:\n');
  console.log(JSON.stringify(snippet, null, 2));
} else {
  console.log('\nFAIL. Do not add this game to games.json (or keep "verified": false) until the math passes.');
}
if (opts.json) { writeFileSync(opts.json, JSON.stringify(report, null, 2)); console.log(`\nreport written to ${opts.json}`); }
process.exit(report.pass ? 0 : 1);
