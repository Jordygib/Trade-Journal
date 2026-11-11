/* Quillstrike Toolkit hub: links to every planning, review and sharing tool. */
(function () {
  var Q = window.QS, E = Q.esc;
  var TOOLS = [
    ['tracker.html', '📡', 'Position tracker', 'Your open trades re-priced every second: P/L, probability of profit, Greeks, risk and alerts.', 'Trade day'],
    ['session.html', '⏱️', 'Session mode', 'Your loss cap, cool-off timer and tilt check, live while you trade.', 'Trade day'],
    ['plans.html', '📝', 'Plan vs. actual', 'Plan a trade before you place it, then see if the real trade followed it.', 'Trade day'],
    ['discipline.html', '🔥', 'Discipline', 'Your discipline score, rule streaks, calendar and badges.', 'Review'],
    
    ['ask.html', '💬', 'Ask your journal', 'Ask about your trades in plain English and get answers with charts.', 'Review'],
    ['dna.html', '🧬', 'Trader DNA', 'A shareable card of your trading style. No dollar amounts.', 'Share'],
    ['wrapped.html', '🎁', 'Quillstrike Wrapped', 'Your trading year in review, as slides you can save and post.', 'Share']
  ];
  Promise.all([Q.mount(), Q.load()]).then(function (a) {
    var el = a[0], d = a[1], D = Q.discipline(d.rules, d.lite), now = new Date();
    var wrappedSeason = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 15);
    var h = '<div class="qx" style="display:flex;flex-direction:column;gap:16px">' + Q.demoNote(d);
    if (wrappedSeason) h += '<a href="wrapped.html" class="qx-card" style="display:flex;align-items:center;justify-content:space-between;gap:16px;text-decoration:none;border-color:rgba(240,199,102,.55);box-shadow:0 0 40px rgba(227,179,65,.18)"><div><div class="qx-label qx-gold">Now available</div><h2>Your ' + (now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1) + ' Wrapped is ready</h2><p class="qx-muted" style="margin:2px 0 0">Your year in trades, patterns and streaks, as slides you can share.</p></div><span class="qx-btn">Open Wrapped</span></a>';
    h += '<div class="qx-grid qx-g3">' + (D.hasRules ? '<a href="discipline.html" class="qx-card" style="text-decoration:none"><div class="qx-label">Discipline score</div><div class="qx-kpi">' + (D.score == null ? '—' : D.score) + '</div><div class="qx-small qx-muted">' + (D.streak ? '🔥 ' + Q.plural(D.streak, 'day') + ' clean streak' : 'Start a clean streak today') + '</div></a>' : '<a href="my-rules.html" class="qx-card" style="text-decoration:none"><div class="qx-label">Discipline score</div><div class="qx-kpi">—</div><div class="qx-small qx-muted">Add a rule on My Rules to get a score</div></a>') + '</div>';
    ['Trade day', 'Review', 'Share'].forEach(function (g) {
      h += '<h2 style="margin-top:6px">' + g + '</h2><div class="qx-grid qx-g3">' + TOOLS.filter(function (t) { return t[4] === g; }).map(function (t) { return '<a href="' + t[0] + '" class="qx-card" style="text-decoration:none;display:flex;gap:14px;align-items:flex-start"><span style="font-size:28px;line-height:1">' + t[1] + '</span><span><span style="display:block;font-family:\'Barlow Semi Condensed\',Barlow,sans-serif;font-size:18px;font-weight:600;color:#fff">' + E(t[2]) + '</span><span class="qx-muted" style="font-size:13px">' + E(t[3]) + '</span></span></a>'; }).join('') + '</div>';
    });
    el.innerHTML = h + '</div>';
  });
})();
