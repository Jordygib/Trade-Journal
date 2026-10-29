/* Session handling for every page: sign-in gate, header details, sign out. */
(function () {
  var cfg = window.TJ_CONFIG;
  var PUBLIC = ['', 'index.html', 'login.html', 'pricing.html', 'rules.html', 'privacy.html', 'terms.html'];
  var page = location.pathname.split('/').pop();
  function initials(name) { var n = String(name || '').replace(/[^a-z0-9]/gi, ''); return (n.slice(0, 2) || 'TJ').toUpperCase(); }
  function clean(s) { return String(s || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20); }
  window.TJ_READY = new Promise(function (resolve) {
    if (!window.supabase || !cfg) { resolve(); return; }
    var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    window.tj = sb;
    sb.auth.getSession().then(function (r) {
      var session = r && r.data ? r.data.session : null;
      window.TJ_SESSION = session;
      if (!session && PUBLIC.indexOf(page) < 0) {
        location.replace('login.html?next=' + encodeURIComponent(page + location.search + location.hash));
        return;
      }
      if (!session) { resolve(); return; }
      var FULL = 'username, display_name, avatar_url, plan, broker_verified, created_at, bio, share_stats, share_trades, show_on_leaderboard';
      sb.from('profiles').select(FULL + ', is_admin').eq('id', session.user.id).maybeSingle().then(function (p0) {
        return p0 && p0.error ? sb.from('profiles').select(FULL).eq('id', session.user.id).maybeSingle() : p0;
      }).then(function (p) {
        var prof = (p && p.data) || {};
        prof.email = session.user.email;
        prof.handle = clean(prof.username) || clean((session.user.email || '').split('@')[0]) || 'trader';
        window.TJ_PROFILE = prof;
        var DATA_PAGES = ['dashboard.html', 'trades.html', 'my-rules.html', 'insights.html', 'profile.html'];
        if (DATA_PAGES.indexOf(page) < 0 || !window.TJImport) { resolve(); return; }
        var needRules = page === 'dashboard.html' || page === 'my-rules.html' || page === 'insights.html';
        var pRules = needRules ? sb.from('rules').select('id, kind, params, active, created_at').order('created_at', { ascending: true }).then(function (r) { window.TJ_RULES = (r && r.data) || []; }, function () { window.TJ_RULES = []; }) : Promise.resolve();
        var pTrades = sb.from('trades').select('*').order('opened_at', { ascending: false }).limit(2000).then(function (tr) {
          var trades = (tr && tr.data) || [];
          window.TJ_TRADE_COUNT = trades.length;
          if (!trades.length) { window.TJ_TRADES = []; window.TJ_LITE = []; return; }
          var ids = trades.map(function (t) { return t.id; });
          return sb.from('fills').select('trade_id, executed_at, action, strike, option_type, quantity, price').in('trade_id', ids).limit(20000).then(function (fr) {
            var fills = (fr && fr.data) || [];
            window.TJ_FILL_COUNT = fills.length;
            window.TJ_TRADES = window.TJImport.toView(trades, fills);
            window.TJ_LITE = window.TJImport.toLite(trades, fills);
          }, function () { window.TJ_TRADES = window.TJImport.toView(trades, []); window.TJ_LITE = window.TJImport.toLite(trades, []); });
        }, function () {});
        var pFb = page === 'insights.html' ? sb.from('insight_feedback').select('card, helpful').then(function (r) { var m = {}; ((r && r.data) || []).forEach(function (x) { m[x.card] = x.helpful; }); window.TJ_FEEDBACK = m; }, function () {}) : Promise.resolve();
        Promise.all([pRules, pTrades, pFb]).then(function () { resolve(); }, function () { resolve(); });
      }, function () { resolve(); });
    }, function () { resolve(); });
  });
  function dateText(html) {
    var MF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    var last = new Date(y, m + 1, 0).getDate(), left = last - d, nm = (m + 1) % 12, pm = (m + 11) % 12;
    var q = Math.floor(m / 3) + 1, qEndM = q * 3 - 1, qEndD = new Date(y, qEndM + 1, 0).getDate();
    var pq = q === 1 ? 4 : q - 1, pqY = q === 1 ? y - 1 : y, pmY = m === 0 ? y - 1 : y;
    var yLeft = Math.round((new Date(y, 11, 31) - new Date(y, m, d)) / 86400000);
    var leftTxt = left === 0 ? 'Last day' : left === 1 ? '1 day left' : left + ' days left';
    var R = [
      ['October awards', MF[m] + ' awards'], ['11 days left', leftTxt], ['Oct 31', MS[m] + ' ' + last],
      ['October challenge', MF[m] + ' challenge'], ['Picked Nov 1 by', 'Picked ' + MS[nm] + ' 1 by'],
      ['Season ends Dec 31 · 72 days left', 'Season ends Dec 31 · ' + (yLeft === 1 ? '1 day left' : yLeft + ' days left')],
      ['September 2026 and Q3 and Q3 · ', MF[pm] + ' ' + pmY + ' and Q' + pq + ' ' + pqY + ' · '],
      ['chooses November’s challenge', 'chooses ' + MF[nm] + '’s challenge'], ['Used in October', 'Used in ' + MF[m]],
      ['Winners announced Nov 1', 'Winners announced ' + MS[nm] + ' 1'], ['October trading days', MF[m] + ' trading days'],
      ['for Q4, ending Dec 31', 'for Q' + q + ', ending ' + MS[qEndM] + ' ' + qEndD]
    ];
    R.forEach(function (r) { html = html.split(r[0]).join(r[1]); });
    return html;
  }
  window.TJ_TRANSFORM = function (html) {
    if (page === 'awards.html' || page === 'leaderboard.html') html = dateText(html);
    var s = window.TJ_SESSION, p = window.TJ_PROFILE;
    if (s && (page === '' || page === 'index.html')) {
      html = html.split('href="login.html?mode=signup"').join('href="dashboard.html"');
      html = html.split('href="login.html"').join('href="dashboard.html"');
      html = html.split('>Sign in</a>').join('>Dashboard</a>');
      html = html.split('>Start free</a>').join('>Open my journal</a>');
    }
    if (page === 'trades.html' && s) {
      var n = window.TJ_TRADE_COUNT || 0, f = window.TJ_FILL_COUNT || 0;
      html = html.split('186 trades grouped from 742 fills · sample data').join(n ? n + (n === 1 ? ' trade' : ' trades') + ' grouped from ' + f + ' fills' : 'Sample data · import a CSV to see your own trades');
      html = html.split('Showing the 12 most recent of 186 trades').join(n ? 'Showing all ' + n + (n === 1 ? ' trade' : ' trades') : 'These are sample trades. Your own appear here after you import.');
    }
    if (p) {
      var plan = p.plan === 'pro' ? 'Pro' : p.plan === 'bundle' ? 'Pro + Unlimited' : 'Free';
      html = html.split('@thetaflow').join('@' + p.handle);
      html = html.split('Broker-verified · tastytrade · Free plan').join((p.broker_verified ? 'Broker-verified' : 'Not verified yet') + ' · ' + plan + ' plan');
      html = html.split('#8 · 2,450 trophy pts').join(plan + ' plan');
      if (p.avatar_url && /^https:\/\/[^"'<>\s]+$/.test(p.avatar_url)) {
        html = html.replace(/(<span style="width: 34px; height: 34px; border-radius: 6px; background: #D8B25A;[^"]*)">TF<\/span>/, '$1; overflow: hidden; padding: 0"><img src="' + p.avatar_url + '" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block"></span>');
      }
      html = html.split('>TF<').join('>' + initials(p.handle) + '<');
    }
    return html;
  };
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-signout]') : null;
    if (!t) return;
    e.preventDefault();
    if (window.tj) window.tj.auth.signOut().then(function () { location.href = 'index.html'; }, function () { location.href = 'index.html'; });
  });
})();
