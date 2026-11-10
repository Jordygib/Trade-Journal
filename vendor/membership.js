/* Quillstrike membership notices for signed-in members. Flip LIVE to true on launch day. */
(function () {
  var LIVE = false;
  var KEY = LIVE ? 'qs_plans_live_v1' : 'qs_plans_soon_v1';
  var page = location.pathname.split('/').pop() || 'index.html';
  if (['index.html', 'login.html', 'pricing.html', 'privacy.html', 'terms.html', 'rules.html', 'admin.html'].indexOf(page) >= 0) return;
  function show() {
    try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}
    if (document.getElementById('qm-bar') || document.getElementById('qo-demo')) return;
    var st = document.createElement('style'); st.textContent = '.qm-bar{position:relative;z-index:80;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 14px;padding:10px 48px 10px 16px;background:linear-gradient(90deg,rgba(56,189,248,.16),rgba(216,178,90,.16));border-bottom:1px solid rgba(56,189,248,.45);color:#E9EEF5;font:500 14px/1.45 Barlow,system-ui,sans-serif;text-align:center}.qm-bar b{color:#fff}.qm-bar a{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:7px;background:#D8B25A;color:#04060A;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap}.qm-bar button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:none;border-radius:8px;background:transparent;color:#AFBFD1;font-size:20px;cursor:pointer}.qm-bar button:hover{background:rgba(255,255,255,.08);color:#fff}';
    document.head.appendChild(st);
    var b = document.createElement('div'); b.id = 'qm-bar'; b.className = 'qm-bar'; b.setAttribute('role', 'status');
    b.innerHTML = LIVE
      ? '<span>🎉 <b>Pro memberships are live.</b> Launch offer: first month free, or 30% off your first year.</span><a href="pricing.html">See plans</a><button type="button" aria-label="Dismiss">×</button>'
      : '<span>🧪 <b>You’re in the beta: every Pro feature is free right now.</b> Pro memberships are coming soon, with a special offer for beta members. We’ll email you before anything changes.</span><a href="pricing.html">See plans</a><button type="button" aria-label="Dismiss">×</button>';
    b.querySelector('button').onclick = function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} b.remove(); };
    document.body.insertBefore(b, document.body.firstChild);
  }
  function start() { if (window.TJ_READY) window.TJ_READY.then(function () { if (window.TJ_SESSION && !window.TJ_DEMO) setTimeout(show, 400); }); }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();
