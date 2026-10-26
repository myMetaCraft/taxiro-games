// Visual + behaviour check. Needs Playwright (not a repo dependency):
//   python3 -m http.server 8765 &   (in repo root)
//   NODE_PATH=/path/to/node_modules node tools/screenshots.cjs
// Uses a TEST fixture for games.json via request interception; the repo's games.json is not changed.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '..', 'screens');
const views = {
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const FIXTURE = { schemaVersion: 1, games: [
  { id: 'test-verified', name: 'TEST Verified Game', status: 'live', tagline: 'TEST fixture: verified game.', embedUrl: 'https://embed.test/game/index.html', rtp: { base: 96.3, bonus: 96.3 }, maxWinX: 600, verified: true, verifiedAt: '2026-10-26T02:44:36Z', thumbnail: '' },
  { id: 'test-unverified', name: 'TEST Unverified Game', status: 'live', tagline: 'TEST fixture: RTP must stay hidden.', embedUrl: 'https://embed.test/game/index.html', rtp: { base: 96.3 }, maxWinX: 600, verified: false, verifiedAt: null, thumbnail: '' },
  { id: 'coming-soon', name: 'Coming soon', status: 'coming-soon', tagline: 'Our first original title is in production.', embedUrl: '', rtp: {}, maxWinX: null, verified: false, verifiedAt: null },
]};
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

async function shoot(page, file, full = true) {
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, file), fullPage: full, animations: 'disabled', timeout: 120000 });
}

(async () => {
  const browser = await chromium.launch();
  for (const [vname, opts] of Object.entries(views)) {
    // 1) real games.json
    let ctx = await browser.newContext(opts);
    let page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.game-card');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${vname} index no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);
    check(`${vname} index single coming-soon card`, (await page.locator('.game-card').count()) === 1);
    check(`${vname} index no RTP chips for placeholder`, (await page.locator('.game-card .chip').count()) === 0);
    const logoOk = await page.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
    check(`${vname} images load`, logoOk);
    await shoot(page, `${vname}_index_full.png`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT, `${vname}_index_top.png`), animations: 'disabled', timeout: 120000 });
    await page.goto(BASE + 'play.html?game=coming-soon', { waitUntil: 'networkidle' });
    await page.waitForSelector('.empty-state');
    await shoot(page, `${vname}_play_coming_soon.png`, false);
    check(`${vname} console clean (real data)`, errors.length === 0, errors.join(' | '));
    await ctx.close();

    // 2) TEST fixture
    ctx = await browser.newContext(opts);
    page = await ctx.newPage();
    const errs2 = [];
    page.on('pageerror', e => errs2.push(e.message));
    await page.route('**/games.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(FIXTURE) }));
    await page.route('https://embed.test/**', r => r.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;display:grid;place-items:center;height:100vh;background:linear-gradient(135deg,#1b2a4a,#3a1450);color:#fff;font:700 28px sans-serif">TEST EMBED (fixture iframe)</body></html>' }));
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.game-card');
    const cards = page.locator('.game-card');
    check(`${vname} fixture: 3 cards`, (await cards.count()) === 3);
    check(`${vname} fixture: verified card shows RTP + badge`, (await cards.nth(0).locator('.badge-verified').count()) === 1 && (await cards.nth(0).locator('.chip').first().innerText()).includes('96.30%'));
    check(`${vname} fixture: unverified card hides RTP/badge/play`, (await cards.nth(1).locator('.chip, .badge-verified, a.btn').count()) === 0);
    await page.locator('#games').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
    await page.waitForTimeout(800);
    await page.locator('#games').screenshot({ path: path.join(OUT, `${vname}_gallery_TESTFIXTURE.png`), animations: 'disabled', timeout: 120000 });
    await page.goto(BASE + 'play.html?game=test-verified', { waitUntil: 'networkidle' });
    await page.waitForSelector('#stage iframe');
    const frameText = await page.frameLocator('#stage iframe').locator('body').innerText();
    check(`${vname} fixture: iframe embeds configured URL`, frameText.includes('TEST EMBED'));
    await shoot(page, `${vname}_play_TESTFIXTURE.png`, vname !== 'landscape');
    await page.goto(BASE + 'play.html?game=test-unverified', { waitUntil: 'networkidle' });
    await page.waitForSelector('.empty-state');
    check(`${vname} fixture: unverified game does not embed`, (await page.locator('#stage iframe').count()) === 0);
    check(`${vname} fixture: no page errors`, errs2.length === 0, errs2.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(results.some(r => r.startsWith('FAIL')) ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
