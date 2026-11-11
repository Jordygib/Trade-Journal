/* Quillstrike Session mode: a live companion for the trading day.
   You log each closed trade's result; Quillstrike tracks today's P/L against your own loss cap,
   runs your cool-off timer, and suggests a break after losses in a row. State is kept in this browser. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, KEY, S = null, tick = null;
  function today() { return Q.dayKey(new Date()); }
  function ruleVal(kind) { var r = (d.rules || []).filter(function (x) { return x.on && x.kind === kind; })[0]; return r ? Number(r.val) : null; }
  function save() { try { if (S) localStorage.setItem(KEY, JSON.stringify(S)); else localStorage.removeItem(KEY); } catch (e) {} }
  function loadS() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function prefs() { try { return JSON.parse(localStorage.getItem('qs_session_prefs') || '{}'); } catch (e) { return {}; } }
  function pnl() { return S.entries.reduce(function (s, x) { return s + x.pnl; }, 0); }
  function lossRun() { var n = 0; for (var i = S.entries.length - 1; i >= 0; i--) { if (S.entries[i].pnl < 0) n++; else break; } return n; }
  function state() {
    var now = Date.now(), p = pnl();
    if (S.cap && p <= -Math.abs(S.cap)) return { kind: 'done', why: 'You’ve reached your daily loss cap of ' + Q.money(S.cap) + '.' };
    if (S.maxTrades && S.entries.length >= S.maxTrades) return { kind: 'done', why: 'You’ve used all ' + Q.plural(S.maxTrades, 'trade') + ' you planned for today.' };
    if (S.breakUntil && now < S.breakUntil) return { kind: 'break', until: S.breakUntil };
    if (S.coolUntil && now < S.coolUntil) return { kind: 'cool', until: S.coolUntil };
    return { kind: 'ready' };
  }
  function mmss(ms) { ms = Math.max(0, ms); var m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m + ':' + String(s).padStart(2, '0'); }
  function modal(html) { var b = document.createElement('div'); b.className = 'qx-modal-back qx'; b.innerHTML = '<div class="qx-modal" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(b); return b; }

  function renderSetup() {
    var pr = prefs(), ml = ruleVal('max_loss');
    var cap = pr.cap || (ml ? ml * 2 : 500), mt = pr.maxTrades || ruleVal('max_trades') || 3, cool = pr.cool != null ? pr.cool : (ruleVal('cool_off') || 0), streak = pr.streak || ruleVal('loss_streak') || 2, brk = pr.brk || 15;
    var old = loadS(), oldHtml = '';
    if (old && old.day !== today() && !old.ended) oldHtml = '<div class="qx-note" style="margin-bottom:14px">You have an unfinished session from ' + E(old.day) + ' (' + Q.plural(old.entries.length, 'trade') + ', ' + Q.money(old.entries.reduce(function (s, x) { return s + x.pnl; }, 0), true) + '). <button class="qx-btn2" id="qx-old" style="min-height:32px;margin-left:8px">Save and close it</button></div>';
    el.innerHTML = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + oldHtml +
      '<div class="qx-grid qx-g2"><div class="qx-card"><h2>Start today’s session</h2><p class="qx-muted" style="margin:4px 0 14px">Set your limits before the open. Values come from My Rules where you have them, and you can change them here.</p>' +
      '<div class="qx-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">' +
      '<label class="qx-f">Daily loss cap ($)<input id="s-cap" type="number" min="0" step="10" value="' + cap + '"></label>' +
      '<label class="qx-f">Max trades today<input id="s-mt" type="number" min="0" step="1" value="' + mt + '"></label>' +
      '<label class="qx-f">Cool-off after a loss (min, 0 = off)<input id="s-cool" type="number" min="0" step="5" value="' + cool + '"></label>' +
      '<label class="qx-f">Suggest a break after this many losses in a row<input id="s-streak" type="number" min="1" step="1" value="' + streak + '"></label>' +
      '<label class="qx-f">Break length (min)<input id="s-brk" type="number" min="1" step="1" value="' + brk + '"></label></div>' +
      '<div class="qx-row" style="margin-top:16px"><button class="qx-btn" id="s-go">Start session</button><span class="qx-small qx-muted">Your session is kept in this browser until you end it.</span></div></div>' +
      '<div class="qx-card"><h2>How Session mode works</h2><ul class="qx-muted" style="margin:8px 0 0;padding-left:18px;line-height:1.7"><li><b style="color:#fff">Log each trade when you close it.</b> Just the P/L. Your full fills still come from your broker CSV later.</li><li><b style="color:#fff">Cool-off timer.</b> After a loss, planning your next trade is locked until your cool-off ends.</li><li><b style="color:#fff">Tilt check.</b> After losses in a row, Quillstrike suggests a short break.</li><li><b style="color:#fff">Done for the day.</b> Hitting your loss cap or trade limit locks planning for the rest of the day.</li><li><b style="color:#fff">Overrides are allowed,</b> but you’ll write down why, and they show up in your session history.</li></ul></div></div></div>';
    document.getElementById('s-go').onclick = function () {
      var v = function (id) { return Math.max(0, Number(document.getElementById(id).value) || 0); };
      var p = { cap: v('s-cap'), maxTrades: v('s-mt'), cool: v('s-cool'), streak: Math.max(1, v('s-streak')), brk: Math.max(1, v('s-brk')) };
      try { localStorage.setItem('qs_session_prefs', JSON.stringify(p)); } catch (e) {}
      S = { day: today(), started: Date.now(), cap: p.cap, maxTrades: p.maxTrades, cool: p.cool, streak: p.streak, brk: p.brk, entries: [], plans: [], breaks: 0, dismissed: 0, overrides: [], coolUntil: 0, breakUntil: 0 };
      save(); render();
    };
    var ob = document.getElementById('qx-old'); if (ob) ob.onclick = function () { S = old; endSession(true); };
  }

  function render() {
    if (!S || S.ended) { renderSetup(); return; }
    var p = pnl(), st = state(), capPct = S.cap ? Math.min(100, Math.max(0, -p / S.cap * 100)) : 0, lr = lossRun();
    var banner;
    if (st.kind === 'done') banner = '<div class="qx-card" style="border-color:rgba(255,122,138,.55);background:rgba(60,14,24,.55)"><h3 class="qx-loss">Done for the day</h3><p style="margin:4px 0 0">' + E(st.why) + ' Planning new trades is locked until tomorrow. Logging a trade you already took is always allowed.</p></div>';
    else if (st.kind === 'break') banner = '<div class="qx-card" style="border-color:rgba(56,189,248,.6)"><h3 class="qx-blue">On a break</h3><p style="margin:4px 0 0">Step away from the screen. Back in <b id="qx-cd" style="font-size:18px;color:#fff">' + mmss(st.until - Date.now()) + '</b>.</p></div>';
    else if (st.kind === 'cool') banner = '<div class="qx-card" style="border-color:rgba(240,199,102,.6)"><h3 class="qx-gold">Cool-off running</h3><p style="margin:4px 0 0">Your rule: wait ' + S.cool + ' min after a loss. Next trade can be planned in <b id="qx-cd" style="font-size:18px;color:#fff">' + mmss(st.until - Date.now()) + '</b>.</p></div>';
    else banner = '<div class="qx-card" style="border-color:rgba(87,227,181,.5)"><h3 class="qx-gain">Ready</h3><p style="margin:4px 0 0">You’re within your limits. Plan the next trade before you place it.</p></div>';
    var locked = st.kind !== 'ready';
    var h = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="qx-grid qx-g4">' +
      '<div class="qx-card"><div class="qx-label">Today’s P/L</div><div class="qx-kpi ' + (p < 0 ? 'qx-loss' : p > 0 ? 'qx-gain' : '') + '">' + Q.money(p, true) + '</div>' + (S.cap ? '<div class="qx-bar" style="margin-top:8px"><i style="width:' + capPct + '%;background:linear-gradient(90deg,#F0C766,#FF7A8A);box-shadow:0 0 14px rgba(255,122,138,.45)"></i></div><div class="qx-small qx-muted" style="margin-top:4px">' + Math.round(capPct) + '% of your ' + Q.money(S.cap) + ' loss cap used</div>' : '') + '</div>' +
      '<div class="qx-card"><div class="qx-label">Trades</div><div class="qx-kpi">' + S.entries.length + (S.maxTrades ? ' <span style="font-size:18px;color:#8396AD">/ ' + S.maxTrades + '</span>' : '') + '</div><div class="qx-small qx-muted">' + (S.maxTrades ? Math.max(0, S.maxTrades - S.entries.length) + ' left today' : 'No trade limit set') + '</div></div>' +
      '<div class="qx-card"><div class="qx-label">Losses in a row</div><div class="qx-kpi ' + (lr >= S.streak ? 'qx-loss' : '') + '">' + lr + '</div><div class="qx-small qx-muted">Break suggested at ' + S.streak + '</div></div>' +
      '<div class="qx-card"><div class="qx-label">Session time</div><div class="qx-kpi" id="qx-el">' + mmss(Date.now() - S.started) + '</div><div class="qx-small qx-muted">Breaks taken: ' + S.breaks + (S.overrides.length ? ' · Overrides: ' + S.overrides.length : '') + '</div></div>' +
      '</div>' + banner +
      '<div class="qx-grid qx-g2">' +
      '<div class="qx-card"><div class="qx-row qx-sp"><h2>Plan your next trade</h2>' + (locked ? '<span class="qx-chip ' + (st.kind === 'done' ? 'bad' : 'gold') + '">🔒 Locked</span>' : '') + '</div>' +
      (locked ? '<p class="qx-muted">' + (st.kind === 'done' ? 'You’re done for today.' : 'Wait for the timer to finish.') + ' If you really need to, you can override, and Quillstrike will record why.</p><button class="qx-btn2" id="s-ovr">Override the lock</button>' : planForm()) +
      '</div>' +
      '<div class="qx-card"><h2>Log a closed trade</h2><p class="qx-muted qx-small" style="margin:2px 0 10px">Enter the trade’s P/L as soon as it closes. Use a minus sign for a loss.</p><div class="qx-row" style="align-items:flex-end"><label class="qx-f" style="flex:1 1 120px">P/L ($)<input id="l-pnl" type="number" step="1" placeholder="-120 or 85"></label><label class="qx-f" style="flex:1 1 100px">Ticker (optional)<input id="l-sym" maxlength="8" placeholder="SPX"></label><button class="qx-btn" id="l-go">Log trade</button></div>' +
      (S.entries.length ? '<table class="qx-table" style="margin-top:12px"><tbody>' + S.entries.slice().reverse().map(function (x) { var t = new Date(x.at); return '<tr><td class="qx-muted">' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</td><td>' + E(x.sym || '') + (x.override ? ' <span class="qx-chip gold">override</span>' : '') + '</td><td class="r ' + (x.pnl < 0 ? 'qx-loss' : 'qx-gain') + '">' + Q.money(x.pnl, true) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
      '</div></div>' +
      (S.plans.length ? '<div class="qx-card"><h2 style="margin-bottom:8px">Plans made this session</h2><table class="qx-table"><tbody>' + S.plans.slice().reverse().map(function (x) { return '<tr><td class="qx-muted">' + new Date(x.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</td><td><b>' + E(x.sym) + '</b> ' + E(Q.names(x.strategy)) + '</td><td>Stop ' + (x.max_loss ? Q.money(x.max_loss) : '—') + ' · Target ' + (x.target ? Q.money(x.target) : '—') + '</td><td>' + (x.saved ? '<span class="qx-chip ok">Saved to Plans</span>' : '<span class="qx-chip">This browser only</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<div class="qx-row"><button class="qx-btn2" id="s-end">End session</button><button class="qx-btn2" id="s-brk">Take a ' + S.brk + '-min break now</button></div></div>';
    el.innerHTML = h;
    var lg = document.getElementById('l-go'); lg.onclick = logTrade;
    document.getElementById('l-pnl').onkeydown = function (e) { if (e.key === 'Enter') logTrade(); };
    document.getElementById('s-end').onclick = function () { endSession(false); };
    document.getElementById('s-brk').onclick = function () { startBreak(); };
    var ov = document.getElementById('s-ovr'); if (ov) ov.onclick = override;
    var pg = document.getElementById('p-go'); if (pg) pg.onclick = savePlan;
  }
  function planForm() {
    var opts = Object.keys(window.TJImport.NAMES).map(function (k) { return '<option value="' + k + '">' + E(window.TJImport.NAMES[k]) + '</option>'; }).join('');
    var ml = ruleVal('max_loss') || '';
    return '<div class="qx-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:8px">' +
      '<label class="qx-f">Ticker<input id="p-sym" maxlength="8" placeholder="SPX"></label><label class="qx-f">Strategy<select id="p-k">' + opts + '</select></label>' +
      '<label class="qx-f">Stop: max loss ($)<input id="p-ml" type="number" min="0" value="' + ml + '"></label><label class="qx-f">Profit target ($)<input id="p-tg" type="number" min="0"></label>' +
      '<label class="qx-f">Max contracts<input id="p-sz" type="number" min="1" value="' + (ruleVal('max_size') || 1) + '"></label></div>' +
      '<label class="qx-f" style="margin-top:10px">Why this trade?<textarea id="p-why" maxlength="400" placeholder="Setup, level, or reason"></textarea></label>' +
      '<div class="qx-row" style="margin-top:10px"><button class="qx-btn" id="p-go">Save plan</button><span class="qx-small qx-muted">Plans are matched to your imported trades on the Plans page.</span></div>';
  }
  function savePlan() {
    var sym = String(document.getElementById('p-sym').value || '').trim().toUpperCase().replace(/[^A-Z0-9.$^]/g, '').slice(0, 8);
    if (!sym) { document.getElementById('p-sym').focus(); return; }
    var p = { sym: sym, strategy: document.getElementById('p-k').value, max_loss: Number(document.getElementById('p-ml').value) || null, target: Number(document.getElementById('p-tg').value) || null, max_size: Number(document.getElementById('p-sz').value) || null, reason: String(document.getElementById('p-why').value || '').slice(0, 400), at: Date.now(), saved: false };
    S.plans.push(p); save(); render();
    if (d.sb && d.user) d.sb.from('plans').insert({ user_id: d.user.id, underlying: p.sym, strategy: p.strategy, max_loss: p.max_loss, target: p.target, max_size: p.max_size, reason: p.reason || null, source: 'session' }).then(function (r) { if (!r.error) { p.saved = true; save(); if (!document.querySelector('.qx-modal-back')) render(); } }, function () {});
  }
  function logTrade() {
    var inp = document.getElementById('l-pnl'), v = Number(inp.value);
    if (inp.value === '' || isNaN(v)) { inp.focus(); return; }
    var st = state(), sym = String(document.getElementById('l-sym').value || '').trim().toUpperCase().slice(0, 8);
    S.entries.push({ pnl: v, sym: sym, at: Date.now(), override: st.kind !== 'ready' });
    if (v < 0 && S.cool) S.coolUntil = Date.now() + S.cool * 60000;
    save(); render();
    var ns = state();
    if (ns.kind === 'done') { var p = pnl(); modal('<h2>That’s the day</h2><p class="qx-muted">' + E(ns.why) + ' Today’s P/L: <b style="color:#fff">' + Q.money(p, true) + '</b>. Planning is locked until tomorrow.</p><div class="qx-row" style="margin-top:14px"><button class="qx-btn" data-x="end">End session</button><button class="qx-btn2" data-x="close">Stay on this page</button></div>').onclick = function (e) { var x = e.target.getAttribute('data-x'); if (!x) return; this.remove(); if (x === 'end') endSession(false); }; return; }
    if (v < 0 && lossRun() >= S.streak) {
      modal('<h2>' + lossRun() + ' losses in a row</h2><p class="qx-muted">This is when most rule breaks happen. Want to take a ' + S.brk + '-minute break before the next trade?</p><div class="qx-row" style="margin-top:14px"><button class="qx-btn" data-x="brk">Start ' + S.brk + '-min break</button><button class="qx-btn2" data-x="no">I’m fine, continue</button></div>').onclick = function (e) { var x = e.target.getAttribute('data-x'); if (!x) return; this.remove(); if (x === 'brk') startBreak(); else { S.dismissed++; save(); } };
    }
  }
  function startBreak() { S.breakUntil = Date.now() + S.brk * 60000; S.breaks++; save(); render(); }
  function override() {
    var b = modal('<h2>Override the lock?</h2><p class="qx-muted">Write down why. It’s saved with today’s session so you can review it later.</p><textarea id="o-why" maxlength="300" style="margin-top:6px" placeholder="Why are you trading now?"></textarea><div class="qx-row" style="margin-top:14px"><button class="qx-btn" data-x="ok">Unlock for one trade</button><button class="qx-btn2" data-x="no">Keep it locked</button></div>');
    b.onclick = function (e) { var x = e.target.getAttribute('data-x'); if (!x) return; if (x === 'ok') { var w = String(b.querySelector('#o-why').value || '').trim(); if (!w) { b.querySelector('#o-why').focus(); return; } S.overrides.push({ at: Date.now(), why: w.slice(0, 300), state: state().kind }); S.coolUntil = 0; S.breakUntil = 0; if (state().kind === 'done') { S.cap = 0; S.maxTrades = 0; S.capOverridden = true; } save(); } b.remove(); render(); };
  }
  function endSession(silent) {
    var p = S.entries.reduce(function (s, x) { return s + x.pnl; }, 0), hit = S.capOverridden || (S.cap && p <= -Math.abs(S.cap)) || false;
    var row = { user_id: d.user ? d.user.id : null, day: S.day, started_at: new Date(S.started).toISOString(), ended_at: new Date().toISOString(), pnl: Math.round(p * 100) / 100, trades: S.entries.length, loss_cap: S.cap || null, max_trades: S.maxTrades || null, hit_cap: !!hit, breaks_taken: S.breaks, tilt_dismissed: S.dismissed, overrides: S.overrides.length, override_notes: S.overrides.map(function (o) { return o.why; }) };
    var finish = function (ok) {
      var sum = S; S.ended = true; S = null; save();
      if (silent) { render(); return; }
      el.innerHTML = '<div class="qx"><div class="qx-card" style="max-width:640px"><h2>Session saved</h2><p class="qx-muted">' + E(sum.day) + ' · ' + Q.plural(sum.entries.length, 'trade') + ' · ' + Q.money(p, true) + '</p><ul style="line-height:1.8;padding-left:18px"><li>Breaks taken: <b>' + sum.breaks + '</b></li><li>Tilt checks skipped: <b>' + sum.dismissed + '</b></li><li>Overrides: <b>' + sum.overrides.length + '</b></li><li>' + (hit ? '<span class="qx-loss">Hit your loss cap</span>' : '<span class="qx-gain">Stayed within your loss cap</span>') + '</li></ul>' + (ok ? '' : '<p class="qx-small qx-muted">Couldn’t save to your account (the sessions table may not be set up yet), so this summary isn’t stored.</p>') + '<div class="qx-row"><a class="qx-btn" href="discipline.html">See my discipline</a><a class="qx-btn2" href="import.html">Import today’s trades</a></div></div></div>';
    };
    if (d.sb && d.user && S.entries.length) d.sb.from('sessions').upsert(row, { onConflict: 'user_id,day' }).then(function (r) { finish(!r.error); }, function () { finish(false); });
    else finish(true);
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1];
    KEY = 'qs_session_' + (d.user ? d.user.id : 'anon');
    var s = loadS(); S = s && !s.ended && s.day === today() ? s : null;
    render();
    tick = setInterval(function () {
      if (!S) return;
      var st = state(), cd = document.getElementById('qx-cd'), e2 = document.getElementById('qx-el');
      if (e2) e2.textContent = mmss(Date.now() - S.started);
      if (cd) { if (st.kind === 'cool' || st.kind === 'break') cd.textContent = mmss(st.until - Date.now()); else if (!document.querySelector('.qx-modal-back') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(); }
    }, 1000);
  });
})();
