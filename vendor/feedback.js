/* Floating Feedback button: sends a note to the feedback table. */
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    if (document.getElementById('tj-fb-btn')) return;
    var css = document.createElement('style');
    css.textContent = '#tj-fb-btn{position:fixed;right:18px;bottom:18px;z-index:300;display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:0 16px;border-radius:999px;border:1px solid rgba(56,189,248,.6);background:rgba(10,22,30,.92);color:#E0F2FE;font:600 14px Barlow,system-ui,sans-serif;cursor:pointer;box-shadow:0 0 0 1px rgba(56,189,248,.25),0 0 24px rgba(56,189,248,.35),0 10px 26px rgba(0,0,0,.45);backdrop-filter:blur(6px)}' +
      '#tj-fb-btn:hover{color:#fff;box-shadow:0 0 0 1px rgba(56,189,248,.5),0 0 34px rgba(56,189,248,.55),0 10px 26px rgba(0,0,0,.45)}' +
      '#tj-fb-back{position:fixed;inset:0;z-index:301;background:rgba(4,8,11,.6);display:flex;align-items:flex-end;justify-content:flex-end;padding:18px}' +
      '#tj-fb{width:min(380px,100%);border-radius:12px;border:1px solid rgba(56,189,248,.45);background:#121B18;color:#EFF5F2;font:14px Barlow,system-ui,sans-serif;box-shadow:0 0 60px rgba(56,189,248,.25),0 24px 60px rgba(0,0,0,.6);padding:18px;animation:tjfb .22s cubic-bezier(.2,.8,.2,1)}' +
      '@keyframes tjfb{from{opacity:0;transform:translateY(12px)}}' +
      '#tj-fb h2{margin:0;font:700 20px "Barlow Semi Condensed",Barlow,sans-serif}#tj-fb p{margin:4px 0 12px;color:#B8C6C0;font-size:13px}' +
      '#tj-fb .cats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}#tj-fb .cats button{min-height:32px;padding:0 12px;border-radius:999px;border:1px solid #3A4E47;background:transparent;color:#CFDAD5;font:600 12px Barlow,sans-serif;cursor:pointer}' +
      '#tj-fb .cats button[aria-pressed="true"]{border-color:#38BDF8;background:rgba(56,189,248,.16);color:#fff}' +
      '#tj-fb textarea{width:100%;box-sizing:border-box;min-height:110px;padding:10px 12px;border:1px solid #3A4E47;border-radius:8px;background:#0F1714;color:#EFF5F2;font:14px Barlow,sans-serif;resize:vertical}' +
      '#tj-fb textarea:focus{outline:none;box-shadow:0 0 0 2px rgba(56,189,248,.7)}' +
      '#tj-fb .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}#tj-fb .send{min-height:38px;padding:0 18px;border:none;border-radius:8px;background:#D8B25A;color:#0C1110;font:700 14px Barlow,sans-serif;cursor:pointer}' +
      '#tj-fb .x{min-height:38px;padding:0 12px;border:1px solid #3A4E47;border-radius:8px;background:transparent;color:#CFDAD5;font:600 13px Barlow,sans-serif;cursor:pointer}#tj-fb .msg{margin-top:8px;font-size:13px}' +
      '@media (max-width:760px){#tj-fb-btn{right:12px;bottom:12px;min-height:38px;padding:0 13px}}@media print{#tj-fb-btn{display:none}}';
    document.head.appendChild(css);
    var btn = document.createElement('button');
    btn.id = 'tj-fb-btn'; btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span aria-hidden="true">💬</span>Feedback';
    document.body.appendChild(btn);
    var cat = 'bug', back = null, lastFocus = null;
    function close() { if (back) { back.remove(); back = null; } if (lastFocus) lastFocus.focus(); }
    function open() {
      lastFocus = document.activeElement;
      back = document.createElement('div'); back.id = 'tj-fb-back';
      back.innerHTML = '<div id="tj-fb" role="dialog" aria-modal="true" aria-labelledby="tj-fb-h"><h2 id="tj-fb-h">Send feedback</h2><p>Found something broken or confusing? Have an idea? This goes straight to the builder.</p>' +
        '<div class="cats" role="group" aria-label="Type"><button type="button" data-c="bug" aria-pressed="true">🐞 Bug</button><button type="button" data-c="confusing" aria-pressed="false">🤔 Confusing</button><button type="button" data-c="idea" aria-pressed="false">💡 Idea</button><button type="button" data-c="other" aria-pressed="false">Other</button></div>' +
        '<label><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your feedback</span><textarea maxlength="2000" placeholder="What happened, and what did you expect?"></textarea></label>' +
        '<div class="row"><button type="button" class="x">Cancel</button><button type="button" class="send">Send</button></div><div class="msg" role="status"></div></div>';
      document.body.appendChild(back);
      cat = 'bug';
      var box = back.querySelector('#tj-fb'), ta = box.querySelector('textarea'), msg = box.querySelector('.msg'), send = box.querySelector('.send');
      box.querySelectorAll('.cats button').forEach(function (b) { b.onclick = function () { cat = b.getAttribute('data-c'); box.querySelectorAll('.cats button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
      box.querySelector('.x').onclick = close;
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      back.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      send.onclick = function () {
        var text = ta.value.trim();
        if (!text) { msg.style.color = '#F0607A'; msg.textContent = 'Write a quick note first.'; ta.focus(); return; }
        var sb = window.tj || (window.supabase && window.TJ_CONFIG ? window.supabase.createClient(window.TJ_CONFIG.url, window.TJ_CONFIG.key) : null);
        if (!sb) { msg.style.color = '#F0607A'; msg.textContent = 'Couldn’t connect. Please try again in a moment.'; return; }
        send.disabled = true; send.textContent = 'Sending…';
        var uid = window.TJ_SESSION && window.TJ_SESSION.user ? window.TJ_SESSION.user.id : null;
        sb.from('feedback').insert({ user_id: uid, page: location.pathname.split('/').pop() || 'index.html', category: cat, message: text, user_agent: navigator.userAgent.slice(0, 200) }).then(function (r) {
          if (r && r.error) { send.disabled = false; send.textContent = 'Send'; msg.style.color = '#F0607A'; msg.textContent = 'Couldn’t send. Please try again.'; return; }
          box.innerHTML = '<h2>Thank you! 🙌</h2><p style="margin-bottom:0">Your feedback was sent. Every note helps make this better.</p><div class="row" style="justify-content:flex-end"><button type="button" class="send">Close</button></div>';
          box.querySelector('.send').onclick = close; box.querySelector('.send').focus();
        }, function () { send.disabled = false; send.textContent = 'Send'; msg.style.color = '#F0607A'; msg.textContent = 'Couldn’t send. Please try again.'; });
      };
      setTimeout(function () { ta.focus(); }, 30);
    }
    btn.onclick = open;
  });
})();
