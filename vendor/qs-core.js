/* Quillstrike shared core for Discipline, Session, Plans, Payoff replay, Trader DNA, Wrapped and Ask.
   Loads the signed-in trader's trades, fills and rules, checks rules the same way My Rules does,
   and computes the discipline score and trader profile. Everything runs in the browser. */
(function () {
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var CREDIT = { pcs: 1, ccs: 1, ic: 1, ifly: 1, short_put: 1, short_call: 1, sstrad: 1, sstrang: 1, ratio: 1 };
  var DEBIT = { pds: 1, cds: 1, long_call: 1, long_put: 1, lstrad: 1, lstrang: 1, cal: 1, dcal: 1, diag: 1, ddiag: 1 };
  var FLY = { fly: 1, bwb: 1, condor: 1 };
  var RULE_NAMES = { max_loss: 'Max loss per trade', no_before: 'No entries before', max_trades: 'Max trades per day', max_size: 'Max contracts per trade', cool_off: 'Cool-off after a loss', loss_streak: 'Stop after losses in a day', custom: 'Custom rule' };
  var DEFAULTS = { max_loss: 300, no_before: '10:00', max_trades: 2, max_size: 1, cool_off: 60, loss_streak: 2 };
  var CHECKABLE = { max_loss: 1, no_before: 1, max_trades: 1, max_size: 1, cool_off: 1, loss_streak: 1 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, plus) { var a = Math.abs(Math.round(n || 0)).toLocaleString('en-US'); return (n < 0 ? '−$' : (plus && n > 0 ? '+$' : '$')) + a; }
  function pct(n) { return n == null || isNaN(n) ? '—' : Math.round(n) + '%'; }
  function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fdate(d, yr) { return MS[d.getMonth()] + ' ' + d.getDate() + (yr ? ', ' + d.getFullYear() : ''); }
  function hourLabel(h) { var s = h < 12 ? 'AM' : 'PM', x = h % 12 || 12; return x + ' ' + s; }
  function minsOf(s) { var m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }
  function holdText(m) { if (m == null || isNaN(m)) return '—'; if (m < 60) return Math.round(m) + ' min'; if (m < 60 * 24) return (m / 60).toFixed(m < 600 ? 1 : 0) + ' hr'; return (m / 1440).toFixed(1) + ' days'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* ---------- styles shared by every new page (Night Glow) ---------- */
  var CSS = '' +
    '.qx{font-family:Barlow,system-ui,sans-serif;color:#EEF3FA;font-size:14px;line-height:1.5}' +
    '.qx h2,.qx h3{font-family:"Barlow Semi Condensed",Barlow,sans-serif;margin:0;color:#fff;letter-spacing:0}' +
    '.qx h2{font-size:20px;font-weight:600}.qx h3{font-size:16px;font-weight:600}' +
    '.qx-card{position:relative;border:1px solid #21304A;border-radius:12px;padding:18px 20px;background:rgba(12,19,31,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(143,211,255,.10),0 0 0 1px rgba(94,200,255,.06),0 24px 70px -36px rgba(56,140,255,.55);min-width:0;box-sizing:border-box}' +
    '.qx-grid{display:grid;gap:16px}.qx-g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}.qx-g3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.qx-g4{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}' +
    '.qx-muted{color:#9AACC1}.qx-small{font-size:12px}.qx-gain{color:#57E3B5;text-shadow:0 0 16px rgba(87,227,181,.35)}.qx-loss{color:#FF7A8A;text-shadow:0 0 16px rgba(255,122,138,.3)}.qx-gold{color:#F0C766}.qx-blue{color:#7DD3FC}' +
    '.qx-kpi{font-family:"Barlow Semi Condensed",Barlow,sans-serif;font-size:30px;font-weight:700;line-height:1.1;color:#fff}' +
    '.qx-label{font-size:12px;font-weight:600;color:#9AACC1;text-transform:uppercase;letter-spacing:.06em}' +
    '.qx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 16px;border:none;border-radius:8px;background-image:linear-gradient(180deg,#F0C766,#D8B25A);color:#05080D;font:700 14px Barlow,system-ui,sans-serif;cursor:pointer;text-decoration:none;box-shadow:0 0 0 1px rgba(255,214,120,.55) inset,0 0 24px rgba(227,179,65,.4)}' +
    '.qx-btn:hover{box-shadow:0 0 0 1px rgba(255,214,120,.9) inset,0 0 34px rgba(227,179,65,.65);color:#05080D}.qx-btn[disabled]{opacity:.45;cursor:not-allowed;box-shadow:none}' +
    '.qx-btn2{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid rgba(56,189,248,.5);border-radius:8px;background:rgba(12,19,31,.6);color:#E0F2FE;font:600 14px Barlow,system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
    '.qx-btn2:hover{border-color:#7DD3FC;color:#fff;box-shadow:0 0 18px rgba(56,189,248,.25)}.qx-btn2[disabled]{opacity:.45;cursor:not-allowed}' +
    '.qx input,.qx select,.qx textarea{box-sizing:border-box;min-height:40px;padding:8px 10px;border:1px solid #21304A;border-radius:8px;background:#070B12;color:#EEF3FA;font:500 14px Barlow,system-ui,sans-serif;width:100%}' +
    '.qx textarea{min-height:70px;resize:vertical}.qx input:focus,.qx select:focus,.qx textarea:focus{outline:none;border-color:#38BDF8;box-shadow:0 0 0 2px rgba(56,189,248,.25)}' +
    '.qx label.qx-f{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#AFBFD1}' +
    '.qx-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid #21304A;background:#0C1420;color:#C7D3E1}' +
    '.qx-chip.ok{border-color:rgba(87,227,181,.45);color:#57E3B5;background:rgba(87,227,181,.08)}.qx-chip.bad{border-color:rgba(255,122,138,.45);color:#FF7A8A;background:rgba(255,122,138,.08)}.qx-chip.gold{border-color:rgba(240,199,102,.5);color:#F0C766;background:rgba(240,199,102,.08)}' +
    '.qx-note{padding:10px 14px;border-radius:10px;border:1px solid rgba(56,189,248,.35);background:rgba(56,189,248,.07);color:#CFE8FA;font-size:13px}' +
    '.qx-bar{height:8px;border-radius:6px;background:#0A111C;overflow:hidden;border:1px solid #17233A}.qx-bar>i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#38BDF8,#7DD3FC);box-shadow:0 0 14px rgba(56,189,248,.5)}' +
    '.qx-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.qx-sp{justify-content:space-between}' +
    '.qx-table{width:100%;border-collapse:collapse;font-size:13px}.qx-table th{text-align:left;font-size:11px;font-weight:600;color:#9AACC1;padding:6px 8px;border-bottom:1px solid #1B283B}.qx-table td{padding:8px;border-bottom:1px solid #131E2E}.qx-table td.r,.qx-table th.r{text-align:right}' +
    '.qx-wrapx{overflow-x:auto}' +
    '.qx-tabs{display:flex;gap:2px;padding:3px;border-radius:8px;background:#070B12;border:1px solid #1A2638;width:max-content;max-width:100%;overflow-x:auto}.qx-tabs button{min-height:32px;padding:0 12px;border:none;border-radius:6px;background:transparent;color:#AFBFD1;font:600 13px Barlow,system-ui,sans-serif;cursor:pointer;white-space:nowrap}.qx-tabs button[aria-pressed="true"]{background:rgba(56,189,248,.18);color:#fff}' +
    '.qx-empty{text-align:center;padding:36px 20px;color:#9AACC1}' +
    '.qx-modal-back{position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,8,11,.75)}' +
    '.qx-modal{width:min(480px,100%);padding:24px;border-radius:14px;border:1px solid rgba(56,189,248,.55);background:linear-gradient(180deg,#101B2C,#0A111C);box-shadow:0 0 60px rgba(56,140,255,.3)}' +
    '@media (max-width:760px){.qx-kpi{font-size:24px}.qx-card{padding:14px}}';
  function injectCss() { if (document.getElementById('qx-css')) return; var s = document.createElement('style'); s.id = 'qx-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* Wait for the page shell to render, then hand back the mount element. */
  function mount(id) {
    injectCss();
    return new Promise(function (res) {
      var el = document.getElementById(id || 'qs-app'); if (el) { res(el); return; }
      var mo = new MutationObserver(function () { var e = document.getElementById(id || 'qs-app'); if (e) { mo.disconnect(); res(e); } });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  function mapRules(rows) {
    return (rows || []).map(function (r) { var pa = r.params || {}; return { id: r.id, kind: r.kind, on: !!r.active, val: pa.val != null ? pa.val : DEFAULTS[r.kind], tag: pa.tag || '', title: pa.title || '', since: r.created_at || null }; });
  }
  function sampleRules() { return ['max_loss', 'max_trades', 'cool_off', 'loss_streak'].map(function (k, i) { return { id: 'sample' + i, kind: k, on: true, val: DEFAULTS[k], since: null, sample: true }; }); }

  /* Load everything the new pages need. */
  var cache = null;
  function load(opts) {
    opts = opts || {};
    if (cache) return cache;
    cache = Promise.resolve(window.TJ_READY).then(function () {
      var sb = window.tj, s = window.TJ_SESSION;
      var out = { sb: sb, user: s ? s.user : null, profile: window.TJ_PROFILE || {}, raw: [], fills: [], rules: [], demo: false, sampleRules: false };
      if (!sb || !s) return out;
      var pR = sb.from('rules').select('id, kind, params, active, created_at').order('created_at', { ascending: true }).then(function (r) { out.rules = mapRules((r && r.data) || []); }, function () {});
      var pT = sb.from('trades').select('*').order('opened_at', { ascending: false }).limit(5000).then(function (tr) {
        var trades = (tr && tr.data) || [];
        if (!trades.length) return;
        out.raw = trades;
        var ids = trades.map(function (t) { return t.id; }), chunks = [];
        for (var i = 0; i < ids.length; i += 300) chunks.push(ids.slice(i, i + 300));
        return Promise.all(chunks.map(function (c) { return sb.from('fills').select('trade_id, executed_at, action, strike, option_type, quantity, price, expiration').in('trade_id', c).limit(20000).then(function (fr) { return (fr && fr.data) || []; }, function () { return []; }); }))
          .then(function (parts) { out.fills = [].concat.apply([], parts); });
      }, function () {});
      return Promise.all([pR, pT]).then(function () {
        if (!out.raw.length && window.QSDemo) { var dm = window.QSDemo.build(); out.raw = dm.trades; out.fills = dm.fills; out.demo = true; }
        out.lite = window.TJImport ? window.TJImport.toLite(out.raw, out.fills) : [];
        out.lite.sort(function (a, b) { return a.o - b.o; });
        if (!out.rules.filter(function (r) { return r.on; }).length && out.demo) { out.rules = sampleRules(); out.sampleRules = true; }
        return out;
      });
    });
    return cache;
  }

  /* Rule checks: identical logic to the My Rules page, plus per-day results. */
  function evaluate(rules, L) {
    var act = (rules || []).filter(function (x) { return x.on && (CHECKABLE[x.kind] || (x.kind === 'custom' && x.tag)); });
    var sorted = L.slice().sort(function (a, b) { return a.o - b.o; });
    var per = {}, idx = new Map();
    sorted.forEach(function (t) { var k = dayKey(t.o); per[k] = (per[k] || 0) + 1; idx.set(t, per[k]); });
    var broken = new Map(), checked = new Set(), perRule = {};
    act.forEach(function (ru) {
      var since = ru.since ? new Date(ru.since) : null, v = Number(ru.val);
      var st = { rule: ru, checked: 0, breaks: 0, folSum: 0, folN: 0, brkSum: 0, brkN: 0 };
      sorted.forEach(function (t) {
        var b = null;
        if (ru.kind === 'max_loss') { if (t.c) b = t.pnl < -Math.abs(v); }
        else if (ru.kind === 'no_before') { if (t.tk) { var lim = minsOf(ru.val); if (lim != null) b = t.o.getHours() * 60 + t.o.getMinutes() < lim; } }
        else if (ru.kind === 'max_trades') b = idx.get(t) > v;
        else if (ru.kind === 'max_size') b = (t.qty || 1) > v;
        else if (ru.kind === 'cool_off') { if (t.tk) b = sorted.some(function (p) { return p !== t && p.tk && p.c && p.pnl < 0 && p.c <= t.o && t.o - p.c < v * 60000; }); }
        else if (ru.kind === 'custom') { if (t.c) { var tg = String(ru.tag || '').toLowerCase(); b = (t.tags || []).some(function (g) { return String(g).toLowerCase() === tg; }); } }
        else if (ru.kind === 'loss_streak') { var dk = dayKey(t.o); b = sorted.filter(function (p) { return p !== t && p.c && p.pnl < 0 && dayKey(p.c) === dk && p.c <= t.o; }).length >= v; }
        if (b === null || (isNaN(v) && ru.kind !== 'no_before' && ru.kind !== 'custom')) return;
        if (since && t.o < since) return;
        st.checked++; checked.add(t);
        if (b) { st.breaks++; st.brkSum += t.pnl; st.brkN++; if (!broken.has(t)) broken.set(t, []); broken.get(t).push(ru); }
        else { st.folSum += t.pnl; st.folN++; }
      });
      perRule[ru.id] = st;
    });
    return { sorted: sorted, checked: checked, broken: broken, perRule: perRule, active: act };
  }

  /* Discipline score, streaks, calendar and badges. */
  function discipline(rules, L) {
    var ev = evaluate(rules, L);
    var days = {}, order = [];
    ev.sorted.forEach(function (t) {
      if (!ev.checked.has(t)) return;
      var k = dayKey(t.o);
      if (!days[k]) { days[k] = { key: k, date: new Date(t.o.getFullYear(), t.o.getMonth(), t.o.getDate()), checked: 0, broken: 0, kinds: {} }; order.push(k); }
      days[k].checked++;
      if (ev.broken.has(t)) { days[k].broken++; ev.broken.get(t).forEach(function (r) { days[k].kinds[r.kind] = 1; }); }
    });
    var list = order.map(function (k) { var d = days[k]; d.clean = d.broken === 0; return d; });
    var streak = 0; for (var i = list.length - 1; i >= 0; i--) { if (list[i].clean) streak++; else break; }
    var best = 0, run = 0, bestEnd = null;
    list.forEach(function (d) { if (d.clean) { run++; if (run > best) { best = run; bestEnd = d.date; } } else run = 0; });
    var win = list.slice(-30), wTrades = 0, wBroken = 0;
    var winKeys = {}; win.forEach(function (d) { winKeys[d.key] = 1; wTrades += d.checked; });
    ev.broken.forEach(function (rs, t) { if (winKeys[dayKey(t.o)]) wBroken++; });
    var follow = wTrades ? (wTrades - wBroken) / wTrades * 100 : null;
    var cleanDays = win.length ? win.filter(function (d) { return d.clean; }).length / win.length * 100 : null;
    var score = follow == null ? null : Math.round(0.7 * follow + 0.3 * cleanDays);
    var allFollow = ev.checked.size ? (ev.checked.size - ev.broken.size) / ev.checked.size * 100 : null;
    // quarter trend
    var byQ = {}; ev.checked.forEach(function (t) { var q = t.o.getFullYear() + ' Q' + (Math.floor(t.o.getMonth() / 3) + 1); byQ[q] = byQ[q] || { n: 0, b: 0 }; byQ[q].n++; if (ev.broken.has(t)) byQ[q].b++; });
    var quarters = Object.keys(byQ).sort().map(function (q) { return { q: q, pct: Math.round((byQ[q].n - byQ[q].b) / byQ[q].n * 100), n: byQ[q].n }; });
    // badges
    var noTilt = 0, nt = 0; list.forEach(function (d) { if (d.kinds.cool_off || d.kinds.loss_streak) nt = 0; else { nt++; noTilt = Math.max(noTilt, nt); } });
    var sizeRun = 0, sr = 0, hasSize = ev.active.some(function (r) { return r.kind === 'max_size'; });
    ev.sorted.forEach(function (t) { if (!ev.checked.has(t)) return; var bs = (ev.broken.get(t) || []).some(function (r) { return r.kind === 'max_size'; }); if (bs) sr = 0; else { sr++; sizeRun = Math.max(sizeRun, sr); } });
    var hasTilt = ev.active.some(function (r) { return r.kind === 'cool_off' || r.kind === 'loss_streak'; });
    var badges = [
      { id: 's5', icon: '🔥', name: '5-day streak', desc: '5 trading days in a row with every rule followed.', got: best >= 5, prog: Math.min(best, 5) + ' / 5' },
      { id: 's10', icon: '⚡', name: '10-day streak', desc: '10 clean trading days in a row.', got: best >= 10, prog: Math.min(best, 10) + ' / 10' },
      { id: 's25', icon: '🏔️', name: '25-day streak', desc: '25 clean trading days in a row.', got: best >= 25, prog: Math.min(best, 25) + ' / 25' },
      { id: 's50', icon: '👑', name: '50-day streak', desc: '50 clean trading days in a row.', got: best >= 50, prog: Math.min(best, 50) + ' / 50' },
      { id: 'cool', icon: '🧊', name: 'Cool head', desc: '20 trading days in a row without breaking a cool-off or loss-streak rule.', got: hasTilt && noTilt >= 20, prog: hasTilt ? Math.min(noTilt, 20) + ' / 20' : 'Needs a cool-off or loss-streak rule' },
      { id: 'size', icon: '⚖️', name: 'Steady size', desc: '30 checked trades in a row within your max contracts.', got: hasSize && sizeRun >= 30, prog: hasSize ? Math.min(sizeRun, 30) + ' / 30' : 'Needs a max-contracts rule' },
      { id: 'sc90', icon: '🎯', name: 'Sharp', desc: 'Reach a discipline score of 90 or higher.', got: score != null && score >= 90, prog: score == null ? '—' : score + ' / 90' }
    ];
    return { ev: ev, days: list, streak: streak, best: best, bestEnd: bestEnd, score: score, follow: follow, cleanDays: cleanDays, allFollow: allFollow, window: win.length, quarters: quarters, badges: badges, hasRules: ev.active.length > 0 };
  }

  function sideOf(k) { return CREDIT[k] ? 'credit' : FLY[k] ? 'fly' : DEBIT[k] ? 'debit' : 'other'; }

  /* Trader profile used by Trader DNA and Wrapped. Percentages and patterns, no dollar amounts. */
  function profileOf(L, disc) {
    var C = L.filter(function (t) { return t.c; });
    if (!L.length) return null;
    var count = function (f) { var m = {}; L.forEach(function (t) { var k = f(t); if (k != null && k !== '') m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
    var syms = count(function (t) { return t.sym; }), strats = count(function (t) { return t.k; });
    var sides = { credit: 0, debit: 0, fly: 0, other: 0 }; L.forEach(function (t) { sides[sideOf(t.k)]++; });
    var n = L.length, share = function (x) { return x / n * 100; };
    var wins = C.filter(function (t) { return t.pnl > 0; }).length, winRate = C.length ? wins / C.length * 100 : null;
    var holds = C.filter(function (t) { return t.tk; }).map(function (t) { return (t.c - t.o) / 60000; }).filter(function (m) { return m >= 0; }).sort(function (a, b) { return a - b; });
    var medHold = holds.length ? holds[Math.floor(holds.length / 2)] : null;
    var dtes = L.filter(function (t) { return t.dte != null; }), zero = dtes.length ? dtes.filter(function (t) { return t.dte === 0; }).length / dtes.length * 100 : null;
    var dayset = {}; L.forEach(function (t) { dayset[dayKey(t.o)] = 1; }); var activeDays = Object.keys(dayset).length;
    var perDay = activeDays ? n / activeDays : 0;
    var hours = {}; C.filter(function (t) { return t.tk; }).forEach(function (t) { var h = t.o.getHours(); hours[h] = hours[h] || { n: 0, w: 0 }; hours[h].n++; if (t.pnl > 0) hours[h].w++; });
    var sharp = null; Object.keys(hours).forEach(function (h) { var x = hours[h]; if (x.n >= 5) { var r = x.w / x.n; if (!sharp || r > sharp.rate) sharp = { hour: +h, rate: r, n: x.n }; } });
    var arche, blurb;
    if (share(sides.fly) >= 30) { arche = 'The Butterfly Architect'; blurb = 'Builds precise, defined-risk structures and lets the pin do the work.'; }
    else if (share(sides.credit) >= 60) { if (zero != null && zero >= 50) { arche = 'The Theta Harvester'; blurb = 'Sells same-day premium and lets time decay pay the bills.'; } else { arche = 'The Premium Collector'; blurb = 'Gets paid up front and manages risk around the short strikes.'; } }
    else if (share(sides.debit) >= 60) { if (medHold != null && medHold < 60) { arche = 'The Momentum Scalper'; blurb = 'In and out fast, buying moves and not waiting around.'; } else { arche = 'The Directional Hunter'; blurb = 'Picks a direction, pays for the move, and gives it time.'; } }
    else { arche = 'The Strategist'; blurb = 'Mixes credit, debit and defined-risk trades to fit the setup.'; }
    var traits = [];
    if (disc && disc.allFollow != null && disc.allFollow >= 85) traits.push('Disciplined');
    if (perDay <= 1.3) traits.push('Patient'); else if (perDay >= 3) traits.push('Active');
    if (zero != null && zero >= 50) traits.push('0DTE');
    if (medHold != null && medHold < 30) traits.push('Fast hands');
    return { n: n, closed: C.length, syms: syms, strats: strats, sides: sides, creditShare: share(sides.credit), debitShare: share(sides.debit), flyShare: share(sides.fly), winRate: winRate, medHold: medHold, zeroDte: zero, activeDays: activeDays, perDay: perDay, sharp: sharp, arche: arche, blurb: blurb, traits: traits, follow: disc ? disc.allFollow : null, best: disc ? disc.best : null };
  }

  function names(k) { return (window.TJImport && window.TJImport.NAMES[k]) || k || 'Other'; }

  /* Draw the Quillstrike quill mark on a canvas. */
  function drawLogo(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 64, s / 64);
    var r = function (px, py, w, h, rad) { ctx.beginPath(); ctx.moveTo(px + rad, py); ctx.arcTo(px + w, py, px + w, py + h, rad); ctx.arcTo(px + w, py + h, px, py + h, rad); ctx.arcTo(px, py + h, px, py, rad); ctx.arcTo(px, py, px + w, py, rad); ctx.closePath(); };
    r(2, 2, 60, 60, 15); ctx.fillStyle = '#08101A'; ctx.fill(); ctx.strokeStyle = 'rgba(56,189,248,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([3.5, 3]); ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, 35); ctx.lineTo(55, 35); ctx.stroke(); ctx.setLineDash([]);
    var g = ctx.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, '#FCE7A8'); g.addColorStop(.55, '#D8B25A'); g.addColorStop(1, '#8A6420');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(17, 49); ctx.bezierCurveTo(23, 34, 35, 20, 53, 10); ctx.bezierCurveTo(50, 26, 41, 38, 23, 46); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFF6D6'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(14, 52); ctx.lineTo(47, 17); ctx.stroke();
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(30, 35, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  /* Night Glow canvas background. */
  function drawBg(ctx, w, h) {
    ctx.fillStyle = '#04060A'; ctx.fillRect(0, 0, w, h);
    var g1 = ctx.createRadialGradient(w * .5, -h * .1, 0, w * .5, -h * .1, w * .75); g1.addColorStop(0, 'rgba(56,140,255,.34)'); g1.addColorStop(1, 'rgba(56,140,255,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
    var g2 = ctx.createRadialGradient(w, h * .3, 0, w, h * .3, w * .55); g2.addColorStop(0, 'rgba(227,179,65,.10)'); g2.addColorStop(1, 'rgba(227,179,65,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    var g3 = ctx.createRadialGradient(0, h * .75, 0, 0, h * .75, w * .6); g3.addColorStop(0, 'rgba(56,189,248,.10)'); g3.addColorStop(1, 'rgba(56,189,248,0)'); ctx.fillStyle = g3; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(170,210,255,.10)'; for (var y = 13; y < h * .5; y += 26) for (var x = 13; x < w; x += 26) { ctx.globalAlpha = Math.max(0, 1 - y / (h * .5)); ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fontsReady() { return document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 40px "Barlow Semi Condensed"'), document.fonts.load('600 20px Barlow'), document.fonts.load('400 20px Barlow')]).catch(function () {}) : Promise.resolve(); }
  function download(canvas, name) {
    if (canvas.toBlob) canvas.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png');
  }
  function copyImage(canvas) {
    return new Promise(function (res, rej) {
      if (!navigator.clipboard || !window.ClipboardItem || !canvas.toBlob) { rej(new Error('no clipboard')); return; }
      canvas.toBlob(function (b) { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(res, rej); }, 'image/png');
    });
  }
  function demoNote(d) {
    if (d.demo) return '<div class="qx-note">You’re looking at <b>sample trades</b>. <a href="import.html" style="color:#7DD3FC">Import your broker CSV</a> to see your own.' + (d.sampleRules ? ' Sample rules are used for the discipline checks.' : '') + '</div>';
    return '';
  }

  window.QS = { MS: MS, MF: MF, DOW: DOW, RULE_NAMES: RULE_NAMES, DEFAULTS: DEFAULTS, esc: esc, money: money, pct: pct, dayKey: dayKey, fdate: fdate, hourLabel: hourLabel, holdText: holdText, plural: plural, minsOf: minsOf,
    injectCss: injectCss, mount: mount, load: load, evaluate: evaluate, discipline: discipline, profileOf: profileOf, sideOf: sideOf, names: names,
    drawLogo: drawLogo, drawBg: drawBg, roundRect: roundRect, fontsReady: fontsReady, download: download, copyImage: copyImage, demoNote: demoNote };
})();
