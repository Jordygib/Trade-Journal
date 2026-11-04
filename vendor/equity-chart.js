/* Quillstrike interactive equity curve. Renders into any element with class "qs-eq" and a data-eq attribute. */
(function () {
  var GAIN = '#4FD1B5', LOSS = '#F0607A', BLUE = '#38BDF8', GRID = '#22302B', TXT = '#8A9C95';
  var DAY = 864e5;
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function money(n) { var a = Math.abs(Math.round(n)); return (n < 0 ? '−$' : n > 0 ? '+$' : '$') + a.toLocaleString('en-US'); }
  function fdate(t, withYear) { var d = new Date(t); return MS[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CSS = '.qse{position:relative;font-family:Barlow,system-ui,sans-serif;color:#EEF4F1;user-select:none;-webkit-user-select:none}' +
    '.qse-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}' +
    '.qse-seg{display:flex;gap:2px;padding:3px;border-radius:8px;background:#0F1714;border:1px solid #22302B}' +
    '.qse-seg button,.qse-z button{min-height:30px;min-width:34px;padding:0 9px;border:none;border-radius:6px;background:transparent;color:#B8C6C0;font:600 12px Barlow,system-ui,sans-serif;cursor:pointer}' +
    '.qse-seg button[aria-pressed="true"]{background:rgba(56,189,248,.18);color:#fff}.qse-seg button:hover,.qse-z button:hover{color:#fff}' +
    '.qse-z{display:flex;align-items:center;gap:2px;padding:3px;border-radius:8px;background:#0F1714;border:1px solid #22302B}' +
    '.qse-wrap{position:relative;outline:none;border-radius:6px;touch-action:none;cursor:crosshair}.qse-wrap:focus-visible{box-shadow:0 0 0 2px rgba(56,189,248,.7)}' +
    '.qse svg{display:block;width:100%;overflow:visible}' +
    '.qse-tip{position:absolute;top:8px;pointer-events:none;min-width:170px;padding:10px 12px;border-radius:8px;border:1px solid rgba(56,189,248,.5);background:rgba(10,18,15,.96);box-shadow:0 8px 28px rgba(0,0,0,.45),0 0 20px rgba(56,189,248,.18);font-size:12px;line-height:1.45;z-index:3}' +
    '.qse-tip b{font-size:16px;font-family:"Barlow Semi Condensed",Barlow,sans-serif}.qse-tip .m{color:#A8B8B1}' +
    '.qse-sel{margin-top:10px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;padding:12px 14px;border-radius:10px;border:1px solid rgba(56,189,248,.55);background:linear-gradient(90deg,rgba(56,189,248,.12),rgba(56,189,248,.03));box-shadow:0 0 22px rgba(56,189,248,.15)}' +
    '.qse-sel .k{font-size:11px;color:#A8B8B1}.qse-sel .v{font:700 20px "Barlow Semi Condensed",Barlow,sans-serif}' +
    '.qse-sel button{min-height:32px;padding:0 12px;border-radius:8px;border:1px solid #3A4E47;background:transparent;color:#EEF4F1;font:600 12px Barlow,system-ui,sans-serif;cursor:pointer}.qse-sel button:hover{border-color:#38BDF8}' +
    '.qse-help{margin-top:6px;font-size:11px;color:#74877F}.qse-empty{padding:40px 0;text-align:center;color:#A8B8B1}';
  function injectCss() { if (document.getElementById('qse-css')) return; var s = document.createElement('style'); s.id = 'qse-css'; s.textContent = CSS; document.head.appendChild(s); }

  function Chart(el) {
    this.el = el; this.sel = null; this.hover = null; this.view = null; this.range = el.getAttribute('data-range') || 'all';
    el.innerHTML = '<div class="qse"><div class="qse-bar"><div class="qse-seg" role="group" aria-label="Time range"></div><div class="qse-z" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="reset">Reset</button></div></div>' +
      '<div class="qse-wrap" tabindex="0" role="img" aria-label="Interactive equity curve"><svg></svg><div class="qse-tip" hidden></div></div><div class="qse-selwrap"></div>' +
      '<div class="qse-help">Hover for details · Drag across the chart to measure a stretch · Scroll or pinch to zoom · Shift-drag to pan · Double-click to reset</div></div>';
    this.svg = el.querySelector('svg'); this.wrap = el.querySelector('.qse-wrap'); this.tip = el.querySelector('.qse-tip'); this.selBox = el.querySelector('.qse-selwrap'); this.seg = el.querySelector('.qse-seg');
    var self = this;
    [['1w', '1W'], ['1m', '1M'], ['3m', '3M'], ['ytd', 'YTD'], ['1y', '1Y'], ['all', 'All']].forEach(function (r) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = r[1]; b.setAttribute('data-r', r[0]);
      b.onclick = function () { self.setRange(r[0]); }; self.seg.appendChild(b); });
    el.querySelectorAll('[data-z]').forEach(function (b) { b.onclick = function () { var z = b.getAttribute('data-z'); if (z === 'reset') self.setRange(self.range); else self.zoom(z === 'in' ? 0.6 : 1.6, 0.5); }; });
    this.bind(); this.load();
    if (window.ResizeObserver) new ResizeObserver(function () { self.draw(); }).observe(this.wrap);
  }
  Chart.prototype.load = function () {
    var raw = []; try { raw = JSON.parse(this.el.getAttribute('data-eq') || '[]'); } catch (e) {}
    raw.sort(function (a, b) { return a.t - b.t; });
    var cum = 0, peak = 0, pts = [];
    if (raw.length) pts.push({ t: raw[0].t - Math.max(DAY / 2, (raw.length > 1 ? (raw[raw.length - 1].t - raw[0].t) / 200 : DAY)), v: 0, start: true, dd: 0 });
    raw.forEach(function (r) { cum += r.p; peak = Math.max(peak, cum); pts.push({ t: r.t, v: cum, p: r.p, s: r.s, n: r.n, dd: cum - peak }); });
    this.pts = pts; this.setRange(this.el.getAttribute('data-range') || this.range, true);
  };
  Chart.prototype.bounds = function (r) {
    var p = this.pts; if (!p.length) return [0, 1];
    var t1 = p[p.length - 1].t, t0 = p[0].t, now = Math.max(t1, Date.now()), from;
    if (r === '1w') from = now - 7 * DAY; else if (r === '1m') from = now - 30 * DAY; else if (r === '3m') from = now - 91 * DAY;
    else if (r === 'ytd') from = new Date(new Date(now).getFullYear(), 0, 1).getTime(); else if (r === '1y') from = now - 365 * DAY; else from = t0;
    if (r !== 'all') { var to = now; if (from < t0) from = t0; return [from, Math.max(to, from + DAY)]; }
    return [t0, t1 + (t1 - t0) * 0.02 + DAY / 4];
  };
  Chart.prototype.setRange = function (r, keepSel) {
    this.range = r; this.view = this.bounds(r); if (!keepSel) this.sel = null;
    this.seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-r') === r)); });
    this.draw();
  };
  Chart.prototype.zoom = function (f, at) {
    var v = this.view, span = v[1] - v[0], c = v[0] + span * at, ns = Math.max(DAY / 2, span * f);
    var all = this.bounds('all'), full = all[1] - all[0] + DAY * 2; ns = Math.min(ns, full * 1.2);
    var a = c - ns * at, b = a + ns; this.view = [a, b]; this.seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); this.draw();
  };
  Chart.prototype.pan = function (dt) { this.view = [this.view[0] + dt, this.view[1] + dt]; this.draw(); };
  Chart.prototype.geom = function () {
    var W = Math.max(260, this.wrap.clientWidth || 640), H = W < 520 ? 220 : 260, L = 8, R = 62, T = 12, B = 26;
    var v = this.view, vis = this.pts.filter(function (p) { return p.t >= v[0] && p.t <= v[1]; });
    var before = null; for (var i = this.pts.length - 1; i >= 0; i--) if (this.pts[i].t < v[0]) { before = this.pts[i]; break; }
    var after = null; for (var j = 0; j < this.pts.length; j++) if (this.pts[j].t > v[1]) { after = this.pts[j]; break; }
    var ys = vis.map(function (p) { return p.v; }); if (before) ys.push(before.v); if (after && !vis.length) ys.push(after.v); ys.push(0);
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys); if (hi === lo) { hi += 50; lo -= 50; } var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var x = function (t) { return L + (t - v[0]) / (v[1] - v[0]) * (W - L - R); }, y = function (val) { return T + (hi - val) / (hi - lo) * (H - T - B); };
    var tx = function (px) { return v[0] + (px - L) / (W - L - R) * (v[1] - v[0]); };
    return { W: W, H: H, L: L, R: R, T: T, B: B, lo: lo, hi: hi, x: x, y: y, tx: tx, vis: vis, before: before, after: after };
  };
  Chart.prototype.draw = function () {
    var g = this.geom(), svg = this.svg, self = this; this.g = g;
    svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H); svg.setAttribute('height', g.H);
    if (!this.pts.length) { svg.innerHTML = ''; this.selBox.innerHTML = '<div class="qse-empty">No closed trades yet. Import a CSV to see your equity curve.</div>'; return; }
    var seq = []; if (g.before) seq.push(g.before); seq = seq.concat(g.vis); if (g.after) seq.push(g.after);
    var last = seq.length ? seq[seq.length - 1].v : 0, first = seq.length ? seq[0].v : 0, col = last >= first ? GAIN : LOSS;
    var h = '<defs><clipPath id="qse-clip"><rect x="' + g.L + '" y="0" width="' + (g.W - g.L - g.R) + '" height="' + g.H + '"></rect></clipPath><linearGradient id="qse-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity="0.28"></stop><stop offset="1" stop-color="' + col + '" stop-opacity="0"></stop></linearGradient></defs>';
    var ticks = 4, step = (g.hi - g.lo) / ticks;
    for (var i = 0; i <= ticks; i++) { var val = g.lo + step * i, yy = g.y(val); h += '<line x1="' + g.L + '" x2="' + (g.W - g.R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="' + GRID + '" stroke-width="1"></line><text x="' + (g.W - g.R + 8) + '" y="' + (yy + 4).toFixed(1) + '" fill="' + TXT + '" font-size="11">' + esc(money(val)) + '</text>'; }
    var z = g.y(0); if (z > g.T && z < g.H - g.B) h += '<line x1="' + g.L + '" x2="' + (g.W - g.R) + '" y1="' + z.toFixed(1) + '" y2="' + z.toFixed(1) + '" stroke="#445A53" stroke-dasharray="4 4"></line>';
    var span = this.view[1] - this.view[0], nX = Math.max(2, Math.floor((g.W - g.L - g.R) / 110));
    for (var k = 0; k <= nX; k++) { var tt = this.view[0] + span * k / nX, xx = g.x(tt); h += '<text x="' + xx.toFixed(1) + '" y="' + (g.H - 6) + '" fill="' + TXT + '" font-size="11" text-anchor="' + (k === 0 ? 'start' : k === nX ? 'end' : 'middle') + '">' + esc(fdate(tt, span > 300 * DAY)) + '</text>'; }
    if (this.sel) { var sa = g.x(Math.min(this.sel[0], this.sel[1])), sb = g.x(Math.max(this.sel[0], this.sel[1])); h += '<rect x="' + sa.toFixed(1) + '" y="' + g.T + '" width="' + Math.max(1, sb - sa).toFixed(1) + '" height="' + (g.H - g.T - g.B) + '" fill="' + BLUE + '" fill-opacity="0.13" stroke="' + BLUE + '" stroke-opacity="0.6"></rect>'; }
    if (seq.length) {
      var line = '', yb = g.y(Math.max(g.lo, Math.min(g.hi, 0)));
      seq.forEach(function (p, idx) { var px = g.x(p.t).toFixed(1), py = g.y(p.v).toFixed(1); if (idx === 0) line += 'M' + px + ' ' + py; else { var prev = seq[idx - 1]; line += 'L' + px + ' ' + g.y(prev.v).toFixed(1) + 'L' + px + ' ' + py; } });
      var extendTo = Math.min(g.W - g.R, g.x(Math.min(this.view[1], Math.max(seq[seq.length - 1].t, Date.now()))));
      line += 'L' + extendTo.toFixed(1) + ' ' + g.y(last).toFixed(1);
      var area = line + 'L' + extendTo.toFixed(1) + ' ' + (g.H - g.B) + 'L' + g.x(seq[0].t).toFixed(1) + ' ' + (g.H - g.B) + 'Z';
      h += '<g clip-path="url(#qse-clip)"><path d="' + area + '" fill="url(#qse-fill)"></path><path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round"></path>';
      if (g.vis.length <= 160) g.vis.forEach(function (p) { if (!p.start) h += '<circle cx="' + g.x(p.t).toFixed(1) + '" cy="' + g.y(p.v).toFixed(1) + '" r="2.4" fill="' + (p.p >= 0 ? GAIN : LOSS) + '" opacity="0.85"></circle>'; });
      h += '</g>';
    }
    if (this.hover) { var hp = this.hover, hx = g.x(hp.t), hy = g.y(hp.v);
      if (hx >= g.L && hx <= g.W - g.R) h += '<line x1="' + hx.toFixed(1) + '" x2="' + hx.toFixed(1) + '" y1="' + g.T + '" y2="' + (g.H - g.B) + '" stroke="#BAE6FD" stroke-opacity="0.55" stroke-dasharray="3 3"></line><line x1="' + g.L + '" x2="' + (g.W - g.R) + '" y1="' + hy.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#BAE6FD" stroke-opacity="0.25" stroke-dasharray="3 3"></line><circle cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="5" fill="#0B1210" stroke="' + BLUE + '" stroke-width="2.5"></circle><rect x="' + (g.W - g.R + 2) + '" y="' + (hy - 10).toFixed(1) + '" width="' + (g.R - 4) + '" height="20" rx="4" fill="' + BLUE + '"></rect><text x="' + (g.W - g.R + 8) + '" y="' + (hy + 4).toFixed(1) + '" fill="#05090C" font-size="11" font-weight="700">' + esc(money(hp.v)) + '</text>'; }
    svg.innerHTML = h; this.renderTip(); this.renderSel();
  };
  Chart.prototype.nearest = function (t) {
    var best = null, bd = Infinity; this.pts.forEach(function (p) { var d = Math.abs(p.t - t); if (d < bd) { bd = d; best = p; } }); return best;
  };
  Chart.prototype.renderTip = function () {
    var p = this.hover, tip = this.tip, g = this.g; if (!p || !g) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = '<div class="m">' + esc(fdate(p.t, true)) + (p.start ? ' · start' : '') + '</div><b style="color:' + (p.v >= 0 ? GAIN : LOSS) + '">' + esc(money(p.v)) + '</b> <span class="m">running P&amp;L</span>' +
      (p.start ? '' : '<div style="margin-top:4px"><span style="color:' + (p.p >= 0 ? GAIN : LOSS) + ';font-weight:700">' + esc(money(p.p)) + '</span> ' + esc((p.s || '') + ' ' + (p.n || 'trade')) + '</div>') +
      (p.dd < 0 ? '<div class="m">' + esc(money(p.dd)) + ' from peak</div>' : (p.start ? '' : '<div class="m">At a new high</div>'));
    var x = g.x(p.t) / g.W * this.wrap.clientWidth, w = tip.offsetWidth || 180;
    tip.style.left = Math.max(4, Math.min(this.wrap.clientWidth - w - 4, x + (x > this.wrap.clientWidth / 2 ? -w - 16 : 16))) + 'px';
  };
  Chart.prototype.renderSel = function () {
    var box = this.selBox; if (!this.sel || Math.abs(this.sel[1] - this.sel[0]) < 1) { box.innerHTML = ''; return; }
    var a = Math.min(this.sel[0], this.sel[1]), b = Math.max(this.sel[0], this.sel[1]);
    var startV = 0; for (var i = this.pts.length - 1; i >= 0; i--) if (this.pts[i].t <= a) { startV = this.pts[i].v; break; }
    var inside = this.pts.filter(function (p) { return !p.start && p.t > a && p.t <= b; });
    var endV = inside.length ? inside[inside.length - 1].v : startV, ret = endV - startV;
    var wins = inside.filter(function (p) { return p.p > 0; }).length, best = null, worst = null, run = startV, pk = startV, mdd = 0;
    inside.forEach(function (p) { if (!best || p.p > best.p) best = p; if (!worst || p.p < worst.p) worst = p; run = p.v; pk = Math.max(pk, run); mdd = Math.min(mdd, run - pk); });
    var c = ret >= 0 ? GAIN : LOSS, self = this;
    box.innerHTML = '<div class="qse-sel" role="status"><div><div class="k">Selected</div><div style="font-size:13px;font-weight:600">' + esc(fdate(a, true)) + ' – ' + esc(fdate(b, true)) + '</div></div>' +
      '<div><div class="k">Return</div><div class="v" style="color:' + c + '">' + esc(money(ret)) + '</div></div>' +
      '<div><div class="k">Trades</div><div class="v">' + inside.length + '</div></div>' +
      '<div><div class="k">Win rate</div><div class="v">' + (inside.length ? Math.round(wins / inside.length * 100) + '%' : '—') + '</div></div>' +
      '<div><div class="k">Deepest dip</div><div class="v" style="color:' + (mdd < 0 ? LOSS : '#EEF4F1') + '">' + (mdd < 0 ? esc(money(mdd)) : '$0') + '</div></div>' +
      (best ? '<div><div class="k">Best / worst trade</div><div style="font-size:13px;font-weight:700"><span style="color:' + GAIN + '">' + esc(money(best.p)) + '</span> / <span style="color:' + (worst.p < 0 ? LOSS : GAIN) + '">' + esc(money(worst.p)) + '</span></div></div>' : '') +
      '<div style="margin-left:auto;display:flex;gap:6px"><button type="button" data-a="zoom">Zoom to selection</button><button type="button" data-a="clear">Clear</button></div></div>';
    box.querySelector('[data-a="zoom"]').onclick = function () { var pad = (b - a) * 0.04; self.view = [a - pad, b + pad]; self.seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); self.draw(); };
    box.querySelector('[data-a="clear"]').onclick = function () { self.sel = null; self.draw(); };
  };
  Chart.prototype.bind = function () {
    var self = this, w = this.wrap, drag = null, pinch = null, pointers = {};
    var tAt = function (e) { var r = w.getBoundingClientRect(); return self.g.tx((e.clientX - r.left) / r.width * self.g.W); };
    var frac = function (e) { var r = w.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * self.g.W; return Math.max(0, Math.min(1, (px - self.g.L) / (self.g.W - self.g.L - self.g.R))); };
    w.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = e; w.setPointerCapture(e.pointerId);
      var ids = Object.keys(pointers);
      if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.abs(a.clientX - b.clientX) || 1, view: self.view.slice(), mid: (frac(a) + frac(b)) / 2 }; drag = null; return; }
      drag = { pan: e.shiftKey, t0: tAt(e), x0: e.clientX, view: self.view.slice(), moved: false };
    });
    w.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) pointers[e.pointerId] = e;
      var ids = Object.keys(pointers);
      if (pinch && ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.abs(a.clientX - b.clientX) || 1, f = pinch.d / d, sp = (pinch.view[1] - pinch.view[0]) * f, c = pinch.view[0] + (pinch.view[1] - pinch.view[0]) * pinch.mid; self.view = [c - sp * pinch.mid, c - sp * pinch.mid + Math.max(DAY / 2, sp)]; self.draw(); return; }
      if (drag) {
        if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
        if (drag.pan) { var r = w.getBoundingClientRect(), dt = -(e.clientX - drag.x0) / r.width * (drag.view[1] - drag.view[0]) * (self.g.W / (self.g.W - self.g.L - self.g.R)); self.view = [drag.view[0] + dt, drag.view[1] + dt]; self.hover = null; self.draw(); return; }
        if (drag.moved) { self.sel = [drag.t0, tAt(e)]; }
      }
      self.hover = self.nearest(tAt(e)); self.draw();
    });
    var end = function (e) { delete pointers[e.pointerId]; if (Object.keys(pointers).length < 2) pinch = null; if (drag && !drag.moved && !drag.pan && e.type === 'pointerup' && e.pointerType !== 'mouse') { self.hover = self.nearest(tAt(e)); self.draw(); } drag = null; };
    w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
    w.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { self.hover = null; self.draw(); } });
    w.addEventListener('wheel', function (e) { e.preventDefault(); self.zoom(e.deltaY > 0 ? 1.25 : 0.8, frac(e)); }, { passive: false });
    w.addEventListener('dblclick', function () { self.sel = null; self.setRange(self.range); });
    w.addEventListener('keydown', function (e) {
      var pts = self.pts, i = self.hover ? pts.indexOf(self.hover) : -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); i = Math.max(0, Math.min(pts.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); self.hover = pts[i]; self.draw(); }
      else if (e.key === '+' || e.key === '=') { self.zoom(0.7, 0.5); } else if (e.key === '-') { self.zoom(1.4, 0.5); } else if (e.key === 'Escape') { self.sel = null; self.hover = null; self.draw(); }
    });
    w.addEventListener('blur', function () { self.hover = null; self.draw(); });
  };
  function init(el) {
    if (el.__qse) { if (el.__qse.key !== el.getAttribute('data-eq')) { el.__qse.key = el.getAttribute('data-eq'); el.__qse.chart.load(); } return; }
    injectCss(); var c = new Chart(el); el.__qse = { chart: c, key: el.getAttribute('data-eq') };
    new MutationObserver(function () { init(el); }).observe(el, { attributes: true, attributeFilter: ['data-eq', 'data-range'] });
  }
  function scan() { document.querySelectorAll('.qs-eq[data-eq]').forEach(init); }
  if (window.MutationObserver) new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', scan);
  window.QSEquity = { scan: scan };
})();
