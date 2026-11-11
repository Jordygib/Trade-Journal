/* Quillstrike Ask your journal.
   The question goes to the ask-journal Supabase function, where Claude turns it into a query plan.
   The plan runs here in the browser against the trader's own trades, so trade data never leaves the page
   and every number is calculated exactly. If the function isn't set up, a built-in reader handles common questions. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, ev, history = [];
  var GROUPS = { none: 1, day_of_week: 1, hour: 1, month: 1, week: 1, year: 1, strategy: 1, symbol: 1, dte: 1, trade_number_in_day: 1, hold_time: 1, after_loss: 1, rules_followed: 1, contracts: 1 };
  var METRICS = { win_rate: 'Win rate', net_pnl: 'Net P/L', avg_pnl: 'Average P/L', count: 'Trades', profit_factor: 'Profit factor', avg_hold_minutes: 'Typical hold', largest_loss: 'Largest loss', largest_win: 'Largest win' };
  var EXAMPLES = ['What’s my win rate on SPX iron condors on Fridays?', 'Do I lose more after 2 PM?', 'Which day of the week is my best?', 'How do my trades do right after a loss?', 'What’s my profit factor by strategy?', 'Do I do better when I follow my rules?'];

  function context() {
    var cnt = function (f) { var m = {}; d.lite.forEach(function (t) { [].concat(f(t) || []).forEach(function (k) { if (k) m[k] = (m[k] || 0) + 1; }); }); return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }); };
    var first = d.lite[0], last = d.lite[d.lite.length - 1];
    return { today: Q.dayKey(new Date()), symbols: cnt(function (t) { return t.sym; }).slice(0, 60), strategies: cnt(function (t) { return t.k; }).map(function (k) { return { key: k, name: Q.names(k) }; }), tags: cnt(function (t) { return t.tags; }).slice(0, 40), first_trade: first ? Q.dayKey(first.o) : null, last_trade: last ? Q.dayKey(last.o) : null, has_rules: ev.active.length > 0 };
  }

  /* ---------- built-in reader for common questions (used when the AI helper isn't available) ---------- */
  function localPlan(q) {
    var s = ' ' + q.toLowerCase().replace(/[’']/g, '') + ' ', f = {}, g = 'none', m = 'win_rate';
    if (/profit factor/.test(s)) m = 'profit_factor'; else if (/how many|number of|count/.test(s)) m = 'count'; else if (/average|avg|typical (win|loss|trade)|per trade/.test(s)) m = 'avg_pnl'; else if (/hold|how long/.test(s)) m = 'avg_hold_minutes'; else if (/biggest loss|largest loss|worst trade/.test(s)) m = 'largest_loss'; else if (/biggest win|largest win|best trade/.test(s)) m = 'largest_win'; else if (/lose more|make more|p\/?l|pnl|profit|money|net|total|made|lost/.test(s)) m = 'net_pnl';
    if (/day of (the )?week|which day|weekday|best day|worst day/.test(s)) g = 'day_of_week'; else if (/by hour|time of day|which hour|what time/.test(s)) g = 'hour'; else if (/by month|which month|each month|per month/.test(s)) g = 'month'; else if (/by strategy|which strategy|each strategy|per strategy/.test(s)) g = 'strategy'; else if (/by ticker|which ticker|by symbol|which symbol/.test(s)) g = 'symbol'; else if (/rules?/.test(s) && /follow|break|broke/.test(s)) g = 'rules_followed'; else if (/after (a )?loss|after losing/.test(s)) g = 'after_loss'; else if (/dte|days to expir/.test(s) && /by|each|which/.test(s)) g = 'dte'; else if (/first trade|second trade|trade of the day|nth trade|more trades/.test(s)) g = 'trade_number_in_day';
    var days = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 }; Object.keys(days).forEach(function (k) { if (s.indexOf(k) >= 0) (f.days_of_week = f.days_of_week || []).push(days[k]); });
    var hm = s.match(/(after|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/); if (hm) { var h = +hm[2]; if (hm[4] === 'pm' && h < 12) h += 12; if (!hm[4] && h < 8) h += 12; if (hm[1] === 'after') f.hour_from = h; else f.hour_to = h; if (g === 'none' && /more|less|better|worse/.test(s)) { g = 'hour_split'; f._split = h; delete f.hour_from; delete f.hour_to; } }
    if (/0 ?dte|zero dte|same.day/.test(s)) { f.dte_max = 0; }
    var ctx = context(); ctx.symbols.forEach(function (sym) { if (new RegExp('[^a-z]' + sym.toLowerCase().replace(/[^a-z0-9]/g, '') + 's?[^a-z]').test(s)) (f.symbols = f.symbols || []).push(sym); });
    var alias = { ic: /iron condor/, ifly: /iron (fly|butterfly)/, pcs: /put credit|bull put/, ccs: /call credit|bear call/, pds: /put debit/, cds: /call debit/, bwb: /broken.wing|bwb/, long_call: /long call|bought calls?/, long_put: /long put|bought puts?/, short_put: /naked put|short put/, short_call: /naked call|short call/, cal: /calendar/, diag: /diagonal/ };
    Object.keys(alias).forEach(function (k) { try { if (alias[k].test(s)) (f.strategies = f.strategies || []).push(k); } catch (e) {} });
    if (/butterfl|\bfly\b|\bflies\b/.test(s.replace(/iron (fly|butterfl\w*)|broken.wing butterfl\w*/g, ''))) (f.strategies = f.strategies || []).push('fly');
    if (/after (a )?loss|after losing/.test(s) && g !== 'after_loss') f.after_loss = true;
    if (/this year/.test(s)) f.date_from = new Date().getFullYear() + '-01-01'; else if (/this month/.test(s)) { var n = new Date(); f.date_from = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01'; } else if (/last 30 days|past month/.test(s)) { var b = new Date(Date.now() - 30 * 864e5); f.date_from = Q.dayKey(b); }
    if (/should i|will (the )?market|predict|buy|sell |recommend/.test(s) && !/my /.test(s)) return { type: 'unsupported', reason: 'I can only describe your own past trades, not predict markets or recommend trades.' };
    if (g === 'none' && /\bor\b|compare|vs|versus|better|worse/.test(s) && !f.after_loss) { if (/rule/.test(s)) g = 'rules_followed'; }
    return { type: 'answer', title: '', filters: f, group_by: g, metric: m, chart: g === 'none' ? 'none' : 'bar' };
  }

  /* ---------- run a plan against the trades ---------- */
  function sanitize(p) {
    if (!p || p.type === 'unsupported') return p || { type: 'unsupported', reason: 'I couldn’t read that question.' };
    var f = p.filters || {}, o = { type: 'answer', title: String(p.title || '').slice(0, 120), metric: METRICS[p.metric] ? p.metric : 'win_rate', group_by: GROUPS[p.group_by] || p.group_by === 'hour_split' ? p.group_by : 'none', chart: p.chart === 'line' ? 'line' : p.chart === 'none' ? 'none' : 'bar', filters: {}, note: String(p.note || '').slice(0, 300) };
    var arr = function (x) { return Array.isArray(x) ? x.slice(0, 40) : []; };
    o.filters = { symbols: arr(f.symbols).map(function (s) { return String(s).toUpperCase(); }), strategies: arr(f.strategies).map(String), days_of_week: arr(f.days_of_week).map(Number).filter(function (n) { return n >= 0 && n <= 6; }), tags: arr(f.tags).map(function (t) { return String(t).toLowerCase(); }),
      hour_from: isFinite(f.hour_from) && f.hour_from !== null ? +f.hour_from : null, hour_to: isFinite(f.hour_to) && f.hour_to !== null ? +f.hour_to : null, dte_min: isFinite(f.dte_min) && f.dte_min !== null ? +f.dte_min : null, dte_max: isFinite(f.dte_max) && f.dte_max !== null ? +f.dte_max : null,
      date_from: /^\d{4}-\d{2}-\d{2}$/.test(f.date_from || '') ? f.date_from : null, date_to: /^\d{4}-\d{2}-\d{2}$/.test(f.date_to || '') ? f.date_to : null, after_loss: f.after_loss === true ? true : f.after_loss === false ? false : null, outcome: f.outcome === 'win' || f.outcome === 'loss' ? f.outcome : null,
      min_contracts: isFinite(f.min_contracts) && f.min_contracts !== null ? +f.min_contracts : null, max_contracts: isFinite(f.max_contracts) && f.max_contracts !== null ? +f.max_contracts : null, _split: f._split };
    return o;
  }
  function afterLoss(t) { return t.tk && d.lite.some(function (p) { return p !== t && p.c && p.pnl < 0 && p.c <= t.o && t.o - p.c < 3600000 && Q.dayKey(p.c) === Q.dayKey(t.o); }); }
  function nthInDay() { var m = new Map(), per = {}; d.lite.forEach(function (t) { var k = Q.dayKey(t.o); per[k] = (per[k] || 0) + 1; m.set(t, per[k]); }); return m; }
  function run(p) {
    var f = p.filters, nth = nthInDay();
    var T = d.lite.filter(function (t) {
      if (f.symbols.length && f.symbols.indexOf(String(t.sym).toUpperCase()) < 0) return false;
      if (f.strategies.length && f.strategies.indexOf(t.k) < 0) return false;
      if (f.days_of_week.length && f.days_of_week.indexOf(t.o.getDay()) < 0) return false;
      if (f.hour_from != null && (!t.tk || t.o.getHours() < f.hour_from)) return false;
      if (f.hour_to != null && (!t.tk || t.o.getHours() >= f.hour_to)) return false;
      if (f.dte_min != null && (t.dte == null || t.dte < f.dte_min)) return false;
      if (f.dte_max != null && (t.dte == null || t.dte > f.dte_max)) return false;
      if (f.date_from && Q.dayKey(t.o) < f.date_from) return false;
      if (f.date_to && Q.dayKey(t.o) > f.date_to) return false;
      if (f.tags.length && !(t.tags || []).some(function (g) { return f.tags.indexOf(String(g).toLowerCase()) >= 0; })) return false;
      if (f.min_contracts != null && (t.qty || 1) < f.min_contracts) return false;
      if (f.max_contracts != null && (t.qty || 1) > f.max_contracts) return false;
      if (f.after_loss != null && afterLoss(t) !== f.after_loss) return false;
      if (f.outcome && (!t.c || (f.outcome === 'win') !== (t.pnl > 0))) return false;
      return true;
    });
    var needClosed = p.metric !== 'count';
    if (needClosed) T = T.filter(function (t) { return t.c; });
    var key, order = null;
    switch (p.group_by) {
      case 'day_of_week': key = function (t) { return t.o.getDay(); }; order = function (k) { return +k; }; break;
      case 'hour': key = function (t) { return t.tk ? t.o.getHours() : null; }; order = function (k) { return +k; }; break;
      case 'hour_split': key = function (t) { return t.tk ? (t.o.getHours() >= f._split ? 'after' : 'before') : null; }; order = function (k) { return k === 'before' ? 0 : 1; }; break;
      case 'month': key = function (t) { return t.o.getFullYear() + '-' + String(t.o.getMonth() + 1).padStart(2, '0'); }; order = function (k) { return k; }; break;
      case 'week': key = function (t) { var x = new Date(t.o); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return Q.dayKey(x); }; order = function (k) { return k; }; break;
      case 'year': key = function (t) { return t.o.getFullYear(); }; order = function (k) { return +k; }; break;
      case 'strategy': key = function (t) { return t.k; }; break;
      case 'symbol': key = function (t) { return t.sym; }; break;
      case 'dte': key = function (t) { return t.dte == null ? null : t.dte === 0 ? '0' : t.dte <= 7 ? '1–7' : t.dte <= 30 ? '8–30' : '31+'; }; order = function (k) { return ['0', '1–7', '8–30', '31+'].indexOf(k); }; break;
      case 'trade_number_in_day': key = function (t) { var n = nth.get(t); return n >= 4 ? '4+' : String(n); }; order = function (k) { return k; }; break;
      case 'hold_time': key = function (t) { if (!t.c || !t.tk) return null; var m = (t.c - t.o) / 60000; return m < 30 ? '<30 min' : m < 120 ? '30 min–2 hr' : m < 1440 ? '2 hr–1 day' : '1 day+'; }; order = function (k) { return ['<30 min', '30 min–2 hr', '2 hr–1 day', '1 day+'].indexOf(k); }; break;
      case 'after_loss': key = function (t) { return t.tk ? (afterLoss(t) ? 'yes' : 'no') : null; }; order = function (k) { return k === 'no' ? 0 : 1; }; break;
      case 'rules_followed': key = function (t) { return ev.checked.has(t) ? (ev.broken.has(t) ? 'broke' : 'followed') : null; }; order = function (k) { return k === 'followed' ? 0 : 1; }; break;
      case 'contracts': key = function (t) { var q = t.qty || 1; return q >= 5 ? '5+' : String(q); }; order = function (k) { return k; }; break;
      default: key = function () { return 'all'; };
    }
    var groups = {}; T.forEach(function (t) { var k = key(t); if (k == null) return; (groups[k] = groups[k] || []).push(t); });
    var out = Object.keys(groups).map(function (k) { return { k: k, label: label(p, k), n: groups[k].length, v: metric(p.metric, groups[k]) }; });
    if (order) out.sort(function (a, b) { var x = order(a.k), y = order(b.k); return x < y ? -1 : x > y ? 1 : 0; });
    else out.sort(function (a, b) { return b.n - a.n; });
    if (p.group_by === 'symbol' || p.group_by === 'strategy') out = out.slice(0, 12);
    return { groups: out, total: T.length, overall: metric(p.metric, T) };
  }
  function label(p, k) {
    switch (p.group_by) {
      case 'day_of_week': return Q.DOW[+k]; case 'hour': return Q.hourLabel(+k); case 'hour_split': return (k === 'before' ? 'Before ' : 'At or after ') + Q.hourLabel(p.filters._split);
      case 'month': var m = k.split('-'); return Q.MS[+m[1] - 1] + ' ' + m[0]; case 'week': var w = new Date(k + 'T12:00:00'); return 'Week of ' + Q.fdate(w);
      case 'strategy': return Q.names(k); case 'dte': return k + ' DTE'; case 'trade_number_in_day': return k === '1' ? '1st trade of the day' : k === '2' ? '2nd trade' : k === '3' ? '3rd trade' : '4th trade or later';
      case 'after_loss': return k === 'yes' ? 'Within an hour after a loss' : 'Not right after a loss'; case 'rules_followed': return k === 'followed' ? 'Followed every rule' : 'Broke a rule';
      case 'contracts': return k + (k === '1' ? ' contract' : ' contracts'); case 'none': return 'All matching trades'; default: return String(k);
    }
  }
  function metric(m, T) {
    var C = T.filter(function (t) { return t.c; }), sum = function (a) { return a.reduce(function (s, t) { return s + t.pnl; }, 0); };
    if (m === 'count') return T.length;
    if (!C.length) return null;
    if (m === 'win_rate') return C.filter(function (t) { return t.pnl > 0; }).length / C.length * 100;
    if (m === 'net_pnl') return sum(C);
    if (m === 'avg_pnl') return sum(C) / C.length;
    if (m === 'profit_factor') { var w = sum(C.filter(function (t) { return t.pnl > 0; })), l = -sum(C.filter(function (t) { return t.pnl < 0; })); return l ? w / l : (w ? Infinity : null); }
    if (m === 'avg_hold_minutes') { var h = C.filter(function (t) { return t.tk; }).map(function (t) { return (t.c - t.o) / 60000; }).sort(function (a, b) { return a - b; }); return h.length ? h[Math.floor(h.length / 2)] : null; }
    if (m === 'largest_loss') return Math.min.apply(null, C.map(function (t) { return t.pnl; }));
    if (m === 'largest_win') return Math.max.apply(null, C.map(function (t) { return t.pnl; }));
    return null;
  }
  function fmt(m, v) { if (v == null) return '—'; if (m === 'win_rate') return Math.round(v) + '%'; if (m === 'count') return String(v); if (m === 'profit_factor') return v === Infinity ? 'No losses' : v.toFixed(2); if (m === 'avg_hold_minutes') return Q.holdText(v); return Q.money(v, true); }
  function describe(p) {
    var f = p.filters, bits = [];
    if (f.symbols.length) bits.push(f.symbols.join(', ')); if (f.strategies.length) bits.push(f.strategies.map(Q.names).join(', ').toLowerCase() + 's');
    if (f.days_of_week.length) bits.push('on ' + f.days_of_week.map(function (x) { return Q.DOW[x] + 's'; }).join(' and '));
    if (f.hour_from != null) bits.push('opened at or after ' + Q.hourLabel(f.hour_from)); if (f.hour_to != null) bits.push('opened before ' + Q.hourLabel(f.hour_to));
    if (f.dte_max === 0 && (f.dte_min == null || f.dte_min === 0)) bits.push('0DTE'); else { if (f.dte_min != null) bits.push(f.dte_min + '+ DTE'); if (f.dte_max != null) bits.push('up to ' + f.dte_max + ' DTE'); }
    if (f.after_loss === true) bits.push('opened within an hour after a loss'); if (f.after_loss === false) bits.push('not right after a loss');
    if (f.tags.length) bits.push('tagged ' + f.tags.join(', ')); if (f.outcome) bits.push(f.outcome === 'win' ? 'winners' : 'losers');
    if (f.date_from || f.date_to) bits.push((f.date_from ? 'from ' + f.date_from : '') + (f.date_to ? ' to ' + f.date_to : ''));
    return bits.length ? bits.join(' · ') : 'all your trades';
  }
  function answerHtml(q, p, R, src) {
    if (p.type === 'unsupported') return '<div class="qx-card"><div class="qx-small qx-muted">You asked</div><h3 style="margin-bottom:8px">' + E(q) + '</h3><p>' + E(p.reason || 'I can only answer questions about your own trades in this journal.') + '</p><p class="qx-small qx-muted">Try asking about win rate, P/L, profit factor or hold time, broken down by day, hour, strategy, ticker, or whether you followed your rules.</p></div>';
    var M = METRICS[p.metric], unit = p.metric === 'count' ? 'trades' : 'closed trades', h = '<div class="qx-card"><div class="qx-small qx-muted">You asked</div><h3 style="margin-bottom:6px">' + E(q) + '</h3><div class="qx-small qx-muted" style="margin-bottom:12px">Looking at ' + E(describe(p)) + ' · ' + Q.plural(R.total, unit.slice(0, -1)) + '</div>';
    if (!R.total) return h + '<p>No trades match that. Try a wider question, like dropping the day or ticker.</p></div>';
    if (p.group_by === 'none') {
      h += '<div class="qx-row" style="align-items:baseline;gap:12px"><div class="qx-kpi" style="font-size:44px">' + fmt(p.metric, R.overall) + '</div><div class="qx-muted">' + E(M.toLowerCase()) + ' across ' + Q.plural(R.total, unit.slice(0, -1)) + '</div></div>';
    } else {
      var G = R.groups.filter(function (g) { return g.v != null && isFinite(g.v); }), ok = G.filter(function (g) { return g.n >= 3; });
      if (ok.length >= 2 && p.metric !== 'count') { var hi = ok.slice().sort(function (a, b) { return b.v - a.v; })[0], lo = ok.slice().sort(function (a, b) { return a.v - b.v; })[0]; h += '<p style="font-size:15px;margin:0 0 12px">' + (p.metric === 'largest_loss' ? 'Smallest largest-loss' : 'Highest') + ': <b class="qx-gain">' + E(hi.label) + '</b> (' + fmt(p.metric, hi.v) + ', ' + Q.plural(hi.n, 'trade') + '). Lowest: <b class="qx-loss">' + E(lo.label) + '</b> (' + fmt(p.metric, lo.v) + ', ' + Q.plural(lo.n, 'trade') + ').</p>'; }
      h += chartSvg(p, G) + '<div class="qx-wrapx" style="margin-top:10px"><table class="qx-table"><thead><tr><th>Group</th><th class="r">Trades</th><th class="r">' + E(M) + '</th></tr></thead><tbody>' + G.map(function (g) { var neg = g.v < 0; return '<tr><td>' + E(g.label) + '</td><td class="r">' + g.n + (g.n < 3 ? ' <span class="qx-small qx-muted">(few)</span>' : '') + '</td><td class="r ' + (p.metric !== 'count' && p.metric !== 'win_rate' && p.metric !== 'avg_hold_minutes' && p.metric !== 'profit_factor' ? (neg ? 'qx-loss' : 'qx-gain') : '') + '">' + fmt(p.metric, g.v) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    h += '<p class="qx-small qx-muted" style="margin:12px 0 0">Calculated from your journal' + (src === 'local' ? ' by the built-in question reader' : '') + '. This describes your past trades; it isn’t a recommendation.' + (p.note ? ' ' + E(p.note) : '') + '</p></div>';
    return h;
  }
  function chartSvg(p, G) {
    if (p.chart === 'none' || G.length < 2) return '';
    var W = 720, H = 230, pl = 56, pb = 46, pt = 12, vals = G.map(function (g) { return g.v === Infinity ? 0 : g.v; }), mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0])); if (mx === mn) mx = mn + 1;
    var Y = function (v) { return pt + (mx - v) / (mx - mn) * (H - pt - pb); }, bw = (W - pl - 10) / G.length;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block" role="img" aria-label="Chart">';
    [mn, (mn + mx) / 2, mx].forEach(function (v) { s += '<line x1="' + pl + '" x2="' + W + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#16223A"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" fill="#8396AD" font-size="11" text-anchor="end">' + E(fmt(p.metric, v)) + '</text>'; });
    if (p.chart === 'line') { s += '<path d="' + G.map(function (g, i) { return (i ? 'L' : 'M') + (pl + bw * i + bw / 2).toFixed(1) + ' ' + Y(vals[i]).toFixed(1); }).join('') + '" fill="none" stroke="#7DD3FC" stroke-width="2.4" style="filter:drop-shadow(0 0 6px rgba(56,189,248,.6))"/>'; }
    G.forEach(function (g, i) {
      var x = pl + bw * i, v = vals[i], y = Y(Math.max(v, 0)), h = Math.abs(Y(v) - Y(0)), col = (p.metric === 'win_rate' || p.metric === 'count' || p.metric === 'avg_hold_minutes' || p.metric === 'profit_factor') ? '#7DD3FC' : v < 0 ? '#FF7A8A' : '#57E3B5';
      if (p.chart !== 'line') s += '<rect x="' + (x + bw * 0.18).toFixed(1) + '" y="' + (v < 0 ? Y(0) : y).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(h, 2).toFixed(1) + '" rx="4" fill="' + col + '" fill-opacity="' + (g.n < 3 ? 0.35 : 0.85) + '"><title>' + E(g.label + ': ' + fmt(p.metric, g.v) + ' (' + g.n + ' trades)') + '</title></rect>';
      else s += '<circle cx="' + (x + bw / 2).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.5" fill="#BAE6FD"/>';
      var lb = g.label.length > 20 ? g.label.slice(0, 19) + '…' : g.label; if (G.length > 8 && i % Math.ceil(G.length / 8)) lb = '';
      s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - pb + 16) + '" fill="#AFBFD1" font-size="11" text-anchor="middle">' + E(lb) + '</text>';
    });
    return s + '<line x1="' + pl + '" x2="' + W + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#4A5D7A"/></svg>';
  }
  function ask(q) {
    q = String(q || '').trim().slice(0, 300); if (!q) return;
    var out = document.getElementById('ak-out'), btn = document.getElementById('ak-go');
    btn.disabled = true; btn.textContent = 'Thinking…';
    var pending = document.createElement('div'); pending.className = 'qx-card qx-muted'; pending.textContent = 'Reading your journal…'; out.prepend(pending);
    var done = function (plan, src, remaining) {
      pending.remove(); btn.disabled = false; btn.textContent = 'Ask';
      var p = sanitize(plan), R = p.type === 'answer' ? run(p) : null, div = document.createElement('div');
      div.innerHTML = answerHtml(q, p, R, src); out.prepend(div.firstChild);
      if (remaining != null) document.getElementById('ak-left').textContent = remaining + ' AI questions left today';
    };
    if (!d.sb || d.demo) { done(localPlan(q), 'local'); return; }
    d.sb.functions.invoke('ask-journal', { body: { question: q, context: context() } }).then(function (r) {
      if (r.error || !r.data || !r.data.plan) {
        var st = r.error && r.error.context && r.error.context.status;
        if (st === 429) { pending.remove(); btn.disabled = false; btn.textContent = 'Ask'; var x = document.createElement('div'); x.innerHTML = '<div class="qx-note">You’ve used today’s AI questions. They reset at midnight UTC. The built-in reader answered this one instead.</div>'; out.prepend(x.firstChild); done(localPlan(q), 'local'); document.getElementById('ak-left').textContent = '0 AI questions left today'; return; }
        done(localPlan(q), 'local'); return;
      }
      done(r.data.plan, 'ai', r.data.remaining);
    }, function () { done(localPlan(q), 'local'); });
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1]; ev = Q.evaluate(d.rules, d.lite);
    el.innerHTML = '<div class="qx" style="display:flex;flex-direction:column;gap:16px;max-width:980px">' + Q.demoNote(d) +
      '<div class="qx-card"><h2>Ask your journal</h2><p class="qx-muted" style="margin:4px 0 12px">Ask in plain English. Answers are calculated from your own trades, and your trade data stays in your browser. Only your question is sent to the AI helper.</p>' +
      '<div class="qx-row" style="flex-wrap:nowrap"><input id="ak-q" maxlength="300" placeholder="What’s my win rate on SPX iron condors on Fridays?" aria-label="Your question" style="flex:1 1 auto"><button class="qx-btn" id="ak-go" style="flex:none">Ask</button></div>' +
      '<div class="qx-row" style="margin-top:10px;gap:6px">' + EXAMPLES.map(function (x) { return '<button class="qx-chip" data-ex="' + E(x) + '" style="cursor:pointer;font-family:Barlow,system-ui,sans-serif">' + E(x) + '</button>'; }).join('') + '</div>' +
      '<div class="qx-small qx-muted" style="margin-top:10px" id="ak-left"></div></div><div id="ak-out" style="display:flex;flex-direction:column;gap:16px"></div></div>';
    var inp = document.getElementById('ak-q');
    document.getElementById('ak-go').onclick = function () { ask(inp.value); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') ask(inp.value); };
    el.querySelectorAll('[data-ex]').forEach(function (b) { b.onclick = function () { inp.value = b.getAttribute('data-ex'); ask(inp.value); }; });
    try { var q0 = new URLSearchParams(location.search).get('q'); if (q0) { inp.value = q0; ask(q0); } } catch (e) {}
  });
})();
