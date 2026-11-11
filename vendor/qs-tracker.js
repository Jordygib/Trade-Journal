/* Quillstrike Position tracker.
   Tracks open options positions with a Black-Scholes model that re-prices every second as time passes.
   The underlying price and IV come from the trader (no market data feed yet), and everything is labeled as an estimate.
   Positions are saved to the "positions" table in Supabase, or to this browser if that table isn't set up. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, positions = [], cur = null, store = 'db', tick = null, prev = {}, whatIfDays = 0, sound = false, firedAlerts = {};
  var R = 0.04, YEAR = 365 * 864e5;
  var INDEX = { SPX: 1, XSP: 1, SPY: 1, QQQ: 1, IWM: 1, DIA: 1, NDX: 1, RUT: 1 };

  /* ---------- math ---------- */
  function ncdf(x) { var t = 1 / (1 + 0.2316419 * Math.abs(x)), dd = 0.3989423 * Math.exp(-x * x / 2), p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
  function npdf(x) { return Math.exp(-x * x / 2) / 2.5066282746; }
  function bs(type, S, K, T, v) {
    if (T <= 1e-9 || v <= 0) { var iv = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S); return { p: iv, d: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), g: 0, t: 0, v: 0 }; }
    var sq = Math.sqrt(T), d1 = (Math.log(S / K) + (R + v * v / 2) * T) / (v * sq), d2 = d1 - v * sq, disc = Math.exp(-R * T);
    var p = type === 'call' ? S * ncdf(d1) - K * disc * ncdf(d2) : K * disc * ncdf(-d2) - S * ncdf(-d1);
    var th = -S * npdf(d1) * v / (2 * sq) + (type === 'call' ? -R * K * disc * ncdf(d2) : R * K * disc * ncdf(-d2));
    return { p: p, d: type === 'call' ? ncdf(d1) : ncdf(d1) - 1, g: npdf(d1) / (S * v * sq), t: th / 365, v: S * npdf(d1) * sq / 100 };
  }
  function etOffsetMin(date) {
    try { var s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(date).filter(function (p) { return p.type === 'timeZoneName'; })[0].value; var m = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : -300; } catch (e) { return -300; }
  }
  function expiryMs(ymd) { var m = String(ymd).match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return Date.now(); var guess = Date.UTC(+m[1], +m[2] - 1, +m[3], 21, 0); return Date.UTC(+m[1], +m[2] - 1, +m[3], 16, 0) - etOffsetMin(new Date(guess)) * 60000; }
  function marketStatus() {
    var now = new Date(), off = etOffsetMin(now), et = new Date(now.getTime() + off * 60000), wd = et.getUTCDay(), mins = et.getUTCHours() * 60 + et.getUTCMinutes();
    if (wd === 0 || wd === 6) return { open: false, txt: 'Market closed · weekend' };
    if (mins >= 570 && mins < 960) return { open: true, txt: 'Market open · ' + Math.floor((960 - mins) / 60) + 'h ' + ((960 - mins) % 60) + 'm to close' };
    if (mins < 570) return { open: false, txt: 'Pre-market · opens 9:30 ET' };
    return { open: false, txt: 'Market closed · after hours' };
  }
  function units(p) { return Math.max(1, Number(p.contracts) || 1); }
  function yearsLeft(p, extraDays) { return Math.max(0, (expiryMs(p.expiration) - Date.now() - (extraDays || 0) * 864e5) / YEAR); }
  function valueAt(p, S, T, v) {
    var tot = { p: 0, d: 0, g: 0, t: 0, v: 0 }, u = units(p) * 100;
    p.legs.forEach(function (l) { var r = bs(l.type, S, l.strike, T, v); var n = l.n * u; tot.p += n * r.p; tot.d += n * r.d; tot.g += n * r.g; tot.t += n * r.t; tot.v += n * r.v; });
    tot.pnl = Number(p.entry_price) * u + tot.p; return tot;
  }
  function expiryPnl(p, S) { return valueAt(p, S, 0, 0.2).pnl; }
  function probRange(S, T, v, lo, hi) { // P(lo < S_T < hi), lognormal
    if (T <= 1e-9) return (S > lo && S < hi) ? 1 : 0;
    var c = function (K) { if (K <= 0) return 0; if (!isFinite(K)) return 1; return ncdf((Math.log(K / S) - (R - v * v / 2) * T) / (v * Math.sqrt(T))); };
    return c(hi) - c(lo);
  }
  function analyze(p, S, T, v) {
    var ks = p.legs.map(function (l) { return l.strike; }), mn = Math.min.apply(null, ks), mx = Math.max.apply(null, ks);
    var sd = S * v * Math.sqrt(Math.max(T, 1 / (365 * 24))), span = Math.max(mx - mn, sd * 2.6, S * 0.012);
    var lo = Math.max(0.01, Math.min(mn, S) - span * 0.8), hi = Math.max(mx, S) + span * 0.8, N = 360, pts = [];
    for (var i = 0; i <= N; i++) { var x = lo + (hi - lo) * i / N; pts.push([x, expiryPnl(p, x)]); }
    var callN = p.legs.filter(function (l) { return l.type === 'call'; }).reduce(function (s, l) { return s + l.n; }, 0);
    var ys = pts.map(function (q) { return q[1]; }).concat([expiryPnl(p, 0.01)]), maxP = Math.max.apply(null, ys), maxL = Math.min.apply(null, ys);
    if (callN > 1e-9) maxP = Infinity; if (callN < -1e-9) maxL = -Infinity;
    // profitable intervals on a fine grid, extended to 0 and infinity
    var grid = [0.01].concat(pts.map(function (q) { return q[0]; })), ys2 = grid.map(function (x) { return expiryPnl(p, x); }), be = [], pop = 0, pmax = 0, start = null, mstart = null;
    var tailEnd = callN < -1e-9 ? null : Infinity, tol = isFinite(maxP) ? Math.max(0.5, Math.abs(maxP) * 0.002) : 0;
    for (var j = 0; j < grid.length; j++) {
      var x0 = grid[j], y0 = ys2[j], last = j === grid.length - 1;
      if (y0 > 0 && start === null) start = x0;
      if (start !== null && (y0 <= 0 || last)) { pop += probRange(S, T, v, start, last && y0 > 0 ? (tailEnd === null ? x0 : tailEnd) : x0); start = null; }
      if (isFinite(maxP) && maxP > 0) { var atMax = y0 >= maxP - tol; if (atMax && mstart === null) mstart = x0; if (mstart !== null && (!atMax || last)) { pmax += probRange(S, T, v, mstart, last && atMax ? (Math.abs(callN) < 1e-9 ? Infinity : x0) : x0); mstart = null; } }
      if (j > 0) { var xa = grid[j - 1], ya = ys2[j - 1]; if ((ya < 0 && y0 >= 0) || (ya >= 0 && y0 < 0)) be.push(xa + (x0 - xa) * (0 - ya) / (y0 - ya)); }
    }
    return { pts: pts, lo: lo, hi: hi, maxP: maxP, maxL: maxL, be: be, pop: Math.max(0, Math.min(1, pop)), pmax: Math.max(0, Math.min(1, pmax)), sd: S * v * Math.sqrt(T), ks: ks };
  }
  function shorts(p) { return p.legs.filter(function (l) { return l.n < 0; }); }

  /* ---------- formatting ---------- */
  function m2(n, plus) { var a = Math.abs(n), s = a >= 1000 ? Math.round(a).toLocaleString('en-US') : a.toFixed(2); return (n < 0 ? '−$' : (plus && n > 0 ? '+$' : '$')) + s; }
  function fpx(x) { return x >= 1000 ? x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : x.toFixed(2); }
  function fstrike(x) { return x % 1 ? x.toFixed(2) : String(x); }
  function countdown(ms) { if (ms <= 0) return 'Expired'; var s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (dd ? dd + 'd ' : '') + String(h).padStart(dd ? 2 : 1, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }
  function ago(ts) { var s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000)); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' hr ago' : Math.floor(s / 86400) + ' days ago'; }
  function legText(p) { return p.legs.map(function (l) { var n = Math.abs(l.n); return (l.n < 0 ? 'Short ' : 'Long ') + (n !== 1 ? n + '× ' : '') + fstrike(l.strike) + (l.type === 'call' ? 'C' : 'P'); }).join(' · '); }

  /* ---------- styles ---------- */
  var CSS = '' +
    '@keyframes qtUp{0%{background:rgba(87,227,181,.32);box-shadow:0 0 26px rgba(87,227,181,.55)}100%{background:transparent;box-shadow:none}}' +
    '@keyframes qtDn{0%{background:rgba(255,122,138,.30);box-shadow:0 0 26px rgba(255,122,138,.5)}100%{background:transparent;box-shadow:none}}' +
    '.qt-up{animation:qtUp .9s ease-out}.qt-dn{animation:qtDn .9s ease-out}' +
    '.qt-v{display:inline-block;border-radius:6px;padding:0 4px;margin:0 -4px}' +
    '@keyframes qtPulse{0%{box-shadow:0 0 0 0 rgba(87,227,181,.7)}100%{box-shadow:0 0 0 10px rgba(87,227,181,0)}}' +
    '@keyframes qtPulseR{0%{box-shadow:0 0 0 0 rgba(255,122,138,.7)}100%{box-shadow:0 0 0 10px rgba(255,122,138,0)}}' +
    '.qt-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#57E3B5;animation:qtPulse 1.6s ease-out infinite;flex:none}.qt-dot.off{background:#8396AD;animation:none}.qt-dot.red{background:#FF7A8A;animation:qtPulseR 1.2s ease-out infinite}' +
    '@keyframes qtSpot{0%,100%{r:6}50%{r:9}}.qt-spot{animation:qtSpot 1.6s ease-in-out infinite}' +
    '@keyframes qtRing{0%,100%{filter:drop-shadow(0 0 6px var(--c))}50%{filter:drop-shadow(0 0 14px var(--c))}}.qt-ring{animation:qtRing 2.4s ease-in-out infinite}' +
    '@keyframes qtAlarm{0%,100%{border-color:rgba(255,122,138,.4)}50%{border-color:rgba(255,122,138,1);box-shadow:0 0 30px rgba(255,122,138,.45)}}.qt-alarm{animation:qtAlarm 1s ease-in-out infinite}' +
    '@keyframes qtGold{0%,100%{border-color:rgba(240,199,102,.4)}50%{border-color:rgba(240,199,102,1);box-shadow:0 0 30px rgba(240,199,102,.4)}}.qt-goal{animation:qtGold 1.2s ease-in-out infinite}' +
    '.qt-pos{display:flex;flex-direction:column;gap:4px;min-width:190px;padding:12px 14px;border-radius:12px;border:1px solid #21304A;background:rgba(12,19,31,.78);color:#EEF3FA;text-align:left;cursor:pointer;font:500 13px Barlow,system-ui,sans-serif}' +
    '.qt-pos[aria-pressed="true"]{border-color:#38BDF8;box-shadow:0 0 0 1px rgba(56,189,248,.35),0 0 30px rgba(56,189,248,.25)}.qt-pos:hover{border-color:#3A4F6E}' +
    '.qt-nudge{min-height:34px;min-width:52px;padding:0 8px;border:1px solid #21304A;border-radius:8px;background:#0A111C;color:#C7D3E1;font:600 13px Barlow,system-ui,sans-serif;cursor:pointer}.qt-nudge:hover{border-color:#38BDF8;color:#fff;box-shadow:0 0 14px rgba(56,189,248,.3)}' +
    '.qx input[type=range]{padding:0;min-height:28px;border:none;background:transparent;accent-color:#38BDF8}' +
    '.qt-big{font-family:"Barlow Semi Condensed",Barlow,sans-serif;font-size:44px;font-weight:700;line-height:1.05}' +
    '.qt-heat td{text-align:center;font-weight:600;font-size:12px;padding:7px 4px;border:1px solid #0B1220}' +
    '.qt-leg{display:grid;grid-template-columns:90px 70px 80px 1fr 34px;gap:6px;align-items:center;margin-bottom:6px}' +
    '@media (max-width:760px){.qt-big{font-size:34px}}';
  function css() { if (document.getElementById('qt-css')) return; var s = document.createElement('style'); s.id = 'qt-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- storage ---------- */
  var LKEY = function () { return 'qs_positions_' + (d.user ? d.user.id : 'anon'); };
  function lsAll() { try { return JSON.parse(localStorage.getItem(LKEY()) || '[]'); } catch (e) { return []; } }
  function lsSave() { try { localStorage.setItem(LKEY(), JSON.stringify(positions.filter(function (p) { return !p.sample; }))); } catch (e) {} }
  var saveT = {};
  function persist(p, fields) {
    if (p.sample) return;
    if (store === 'local') { lsSave(); return; }
    clearTimeout(saveT[p.id]); saveT[p.id] = setTimeout(function () { var o = {}; fields.forEach(function (f) { o[f] = p[f]; }); d.sb.from('positions').update(o).eq('id', p.id).then(function () {}, function () {}); }, 600);
  }
  function load() {
    if (!d.sb || !d.user) { store = 'local'; positions = lsAll(); return Promise.resolve(); }
    return d.sb.from('positions').select('*').eq('status', 'open').order('created_at', { ascending: true }).then(function (r) {
      if (r.error) { store = 'local'; positions = lsAll(); return; }
      positions = (r.data || []).map(norm);
      var local = lsAll(); // move positions saved in this browser before the table existed
      if (local.length) { positions = positions.concat(local); local.forEach(function (p) { insert(p, true); }); try { localStorage.removeItem(LKEY()); } catch (e) {} }
    }, function () { store = 'local'; positions = lsAll(); });
  }
  function norm(p) { p.legs = (p.legs || []).map(function (l) { return { type: l.type === 'call' ? 'call' : 'put', strike: Number(l.strike), n: Number(l.n) }; }); p.iv = Number(p.iv) || 0.2; p.spot = Number(p.spot) || null; p.entry_price = Number(p.entry_price) || 0; p.alerts = p.alerts || {}; return p; }
  function insert(p, quiet) {
    var row = { user_id: d.user.id, underlying: p.underlying, strategy: p.strategy, legs: p.legs, expiration: p.expiration, entry_price: p.entry_price, contracts: p.contracts, iv: p.iv, spot: p.spot, spot_at: p.spot_at, entry_spot: p.entry_spot || null, alerts: p.alerts || {}, trade_id: p.trade_id || null, status: 'open' };
    return d.sb.from('positions').insert(row).select('*').single().then(function (r) { if (!r.error && r.data) { var i = positions.indexOf(p); var np = norm(r.data); if (i >= 0) positions[i] = np; if (cur === p) cur = np; if (!quiet) renderAll(); } });
  }

  /* ---------- presets for the add form ---------- */
  var STEP = function (sym, S) { return sym === 'SPX' || sym === 'NDX' || sym === 'RUT' ? 5 : S > 300 ? 1 : S > 50 ? 1 : 0.5; };
  var PRESETS = {
    pcs: ['Put credit spread', function (S, w, st) { var k = Math.round(S * 0.985 / st) * st; return [['sell', 'put', k], ['buy', 'put', k - w]]; }],
    ccs: ['Call credit spread', function (S, w, st) { var k = Math.round(S * 1.015 / st) * st; return [['sell', 'call', k], ['buy', 'call', k + w]]; }],
    ic: ['Iron condor', function (S, w, st) { var p = Math.round(S * 0.985 / st) * st, c = Math.round(S * 1.015 / st) * st; return [['sell', 'put', p], ['buy', 'put', p - w], ['sell', 'call', c], ['buy', 'call', c + w]]; }],
    ifly: ['Iron butterfly', function (S, w, st) { var k = Math.round(S / st) * st; return [['sell', 'put', k], ['sell', 'call', k], ['buy', 'put', k - w], ['buy', 'call', k + w]]; }],
    fly: ['Butterfly', function (S, w, st) { var k = Math.round(S / st) * st; return [['buy', 'call', k - w], ['sell', 'call', k, 2], ['buy', 'call', k + w]]; }],
    pds: ['Put debit spread', function (S, w, st) { var k = Math.round(S / st) * st; return [['buy', 'put', k], ['sell', 'put', k - w]]; }],
    cds: ['Call debit spread', function (S, w, st) { var k = Math.round(S / st) * st; return [['buy', 'call', k], ['sell', 'call', k + w]]; }],
    long_call: ['Long call', function (S, w, st) { return [['buy', 'call', Math.round(S / st) * st]]; }],
    long_put: ['Long put', function (S, w, st) { return [['buy', 'put', Math.round(S / st) * st]]; }],
    short_put: ['Naked put', function (S, w, st) { return [['sell', 'put', Math.round(S * 0.97 / st) * st]]; }],
    other: ['Custom', function () { return [['sell', 'put', '']]; }]
  };

  /* ---------- rendering ---------- */
  function strip() {
    var h = '<div style="display:flex;gap:10px;overflow-x:auto;padding:2px 2px 6px" id="qt-strip">';
    positions.forEach(function (p, i) {
      var T = yearsLeft(p), S = p.spot || p.legs[0].strike, v = valueAt(p, S, T, p.iv), left = expiryMs(p.expiration) - Date.now();
      h += '<button class="qt-pos" data-i="' + i + '" aria-pressed="' + (p === cur) + '"><span style="display:flex;align-items:center;gap:8px"><span class="qt-dot' + (left <= 0 ? ' off' : v.pnl < 0 ? ' red' : '') + '"></span><b style="color:#fff">' + E(p.underlying) + '</b> <span class="qx-muted">' + E(Q.names(p.strategy)) + '</span>' + (p.sample ? ' <span class="qx-chip gold" style="padding:0 6px;font-size:10px">SAMPLE</span>' : '') + '</span>' +
        '<span class="qt-v" data-k="s' + i + '" style="font-size:20px;font-weight:700;font-family:\'Barlow Semi Condensed\',Barlow,sans-serif;color:' + (v.pnl < 0 ? '#FF7A8A' : '#57E3B5') + '">' + m2(v.pnl, true) + '</span><span class="qx-small qx-muted" data-k="c' + i + '">' + countdown(left) + ' left</span></button>';
    });
    return h + '<button class="qt-pos" id="qt-add" style="align-items:center;justify-content:center;border-style:dashed;min-width:150px;color:#7DD3FC"><span style="font-size:24px;line-height:1">+</span><span>Add position</span></button></div>';
  }
  function chartSvg(p, A, S, T, v) {
    var W = 760, H = 330, pl = 66, pr = 16, pt = 16, pb = 44, now = [];
    for (var i = 0; i <= 160; i++) { var x = A.lo + (A.hi - A.lo) * i / 160; now.push([x, valueAt(p, x, T, v).pnl]); }
    var ys = A.pts.map(function (q) { return q[1]; }).concat(now.map(function (q) { return q[1]; })), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.1 || 50; y0 -= pad; y1 += pad;
    var X = function (s) { return pl + (s - A.lo) / (A.hi - A.lo) * (W - pl - pr); }, Y = function (val) { return pt + (y1 - val) / (y1 - y0) * (H - pt - pb); };
    var path = function (arr) { return arr.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join(''); };
    var line = path(A.pts), area = line + 'L' + X(A.hi).toFixed(1) + ' ' + Y(0).toFixed(1) + 'L' + X(A.lo).toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z';
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block;overflow:visible" id="qt-svg"><defs>' +
      '<clipPath id="qt-up"><rect x="0" y="0" width="' + W + '" height="' + Y(0).toFixed(1) + '"/></clipPath><clipPath id="qt-dn"><rect x="0" y="' + Y(0).toFixed(1) + '" width="' + W + '" height="' + H + '"/></clipPath>' +
      '<linearGradient id="qt-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57E3B5" stop-opacity=".32"/><stop offset="1" stop-color="#57E3B5" stop-opacity=".03"/></linearGradient><linearGradient id="qt-r" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF7A8A" stop-opacity=".32"/><stop offset="1" stop-color="#FF7A8A" stop-opacity=".03"/></linearGradient>' +
      '<filter id="qt-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    if (A.sd > 0) { var a = Math.max(A.lo, S - A.sd), b = Math.min(A.hi, S + A.sd); s += '<rect x="' + X(a).toFixed(1) + '" y="' + pt + '" width="' + Math.max(0, X(b) - X(a)).toFixed(1) + '" height="' + (H - pt - pb) + '" fill="rgba(56,189,248,.07)"/><text x="' + ((X(a) + X(b)) / 2).toFixed(1) + '" y="' + (pt + 12) + '" fill="#7DD3FC" font-size="10.5" text-anchor="middle" opacity=".8">expected move ±1σ</text>'; }
    for (var k = 0; k <= 4; k++) { var val = y0 + (y1 - y0) * k / 4; s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(val).toFixed(1) + '" y2="' + Y(val).toFixed(1) + '" stroke="#16223A"/><text x="' + (pl - 8) + '" y="' + (Y(val) + 4).toFixed(1) + '" fill="#8396AD" font-size="11" text-anchor="end">' + Q.money(val, true) + '</text>'; }
    s += '<path d="' + area + '" fill="url(#qt-g)" clip-path="url(#qt-up)"/><path d="' + area + '" fill="url(#qt-r)" clip-path="url(#qt-dn)"/><line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#4A5D7A"/>';
    var uniq = A.ks.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).sort(function (a2, b2) { return a2 - b2; }), lastX = [-1e9, -1e9];
    uniq.forEach(function (x) { var px = X(x), row = px - lastX[0] >= 44 ? 0 : px - lastX[1] >= 44 ? 1 : -1; s += '<line x1="' + px.toFixed(1) + '" x2="' + px.toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb + 4) + '" stroke="#2A3B57" stroke-dasharray="3 4"/>'; if (row >= 0) { lastX[row] = px; s += '<text x="' + px.toFixed(1) + '" y="' + (H - pb + 16 + row * 14) + '" fill="#AFBFD1" font-size="11" text-anchor="middle">' + fstrike(x) + '</text>'; } });
    s += '<path d="' + line + '" fill="none" stroke="#7DD3FC" stroke-width="2" opacity=".75"/>';
    s += '<path d="' + path(now) + '" fill="none" stroke="#F0C766" stroke-width="2.6" filter="url(#qt-glow)"/>';
    var nowV = valueAt(p, S, T, v).pnl, sx = X(Math.max(A.lo, Math.min(A.hi, S))), sy = Y(nowV), col = nowV < 0 ? '#FF7A8A' : '#57E3B5';
    s += '<line x1="' + sx.toFixed(1) + '" x2="' + sx.toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="' + col + '" stroke-opacity=".55" stroke-dasharray="2 3"/><circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="14" fill="' + col + '" opacity=".14"/><circle class="qt-spot" cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="6" fill="' + col + '" style="filter:drop-shadow(0 0 8px ' + col + ')"/>';
    s += '<line id="qt-hx" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#BAE6FD" stroke-opacity=".5" style="display:none"/><rect id="qt-hit" x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '" fill="transparent"/></svg>';
    return { svg: s, W: W, pl: pl, pr: pr, X: X };
  }
  function ring(id, frac, col, label) {
    var r = 46, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, frac)));
    return '<svg width="118" height="118" viewBox="0 0 118 118" class="qt-ring" style="--c:' + col + '88" aria-hidden="true"><circle cx="59" cy="59" r="' + r + '" fill="none" stroke="#132036" stroke-width="10"/><circle id="' + id + '-arc" cx="59" cy="59" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 59 59)" style="transition:stroke-dashoffset .6s ease"/><text id="' + id + '-t" x="59" y="66" text-anchor="middle" font-family="Barlow Semi Condensed, Barlow, sans-serif" font-size="26" font-weight="700" fill="#fff">' + label + '</text></svg>';
  }
  function heat(p, S, v, A) {
    var Tn = yearsLeft(p), far = p.legs.reduce(function (m, l) { return Math.max(m, Math.abs(l.strike - S)); }, 0), stepP = Math.max(A.sd * 0.4, far * 1.25 / 4, S * 0.001), rows = [], cols = [0, 0.25, 0.5, 0.75, 1];
    for (var i = 4; i >= -4; i--) rows.push(S + stepP * i);
    var h = '<table class="qt-heat" style="width:100%;border-collapse:collapse"><thead><tr><th class="qx-small qx-muted" style="text-align:left;padding:6px">Price \\ time</th>' + cols.map(function (c) { var t = Tn * (1 - c), dd = Date.now() + (Tn - t) * YEAR; return '<th class="qx-small qx-muted" style="padding:6px">' + (c === 0 ? 'Now' : c === 1 ? 'Expiry' : new Date(dd).toLocaleString('en-US', Object.assign({ timeZone: 'America/New_York' }, Tn * YEAR < 864e5 ? { hour: 'numeric', minute: '2-digit' } : Tn * YEAR < 4 * 864e5 ? { weekday: 'short', hour: 'numeric' } : { month: 'short', day: 'numeric' })) + (Tn * YEAR < 4 * 864e5 ? ' ET' : '')) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var mx = 1; var cells = rows.map(function (s) { return cols.map(function (c) { var val = valueAt(p, s, Tn * (1 - c), v).pnl; mx = Math.max(mx, Math.abs(val)); return val; }); });
    rows.forEach(function (s, ri) { var isNow = ri === 4; h += '<tr><td style="text-align:left;color:' + (isNow ? '#F0C766' : '#C7D3E1') + '">' + fpx(s) + (isNow ? ' ◂' : '') + '</td>' + cells[ri].map(function (val) { var a = Math.min(1, Math.abs(val) / mx), bg = val >= 0 ? 'rgba(87,227,181,' + (0.08 + a * 0.5).toFixed(2) + ')' : 'rgba(255,122,138,' + (0.08 + a * 0.5).toFixed(2) + ')'; return '<td style="background:' + bg + ';color:#fff">' + Q.money(val, true) + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table>';
  }
  function maxLossRule() { var r = (d.rules || []).filter(function (x) { return x.on && x.kind === 'max_loss' && !x.sample; })[0]; return r ? Math.abs(Number(r.val)) : null; }

  function renderAll() {
    if (!el) return;
    var h = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">';
    h += '<div class="qx-row qx-sp"><div class="qx-row"><span class="qt-dot' + (marketStatus().open ? '' : ' off') + '" id="qt-mdot"></span><span id="qt-mkt" class="qx-small" style="color:#C7D3E1">' + marketStatus().txt + '</span></div><span class="qx-small qx-muted">' + (store === 'local' ? 'Positions are saved in this browser. Run the new-features SQL to save them to your account.' : '') + '</span></div>';
    h += strip();
    h += '<div id="qt-main"></div><div id="qt-imports"></div></div>';
    el.innerHTML = h;
    el.querySelectorAll('.qt-pos[data-i]').forEach(function (b) { b.onclick = function () { cur = positions[+b.getAttribute('data-i')]; whatIfDays = 0; prev = {}; firedAlerts = {}; renderAll(); }; });
    document.getElementById('qt-add').onclick = function () { form(); };
    if (cur) detail(); else if (!positions.length) empty(); else { cur = positions[0]; detail(); }
    imports();
  }
  function empty() {
    document.getElementById('qt-main').innerHTML = '<div class="qx-card qx-empty"><div style="font-size:40px">📡</div><h2>Track an open position</h2><p style="max-width:560px;margin:8px auto 16px">Add a trade you have on right now. Quillstrike re-prices it every second as time passes, and shows your estimated P/L, probability of profit, Greeks and risk, and alerts you when you hit your targets.</p><div class="qx-row" style="justify-content:center"><button class="qx-btn" id="qt-add2">Add a position</button><button class="qx-btn2" id="qt-sample">Try a sample SPX iron condor</button></div></div>';
    document.getElementById('qt-add2').onclick = function () { form(); };
    document.getElementById('qt-sample').onclick = function () { var S = 5900, exp = new Date(Date.now() + (new Date().getDay() === 5 ? 3 : 1) * 864e5); var p = { id: 'sample', sample: true, underlying: 'SPX', strategy: 'ic', legs: [{ type: 'put', strike: 5820, n: -1 }, { type: 'put', strike: 5810, n: 1 }, { type: 'call', strike: 5980, n: -1 }, { type: 'call', strike: 5990, n: 1 }], expiration: Q.dayKey(exp), entry_price: 1.6, contracts: 1, iv: 0.14, spot: S, spot_at: new Date().toISOString(), alerts: {} }; positions.push(p); cur = p; renderAll(); };
  }
  function detail() {
    var p = cur, box = document.getElementById('qt-main');
    if (!p.spot) p.spot = p.entry_spot || p.legs.reduce(function (s, l) { return s + l.strike; }, 0) / p.legs.length;
    var S = p.spot, T = yearsLeft(p, whatIfDays), v = p.iv, A = analyze(p, S, T, v), V = valueAt(p, S, T, v), C = chartSvg(p, A, S, T, v);
    var totalDays = Math.max(0, (expiryMs(p.expiration) - Date.now()) / 864e5), credit = p.entry_price >= 0, u = units(p) * 100;
    var al = p.alerts || {}, tp = al.tp != null ? al.tp : (isFinite(A.maxP) && A.maxP > 0 ? Math.round(A.maxP * 0.5) : null), sl = al.sl != null ? al.sl : (maxLossRule() || (isFinite(A.maxL) ? Math.round(-A.maxL * 0.5) : null));
    var sliderSpan = Math.max(A.sd * 3, S * 0.02), step = S > 1000 ? 0.25 : 0.01;
    box.innerHTML =
      '<div class="qx-card" id="qt-banner" style="display:none;margin-bottom:16px"></div>' +
      '<div class="qx-card" style="margin-bottom:16px"><div class="qx-row qx-sp" style="align-items:flex-start"><div><h2 style="font-size:24px">' + E(p.underlying) + ' ' + E(Q.names(p.strategy)) + (p.sample ? ' <span class="qx-chip gold">Sample</span>' : '') + '</h2><div class="qx-small qx-muted" style="margin-top:2px">' + E(legText(p)) + ' · exp ' + E(p.expiration) + ' · ' + (credit ? 'credit ' : 'debit ') + '$' + Math.abs(p.entry_price).toFixed(2) + ' × ' + units(p) + '</div></div>' +
      '<div class="qx-row"><button class="qx-btn2" id="qt-edit" style="min-height:34px">Edit</button><button class="qx-btn2" id="qt-close" style="min-height:34px">Closed it</button><button class="qx-btn2" id="qt-del" style="min-height:34px">Delete</button></div></div></div>' +
      // KPI row
      '<div class="qx-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-bottom:16px">' +
      '<div class="qx-card" id="qt-pnlcard"><div class="qx-label">Est. P/L ' + (whatIfDays ? 'in ' + whatIfDays.toFixed(1) + ' days' : 'now') + '</div><div class="qt-big"><span class="qt-v" data-k="pnl" id="qt-pnl">' + m2(V.pnl, true) + '</span></div><div class="qx-small qx-muted"><span data-k="ret" class="qt-v" id="qt-ret"></span></div><div class="qx-bar" style="margin-top:8px"><i id="qt-capbar" style="width:0%"></i></div><div class="qx-small qx-muted" style="margin-top:4px" id="qt-cap"></div></div>' +
      '<div class="qx-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px"><div style="flex:none">' + ring('qt-pop', A.pop, '#57E3B5', Math.round(A.pop * 100) + '%') + '</div><div><div class="qx-label">Prob. of profit</div><div class="qx-small qx-muted">at expiration</div><div style="margin-top:6px" class="qx-small">Max profit: <b class="qt-v" data-k="pmax" id="qt-pmax">' + Math.round(A.pmax * 100) + '%</b></div></div></div>' +
      '<div class="qx-card"><div class="qx-label">Time left</div><div class="qt-big" style="font-size:36px" id="qt-cd">' + countdown(expiryMs(p.expiration) - Date.now()) + '</div><div class="qx-small qx-muted">to 4:00 PM ET on ' + E(p.expiration) + '</div><div class="qx-small" style="margin-top:6px">Theta clock: <b class="qt-v qx-gain" data-k="thm" id="qt-thm"></b> <span class="qx-muted">per minute</span></div></div>' +
      '<div class="qx-card"><div class="qx-label">Underlying</div><div class="qt-big" style="font-size:36px"><span class="qt-v" data-k="spot" id="qt-spotv">' + fpx(S) + '</span></div><div class="qx-small qx-muted" id="qt-stale">You entered this price ' + ago(p.spot_at || p.created_at || Date.now()) + '</div><div class="qx-small" style="margin-top:6px">Expected move: <b id="qt-em">±' + fpx(A.sd) + '</b></div></div>' +
      '</div>' +
      // price + chart
      '<div class="qx-grid" style="grid-template-columns:minmax(0,2fr) minmax(280px,1fr);align-items:start;margin-bottom:16px" id="qt-g1">' +
      '<div class="qx-card"><div class="qx-row qx-sp" style="margin-bottom:6px"><h3>Profit &amp; loss</h3><span class="qx-small"><span style="color:#F0C766">━ Now (T+' + (whatIfDays ? whatIfDays.toFixed(1) : '0') + ')</span> <span style="color:#7DD3FC;margin-left:10px">━ At expiration</span></span></div><div style="position:relative">' + C.svg + '<div id="qt-tip" style="position:absolute;top:4px;left:80px;display:none;padding:6px 10px;border-radius:8px;border:1px solid rgba(56,189,248,.5);background:rgba(4,6,10,.95);font-size:12px;pointer-events:none;z-index:2"></div></div></div>' +
      '<div class="qx-card"><h3>Update the price</h3><p class="qx-small qx-muted" style="margin:2px 0 10px">Type the latest price from your broker, or drag to see what-ifs.</p>' +
      '<div class="qx-row" style="flex-wrap:nowrap"><input id="qt-spot" type="number" step="' + step + '" value="' + S.toFixed(2) + '" aria-label="Underlying price" style="font-size:18px;font-weight:700"><button class="qx-btn" id="qt-setspot" style="flex:none">Set</button></div>' +
      '<input id="qt-slide" type="range" min="' + (S - sliderSpan).toFixed(2) + '" max="' + (S + sliderSpan).toFixed(2) + '" step="' + step + '" value="' + S.toFixed(2) + '" style="width:100%;margin-top:10px" aria-label="Price slider">' +
      '<div class="qx-row" style="gap:6px;margin-top:6px">' + [-1, -0.5, -0.1, 0.1, 0.5, 1].map(function (x) { return '<button class="qt-nudge" data-n="' + x + '">' + (x > 0 ? '+' : '−') + Math.abs(x) + '%</button>'; }).join('') + '</div>' +
      '<label class="qx-f" style="margin-top:14px">Implied volatility: <b style="color:#fff" id="qt-ivt">' + Math.round(v * 100) + '%</b><input id="qt-iv" type="range" min="0.05" max="1.2" step="0.01" value="' + v + '"></label>' +
      (p.entry_spot ? '<button class="qx-btn2" id="qt-solve" style="min-height:32px;margin-top:6px">Estimate IV from my entry price</button>' : '') +
      (totalDays > 0.02 ? '<label class="qx-f" style="margin-top:14px">What-if: move forward <b style="color:#fff" id="qt-wft">' + (whatIfDays ? whatIfDays.toFixed(1) + ' days' : 'now') + '</b><input id="qt-wf" type="range" min="0" max="' + totalDays.toFixed(2) + '" step="' + Math.max(0.01, totalDays / 100).toFixed(2) + '" value="' + whatIfDays + '"></label>' : '') +
      '</div></div>' +
      // greeks + risk + alerts
      '<div class="qx-grid qx-g3" style="margin-bottom:16px">' +
      '<div class="qx-card"><h3 style="margin-bottom:10px">Greeks <span class="qx-small qx-muted">(whole position)</span></h3><div class="qx-grid" style="grid-template-columns:1fr 1fr;gap:12px">' +
      [['Delta', 'gd', 'Like holding this many shares'], ['Gamma', 'gg', 'Delta change per $1 move'], ['Theta', 'gt', 'Per day from time decay'], ['Vega', 'gv', 'Per 1-point IV change']].map(function (g) { return '<div><div class="qx-label">' + g[0] + '</div><div style="font-size:22px;font-weight:700;font-family:\'Barlow Semi Condensed\',Barlow,sans-serif"><span class="qt-v" data-k="' + g[1] + '" id="qt-' + g[1] + '"></span></div><div class="qx-small qx-muted">' + g[2] + '</div></div>'; }).join('') + '</div></div>' +
      '<div class="qx-card"><h3 style="margin-bottom:10px">Risk map</h3><div id="qt-risk"></div></div>' +
      '<div class="qx-card" id="qt-alertcard"><div class="qx-row qx-sp"><h3>Targets &amp; alerts</h3><label class="qx-small" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="qt-sound"' + (sound ? ' checked' : '') + ' style="width:16px;min-height:16px;height:16px;accent-color:#38BDF8">Sound</label></div>' +
      '<div class="qx-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label class="qx-f">Take profit at (+$)<input id="qt-tp" type="number" min="0" value="' + (tp != null ? tp : '') + '"></label><label class="qx-f">Stop at (−$)<input id="qt-sl" type="number" min="0" value="' + (sl != null ? sl : '') + '"></label><label class="qx-f">Price above<input id="qt-pa" type="number" step="any" value="' + (al.pa != null ? al.pa : '') + '"></label><label class="qx-f">Price below<input id="qt-pb" type="number" step="any" value="' + (al.pb != null ? al.pb : '') + '"></label></div>' +
      '<div id="qt-alerts" style="margin-top:10px;display:flex;flex-direction:column;gap:8px"></div></div>' +
      '</div>' +
      '<div class="qx-card" style="margin-bottom:16px"><div class="qx-row qx-sp" style="margin-bottom:8px"><h3>P/L map: price × time</h3><span class="qx-small qx-muted">Estimated P/L if the price is at each level at each time.</span></div><div class="qx-wrapx" id="qt-heat">' + heat(p, S, v, A) + '</div></div>' +
      '<p class="qx-small qx-muted">Estimates from a Black-Scholes model using the price and IV you entered, a ' + (R * 100) + '% rate and expiration at 4:00 PM ET. Your broker’s numbers will differ, especially for wide bid/ask spreads and early in the day. This describes the position; it isn’t a recommendation.</p>' +
      '<style>@media (max-width:900px){#qt-g1{grid-template-columns:1fr !important}}</style>';
    wire(p, A, C);
    update(true);
  }
  function wire(p, A, C) {
    var setSpot = function (x, save) { if (!(x > 0)) return; p.spot = Math.round(x * 100) / 100; if (save) { p.spot_at = new Date().toISOString(); persist(p, ['spot', 'spot_at']); } detail(); };
    document.getElementById('qt-setspot').onclick = function () { setSpot(Number(document.getElementById('qt-spot').value), true); };
    document.getElementById('qt-spot').onkeydown = function (e) { if (e.key === 'Enter') setSpot(Number(e.target.value), true); };
    var sl = document.getElementById('qt-slide'); sl.oninput = function () { p.spot = Number(sl.value); document.getElementById('qt-spot').value = p.spot.toFixed(2); update(false, true); }; sl.onchange = function () { setSpot(Number(sl.value), true); };
    el.querySelectorAll('.qt-nudge').forEach(function (b) { b.onclick = function () { setSpot(p.spot * (1 + Number(b.getAttribute('data-n')) / 100), true); }; });
    var iv = document.getElementById('qt-iv'); iv.oninput = function () { p.iv = Number(iv.value); document.getElementById('qt-ivt').textContent = Math.round(p.iv * 100) + '%'; update(false, true); }; iv.onchange = function () { persist(p, ['iv']); detail(); };
    var wf = document.getElementById('qt-wf'); if (wf) { wf.oninput = function () { whatIfDays = Number(wf.value); document.getElementById('qt-wft').textContent = whatIfDays ? whatIfDays.toFixed(1) + ' days' : 'now'; update(false, true); }; wf.onchange = function () { detail(); }; }
    var so = document.getElementById('qt-solve'); if (so) so.onclick = function () {
      var T0 = Math.max(1e-6, (expiryMs(p.expiration) - new Date(p.created_at || Date.now()).getTime()) / YEAR), target = Math.abs(p.entry_price) * units(p) * 100, lo = 0.02, hi = 2.5;
      var f = function (s) { return Math.abs(valueAt(p, p.entry_spot, T0, s).p) - target; };
      if (f(lo) * f(hi) > 0) { alert('Couldn’t match your entry price with these strikes and that underlying price.'); return; }
      for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      p.iv = Math.round((lo + hi) / 2 * 1000) / 1000; persist(p, ['iv']); detail();
    };
    var saveAlerts = function () { var g = function (id) { var x = document.getElementById(id).value; return x === '' ? null : Number(x); }; p.alerts = { tp: g('qt-tp'), sl: g('qt-sl'), pa: g('qt-pa'), pb: g('qt-pb') }; firedAlerts = {}; persist(p, ['alerts']); update(true); };
    ['qt-tp', 'qt-sl', 'qt-pa', 'qt-pb'].forEach(function (id) { document.getElementById(id).onchange = saveAlerts; });
    document.getElementById('qt-sound').onchange = function (e) { sound = e.target.checked; if (sound) beep(660, 0.08); };
    document.getElementById('qt-edit').onclick = function () { form(p); };
    document.getElementById('qt-del').onclick = function () { if (!confirm('Delete this position from the tracker?')) return; remove(p, 'delete'); };
    document.getElementById('qt-close').onclick = function () { remove(p, 'close'); };
    // hover
    var svg = document.getElementById('qt-svg'), hit = document.getElementById('qt-hit'), tip = document.getElementById('qt-tip'), hx = document.getElementById('qt-hx');
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * C.W, A2 = analyze(p, p.spot, yearsLeft(p, whatIfDays), p.iv);
      var S = A2.lo + (x - C.pl) / (C.W - C.pl - C.pr) * (A2.hi - A2.lo); S = Math.max(A2.lo, Math.min(A2.hi, S));
      var n = valueAt(p, S, yearsLeft(p, whatIfDays), p.iv).pnl, ex = expiryPnl(p, S);
      hx.setAttribute('x1', x); hx.setAttribute('x2', x); hx.style.display = '';
      tip.style.display = 'block'; tip.innerHTML = 'At <b>' + fpx(S) + '</b> (' + ((S / p.spot - 1) * 100).toFixed(2) + '%)<br><span style="color:#F0C766">Now: <b>' + m2(n, true) + '</b></span><br><span style="color:#7DD3FC">Expiration: <b>' + m2(ex, true) + '</b></span>';
      tip.style.left = Math.min(r.width - 180, Math.max(0, e.clientX - r.left + 14)) + 'px';
    });
    hit.addEventListener('pointerleave', function () { tip.style.display = 'none'; hx.style.display = 'none'; });
  }
  function flashSet(id, key, text, num) {
    var n = document.getElementById(id); if (!n) return;
    if (n.textContent !== text) {
      var old = prev[key]; n.textContent = text;
      if (old != null && num != null && Math.abs(num - old) > 1e-9) { n.classList.remove('qt-up', 'qt-dn'); void n.offsetWidth; n.classList.add(num > old ? 'qt-up' : 'qt-dn'); }
    }
    if (num != null) prev[key] = num;
  }
  var lastHeat = 0, lastChart = 0;
  function update(full, interactive) {
    var p = cur; if (!p || !document.getElementById('qt-pnl')) return;
    var S = p.spot, T = yearsLeft(p, whatIfDays), v = p.iv, V = valueAt(p, S, T, v), A = analyze(p, S, T, v), u = units(p) * 100;
    flashSet('qt-pnl', 'pnl', m2(V.pnl, true), V.pnl);
    var pnlEl = document.getElementById('qt-pnl'); pnlEl.style.color = V.pnl < 0 ? '#FF7A8A' : '#57E3B5'; pnlEl.style.textShadow = '0 0 22px ' + (V.pnl < 0 ? 'rgba(255,122,138,.55)' : 'rgba(87,227,181,.55)');
    var risk = isFinite(A.maxL) && A.maxL < 0 ? -A.maxL : Math.abs(p.entry_price) * u;
    flashSet('qt-ret', 'ret', (V.pnl / risk * 100).toFixed(1) + '% on risk', V.pnl);
    var capT = '', capW = 0;
    if (V.pnl < 0 && isFinite(A.maxL) && A.maxL < 0) { capW = Math.max(0, Math.min(100, V.pnl / A.maxL * 100)); capT = Math.round(V.pnl / A.maxL * 100) + '% of max loss (' + Q.money(A.maxL, true) + ')'; }
    else if (isFinite(A.maxP) && A.maxP > 0) { capW = Math.max(0, Math.min(100, V.pnl / A.maxP * 100)); capT = Math.max(0, Math.round(V.pnl / A.maxP * 100)) + '% of max profit (' + Q.money(A.maxP, true) + ')'; } else capT = 'Max profit: unlimited';
    var cb = document.getElementById('qt-capbar'); cb.style.background = V.pnl < 0 ? 'linear-gradient(90deg,#F0C766,#FF7A8A)' : ''; cb.style.boxShadow = V.pnl < 0 ? '0 0 14px rgba(255,122,138,.5)' : '';
    document.getElementById('qt-capbar').style.width = capW + '%'; document.getElementById('qt-cap').textContent = capT;
    // POP ring
    var c = 2 * Math.PI * 46, arc = document.getElementById('qt-pop-arc'); if (arc) { arc.setAttribute('stroke-dashoffset', (c * (1 - A.pop)).toFixed(1)); var col = A.pop >= 0.6 ? '#57E3B5' : A.pop >= 0.4 ? '#F0C766' : '#FF7A8A'; arc.setAttribute('stroke', col); arc.parentNode.style.setProperty('--c', col + '88'); }
    flashSet('qt-pop-t', 'pop', (A.pop * 100).toFixed(1) + '%', A.pop);
    flashSet('qt-pmax', 'pmax', (A.pmax * 100).toFixed(1) + '%', A.pmax);
    var left = expiryMs(p.expiration) - Date.now(); document.getElementById('qt-cd').textContent = countdown(left);
    flashSet('qt-thm', 'thm', m2(V.t / 1440, true), V.t);
    document.getElementById('qt-thm').className = 'qt-v ' + (V.t >= 0 ? 'qx-gain' : 'qx-loss');
    flashSet('qt-spotv', 'spot', fpx(S), S);
    document.getElementById('qt-stale').textContent = 'You entered this price ' + ago(p.spot_at || p.created_at || Date.now());
    document.getElementById('qt-stale').style.color = (Date.now() - new Date(p.spot_at || Date.now()).getTime()) > 15 * 60000 ? '#F0C766' : '';
    document.getElementById('qt-em').textContent = '±' + fpx(A.sd) + ' (' + (A.sd / S * 100).toFixed(2) + '%)';
    flashSet('qt-gd', 'gd', (V.d >= 0 ? '+' : '') + V.d.toFixed(1), V.d);
    flashSet('qt-gg', 'gg', V.g.toFixed(3), V.g);
    flashSet('qt-gt', 'gt', m2(V.t, true), V.t);
    flashSet('qt-gv', 'gv', m2(V.v, true), V.v);
    // risk map
    var rk = '<div style="display:flex;flex-direction:column;gap:10px">';
    shorts(p).forEach(function (l) { var dist = l.type === 'put' ? S - l.strike : l.strike - S, sds = A.sd > 0 ? dist / A.sd : dist > 0 ? 9 : -9, pct = Math.max(0, Math.min(100, (sds / 3) * 100)), col = sds < 0 ? '#FF7A8A' : sds < 0.75 ? '#F0C766' : '#57E3B5', itm = dist < 0;
      var pIt = l.type === 'put' ? probRange(S, T, v, 0, l.strike) : probRange(S, T, v, l.strike, Infinity);
      rk += '<div><div class="qx-row qx-sp qx-small"><span>Short ' + fstrike(l.strike) + (l.type === 'call' ? 'C' : 'P') + (itm ? ' <b class="qx-loss">in the money</b>' : '') + '</span><b style="color:' + col + '">' + (dist >= 0 ? '' : '−') + fpx(Math.abs(dist)) + ' away · ' + (A.sd > 0 ? sds.toFixed(2) + 'σ' : '') + '</b></div><div class="qx-bar" style="margin-top:4px"><i style="width:' + pct + '%;background:' + col + ';box-shadow:0 0 12px ' + col + '"></i></div><div class="qx-small qx-muted" style="margin-top:2px">Chance it finishes in the money: ' + (pIt * 100).toFixed(1) + '% · touch chance ≈ ' + Math.min(100, pIt * 200).toFixed(0) + '%</div></div>'; });
    rk += '<div class="qx-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:4px"><div><div class="qx-label">Max profit</div><b class="qx-gain">' + (isFinite(A.maxP) ? Q.money(A.maxP, true) : 'Unlimited') + '</b></div><div><div class="qx-label">Max loss</div><b class="qx-loss">' + (isFinite(A.maxL) ? Q.money(A.maxL, true) : 'Unlimited') + '</b></div><div><div class="qx-label">Breakevens</div><b>' + (A.be.length ? A.be.map(fpx).join(' / ') : '—') + '</b></div><div><div class="qx-label">Reward : risk</div><b>' + (isFinite(A.maxP) && isFinite(A.maxL) && A.maxL < 0 ? (A.maxP / -A.maxL).toFixed(2) + ' : 1' : '—') + '</b></div></div></div>';
    var rbox = document.getElementById('qt-risk'); if (rbox.innerHTML !== rk) rbox.innerHTML = rk;
    // alerts
    var al = p.alerts || {}, tpv = Number(document.getElementById('qt-tp').value), slv = Number(document.getElementById('qt-sl').value), pav = document.getElementById('qt-pa').value, pbv = document.getElementById('qt-pb').value, rows = [], hit = null;
    var real = valueAt(p, S, yearsLeft(p), v).pnl;
    var row = function (name, ok, txt, prog, col) { return '<div><div class="qx-row qx-sp qx-small"><span>' + name + '</span><b style="color:' + col + '">' + txt + '</b></div><div class="qx-bar" style="margin-top:4px"><i style="width:' + Math.max(0, Math.min(100, prog)) + '%;background:' + col + ';box-shadow:0 0 12px ' + col + '"></i></div></div>'; };
    if (tpv > 0) { var pr = real / tpv * 100; rows.push(row('Take profit +$' + tpv, pr >= 100, Math.max(0, Math.round(pr)) + '%', pr, pr >= 100 ? '#F0C766' : '#57E3B5')); if (pr >= 100) hit = hit || { k: 'tp', kind: 'goal', msg: 'Take-profit reached: estimated P/L ' + m2(real, true) + ' (target +$' + tpv + ').' }; }
    if (slv > 0) { var ps = -real / slv * 100; rows.push(row('Stop −$' + slv + (maxLossRule() === slv ? ' <span class="qx-chip" style="padding:0 6px;font-size:10px">My Rules</span>' : ''), ps >= 100, Math.max(0, Math.round(ps)) + '%', ps, ps >= 100 ? '#FF7A8A' : ps >= 70 ? '#F0C766' : '#7DD3FC')); if (ps >= 100) hit = { k: 'sl', kind: 'stop', msg: 'Stop level hit: estimated P/L ' + m2(real, true) + ' (stop −$' + slv + ').' }; }
    if (pav !== '' && S >= Number(pav)) hit = hit || { k: 'pa', kind: 'stop', msg: 'Price alert: ' + p.underlying + ' is at or above ' + pav + '.' };
    if (pbv !== '' && S <= Number(pbv)) hit = hit || { k: 'pb', kind: 'stop', msg: 'Price alert: ' + p.underlying + ' is at or below ' + pbv + '.' };
    var abox = document.getElementById('qt-alerts'), ah = rows.join('') || '<p class="qx-small qx-muted" style="margin:0">Set a target or stop to track it here.</p>'; if (abox.innerHTML !== ah) abox.innerHTML = ah;
    var card = document.getElementById('qt-alertcard'), ban = document.getElementById('qt-banner');
    card.classList.toggle('qt-alarm', !!hit && hit.kind === 'stop'); card.classList.toggle('qt-goal', !!hit && hit.kind === 'goal');
    if (hit && !interactive) { ban.style.display = ''; ban.className = 'qx-card ' + (hit.kind === 'goal' ? 'qt-goal' : 'qt-alarm'); ban.innerHTML = '<div class="qx-row qx-sp"><b style="font-size:16px;color:' + (hit.kind === 'goal' ? '#F0C766' : '#FF7A8A') + '">' + (hit.kind === 'goal' ? '🎯 ' : '⚠️ ') + E(hit.msg) + '</b><span class="qx-small qx-muted">Based on the price you entered. Check your broker before acting.</span></div>'; if (!firedAlerts[hit.k]) { firedAlerts[hit.k] = 1; if (sound) { beep(hit.kind === 'goal' ? 880 : 440, 0.25); setTimeout(function () { beep(hit.kind === 'goal' ? 1175 : 330, 0.25); }, 260); } blinkTitle(hit.kind === 'goal' ? '🎯 Target hit' : '⚠️ Alert'); } }
    else if (!hit) { ban.style.display = 'none'; }
    // redraw chart + heat periodically (theta moves them) or right away while dragging
    var now = Date.now();
    if (interactive || now - lastChart > 5000) { lastChart = now; var C = chartSvg(p, A, S, T, v), old = document.getElementById('qt-svg'); if (old) { var tmp = document.createElement('div'); tmp.innerHTML = C.svg; old.replaceWith(tmp.firstChild); rewireHover(p, C); } }
    if (interactive || now - lastHeat > 15000) { lastHeat = now; var hb = document.getElementById('qt-heat'); if (hb) hb.innerHTML = heat(p, S, v, A); }
    // strip
    positions.forEach(function (q, i) { var n = document.querySelector('[data-k="s' + i + '"]'); if (!n) return; var vv = valueAt(q, q.spot || q.legs[0].strike, yearsLeft(q), q.iv).pnl; if (n.textContent !== m2(vv, true)) { var o = prev['s' + i]; n.textContent = m2(vv, true); n.style.color = vv < 0 ? '#FF7A8A' : '#57E3B5'; if (o != null && o !== vv) { n.classList.remove('qt-up', 'qt-dn'); void n.offsetWidth; n.classList.add(vv > o ? 'qt-up' : 'qt-dn'); } } prev['s' + i] = vv; var cd = document.querySelector('[data-k="c' + i + '"]'); if (cd) cd.textContent = countdown(expiryMs(q.expiration) - Date.now()) + ' left'; });
    var ms = marketStatus(), mk = document.getElementById('qt-mkt'); if (mk) { mk.textContent = ms.txt; document.getElementById('qt-mdot').className = 'qt-dot' + (ms.open ? '' : ' off'); }
  }
  function rewireHover(p, C) {
    var svg = document.getElementById('qt-svg'), hit = document.getElementById('qt-hit'), tip = document.getElementById('qt-tip'), hx = document.getElementById('qt-hx');
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * C.W, A2 = analyze(p, p.spot, yearsLeft(p, whatIfDays), p.iv);
      var S = A2.lo + (x - C.pl) / (C.W - C.pl - C.pr) * (A2.hi - A2.lo); S = Math.max(A2.lo, Math.min(A2.hi, S));
      hx.setAttribute('x1', x); hx.setAttribute('x2', x); hx.style.display = '';
      tip.style.display = 'block'; tip.innerHTML = 'At <b>' + fpx(S) + '</b> (' + ((S / p.spot - 1) * 100).toFixed(2) + '%)<br><span style="color:#F0C766">Now: <b>' + m2(valueAt(p, S, yearsLeft(p, whatIfDays), p.iv).pnl, true) + '</b></span><br><span style="color:#7DD3FC">Expiration: <b>' + m2(expiryPnl(p, S), true) + '</b></span>';
      tip.style.left = Math.min(r.width - 180, Math.max(0, e.clientX - r.left + 14)) + 'px';
    });
    hit.addEventListener('pointerleave', function () { tip.style.display = 'none'; hx.style.display = 'none'; });
  }
  var actx = null;
  function beep(f, dur) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); var o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.18, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur + 0.05); } catch (e) {} }
  var titleT = null, baseTitle = document.title;
  function blinkTitle(msg) { clearInterval(titleT); var n = 0; titleT = setInterval(function () { document.title = n % 2 ? baseTitle : msg; if (++n > 11) { clearInterval(titleT); document.title = baseTitle; } }, 800); }
  function remove(p, why) {
    var i = positions.indexOf(p); positions.splice(i, 1); cur = positions[0] || null; prev = {};
    if (!p.sample) { if (store === 'local') lsSave(); else if (why === 'delete') d.sb.from('positions').delete().eq('id', p.id); else d.sb.from('positions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', p.id); }
    renderAll();
    if (why === 'close' && !p.sample) { var n = document.createElement('div'); n.className = 'qx-note'; n.style.marginBottom = '12px'; n.innerHTML = 'Marked as closed. <a href="import.html" style="color:#7DD3FC">Import your broker CSV</a> later to log the final P/L in your journal.'; el.firstChild.prepend(n); }
  }

  /* ---------- add / edit form ---------- */
  function form(edit) {
    var p = edit || null;
    var opts = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '"' + (p && p.strategy === k ? ' selected' : '') + '>' + PRESETS[k][0] + '</option>'; }).join('');
    var b = document.createElement('div'); b.className = 'qx-modal-back qx';
    var tom = new Date(); tom.setDate(tom.getDate() + (tom.getDay() === 5 ? 3 : tom.getDay() === 6 ? 2 : 0));
    b.innerHTML = '<div class="qx-modal" role="dialog" aria-modal="true" style="width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto"><h2>' + (p ? 'Edit position' : 'Add an open position') + '</h2><p class="qx-small qx-muted" style="margin:2px 0 12px">Pick a strategy and enter the price; strikes fill in and you can adjust them.</p>' +
      '<div class="qx-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">' +
      '<label class="qx-f">Ticker<input id="f-sym" maxlength="8" value="' + E(p ? p.underlying : 'SPX') + '"></label>' +
      '<label class="qx-f">Underlying price now<input id="f-spot" type="number" step="any" value="' + (p && p.spot ? p.spot : '') + '" placeholder="5900"></label>' +
      '<label class="qx-f">Strategy<select id="f-k">' + opts + '</select></label>' +
      '<label class="qx-f">Spread width<input id="f-w" type="number" step="any" value="10"></label>' +
      '<label class="qx-f">Expiration<input id="f-exp" type="date" value="' + (p ? E(p.expiration) : Q.dayKey(tom)) + '"></label>' +
      '<label class="qx-f">Contracts<input id="f-qty" type="number" min="1" value="' + (p ? units(p) : 1) + '"></label>' +
      '<label class="qx-f">Entry price<input id="f-px" type="number" step="0.01" min="0" value="' + (p ? Math.abs(p.entry_price).toFixed(2) : '') + '" placeholder="1.60"></label>' +
      '<label class="qx-f">Credit or debit<select id="f-cd"><option value="credit"' + (!p || p.entry_price >= 0 ? ' selected' : '') + '>Credit (received)</option><option value="debit"' + (p && p.entry_price < 0 ? ' selected' : '') + '>Debit (paid)</option></select></label>' +
      '<label class="qx-f">IV (%)<input id="f-iv" type="number" step="0.1" min="1" value="' + (p ? (p.iv * 100).toFixed(1) : 16) + '"></label></div>' +
      '<h3 style="margin:16px 0 8px">Legs</h3><div id="f-legs"></div><button class="qx-btn2" id="f-addleg" style="min-height:32px">+ Add leg</button>' +
      '<p class="qx-small qx-muted" id="f-msg" style="min-height:18px;margin:10px 0 0"></p>' +
      '<div class="qx-row" style="margin-top:8px"><button class="qx-btn" id="f-save">' + (p ? 'Save changes' : 'Start tracking') + '</button><button class="qx-btn2" id="f-cancel">Cancel</button></div></div>';
    document.body.appendChild(b);
    var legs = p ? p.legs.map(function (l) { return { act: l.n < 0 ? 'sell' : 'buy', qty: Math.abs(l.n), type: l.type, strike: l.strike }; }) : [];
    var drawLegs = function () {
      document.getElementById('f-legs').innerHTML = legs.map(function (l, i) { return '<div class="qt-leg"><select data-i="' + i + '" data-f="act"><option value="sell"' + (l.act === 'sell' ? ' selected' : '') + '>Sell</option><option value="buy"' + (l.act === 'buy' ? ' selected' : '') + '>Buy</option></select><input data-i="' + i + '" data-f="qty" type="number" min="1" value="' + l.qty + '" aria-label="Ratio"><select data-i="' + i + '" data-f="type"><option value="put"' + (l.type === 'put' ? ' selected' : '') + '>Put</option><option value="call"' + (l.type === 'call' ? ' selected' : '') + '>Call</option></select><input data-i="' + i + '" data-f="strike" type="number" step="any" value="' + l.strike + '" placeholder="Strike" aria-label="Strike"><button class="qt-nudge" data-rm="' + i + '" style="min-width:34px" aria-label="Remove leg">✕</button></div>'; }).join('');
      b.querySelectorAll('#f-legs [data-f]').forEach(function (x) { x.onchange = function () { var l = legs[+x.getAttribute('data-i')], f = x.getAttribute('data-f'); l[f] = f === 'qty' || f === 'strike' ? Number(x.value) : x.value; }; });
      b.querySelectorAll('[data-rm]').forEach(function (x) { x.onclick = function () { legs.splice(+x.getAttribute('data-rm'), 1); drawLegs(); }; });
    };
    var preset = function () { var k = document.getElementById('f-k').value, S = Number(document.getElementById('f-spot').value), w = Number(document.getElementById('f-w').value) || 10, sym = document.getElementById('f-sym').value.trim().toUpperCase(); if (!(S > 0) && k !== 'other') { legs = PRESETS[k][1](0, w, 1).map(function (x) { return { act: x[0], type: x[1], strike: '', qty: x[3] || 1 }; }); } else legs = PRESETS[k][1](S, w, STEP(sym, S)).map(function (x) { return { act: x[0], type: x[1], strike: x[2], qty: x[3] || 1 }; }); var iv = document.getElementById('f-iv'); if (!p && !iv.dataset.touched) iv.value = INDEX[sym] ? 16 : 35; drawLegs(); };
    if (!p) preset(); else drawLegs();
    document.getElementById('f-k').onchange = preset; document.getElementById('f-w').onchange = preset; document.getElementById('f-spot').onchange = function () { if (!p) preset(); }; document.getElementById('f-sym').onchange = function () { if (!p) preset(); };
    document.getElementById('f-iv').oninput = function (e) { e.target.dataset.touched = '1'; };
    document.getElementById('f-addleg').onclick = function () { legs.push({ act: 'buy', qty: 1, type: 'put', strike: '' }); drawLegs(); };
    document.getElementById('f-cancel').onclick = function () { b.remove(); };
    document.getElementById('f-save').onclick = function () {
      var msg = document.getElementById('f-msg'), sym = document.getElementById('f-sym').value.trim().toUpperCase().replace(/[^A-Z0-9.$^]/g, ''), S = Number(document.getElementById('f-spot').value), px = Number(document.getElementById('f-px').value), exp = document.getElementById('f-exp').value, qty = Math.max(1, Math.round(Number(document.getElementById('f-qty').value) || 1)), iv = Number(document.getElementById('f-iv').value) / 100;
      var L = legs.filter(function (l) { return Number(l.strike) > 0; }).map(function (l) { return { type: l.type, strike: Number(l.strike), n: (l.act === 'sell' ? -1 : 1) * Math.max(1, Number(l.qty) || 1) }; });
      if (!sym) { msg.textContent = 'Enter a ticker.'; return; } if (!(S > 0)) { msg.textContent = 'Enter the underlying price.'; return; } if (!L.length) { msg.textContent = 'Add at least one leg with a strike.'; return; } if (!(px >= 0)) { msg.textContent = 'Enter your entry price.'; return; } if (!exp) { msg.textContent = 'Pick an expiration date.'; return; } if (expiryMs(exp) < Date.now() - 864e5) { msg.textContent = 'That expiration has already passed.'; return; } if (!(iv > 0)) { msg.textContent = 'Enter an IV, like 16 for 16%.'; return; }
      var cd = document.getElementById('f-cd').value, entry = cd === 'credit' ? px : -px;
      if (p) { Object.assign(p, { underlying: sym, strategy: document.getElementById('f-k').value, legs: L, expiration: exp, entry_price: entry, contracts: qty, iv: iv, spot: S, spot_at: new Date().toISOString() }); persist(p, ['underlying', 'strategy', 'legs', 'expiration', 'entry_price', 'contracts', 'iv', 'spot', 'spot_at']); b.remove(); prev = {}; renderAll(); return; }
      var np = { id: 'loc' + Date.now(), underlying: sym, strategy: document.getElementById('f-k').value, legs: L, expiration: exp, entry_price: entry, contracts: qty, iv: iv, spot: S, entry_spot: S, spot_at: new Date().toISOString(), created_at: new Date().toISOString(), alerts: {} };
      positions = positions.filter(function (x) { return !x.sample; }); positions.push(np); cur = np; prev = {}; b.remove();
      if (store === 'db') insert(np); else lsSave();
      renderAll();
    };
  }

  /* ---------- open trades from imports ---------- */
  function imports() {
    var box = document.getElementById('qt-imports'); if (!box || d.demo) return;
    var byT = {}; d.fills.forEach(function (f) { (byT[f.trade_id] = byT[f.trade_id] || []).push(f); });
    var tracked = {}; positions.forEach(function (p) { if (p.trade_id) tracked[p.trade_id] = 1; });
    var open = d.lite.filter(function (t) { return !t.c && byT[t.id] && !tracked[t.id]; });
    if (!open.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="qx-card"><h3 style="margin-bottom:8px">Open trades from your imports</h3><p class="qx-small qx-muted" style="margin:0 0 10px">These were still open in your last broker file. Track one to fill in its legs automatically.</p><table class="qx-table"><tbody>' + open.slice(0, 10).map(function (t) { return '<tr><td><b>' + E(t.sym) + '</b> ' + E(t.name) + '</td><td class="qx-muted">opened ' + Q.fdate(t.o, true) + '</td><td class="r"><button class="qx-btn2" data-tr="' + E(t.id) + '" style="min-height:32px">Track</button></td></tr>'; }).join('') + '</tbody></table></div>';
    box.querySelectorAll('[data-tr]').forEach(function (bt) { bt.onclick = function () {
      var t = open.filter(function (x) { return String(x.id) === bt.getAttribute('data-tr'); })[0], fl = (byT[t.id] || []).slice().sort(function (a, b2) { return new Date(a.executed_at) - new Date(b2.executed_at); }), ops = fl.filter(function (f) { return f.action === 'BTO' || f.action === 'STO'; });
      if (!ops.length) return; var t0 = ops[0].executed_at, first = ops.filter(function (f) { return f.executed_at === t0; }), raw = d.raw.filter(function (r) { return r.id === t.id; })[0] || {}, u = Number(raw.quantity) || 1;
      var p = { id: 'loc' + Date.now(), underlying: t.sym, strategy: t.k, trade_id: t.id, legs: first.map(function (f) { return { type: f.option_type === 'call' ? 'call' : 'put', strike: Number(f.strike), n: (f.action === 'STO' ? -1 : 1) * Math.abs(Number(f.quantity) || 1) / u }; }), expiration: String(first[0].expiration || '').slice(0, 10), entry_price: Number(raw.entry_price) || 0, contracts: u, iv: INDEX[t.sym] ? 0.16 : 0.35, spot: null, alerts: {}, created_at: raw.opened_at };
      p.spot = p.legs.reduce(function (s, l) { return s + l.strike; }, 0) / p.legs.length; p.spot_at = null;
      form(p); var save = document.getElementById('f-save'); save.textContent = 'Start tracking'; document.getElementById('f-spot').value = ''; document.getElementById('f-spot').focus();
      save.onclick = (function (orig) { return function () { var S = Number(document.getElementById('f-spot').value); if (!(S > 0)) { document.getElementById('f-msg').textContent = 'Enter the underlying price now.'; return; } p.spot = S; p.entry_spot = null; p.spot_at = new Date().toISOString(); p.iv = Number(document.getElementById('f-iv').value) / 100 || p.iv; positions = positions.filter(function (x) { return !x.sample; }); positions.push(p); cur = p; prev = {}; document.querySelector('.qx-modal-back').remove(); if (store === 'db') insert(p); else lsSave(); renderAll(); }; })();
    }; });
  }

  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1]; css();
    load().then(function () {
      var want = null; try { want = new URLSearchParams(location.search).get('trade'); } catch (e) {}
      cur = positions[0] || null;
      if (want) { var hitP = positions.filter(function (p) { return String(p.trade_id) === want; })[0]; if (hitP) cur = hitP; }
      renderAll();
      tick = setInterval(function () { if (!document.querySelector('.qx-modal-back')) update(false); }, 1000);
    });
  });
})();
