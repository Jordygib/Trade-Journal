/* Session handling for every page: sign-in gate, header details, sign out. */
(function () {
  var cfg = window.TJ_CONFIG;
  var PUBLIC = ['', 'index.html', 'login.html', 'pricing.html', 'rules.html'];
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
      sb.from('profiles').select('username, display_name, avatar_url, plan, broker_verified').eq('id', session.user.id).maybeSingle().then(function (p) {
        var prof = (p && p.data) || {};
        prof.email = session.user.email;
        prof.handle = clean(prof.username) || clean((session.user.email || '').split('@')[0]) || 'trader';
        window.TJ_PROFILE = prof;
        if (page !== 'trades.html' || !window.TJImport) { resolve(); return; }
        sb.from('trades').select('*').order('opened_at', { ascending: false }).limit(1000).then(function (tr) {
          var trades = (tr && tr.data) || [];
          window.TJ_TRADE_COUNT = trades.length;
          if (!trades.length) { window.TJ_TRADES = []; resolve(); return; }
          var ids = trades.map(function (t) { return t.id; });
          sb.from('fills').select('trade_id, executed_at, action, strike, option_type, quantity, price').in('trade_id', ids).then(function (fr) {
            var fills = (fr && fr.data) || [];
            window.TJ_FILL_COUNT = fills.length;
            window.TJ_TRADES = window.TJImport.toView(trades, fills);
            resolve();
          }, function () { window.TJ_TRADES = window.TJImport.toView(trades, []); resolve(); });
        }, function () { resolve(); });
      }, function () { resolve(); });
    }, function () { resolve(); });
  });
  window.TJ_TRANSFORM = function (html) {
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
