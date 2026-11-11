/* Quillstrike Discipline page: discipline score, rule streaks, calendar, badges. */
(function () {
  var Q = window.QS, E = Q.esc;
  function ring(score) {
    var r = 54, c = 2 * Math.PI * r, v = score == null ? 0 : score, off = c * (1 - v / 100);
    var col = v >= 85 ? '#57E3B5' : v >= 65 ? '#F0C766' : '#FF7A8A';
    return '<svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="' + r + '" fill="none" stroke="#132036" stroke-width="12"/>' +
      '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 70 70)" style="filter:drop-shadow(0 0 8px ' + col + '88)"/>' +
      '<text x="70" y="78" text-anchor="middle" font-family="Barlow Semi Condensed, Barlow, sans-serif" font-size="38" font-weight="700" fill="#fff">' + (score == null ? '—' : score) + '</text></svg>';
  }
  function calendar(days) {
    var map = {}; days.forEach(function (d) { map[d.key] = d; });
    var end = new Date(); end.setHours(0, 0, 0, 0);
    var start = new Date(end); start.setDate(start.getDate() - 7 * 17); while (start.getDay() !== 1) start.setDate(start.getDate() + 1);
    var cols = [], cur = new Date(start);
    while (cur <= end) { var col = []; for (var i = 0; i < 5; i++) { var d = new Date(cur); d.setDate(d.getDate() + i); col.push(d); } cols.push(col); cur.setDate(cur.getDate() + 7); }
    var html = '<div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px">';
    html += '<div style="display:grid;grid-template-rows:repeat(5,16px);gap:4px;font-size:10px;color:#8396AD;padding-right:4px"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span></div>';
    cols.forEach(function (col) {
      html += '<div style="display:grid;grid-template-rows:repeat(5,16px);gap:4px">';
      col.forEach(function (d) {
        var k = Q.dayKey(d), x = map[k], bg = '#0B1220', bd = '#17233A', tip = Q.fdate(d, true) + ': no checked trades';
        if (d > end) { html += '<span style="width:16px;height:16px"></span>'; return; }
        if (x) { if (x.clean) { bg = 'rgba(87,227,181,.75)'; bd = 'rgba(87,227,181,.9)'; tip = Q.fdate(d, true) + ': all rules followed (' + Q.plural(x.checked, 'trade') + ')'; } else { bg = 'rgba(255,122,138,.7)'; bd = 'rgba(255,122,138,.9)'; tip = Q.fdate(d, true) + ': ' + Q.plural(x.broken, 'trade') + ' broke a rule'; } }
        html += '<span title="' + E(tip) + '" style="width:16px;height:16px;border-radius:4px;background:' + bg + ';border:1px solid ' + bd + ';box-sizing:border-box' + (x && x.clean ? ';box-shadow:0 0 8px rgba(87,227,181,.35)' : '') + '"></span>';
      });
      html += '</div>';
    });
    return html + '</div><div class="qx-row qx-small qx-muted" style="margin-top:8px;gap:14px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:rgba(87,227,181,.75);margin-right:5px"></i>Clean day</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:rgba(255,122,138,.7);margin-right:5px"></i>Broke a rule</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#0B1220;border:1px solid #17233A;margin-right:5px"></i>No checked trades</span></div>';
  }
  function ruleLabel(r) {
    if (r.kind === 'custom') return r.title || ('Tag “' + r.tag + '”');
    var v = r.val, n = Q.RULE_NAMES[r.kind] || r.kind;
    if (r.kind === 'max_loss') return n + ': $' + v; if (r.kind === 'no_before') return n + ' ' + v; if (r.kind === 'cool_off') return n + ': ' + v + ' min';
    return n + ': ' + v;
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    var el = a[0], d = a[1], D = Q.discipline(d.rules, d.lite);
    var h = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d);
    if (!D.hasRules) {
      h += '<div class="qx-card qx-empty"><h2>Add a rule to start your streak</h2><p>Your discipline score comes from the rules you set on My Rules: max loss, max trades per day, cool-off after a loss, and more. Quillstrike checks every imported trade against them.</p><a class="qx-btn" href="my-rules.html">Set up my rules</a></div></div>';
      el.innerHTML = h; return;
    }
    var scoreTxt = D.score == null ? 'Import trades to get a score.' : D.score >= 85 ? 'Excellent. You’re trading your plan.' : D.score >= 65 ? 'Solid, with a few slips to clean up.' : 'Your rules are getting broken often. Pick one rule to focus on this week.';
    h += '<div class="qx-grid qx-g4">' +
      '<div class="qx-card" style="display:flex;align-items:center;gap:14px;grid-column:span 2;min-width:0"><div style="flex:none">' + ring(D.score) + '</div><div><div class="qx-label">Discipline score</div><p style="margin:4px 0 6px;font-size:15px;color:#fff">' + E(scoreTxt) + '</p><p class="qx-small qx-muted" style="margin:0">Based on your last ' + Q.plural(D.window, 'trading day') + ': 70% from trades that followed every rule (' + Q.pct(D.follow) + '), 30% from clean days (' + Q.pct(D.cleanDays) + ').</p></div></div>' +
      '<div class="qx-card"><div class="qx-label">Current streak</div><div class="qx-kpi ' + (D.streak ? 'qx-gold' : '') + '">' + (D.streak ? '🔥 ' : '') + Q.plural(D.streak, 'day') + '</div><div class="qx-small qx-muted">Clean trading days in a row. Days you don’t trade don’t break it.</div></div>' +
      '<div class="qx-card"><div class="qx-label">Best streak</div><div class="qx-kpi">' + Q.plural(D.best, 'day') + '</div><div class="qx-small qx-muted">' + (D.bestEnd ? 'Ended ' + Q.fdate(D.bestEnd, true) : 'Start one today') + '</div></div>' +
      '</div>';
    h += '<div class="qx-card"><div class="qx-row qx-sp" style="margin-bottom:12px"><h2>Rule calendar</h2><span class="qx-small qx-muted">All-time rule-follow rate: <b style="color:#fff">' + Q.pct(D.allFollow) + '</b> of checked trades</span></div>' + calendar(D.days) + '</div>';
    // per rule
    var rows = Object.keys(D.ev.perRule).map(function (k) { return D.ev.perRule[k]; });
    h += '<div class="qx-grid qx-g2"><div class="qx-card"><h2 style="margin-bottom:10px">Rule by rule</h2><div class="qx-wrapx"><table class="qx-table"><thead><tr><th>Rule</th><th class="r">Checked</th><th class="r">Followed</th><th class="r">Avg when followed</th><th class="r">Avg when broken</th></tr></thead><tbody>' +
      rows.map(function (s) { var f = s.checked ? Math.round((s.checked - s.breaks) / s.checked * 100) : null; return '<tr><td>' + E(ruleLabel(s.rule)) + '</td><td class="r">' + s.checked + '</td><td class="r ' + (f >= 90 ? 'qx-gain' : f < 70 ? 'qx-loss' : '') + '">' + Q.pct(f) + '</td><td class="r">' + (s.folN ? Q.money(s.folSum / s.folN, true) : '—') + '</td><td class="r">' + (s.brkN ? Q.money(s.brkSum / s.brkN, true) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="qx-small qx-muted" style="margin:10px 0 0">Rules only check trades opened after you created them. Averages describe your own past trades.</p></div>';
    // quarters
    h += '<div class="qx-card"><h2 style="margin-bottom:10px">Trend by quarter</h2>' + (D.quarters.length ? D.quarters.slice(-6).map(function (q) { return '<div style="margin-bottom:10px"><div class="qx-row qx-sp qx-small"><span>' + E(q.q) + ' · ' + Q.plural(q.n, 'trade') + '</span><b>' + q.pct + '%</b></div><div class="qx-bar"><i style="width:' + q.pct + '%"></i></div></div>'; }).join('') : '<p class="qx-muted">No checked trades yet.</p>') + '</div></div>';
    // badges
    h += '<div class="qx-card"><div class="qx-row qx-sp" style="margin-bottom:12px"><h2>Badges</h2><span class="qx-small qx-muted">Earned for following your rules, never for the size of a win.</span></div><div class="qx-grid qx-g4">' +
      D.badges.map(function (b) { return '<div style="padding:14px;border-radius:10px;border:1px solid ' + (b.got ? 'rgba(240,199,102,.55)' : '#1B283B') + ';background:' + (b.got ? 'rgba(240,199,102,.07)' : '#0A111C') + (b.got ? ';box-shadow:0 0 22px rgba(227,179,65,.18)' : '') + '"><div style="font-size:26px;' + (b.got ? '' : 'filter:grayscale(1);opacity:.45') + '">' + b.icon + '</div><div style="font-weight:700;color:#fff;margin-top:4px">' + E(b.name) + '</div><div class="qx-small qx-muted">' + E(b.desc) + '</div><div class="qx-small" style="margin-top:6px;color:' + (b.got ? '#F0C766' : '#8396AD') + '">' + (b.got ? 'Earned' : E(b.prog)) + '</div></div>'; }).join('') + '</div></div>';
    // recent breaks
    var breaks = []; D.ev.broken.forEach(function (rs, t) { breaks.push({ t: t, rs: rs }); }); breaks.sort(function (x, y) { return y.t.o - x.t.o; });
    h += '<div class="qx-grid qx-g2"><div class="qx-card"><h2 style="margin-bottom:10px">Recent rule breaks</h2>' + (breaks.length ? '<div class="qx-wrapx"><table class="qx-table"><tbody>' + breaks.slice(0, 8).map(function (b) { return '<tr><td>' + Q.fdate(b.t.o) + '</td><td><b>' + E(b.t.sym) + '</b> ' + E(b.t.name) + '</td><td>' + b.rs.map(function (r) { return '<span class="qx-chip bad">' + E(Q.RULE_NAMES[r.kind] || r.title || 'Rule') + '</span>'; }).join(' ') + '</td><td class="r ' + (b.t.pnl < 0 ? 'qx-loss' : 'qx-gain') + '">' + Q.money(b.t.pnl, true) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="qx-muted">No rule breaks. Keep it going.</p>') + '</div>';
    h += '<div class="qx-card" id="qx-sess"><h2 style="margin-bottom:10px">Trading sessions</h2><p class="qx-muted">Loading…</p></div></div>';
    h += '</div>';
    el.innerHTML = h;
    var box = document.getElementById('qx-sess');
    if (!d.sb || !d.user) { box.innerHTML = '<h2>Trading sessions</h2><p class="qx-muted">Sign in to see your sessions.</p>'; return; }
    d.sb.from('sessions').select('day, pnl, trades, loss_cap, hit_cap, breaks_taken, overrides').order('day', { ascending: false }).limit(10).then(function (r) {
      var rows = (r && r.data) || [];
      if (r && r.error) { box.innerHTML = '<h2 style="margin-bottom:10px">Trading sessions</h2><p class="qx-muted">Session history isn’t set up yet. Run the new-features SQL script in Supabase to switch it on.</p>'; return; }
      if (!rows.length) { box.innerHTML = '<h2 style="margin-bottom:10px">Trading sessions</h2><p class="qx-muted">Use Session mode while you trade, and your days show up here.</p><a class="qx-btn2" href="session.html">Start a session</a>'; return; }
      var within = rows.filter(function (x) { return !x.hit_cap && !x.overrides; }).length;
      box.innerHTML = '<div class="qx-row qx-sp" style="margin-bottom:10px"><h2>Trading sessions</h2><span class="qx-small qx-muted">' + within + ' of ' + rows.length + ' stayed within plan</span></div><div class="qx-wrapx"><table class="qx-table"><thead><tr><th>Day</th><th class="r">Trades</th><th class="r">P/L</th><th class="r">Breaks taken</th><th>Result</th></tr></thead><tbody>' +
        rows.map(function (x) { var dt = new Date(x.day + 'T12:00:00'); return '<tr><td>' + Q.fdate(dt, true) + '</td><td class="r">' + (x.trades || 0) + '</td><td class="r ' + (x.pnl < 0 ? 'qx-loss' : 'qx-gain') + '">' + Q.money(x.pnl || 0, true) + '</td><td class="r">' + (x.breaks_taken || 0) + '</td><td>' + (x.hit_cap ? '<span class="qx-chip bad">Hit loss cap</span>' : x.overrides ? '<span class="qx-chip gold">' + Q.plural(x.overrides, 'override') + '</span>' : '<span class="qx-chip ok">Within plan</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }, function () {});
  });
})();
