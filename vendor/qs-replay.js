/* Quillstrike Payoff replay: rebuilds a trade's expiration payoff from its opening legs and
   shows where the trade actually finished. Uses only the trade's own fills, no market data. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, byTrade = {}, list = [], cur = null, query = '';
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
  function build(t) {
    var fl = (byTrade[t.id] || []).slice().sort(function (a, b) { return new Date(a.executed_at) - new Date(b.executed_at); });
    var opens = fl.filter(function (f) { return f.action === 'BTO' || f.action === 'STO'; });
    if (!opens.length) return { err: 'This trade has no opening legs in its fills, so its payoff can’t be drawn.' };
    var t0 = opens[0].executed_at, first = opens.filter(function (f) { return f.executed_at === t0; });
    var exps = {}; first.forEach(function (f) { if (f.expiration) exps[String(f.expiration).slice(0, 10)] = 1; });
    var units = Number(t.quantity) || first.reduce(function (g, f) { return gcd(g, Number(f.quantity) || 1); }, 0) || 1;
    var legs = first.map(function (f) { var q = Math.abs(Number(f.quantity) || 1); return { strike: Number(f.strike), type: f.option_type === 'call' ? 'call' : 'put', n: (f.action === 'STO' ? -1 : 1) * q / units, exp: String(f.expiration || '').slice(0, 10) }; }).filter(function (l) { return isFinite(l.strike); });
    var net = Number(t.entry_price); if (!isFinite(net) || net === 0) net = Number(first[0].price) || 0;
    var orders = {}; fl.forEach(function (f) { orders[f.executed_at] = 1; });
    return { legs: legs, units: units, net: net, multiExp: Object.keys(exps).length > 1, exps: Object.keys(exps).sort(), orders: Object.keys(orders).length, closes: fl.filter(function (f) { return f.action === 'BTC' || f.action === 'STC'; }).length };
  }
  function payoff(P, S) { var v = P.net * 100; P.legs.forEach(function (l) { var iv = l.type === 'call' ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S); v += l.n * iv * 100; }); return v * P.units; }
  function analyze(P) {
    var ks = P.legs.map(function (l) { return l.strike; }), mn = Math.min.apply(null, ks), mx = Math.max.apply(null, ks);
    var span = Math.max(mx - mn, mx * 0.015, 1), lo = Math.max(0, mn - span * 0.9), hi = mx + span * 0.9, N = 400, pts = [];
    for (var i = 0; i <= N; i++) { var S = lo + (hi - lo) * i / N; pts.push([S, payoff(P, S)]); }
    var ys = pts.map(function (p) { return p[1]; }).concat([payoff(P, 0)]);
    var callSlope = P.legs.filter(function (l) { return l.type === 'call'; }).reduce(function (s, l) { return s + l.n; }, 0);
    var maxP = Math.max.apply(null, ys), maxL = Math.min.apply(null, ys);
    var be = []; for (var j = 1; j < pts.length; j++) { var a = pts[j - 1], b = pts[j]; if ((a[1] < 0 && b[1] >= 0) || (a[1] >= 0 && b[1] < 0)) { if (b[1] === 0 && j < pts.length - 1) continue; be.push(a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1])); } }
    return { pts: pts, lo: lo, hi: hi, maxP: callSlope > 1e-9 ? Infinity : maxP, maxL: callSlope < -1e-9 ? -Infinity : maxL, be: be, ks: ks };
  }
  function fmtPx(x) { return x >= 1000 ? Math.round(x).toLocaleString('en-US') : x >= 100 ? x.toFixed(1) : x.toFixed(2); }
  function chart(P, A, t) {
    var W = 760, H = 340, pl = 64, pr = 18, pt = 18, pb = 44;
    var ys = A.pts.map(function (p) { return p[1]; }).concat([t.pnl, 0]), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.12 || 50; y0 -= pad; y1 += pad;
    var X = function (s) { return pl + (s - A.lo) / (A.hi - A.lo) * (W - pl - pr); }, Y = function (v) { return pt + (y1 - v) / (y1 - y0) * (H - pt - pb); };
    var line = A.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    var area = line + 'L' + X(A.hi).toFixed(1) + ' ' + Y(0).toFixed(1) + 'L' + X(A.lo).toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z';
    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block;overflow:visible" id="rp-svg" role="img" aria-label="Payoff at expiration">' +
      '<defs><clipPath id="rp-up"><rect x="0" y="0" width="' + W + '" height="' + Y(0).toFixed(1) + '"/></clipPath><clipPath id="rp-dn"><rect x="0" y="' + Y(0).toFixed(1) + '" width="' + W + '" height="' + H + '"/></clipPath>' +
      '<linearGradient id="rp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57E3B5" stop-opacity=".38"/><stop offset="1" stop-color="#57E3B5" stop-opacity=".04"/></linearGradient><linearGradient id="rp-r" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF7A8A" stop-opacity=".38"/><stop offset="1" stop-color="#FF7A8A" stop-opacity=".04"/></linearGradient></defs>';
    for (var k = 0; k <= 4; k++) { var v = y0 + (y1 - y0) * k / 4; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#16223A"/><text x="' + (pl - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" fill="#8396AD" font-size="11" text-anchor="end">' + Q.money(v, true) + '</text>'; }
    g += '<path d="' + area + '" fill="url(#rp-g)" clip-path="url(#rp-up)"/><path d="' + area + '" fill="url(#rp-r)" clip-path="url(#rp-dn)"/>';
    g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#4A5D7A" stroke-width="1"/>';
    var uniq = A.ks.filter(function (s, i, a) { return a.indexOf(s) === i; }).sort(function (a, b) { return a - b; }), lastX = [-1e9, -1e9];
    uniq.forEach(function (s) {
      var x = X(s), row = x - lastX[0] >= 44 ? 0 : x - lastX[1] >= 44 ? 1 : -1;
      g += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb + (row === 1 ? 14 : 4)) + '" stroke="#2A3B57" stroke-dasharray="3 4"/>';
      if (row >= 0) { lastX[row] = x; g += '<text x="' + x.toFixed(1) + '" y="' + (H - pb + 16 + row * 14) + '" fill="#AFBFD1" font-size="11" text-anchor="middle">' + fmtPx(s) + '</text>'; }
    });
    A.be.forEach(function (b) { g += '<circle cx="' + X(b).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="4" fill="#04060A" stroke="#F0C766" stroke-width="2"/>'; });
    g += '<path d="' + line + '" fill="none" stroke="#7DD3FC" stroke-width="2.4" style="filter:drop-shadow(0 0 6px rgba(56,189,248,.6))"/>';
    if (t.c) { var yy = Y(t.pnl).toFixed(1), col = t.pnl >= 0 ? '#57E3B5' : '#FF7A8A'; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + col + '" stroke-width="1.6" stroke-dasharray="6 5"/><rect x="' + (W - pr - 150) + '" y="' + (yy - 22) + '" width="150" height="18" rx="5" fill="#04060A" stroke="' + col + '" stroke-opacity=".6"/><text x="' + (W - pr - 75) + '" y="' + (yy - 9) + '" fill="' + col + '" font-size="11.5" font-weight="700" text-anchor="middle">You finished ' + Q.money(t.pnl, true) + '</text>'; }
    g += '<line id="rp-x" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#BAE6FD" stroke-opacity=".6" style="display:none"/><circle id="rp-dot" r="5" fill="#BAE6FD" style="display:none"/>';
    g += '<rect x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '" fill="transparent" id="rp-hit"/></svg>';
    return { svg: g, X: X, Y: Y, W: W, pl: pl, pr: pr };
  }
  function legText(P) { return P.legs.map(function (l) { var n = Math.abs(l.n); return (l.n < 0 ? 'Short ' : 'Long ') + (n !== 1 ? n + '× ' : '') + fmtPx(l.strike) + ' ' + (l.type === 'call' ? 'call' : 'put'); }).join(' · '); }
  function renderDetail() {
    var box = document.getElementById('rp-detail'); if (!box) return;
    var t = cur; if (!t) { box.innerHTML = '<div class="qx-empty">Pick a trade to replay it.</div>'; return; }
    var raw = d.raw.filter(function (r) { return r.id === t.id; })[0] || {}, P = build(Object.assign({}, raw, { id: t.id }));
    var head = '<div class="qx-row qx-sp" style="margin-bottom:10px"><div><h2>' + E(t.sym) + ' ' + E(t.name) + '</h2><div class="qx-small qx-muted">' + Q.fdate(t.o, true) + (t.tk ? ' · ' + t.o.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '') + (t.structure ? ' · ' + E(t.structure) : '') + '</div></div><div class="qx-kpi ' + (t.pnl < 0 ? 'qx-loss' : 'qx-gain') + '">' + (t.c ? Q.money(t.pnl, true) : 'Open') + '</div></div>';
    if (P.err) { box.innerHTML = head + '<div class="qx-note">' + E(P.err) + '</div>'; return; }
    if (P.multiExp) { box.innerHTML = head + '<div class="qx-note">This trade has legs in more than one expiration (' + P.exps.map(E).join(', ') + '). An expiration payoff diagram can’t show calendars and diagonals accurately without option prices, so payoff replay covers single-expiration trades.</div><p class="qx-small qx-muted" style="margin-top:10px">Legs: ' + E(legText(P)) + '</p>'; return; }
    var A = analyze(P), C = chart(P, A, t);
    var maxPT = A.maxP === Infinity ? 'Unlimited' : Q.money(A.maxP, true), maxLT = A.maxL === -Infinity ? 'Unlimited' : Q.money(A.maxL, true);
    var capture = '';
    if (t.c && t.pnl > 0 && isFinite(A.maxP) && A.maxP > 0) capture = 'You kept <b class="qx-gain">' + Math.round(t.pnl / A.maxP * 100) + '%</b> of the max profit.';
    else if (t.c && t.pnl < 0 && isFinite(A.maxL) && A.maxL < 0) capture = 'You took <b class="qx-loss">' + Math.round(t.pnl / A.maxL * 100) + '%</b> of the max loss.';
    var rr = isFinite(A.maxP) && isFinite(A.maxL) && A.maxL < 0 && A.maxP > 0 ? (A.maxP / -A.maxL).toFixed(2) : null;
    var hold = t.c && t.tk ? Q.holdText((t.c - t.o) / 60000) : null;
    box.innerHTML = head +
      '<div class="qx-small qx-muted" style="margin-bottom:8px">' + E(legText(P)) + ' · ' + (P.net >= 0 ? 'credit ' : 'debit ') + '$' + Math.abs(P.net).toFixed(2) + ' × ' + P.units + '</div>' +
      '<div style="position:relative">' + C.svg + '<div id="rp-tip" style="position:absolute;top:6px;left:70px;display:none;padding:6px 10px;border-radius:8px;border:1px solid rgba(56,189,248,.5);background:rgba(4,6,10,.95);font-size:12px;pointer-events:none"></div></div>' +
      '<div class="qx-grid qx-g4" style="margin-top:14px">' +
      '<div><div class="qx-label">Max profit</div><div class="qx-kpi qx-gain" style="font-size:22px">' + maxPT + '</div></div>' +
      '<div><div class="qx-label">Max loss</div><div class="qx-kpi qx-loss" style="font-size:22px">' + maxLT + '</div></div>' +
      '<div><div class="qx-label">Breakeven' + (A.be.length > 1 ? 's' : '') + '</div><div class="qx-kpi" style="font-size:22px">' + (A.be.length ? A.be.map(fmtPx).join(' / ') : '—') + '</div></div>' +
      '<div><div class="qx-label">Reward : risk</div><div class="qx-kpi" style="font-size:22px">' + (rr ? rr + ' : 1' : '—') + '</div></div></div>' +
      '<div class="qx-note" style="margin-top:14px">' + (t.c ? (t.expired ? 'Held to expiration. ' : 'Closed before expiration' + (hold ? ' after ' + hold : '') + '. ') : 'Still open. ') + capture + (P.orders > 2 ? ' This trade had ' + P.orders + ' orders, so it may include adjustments; the diagram shows the position as first opened.' : '') + '</div>' +
      '<p class="qx-small qx-muted" style="margin:10px 0 0">The curve shows profit or loss at expiration for each underlying price, using your entry price, before fees. The dashed line is what you actually finished with, after fees.</p>';
    var svg = document.getElementById('rp-svg'), hit = document.getElementById('rp-hit'), tip = document.getElementById('rp-tip'), xl = document.getElementById('rp-x'), dot = document.getElementById('rp-dot');
    var move = function (e) {
      var r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * C.W;
      var S = A.lo + (sx - C.pl) / (C.W - C.pl - C.pr) * (A.hi - A.lo); S = Math.max(A.lo, Math.min(A.hi, S));
      var v = payoff(P, S), px = C.X(S);
      xl.setAttribute('x1', px); xl.setAttribute('x2', px); xl.style.display = ''; dot.setAttribute('cx', px); dot.setAttribute('cy', C.Y(v)); dot.style.display = '';
      tip.style.display = 'block'; tip.innerHTML = 'At <b>' + fmtPx(S) + '</b> on expiration: <b class="' + (v < 0 ? 'qx-loss' : 'qx-gain') + '">' + Q.money(v, true) + '</b>';
      tip.style.left = Math.min(r.width - 220, Math.max(0, (e.clientX - r.left) + 12)) + 'px';
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerleave', function () { tip.style.display = 'none'; xl.style.display = 'none'; dot.style.display = 'none'; });
  }
  function renderList() {
    var box = document.getElementById('rp-list'); if (!box) return;
    var q = query.trim().toUpperCase();
    var items = list.filter(function (t) { return !q || String(t.sym).toUpperCase().indexOf(q) === 0 || String(t.name).toUpperCase().indexOf(q) >= 0; }).slice(0, 150);
    box.innerHTML = items.length ? items.map(function (t) { var on = cur && cur.id === t.id; return '<button data-id="' + E(t.id) + '" style="display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;padding:9px 10px;border:none;border-radius:8px;background:' + (on ? 'rgba(56,189,248,.16)' : 'transparent') + ';color:#EEF3FA;font:500 13px Barlow,system-ui,sans-serif;cursor:pointer;border-left:2px solid ' + (on ? '#38BDF8' : 'transparent') + '"><span><b>' + E(t.sym) + '</b> ' + E(t.name) + '<br><span class="qx-muted qx-small">' + Q.fdate(t.o, true) + '</span></span><span class="' + (t.pnl < 0 ? 'qx-loss' : 'qx-gain') + '" style="font-weight:700">' + (t.c ? Q.money(t.pnl, true) : 'Open') + '</span></button>'; }).join('') : '<p class="qx-muted" style="padding:10px">No matching trades.</p>';
    box.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-id'); cur = list.filter(function (t) { return String(t.id) === id; })[0]; try { history.replaceState(null, '', 'replay.html?id=' + encodeURIComponent(id)); } catch (e) {} renderList(); renderDetail(); if (window.innerWidth < 900) document.getElementById('rp-detail').scrollIntoView({ behavior: 'smooth' }); }; });
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1];
    d.fills.forEach(function (f) { (byTrade[f.trade_id] = byTrade[f.trade_id] || []).push(f); });
    list = d.lite.filter(function (t) { return byTrade[t.id]; }).slice().sort(function (x, y) { return y.o - x.o; });
    var want = null; try { want = new URLSearchParams(location.search).get('id'); } catch (e) {}
    cur = (want && list.filter(function (t) { return String(t.id) === want; })[0]) || list[0] || null;
    el.innerHTML = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d) + '<div class="qx-grid" style="grid-template-columns:minmax(240px,320px) minmax(0,1fr);align-items:start" id="rp-grid"><div class="qx-card" style="padding:12px"><input id="rp-q" placeholder="Search ticker or strategy" aria-label="Search trades"><div id="rp-list" style="margin-top:8px;max-height:640px;overflow:auto"></div></div><div class="qx-card" id="rp-detail"></div></div></div>' +
      '<style>@media (max-width:900px){#rp-grid{grid-template-columns:1fr !important}#rp-list{max-height:280px !important}}</style>';
    document.getElementById('rp-q').oninput = function (e) { query = e.target.value; renderList(); };
    renderList(); renderDetail();
  });
})();
