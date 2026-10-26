// Renders the game gallery from games.json.
(async function () {
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  const esc = window.MC_esc, I = window.MC_icons;
  let games = [];
  try { games = await window.MC_loadGames(); } catch (e) { console.warn(e); }
  if (!games.length) games = [{ id: 'coming-soon', name: 'Coming soon', status: 'coming-soon', tagline: 'Our first original title is in production.' }];

  grid.classList.toggle('single', games.length === 1);
  grid.innerHTML = games.map((g, i) => {
    const playable = window.MC_isPlayable(g);
    const verified = g.verified === true;
    const rtp = verified ? window.MC_rtpRange(g) : null;
    const soon = g.status !== 'live';
    const cover = g.thumbnail
      ? `<div class="game-cover"><img src="${esc(g.thumbnail)}" alt="${esc(g.name)} cover art" loading="lazy"></div>`
      : `<div class="game-cover placeholder"><div class="ph-mark"><div class="reel"><span></span><span></span><span></span></div>${soon ? 'In production' : 'Cover art soon'}</div></div>`;
    const badge = verified
      ? `<span class="badge badge-verified" title="Every mode passed the RTP check">${I.check}Verified</span>`
      : soon ? `<span class="badge badge-soon">Coming soon</span>` : `<span class="badge badge-pending">In verification</span>`;
    const chips = verified ? `<div class="chips">
        ${rtp ? `<span class="chip">RTP <b>${esc(rtp)}</b></span>` : ''}
        ${g.maxWinX ? `<span class="chip">Max win <b>${Number(g.maxWinX).toLocaleString('en-US')}x</b></span>` : ''}
        ${Object.keys(g.rtp || {}).length ? `<span class="chip"><b>${Object.keys(g.rtp).length}</b> modes</span>` : ''}
      </div>` : '';
    const action = playable
      ? `<a class="btn btn-primary" href="play.html?game=${encodeURIComponent(g.id)}">${I.play} Play demo</a>`
      : `<span class="btn" aria-disabled="true">${soon ? 'Demo coming soon' : 'Demo after verification'}</span>`;
    return `<article class="game-card reveal" style="--d:${(i % 3) * 0.08}s">
      ${cover}
      <div class="game-body">
        <div class="game-title"><h3>${esc(g.name)}</h3>${badge}</div>
        ${g.tagline ? `<p>${esc(g.tagline)}</p>` : ''}
        ${chips}
        <div class="game-actions">${action}</div>
      </div>
    </article>`;
  }).join('');
  window.MC_reveal(grid);
})();
