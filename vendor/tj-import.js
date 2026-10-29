/* Trade Journal importer: parses broker CSVs, groups fills into trades, saves to Supabase. */
(function () {
  var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ACT = { BTO: 'Buy to open', STO: 'Sell to open', BTC: 'Buy to close', STC: 'Sell to close' };
  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false, i = 0, c;
    text = String(text || '').replace(/^\uFEFF/, '');
    for (; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function money(n) { return (n >= 0 ? '+$' : '−$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
  function px(n) { return '$' + Math.abs(n).toFixed(2) + (n >= 0 ? ' cr' : ' db'); }
  function inferDate(m, d, today) { var y = today.getFullYear(); var dt = new Date(y, m, d); if (dt.getTime() > today.getTime() + 86400000) dt = new Date(y - 1, m, d); return dt; }
  function parseWhen(s, today) {
    s = String(s || '').trim();
    var a = s.match(/^(\d{1,2})\/(\d{1,2}),\s*(\d{1,2}):(\d{2})\s*([ap])m?$/i);
    if (a) { var dt = inferDate(+a[1] - 1, +a[2], today); var h = +a[3] % 12 + (a[5].toLowerCase() === 'p' ? 12 : 0); dt.setHours(h, +a[4], 0, 0); return { date: dt, hasTime: true }; }
    var b = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
    if (b) { var y = +b[3]; if (y < 100) y += 2000; var d2 = new Date(y, +b[1] - 1, +b[2], b[4] ? +b[4] : 12, b[5] ? +b[5] : 0); return { date: d2, hasTime: !!b[4] }; }
    var iso = new Date(s); if (!isNaN(iso)) return { date: iso, hasTime: true };
    return null;
  }
  function expiryFor(monStr, day, tradeDate) {
    var m = MON[monStr]; if (m == null) return null;
    var y = tradeDate.getFullYear(); var e = new Date(y, m, day, 16, 0);
    if (e.getTime() < tradeDate.getTime() - 40 * 86400000) e = new Date(y + 1, m, day, 16, 0);
    return e;
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function key(l) { return l.underlying + '|' + ymd(l.expiration) + '|' + l.strike + '|' + l.type; }
  /* ---------- tastytrade order history (Symbol, Status, MarketOrFill, Price, Time, Order #, Description) */
  function fromActivity(rows, head, today) {
    var ix = function (n) { return head.indexOf(n); };
    var iSym = ix('Symbol'), iSt = ix('Status'), iFill = ix('MarketOrFill'), iPx = ix('Price'), iT = ix('Time'), iO = ix('Order #'), iD = ix('Description');
    var orders = [], warn = [];
    rows.forEach(function (r) {
      if ((r[iSt] || '').trim() !== 'Filled') return;
      var w = parseWhen(r[iT], today); if (!w) { warn.push('Skipped an order with an unreadable date: ' + r[iT]); return; }
      var pm = String(r[iFill] || r[iPx] || '').match(/([\d.]+)\s*(cr|db)/i); if (!pm) { warn.push('Skipped order ' + r[iO] + ' with no fill price.'); return; }
      var net = parseFloat(pm[1]) * (pm[2].toLowerCase() === 'cr' ? 1 : -1);
      var legs = [];
      String(r[iD] || '').split(/\r?\n/).forEach(function (ln) {
        var m = ln.trim().match(/^(-?\d+)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+Exp\s+([\d.]+)\s+(Call|Put)\s+(BTO|STO|BTC|STC)$/);
        if (!m) { if (ln.trim()) warn.push('Couldn’t read a leg: “' + ln.trim() + '”'); return; }
        legs.push({ underlying: (r[iSym] || '').trim().toUpperCase(), qty: +m[1], expiration: expiryFor(m[2], +m[3], w.date), strike: parseFloat(m[4]), type: m[5].toLowerCase(), action: m[6] });
      });
      if (!legs.length) return;
      var unit = legs.reduce(function (g, l) { return gcd(g, l.qty); }, 0);
      orders.push({ id: String(r[iO] || '').replace('#', '').trim(), when: w.date, hasTime: w.hasTime, underlying: legs[0].underlying, net: net, unit: unit, cash: net * unit * 100, legs: legs });
    });
    return { orders: orders, warnings: warn, feesKnown: false, label: 'tastytrade order history', prefix: 'tt', broker: 'tastytrade' };
  }
  /* ---------- tastytrade transactions (Date, Type, Action, Symbol, Value, Quantity, Average Price, Commissions, Fees, ...) */
  function fromTransactions(rows, head, today) {
    var ix = function (n) { return head.indexOf(n); };
    var I = { date: ix('Date'), type: ix('Type'), sub: ix('Sub Type'), action: ix('Action'), value: ix('Value'), qty: ix('Quantity'), com: ix('Commissions'), fees: ix('Fees'), und: ix('Underlying Symbol'), root: ix('Root Symbol'), exp: ix('Expiration Date'), strike: ix('Strike Price'), cp: ix('Call or Put'), order: ix('Order #'), mult: ix('Multiplier'), desc: ix('Description') };
    var byOrder = {}, list = [], warn = [];
    var num = function (s) { var v = parseFloat(String(s || '').replace(/[$,]/g, '')); return isNaN(v) ? 0 : v; };
    rows.forEach(function (r, n) {
      var cp = String(r[I.cp] || '').trim().toLowerCase(); if (cp !== 'call' && cp !== 'put') return;
      var type = String(r[I.type] || '');
      var w = parseWhen(r[I.date], today) || { date: new Date(r[I.date]), hasTime: true }; if (isNaN(w.date)) return;
      var a = String(r[I.action] || '').toUpperCase().replace(/_/g, ' ');
      var code = /BUY.*OPEN/.test(a) ? 'BTO' : /SELL.*OPEN/.test(a) ? 'STO' : /BUY.*CLOSE/.test(a) ? 'BTC' : /SELL.*CLOSE/.test(a) ? 'STC' : (/EXPIR|ASSIGN|EXERCISE/i.test(String(r[I.sub] || '') + ' ' + r[I.desc]) ? 'EXP' : null);
      if (!code) return;
      var q = Math.abs(num(r[I.qty])) || 1;
      var exp = new Date(r[I.exp]); if (isNaN(exp)) { var em = String(r[I.exp] || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (em) exp = new Date((+em[3] < 100 ? 2000 + +em[3] : +em[3]), +em[1] - 1, +em[2]); }
      exp.setHours(16, 0, 0, 0);
      var leg = { underlying: String(r[I.und] || r[I.root] || '').trim().toUpperCase(), qty: (code === 'STO' || code === 'STC') ? -q : q, expiration: exp, strike: num(r[I.strike]), type: cp, action: code };
      var cash = num(r[I.value]), fee = Math.abs(num(r[I.com])) + Math.abs(num(r[I.fees]));
      var oid = String(r[I.order] || '').trim() || ('row' + n);
      if (code === 'EXP') { list.push({ id: 'exp' + n, when: w.date, hasTime: w.hasTime, underlying: leg.underlying, expiration: true, cash: cash, fees: fee, legs: [leg] }); return; }
      var o = byOrder[oid]; if (!o) { o = byOrder[oid] = { id: oid, when: w.date, hasTime: w.hasTime, underlying: leg.underlying, cash: 0, fees: 0, legs: [] }; list.push(o); }
      o.cash += cash; o.fees += fee; o.legs.push(leg);
    });
    list.forEach(function (o) { if (o.expiration) return; o.unit = o.legs.reduce(function (g, l) { return gcd(g, l.qty); }, 0); o.net = o.cash / (o.unit * 100); });
    return { orders: list, warnings: warn, feesKnown: true, label: 'tastytrade transactions', prefix: 'tt', broker: 'tastytrade' };
  }

  /* ---------- shared helpers for other brokers */
  var ROOTS = { SPXW: 'SPX', SPXPM: 'SPX', NDXP: 'NDX', RUTW: 'RUT', XSPW: 'XSP', VIXW: 'VIX' };
  function root(u) { u = String(u || '').trim().toUpperCase().replace(/^\./, ''); return ROOTS[u] || u; }
  function num(x) { var t = String(x == null ? '' : x).trim(); var neg = /^\(.*\)$/.test(t) || /^-/.test(t); var v = parseFloat(t.replace(/[^0-9.]/g, '')); return isNaN(v) ? 0 : (neg ? -v : v); }
  function mdy(s) { var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[1] - 1, +m[2]); }
  function withTime(d, s) { var m = String(s || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i); if (!d) return null; var r = new Date(d.getTime()); if (m) { var h = +m[1]; if (m[4]) h = h % 12 + (/p/i.test(m[4]) ? 12 : 0); r.setHours(h, +m[2], +(m[3] || 0), 0); } else r.setHours(12, 0, 0, 0); return r; }
  function exp16(d) { var e = new Date(d.getTime()); e.setHours(16, 0, 0, 0); return e; }
  function occ(sym) { var m = String(sym || '').replace(/\s+/g, '').match(/^([A-Z.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/); if (!m) return null; return { underlying: root(m[1]), expiration: new Date(2000 + +m[2], +m[3] - 1, +m[4], 16), strike: +m[6] / 1000, type: m[5] === 'C' ? 'call' : 'put' }; }
  function groupRows(rows, keyFn) { var by = {}, out = []; rows.forEach(function (r) { var k = keyFn(r); if (!by[k]) { by[k] = { id: k, when: r.when, hasTime: r.hasTime, underlying: r.leg.underlying, cash: 0, fees: 0, legs: [] }; out.push(by[k]); } var o = by[k]; o.cash += r.cash; o.fees += r.fees || 0; o.legs.push(r.leg); }); out.forEach(function (o) { var real = o.legs.filter(function (l) { return l.action !== 'EXP'; }); o.unit = real.length ? real.reduce(function (g, l) { return gcd(g, l.qty); }, 0) : 1; o.net = o.cash / (o.unit * 100); }); return out; }
  function hashStr(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  /* ---------- Schwab (schwab.com transaction history) */
  function fromSchwab(rows, head, today) {
    var ix = function (n) { return head.indexOf(n); };
    var I = { date: ix('Date'), action: ix('Action'), sym: ix('Symbol'), desc: ix('Description'), qty: ix('Quantity'), price: ix('Price'), fees: ix('Fees & Comm'), amt: ix('Amount') };
    var out = [], warn = [];
    rows.forEach(function (r) {
      var a = String(r[I.action] || '').trim().toLowerCase(); var sym = String(r[I.sym] || '').trim();
      var m = sym.match(/^([A-Z.]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([\d.]+)\s+([CP])$/) || null; var leg0 = null;
      if (m) leg0 = { underlying: root(m[1]), expiration: exp16(mdy(m[2])), strike: +m[3], type: m[4] === 'C' ? 'call' : 'put' };
      else { var o2 = occ(sym); if (o2) leg0 = o2; }
      if (!leg0) return;
      var d = mdy(String(r[I.date] || '').split(' as of')[0]); if (!d) return;
      var q = Math.abs(num(r[I.qty])) || 1, code = /buy to open/.test(a) ? 'BTO' : /sell to open/.test(a) ? 'STO' : /buy to close/.test(a) ? 'BTC' : /sell to close/.test(a) ? 'STC' : /expire|assign|exercise/.test(a) ? 'EXP' : null;
      if (!code) return; if (code === 'EXP' && /assign|exercise/.test(a)) warn.push('An assignment or exercise on ' + sym + ' was treated as closing the option at $0. Any stock you got is not tracked.');
      var fees = Math.abs(num(r[I.fees])), amt = num(r[I.amt]);
      out.push({ when: withTime(d, null), hasTime: false, cash: code === 'EXP' ? 0 : amt + fees, fees: fees, leg: Object.assign({}, leg0, { qty: (code === 'BTO' || code === 'BTC') ? q : (code === 'EXP' ? q : -q), action: code }) });
    });
    var orders = groupRows(out, function (r) { return 'sw|' + ymd(r.when) + '|' + r.leg.underlying + '|' + (r.leg.action === 'EXP' ? 'x' : (r.leg.action.slice(2) === 'O' ? 'o' : 'c')); });
    orders.forEach(function (o) { o.id = 'sw' + hashStr(o.id + o.legs.map(function (l) { return l.strike + l.type + l.qty; }).join(',')); });
    return { orders: orders, warnings: warn, feesKnown: true, label: 'Schwab transaction history', prefix: 'sw', broker: 'schwab' };
  }
  /* ---------- thinkorswim account statement (Account Trade History section) */
  function fromToS(all, today) {
    var hi = -1; for (var i = 0; i < all.length; i++) { if (all[i].indexOf('Exec Time') >= 0 && all[i].indexOf('Pos Effect') >= 0) { hi = i; break; } }
    if (hi < 0) return null;
    var head = all[hi].map(function (h) { return h.trim(); }), ix = function (n) { return head.indexOf(n); };
    var I = { t: ix('Exec Time'), side: ix('Side'), qty: ix('Qty'), pe: ix('Pos Effect'), sym: ix('Symbol'), exp: ix('Exp'), strike: ix('Strike'), type: ix('Type'), price: ix('Price') };
    var MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    var rows = [], cur = null, n = 0;
    for (var k = hi + 1; k < all.length; k++) {
      var r = all[k]; if (!r || r.join('').trim() === '') break;
      var ts = String(r[I.t] || '').trim();
      if (ts) { var dd = mdy(ts); cur = { when: withTime(dd, ts.split(' ')[1]), id: 'tos' + (++n) }; }
      if (!cur || !cur.when) continue;
      var tp = String(r[I.type] || '').trim().toUpperCase(); if (tp !== 'CALL' && tp !== 'PUT') continue;
      var ex = String(r[I.exp] || '').trim().toUpperCase(), em = ex.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})/), ed = em ? new Date((+em[3] < 100 ? 2000 + +em[3] : +em[3]), MON[em[2]], +em[1]) : mdy(ex); if (!ed) continue;
      var q = num(r[I.qty]), side = String(r[I.side] || '').toUpperCase(); if (side === 'SELL' && q > 0) q = -q; if (side === 'BUY' && q < 0) q = -q;
      var open = /OPEN/i.test(String(r[I.pe] || '')), price = Math.abs(num(r[I.price]));
      rows.push({ when: cur.when, hasTime: true, cash: -q * price * 100, fees: 0, oid: cur.id, leg: { underlying: root(r[I.sym]), expiration: exp16(ed), strike: num(r[I.strike]), type: tp === 'CALL' ? 'call' : 'put', qty: q, action: q > 0 ? (open ? 'BTO' : 'BTC') : (open ? 'STO' : 'STC') } });
    }
    var orders = groupRows(rows, function (r) { return r.oid; });
    orders.forEach(function (o) { o.id = 'tos' + hashStr(o.when.toISOString() + o.legs.map(function (l) { return l.strike + l.type + l.qty; }).join(',')); });
    return { orders: orders, warnings: [], feesKnown: false, label: 'thinkorswim account statement', prefix: 'tos', broker: 'thinkorswim' };
  }
  /* ---------- Robinhood account activity report */
  function fromRobinhood(rows, head, today) {
    var ix = function (n) { return head.indexOf(n); };
    var I = { d: ix('Activity Date'), inst: ix('Instrument'), desc: ix('Description'), code: ix('Trans Code'), qty: ix('Quantity'), price: ix('Price'), amt: ix('Amount') };
    var out = [];
    rows.forEach(function (r) {
      var code = String(r[I.code] || '').trim().toUpperCase(); if (['BTO', 'STO', 'BTC', 'STC', 'OEXP', 'OASGN', 'OEXCS'].indexOf(code) < 0) return;
      var m = String(r[I.desc] || '').match(/([A-Z.]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(Call|Put)\s+\$?([\d,.]+)/i); if (!m) return;
      var d = mdy(r[I.d]); if (!d) return;
      var q = Math.abs(num(r[I.qty])) || 1, act = code.length === 3 ? code : 'EXP';
      out.push({ when: withTime(d, null), hasTime: false, cash: act === 'EXP' ? 0 : num(r[I.amt]), fees: 0, leg: { underlying: root(m[1]), expiration: exp16(mdy(m[2])), strike: num(m[4]), type: /call/i.test(m[3]) ? 'call' : 'put', qty: (act === 'BTO' || act === 'BTC' || act === 'EXP') ? q : -q, action: act } });
    });
    var orders = groupRows(out, function (r) { return 'rh|' + ymd(r.when) + '|' + r.leg.underlying + '|' + (r.leg.action === 'EXP' ? 'x' : (r.leg.action.slice(2) === 'O' ? 'o' : 'c')); });
    orders.forEach(function (o) { o.id = 'rh' + hashStr(o.id + o.legs.map(function (l) { return l.strike + l.type + l.qty; }).join(',')); });
    return { orders: orders, warnings: [], feesKnown: true, label: 'Robinhood account activity', prefix: 'rh', broker: 'robinhood' };
  }
  /* ---------- Webull options order history */
  function fromWebull(rows, head, today) {
    var ix = function (n) { return head.indexOf(n); };
    var I = { sym: ix('Symbol'), side: ix('Side'), st: ix('Status'), filled: ix('Filled'), avg: ix('Avg Price'), ft: ix('Filled Time'), name: ix('Name') };
    var raw = [];
    rows.forEach(function (r) {
      if (!/fill/i.test(String(r[I.st] || ''))) return;
      var leg = occ(r[I.sym]); if (!leg) return;
      var t = String(r[I.ft] || ''); var d = mdy(t); if (!d) return;
      raw.push({ when: withTime(d, t.replace(/^\S+\s*/, '')), side: String(r[I.side] || '').toLowerCase(), q: Math.abs(num(r[I.filled])) || 1, px: Math.abs(num(r[I.avg])), leg: leg, tkey: t.trim() });
    });
    raw.sort(function (a, b) { return a.when - b.when; });
    var pos = {}, out = [];
    raw.forEach(function (x) { var k = x.leg.underlying + '|' + ymd(x.leg.expiration) + '|' + x.leg.strike + '|' + x.leg.type; var p = pos[k] || 0; var buy = /buy/.test(x.side); var q = buy ? x.q : -x.q;
      var act = buy ? (p < 0 ? 'BTC' : 'BTO') : (p > 0 ? 'STC' : 'STO'); pos[k] = p + q;
      out.push({ when: x.when, hasTime: true, cash: -q * x.px * 100, fees: 0, tkey: x.tkey, leg: Object.assign({}, x.leg, { qty: q, action: act }) }); });
    var orders = groupRows(out, function (r) { return 'wb|' + r.tkey + '|' + r.leg.underlying; });
    orders.forEach(function (o) { o.id = 'wb' + hashStr(o.id + o.legs.map(function (l) { return l.strike + l.type + l.qty; }).join(',')); });
    return { orders: orders, warnings: [], feesKnown: false, label: 'Webull options orders', prefix: 'wb', broker: 'webull' };
  }
  function classify(legs, openNet) {
    var calls = legs.filter(function (l) { return l.type === 'call'; }), puts = legs.filter(function (l) { return l.type === 'put'; });
    var exps = {}; legs.forEach(function (l) { exps[ymd(l.expiration)] = 1; }); var nExp = Object.keys(exps).length;
    var credit = openNet >= 0, one = legs.length;
    if (one === 1) { var l = legs[0]; return l.qty < 0 ? (l.type === 'put' ? 'short_put' : 'short_call') : (l.type === 'put' ? 'long_put' : 'long_call'); }
    if (nExp > 1) {
      var strikes = {}; legs.forEach(function (l) { strikes[l.strike + l.type] = 1; });
      var sameStrikes = legs.every(function (l) { return legs.some(function (m) { return m !== l && m.strike === l.strike && m.type === l.type && ymd(m.expiration) !== ymd(l.expiration); }); });
      if (one === 2) return sameStrikes ? 'cal' : 'diag';
      if (one === 4 && sameStrikes) return 'dcal';
      return 'ddiag';
    }
    var s = legs.slice().sort(function (a, b) { return a.strike - b.strike; });
    if (one === 2 && (calls.length === 2 || puts.length === 2)) {
      if (puts.length === 2) return credit ? 'pcs' : 'pds';
      return credit ? 'ccs' : 'cds';
    }
    if (one === 2 && calls.length === 1) { var sh = legs.every(function (l) { return l.qty < 0; }), lg = legs.every(function (l) { return l.qty > 0; }); var same = legs[0].strike === legs[1].strike; return sh ? (same ? 'sstrad' : 'sstrang') : lg ? (same ? 'lstrad' : 'lstrang') : 'other'; }
    if (one === 3 && (calls.length === 3 || puts.length === 3)) {
      var q = s.map(function (l) { return l.qty; }); var r1 = Math.abs(q[1]) === 2 * Math.abs(q[0]) && Math.abs(q[0]) === Math.abs(q[2]) && Math.sign(q[0]) === Math.sign(q[2]) && Math.sign(q[1]) !== Math.sign(q[0]);
      if (r1) return Math.abs((s[1].strike - s[0].strike) - (s[2].strike - s[1].strike)) < 1e-9 ? 'fly' : 'bwb';
      return 'ratio';
    }
    if (one === 4 && calls.length === 2 && puts.length === 2) { var shortStrikes = legs.filter(function (l) { return l.qty < 0; }).map(function (l) { return l.strike; }); return shortStrikes.length === 2 && shortStrikes[0] === shortStrikes[1] ? 'ifly' : 'ic'; }
    if (one === 4 && (calls.length === 4 || puts.length === 4)) return 'condor';
    return 'other';
  }
  var NAMES = { pcs: 'Put credit spread', ccs: 'Call credit spread', pds: 'Put debit spread', cds: 'Call debit spread', ic: 'Iron condor', ifly: 'Iron butterfly', condor: 'Condor', fly: 'Butterfly', bwb: 'Broken-wing butterfly', cal: 'Calendar', dcal: 'Double calendar', diag: 'Diagonal', ddiag: 'Double diagonal', long_call: 'Long call', long_put: 'Long put', short_call: 'Naked call', short_put: 'Naked put', sstrad: 'Short straddle', sstrang: 'Short strangle', lstrad: 'Long straddle', lstrang: 'Long strangle', ratio: 'Ratio spread', other: 'Other' };
  function structure(legs) {
    var exps = []; legs.forEach(function (l) { var e = MN[l.expiration.getMonth()] + ' ' + l.expiration.getDate(); if (exps.indexOf(e) < 0) exps.push(e); });
    var strikes = legs.slice().sort(function (a, b) { return a.strike - b.strike; }).map(function (l) { return l.strike + (l.type === 'call' ? 'C' : 'P'); });
    var uniq = []; strikes.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return legs.length + (legs.length === 1 ? ' leg' : ' legs') + ' · ' + uniq.join('/') + ' · ' + exps.join(' & ');
  }
  function group(orders, today, feesKnown) {
    var rank = function (o) { return o.legs.every(function (l) { return l.action === 'EXP'; }) ? 2 : (o.legs.some(function (l) { return /O$/.test(l.action); }) ? 0 : 1); };
    orders.sort(function (a, b) { return a.when - b.when || rank(a) - rank(b) || (a.id < b.id ? -1 : 1); });
    var open = {}, trades = [], n = 0;
    orders.forEach(function (o) {
      var touched = [];
      o.legs.forEach(function (l) { var k = key(l); if (open[k] && open[k].qty !== 0 && touched.indexOf(open[k].trade) < 0) touched.push(open[k].trade); });
      var t = touched[0];
      if (!t && o.legs.every(function (l) { return l.action === 'EXP'; })) return;
      if (!t) { t = { n: ++n, orders: [], contracts: {}, underlying: o.underlying }; trades.push(t); }
      for (var j = 1; j < touched.length; j++) { var x = touched[j]; x.orders.forEach(function (oo) { t.orders.push(oo); }); Object.keys(x.contracts).forEach(function (k) { t.contracts[k] = x.contracts[k]; open[k].trade = t; }); trades.splice(trades.indexOf(x), 1); }
      t.orders.push(o);
      o.legs.forEach(function (l) { var k = key(l); if (l.action === 'EXP') { if (!open[k] || !open[k].qty) return; var cq = open[k].qty; l.qty = -Math.sign(cq) * Math.min(Math.abs(l.qty) || Math.abs(cq), Math.abs(cq)); } if (!open[k]) open[k] = { qty: 0, trade: t, leg: l }; open[k].trade = t; open[k].qty += l.qty; t.contracts[k] = open[k]; });
      if (Object.keys(t.contracts).every(function (k) { return Math.abs(t.contracts[k].qty) < 1e-9; })) t.closedAt = o.when;
    });
    return trades.map(function (t) {
      var first = t.orders[0], last = t.orders[t.orders.length - 1];
      var cash = t.orders.reduce(function (s, o) { return s + (o.cash || 0); }, 0), fees = t.orders.reduce(function (s, o) { return s + (o.fees || 0); }, 0);
      var status = t.closedAt ? 'closed' : 'open', exitLabel, expiredAssumed = false;
      if (!t.closedAt) {
        var maxExp = Math.max.apply(null, Object.keys(t.contracts).map(function (k) { return t.contracts[k].leg.expiration.getTime(); }));
        if (maxExp < today.getTime()) { status = 'closed'; t.closedAt = new Date(maxExp); expiredAssumed = !feesKnown; exitLabel = 'Expired'; }
      }
      var closeOrders = t.orders.slice(1);
      if (!exitLabel && closeOrders.length && closeOrders.every(function (o) { return o.legs.every(function (l) { return l.action === 'EXP'; }); })) exitLabel = 'Expired';
      if (!exitLabel) exitLabel = status === 'open' ? 'Still open' : (closeOrders.length ? 'Closed ' + px(closeOrders.reduce(function (s, o) { return s + (o.net || 0) * (o.unit || 1); }, 0) / (first.unit || 1)) : 'Closed');
      var strat = classify(first.legs, first.net || 0);
      return {
        source_key: (first.prefix || 'tt') + ':' + first.id, underlying: t.underlying, strategy: strat, strategy_name: NAMES[strat] || 'Other', structure: structure(first.legs),
        opened_at: first.when, opened_has_time: first.hasTime, closed_at: t.closedAt || null, entry_price: first.net || 0, exit_label: exitLabel,
        quantity: first.unit || 1, pnl: Math.round((cash - fees) * 100) / 100, gross: Math.round(cash * 100) / 100, fees: Math.round(fees * 100) / 100,
        status: status, expired_assumed: expiredAssumed, orders: t.orders
      };
    }).sort(function (a, b) { return b.opened_at - a.opened_at; });
  }
  function parse(text, today) {
    today = today || new Date();
    var rows = parseCSV(text); if (!rows.length) return { ok: false, error: 'That file looks empty.' };
    var hIdx = 0;
    for (var hi2 = 0; hi2 < Math.min(rows.length, 12); hi2++) { var hr = rows[hi2].map(function (h) { return String(h).trim(); });
      if (hr.indexOf('MarketOrFill') >= 0 || hr.indexOf('Trans Code') >= 0 || hr.indexOf('Filled Time') >= 0 || (hr.indexOf('Action') >= 0 && (hr.indexOf('Amount') >= 0 || hr.indexOf('Value') >= 0))) { hIdx = hi2; break; } }
    if (hIdx) rows = rows.slice(hIdx);
    var head = rows[0].map(function (h) { return h.trim(); });
    var out;
    if (head.indexOf('MarketOrFill') >= 0 && head.indexOf('Description') >= 0) out = fromActivity(rows.slice(1), head, today);
    else if (head.indexOf('Call or Put') >= 0 && head.indexOf('Action') >= 0 && head.indexOf('Value') >= 0) out = fromTransactions(rows.slice(1), head, today);
    else if (head.indexOf('Trans Code') >= 0 && head.indexOf('Description') >= 0) out = fromRobinhood(rows.slice(1), head, today);
    else if (head.indexOf('Fees & Comm') >= 0 && head.indexOf('Action') >= 0 && head.indexOf('Amount') >= 0) out = fromSchwab(rows.slice(1), head, today);
    else if (head.indexOf('Filled Time') >= 0 && head.indexOf('Side') >= 0 && head.indexOf('Avg Price') >= 0) out = fromWebull(rows.slice(1), head, today);
    else if (rows.some(function (r) { return r.indexOf('Exec Time') >= 0 && r.indexOf('Pos Effect') >= 0; })) out = fromToS(rows, today);
    else return { ok: false, unknown: true, error: 'We don’t recognize this file’s format yet.', headers: head, rows: rows.length - 1 };
    if (!out.orders.length) return { ok: false, error: 'No option trades were found in this file. Make sure it includes the date range you traded in.', label: out.label };
    out.orders.forEach(function (o) { o.prefix = out.prefix || 'tt'; });
    var trades = group(out.orders, today, out.feesKnown);
    var fills = 0; trades.forEach(function (t) { t.orders.forEach(function (o) { fills += o.legs.length; }); });
    return { ok: true, broker: out.broker || 'tastytrade', label: out.label, feesKnown: out.feesKnown, warnings: out.warnings, orders: out.orders.length, fills: fills, trades: trades,
      net: trades.reduce(function (s, t) { return s + t.pnl; }, 0), closed: trades.filter(function (t) { return t.status === 'closed'; }).length };
  }
  function fmtDate(d) { return MN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function fmtTime(d) { var h = d.getHours(), m = d.getMinutes(); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
  function holdText(a, b, timeKnown) {
    if (!a || !b) return '—';
    if (timeKnown === false) { var d0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()), d1 = new Date(b.getFullYear(), b.getMonth(), b.getDate()); var dd = Math.round((d1 - d0) / 86400000); return dd <= 0 ? 'Same day' : dd + (dd === 1 ? ' day' : ' days'); }
    var mins = Math.round((b - a) / 60000); if (mins < 0) return '—';
    if (mins < 60) return mins + 'm';
    var days = Math.floor(mins / 1440); if (days >= 1) return days + (days === 1 ? ' day' : ' days');
    return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }
  function save(sb, result, fileName) {
    return sb.auth.getUser().then(function (u) {
      var user = u && u.data ? u.data.user : null; if (!user) throw new Error('Please sign in again, then retry the import.');
      return sb.from('imports').insert({ user_id: user.id, source: 'csv', broker: result.broker || 'tastytrade', file_name: fileName || null, row_count: result.orders }).select('id').single().then(function (imp) {
        if (imp.error) throw imp.error;
        var tradeRows = result.trades.map(function (t) {
          return { user_id: user.id, source_key: t.source_key, underlying: t.underlying, strategy: t.strategy, structure: t.structure, opened_at: t.opened_at.toISOString(), closed_at: t.closed_at ? t.closed_at.toISOString() : null,
            entry_price: t.entry_price, exit_price: null, quantity: t.quantity, pnl: t.pnl, fees: t.fees, status: t.status, time_known: !!t.opened_has_time };
        });
        return sb.from('trades').upsert(tradeRows, { onConflict: 'user_id,source_key' }).select('id, source_key').then(function (tr) {
          if (tr.error) throw tr.error;
          var idBy = {}; tr.data.forEach(function (r) { idBy[r.source_key] = r.id; });
          var fillRows = [];
          result.trades.forEach(function (t) {
            t.orders.forEach(function (o) {
              o.legs.forEach(function (l, i) {
                fillRows.push({ user_id: user.id, import_id: imp.data.id, trade_id: idBy[t.source_key], executed_at: o.when.toISOString(), action: l.action, symbol: l.underlying + ' ' + ymd(l.expiration) + ' ' + l.strike + (l.type === 'call' ? 'C' : 'P'),
                  underlying: l.underlying, expiration: ymd(l.expiration), strike: l.strike, option_type: l.type, quantity: l.qty, price: o.net || 0, fees: i === 0 ? (o.fees || 0) : 0, dedupe_key: (o.prefix || 'tt') + ':' + o.id + ':' + i,
                  raw: { order: o.id, unit: o.unit, net: o.net } });
              });
            });
          });
          return sb.from('fills').upsert(fillRows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }).then(function (fr) {
            if (fr.error) throw fr.error;
            return { trades: tr.data.length, fills: fillRows.length };
          });
        });
      });
    });
  }
  /* Convert saved rows into the shape the Trades page uses. */
  var KMAP = { pcs: 'pcs', ccs: 'ccs', pds: 'bps', cds: 'bcs', ic: 'ic', ifly: 'ifly', condor: 'condor', fly: 'fly', bwb: 'bwb', cal: 'cal', dcal: 'dcal', diag: 'diag', ddiag: 'ddiag', long_call: 'long_call', long_put: 'long_put', short_call: 'naked_call', short_put: 'np', sstrad: 'sstrad', sstrang: 'sstrang', lstrad: 'lstrad', lstrang: 'lstrang', ratio: 'ratio', other: 'other' };
  function toView(trades, fills) {
    var byTrade = {}; (fills || []).forEach(function (f) { (byTrade[f.trade_id] = byTrade[f.trade_id] || []).push(f); });
    return trades.map(function (t, i) {
      var o = new Date(t.opened_at), c = t.closed_at ? new Date(t.closed_at) : null;
      var fl = (byTrade[t.id] || []).sort(function (a, b) { return new Date(a.executed_at) - new Date(b.executed_at); });
      var pnl = Number(t.pnl || 0);
      return { id: i + 1, dbid: t.id, sym: t.underlying || '', date: MN[o.getMonth()] + ' ' + o.getDate(), time: t.time_known === false ? '' : fmtTime(o), k: KMAP[t.strategy] || 'other', structure: t.structure || '', entry: px(Number(t.entry_price || 0)),
        exit: t.status === 'open' ? 'Still open' : (c ? 'Closed ' + MN[c.getMonth()] + ' ' + c.getDate() : 'Closed'), hold: holdText(o, c, t.time_known), pnl: Math.round(pnl), ror: '—',
        tags: (t.tags || []).map(function (g) { return [g, 'accent']; }), note: t.note || 'No note yet.',
        legs: fl.map(function (f) { var d = new Date(f.executed_at); return { time: MN[d.getMonth()] + ' ' + d.getDate() + ' ' + fmtTime(d), act: ACT[f.action] || f.action, qty: Math.abs(Number(f.quantity)), strike: String(f.strike), type: f.option_type === 'call' ? 'Call' : 'Put', px: px(Number(f.price || 0)) + ' net' }; }),
        fills: fl.length };
    });
  }
  function toLite(trades, fills) {
    var closedBy = {}; (fills || []).forEach(function (f) { if (f.action === 'BTC' || f.action === 'STC') closedBy[f.trade_id] = true; });
    return trades.map(function (t) {
      return { id: t.id, sym: t.underlying, k: t.strategy, name: NAMES[t.strategy] || 'Other', o: new Date(t.opened_at), c: t.closed_at ? new Date(t.closed_at) : null, pnl: Number(t.pnl || 0), tk: t.time_known !== false,
        qty: Number(t.quantity || 1), expired: t.status === 'closed' ? (fills && fills.length ? !closedBy[t.id] : null) : false, structure: t.structure || '', entry: Number(t.entry_price || 0), tags: t.tags || [] };
    });
  }
  window.TJImport = { toLite: toLite, parse: parse, save: save, toView: toView, NAMES: NAMES, money: money, px: px, fmtDate: fmtDate, holdText: holdText };
})();
