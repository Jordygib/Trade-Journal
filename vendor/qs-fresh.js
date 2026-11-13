/* Quillstrike import freshness.
   Until broker connections exist, trades only update when the trader imports a new CSV.
   This shows how current their data is: a header chip on every page, a banner when trading
   sessions have closed since the last import, and a confirmation after each import.
   Counts NYSE trading sessions only, so weekends and market holidays never trigger it. */
(function () {
  var HOLIDAYS = { '2026-01-01': 1, '2026-01-19': 1, '2026-02-16': 1, '2026-04-03': 1, '2026-05-25': 1, '2026-06-19': 1, '2026-07-03': 1, '2026-09-07': 1, '2026-11-26': 1, '2026-12-25': 1,
    '2027-01-01': 1, '2027-01-18': 1, '2027-02-15': 1, '2027-03-26': 1, '2027-05-31': 1, '2027-06-18': 1, '2027-07-05': 1, '2027-09-06': 1, '2027-11-25': 1, '2027-12-24': 1 };
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var BANNER_PAGES = { 'dashboard.html': 1, 'trades.html': 1, 'insights.html': 1, 'my-rules.html': 1, 'discipline.html': 1, 'leaderboard.html': 1, 'awards.html': 1, 'trophies.html': 1, 'wrapped.html': 1, 'dna.html': 1, 'ask.html': 1, 'plans.html': 1, 'toolkit.html': 1 };
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function etOffsetMin(date) {
    try { var s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(date).filter(function (p) { return p.type === 'timeZoneName'; })[0].value; var m = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : -300; } catch (e) { return -300; }
  }
  function ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  /* The UTC moment a trading session closed (4:00 PM ET), for a given ET calendar date. */
  function closeAt(y, m, d) { var g = Date.UTC(y, m, d, 21); return Date.UTC(y, m, d, 16) - etOffsetMin(new Date(g)) * 60000; }
  function isSession(y, m, d) { var wd = new Date(Date.UTC(y, m, d)).getUTCDay(); return wd !== 0 && wd !== 6 && !HOLIDAYS[ymd(y, m, d)]; }
  /* Sessions that closed after `since` and before now. Returns the count and the dates. */
  function missedSessions(since) {
    var out = [], now = Date.now(), t = new Date(since);
    var et = new Date(t.getTime() + etOffsetMin(t) * 60000), y = et.getUTCFullYear(), m = et.getUTCMonth(), d = et.getUTCDate();
    for (var i = 0; i < 120; i++) {
      var c = closeAt(y, m, d);
      if (c > now) break;
      if (c > since && isSession(y, m, d)) out.push(new Date(Date.UTC(y, m, d, 12)));
      var nx = new Date(Date.UTC(y, m, d + 1)); y = nx.getUTCFullYear(); m = nx.getUTCMonth(); d = nx.getUTCDate();
    }
    return out;
  }
  function fdate(dt) { return MS[dt.getUTCMonth()] + ' ' + dt.getUTCDate(); }
  function fLocal(dt) { return MS[dt.getMonth()] + ' ' + dt.getDate(); }
  function ago(ms) { var h = (Date.now() - ms) / 36e5; if (h < 1) return 'just now'; if (h < 24) return Math.floor(h) + ' hr ago'; var d = Math.floor(h / 24); return d + (d === 1 ? ' day ago' : ' days ago'); }
  function today() { var n = new Date(); return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate(); }

  var CSS = '' +
    '.qs-sync{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:8px;border:1px solid #21304A;background:rgba(12,19,31,.85);color:#AFBFD1;font:600 12.5px Barlow,system-ui,sans-serif;text-decoration:none;white-space:nowrap;transition:box-shadow .2s,border-color .2s}' +
    '.qs-sync:hover{color:#fff;border-color:#3A4F6E}.qs-sync b{color:#fff;font-weight:700}' +
    '.qs-sync .qs-d{width:8px;height:8px;border-radius:50%;background:#57E3B5;box-shadow:0 0 8px rgba(87,227,181,.7);flex:none}' +
    '.qs-sync.s1{border-color:rgba(56,189,248,.6);color:#E0F2FE;box-shadow:0 0 18px rgba(56,189,248,.25)}.qs-sync.s1 .qs-d{background:#38BDF8;box-shadow:0 0 8px #38BDF8;animation:qsfP 1.8s ease-out infinite}' +
    '.qs-sync.s2{border-color:rgba(240,199,102,.85);color:#FCE7A8;background:rgba(40,30,8,.75);animation:qsfG 2s ease-in-out infinite}.qs-sync.s2 .qs-d{background:#F0C766;animation:qsfPg 1.4s ease-out infinite}' +
    '.qs-sync.s3{border-color:rgba(255,122,138,.85);color:#FFD5DB;background:rgba(48,10,18,.75);animation:qsfR 1.6s ease-in-out infinite}.qs-sync.s3 .qs-d{background:#FF7A8A;animation:qsfPr 1.2s ease-out infinite}' +
    '@keyframes qsfP{0%{box-shadow:0 0 0 0 rgba(56,189,248,.7)}100%{box-shadow:0 0 0 9px rgba(56,189,248,0)}}' +
    '@keyframes qsfPg{0%{box-shadow:0 0 0 0 rgba(240,199,102,.8)}100%{box-shadow:0 0 0 10px rgba(240,199,102,0)}}' +
    '@keyframes qsfPr{0%{box-shadow:0 0 0 0 rgba(255,122,138,.8)}100%{box-shadow:0 0 0 10px rgba(255,122,138,0)}}' +
    '@keyframes qsfG{0%,100%{box-shadow:0 0 10px rgba(227,179,65,.25)}50%{box-shadow:0 0 26px rgba(227,179,65,.6)}}' +
    '@keyframes qsfR{0%,100%{box-shadow:0 0 10px rgba(255,122,138,.25)}50%{box-shadow:0 0 26px rgba(255,122,138,.6)}}' +
    '.qs-fbar{position:relative;z-index:4;width:100%;margin:0;border-top:1px solid rgba(255,255,255,.04);box-sizing:border-box;padding:12px 24px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font:500 14px Barlow,system-ui,sans-serif;color:#EEF3FA;border-bottom:1px solid rgba(56,189,248,.45);background:linear-gradient(90deg,rgba(8,40,66,.92),rgba(10,24,44,.92));box-shadow:0 0 34px rgba(56,140,255,.25)}' +
    '.qs-fbar.s2{border-bottom-color:rgba(240,199,102,.75);background:linear-gradient(90deg,rgba(58,42,8,.94),rgba(30,22,6,.94));box-shadow:0 0 40px rgba(227,179,65,.3)}' +
    '.qs-fbar.s3{border-bottom-color:rgba(255,122,138,.8);background:linear-gradient(90deg,rgba(70,14,26,.95),rgba(36,8,14,.95));box-shadow:0 0 40px rgba(255,122,138,.3)}' +
    '.qs-fbar .qs-ic{font-size:22px;line-height:1;animation:qsfB 2.4s ease-in-out infinite}@keyframes qsfB{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '.qs-fbar b{color:#fff}.qs-fbar .qs-m{color:#C7D3E1}' +
    '.qs-fbtn{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 16px;border:none;border-radius:8px;background-image:linear-gradient(180deg,#F0C766,#D8B25A);color:#05080D !important;font:700 14px Barlow,system-ui,sans-serif;text-decoration:none;cursor:pointer;box-shadow:0 0 0 1px rgba(255,214,120,.55) inset,0 0 24px rgba(227,179,65,.5)}' +
    '.qs-fbtn:hover{box-shadow:0 0 0 1px rgba(255,214,120,.9) inset,0 0 36px rgba(227,179,65,.75)}' +
    '.qs-flink{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:transparent;color:#C7D3E1;font:600 13px Barlow,system-ui,sans-serif;cursor:pointer}.qs-flink:hover{color:#fff;border-color:rgba(255,255,255,.4)}' +
    '.qs-ftoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:900;max-width:min(560px,calc(100vw - 32px));padding:16px 20px;border-radius:14px;border:1px solid rgba(87,227,181,.6);background:rgba(6,20,16,.96);color:#EEF3FA;font:500 14px Barlow,system-ui,sans-serif;box-shadow:0 0 50px rgba(87,227,181,.35);animation:qsfIn .4s ease-out}' +
    '@keyframes qsfIn{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}' +
    '.qs-sync .qs-short{display:none}@media (max-width:1760px){.qs-sync .qs-full{display:none}.qs-sync .qs-short{display:inline}.qs-sync{padding:0 10px}}' +
    '@media (max-width:1560px) and (min-width:761px){.hdr-actions input[type=search]{width:92px !important}.hdr-actions kbd{display:none !important}}' +
    '@media (max-width:760px){.qs-sync{padding:0;width:40px;justify-content:center}.qs-sync .qs-t{display:none}.qs-fbar{padding:12px 16px;justify-content:flex-start}}';
  function css() { if (document.getElementById('qs-fresh-css')) return; var s = document.createElement('style'); s.id = 'qs-fresh-css'; s.textContent = CSS; document.head.appendChild(s); }

  function whenEl(sel) { return new Promise(function (res) { var e = document.querySelector(sel); if (e) return res(e); var mo = new MutationObserver(function () { var x = document.querySelector(sel); if (x) { mo.disconnect(); res(x); } }); mo.observe(document.documentElement, { childList: true, subtree: true }); }); }

  function fetchInfo() {
    return Promise.resolve(window.TJ_READY).then(function () {
      var sb = window.tj, s = window.TJ_SESSION; if (!sb || !s) return null;
      var uid = s.user.id;
      var pImp = sb.from('imports').select('created_at').order('created_at', { ascending: false }).limit(1).then(function (r) { return r && !r.error && r.data && r.data[0] ? new Date(r.data[0].created_at).getTime() : null; }, function () { return null; });
      var pO = sb.from('trades').select('opened_at, created_at').order('opened_at', { ascending: false }).limit(1).then(function (r) { return r && r.data ? r.data[0] : null; }, function () { return null; });
      var pC = sb.from('trades').select('closed_at').not('closed_at', 'is', null).order('closed_at', { ascending: false }).limit(1).then(function (r) { return r && r.data ? r.data[0] : null; }, function () { return null; });
      return Promise.all([pImp, pO, pC]).then(function (a) {
        var imp = a[0], o = a[1], c = a[2];
        if (!o) return { uid: uid, none: true };
        var last = Math.max(o.opened_at ? +new Date(o.opened_at) : 0, c && c.closed_at ? +new Date(c.closed_at) : 0);
        if (!imp) imp = o.created_at ? +new Date(o.created_at) : last;
        var ack = 0; try { ack = Number(localStorage.getItem('qs_fresh_ack_' + uid)) || 0; } catch (e) {}
        var missed = missedSessions(imp), missedAck = missedSessions(Math.max(imp, ack));
        return { uid: uid, imported: imp, through: new Date(imp), lastTrade: new Date(last), missed: missed.length, missedDays: missed, bannerMissed: missedAck.length };
      });
    });
  }
  function level(n) { return n <= 0 ? 0 : n === 1 ? 1 : n < 5 ? 2 : 3; }

  function paintChip(info) {
    whenEl('.hdr-actions').then(function (box) {
      css();
      var old = box.querySelector('span[title*="Direct broker connections"]'); if (old) old.style.display = 'none';
      var a = document.getElementById('qs-sync');
      if (!a) { a = document.createElement('a'); a.id = 'qs-sync'; a.href = 'import.html'; a.className = 'qs-sync'; var imp = box.querySelector('a[href="import.html"]'); box.insertBefore(a, imp || box.firstChild); }
      if (!info) { a.style.display = 'none'; return; }
      if (info.none) { a.className = 'qs-sync s2'; a.title = 'Import a CSV from your broker to start your journal.'; a.innerHTML = '<span class="qs-d"></span><span class="qs-t"><span class="qs-full">No trades yet · <b>Import</b></span><span class="qs-short"><b>Import</b></span></span>'; return; }
      var L = level(info.missed), th = fLocal(info.through);
      a.className = 'qs-sync' + (L ? ' s' + L : '');
      a.title = 'Last import ' + ago(info.imported) + '. Your journal includes trades up to ' + th + '. Quillstrike updates when you import a new CSV from your broker.' + (info.missed ? ' ' + info.missed + ' trading session' + (info.missed === 1 ? ' has' : 's have') + ' closed since then.' : '');
      a.setAttribute('aria-label', a.title);
      a.innerHTML = L === 0 ? '<span class="qs-d"></span><span class="qs-t"><span class="qs-full">Up to date · through ' + th + '</span><span class="qs-short">Synced</span></span>'
        : '<span class="qs-d"></span><span class="qs-t"><span class="qs-full"><b>' + info.missed + ' session' + (info.missed === 1 ? '' : 's') + '</b> to import · through ' + th + '</span><span class="qs-short"><b>' + info.missed + '</b> to import</span></span>';
    });
  }
  function paintBanner(info) {
    if (!info || info.none || !BANNER_PAGES[page]) return;
    var n = info.bannerMissed, L = level(n);
    if (L === 0) return;
    if (L === 1 && page !== 'dashboard.html') return; // one session: dashboard only
    var snooze = null; try { snooze = localStorage.getItem('qs_fresh_snooze_' + info.uid); } catch (e) {}
    if (snooze === today() && L < 3) return;
    whenEl('header').then(function (hdr) {
      css(); if (document.getElementById('qs-fbar')) return;
      var bar = document.createElement('div'); bar.id = 'qs-fbar'; bar.className = 'qs-fbar' + (L >= 2 ? ' s' + L : ''); bar.setAttribute('role', 'status');
      var last = info.missedDays[info.missedDays.length - 1];
      var nowEt = new Date(Date.now() + etOffsetMin(new Date()) * 60000), isToday = last.getUTCFullYear() === nowEt.getUTCFullYear() && last.getUTCMonth() === nowEt.getUTCMonth() && last.getUTCDate() === nowEt.getUTCDate();
      var msg = L === 1 ? '<b>The market closed ' + (isToday ? 'today' : 'on ' + fdate(last)) + '.</b> <span class="qs-m">Import your trades to keep your stats, streak and plans current.</span>'
        : L === 2 ? '<b>Your journal is ' + n + ' trading sessions behind.</b> <span class="qs-m">Stats, discipline streak and awards only include trades through ' + fLocal(info.through) + '.</span>'
        : '<b>Your journal is ' + n + ' trading sessions behind.</b> <span class="qs-m">Your stats, streak and award standings are missing everything since ' + fLocal(info.through) + '.</span>';
      bar.innerHTML = '<span class="qs-ic" aria-hidden="true">' + (L === 1 ? '🔔' : L === 2 ? '⏳' : '⚠️') + '</span><span>' + msg + '</span><span style="display:flex;gap:8px;flex-wrap:wrap"><a class="qs-fbtn" href="import.html">Import trades</a><button class="qs-flink" data-x="none">I didn’t trade</button>' + (L < 3 ? '<button class="qs-flink" data-x="later">Remind me tomorrow</button>' : '') + '</span>';
      hdr.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (!x) return;
        try { if (x === 'later') localStorage.setItem('qs_fresh_snooze_' + info.uid, today()); if (x === 'none') localStorage.setItem('qs_fresh_ack_' + info.uid, String(Date.now())); } catch (er) {}
        bar.remove();
      });
    });
  }
  /* After an import finishes, confirm what's now covered and nudge the daily habit. */
  function hookImport() {
    var tries = 0, iv = setInterval(function () {
      if (++tries > 100) clearInterval(iv);
      if (!window.TJImport || window.TJImport.__qsFresh) return;
      clearInterval(iv);
      var orig = window.TJImport.save; window.TJImport.__qsFresh = true;
      window.TJImport.save = function () {
        return orig.apply(this, arguments).then(function (r) {
          try { localStorage.removeItem('qs_fresh_snooze_' + ((window.TJ_SESSION && window.TJ_SESSION.user.id) || '')); } catch (e) {}
          fetchInfo().then(function (info) {
            paintChip(info);
            var b = document.getElementById('qs-fbar'); if (b) b.remove();
            if (!info || info.none) return;
            css(); var t = document.createElement('div'); t.className = 'qs-ftoast'; t.setAttribute('role', 'status');
            t.innerHTML = '<div style="display:flex;gap:12px;align-items:flex-start"><span style="font-size:24px;line-height:1">✅</span><div><b style="font-size:16px;color:#57E3B5">You’re up to date through ' + fLocal(info.through) + '.</b><div style="color:#C7D3E1;margin-top:4px">Tip: import after each trading day. Your streak, plans and award standings stay current, and the header shows when it’s time again.</div></div><button aria-label="Close" style="margin-left:8px;border:none;background:transparent;color:#9AACC1;font-size:18px;cursor:pointer">✕</button></div>';
            document.body.appendChild(t); t.querySelector('button').onclick = function () { t.remove(); }; setTimeout(function () { if (t.parentNode) t.remove(); }, 12000);
          });
          return r;
        });
      };
    }, 150);
  }

  var NOTES = { 'discipline.html': 'Your score and streak are counted through your last import on {d}.', 'plans.html': 'Plans from after {d} will match once you import those trades.', 'wrapped.html': 'Your Wrapped includes trades through {d}.', 'dna.html': 'Your Trader DNA uses trades through {d}.', 'ask.html': 'Answers include trades through {d}.' };
  function paintNote(i) {
    if (!i || i.none || !i.missed || !NOTES[page]) return;
    whenEl('#qs-app > .qx').then(function (box) {
      if (box.querySelector('.qs-fnote')) return; css();
      var n = document.createElement('div'); n.className = 'qx-note qs-fnote'; n.style.cssText = 'border-color:rgba(240,199,102,.55);background:rgba(240,199,102,.07);color:#FCE7A8';
      n.innerHTML = '⏳ ' + NOTES[page].replace('{d}', '<b>' + fLocal(i.through) + '</b>') + ' ' + i.missed + ' trading session' + (i.missed === 1 ? ' has' : 's have') + ' closed since your last import. <a href="import.html" style="color:#F0C766;font-weight:700">Import now</a>';
      box.insertBefore(n, box.firstChild);
    });
  }
  var info = fetchInfo();
  window.QSFresh = info;
  info.then(function (i) { paintChip(i); paintBanner(i); paintNote(i); }, function () {});
  if (page === 'import.html') hookImport();
  // re-check every 5 minutes so the chip changes when the market closes while the page is open
  setInterval(function () { fetchInfo().then(paintChip); }, 300000);
})();
