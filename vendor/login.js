(function () {
  var cfg = window.TJ_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || 'dashboard.html';
  if (!/^[a-z0-9-]+\.html([?#].*)?$/i.test(next)) next = 'dashboard.html';
  var base = location.href.split('?')[0].split('#')[0].replace(/[^/]*$/, '');
  var mode = params.get('mode') === 'signup' ? 'up' : 'in';
  var recovering = false;
  function show(el, text, kind) { el.hidden = false; el.className = 'msg ' + (kind || 'err'); el.textContent = text; }
  function hide(el) { el.hidden = true; }
  if (!window.supabase || !cfg) { show($('msg'), 'Couldn’t load the sign-in service. Check your connection and refresh.'); return; }
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  function setMode(m) {
    mode = m; var up = m === 'up';
    $('tabIn').setAttribute('aria-selected', String(!up)); $('tabUp').setAttribute('aria-selected', String(up));
    $('userWrap').hidden = !up; $('upChecks').hidden = !up; $('forgotRow').hidden = up; $('pwHint').hidden = !up;
    $('password').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    $('title').textContent = up ? 'Create your account' : 'Welcome back';
    $('subtitle').textContent = up ? 'Start your free trading journal in under a minute.' : 'Sign in to your trading journal.';
    $('submit').textContent = up ? 'Create account' : 'Sign in';
    hide($('msg'));
  }
  $('tabIn').onclick = function () { setMode('in'); };
  $('tabUp').onclick = function () { setMode('up'); };
  setMode(mode);
  if (params.get('confirmed')) show($('msg'), 'Your email is confirmed. Sign in to get started.', 'info');
  var checkTimer = null;
  $('username').addEventListener('input', function () {
    var v = this.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); if (v !== this.value) this.value = v;
    var h = $('userHint'); clearTimeout(checkTimer);
    if (!/^[a-z0-9_]{3,20}$/.test(v)) { h.className = 'hint'; h.textContent = '3–20 characters: lowercase letters, numbers, or _'; return; }
    h.className = 'hint'; h.textContent = 'Checking…';
    checkTimer = setTimeout(function () {
      sb.rpc('username_available', { name: v }).then(function (r) {
        if (r.error) { h.className = 'hint'; h.textContent = '3–20 characters: lowercase letters, numbers, or _'; return; }
        h.className = 'hint ' + (r.data ? 'ok' : 'bad'); h.textContent = r.data ? '@' + v + ' is available' : '@' + v + ' is taken. Try another.';
      });
    }, 350);
  });
  $('forgot').onclick = function () {
    var email = $('email').value.trim();
    if (!email) { show($('msg'), 'Enter your email above, then click “Forgot password?” again.'); $('email').focus(); return; }
    sb.auth.resetPasswordForEmail(email, { redirectTo: base + 'login.html?reset=1' }).then(function (r) {
      if (r.error) show($('msg'), r.error.message); else show($('msg'), 'If that email has an account, a reset link is on its way.', 'info');
    });
  };
  $('form').addEventListener('submit', function (e) {
    e.preventDefault(); hide($('msg'));
    var email = $('email').value.trim(), pw = $('password').value, btn = $('submit');
    if (!email || email.indexOf('@') < 1) { show($('msg'), 'Enter a valid email address.'); $('email').focus(); return; }
    if (pw.length < 8) { show($('msg'), 'Your password needs at least 8 characters.'); $('password').focus(); return; }
    if (mode === 'in') {
      btn.disabled = true; btn.textContent = 'Signing in…';
      sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
        btn.disabled = false; btn.textContent = 'Sign in';
        if (r.error) { show($('msg'), /confirm/i.test(r.error.message) ? 'Please confirm your email first. Check your inbox for the link.' : 'That email and password don’t match. Try again or reset your password.'); return; }
        location.href = next;
      });
      return;
    }
    var u = $('username').value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { show($('msg'), 'Pick a username of 3–20 lowercase letters, numbers, or _.'); $('username').focus(); return; }
    if (!$('adult').checked) { show($('msg'), 'You need to be 18 or older to create an account.'); $('adult').focus(); return; }
    if (!$('terms').checked) { show($('msg'), 'Please agree to the Terms and Privacy Policy to continue.'); $('terms').focus(); return; }
    btn.disabled = true; btn.textContent = 'Creating account…';
    sb.rpc('username_available', { name: u }).then(function (a) {
      if (a.data === false) { btn.disabled = false; btn.textContent = 'Create account'; show($('msg'), '@' + u + ' is taken. Try another username.'); return; }
      sb.auth.signUp({ email: email, password: pw, options: { data: { username: u, is_adult_confirmed: true }, emailRedirectTo: base + 'login.html?confirmed=1' } }).then(function (r) {
        btn.disabled = false; btn.textContent = 'Create account';
        if (r.error) { show($('msg'), r.error.message); return; }
        if (r.data && r.data.session) { location.href = 'dashboard.html'; return; }
        show($('msg'), 'Almost done. We sent a confirmation link to ' + email + '. Click it, then sign in here.', 'info');
      });
    });
  });
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; $('authView').hidden = true; $('resetView').hidden = false; $('newpw').focus(); }
  });
  $('resetForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('newpw').value;
    if (pw.length < 8) { show($('resetMsg'), 'Your password needs at least 8 characters.'); return; }
    $('resetBtn').disabled = true;
    sb.auth.updateUser({ password: pw }).then(function (r) {
      $('resetBtn').disabled = false;
      if (r.error) { show($('resetMsg'), r.error.message); return; }
      show($('resetMsg'), 'Password saved. Taking you to your journal…', 'info');
      setTimeout(function () { location.href = 'dashboard.html'; }, 1200);
    });
  });
  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session && !recovering && !params.get('reset')) location.replace(next);
  });
})();
