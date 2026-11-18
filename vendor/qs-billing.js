/* Quillstrike paid plans (Stripe Checkout). Does nothing while TJ_CONFIG.billing is false, so the beta stays free. */
(function () {
  var cfg = window.TJ_CONFIG || {}; if (!cfg.billing) return;
  var page = (location.pathname.split('/').pop() || 'index.html');
  function call(fn, body) {
    return Promise.resolve(window.TJ_READY).then(function () {
      if (!window.tj || !window.TJ_SESSION) { location.href = 'login.html?mode=signup&next=' + encodeURIComponent('pricing.html'); return new Promise(function () {}); }
      return window.tj.functions.invoke(fn, { body: body || {} });
    }).then(function (r) {
      if (r.error) { var c = r.error.context; if (c && c.json) return c.json().then(function (j) { throw new Error((j && j.error) || r.error.message); }, function () { throw new Error(r.error.message); }); throw new Error(r.error.message); }
      return r.data;
    });
  }
  function toast(t) { var d = document.createElement('div'); d.setAttribute('role', 'alert'); d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:600;max-width:90vw;padding:12px 18px;border-radius:8px;border:1px solid #FF7A8A;background:#1A0F14;color:#FFD5DA;font:600 14px Barlow,system-ui,sans-serif'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  function portal(btn) { btn.disabled = true; call('stripe-portal').then(function (r) { location.href = r.url; }, function (e) { btn.disabled = false; toast(e.message); }); }

  if (page === 'pricing.html') {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-beta-plan]'); if (!a) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var yearly = /billed yearly/i.test((a.parentElement && a.parentElement.textContent) || '');
      var label = a.textContent; a.style.opacity = '.6'; a.style.pointerEvents = 'none'; a.textContent = 'Opening checkout…';
      call('stripe-checkout', { interval: yearly ? 'yearly' : 'monthly' }).then(function (r) { location.href = r.url; }, function (er) {
        a.style.opacity = ''; a.style.pointerEvents = ''; a.textContent = label;
        if (er.message === 'already_pro') { toast('You already have Pro. Manage it in Settings.'); setTimeout(function () { location.href = 'settings.html'; }, 1500); } else toast(er.message);
      });
    }, true);
    if (new URLSearchParams(location.search).get('billing') === 'cancel') setTimeout(function () { toast('Checkout cancelled. You weren’t charged.'); }, 300);
  }

  if (page === 'settings.html') {
    Promise.resolve(window.TJ_READY).then(function () {
      if (!window.tj || !window.TJ_SESSION) return;
      return window.tj.from('profiles').select('plan_status, plan_period_end').eq('id', window.TJ_SESSION.user.id).maybeSingle().then(function (r) { return (r && r.data) || {}; }, function () { return {}; });
    }).then(function (extra) {
      if (!extra) return;
      var p = Object.assign({}, window.TJ_PROFILE || {}, extra), sec = document.getElementById('spplan'); if (!sec) return;
      var box = sec.closest('section'); var body = box && box.children[1]; if (!body) return;
      var pro = p.plan === 'pro' || p.plan === 'bundle';
      var end = p.plan_period_end ? new Date(p.plan_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      var ok = new URLSearchParams(location.search).get('billing') === 'success';
      var h = '<div><div style="font-size:12px;color:#9AACC1">Current plan</div><div style="margin-top:4px;font-size:20px;font-weight:700;font-family:\'Barlow Semi Condensed\',Barlow,sans-serif">' + (p.plan === 'bundle' ? 'Pro + Unlimited' : pro ? 'Pro' : 'Free') + '</div></div>';
      h += '<div style="flex:1 1 360px;min-width:0;font-size:14px;line-height:1.55;color:#C7D3E1">';
      if (ok && !pro) h += '<strong style="color:#fff">Thanks! Your payment went through.</strong> Your plan updates in a few seconds. Refresh this page if it still says Free. ';
      else if (pro) h += (p.plan_status === 'trialing' ? 'Your free trial ends ' : p.plan_status === 'past_due' ? '<strong style="color:#F0C766">Your last payment failed.</strong> Update your card to keep Pro. ' : 'Your plan renews ') + (end && p.plan !== 'bundle' ? 'on <strong style="color:#fff">' + end + '</strong>. ' : '') + 'Cancel, change your card or download invoices any time.';
      else h += 'You’re on the free plan. Pro unlocks the full analysis of how you trade.';
      h += '</div><div style="display:flex;gap:8px;align-items:center">' + (pro && p.plan !== 'bundle' ? '<button id="qb-portal" style="min-height:40px;padding:0 16px;border-radius:7px;border:1px solid #D8B25A;background:transparent;color:#D8B25A;font:700 14px Barlow,sans-serif;cursor:pointer">Manage billing</button>' : !pro ? '<a href="pricing.html" style="display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:7px;background:#D8B25A;color:#04060A;font-weight:700;text-decoration:none">Upgrade to Pro</a>' : '') + '</div>';
      body.innerHTML = h; var b = document.getElementById('qb-portal'); if (b) b.onclick = function () { portal(b); };
    });
  }
})();
