/* Quillstrike sample-trades mode: realistic demo trades for new users, generated in the browser and never saved. */
(function () {
  var KEY = 'qs_demo';
  try { var q = new URLSearchParams(location.search); if (q.get('demo') === '1') { localStorage.setItem(KEY, '1'); q.delete('demo'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } } catch (e) {}
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var PX = { SPX: 5800, XSP: 580, SPY: 578, QQQ: 498, IWM: 225, TSLA: 250, NVDA: 200, AAPL: 228 };
  var W = { SPX: 10, XSP: 1, SPY: 1, QQQ: 1, IWM: 1, TSLA: 5, NVDA: 5, AAPL: 5 };
  function build() {
    var r = rng(20261108), pick = function (a) { return a[Math.floor(r() * a.length)]; }, between = function (a, b) { return a + r() * (b - a); };
    var plan = [['pcs', 30], ['ic', 24], ['ccs', 14], ['fly', 10], ['bwb', 8], ['long_call', 8], ['long_put', 6]], tot = 100;
    var strat = function () { var x = r() * tot; for (var i = 0; i < plan.length; i++) { x -= plan[i][1]; if (x < 0) return plan[i][0]; } return 'pcs'; };
    var trades = [], fills = [], day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - 125);
    var lastLoss = null, n = 0;
    while (day < new Date() && n < 260) {
      day = new Date(day.getTime() + 864e5); var wd = day.getDay(); if (wd === 0 || wd === 6) continue;
      var count = r() < 0.55 ? 1 : (r() < 0.75 ? 2 : 3);
      var mins = [];
      for (var c = 0; c < count; c++) mins.push(Math.round(between(5, 375)));
      mins.sort(function (a, b) { return a - b; });
      mins.forEach(function (m) {
        var k = strat(), sym = /long_/.test(k) ? pick(['TSLA', 'NVDA', 'AAPL', 'SPY', 'QQQ']) : pick(['SPX', 'SPX', 'XSP', 'SPY', 'QQQ', 'IWM']);
        var o = new Date(day); o.setHours(9, 30 + m, Math.floor(r() * 60), 0);
        var dte = k === 'fly' || k === 'bwb' || k === 'ic' ? (r() < 0.7 ? 0 : pick([1, 2, 7])) : k === 'pcs' || k === 'ccs' ? pick([0, 1, 7, 14, 21, 30, 45]) : pick([3, 7, 14, 30]);
        var exp = new Date(day.getTime() + dte * 864e5); while (exp.getDay() === 0 || exp.getDay() === 6) exp = new Date(exp.getTime() + 864e5);
        var p = PX[sym], w = W[sym], atm = Math.round(p / w) * w, off = Math.round(p * between(0.01, 0.025) / w) * w, width = sym === 'SPX' ? 10 : (sym === 'XSP' ? 2 : 5);
        var legs, credit, maxLoss;
        if (k === 'pcs') { legs = [['STO', atm - off, 'put'], ['BTO', atm - off - width, 'put']]; credit = width * between(0.15, 0.3); }
        else if (k === 'ccs') { legs = [['STO', atm + off, 'call'], ['BTO', atm + off + width, 'call']]; credit = width * between(0.15, 0.3); }
        else if (k === 'ic') { legs = [['STO', atm - off, 'put'], ['BTO', atm - off - width, 'put'], ['STO', atm + off, 'call'], ['BTO', atm + off + width, 'call']]; credit = width * between(0.2, 0.35); }
        else if (k === 'fly') { legs = [['BTO', atm - width, 'call'], ['STO', atm, 'call'], ['STO', atm, 'call'], ['BTO', atm + width, 'call']]; credit = -width * between(0.15, 0.3); }
        else if (k === 'bwb') { legs = [['BTO', atm - width, 'put'], ['STO', atm - 2 * width, 'put'], ['STO', atm - 2 * width, 'put'], ['BTO', atm - 4 * width, 'put']]; credit = width * between(0.02, 0.1); }
        else { var tp = k === 'long_call' ? 'call' : 'put'; legs = [['BTO', tp === 'call' ? atm + off / 2 : atm - off / 2, tp]]; credit = -Math.max(0.5, p * between(0.004, 0.012)); }
        var mult = sym === 'SPX' ? 1 : 1, unit = Math.abs(credit) * 100;
        maxLoss = credit > 0 ? (width - credit) * 100 : unit;
        var early = m < 60, thu = wd === 4, afterLoss = lastLoss && (o - lastLoss) < 75 * 6e4;
        var winP = { pcs: 0.9, ccs: 0.86, ic: 0.86, fly: 0.5, bwb: 0.8, long_call: 0.5, long_put: 0.46 }[k];
        if (early) winP -= 0.2; if (thu) winP -= 0.16; if (afterLoss) winP -= 0.22;
        var win = r() < winP, pnl;
        if (credit > 0) pnl = win ? unit * between(0.5, 0.95) : -Math.min(maxLoss, unit * between(0.8, 1.9));
        else pnl = win ? unit * between(0.6, k === 'fly' ? 3.5 : 1.6) : -unit * between(0.4, 1);
        pnl -= legs.length * 1.3; pnl = Math.round(pnl * 100) / 100;
        var held = dte === 0 ? between(15, Math.max(30, 390 - m - 5)) * 6e4 : between(0.3, Math.max(0.5, dte * 0.7)) * 864e5;
        var cl = new Date(Math.min(o.getTime() + held, exp.getTime() + 16 * 36e5 - 30 * 6e4, Date.now() - 6e4)); if (cl <= o) cl = new Date(o.getTime() + 20 * 6e4);
        var expired = credit > 0 && win && r() < 0.35;
        if (expired) cl = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate(), 16, 0, 0);
        var id = 'demo-' + (++n), strikes = legs.map(function (l) { return l[1] + (l[2] === 'put' ? 'P' : 'C'); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        trades.push({ id: id, underlying: sym, opened_at: o.toISOString(), closed_at: cl.toISOString(), strategy: k, structure: legs.length + (legs.length === 1 ? ' leg' : ' legs') + ' · ' + strikes.join('/') + ' · ' + MS[exp.getMonth()] + ' ' + exp.getDate(),
          pnl: pnl, status: 'closed', quantity: 1, time_known: true, entry_price: Math.round(Math.abs(credit) * 100) / 100, tags: afterLoss && !win ? ['revenge'] : [], notes: null, source: 'demo' });
        legs.forEach(function (l) {
          fills.push({ trade_id: id, executed_at: o.toISOString(), action: l[0], strike: l[1], option_type: l[2], quantity: 1, price: Math.round(between(0.2, 3) * 100) / 100, expiration: ymd(exp) });
          if (!expired) fills.push({ trade_id: id, executed_at: cl.toISOString(), action: l[0] === 'STO' ? 'BTC' : 'STC', strike: l[1], option_type: l[2], quantity: 1, price: Math.round(between(0.05, 2) * 100) / 100, expiration: ymd(exp) });
        });
        if (pnl < 0) lastLoss = cl;
      });
    }
    trades.sort(function (a, b) { return a.opened_at < b.opened_at ? 1 : -1; });
    return { trades: trades, fills: fills };
  }
  window.QSDemo = {
    active: function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    start: function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} location.href = 'dashboard.html'; },
    stop: function (to) { try { localStorage.removeItem(KEY); } catch (e) {} location.href = to || 'dashboard.html'; },
    build: build
  };
})();
