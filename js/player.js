// Game player: embeds a separately hosted, fun-money demo build in an iframe.
(async function () {
  const esc = window.MC_esc, I = window.MC_icons;
  const id = new URLSearchParams(location.search).get('game') || '';
  const $ = (s) => document.querySelector(s);
  let games = [];
  try { games = await window.MC_loadGames(); } catch (e) { console.warn(e); }
  const g = games.find(x => x.id === id);

  const name = g ? g.name : 'Game not found';
  document.title = `${name} — Demo | Taxiro`;
  $('#game-name').textContent = name;
  $('#crumb-name').textContent = name;

  const tags = [];
  tags.push('<span class="badge demo-pill">Demo · Fun money</span>');
  if (g && g.verified === true) tags.push(`<span class="badge badge-verified">${I.check}Verified</span>`);
  $('#game-tags').innerHTML = tags.join('');

  const stage = $('#stage');
  if (g && window.MC_isPlayable(g)) {
    const f = document.createElement('iframe');
    f.src = g.embedUrl;
    f.title = `${g.name} demo`;
    f.allow = 'fullscreen; autoplay';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'no-referrer';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    stage.innerHTML = ''; stage.appendChild(f);
    $('#fs-btn').hidden = false;
    $('#fs-btn').addEventListener('click', () => (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => {})).call(stage));
  } else {
    const reason = !g ? 'We could not find this game. It may have been renamed or is not public yet.'
      : g.status !== 'live' ? 'This title is still in production. Check back soon or contact us for a private preview.'
      : 'This demo will open once every game mode has passed our RTP verification.';
    stage.innerHTML = `<div class="empty-state"><div>
      <div class="ph-mark"><div class="reel"><span></span><span></span><span></span></div></div>
      <h2>Demo not available yet</h2><p>${esc(reason)}</p>
      <a class="btn btn-sm" href="index.html#games">Back to games <span class="arrow">→</span></a></div></div>`;
  }

  // Facts panel — RTP shown only for verified games.
  const facts = $('#facts');
  if (g && g.verified === true && g.rtp && Object.keys(g.rtp).length) {
    const rows = Object.entries(g.rtp).map(([m, r]) => `<div class="kv"><span>${esc(m)}</span><b>${Number(r).toFixed(2)}%</b></div>`).join('');
    facts.innerHTML = `<h3>RTP by mode</h3>${rows}
      ${g.maxWinX ? `<div class="kv"><span>Max win</span><b>${Number(g.maxWinX).toLocaleString('en-US')}x</b></div>` : ''}
      ${g.verifiedAt ? `<div class="kv"><span>Verified</span><b>${esc(new Date(g.verifiedAt).toISOString().slice(0, 10))}</b></div>` : ''}`;
  } else {
    facts.innerHTML = `<h3>Game facts</h3><p>RTP and max win are published here once the game's math has been verified for every mode.</p>`;
  }
})();
