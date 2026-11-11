/* Quillstrike Trader DNA: a shareable card describing a trader's style. Percentages and patterns only, never dollar amounts. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, P, D, cv, opts;
  function stats() {
    var s = [];
    var fav = P.strats[0], top = P.syms[0];
    s.push({ id: 'style', label: 'Style', val: P.creditShare >= 50 ? Math.round(P.creditShare) + '% credit' : P.debitShare >= 50 ? Math.round(P.debitShare) + '% debit' : Math.round(P.flyShare) + '% flies', on: true });
    if (fav) s.push({ id: 'fav', label: 'Go-to strategy', val: Q.names(fav[0]), on: true });
    if (top) s.push({ id: 'top', label: 'Most traded', val: top[0], on: true });
    if (P.medHold != null) s.push({ id: 'hold', label: 'Typical hold', val: Q.holdText(P.medHold), on: true });
    if (P.zeroDte != null) s.push({ id: 'zero', label: 'Same-day expiry', val: Math.round(P.zeroDte) + '% 0DTE', on: true });
    if (D.hasRules && D.allFollow != null) s.push({ id: 'rules', label: 'Rules followed', val: Math.round(D.allFollow) + '%', on: true });
    if (P.winRate != null) s.push({ id: 'win', label: 'Win rate', val: Math.round(P.winRate) + '%', on: false });
    s.push({ id: 'pace', label: 'Pace', val: P.perDay.toFixed(1) + ' trades / day', on: false });
    if (P.sharp) s.push({ id: 'sharp', label: 'Sharpest hour', val: Q.hourLabel(P.sharp.hour), on: false });
    if (D.best) s.push({ id: 'streak', label: 'Best rule streak', val: Q.plural(D.best, 'day'), on: false });
    return s;
  }
  function wrapText(ctx, text, x, y, maxW, lh) { var words = text.split(' '), line = '', lines = 0; words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y + lines * lh); lines++; line = w; } else line = t; }); ctx.fillText(line, x, y + lines * lh); return lines + 1; }
  function draw() {
    var W = 1200, H = 630, c = cv.getContext('2d');
    Q.drawBg(c, W, H);
    // frame
    Q.roundRect(c, 24, 24, W - 48, H - 48, 28); c.strokeStyle = 'rgba(56,189,248,.35)'; c.lineWidth = 2; c.stroke();
    Q.drawLogo(c, 60, 56, 52);
    c.fillStyle = '#fff'; c.font = '700 30px "Barlow Semi Condensed", Barlow, sans-serif'; c.textBaseline = 'middle'; c.fillText('Quill', 124, 83); var qw = c.measureText('Quill').width; c.fillStyle = '#D8B25A'; c.fillText('strike', 124 + qw, 83);
    c.textAlign = 'right'; c.fillStyle = '#9AACC1'; c.font = '600 20px Barlow, sans-serif'; c.fillText('TRADER DNA', W - 64, 70);
    if (opts.handle) { c.fillStyle = '#E0F2FE'; c.font = '600 22px Barlow, sans-serif'; c.fillText('@' + (d.profile.handle || 'trader'), W - 64, 100); }
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    // archetype
    c.save(); c.shadowColor = 'rgba(240,199,102,.55)'; c.shadowBlur = 28;
    var g = c.createLinearGradient(0, 150, 0, 230); g.addColorStop(0, '#FCE7A8'); g.addColorStop(1, '#D8B25A'); c.fillStyle = g;
    c.font = '700 76px "Barlow Semi Condensed", Barlow, sans-serif'; c.fillText(P.arche, 64, 214); c.restore();
    c.fillStyle = '#C7D3E1'; c.font = '400 26px Barlow, sans-serif'; wrapText(c, P.blurb, 66, 258, W - 140, 34);
    // traits
    var tx = 66, ty = 300; c.font = '600 19px Barlow, sans-serif';
    P.traits.slice(0, 4).forEach(function (t) { var w = c.measureText(t).width + 30; Q.roundRect(c, tx, ty, w, 34, 17); c.fillStyle = 'rgba(56,189,248,.12)'; c.fill(); c.strokeStyle = 'rgba(56,189,248,.5)'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#BAE6FD'; c.fillText(t, tx + 15, ty + 23); tx += w + 10; });
    // tiles
    var S = opts.stats.filter(function (s) { return s.on; }).slice(0, 6), cols = S.length > 4 ? 3 : Math.max(1, S.length), rows = Math.ceil(S.length / cols);
    var gx = 64, gy = 362, gw = W - 128, gap = 14, tw = (gw - gap * (cols - 1)) / cols, th = rows > 1 ? 92 : 120;
    S.forEach(function (s, i) {
      var x = gx + (i % cols) * (tw + gap), y = gy + Math.floor(i / cols) * (th + gap);
      Q.roundRect(c, x, y, tw, th, 14); c.fillStyle = 'rgba(12,19,31,.85)'; c.fill(); c.strokeStyle = '#21304A'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#9AACC1'; c.font = '600 16px Barlow, sans-serif'; c.fillText(s.label.toUpperCase(), x + 18, y + 32);
      c.fillStyle = '#fff'; var fs = 34; c.font = '700 ' + fs + 'px "Barlow Semi Condensed", Barlow, sans-serif'; while (c.measureText(s.val).width > tw - 36 && fs > 18) { fs -= 2; c.font = '700 ' + fs + 'px "Barlow Semi Condensed", Barlow, sans-serif'; }
      c.fillText(s.val, x + 18, y + (rows > 1 ? 72 : 82));
    });
    c.fillStyle = '#7DD3FC'; c.font = '600 20px Barlow, sans-serif'; c.textAlign = 'right'; c.fillText('quillstrike.com', W - 64, H - 46); c.textAlign = 'left';
    c.fillStyle = '#6B7F99'; c.font = '400 16px Barlow, sans-serif'; c.fillText('Based on ' + Q.plural(P.n, 'trade') + ' in my Quillstrike journal', 66, H - 46);
  }
  function render() {
    el.innerHTML = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d) +
      '<div class="qx-grid" style="grid-template-columns:minmax(0,2fr) minmax(260px,1fr);align-items:start" id="dna-grid"><div class="qx-card"><canvas id="dna-cv" width="1200" height="630" style="width:100%;height:auto;display:block;border-radius:10px"></canvas>' +
      '<div class="qx-row" style="margin-top:14px"><button class="qx-btn" id="dna-dl">Download image</button><button class="qx-btn2" id="dna-cp">Copy image</button><a class="qx-btn2" id="dna-x" target="_blank" rel="noopener">Post on X</a><span id="dna-msg" class="qx-small qx-muted"></span></div></div>' +
      '<div class="qx-card"><h2>' + E(P.arche) + '</h2><p class="qx-muted">' + E(P.blurb) + '</p><h3 style="margin:14px 0 8px">Show on the card</h3><div id="dna-opts" style="display:flex;flex-direction:column;gap:6px">' +
      opts.stats.map(function (s, i) { return '<label style="display:flex;align-items:center;gap:8px;min-height:30px;cursor:pointer"><input type="checkbox" data-i="' + i + '"' + (s.on ? ' checked' : '') + ' style="width:18px;min-height:18px;height:18px;accent-color:#38BDF8"><span>' + E(s.label) + ': <b style="color:#fff">' + E(s.val) + '</b></span></label>'; }).join('') +
      '<label style="display:flex;align-items:center;gap:8px;min-height:30px;cursor:pointer;margin-top:6px;border-top:1px solid #1B283B;padding-top:10px"><input type="checkbox" id="dna-h"' + (opts.handle ? ' checked' : '') + ' style="width:18px;min-height:18px;height:18px;accent-color:#38BDF8"><span>Show my handle (@' + E(d.profile.handle || 'trader') + ')</span></label></div>' +
      '<p class="qx-small qx-muted" style="margin-top:12px">Up to 6 stats fit on the card. The card never shows dollar amounts, so you can share it without showing your account size.</p></div></div></div>' +
      '<style>@media (max-width:900px){#dna-grid{grid-template-columns:1fr !important}}</style>';
    cv = document.getElementById('dna-cv');
    Q.fontsReady().then(draw); draw();
    el.querySelectorAll('#dna-opts input[data-i]').forEach(function (b) { b.onchange = function () { var on = opts.stats.filter(function (s) { return s.on; }).length; var s = opts.stats[+b.getAttribute('data-i')]; if (b.checked && on >= 6) { b.checked = false; msg('Up to 6 stats fit. Untick one first.'); return; } s.on = b.checked; draw(); }; });
    document.getElementById('dna-h').onchange = function (e) { opts.handle = e.target.checked; draw(); };
    document.getElementById('dna-dl').onclick = function () { Q.download(cv, 'quillstrike-trader-dna.png'); };
    document.getElementById('dna-cp').onclick = function () { Q.copyImage(cv).then(function () { msg('Copied. Paste it into your post.'); }, function () { msg('Your browser can’t copy images. Use Download instead.'); }); };
    var txt = 'My trader DNA: ' + P.arche + ' 🧬 What’s yours?';
    document.getElementById('dna-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent('https://quillstrike.com');
    document.getElementById('dna-x').onclick = function () { msg('Attach the downloaded image to your post.'); };
  }
  function msg(t) { var m = document.getElementById('dna-msg'); if (m) m.textContent = t; }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1];
    D = Q.discipline(d.rules, d.lite); P = Q.profileOf(d.lite, D);
    if (!P || P.n < 5) { el.innerHTML = '<div class="qx"><div class="qx-card qx-empty"><h2>Import a few more trades</h2><p>Your Trader DNA needs at least 5 trades to read your style.</p><a class="qx-btn" href="import.html">Import trades</a></div></div>'; return; }
    opts = { handle: true, stats: stats() };
    render();
  });
})();
