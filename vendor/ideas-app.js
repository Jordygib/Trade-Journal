/* Quillstrike Ideas workspace: interactive chart + side panels (watchlist, ideas for this stock, all stocks). */
(function () {
  var G = '#4FD1B5', L = '#F0607A', BLUE = '#38BDF8', GOLD = '#D8B25A', PURP = '#C792EA', GRID = 'rgba(56,189,248,0.07)', AX = '#8A9C95';
  var CAT = { SPX: ['S&P 500 Index', 5790, 0.8], XSP: ['Mini S&P 500 Index', 579, 0.8], SPY: ['SPDR S&P 500 ETF', 578, 0.8], QQQ: ['Invesco QQQ Trust', 498, 1], IWM: ['iShares Russell 2000 ETF', 225, 1.1], DIA: ['SPDR Dow Jones ETF', 430, 0.8], VIX: ['Cboe Volatility Index', 17, 3],
    AAPL: ['Apple', 228, 1.1], MSFT: ['Microsoft', 418, 1], NVDA: ['NVIDIA', 200, 1.8], AMZN: ['Amazon', 190, 1.3], META: ['Meta Platforms', 575, 1.4], GOOGL: ['Alphabet', 165, 1.2], TSLA: ['Tesla', 250, 2.2], AMD: ['Advanced Micro Devices', 150, 1.8], NFLX: ['Netflix', 700, 1.4],
    CMG: ['Chipotle Mexican Grill', 57, 1.3], COF: ['Capital One Financial', 206, 1.2], JPM: ['JPMorgan Chase', 220, 1], BAC: ['Bank of America', 42, 1.1], WMT: ['Walmart', 129, 0.8], COST: ['Costco', 900, 0.9], DIS: ['Disney', 95, 1.2], BA: ['Boeing', 160, 1.5], INTC: ['Intel', 23, 1.7],
    UBER: ['Uber Technologies', 75, 1.5], SOFI: ['SoFi Technologies', 12, 2], PLTR: ['Palantir', 40, 2.3], COIN: ['Coinbase', 200, 2.5], HOOD: ['Robinhood', 30, 2.4], GLD: ['SPDR Gold Shares', 240, 0.7], SLV: ['iShares Silver Trust', 28, 1.2], TLT: ['20+ Year Treasury ETF', 92, 0.7],
    ORCL: ['Oracle', 170, 1.2], CRM: ['Salesforce', 290, 1.3], KO: ['Coca-Cola', 70, 0.6], PEP: ['PepsiCo', 165, 0.6], XOM: ['Exxon Mobil', 115, 1], CVX: ['Chevron', 150, 1], F: ['Ford', 11, 1.5], GM: ['General Motors', 50, 1.4], NKE: ['Nike', 80, 1.2],
    SBUX: ['Starbucks', 95, 1.1], MCD: ["McDonald's", 290, 0.7], V: ['Visa', 280, 0.8], MA: ['Mastercard', 500, 0.8], PYPL: ['PayPal', 70, 1.5], SHOP: ['Shopify', 80, 2], SMCI: ['Super Micro Computer', 40, 3], MU: ['Micron', 100, 1.8], AVGO: ['Broadcom', 170, 1.6], ADBE: ['Adobe', 520, 1.3], XLV: ['Health Care Select ETF', 150, 0.7], XLE: ['Energy Select ETF', 90, 1.1], XLF: ['Financial Select ETF', 46, 0.9] };
  var TFS = [['1D', '1 day'], ['5D', '5 days'], ['1M', '1 month'], ['3M', '3 months'], ['6M', '6 months'], ['YTD', 'Year to date'], ['1Y', '1 year'], ['5Y', '5 years']];
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  var rng = function (seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  var gauss = function (r) { var u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  var info = function (s) { return CAT[s] || [s, 20 + hash(s) % 280, 1.3]; };
  var fmt = function (p) { return p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(p < 10 ? 3 : 2); };
  var money = function (n) { return (n < 0 ? '−$' : '+$') + Math.abs(Math.round(n)).toLocaleString('en-US'); };
  var ago = function (iso) { var m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4)); if (m < 1) return 'just now'; if (m < 60) return m + 'm'; var h = Math.round(m / 60); if (h < 24) return h + 'h'; var d = Math.round(h / 24); return d < 30 ? d + 'd' : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

  /* ---------- sample market data (deterministic per symbol) */
  var cache = {};
  function series(sym, kind) {
    var key = sym + '|' + kind; if (cache[key]) return cache[key];
    var inf = info(sym), r = rng(hash(key)), vol = 0.013 * inf[2], bars = [], now = new Date(), t, i;
    if (kind === 'd') {
      var days = []; t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (days.length < 1300) { if (t.getDay() && t.getDay() < 6) days.unshift(new Date(t)); t = new Date(t.getTime() - 864e5); }
      var p = 100, raw = [];
      for (i = 0; i < days.length; i++) { var o = p * (1 + gauss(r) * vol * 0.25), c = o * (1 + gauss(r) * vol + 0.0003), h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * vol * 0.5), l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * vol * 0.5); raw.push([days[i].getTime(), o, h, l, c, Math.round(Math.exp(15 + gauss(r) * 0.4) * (1 + Math.abs(c - o) / o * 30))]); p = c; }
      var k = inf[1] / p; bars = raw.map(function (b) { return { t: b[0], o: b[1] * k, h: b[2] * k, l: b[3] * k, c: b[4] * k, v: b[5] }; });
    } else {
      var step = kind === 'm5' ? 5 : 15, per = 390 / step, ndays = kind === 'm5' ? 1 : 5, ds = [], d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (ds.length < ndays) { if (d0.getDay() && d0.getDay() < 6) ds.unshift(new Date(d0)); d0 = new Date(d0.getTime() - 864e5); }
      var last = series(sym, 'd'), pc = last[last.length - 1 - ndays].c, raw2 = [], pv = vol / Math.sqrt(per);
      ds.forEach(function (d) { for (var j = 0; j < per; j++) { var tt = new Date(d); tt.setHours(9, 30 + j * step, 0, 0); var o = pc, c = o * (1 + gauss(r) * pv), h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * pv * 0.4), l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * pv * 0.4); raw2.push({ t: tt.getTime(), o: o, h: h, l: l, c: c, v: Math.round(Math.exp(12 + gauss(r) * 0.5) * (j < 3 || j > per - 4 ? 2.5 : 1)) }); pc = c; } });
      var k2 = last[last.length - 1].c / pc; bars = raw2.map(function (b) { return { t: b.t, o: b.o * k2, h: b.h * k2, l: b.l * k2, c: b.c * k2, v: b.v }; });
    }
    cache[key] = bars; return bars;
  }
  function weekly(d) { var out = [], cur = null; d.forEach(function (b) { var dt = new Date(b.t), wk = Math.floor((b.t / 864e5 + 3) / 7); if (!cur || cur.wk !== wk) { cur = { wk: wk, t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }; out.push(cur); } else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v; } }); return out; }
  function dataFor(sym, tf) {
    if (tf === '1D') return { bars: series(sym, 'm5'), intra: true, show: 78 };
    if (tf === '5D') return { bars: series(sym, 'm15'), intra: true, show: 130 };
    var d = series(sym, 'd');
    if (tf === '5Y') return { bars: weekly(d), intra: false, show: 260 };
    var n = { '1M': 22, '3M': 63, '6M': 126, '1Y': 252 }[tf];
    if (tf === 'YTD') { var y0 = new Date(new Date().getFullYear(), 0, 1).getTime(); n = d.filter(function (b) { return b.t >= y0; }).length || 5; }
    return { bars: d, intra: false, show: n };
  }
  function sma(b, n) { var o = [], s = 0; for (var i = 0; i < b.length; i++) { s += b[i].c; if (i >= n) s -= b[i - n].c; o.push(i >= n - 1 ? s / n : null); } return o; }
  function ema(b, n) { var o = [], k = 2 / (n + 1), e = null; for (var i = 0; i < b.length; i++) { e = e == null ? b[i].c : b[i].c * k + e * (1 - k); o.push(i >= n - 1 ? e : null); } return o; }
  function rsi(b, n) { var o = [null], g = 0, l = 0; for (var i = 1; i < b.length; i++) { var d = b[i].c - b[i - 1].c, up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= n) { g += up / n; l += dn / n; o.push(i === n ? 100 - 100 / (1 + g / (l || 1e-9)) : null); } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o.push(100 - 100 / (1 + g / (l || 1e-9))); } } return o; }

  /* ---------- styles */
  var CSS = '.qi{display:flex;height:calc(100vh - 150px);min-height:620px;border-top:1px solid rgba(56,189,248,.25);font-family:Barlow,system-ui,sans-serif;color:#EEF4F1;background:#0C1311}' +
    '.qi-main{flex:1;min-width:0;display:flex;flex-direction:column}.qi-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 12px;border-bottom:1px solid #1E2A26;background:#0F1714}' +
    '.qi-sym{position:relative}.qi-sym input{width:150px;min-height:34px;padding:0 10px 0 30px;border:1px solid #2B3B36;border-radius:8px;background:#121C18;color:#fff;font:700 15px Barlow,sans-serif;text-transform:uppercase}.qi-sym input:focus{outline:none;border-color:#38BDF8;box-shadow:0 0 0 2px rgba(56,189,248,.3)}' +
    '.qi-sym svg{position:absolute;left:9px;top:10px}.qi-dd{position:absolute;top:40px;left:0;z-index:20;width:300px;max-height:340px;overflow:auto;border:1px solid #2B3B36;border-radius:10px;background:#121B18;box-shadow:0 14px 36px rgba(0,0,0,.5)}' +
    '.qi-dd button{display:flex;width:100%;gap:10px;align-items:center;padding:8px 12px;border:none;background:transparent;color:#EEF4F1;font:inherit;text-align:left;cursor:pointer}.qi-dd button:hover,.qi-dd button.on{background:rgba(56,189,248,.12)}.qi-dd b{min-width:58px}.qi-dd span{color:#A8B8B1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.qi-grp{display:flex;gap:2px;padding:3px;border-radius:8px;background:#121C18;border:1px solid #22302B}.qi-grp button{min-height:28px;min-width:30px;padding:0 9px;border:none;border-radius:6px;background:transparent;color:#B8C6C0;font:600 12px Barlow,sans-serif;cursor:pointer}.qi-grp button[aria-pressed="true"]{background:rgba(56,189,248,.18);color:#fff}.qi-grp button:hover{color:#fff}' +
    '.qi-ind{position:relative}.qi-ind .menu{position:absolute;top:38px;left:0;z-index:20;min-width:200px;padding:6px;border:1px solid #2B3B36;border-radius:10px;background:#121B18;box-shadow:0 14px 36px rgba(0,0,0,.5)}.qi-ind label{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;font-size:13px;cursor:pointer}.qi-ind label:hover{background:rgba(56,189,248,.1)}' +
    '.qi-btn{min-height:34px;padding:0 12px;border:1px solid #2B3B36;border-radius:8px;background:#121C18;color:#DCE6E1;font:600 13px Barlow,sans-serif;cursor:pointer}.qi-btn:hover{border-color:#38BDF8;color:#fff}' +
    '.qi-note{margin-left:auto;font-size:11px;color:#74877F}.qi-chart{position:relative;flex:1;min-height:0;touch-action:none;cursor:crosshair;outline:none}.qi-chart.pan{cursor:grabbing}.qi-chart canvas{position:absolute;inset:0;width:100%;height:100%}' +
    '.qi-legend{position:absolute;left:12px;top:8px;z-index:2;pointer-events:none;font-size:13px;line-height:1.5;text-shadow:0 1px 2px #000}.qi-legend .t{font:700 16px "Barlow Semi Condensed",Barlow,sans-serif}.qi-legend .m{color:#A8B8B1}' +
    '.qi-measure{position:absolute;z-index:3;pointer-events:none;padding:6px 10px;border-radius:6px;font:700 12px Barlow,sans-serif;color:#05090C;white-space:nowrap}' +
    '.qi-rail{flex:none;width:54px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 0;border-left:1px solid #1E2A26;background:#0F1714}.qi-rail button{position:relative;width:40px;height:40px;border:1px solid transparent;border-radius:10px;background:transparent;color:#B8C6C0;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
    '.qi-rail button:hover{color:#fff;background:rgba(56,189,248,.08)}.qi-rail button[aria-pressed="true"]{color:#fff;background:rgba(56,189,248,.16);border-color:rgba(56,189,248,.5);box-shadow:0 0 16px rgba(56,189,248,.25)}.qi-rail .cnt{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#D8B25A;color:#0B1210;font:800 10px Barlow,sans-serif;display:flex;align-items:center;justify-content:center}' +
    '.qi-panel{flex:none;width:400px;max-width:100%;display:flex;flex-direction:column;border-left:1px solid rgba(56,189,248,.3);background:#0F1714;box-shadow:-10px 0 30px rgba(0,0,0,.25)}.qi-ph{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid #1E2A26}.qi-ph h2{margin:0;font:700 20px "Barlow Semi Condensed",Barlow,sans-serif}' +
    '.qi-x{width:32px;height:32px;border:none;border-radius:8px;background:transparent;color:#B8C6C0;font-size:20px;cursor:pointer}.qi-x:hover{background:rgba(255,255,255,.06);color:#fff}.qi-tabs{display:flex;gap:4px;padding:8px 14px 0;border-bottom:1px solid #1E2A26}.qi-tabs button{min-height:36px;padding:0 12px;border:none;background:transparent;color:#A8B8B1;font:600 14px Barlow,sans-serif;cursor:pointer;box-shadow:inset 0 -2px 0 transparent}.qi-tabs button[aria-pressed="true"]{color:#fff;box-shadow:inset 0 -2px 0 #38BDF8}' +
    '.qi-pb{flex:1;overflow:auto;padding:12px 14px 18px}.qi-comp{padding:12px;border-radius:10px;border:1px solid #2B3B36;background:#121C18}.qi-comp textarea{width:100%;box-sizing:border-box;min-height:78px;margin-top:8px;padding:10px;border:1px solid #2B3B36;border-radius:8px;background:#0C1311;color:#EEF4F1;font:14px/1.5 Barlow,sans-serif;resize:vertical}.qi-comp textarea:focus,.qi-comp input:focus{outline:none;border-color:#38BDF8}' +
    '.qi-kind{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.qi-kind button{min-height:30px;padding:0 11px;border-radius:999px;border:1px solid #2B3B36;background:transparent;color:#B8C6C0;font:600 12px Barlow,sans-serif;cursor:pointer}.qi-kind button[aria-pressed="true"]{border-color:#38BDF8;background:rgba(56,189,248,.15);color:#fff}' +
    '.qi-symin{width:84px;min-height:30px;padding:0 8px;border:1px solid #2B3B36;border-radius:999px;background:#0C1311;color:#7DD3FC;font:700 12px Barlow,sans-serif;text-transform:uppercase}.qi-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-top:8px}' +
    '.qi-gold{min-height:36px;padding:0 16px;border:none;border-radius:8px;background:#D8B25A;color:#0B1210;font:700 14px Barlow,sans-serif;cursor:pointer}.qi-ghost{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid #2B3B36;background:transparent;color:#CFDAD5;font:600 12px Barlow,sans-serif;cursor:pointer}.qi-ghost:hover{border-color:#38BDF8;color:#fff}' +
    '.qi-post{padding:14px 0;border-bottom:1px solid #1E2A26}.qi-ph2{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px}.qi-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#05090C;font:800 11px Barlow,sans-serif;flex:none}' +
    '.qi-chip{padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700}.qi-symlink{border:none;background:transparent;padding:0;color:#7DD3FC;font:700 13px Barlow,sans-serif;cursor:pointer}.qi-symlink:hover{text-decoration:underline}.qi-body{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.55;color:#E3ECE8}' +
    '.qi-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.qi-acts button{min-height:28px;padding:0 10px;border-radius:999px;border:1px solid #2B3B36;background:transparent;color:#CFDAD5;font:600 12px Barlow,sans-serif;cursor:pointer}.qi-acts button.on{border-color:#4FD1B5;color:#4FD1B5;background:rgba(79,209,181,.12)}.qi-acts button.q{border-color:transparent;color:#74877F}' +
    '.qi-rep{margin:10px 0 0 14px;padding-left:12px;border-left:2px solid rgba(56,189,248,.3)}.qi-rep input{flex:1;min-width:0;min-height:34px;padding:0 10px;border:1px solid #2B3B36;border-radius:8px;background:#0C1311;color:#EEF4F1;font:inherit;font-size:13px}' +
    '.qi-empty{padding:26px 10px;text-align:center;color:#A8B8B1;font-size:14px}.qi-msg{margin-top:8px;font-size:13px}.qi-wl{display:flex;align-items:center;gap:10px;width:100%;padding:9px 6px;border:none;border-bottom:1px solid #1E2A26;background:transparent;color:#EEF4F1;font:inherit;cursor:pointer;text-align:left}.qi-wl:hover{background:rgba(56,189,248,.06)}.qi-wl.on{background:rgba(56,189,248,.12)}' +
    '@media (max-width:900px){.qi{height:calc(100vh - 170px);position:relative}.qi-panel{position:absolute;inset:0 54px 0 0;width:auto;z-index:15}.qi-note{display:none}}';
  function css() { if (document.getElementById('qi-css')) return; var s = document.createElement('style'); s.id = 'qi-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- app */
  function App(root) {
    this.root = root; this.sym = (function () { try { return (new URLSearchParams(location.search).get('s') || localStorage.getItem('qi_sym') || 'SPY').toUpperCase(); } catch (e) { return 'SPY'; } })();
    this.tf = '3M'; this.type = 'candles'; this.ind = { vol: true, sma20: true, sma50: false, ema200: false, rsi: true };
    try { var si = JSON.parse(localStorage.getItem('qi_ind') || 'null'); if (si) this.ind = si; var t = localStorage.getItem('qi_tf'); if (t) this.tf = t; var ty = localStorage.getItem('qi_type'); if (ty) this.type = ty; } catch (e) {}
    this.panel = 'ideas'; this.tab = 'sym'; this.posts = []; this.loaded = {}; this.openRep = {}; this.drafts = {}; this.kind = 'idea'; this.wl = null;
    css(); this.build(); this.load(); this.renderPanel();
  }
  App.prototype.build = function () {
    var self = this;
    this.root.innerHTML = '<div class="qi"><div class="qi-main"><div class="qi-top">' +
      '<div class="qi-sym"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#8A9C95" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"></circle><path d="M10.5 10.5l4 4"></path></svg><input type="text" aria-label="Symbol" spellcheck="false" autocomplete="off"><div class="qi-dd" hidden role="listbox"></div></div>' +
      '<span class="qi-hint" style="font-size:12px;color:#A8B8B1">Search a symbol to load its chart and community ideas</span>' +
      '<button type="button" class="qi-btn" data-fs title="Full screen">⛶</button><span class="qi-note">Chart and data by TradingView · US stock prices are delayed</span></div>' +
      '<div class="qi-chart qi-tv" style="cursor:default"></div></div>' +
      '<aside class="qi-panel" aria-label="Side panel"></aside>' +
      '<nav class="qi-rail" aria-label="Panels">' +
      '<button type="button" data-p="watch" title="Watchlist" aria-label="Watchlist"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"></path><circle cx="4" cy="6" r="1"></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"></circle></svg></button>' +
      '<button type="button" data-p="ideas" title="Ideas for this stock" aria-label="Ideas for this stock"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"></path></svg><span class="cnt" hidden></span></button>' +
      '<button type="button" data-p="all" title="All stocks" aria-label="Community posts about all stocks"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></button></nav></div>';
    this.inp = this.root.querySelector('.qi-sym input'); this.dd = this.root.querySelector('.qi-dd'); this.ch = this.root.querySelector('.qi-chart'); this.pane = this.root.querySelector('.qi-panel');
    this.inp.value = this.sym; this.tool = 'move';
    document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.qi-sym')) self.dd.hidden = true; });
    this.root.querySelector('[data-fs]').onclick = function () { var q = self.root.querySelector('.qi'); if (document.fullscreenElement) document.exitFullscreen(); else if (q.requestFullscreen) q.requestFullscreen().then(function () { q.style.height = '100vh'; }); };
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement) self.root.querySelector('.qi').style.height = ''; setTimeout(function () { self.draw(); }, 60); });
    this.root.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-p'); if (p === 'all') { self.panel = self.panel === 'ideas' && self.tab === 'all' ? null : 'ideas'; self.tab = 'all'; } else if (p === 'ideas') { self.panel = self.panel === 'ideas' && self.tab === 'sym' ? null : 'ideas'; self.tab = 'sym'; } else self.panel = self.panel === p ? null : p; self.renderPanel(); setTimeout(function () { self.draw(); }, 30); }; });
    this.bindSearch();
  };
  App.prototype.save = function () { try { localStorage.setItem('qi_ind', JSON.stringify(this.ind)); localStorage.setItem('qi_tf', this.tf); localStorage.setItem('qi_type', this.type); localStorage.setItem('qi_sym', this.sym); } catch (e) {} };
  App.prototype.marks = function () {
    var self = this;
    this.root.querySelectorAll('[data-tf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tf') === self.tf)); });
    this.root.querySelectorAll('[data-ty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ty') === self.type)); });
    this.root.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === self.tool)); });
    this.root.querySelectorAll('[data-p]').forEach(function (b) { var p = b.getAttribute('data-p'); b.setAttribute('aria-pressed', String(p === 'watch' ? self.panel === 'watch' : self.panel === 'ideas' && (p === 'all' ? self.tab === 'all' : self.tab === 'sym'))); });
  };
  App.prototype.setSym = function (s) {
    s = String(s || '').toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 6); if (!s) return;
    this.sym = s; this.inp.value = s; this.dd.hidden = true; this.save();
    try { history.replaceState(null, '', location.pathname + '?s=' + s); } catch (e) {}
    this.load(); if (this.panel === 'ideas') { this.tab = this.tab === 'all' ? 'all' : 'sym'; this.renderPanel(); } else { this.fetchPosts(); }
  };
  App.prototype.bindSearch = function () {
    var self = this, sel = 0, list = [];
    var show = function () {
      var q = self.inp.value.trim().toUpperCase(); list = Object.keys(CAT).filter(function (k) { return !q || k.indexOf(q) === 0 || CAT[k][0].toUpperCase().indexOf(q) >= 0; }).slice(0, 12);
      if (q && /^[A-Z.]{1,6}$/.test(q) && list.indexOf(q) < 0) list.unshift(q); sel = 0;
      self.dd.innerHTML = list.map(function (k, i) { return '<button type="button" role="option" data-k="' + esc(k) + '" class="' + (i === sel ? 'on' : '') + '"><b>' + esc(k) + '</b><span>' + esc(CAT[k] ? CAT[k][0] : 'Open ' + k) + '</span></button>'; }).join('');
      self.dd.hidden = !list.length; self.dd.querySelectorAll('[data-k]').forEach(function (b) { b.onmousedown = function (e) { e.preventDefault(); self.setSym(b.getAttribute('data-k')); self.inp.blur(); }; });
    };
    this.inp.addEventListener('focus', function () { self.inp.select(); show(); });
    this.inp.addEventListener('input', show);
    this.inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(list.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); self.dd.querySelectorAll('[data-k]').forEach(function (b, i) { b.className = i === sel ? 'on' : ''; }); }
      else if (e.key === 'Enter') { e.preventDefault(); self.setSym(list[sel] || self.inp.value); self.inp.blur(); } else if (e.key === 'Escape') { self.inp.value = self.sym; self.dd.hidden = true; self.inp.blur(); }
    });
    this.inp.addEventListener('blur', function () { setTimeout(function () { self.dd.hidden = true; if (!self.inp.value.trim()) self.inp.value = self.sym; }, 150); });
  };
  App.prototype.tvSymbol = function (s) {
    var M = { SPX: 'TVC:SPX', NDX: 'TVC:NDX', RUT: 'TVC:RUT', DJI: 'TVC:DJI', VIX: 'TVC:VIX', XSP: 'CBOE:XSP', DXY: 'TVC:DXY' };
    return M[s] || s;
  };
  App.prototype.load = function () {
    this.marks(); var box = this.ch; box.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'tradingview-widget-container'; wrap.style.cssText = 'height:100%;width:100%';
    var inner = document.createElement('div'); inner.className = 'tradingview-widget-container__widget'; inner.style.cssText = 'height:calc(100% - 22px);width:100%';
    var cr = document.createElement('div'); cr.className = 'tradingview-widget-copyright'; cr.style.cssText = 'height:22px;padding:2px 10px;font-size:11px;color:#8A9C95;text-align:right';
    cr.innerHTML = '<a href="https://www.tradingview.com/symbols/' + encodeURIComponent(this.sym) + '/" rel="noopener nofollow" target="_blank" style="color:#7DD3FC;text-decoration:none">' + esc(this.sym) + ' chart by TradingView</a>';
    var sc = document.createElement('script'); sc.type = 'text/javascript'; sc.async = true; sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    sc.textContent = JSON.stringify({ autosize: true, symbol: this.tvSymbol(this.sym), interval: 'D', timezone: 'America/New_York', theme: 'dark', style: '1', locale: 'en',
      allow_symbol_change: false, hide_side_toolbar: false, withdateranges: true, details: false, calendar: false, save_image: true,
      backgroundColor: 'rgba(12, 19, 17, 1)', gridColor: 'rgba(56, 189, 248, 0.06)', support_host: 'https://www.tradingview.com' });
    wrap.appendChild(inner); wrap.appendChild(cr); wrap.appendChild(sc); box.appendChild(wrap);
    this.tvTimer && clearTimeout(this.tvTimer);
    this.tvTimer = setTimeout(function () { if (!inner.querySelector('iframe')) inner.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#A8B8B1">The TradingView chart couldn’t load. Check your connection or ad blocker, then refresh.</div>'; }, 12000);
  };
  App.prototype._sampleLoad = function () {
    var d = dataFor(this.sym, this.tf); this.bars = d.bars; this.intra = d.intra;
    this.n = Math.min(d.show, this.bars.length); this.end = this.bars.length; this.hover = null; this.mz = null;
    this.ma = { sma20: sma(this.bars, 20), sma50: sma(this.bars, 50), ema200: ema(this.bars, 200), rsi: rsi(this.bars, 14) };
    this.marks(); this.draw();
  };
  App.prototype.geo = function () {
    var W = this.ch.clientWidth, H = this.ch.clientHeight, R = 70, B = 26, rsiH = this.ind.rsi ? Math.max(70, Math.round(H * 0.2)) : 0, P = H - B - rsiH;
    var s = Math.max(0, this.end - this.n), e = Math.min(this.bars.length, this.end), vis = this.bars.slice(Math.floor(s), Math.ceil(e));
    var hi = -Infinity, lo = Infinity; vis.forEach(function (b) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); }); if (!isFinite(hi)) { hi = 1; lo = 0; }
    var pad = (hi - lo) * 0.08 || 1; hi += pad; lo -= pad * (this.ind.vol ? 2.4 : 1);
    var bw = (W - R) / this.n, x = function (i) { return (i - s + 0.5) * bw; }, y = function (p) { return 8 + (hi - p) / (hi - lo) * (P - 16); };
    return { W: W, H: H, R: R, B: B, P: P, rsiH: rsiH, s: s, e: e, bw: bw, x: x, y: y, hi: hi, lo: lo, ix: function (px) { return Math.floor(s + px / bw); }, py: function (yy) { return hi - (yy - 8) / (P - 16) * (hi - lo); } };
  };
  App.prototype.draw = function () {
    if (!this.cv) return; var cv = this.cv, ch = this.ch; if (!ch.clientWidth || !this.bars) return;
    var dpr = window.devicePixelRatio || 1, g = this.geo(), c = cv.getContext('2d'); this.g = g;
    cv.width = g.W * dpr; cv.height = g.H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, g.W, g.H);
    c.font = '11px Barlow, system-ui, sans-serif'; c.textBaseline = 'middle';
    var ticks = 6, st = (g.hi - g.lo) / ticks, mag = Math.pow(10, Math.floor(Math.log10(st))), nice = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).find(function (v) { return v >= st; }) || st;
    for (var p = Math.ceil(g.lo / nice) * nice; p <= g.hi; p += nice) { var yy = Math.round(g.y(p)) + 0.5; if (yy < 4 || yy > g.P - 4) continue; c.strokeStyle = GRID; c.beginPath(); c.moveTo(0, yy); c.lineTo(g.W - g.R, yy); c.stroke(); c.fillStyle = AX; c.fillText(fmt(p), g.W - g.R + 8, yy); }
    var self = this, s = Math.floor(g.s), e = Math.ceil(g.e), b = this.bars, lastLbl = -1e9;
    for (var i = s; i < e; i++) { var x = g.x(i), t = new Date(b[i].t), prev = i > 0 ? new Date(b[i - 1].t) : null, lbl = null;
      if (this.intra) { if (!prev || t.getDate() !== prev.getDate()) lbl = MS[t.getMonth()] + ' ' + t.getDate(); else if (t.getMinutes() === 0 && t.getHours() % (this.tf === '1D' ? 1 : 2) === 0) lbl = (t.getHours() % 12 || 12) + (t.getHours() < 12 ? 'am' : 'pm'); }
      else { if (!prev || t.getFullYear() !== prev.getFullYear()) lbl = String(t.getFullYear()); else if (t.getMonth() !== prev.getMonth()) lbl = MS[t.getMonth()]; }
      if (lbl && x - lastLbl > 64 && x < g.W - g.R - 20) { c.strokeStyle = GRID; c.beginPath(); c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, g.H - g.B); c.stroke(); c.fillStyle = AX; c.textAlign = 'center'; c.fillText(lbl, x, g.H - g.B / 2); c.textAlign = 'left'; lastLbl = x; } }
    if (this.ind.vol) { var vmax = 0; for (i = s; i < e; i++) vmax = Math.max(vmax, b[i].v); var vh = g.P * 0.18; for (i = s; i < e; i++) { var hh = b[i].v / vmax * vh; c.fillStyle = b[i].c >= b[i].o ? 'rgba(79,209,181,.25)' : 'rgba(240,96,122,.25)'; c.fillRect(g.x(i) - g.bw * 0.35, g.P - hh, Math.max(1, g.bw * 0.7), hh); } }
    c.save(); c.beginPath(); c.rect(0, 0, g.W - g.R, g.P); c.clip();
    if (this.type === 'candles') { for (i = s; i < e; i++) { var k = b[i], up = k.c >= k.o, cx = Math.round(g.x(i)) + 0.5, w = Math.max(1, g.bw * 0.66); c.strokeStyle = c.fillStyle = up ? G : L; c.beginPath(); c.moveTo(cx, g.y(k.h)); c.lineTo(cx, g.y(k.l)); c.stroke(); var y1 = g.y(Math.max(k.o, k.c)), y2 = g.y(Math.min(k.o, k.c)); c.fillRect(cx - w / 2, y1, w, Math.max(1, y2 - y1)); } }
    else { var col = b[e - 1].c >= b[s].c ? G : L; c.beginPath(); for (i = s; i < e; i++) { var px = g.x(i), py = g.y(b[i].c); if (i === s) c.moveTo(px, py); else c.lineTo(px, py); }
      if (this.type === 'area') { c.save(); c.lineTo(g.x(e - 1), g.P); c.lineTo(g.x(s), g.P); c.closePath(); var gr = c.createLinearGradient(0, 0, 0, g.P); gr.addColorStop(0, col === G ? 'rgba(79,209,181,.3)' : 'rgba(240,96,122,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fill(); c.restore(); c.beginPath(); for (i = s; i < e; i++) { if (i === s) c.moveTo(g.x(i), g.y(b[i].c)); else c.lineTo(g.x(i), g.y(b[i].c)); } }
      c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.lineWidth = 1; }
    [['sma20', BLUE], ['sma50', GOLD], ['ema200', PURP]].forEach(function (m) { if (!self.ind[m[0]]) return; var a = self.ma[m[0]]; c.strokeStyle = m[1]; c.lineWidth = 1.5; c.beginPath(); var on = false; for (var j = s; j < e; j++) { if (a[j] == null) continue; var X = g.x(j), Y = g.y(a[j]); if (!on) { c.moveTo(X, Y); on = true; } else c.lineTo(X, Y); } c.stroke(); c.lineWidth = 1; });
    if (this.mz) { var a1 = this.mz, ax = g.x(a1.i0), bx = g.x(a1.i1), ay = g.y(a1.p0), by = g.y(a1.p1), upm = a1.p1 >= a1.p0; c.fillStyle = upm ? 'rgba(79,209,181,.14)' : 'rgba(240,96,122,.14)'; c.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); c.strokeStyle = upm ? G : L; c.setLineDash([4, 3]); c.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); c.setLineDash([]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
    c.restore();
    var last = b[b.length - 1], ly = g.y(last.c); if (ly > 0 && ly < g.P) { c.strokeStyle = last.c >= b[b.length - 2].c ? G : L; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(0, ly); c.lineTo(g.W - g.R, ly); c.stroke(); c.setLineDash([]); c.fillStyle = c.strokeStyle; c.fillRect(g.W - g.R + 2, ly - 10, g.R - 4, 20); c.fillStyle = '#05090C'; c.font = '700 11px Barlow, sans-serif'; c.fillText(fmt(last.c), g.W - g.R + 7, ly); c.font = '11px Barlow, sans-serif'; }
    if (this.ind.rsi) { var top = g.P + 4, hR = g.rsiH - 8, ry = function (v) { return top + (100 - v) / 100 * hR; }; c.strokeStyle = '#1E2A26'; c.beginPath(); c.moveTo(0, g.P + 0.5); c.lineTo(g.W, g.P + 0.5); c.stroke(); c.fillStyle = 'rgba(199,146,234,.06)'; c.fillRect(0, ry(70), g.W - g.R, ry(30) - ry(70)); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(199,146,234,.4)'; [70, 30].forEach(function (v) { c.beginPath(); c.moveTo(0, ry(v)); c.lineTo(g.W - g.R, ry(v)); c.stroke(); c.fillStyle = AX; c.fillText(String(v), g.W - g.R + 8, ry(v)); }); c.setLineDash([]);
      c.strokeStyle = PURP; c.lineWidth = 1.5; c.beginPath(); var on2 = false; for (i = s; i < e; i++) { var rv = this.ma.rsi[i]; if (rv == null) continue; if (!on2) { c.moveTo(g.x(i), ry(rv)); on2 = true; } else c.lineTo(g.x(i), ry(rv)); } c.stroke(); c.lineWidth = 1; c.fillStyle = PURP; c.fillText('RSI 14', 10, top + 10); }
    var hv = this.hover; if (hv && hv.i >= s && hv.i < e) { var hx = Math.round(g.x(hv.i)) + 0.5; c.strokeStyle = 'rgba(186,230,253,.45)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx, g.H - g.B); c.stroke(); if (hv.y < g.P) { c.beginPath(); c.moveTo(0, hv.y + 0.5); c.lineTo(g.W - g.R, hv.y + 0.5); c.stroke(); } c.setLineDash([]);
      if (hv.y < g.P) { c.fillStyle = '#2A3D46'; c.fillRect(g.W - g.R + 2, hv.y - 10, g.R - 4, 20); c.fillStyle = '#fff'; c.fillText(fmt(g.py(hv.y)), g.W - g.R + 7, hv.y); }
      var d = new Date(b[hv.i].t), dl = MS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + (this.intra ? ' ' + (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? 'am' : 'pm') : ''); var tw = c.measureText(dl).width + 14; c.fillStyle = '#2A3D46'; c.fillRect(hx - tw / 2, g.H - g.B + 2, tw, g.B - 4); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(dl, hx, g.H - g.B / 2); c.textAlign = 'left'; }
    this.legend();
  };
  App.prototype.legend = function () {
    var b = this.bars, i = this.hover ? this.hover.i : b.length - 1, k = b[i], pv = b[Math.max(0, i - 1)], ch = k.c - pv.c, cp = ch / pv.c * 100, col = ch >= 0 ? G : L, inf = info(this.sym), self = this;
    var ma = [['sma20', 'SMA 20', BLUE], ['sma50', 'SMA 50', GOLD], ['ema200', 'EMA 200', PURP]].filter(function (m) { return self.ind[m[0]] && self.ma[m[0]][i] != null; }).map(function (m) { return '<span style="color:' + m[2] + '">' + m[1] + ' ' + fmt(self.ma[m[0]][i]) + '</span>'; }).join(' &nbsp; ');
    this.leg.innerHTML = '<div><span class="t">' + esc(this.sym) + '</span> <span class="m">' + esc(inf[0]) + ' · ' + esc(this.tf) + '</span></div><div><span class="m">O</span> <span style="color:' + col + '">' + fmt(k.o) + '</span> <span class="m">H</span> <span style="color:' + col + '">' + fmt(k.h) + '</span> <span class="m">L</span> <span style="color:' + col + '">' + fmt(k.l) + '</span> <span class="m">C</span> <span style="color:' + col + '">' + fmt(k.c) + '</span> <span style="color:' + col + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + ' (' + (ch >= 0 ? '+' : '') + cp.toFixed(2) + '%)</span></div>' + (ma ? '<div>' + ma + '</div>' : '');
  };
  App.prototype.bindChart = function () {
    var self = this, ch = this.ch, drag = null, pts = {}, pinch = null;
    var loc = function (e) { var r = ch.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    var clampEnd = function () { var min = Math.min(self.n, self.bars.length) * 0.3, max = self.bars.length + self.n * 0.3; self.end = Math.max(min, Math.min(max, self.end)); };
    var zoom = function (f, px) { var g = self.g, anchor = g.s + px / g.bw, nn = Math.max(10, Math.min(self.bars.length * 1.1, self.n * f)); self.end = anchor + (self.end - anchor) * nn / self.n; self.n = nn; clampEnd(); self.draw(); };
    ch.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = e; ch.setPointerCapture(e.pointerId); var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.abs(a.clientX - b.clientX) || 1, n: self.n, end: self.end, mid: (loc(a).x + loc(b).x) / 2 }; drag = null; return; }
      var p = loc(e), measure = (self.tool === 'measure') !== !!e.shiftKey;
      drag = { x0: p.x, end0: self.end, measure: measure, moved: false, i0: self.g.ix(p.x), p0: self.g.py(p.y) };
      if (!measure) ch.classList.add('pan');
    });
    ch.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = e; var ids = Object.keys(pts), p = loc(e), g = self.g; if (!g) return;
      if (pinch && ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.abs(a.clientX - b.clientX) || 1, nn = Math.max(10, Math.min(self.bars.length * 1.1, pinch.n * pinch.d / d)), anchor = pinch.end - pinch.n + pinch.mid / ((g.W - g.R) / pinch.n); self.n = nn; self.end = anchor + (pinch.end - anchor) * nn / pinch.n; clampEnd(); self.draw(); return; }
      if (drag) { if (Math.abs(p.x - drag.x0) > 3) drag.moved = true;
        if (drag.measure) { if (drag.moved) { var i1 = Math.max(0, Math.min(self.bars.length - 1, g.ix(p.x))), p1 = g.py(p.y), i0 = Math.max(0, Math.min(self.bars.length - 1, drag.i0)); self.mz = { i0: i0, i1: i1, p0: drag.p0, p1: p1 };
            var dp = p1 - drag.p0, pct = dp / drag.p0 * 100, nb = i1 - i0, days = Math.round(Math.abs(self.bars[i1].t - self.bars[i0].t) / 864e5); self.meas.hidden = false; self.meas.style.background = dp >= 0 ? G : L;
            self.meas.textContent = (dp >= 0 ? '+' : '−') + Math.abs(dp).toFixed(2) + ' (' + (dp >= 0 ? '+' : '−') + Math.abs(pct).toFixed(2) + '%) · ' + Math.abs(nb) + ' bars' + (self.intra ? '' : ' · ' + days + ' days');
            self.meas.style.left = Math.min(g.W - 230, p.x + 12) + 'px'; self.meas.style.top = Math.max(4, p.y - 34) + 'px'; } }
        else { self.end = drag.end0 - (p.x - drag.x0) / g.bw; clampEnd(); } }
      self.hover = p.x < g.W - g.R ? { i: Math.max(0, Math.min(self.bars.length - 1, g.ix(p.x))), y: p.y } : null; self.draw();
    });
    var end = function (e) { ch.classList.remove('pan'); delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (drag && drag.measure && !drag.moved) { self.mz = null; self.meas.hidden = true; self.draw(); } drag = null; };
    ch.addEventListener('pointerup', end); ch.addEventListener('pointercancel', end);
    ch.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { self.hover = null; self.draw(); } });
    ch.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87, loc(e).x); }, { passive: false });
    ch.addEventListener('dblclick', function () { self.mz = null; self.meas.hidden = true; self.load(); });
    ch.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); self.end += (e.key === 'ArrowRight' ? 1 : -1) * Math.max(1, self.n * 0.1); clampEnd(); self.draw(); } else if (e.key === '+' || e.key === '=') zoom(0.8, self.g.W / 2); else if (e.key === '-') zoom(1.25, self.g.W / 2); else if (e.key === 'Escape') { self.mz = null; self.meas.hidden = true; self.draw(); } });
  };

  /* ---------- community panel */
  var PAL = ['#38BDF8', '#4FD1B5', '#C792EA', '#E0AF68', '#9ECE6A', '#F7A8C0', '#8FD6E8'];
  var av = function (n) { var s = String(n || 'trader'), h = hash(s); return '<span class="qi-av" aria-hidden="true" style="background:' + PAL[h % PAL.length] + '">' + esc(s.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'TJ') + '</span>'; };
  App.prototype.me = function () { return window.TJ_SESSION && window.TJ_SESSION.user ? window.TJ_SESSION.user.id : null; };
  App.prototype.fetchPosts = function (force) {
    var self = this, sb = window.tj, key = this.tab === 'all' ? '*' : this.sym; if (!sb || !this.me()) return;
    if (this.loaded[key] && !force) { this.updateCount(); return; }
    this.loading = true; this.paint();
    var q = sb.from('posts').select('id, user_id, author, kind, symbol, body, created_at, image_url, trade').order('created_at', { ascending: false }).limit(100);
    if (key !== '*') q = q.eq('symbol', key);
    q.then(function (r) {
      if (r.error) { self.loading = false; self.err = 'The ideas feed isn’t set up yet. Run community.sql in Supabase.'; self.paint(); return; }
      var posts = (r.data || []).map(function (p) { return Object.assign({}, p, { helpful: 0, marked: false, replies: [] }); }), ids = posts.map(function (p) { return p.id; });
      if (!ids.length) { self.loaded[key] = posts; self.loading = false; self.paint(); self.updateCount(); return; }
      sb.from('replies').select('id, post_id, user_id, author, body, created_at').in('post_id', ids).order('created_at', { ascending: true }).then(function (rr) {
        var by = {}; posts.forEach(function (p) { by[p.id] = p; }); var reps = (rr.data || []).map(function (x) { return Object.assign({}, x, { helpful: 0, marked: false }); }); reps.forEach(function (x) { if (by[x.post_id]) by[x.post_id].replies.push(x); });
        var rid = reps.map(function (x) { return x.id; }), me = self.me();
        Promise.all([sb.from('helpful_marks').select('post_id, user_id').in('post_id', ids), rid.length ? sb.from('helpful_marks').select('reply_id, user_id').in('reply_id', rid) : Promise.resolve({ data: [] })]).then(function (hm) {
          var rb = {}; reps.forEach(function (x) { rb[x.id] = x; });
          ((hm[0] && hm[0].data) || []).forEach(function (h) { var p = by[h.post_id]; if (p) { p.helpful++; if (h.user_id === me) p.marked = true; } });
          ((hm[1] && hm[1].data) || []).forEach(function (h) { var x = rb[h.reply_id]; if (x) { x.helpful++; if (h.user_id === me) x.marked = true; } });
          self.loaded[key] = posts; self.loading = false; self.paint(); self.updateCount();
        });
      });
    });
  };
  App.prototype.updateCount = function () { var n = (this.loaded[this.sym] || []).length, el = this.root.querySelector('[data-p="ideas"] .cnt'); if (!el) return; el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); };
  App.prototype.renderPanel = function () {
    this.marks(); var p = this.pane;
    if (!this.panel) { p.hidden = true; this.fetchPosts(); return; } p.hidden = false;
    if (this.panel === 'watch') return this.paintWatch();
    this.fetchPosts(); this.paint();
  };
  App.prototype.paintWatch = function () {
    var self = this; if (!this.wl) { try { this.wl = JSON.parse(localStorage.getItem('qi_wl') || 'null'); } catch (e) {} if (!this.wl) this.wl = ['SPY', 'QQQ', 'SPX', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'CMG', 'COF']; }
    var rows = this.wl.map(function (s) { var n = (self.loaded[s] || []).length;
      return '<div style="display:flex;align-items:center"><button type="button" class="qi-wl' + (s === self.sym ? ' on' : '') + '" data-go="' + esc(s) + '"><span style="flex:1;min-width:0"><b>' + esc(s) + '</b><br><span style="font-size:12px;color:#A8B8B1">' + esc(CAT[s] ? CAT[s][0] : 'Stock') + '</span></span><span style="font-size:12px;color:#A8B8B1">' + (n ? n + (n === 1 ? ' idea' : ' ideas') : '') + '</span></button><button type="button" class="qi-x" data-rm="' + esc(s) + '" aria-label="Remove ' + esc(s) + '">×</button></div>'; }).join('');
    this.pane.innerHTML = '<div class="qi-ph"><h2>Watchlist</h2><button type="button" class="qi-x" data-close aria-label="Close panel">×</button></div><div class="qi-pb"><form class="qi-row" style="margin:0 0 10px" data-add><input class="qi-symin" style="flex:1;width:auto;min-height:36px;border-radius:8px" placeholder="Add a symbol" aria-label="Add a symbol" maxlength="6"><button class="qi-gold" type="submit">Add</button></form>' + rows + '<p style="margin-top:12px;font-size:11px;color:#74877F">Click a symbol to open its chart and ideas.</p></div>';
    this.pane.querySelector('[data-close]').onclick = function () { self.panel = null; self.renderPanel(); setTimeout(function () { self.draw(); }, 30); };
    this.pane.querySelector('[data-add]').onsubmit = function (e) { e.preventDefault(); var v = this.querySelector('input').value.trim().toUpperCase().replace(/[^A-Z.]/g, ''); if (v && self.wl.indexOf(v) < 0) { self.wl.push(v); try { localStorage.setItem('qi_wl', JSON.stringify(self.wl)); } catch (er) {} } self.paintWatch(); };
    this.pane.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { self.setSym(b.getAttribute('data-go')); self.paintWatch(); }; });
    this.pane.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { self.wl = self.wl.filter(function (x) { return x !== b.getAttribute('data-rm'); }); try { localStorage.setItem('qi_wl', JSON.stringify(self.wl)); } catch (er) {} self.paintWatch(); }; });
  };
  App.prototype.paint = function () {
    if (this.panel !== 'ideas') return; var self = this, all = this.tab === 'all', key = all ? '*' : this.sym, list = this.loaded[key], me = this.me(), admin = !!(window.TJ_PROFILE && window.TJ_PROFILE.is_admin);
    var h = '<div class="qi-ph"><h2>' + (all ? 'Community' : '$' + esc(this.sym) + ' ideas') + '</h2><button type="button" class="qi-x" data-close aria-label="Close panel">×</button></div>' +
      '<div class="qi-tabs" role="group" aria-label="Show posts"><button type="button" data-tab="sym" aria-pressed="' + !all + '">$' + esc(this.sym) + '</button><button type="button" data-tab="all" aria-pressed="' + all + '">All stocks</button></div><div class="qi-pb">';
    h += '<div class="qi-comp"><div class="qi-kind" role="group" aria-label="Post type"><button type="button" data-kind="idea" aria-pressed="' + (this.kind === 'idea') + '">💡 Idea</button><button type="button" data-kind="question" aria-pressed="' + (this.kind === 'question') + '">❓ Question</button>' +
      '<span style="font-size:12px;color:#8A9C95;margin-left:4px">about</span>' + (all ? '<input class="qi-symin" data-psym value="' + esc(this.postSym || this.sym) + '" maxlength="6" aria-label="Symbol for your post">' : '<span class="qi-chip" style="background:rgba(56,189,248,.14);color:#7DD3FC">$' + esc(this.sym) + '</span>') + '</div>' +
      '<label><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your post</span><textarea data-draft maxlength="1000" placeholder="' + (this.kind === 'question' ? 'Ask the community a question…' : 'What are you seeing? Levels, setups, what you’re watching…') + '">' + esc(this.draft || '') + '</textarea></label>' +
      (this.img ? '<div style="position:relative;display:inline-block;margin-top:8px"><img src="' + esc(this.img.url) + '" alt="Image you’re attaching" style="max-height:120px;max-width:100%;border-radius:8px;border:1px solid #2B3B36;display:block"><button type="button" class="qi-x" data-noimg aria-label="Remove image" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6)">×</button></div>' : '') +
      '<div class="qi-row"><label class="qi-ghost" style="display:inline-flex;align-items:center">🖼 Chart image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-file style="position:absolute;width:1px;height:1px;opacity:0"></label><span style="font-size:11px;color:#74877F">Opinions only. No price targets or buy/sell calls.</span><button type="button" class="qi-gold" data-post>' + (this.posting ? 'Posting…' : (this.kind === 'question' ? 'Ask' : 'Post')) + '</button></div>' +
      (this.msg ? '<p class="qi-msg" role="status" style="color:' + (this.msg.err ? L : G) + '">' + esc(this.msg.text) + '</p>' : '') + '</div>';
    if (this.err) h += '<p class="qi-empty">' + esc(this.err) + '</p>';
    else if (this.loading && !list) h += '<p class="qi-empty">Loading posts…</p>';
    else if (!list || !list.length) h += '<div class="qi-empty">' + (all ? 'No posts yet. Start the conversation.' : 'No ideas about <b>$' + esc(this.sym) + '</b> yet.<br>Be the first to share what you see.') + '</div>';
    else h += list.map(function (p) {
      var mine = p.user_id === me, canDel = mine || admin, open = !!self.openRep[p.id];
      var trade = p.trade ? '<div style="margin-top:8px;padding:10px 12px;border-radius:8px;border:1px solid #2B3B36;background:#121C18;font-size:13px"><b>' + esc((p.trade.sym || '') + ' ' + String(p.trade.name || 'trade').toLowerCase()) + '</b> <span style="float:right;font-weight:700;color:' + (Number(p.trade.pnl) >= 0 ? G : L) + '">' + (p.trade.status === 'open' ? 'Open' : money(Number(p.trade.pnl || 0))) + '</span><div style="color:#A8B8B1;font-size:12px">' + esc(p.trade.structure || '') + '</div></div>' : '';
      return '<article class="qi-post"><div class="qi-ph2">' + av(p.author) + '<b>@' + esc(p.author || 'trader') + '</b><span class="qi-chip" style="' + (p.kind === 'question' ? 'background:rgba(224,175,104,.14);color:#E0AF68' : 'background:rgba(56,189,248,.14);color:#7DD3FC') + '">' + (p.kind === 'question' ? 'Question' : 'Idea') + '</span><button type="button" class="qi-symlink" data-sym="' + esc(p.symbol || '') + '" title="Open $' + esc(p.symbol || '') + ' on the chart">$' + esc(p.symbol || '') + '</button><span style="color:#74877F">' + esc(ago(p.created_at)) + '</span></div>' +
        '<p class="qi-body">' + esc(p.body) + '</p>' + trade + (p.image_url ? '<a href="' + esc(p.image_url) + '" target="_blank" rel="noopener"><img src="' + esc(p.image_url) + '" alt="Chart image from @' + esc(p.author) + '" loading="lazy" style="display:block;max-width:100%;margin-top:8px;border-radius:8px;border:1px solid #2B3B36"></a>' : '') +
        '<div class="qi-acts"><button type="button" class="' + (p.marked ? 'on' : '') + '" data-help="' + esc(p.id) + '" aria-pressed="' + p.marked + '"' + (mine ? ' title="You can’t mark your own post"' : '') + '>👍 Helpful ' + p.helpful + '</button><button type="button" data-open="' + esc(p.id) + '" aria-expanded="' + open + '">💬 ' + (p.replies.length ? p.replies.length + (p.replies.length === 1 ? ' reply' : ' replies') : (p.kind === 'question' ? 'Answer' : 'Reply')) + '</button>' +
        (mine ? '' : '<button type="button" class="q" data-report="' + esc(p.id) + '">⚑ Report</button>') + (canDel ? '<button type="button" class="q" data-del="' + esc(p.id) + '">' + (mine ? 'Delete' : 'Remove (admin)') + '</button>' : '') + '</div>' +
        (open ? '<div class="qi-rep">' + p.replies.map(function (r) { return '<div style="display:flex;gap:8px;margin:0 0 10px">' + av(r.author) + '<div style="flex:1;min-width:0"><div style="font-size:12px"><b>@' + esc(r.author) + '</b> <span style="color:#74877F">' + esc(ago(r.created_at)) + '</span></div><p class="qi-body" style="margin-top:2px;font-size:13px">' + esc(r.body) + '</p><div class="qi-acts" style="margin-top:4px"><button type="button" class="' + (r.marked ? 'on' : '') + '" data-rhelp="' + esc(r.id) + '" data-pid="' + esc(p.id) + '">👍 ' + r.helpful + '</button>' + ((r.user_id === me || admin) ? '<button type="button" class="q" data-rdel="' + esc(r.id) + '" data-pid="' + esc(p.id) + '">' + (r.user_id === me ? 'Delete' : 'Remove') + '</button>' : '') + '</div></div></div>'; }).join('') +
          '<form class="qi-row" data-reply="' + esc(p.id) + '" style="margin-top:4px"><input data-rin="' + esc(p.id) + '" maxlength="1000" placeholder="' + (p.kind === 'question' ? 'Write an answer…' : 'Write a reply…') + '" aria-label="Write a reply" value="' + esc(self.drafts[p.id] || '') + '"><button class="qi-gold" type="submit" style="min-height:34px">Reply</button></form></div>' : '') + '</article>';
    }).join('');
    h += '</div>';
    var sc = this.pane.querySelector('.qi-pb'), top = sc ? sc.scrollTop : 0;
    this.pane.innerHTML = h; var nb = this.pane.querySelector('.qi-pb'); if (nb) nb.scrollTop = top; this.wire();
  };
  App.prototype.wire = function () {
    var self = this, P = this.pane, sb = window.tj, me = this.me(), key = this.tab === 'all' ? '*' : this.sym;
    var flash = function (t, err) { self.msg = { text: t, err: !!err }; self.paint(); };
    var each = function (fn) { Object.keys(self.loaded).forEach(function (k) { (self.loaded[k] || []).forEach(fn); }); };
    P.querySelector('[data-close]').onclick = function () { self.panel = null; self.renderPanel(); setTimeout(function () { self.draw(); }, 30); };
    P.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { self.tab = b.getAttribute('data-tab'); self.msg = null; self.renderPanel(); }; });
    P.querySelectorAll('[data-kind]').forEach(function (b) { b.onclick = function () { self.kind = b.getAttribute('data-kind'); self.paint(); }; });
    var ta = P.querySelector('[data-draft]'); if (ta) ta.oninput = function () { self.draft = ta.value; };
    var ps = P.querySelector('[data-psym]'); if (ps) ps.oninput = function () { self.postSym = ps.value.toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 6); };
    var fi = P.querySelector('[data-file]'); if (fi) fi.onchange = function () { var f = fi.files && fi.files[0]; if (!f) return; if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return flash('Please choose a PNG, JPG, WebP, or GIF image.', true); if (f.size > 5 * 1024 * 1024) return flash('That image is over 5 MB. Try a smaller screenshot.', true); self.img = { file: f, url: URL.createObjectURL(f) }; self.msg = null; self.paint(); };
    var ni = P.querySelector('[data-noimg]'); if (ni) ni.onclick = function () { self.img = null; self.paint(); };
    P.querySelector('[data-post]').onclick = function () {
      var body = (self.draft || '').trim(), sym = self.tab === 'all' ? (self.postSym || self.sym) : self.sym;
      if (!body) return flash('Write something first.', true);
      if (!/^[A-Z.]{1,6}$/.test(sym)) return flash('Enter a valid symbol for your post.', true);
      if (/price target|\bbuy now\b|\bsell now\b/i.test(body)) return flash('Please remove price targets or buy and sell calls. Share your reasoning instead.', true);
      if (!sb || !me) return flash('Sign in to post.', true);
      self.posting = true; self.paint();
      var up = self.img ? (function () { var f = self.img.file, ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png', path = me + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        return sb.storage.from('post-images').upload(path, f, { contentType: f.type, upsert: false }).then(function (u) { if (u.error) throw u.error; return sb.storage.from('post-images').getPublicUrl(path).data.publicUrl; }); })() : Promise.resolve(null);
      up.then(function (url) { var row = { kind: self.kind, symbol: sym, body: body }; if (url) row.image_url = url;
        return sb.from('posts').insert(row).select('id, user_id, author, kind, symbol, body, created_at, image_url, trade').single(); }).then(function (r) {
        self.posting = false; if (r.error) return flash('Couldn’t post. Please try again.', true);
        var p = Object.assign({}, r.data, { helpful: 0, marked: false, replies: [] }); ['*', sym].forEach(function (k) { if (self.loaded[k]) self.loaded[k].unshift(p); });
        self.draft = ''; self.img = null; self.msg = { text: sym === self.sym || self.tab === 'all' ? 'Posted.' : 'Posted to $' + sym + '.', err: false }; self.paint(); self.updateCount();
      }, function (e) { self.posting = false; flash('Couldn’t upload your image' + (e && e.message ? ': ' + e.message : '.'), true); });
    };
    P.querySelectorAll('[data-sym]').forEach(function (b) { b.onclick = function () { self.setSym(b.getAttribute('data-sym')); }; });
    P.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-open'); self.openRep[id] = !self.openRep[id]; self.paint(); }; });
    var toggle = function (item, col, id) { if (item.user_id === me) return flash('You can’t mark your own post as helpful.', true); var on = !item.marked; item.marked = on; item.helpful += on ? 1 : -1; self.paint();
      var q = on ? sb.from('helpful_marks').insert(col === 'post_id' ? { post_id: id } : { reply_id: id }) : sb.from('helpful_marks').delete().eq('user_id', me).eq(col, id);
      q.then(function (r) { if (r && r.error) { item.marked = !on; item.helpful += on ? -1 : 1; flash('Couldn’t save that. Please try again.', true); } }); };
    P.querySelectorAll('[data-help]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-help'); var it = null; each(function (p) { if (p.id === id) { if (!it) it = p; else { p.marked = it.marked; p.helpful = it.helpful; } } }); if (it) toggle(it, 'post_id', id); }; });
    P.querySelectorAll('[data-rhelp]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-rhelp'), it = null; each(function (p) { p.replies.forEach(function (r) { if (r.id === id && !it) it = r; }); }); if (it) toggle(it, 'reply_id', id); }; });
    P.querySelectorAll('[data-rin]').forEach(function (i) { i.oninput = function () { self.drafts[i.getAttribute('data-rin')] = i.value; }; });
    P.querySelectorAll('[data-reply]').forEach(function (f) { f.onsubmit = function (e) { e.preventDefault(); var pid = f.getAttribute('data-reply'), body = (self.drafts[pid] || '').trim(); if (!body) return;
      sb.from('replies').insert({ post_id: pid, body: body }).select('id, post_id, user_id, author, body, created_at').single().then(function (r) { if (r.error) return flash('Couldn’t post your reply.', true); var rep = Object.assign({}, r.data, { helpful: 0, marked: false }); var done = {}; each(function (p) { if (p.id === pid && !done[p.symbol + p.id + (p === p)]) { if (!p.replies.some(function (x) { return x.id === rep.id; })) p.replies.push(rep); } }); self.drafts[pid] = ''; self.paint(); }); }; });
    P.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this post?')) return; var id = b.getAttribute('data-del'); sb.from('posts').delete().eq('id', id).then(function (r) { if (r.error) return flash('Couldn’t delete that post.', true); Object.keys(self.loaded).forEach(function (k) { self.loaded[k] = (self.loaded[k] || []).filter(function (p) { return p.id !== id; }); }); self.paint(); self.updateCount(); }); }; });
    P.querySelectorAll('[data-rdel]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-rdel'); sb.from('replies').delete().eq('id', id).then(function (r) { if (r.error) return flash('Couldn’t delete that reply.', true); each(function (p) { p.replies = p.replies.filter(function (x) { return x.id !== id; }); }); self.paint(); }); }; });
    P.querySelectorAll('[data-report]').forEach(function (b) { b.onclick = function () { var reason = prompt('Why are you reporting this post?\n1 = Spam or promotion\n2 = Price targets or signals\n3 = Harassment\n4 = Something else', '1'); var map = { 1: 'spam', 2: 'signals', 3: 'harassment', 4: 'other' }; if (!reason || !map[reason.trim()]) return;
      sb.from('reports').insert({ post_id: b.getAttribute('data-report'), reason: map[reason.trim()] }).then(function (r) { flash(r && r.error && !/duplicate|unique/i.test(r.error.message || '') ? 'Couldn’t send the report.' : 'Thanks. We’ll review that report.', r && r.error && !/duplicate|unique/i.test(r.error.message || '')); }); }; });
  };

  function mount() { var el = document.getElementById('qs-ideas'); if (!el || el.__qi) return; if (!window.TJ_SESSION && !window.__qiWait) { window.__qiWait = 1; } el.__qi = new App(el); }
  var tries = 0; (function wait() { var el = document.getElementById('qs-ideas'); if (el && ((window.tj && window.TJ_SESSION) || tries > 40)) mount(); else { tries++; setTimeout(wait, 150); } })();
})();
