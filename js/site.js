// Shared UI: header state, reveal-on-scroll, year, contact email, helpers.
(function () {
  document.documentElement.classList.remove('no-js');
  const header = document.querySelector('.site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  window.MC_reveal = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  window.MC_reveal();

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const cfg = window.MC_CONFIG || {};
  const valid = typeof cfg.contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.contactEmail);
  document.querySelectorAll('[data-contact-email]').forEach(el => {
    el.textContent = valid ? cfg.contactEmail : 'Partner email coming soon';
    el.classList.toggle('pending', !valid);
  });
  document.querySelectorAll('[data-contact-link]').forEach(a => {
    if (valid) { a.href = 'mailto:' + cfg.contactEmail + '?subject=' + encodeURIComponent('Taxiro partnership'); a.removeAttribute('aria-disabled'); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  });

  window.MC_esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.MC_loadGames = async () => {
    const res = await fetch('games.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('games.json ' + res.status);
    const data = await res.json();
    return Array.isArray(data.games) ? data.games : [];
  };
  // A game is playable only when it is live, verified, every mode is inside the RTP policy and the embed URL is HTTPS.
  window.MC_isPlayable = (g) => {
    const p = (window.MC_CONFIG || {}).rtpPolicy || { min: 85.0, max: 99.0 };
    const rtps = Object.values(g.rtp || {});
    let url = null; try { url = new URL(g.embedUrl); } catch { /* invalid */ }
    const originOk = url && url.protocol === 'https:' && ((cfg.allowedEmbedOrigins || []).length === 0 || cfg.allowedEmbedOrigins.includes(url.origin));
    return g.status === 'live' && g.verified === true && rtps.length > 0 && rtps.every(r => typeof r === 'number' && r >= p.min && r <= p.max) && !!originOk;
  };
  window.MC_rtpRange = (g) => {
    const v = Object.values(g.rtp || {}).filter(n => typeof n === 'number');
    if (!v.length) return null;
    const lo = Math.min(...v), hi = Math.max(...v);
    return lo === hi ? lo.toFixed(2) + '%' : lo.toFixed(2) + '–' + hi.toFixed(2) + '%';
  };
  window.MC_icons = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
  };
})();
