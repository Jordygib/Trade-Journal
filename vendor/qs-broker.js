/* Quillstrike broker connection (SnapTrade, read-only). Adds the Connect card on the Import page and keeps trades synced on every page. */
(function () {
  var page = (location.pathname.split('/').pop() || 'index.html');
  var FN = 'snaptrade', SYNC_EVERY = 6 * 3600 * 1000;
  var CSS = '.qb{max-width:1360px;margin:14px auto 0;padding:0 24px;box-sizing:border-box;width:100%}' +
    '.qb-c{position:relative;border:1px solid rgba(75,214,168,.45);background:linear-gradient(135deg,rgba(75,214,168,.09),rgba(12,19,31,.92));border-radius:10px;padding:18px 20px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;box-shadow:0 0 28px rgba(75,214,168,.12)}' +
    '.qb-c h3{margin:0 0 4px;font-size:16px;font-weight:600;color:#EEF3FA}.qb-c p{margin:0;font-size:12.5px;line-height:1.5;color:#9AACC1;max-width:640px}' +
    '.qb-b{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 18px;border-radius:7px;border:1px solid #4BD6A8;background:#4BD6A8;color:#06121C;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}' +
    '.qb-b:hover{box-shadow:0 0 18px rgba(75,214,168,.55)}.qb-b[disabled]{opacity:.6;cursor:default}' +
    '.qb-g{background:transparent;color:#EEF3FA;border-color:#2C3F5C}.qb-g:hover{box-shadow:none;border-color:#4BD6A8}' +
    '.qb-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.qb-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#4BD6A8;box-shadow:0 0 10px #4BD6A8;margin-right:8px;animation:qbp 2s ease-in-out infinite}' +
    '.qb-warn .qb-dot{background:#F0C766;box-shadow:0 0 10px #F0C766}.qb-msg{font-size:12.5px;color:#9AACC1;width:100%}.qb-msg b{color:#EEF3FA}.qb-err{color:#FF8C8C}' +
    '@keyframes qbp{50%{opacity:.45}}';
  function css() { if (document.getElementById('qb-css')) return; var s = document.createElement('style'); s.id = 'qb-css'; s.textContent = CSS; document.head.appendChild(s); }
  function whenEl(sel) { return new Promise(function (res) { var e = document.querySelector(sel); if (e) return res(e); var mo = new MutationObserver(function () { var x = document.querySelector(sel); if (x) { mo.disconnect(); res(x); } }); mo.observe(document.documentElement, { childList: true, subtree: true }); }); }
  function uid() { return (window.TJ_SESSION && window.TJ_SESSION.user && window.TJ_SESSION.user.id) || ''; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function call(action, extra) {
    return Promise.resolve(window.TJ_READY).then(function () {
      return window.tj.functions.invoke(FN, { body: Object.assign({ action: action }, extra || {}) });
    }).then(function (r) {
      if (r.error) {
        var ctx = r.error.context; // FunctionsHttpError carries the response
        if (ctx && ctx.json) return ctx.json().then(function (j) { throw new Error((j && j.error) || r.error.message); }, function () { throw new Error(r.error.message); });
        throw new Error(r.error.message || 'Request failed');
      }
      return r.data;
    });
  }

  /* ---- turn SnapTrade activities into the same "orders" the CSV importer builds, then reuse its grouping ---- */
  function when(s) {
    s = String(s || ''); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); if (!m) return null;
    var hasTime = m[4] != null && !(m[4] === '00' && m[5] === '00');
    if (hasTime) { var d = new Date(s); if (!isNaN(d)) return { date: d, hasTime: true }; }
    return { date: new Date(+m[1], +m[2] - 1, +m[3], 12, 0), hasTime: false };
  }
  function ymdDate(s) { var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 16, 0) : null; }
  function buildOrders(acts) {
    var warn = [], list = [];
    acts.forEach(function (a) {
      var w = when(a.when), ex = ymdDate(a.exp); if (!w || !ex || !a.ticker || a.strike == null) { warn.push('Skipped an activity with missing details.'); return; }
      var isExp = a.type !== 'BUY' && a.type !== 'SELL';
      var q = Math.abs(Number(a.units) || 0); if (!q) return;
      var mult = a.mini ? 10 : 100;
      list.push({ a: a, w: w, ex: ex, q: q, isExp: isExp, mult: mult });
    });
    list.sort(function (x, y) { return x.w.date - y.w.date; });
    var pos = {}; // running position per contract, to label open vs close when the broker doesn't
    var groups = {}, order = [];
    list.forEach(function (it) {
      var a = it.a, key = [a.acct, a.ref || (a.ticker + '|' + (it.w.hasTime ? it.w.date.toISOString().slice(0, 16) : a.when.slice(0, 10)))].join('|');
      var ck = [a.acct, a.ticker, a.exp, a.strike, a.right].join('|');
      var signed = it.isExp ? 0 : (a.type === 'BUY' ? it.q : -it.q), action;
      if (it.isExp) action = 'EXP';
      else if (a.ot === 'BUY_TO_OPEN') action = 'BTO'; else if (a.ot === 'BUY_TO_CLOSE') action = 'BTC'; else if (a.ot === 'SELL_TO_OPEN') action = 'STO'; else if (a.ot === 'SELL_TO_CLOSE') action = 'STC';
      else { var p = pos[ck] || 0; action = signed > 0 ? (p < 0 ? 'BTC' : 'BTO') : (p > 0 ? 'STC' : 'STO'); }
      if (!it.isExp) pos[ck] = (pos[ck] || 0) + signed;
      var g = groups[key]; if (!g) { g = groups[key] = { id: String(a.ref || a.id), when: it.w.date, hasTime: it.w.hasTime, underlying: String(a.ticker).toUpperCase(), legs: [], cash: 0, fees: 0, mult: it.mult, ids: [] }; order.push(g); }
      g.ids.push(a.id);
      g.legs.push({ underlying: g.underlying, qty: it.isExp ? it.q : signed, expiration: it.ex, strike: Number(a.strike), type: String(a.right || '').toLowerCase() === 'put' ? 'put' : 'call', action: action });
      if (!it.isExp) g.cash += -signed * (Number(a.price) || 0) * it.mult;
      g.fees += Math.abs(Number(a.fee) || 0);
      if (it.w.date > g.when) { /* keep earliest time */ }
    });
    var orders = order.map(function (g) {
      var unit = g.legs.reduce(function (x, l) { return window.TJImport.gcd(x, l.qty); }, 0) || 1;
      var allExp = g.legs.every(function (l) { return l.action === 'EXP'; });
      return { id: g.id, prefix: 'st', when: g.when, hasTime: g.hasTime, underlying: g.underlying, net: allExp ? 0 : g.cash / (unit * g.mult), unit: unit, cash: g.cash, fees: g.fees, legs: g.legs };
    });
    return { orders: orders, warnings: warn };
  }
  function toResult(acts) {
    var b = buildOrders(acts); if (!b.orders.length) return { ok: false, error: 'No option trades were found.' };
    var trades = window.TJImport.group(b.orders, new Date(), true);
    var fills = 0; trades.forEach(function (t) { t.orders.forEach(function (o) { fills += o.legs.length; }); });
    return { ok: true, broker: 'snaptrade', label: 'Broker connection', feesKnown: true, warnings: b.warnings, orders: b.orders.length, fills: fills, trades: trades, net: trades.reduce(function (s, t) { return s + t.pnl; }, 0) };
  }

  var running = null;
  function needImporter() { if (window.TJImport) return Promise.resolve(); return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'vendor/tj-import.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); }); }
  function sync(opts) {
    opts = opts || {};
    if (running) return running;
    running = needImporter().then(function () { return call('sync', { days: opts.days || 730 }); }).then(function (r) {
      var res = toResult(r.activities || []);
      if (!res.ok) { ls('qs_broker_sync_' + uid(), String(Date.now())); return { trades: 0, fills: 0, accounts: r.accounts }; }
      return window.TJImport.save(window.tj, res, 'Broker sync', 'snaptrade').then(function (s) {
        ls('qs_broker_sync_' + uid(), String(Date.now()));
        return { trades: s.trades, fills: s.fills, accounts: r.accounts };
      });
    }).then(function (x) { running = null; return x; }, function (e) { running = null; throw e; });
    return running;
  }

  /* ---- Import page card ---- */
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago'); var d = Math.round(h / 24); return d + (d === 1 ? ' day ago' : ' days ago'); }
  function paintCard(box, st, note) {
    var warn = st.connected && st.status !== 'active';
    var h = '';
    if (!st.connected) {
      h = '<div><h3>Connect your broker</h3><p>Sign in with your broker through SnapTrade and your trades sync automatically. Read-only: Quillstrike can never place trades or move money. No more CSV files.</p></div><div class="qb-row"><button class="qb-b" id="qb-go">Connect broker</button></div>';
    } else if (warn) {
      h = '<div><h3><span class="qb-dot"></span>Reconnect your broker</h3><p>Your broker connection needs to be approved again. Your existing trades are safe.</p></div><div class="qb-row"><button class="qb-b" id="qb-go">Reconnect</button><button class="qb-b qb-g" id="qb-off">Disconnect</button></div>';
    } else {
      var last = st.last_sync_at ? new Date(st.last_sync_at).getTime() : 0;
      h = '<div><h3><span class="qb-dot"></span>Broker connected</h3><p>Trades sync automatically. ' + (last ? 'Last synced <b>' + ago(last) + '</b>. ' : '') + 'Brokers report closed trades once a day, so today’s trades usually appear by the next morning.</p></div><div class="qb-row"><button class="qb-b" id="qb-sync">Sync now</button><button class="qb-b qb-g" id="qb-off">Disconnect</button></div>';
    }
    h += '<div class="qb-msg" id="qb-msg">' + (note || '') + '</div>';
    box.innerHTML = h; box.className = 'qb-c' + (warn ? ' qb-warn' : '');
    var msg = function (t, bad) { var m = box.querySelector('#qb-msg'); m.className = 'qb-msg' + (bad ? ' qb-err' : ''); m.innerHTML = t; };
    var go = box.querySelector('#qb-go'), sy = box.querySelector('#qb-sync'), off = box.querySelector('#qb-off');
    if (go) go.onclick = function () { go.disabled = true; msg('Opening your broker sign-in…'); call('start').then(function (r) { location.href = r.url; }, function (e) { go.disabled = false; msg(e.message, true); }); };
    if (sy) sy.onclick = function () { sy.disabled = true; sy.textContent = 'Syncing…'; sync({ days: 730 }).then(function (r) { msg('Synced. <b>' + r.trades + '</b> trades from ' + r.accounts + ' account' + (r.accounts === 1 ? '' : 's') + '. <a href="trades.html" style="color:#4BD6A8">View trades</a>'); sy.disabled = false; sy.textContent = 'Sync now'; refresh(box); }, function (e) { sy.disabled = false; sy.textContent = 'Sync now'; if (e.message === 'needs_reconnect') refresh(box); else msg(e.message, true); }); };
    if (off) off.onclick = function () { if (!confirm('Disconnect your broker? Trades already in your journal stay. Syncing stops.')) return; off.disabled = true; call('disconnect').then(function () { ls('qs_broker_sync_' + uid(), null); refresh(box); }, function (e) { off.disabled = false; msg(e.message, true); }); };
  }
  function refresh(box, note) { return call('status').then(function (st) { paintCard(box, st, note); return st; }, function (e) { paintCard(box, { connected: false }, '<span class="qb-err">' + e.message + '</span>'); }); }
  function importCard() {
    css();
    whenEl('.pg-top').then(function (top) {
      if (document.getElementById('qb-card')) return;
      var wrap = document.createElement('div'); wrap.className = 'qb'; wrap.id = 'qb-card'; var box = document.createElement('div'); box.className = 'qb-c'; wrap.appendChild(box);
      top.insertAdjacentElement('afterend', wrap);
      var q = new URLSearchParams(location.search).get('broker'); var note = '';
      var texts = { denied: 'The broker sign-in was cancelled. Nothing was connected.', expired: 'That sign-in link expired. Please try again.', error: 'Something went wrong connecting your broker. Please try again.' };
      if (texts[q]) note = '<span class="qb-err">' + texts[q] + '</span>';
      refresh(box, note).then(function (st) {
        if (q === 'connected' && st && st.connected) {
          history.replaceState(null, '', 'import.html');
          paintCard(box, st, 'Connected! Pulling in your trades…');
          sync({ days: 730 }).then(function (r) { return refresh(box, 'First sync done: <b>' + r.trades + '</b> trades from ' + r.accounts + ' account' + (r.accounts === 1 ? '' : 's') + '. <a href="trades.html" style="color:#4BD6A8">View trades</a>'); }, function (e) { refresh(box, '<span class="qb-err">' + e.message + '</span>'); });
        }
      });
    });
  }

  /* ---- background sync on any page, at most every 6 hours ---- */
  function auto() {
    Promise.resolve(window.TJ_READY).then(function () {
      if (!window.tj || !window.TJ_SESSION) return;
      if (page === 'import.html') return; // the card handles it
      var last = Number(ls('qs_broker_sync_' + uid())) || 0; var flag = ls('qs_broker_on_' + uid());
      if (flag === '0') return;
      if (Date.now() - last < SYNC_EVERY && flag === '1') return;
      call('status').then(function (st) {
        ls('qs_broker_on_' + uid(), st.connected && st.status === 'active' ? '1' : '0');
        if (st.connected && st.status === 'active' && Date.now() - last >= SYNC_EVERY) sync({ days: 730 }).then(function () { if (window.QSFresh && window.QSFresh.then) {} }, function () {});
      }, function () {});
    });
  }
  window.QSBroker = { sync: sync, status: function () { return call('status'); }, buildOrders: buildOrders, toResult: toResult };
  if (page === 'import.html') importCard();
  auto();
})();
