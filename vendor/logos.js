/* Company logos next to tickers. Any element with class "qs-logo" and data-sym gets a logo, with a lettered badge as fallback. */
(function () {
  var INDEX = { SPX: 'S&P', XSP: 'S&P', NDX: 'NDX', RUT: 'RUT', DJI: 'DOW', VIX: 'VIX', SPXW: 'S&P', RUTW: 'RUT', NDXP: 'NDX', DXY: 'DXY' };
  var PAL = ['#38BDF8', '#4FD1B5', '#C792EA', '#E0AF68', '#9ECE6A', '#F7A8C0', '#8FD6E8', '#D8B25A'];
  var bad = {};
  function color(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; }
  function badge(el, sym) {
    var t = INDEX[sym] || sym.replace(/[^A-Z]/g, '').slice(0, sym.length > 3 ? 2 : 3);
    el.textContent = t; el.style.background = INDEX[sym] ? 'linear-gradient(135deg,#38BDF8,#D8B25A)' : color(sym);
    el.style.fontSize = (t.length > 2 ? 7 : 8) * (el.offsetWidth ? el.offsetWidth / 20 : 1) + 'px';
  }
  function paint(el) {
    var sym = String(el.getAttribute('data-sym') || '').trim().toUpperCase().replace(/^\$/, '');
    if (el.__sym === sym) return; el.__sym = sym; el.innerHTML = ''; el.style.background = '';
    if (!sym) return;
    if (INDEX[sym] || bad[sym]) return badge(el, sym);
    var img = new Image(); img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onload = function () { if (el.__sym === sym) { el.innerHTML = ''; el.style.background = '#FFFFFF'; el.appendChild(img); } };
    img.onerror = function () { bad[sym] = 1; if (el.__sym === sym) badge(el, sym); };
    badge(el, sym);
    img.src = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(sym) + '.png';
  }
  function css() {
    if (document.getElementById('qs-logo-css')) return;
    var s = document.createElement('style'); s.id = 'qs-logo-css';
    s.textContent = '.qs-logo{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;margin-right:7px;border-radius:50%;overflow:hidden;vertical-align:middle;background:#1C2824;color:#05090C;font:800 8px Barlow,system-ui,sans-serif;letter-spacing:-.02em;line-height:1;box-shadow:0 0 0 1px rgba(255,255,255,.08)}' +
      '.qs-logo img{width:100%;height:100%;object-fit:contain;padding:2px;box-sizing:border-box;display:block}.qs-logo.lg{width:28px;height:28px;margin-right:10px}.qs-logo.sm{width:16px;height:16px;margin-right:5px}' +
      '.qs-symwrap{display:inline-flex;align-items:center;white-space:nowrap}';
    document.head.appendChild(s);
  }
  function scan(root) { (root || document).querySelectorAll('.qs-logo[data-sym]').forEach(paint); }
  function start() {
    css(); scan();
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'attributes' && m.target.classList && m.target.classList.contains('qs-logo')) { paint(m.target); return; } m.addedNodes && m.addedNodes.forEach(function (n) { if (n.nodeType !== 1) return; if (n.classList.contains('qs-logo')) paint(n); else if (n.querySelectorAll) scan(n); }); }); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sym'] });
  }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
  window.QSLogos = { scan: scan };
})();
