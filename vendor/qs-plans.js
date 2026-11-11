/* Quillstrike Plan vs. actual: plan a trade before you place it, then see how closely the real trade followed it. */
(function () {
  var Q = window.QS, E = Q.esc;
  var el, d, plans = [], setupErr = false;
  function dayOf(p) { if (p.planned_for) { var m = String(p.planned_for).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); } var c = new Date(p.created_at); return new Date(c.getFullYear(), c.getMonth(), c.getDate()); }
  function match() {
    var used = new Set(), out = [];
    var todayK = Q.dayKey(new Date());
    plans.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }).forEach(function (p) {
      var day = dayOf(p), dk = Q.dayKey(day), made = new Date(p.created_at).getTime() - 15 * 60000, sym = String(p.underlying || '').toUpperCase();
      var t = d.lite.filter(function (x) { return !used.has(x) && String(x.sym || '').toUpperCase() === sym && Q.dayKey(x.o) === dk && (!x.tk || x.o.getTime() >= made || Q.dayKey(new Date(p.created_at)) !== dk); }).sort(function (a, b) { return a.o - b.o; })[0] || null;
      var r = { p: p, t: t, checks: [], status: '' };
      if (t) {
        used.add(t);
        if (p.strategy && p.strategy !== 'other') r.checks.push({ name: 'Strategy', ok: t.k === p.strategy, txt: t.k === p.strategy ? 'Same strategy' : 'Planned ' + Q.names(p.strategy) + ', traded ' + t.name });
        if (p.max_size) r.checks.push({ name: 'Size', ok: (t.qty || 1) <= p.max_size, txt: (t.qty || 1) + ' of ' + p.max_size + ' contracts' });
        if (p.max_loss && t.c && t.pnl < 0) { var ok = Math.abs(t.pnl) <= p.max_loss * 1.05 + 5; r.checks.push({ name: 'Stop', ok: ok, txt: ok ? 'Loss stayed within the ' + Q.money(p.max_loss) + ' stop' : 'Lost ' + Q.money(-t.pnl) + ', past the ' + Q.money(p.max_loss) + ' stop' }); }
        r.followed = r.checks.every(function (c) { return c.ok; });
        r.target = p.target && t.c && t.pnl > 0 ? t.pnl >= p.target * 0.8 : null;
        r.status = !t.c ? 'open' : r.followed ? 'followed' : 'broke';
      } else r.status = dk >= todayK || Q.dayKey(new Date()) === dk ? 'waiting' : 'skipped';
      out.push(r);
    });
    return { rows: out.reverse(), used: used };
  }
  function stats(M) {
    var done = M.rows.filter(function (r) { return r.t && r.t.c; });
    var cell = function (f, w) { var a = done.filter(function (r) { return r.followed === f && (w ? r.t.pnl > 0 : r.t.pnl <= 0); }); return { n: a.length, avg: a.length ? a.reduce(function (s, r) { return s + r.t.pnl; }, 0) / a.length : null }; };
    var first = plans.length ? Math.min.apply(null, plans.map(function (p) { return dayOf(p).getTime(); })) : null;
    var unplanned = first == null ? [] : d.lite.filter(function (t) { return t.c && !M.used.has(t) && t.o.getTime() >= first; });
    var planned = done.map(function (r) { return r.t; });
    var wr = function (a) { return a.length ? a.filter(function (t) { return t.pnl > 0; }).length / a.length * 100 : null; }, av = function (a) { return a.length ? a.reduce(function (s, t) { return s + t.pnl; }, 0) / a.length : null; };
    return { done: done.length, follow: done.length ? done.filter(function (r) { return r.followed; }).length / done.length * 100 : null, fw: cell(true, true), fl: cell(true, false), bw: cell(false, true), bl: cell(false, false), planned: { n: planned.length, wr: wr(planned), avg: av(planned) }, unplanned: { n: unplanned.length, wr: wr(unplanned), avg: av(unplanned) } };
  }
  function quad(title, c, tone, help) { return '<div style="padding:14px;border-radius:10px;border:1px solid #1B283B;background:#0A111C"><div class="qx-small qx-muted">' + title + '</div><div class="qx-kpi ' + tone + '" style="font-size:26px">' + c.n + '</div><div class="qx-small qx-muted">' + (c.avg == null ? '—' : 'avg ' + Q.money(c.avg, true)) + '</div><div class="qx-small" style="margin-top:4px;color:#C7D3E1">' + help + '</div></div>'; }
  function render() {
    var M = match(), S = stats(M);
    var opts = Object.keys(window.TJImport.NAMES).map(function (k) { return '<option value="' + k + '">' + E(window.TJImport.NAMES[k]) + '</option>'; }).join('');
    var ml = (d.rules.filter(function (r) { return r.on && r.kind === 'max_loss'; })[0] || {}).val || '';
    var h = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d) +
      (setupErr ? '<div class="qx-note">Plans aren’t set up in your database yet. Run the new-features SQL script in Supabase, then refresh.</div>' : '') +
      '<div class="qx-grid qx-g2"><div class="qx-card"><h2>Plan a trade</h2><p class="qx-muted qx-small" style="margin:2px 0 10px">Write it down before you place it. After you import, Quillstrike matches the plan to the first trade in that ticker on that day.</p>' +
      '<div class="qx-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px"><label class="qx-f">Ticker<input id="p-sym" maxlength="8" placeholder="SPX"></label><label class="qx-f">Strategy<select id="p-k">' + opts + '</select></label><label class="qx-f">For<input id="p-day" type="date" value="' + Q.dayKey(new Date()) + '"></label>' +
      '<label class="qx-f">Stop: max loss ($)<input id="p-ml" type="number" min="0" value="' + E(ml) + '"></label><label class="qx-f">Profit target ($)<input id="p-tg" type="number" min="0"></label><label class="qx-f">Max contracts<input id="p-sz" type="number" min="1" value="1"></label></div>' +
      '<label class="qx-f" style="margin-top:10px">Why this trade?<textarea id="p-why" maxlength="400" placeholder="Setup, level, or reason"></textarea></label><div class="qx-row" style="margin-top:10px"><button class="qx-btn" id="p-go"' + (setupErr || d.demo ? ' disabled' : '') + '>Save plan</button>' + (d.demo ? '<span class="qx-small qx-muted">Import your trades to start planning.</span>' : '') + '</div></div>' +
      '<div class="qx-card"><h2>Follow-through</h2><div class="qx-row" style="gap:28px;margin:8px 0 12px"><div><div class="qx-label">Plans followed</div><div class="qx-kpi">' + Q.pct(S.follow) + '</div><div class="qx-small qx-muted">of ' + Q.plural(S.done, 'closed planned trade') + '</div></div><div><div class="qx-label">Planned trades</div><div class="qx-kpi" style="font-size:22px">' + Q.pct(S.planned.wr) + ' <span class="qx-small qx-muted">win rate</span></div><div class="qx-small qx-muted">' + (S.planned.avg == null ? '—' : 'avg ' + Q.money(S.planned.avg, true)) + '</div></div><div><div class="qx-label">Unplanned trades</div><div class="qx-kpi" style="font-size:22px">' + Q.pct(S.unplanned.wr) + ' <span class="qx-small qx-muted">win rate</span></div><div class="qx-small qx-muted">' + Q.plural(S.unplanned.n, 'trade') + (S.unplanned.avg == null ? '' : ' · avg ' + Q.money(S.unplanned.avg, true)) + '</div></div></div>' +
      '<div class="qx-grid" style="grid-template-columns:1fr 1fr;gap:10px">' + quad('Followed the plan · won', S.fw, 'qx-gain', 'Good idea, good execution.') + quad('Followed the plan · lost', S.fl, '', 'Execution was fine. Review the idea.') + quad('Broke the plan · won', S.bw, 'qx-gold', 'Worked this time, but it’s a habit to watch.') + quad('Broke the plan · lost', S.bl, 'qx-loss', 'The losses a plan is meant to prevent.') + '</div></div></div>';
    h += '<div class="qx-card"><h2 style="margin-bottom:10px">Your plans</h2>' + (M.rows.length ? '<div class="qx-wrapx"><table class="qx-table"><thead><tr><th>For</th><th>Plan</th><th>Stop / target / size</th><th>Matched trade</th><th>Result</th><th></th></tr></thead><tbody>' +
      M.rows.map(function (r) {
        var p = r.p, t = r.t, res;
        if (r.status === 'waiting') res = '<span class="qx-chip">Waiting for import</span>';
        else if (r.status === 'skipped') res = '<span class="qx-chip">No trade taken</span>';
        else if (r.status === 'open') res = '<span class="qx-chip">Still open</span>';
        else res = (r.followed ? '<span class="qx-chip ok">Followed</span>' : '<span class="qx-chip bad">Broke the plan</span>') + (r.target === true ? ' <span class="qx-chip gold">Reached target</span>' : '') + '<div class="qx-small qx-muted" style="margin-top:4px">' + r.checks.map(function (c) { return (c.ok ? '✓ ' : '✗ ') + E(c.txt); }).join('<br>') + '</div>';
        return '<tr><td>' + Q.fdate(dayOf(p)) + '</td><td><b>' + E(p.underlying) + '</b> ' + E(Q.names(p.strategy)) + (p.reason ? '<div class="qx-small qx-muted" style="max-width:280px">' + E(p.reason) + '</div>' : '') + '</td><td>' + (p.max_loss ? Q.money(p.max_loss) : '—') + ' / ' + (p.target ? Q.money(p.target) : '—') + ' / ' + (p.max_size || '—') + '</td><td>' + (t ? (t.tk ? t.o.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · ' : '') + E(t.name) + (t.c ? ' <b class="' + (t.pnl < 0 ? 'qx-loss' : 'qx-gain') + '">' + Q.money(t.pnl, true) + '</b>' : '') : '—') + '</td><td>' + res + '</td><td class="r"><button class="qx-btn2" data-del="' + E(p.id) + '" style="min-height:30px;padding:0 10px">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="qx-empty">No plans yet. Plan your next trade above, or from Session mode while you trade.</div>') + '</div></div>';
    el.innerHTML = h;
    var go = document.getElementById('p-go'); if (go) go.onclick = add;
    el.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-del'); if (!confirm('Delete this plan?')) return; d.sb.from('plans').delete().eq('id', id).then(function (r) { if (!r.error) { plans = plans.filter(function (p) { return String(p.id) !== id; }); render(); } }); }; });
  }
  function add() {
    var sym = String(document.getElementById('p-sym').value || '').trim().toUpperCase().replace(/[^A-Z0-9.$^]/g, '').slice(0, 8);
    if (!sym) { document.getElementById('p-sym').focus(); return; }
    var row = { user_id: d.user.id, underlying: sym, strategy: document.getElementById('p-k').value, planned_for: document.getElementById('p-day').value || Q.dayKey(new Date()), max_loss: Number(document.getElementById('p-ml').value) || null, target: Number(document.getElementById('p-tg').value) || null, max_size: Number(document.getElementById('p-sz').value) || null, reason: String(document.getElementById('p-why').value || '').trim().slice(0, 400) || null, source: 'plans' };
    var b = document.getElementById('p-go'); b.disabled = true; b.textContent = 'Saving…';
    d.sb.from('plans').insert(row).select('*').single().then(function (r) { if (r.error) { b.disabled = false; b.textContent = 'Save plan'; alert('Couldn’t save the plan: ' + r.error.message); return; } plans.push(r.data); render(); }, function () { b.disabled = false; b.textContent = 'Save plan'; });
  }
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    el = a[0]; d = a[1];
    if (!d.sb || !d.user) { render(); return; }
    d.sb.from('plans').select('*').order('created_at', { ascending: false }).limit(1000).then(function (r) { if (r.error) setupErr = true; plans = (r && r.data) || []; render(); }, function () { setupErr = true; render(); });
  });
})();
