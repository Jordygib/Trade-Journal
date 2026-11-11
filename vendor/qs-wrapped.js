/* Quillstrike Wrapped: a year-in-review story built from the trader's own journal.
   Slides are drawn on a canvas so each one can be downloaded or copied as an image (1080×1350). */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, year, slides = [], idx = 0, money = false, cv;
  var W = 1080, H = 1350;
  function yearsOf() { var m = {}; d.lite.forEach(function (t) { m[t.o.getFullYear()] = 1; }); return Object.keys(m).map(Number).sort(function (a, b) { return b - a; }); }
  function compute(y) {
    var L = d.lite.filter(function (t) { return t.o.getFullYear() === y; });
    if (!L.length) return null;
    var D = Q.discipline(d.rules, L), P = Q.profileOf(L, D), C = L.filter(function (t) { return t.c; });
    var months = []; for (var m = 0; m < 12; m++) months.push({ m: m, n: 0, w: 0, c: 0, net: 0 });
    L.forEach(function (t) { months[t.o.getMonth()].n++; }); C.forEach(function (t) { var x = months[t.o.getMonth()]; x.c++; x.net += t.pnl; if (t.pnl > 0) x.w++; });
    var best = months.filter(function (x) { return x.c >= 3; }).sort(function (a, b) { return b.net - a.net; })[0] || null;
    var hours = {}; C.filter(function (t) { return t.tk; }).forEach(function (t) { var h = t.o.getHours(); hours[h] = hours[h] || { n: 0, w: 0 }; hours[h].n++; if (t.pnl > 0) hours[h].w++; });
    var favK = P.strats[0] ? P.strats[0][0] : null, favT = C.filter(function (t) { return t.k === favK; });
    return { y: y, L: L, C: C, D: D, P: P, months: months, best: best, hours: hours, net: C.reduce(function (s, t) { return s + t.pnl; }, 0), favWin: favT.length ? favT.filter(function (t) { return t.pnl > 0; }).length / favT.length * 100 : null };
  }
  function glowText(c, text, x, y, size, color, align) { c.save(); c.textAlign = align || 'left'; c.font = '700 ' + size + 'px "Barlow Semi Condensed", Barlow, sans-serif'; while (c.measureText(text).width > W - 160 && size > 40) { size -= 4; c.font = '700 ' + size + 'px "Barlow Semi Condensed", Barlow, sans-serif'; } c.shadowColor = color === 'gold' ? 'rgba(240,199,102,.6)' : 'rgba(56,189,248,.6)'; c.shadowBlur = 40; if (color === 'gold') { var g = c.createLinearGradient(0, y - size, 0, y); g.addColorStop(0, '#FCE7A8'); g.addColorStop(1, '#D8B25A'); c.fillStyle = g; } else c.fillStyle = color || '#fff'; c.fillText(text, x, y); c.restore(); }
  function txt(c, text, x, y, size, color, weight, align) { c.textAlign = align || 'left'; c.fillStyle = color || '#C7D3E1'; c.font = (weight || 400) + ' ' + size + 'px Barlow, sans-serif'; c.fillText(text, x, y); c.textAlign = 'left'; }
  function wrap(c, text, x, y, maxW, lh, size, color) { c.fillStyle = color || '#C7D3E1'; c.font = '400 ' + size + 'px Barlow, sans-serif'; var words = String(text).split(' '), line = '', n = 0; words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y + n * lh); n++; line = w; } else line = t; }); c.fillText(line, x, y + n * lh); return n + 1; }
  function frame(c, i, n, R) {
    Q.drawBg(c, W, H);
    Q.roundRect(c, 30, 30, W - 60, H - 60, 34); c.strokeStyle = 'rgba(56,189,248,.3)'; c.lineWidth = 2; c.stroke();
    for (var k = 0; k < n; k++) { Q.roundRect(c, 80 + k * ((W - 160) / n), 70, (W - 160) / n - 8, 6, 3); c.fillStyle = k <= i ? '#7DD3FC' : 'rgba(125,211,252,.18)'; c.fill(); }
    txt(c, R.y + ' WRAPPED', 80, 130, 26, '#9AACC1', 700);
    txt(c, '@' + (d.profile.handle || 'trader'), W - 80, 130, 26, '#E0F2FE', 600, 'right');
    Q.drawLogo(c, 80, H - 140, 56); c.fillStyle = '#fff'; c.font = '700 32px "Barlow Semi Condensed", Barlow, sans-serif'; c.fillText('Quill', 148, H - 100); var qw = c.measureText('Quill').width; c.fillStyle = '#D8B25A'; c.fillText('strike', 148 + qw, H - 100);
    txt(c, 'quillstrike.com', W - 80, H - 100, 26, '#7DD3FC', 600, 'right');
  }
  function bars(c, vals, labels, x, y, w, h, hiIdx) {
    var mx = Math.max.apply(null, vals.concat([1])), bw = w / vals.length;
    vals.forEach(function (v, i) { var bh = v / mx * h; Q.roundRect(c, x + i * bw + 5, y + h - bh, bw - 10, Math.max(bh, 3), 6); c.fillStyle = i === hiIdx ? '#F0C766' : 'rgba(125,211,252,.55)'; if (i === hiIdx) { c.save(); c.shadowColor = 'rgba(240,199,102,.6)'; c.shadowBlur = 20; c.fill(); c.restore(); } else c.fill(); txt(c, labels[i], x + i * bw + bw / 2, y + h + 34, 20, '#8396AD', 600, 'center'); });
  }
  function build(R) {
    var S = [], P = R.P, D = R.D;
    S.push(function (c) {
      glowText(c, 'Your ' + R.y, 80, 420, 120, '#fff'); glowText(c, 'on Quillstrike', 80, 540, 120, 'gold');
      txt(c, 'A year of trades, patterns and rules,', 82, 640, 34, '#C7D3E1'); txt(c, 'straight from your own journal.', 82, 690, 34, '#C7D3E1');
      var y0 = 820; [[R.L.length.toLocaleString('en-US'), 'trades logged'], [String(P.activeDays), 'trading days']].concat(money ? [[Q.money(R.net, true), 'net P/L']] : []).forEach(function (k, i) { glowText(c, k[0], 82, y0 + i * 110, 76, i === 2 ? (R.net < 0 ? '#FF7A8A' : '#57E3B5') : '#fff'); txt(c, k[1], 82 + 20 + (function () { c.font = '700 76px "Barlow Semi Condensed", Barlow, sans-serif'; return c.measureText(k[0]).width; })(), y0 + i * 110 - 6, 30, '#9AACC1', 600); });
    });
    var top = P.syms.slice(0, 4);
    if (top.length) S.push(function (c) {
      txt(c, 'Your most-traded ticker', 82, 330, 38, '#9AACC1', 600);
      glowText(c, top[0][0], 80, 560, 220, 'gold');
      txt(c, top[0][1] + ' trades · ' + Math.round(top[0][1] / R.L.length * 100) + '% of your year', 84, 650, 38, '#fff', 600);
      top.slice(1).forEach(function (s, i) { Q.roundRect(c, 82, 760 + i * 96, W - 164, 76, 16); c.fillStyle = 'rgba(12,19,31,.85)'; c.fill(); c.strokeStyle = '#21304A'; c.lineWidth = 1.5; c.stroke(); txt(c, '#' + (i + 2) + '  ' + s[0], 112, 808 + i * 96, 34, '#fff', 700); txt(c, s[1] + ' trades', W - 112, 808 + i * 96, 30, '#9AACC1', 600, 'right'); });
    });
    if (P.strats.length) S.push(function (c) {
      var k = P.strats[0];
      txt(c, 'Your go-to strategy', 82, 330, 38, '#9AACC1', 600);
      glowText(c, Q.names(k[0]), 80, 500, 110, '#fff');
      txt(c, Math.round(k[1] / R.L.length * 100) + '% of your trades', 84, 580, 38, '#F0C766', 700);
      if (R.favWin != null) txt(c, 'Win rate on it: ' + Math.round(R.favWin) + '%', 84, 640, 34, '#C7D3E1', 600);
      var side = [['Credit', P.creditShare], ['Debit', P.debitShare], ['Flies & condors', P.flyShare]];
      side.forEach(function (s, i) { var y = 790 + i * 100; txt(c, s[0], 84, y, 30, '#C7D3E1', 600); txt(c, Math.round(s[1]) + '%', W - 84, y, 30, '#fff', 700, 'right'); Q.roundRect(c, 84, y + 18, W - 168, 16, 8); c.fillStyle = 'rgba(125,211,252,.12)'; c.fill(); Q.roundRect(c, 84, y + 18, Math.max(16, (W - 168) * s[1] / 100), 16, 8); c.fillStyle = '#7DD3FC'; c.fill(); });
    });
    if (R.best) S.push(function (c) {
      var b = R.best;
      txt(c, 'Your best month', 82, 330, 38, '#9AACC1', 600);
      glowText(c, Q.MF[b.m], 80, 520, 170, 'gold');
      txt(c, (b.c ? Math.round(b.w / b.c * 100) + '% win rate · ' : '') + b.n + ' trades' + (money ? ' · ' + Q.money(b.net, true) : ''), 84, 600, 38, '#fff', 600);
      txt(c, 'Trades by month', 84, 730, 28, '#9AACC1', 600);
      bars(c, R.months.map(function (x) { return x.n; }), Q.MS.map(function (m) { return m.charAt(0); }), 84, 760, W - 168, 300, b.m);
    });
    var hs = Object.keys(R.hours).map(Number).filter(function (h) { return R.hours[h].n >= 5; }).sort(function (a, b) { return a - b; });
    if (P.sharp && hs.length >= 2) S.push(function (c) {
      txt(c, 'You’re sharpest at', 82, 330, 38, '#9AACC1', 600);
      glowText(c, Q.hourLabel(P.sharp.hour), 80, 540, 200, '#fff');
      txt(c, Math.round(P.sharp.rate * 100) + '% win rate across ' + P.sharp.n + ' trades opened then', 84, 620, 36, '#F0C766', 700);
      txt(c, 'Win rate by the hour you opened', 84, 740, 28, '#9AACC1', 600);
      bars(c, hs.map(function (h) { return R.hours[h].w / R.hours[h].n * 100; }), hs.map(function (h) { return String(h % 12 || 12); }), 84, 770, W - 168, 290, hs.indexOf(P.sharp.hour));
    });
    if (D.hasRules) S.push(function (c) {
      txt(c, 'Discipline', 82, 330, 38, '#9AACC1', 600);
      glowText(c, '🔥 ' + D.best + (D.best === 1 ? ' day' : ' days'), 80, 520, 150, 'gold');
      txt(c, 'Your longest streak of following every rule', 84, 600, 36, '#fff', 600);
      if (D.allFollow != null) { glowText(c, Math.round(D.allFollow) + '%', 80, 780, 110, '#57E3B5'); txt(c, 'of checked trades followed your rules', 84, 840, 34, '#C7D3E1', 600); }
      var q = D.quarters.filter(function (x) { return x.q.indexOf(String(R.y)) === 0; });
      if (q.length > 1) bars(c, q.map(function (x) { return x.pct; }), q.map(function (x) { return x.q.slice(5); }), 84, 900, Math.min(W - 168, q.length * 180), 180, -1);
    });
    S.push(function (c) {
      txt(c, 'Your trading type', 82, 330, 38, '#9AACC1', 600);
      var parts = P.arche.replace('The ', '').split(' ');
      glowText(c, 'The', 80, 470, 90, '#fff'); glowText(c, parts.join(' '), 80, 600, 130, 'gold');
      wrap(c, P.blurb, 84, 700, W - 168, 50, 38, '#C7D3E1');
      var tx = 84, ty = 860; c.font = '600 30px Barlow, sans-serif';
      P.traits.forEach(function (t) { var w = c.measureText(t).width + 44; if (tx + w > W - 84) { tx = 84; ty += 76; } Q.roundRect(c, tx, ty, w, 58, 29); c.fillStyle = 'rgba(56,189,248,.12)'; c.fill(); c.strokeStyle = 'rgba(56,189,248,.55)'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#BAE6FD'; c.fillText(t, tx + 22, ty + 39); tx += w + 14; });
    });
    S.push(function (c) {
      glowText(c, 'On to', 80, 470, 130, '#fff'); glowText(c, String(R.y + 1), 80, 620, 200, 'gold');
      wrap(c, 'New season, same rules. The Quillstrike championship starts January 1, with monthly challenges and badges for trading your plan.', 84, 740, W - 168, 50, 36, '#C7D3E1');
      txt(c, 'Make your own Wrapped at quillstrike.com', 84, 1010, 32, '#7DD3FC', 700);
    });
    return S;
  }
  function draw(i, canvas) { var c = (canvas || cv).getContext('2d'); c.textBaseline = 'alphabetic'; frame(c, i, slides.length, R0); slides[i](c); }
  var R0 = null;
  function show() {
    draw(idx);
    document.getElementById('wr-n').textContent = (idx + 1) + ' / ' + slides.length;
    document.getElementById('wr-prev').disabled = idx === 0; document.getElementById('wr-next').disabled = idx === slides.length - 1;
  }
  function setYear(y) {
    year = y; R0 = compute(y); var box = document.getElementById('wr-stage');
    if (!R0 || R0.L.length < 10) { box.innerHTML = '<div class="qx-empty"><h2>Not enough trades in ' + y + '</h2><p>Wrapped needs at least 10 trades in the year.</p></div>'; return; }
    slides = build(R0); idx = 0;
    box.innerHTML = '<canvas id="wr-cv" width="' + W + '" height="' + H + '" style="width:100%;max-width:460px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 30px 80px -30px rgba(56,140,255,.6);cursor:pointer"></canvas>';
    cv = document.getElementById('wr-cv');
    cv.onclick = function (e) { var r = cv.getBoundingClientRect(); if (e.clientX - r.left < r.width / 3) { if (idx > 0) { idx--; show(); } } else if (idx < slides.length - 1) { idx++; show(); } };
    Q.fontsReady().then(show); show();
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1];
    var ys = yearsOf();
    if (!ys.length) { el.innerHTML = '<div class="qx"><div class="qx-card qx-empty"><h2>No trades yet</h2><p>Import your trades to build your Wrapped.</p><a class="qx-btn" href="import.html">Import trades</a></div></div>'; return; }
    var now = new Date(), inProgress = function (y) { return y === now.getFullYear() && now.getMonth() < 11; };
    el.innerHTML = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d) +
      '<div class="qx-grid" style="grid-template-columns:minmax(0,1fr) minmax(260px,340px);align-items:start" id="wr-grid"><div class="qx-card"><div id="wr-stage"></div><div class="qx-row" style="justify-content:center;margin-top:14px"><button class="qx-btn2" id="wr-prev" aria-label="Previous slide">‹ Back</button><span id="wr-n" class="qx-muted" style="min-width:60px;text-align:center"></span><button class="qx-btn2" id="wr-next" aria-label="Next slide">Next ›</button></div></div>' +
      '<div class="qx-card"><h2>Your Wrapped</h2><label class="qx-f" style="margin-top:10px">Year<select id="wr-y">' + ys.map(function (y) { return '<option value="' + y + '">' + y + (inProgress(y) ? ' (so far)' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer"><input type="checkbox" id="wr-m" style="width:18px;min-height:18px;height:18px;accent-color:#38BDF8"><span>Include dollar amounts</span></label><p class="qx-small qx-muted" style="margin:4px 0 0">Off by default, so you can share without showing your account size.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px"><button class="qx-btn" id="wr-dl">Download this slide</button><button class="qx-btn2" id="wr-all">Download all slides</button><button class="qx-btn2" id="wr-cp">Copy this slide</button><a class="qx-btn2" id="wr-x" target="_blank" rel="noopener">Post on X</a><span id="wr-msg" class="qx-small qx-muted"></span></div>' +
      '<p class="qx-small qx-muted" style="margin-top:14px">Tap the right side of a slide to go forward, the left side to go back.</p></div></div></div>' +
      '<style>@media (max-width:900px){#wr-grid{grid-template-columns:1fr !important}}</style>';
    var msg = function (t) { document.getElementById('wr-msg').textContent = t; };
    document.getElementById('wr-y').onchange = function (e) { setYear(+e.target.value); };
    document.getElementById('wr-m').onchange = function (e) { money = e.target.checked; var keep = idx; setYear(year); idx = Math.min(keep, slides.length - 1); show(); };
    document.getElementById('wr-prev').onclick = function () { if (idx > 0) { idx--; show(); } };
    document.getElementById('wr-next').onclick = function () { if (idx < slides.length - 1) { idx++; show(); } };
    document.getElementById('wr-dl').onclick = function () { Q.download(cv, 'quillstrike-wrapped-' + year + '-' + (idx + 1) + '.png'); };
    document.getElementById('wr-all').onclick = function () { var i = 0, off = document.createElement('canvas'); off.width = W; off.height = H; (function next() { if (i >= slides.length) { msg('Downloaded ' + slides.length + ' slides.'); return; } draw(i, off); Q.download(off, 'quillstrike-wrapped-' + year + '-' + (i + 1) + '.png'); i++; setTimeout(next, 450); })(); };
    document.getElementById('wr-cp').onclick = function () { Q.copyImage(cv).then(function () { msg('Copied. Paste it into your post.'); }, function () { msg('Your browser can’t copy images. Use Download instead.'); }); };
    document.getElementById('wr-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent('My ' + ys[0] + ' trading year, wrapped 📊') + '&url=' + encodeURIComponent('https://quillstrike.com');
    document.getElementById('wr-x').onclick = function () { msg('Attach the downloaded slides to your post.'); };
    var want = ys[0]; if (inProgress(ys[0]) && ys.length > 1 && now.getMonth() < 1) want = ys[1];
    document.getElementById('wr-y').value = want; setYear(want);
  });
})();
