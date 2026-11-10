/* Quillstrike onboarding: welcome panel for new users, sample-trades banner, and a phone-friendly path. */
(function () {
  var BROKERS = [
    ['tasty', 'tastytrade', 'History → Transactions, set your date range, then download as CSV.', 'tasty'],
    ['schwab', 'Schwab / thinkorswim', 'Schwab.com: Accounts → History → Transactions → Export. thinkorswim: Monitor → Account Statement → Export to File (CSV).', 'schwab'],
    ['robinhood', 'Robinhood', 'Account menu → Reports and statements → generate an account activity report as CSV.', 'rh'],
    ['webull', 'Webull', 'Desktop app: Orders → Order History → Options tab → Export to CSV.', 'webull'],
    ['ibkr', 'Interactive Brokers', 'Client Portal: Performance & Reports → Statements → run an Activity statement → download as CSV.', 'ibkr'],
    ['fidelity', 'Fidelity', 'Accounts → Activity & Orders → History → set the date range → Download.', 'fidelity'],
    ['etrade', 'E*TRADE', 'Your account’s Transactions page → set the date range → Download as CSV.', 'etrade'],
    ['other', 'Another broker', 'Look for “History,” “Transactions,” or “Activity,” and export it as CSV. Quillstrike will help you match the columns.', 'tips']];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var page = (location.pathname.split('/').pop() || 'index.html');
  var phone = function () { return (window.matchMedia && (matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches)); };
  var CSS = '.qo-back{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,8,11,.72)}' +
    '.qo{width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:26px 26px 22px;border-radius:16px;border:1px solid rgba(56,189,248,.55);background:linear-gradient(180deg,#152320,#070B12);color:#E9EEF5;font:15px/1.55 Barlow,system-ui,sans-serif;box-shadow:0 0 70px rgba(56,189,248,.25);box-sizing:border-box}' +
    '.qo h2{margin:0;font:700 28px/1.15 "Barlow Semi Condensed",Barlow,sans-serif}.qo .sub{margin:6px 0 0;color:#AFBFD1}.qo .step{margin-top:20px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#F7DC92}' +
    '.qo .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.qo .chips button{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid #2C3F5C;background:#0A111B;color:#E9EEF5;font:600 14px Barlow,sans-serif;cursor:pointer}.qo .chips button:hover{border-color:#38BDF8}.qo .chips button[aria-pressed="true"]{border-color:#D8B25A;background:rgba(216,178,90,.16);color:#fff}' +
    '.qo .how{margin-top:14px;padding:14px 16px;border-radius:10px;border:1px solid rgba(216,178,90,.6);background:rgba(216,178,90,.1)}.qo .how b{color:#fff}' +
    '.qo .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}.qo .gold{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:none;border-radius:8px;background:#D8B25A;color:#04060A;font:700 15px Barlow,sans-serif;text-decoration:none;cursor:pointer}' +
    '.qo .ghost{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:8px;border:1px solid #2C3F5C;background:transparent;color:#E9EEF5;font:600 14px Barlow,sans-serif;text-decoration:none;cursor:pointer}.qo .ghost:hover{border-color:#38BDF8}' +
    '.qo .alt{margin-top:20px;padding-top:16px;border-top:1px solid #1A2638}.qo .fine{margin-top:16px;font-size:12px;color:#8799B0}.qo .x{float:right;margin:-8px -8px 0 0;width:36px;height:36px;border:none;border-radius:8px;background:transparent;color:#A0B1C5;font-size:22px;cursor:pointer}.qo .x:hover{background:rgba(255,255,255,.06);color:#fff}' +
    '.qo .phone{margin-top:14px;padding:12px 14px;border-radius:10px;border:1px solid rgba(56,189,248,.5);background:rgba(56,189,248,.08);font-size:14px}' +
    '.qo-pill{position:fixed;left:16px;bottom:18px;z-index:120;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #D8B25A;background:#101827;color:#F7DC92;font:700 14px Barlow,sans-serif;cursor:pointer;box-shadow:0 0 24px rgba(216,178,90,.3)}' +
    '.qo-demo{position:sticky;top:0;z-index:90;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 14px;padding:10px 16px;background:linear-gradient(90deg,rgba(216,178,90,.22),rgba(56,189,248,.18));border-bottom:1px solid rgba(216,178,90,.6);color:#fff;font:600 14px Barlow,system-ui,sans-serif}' +
    '.qo-demo a,.qo-demo button{display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:8px;font:700 13px Barlow,sans-serif;text-decoration:none;cursor:pointer}.qo-demo a{background:#D8B25A;color:#04060A;border:none}.qo-demo button{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}';
  function css() { if (document.getElementById('qo-css')) return; var s = document.createElement('style'); s.id = 'qo-css'; s.textContent = CSS; document.head.appendChild(s); }
  function track(name) { try { if (window.gtag) window.gtag('event', name); } catch (e) {} }

  function demoBanner() {
    if (document.getElementById('qo-demo')) return; css();
    var b = document.createElement('div'); b.id = 'qo-demo'; b.className = 'qo-demo'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>👀 You’re exploring <b>sample trades</b>. Nothing here is real or saved.</span><a href="import.html">Import my trades</a><button type="button">Exit sample mode</button>';
    b.querySelector('button').onclick = function () { window.QSDemo && window.QSDemo.stop(); };
    document.body.insertBefore(b, document.body.firstChild);
  }

  function welcome(force) {
    if (document.getElementById('qo-back')) return; css();
    var prof = window.TJ_PROFILE || {}, sel = null, last = document.activeElement;
    var back = document.createElement('div'); back.id = 'qo-back'; back.className = 'qo-back';
    var render = function () {
      var br = sel && BROKERS.filter(function (b) { return b[0] === sel; })[0];
      back.innerHTML = '<div class="qo" role="dialog" aria-modal="true" aria-labelledby="qo-h"><button type="button" class="x" data-close aria-label="Close">×</button>' +
        '<h2 id="qo-h">Welcome to Quillstrike' + (prof.handle ? ', @' + esc(prof.handle) : '') + ' 👋</h2><p class="sub">Bring in your trades and see your patterns, key findings, and what-if replays in about two minutes.</p>' +
        '<div class="step">STEP 1 · WHICH BROKER DO YOU USE?</div><div class="chips" role="group" aria-label="Your broker">' + BROKERS.map(function (b) { return '<button type="button" data-b="' + b[0] + '" aria-pressed="' + (sel === b[0]) + '">' + esc(b[1]) + '</button>'; }).join('') + '</div>' +
        (br ? '<div class="step">STEP 2 · DOWNLOAD YOUR CSV</div><div class="how"><b>' + esc(br[1]) + ':</b> ' + esc(br[2]) + ' <a href="guides/export-trade-history-csv.html#' + br[3] + '" target="_blank" rel="noopener" style="color:#F7DC92;font-weight:700;white-space:nowrap">Step-by-step guide →</a></div>' +
          (phone() ? '<div class="phone">📱 <b>On your phone?</b> Exporting is easiest on a computer. Email yourself these steps and finish later.<div class="row" style="margin-top:10px"><a class="ghost" data-mail href="#">Email me the steps</a></div></div>' : '') +
          '<div class="step">STEP 3 · UPLOAD IT</div><div class="row"><a class="gold" data-go href="import.html?b=' + br[0] + '">I have my file → Upload it</a></div>' : '') +
        '<div class="alt"><b>Not ready to export yet?</b><div class="sub" style="margin-top:2px">Explore Quillstrike with realistic sample trades first. You can switch to your own anytime.</div><div class="row"><button type="button" class="ghost" data-demo>👀 Explore with sample trades</button><button type="button" class="ghost" data-later style="border-color:transparent;color:#A0B1C5">I’ll do this later</button></div></div>' +
        '<p class="fine">🔒 Your file is read in your browser, and your trades stay private. You can delete everything anytime in Settings.</p></div>';
      back.querySelectorAll('[data-b]').forEach(function (x) { x.onclick = function () { sel = x.getAttribute('data-b'); track('qs_onboard_broker'); render(); var h = back.querySelector('.how'); if (h) h.scrollIntoView({ block: 'nearest' }); }; });
      var close = function () { back.remove(); try { sessionStorage.setItem('qo_closed', '1'); } catch (e) {} pill(); if (last && last.focus) last.focus(); };
      back.querySelector('[data-close]').onclick = close; back.querySelector('[data-later]').onclick = close;
      back.querySelector('[data-demo]').onclick = function () { track('qs_onboard_demo'); window.QSDemo && window.QSDemo.start(); };
      var go = back.querySelector('[data-go]'); if (go) go.onclick = function () { track('qs_onboard_upload'); };
      var mail = back.querySelector('[data-mail]'); if (mail && br) {
        var body = 'Here’s how to get your trades into Quillstrike:\n\n1. Download your CSV from ' + br[1] + ':\n' + br[2] + '\n\nStep-by-step guide: https://quillstrike.com/guides/export-trade-history-csv.html#' + br[3] + '\n\n2. Upload it here: https://quillstrike.com/import.html?b=' + br[0] + '\n';
        mail.href = 'mailto:' + encodeURIComponent(prof.email || '') + '?subject=' + encodeURIComponent('My Quillstrike import steps') + '&body=' + encodeURIComponent(body);
        mail.onclick = function () { track('qs_onboard_email_steps'); };
      }
      back.onkeydown = function (e) { if (e.key === 'Escape') close(); };
      var first = back.querySelector('[aria-pressed="true"]') || back.querySelector('[data-b]'); if (first) first.focus();
    };
    render(); document.body.appendChild(back);
    var p = document.getElementById('qo-pill'); if (p) p.remove();
  }
  function pill() {
    if (document.getElementById('qo-pill')) return; css();
    var b = document.createElement('button'); b.type = 'button'; b.id = 'qo-pill'; b.className = 'qo-pill'; b.innerHTML = '🚀 Get started';
    b.onclick = function () { welcome(true); }; document.body.appendChild(b);
  }
  function start() {
    if (!window.TJ_READY) return;
    window.TJ_READY.then(function () {
      if (!window.TJ_SESSION && !window.TJ_PROFILE) return;
      try { var su = window.TJ_SESSION && window.TJ_SESSION.user, ck = su && ('qs_conv_' + su.id);
        if (su && su.email_confirmed_at && Date.now() - new Date(su.created_at).getTime() < 14 * 864e5 && localStorage.getItem(ck) !== '1' && typeof window.gtag === 'function') {
          localStorage.setItem(ck, '1'); window.gtag('event', 'conversion', { send_to: 'AW-18558472377/gMkXCMDrvrMdELmhr5FF', value: 1.0, currency: 'USD' }); } } catch (e) {}
      if (window.TJ_DEMO) { demoBanner(); return; }
      if (page !== 'dashboard.html' || (window.TJ_TRADE_COUNT || 0) > 0) return;
      var closed = false; try { closed = sessionStorage.getItem('qo_closed') === '1'; } catch (e) {}
      if (closed) pill(); else setTimeout(function () { welcome(); }, 600);
    });
  }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();
