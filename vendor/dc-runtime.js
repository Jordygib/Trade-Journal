/* Renders the Trade Journal page templates in a normal browser. */
(function () {
  var h = React.createElement;
  var EVT = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onpointerdown: 'onPointerDown', onpointermove: 'onPointerMove', onpointerup: 'onPointerUp', onpointerleave: 'onPointerLeave', onpointercancel: 'onPointerCancel', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', onsubmit: 'onSubmit', onwheel: 'onWheel' };
  var ATTR = { 'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan', readonly: 'readOnly', maxlength: 'maxLength', autocomplete: 'autoComplete' };
  var VOID = { input: 1, img: 1, br: 1, hr: 1, meta: 1, link: 1, source: 1, col: 1 };
  var SKIP_WS = { table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, select: 1, ul: 1, ol: 1, dl: 1, svg: 1, g: 1, defs: 1, linearGradient: 1, radialGradient: 1, clipPath: 1, symbol: 1, colgroup: 1 };
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  function resolve(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^(['"]).*\1$/.test(expr)) return expr.slice(1, -1);
    var parts = expr.split('.'), v = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    var m = str.match(WHOLE);
    if (m) return resolve(m[1], scope);
    return str.replace(HOLE, function (_, e) { var v = resolve(e, scope); return v == null ? '' : String(v); });
  }
  function camel(p) {
    if (p.indexOf('--') === 0) return p;
    if (p.charAt(0) === '-') p = p.charAt(1).toUpperCase() + p.slice(2);
    return p.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }
  function parseStyle(s) {
    var o = {}, depth = 0, cur = '', parts = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    parts.forEach(function (p) {
      var i = p.indexOf(':'); if (i < 0) return;
      var k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
      if (k) o[camel(k)] = v;
    });
    return o;
  }
  function renderKids(nodes, scope) {
    var out = [], i = 0;
    for (var n = 0; n < nodes.length; n++) { var r = render(nodes[n], scope, i++); if (r != null) out.push(r); }
    return out;
  }
  function render(node, scope, key) {
    if (node.nodeType === 3) {
      var t = node.nodeValue, p = node.parentNode;
      if (!t.trim()) {
        if (!p || p.nodeType === 11 || SKIP_WS[p.localName]) return null;
        return ' ';
      }
      return interp(t, scope);
    }
    if (node.nodeType !== 1) return null;
    var tag = node.localName;
    if (tag === 'template') {
      var kids = node.content.childNodes;
      if (node.hasAttribute('data-scfor')) {
        var list = interp(node.getAttribute('list') || '', scope) || [], as = node.getAttribute('as') || 'item';
        return list.map(function (it, i) { var sc = Object.assign({}, scope); sc[as] = it; return h(React.Fragment, { key: i }, renderKids(kids, sc)); });
      }
      if (node.hasAttribute('data-scif')) {
        return interp(node.getAttribute('value') || '', scope) ? h(React.Fragment, { key: key }, renderKids(kids, scope)) : null;
      }
      return null;
    }
    var svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    var props = { key: key };
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], n = at.name, ln = n.toLowerCase();
      if (ln.indexOf('hint-') === 0 || ln.indexOf('data-sc') === 0) continue;
      var v = interp(at.value, scope);
      if (EVT[ln]) { if (typeof v === 'function') props[EVT[ln]] = v; continue; }
      if (ln === 'style') { props.style = parseStyle(String(v == null ? '' : v)); continue; }
      if (ln === 'ref') { if (typeof v === 'function') props.ref = v; continue; }
      if (ATTR[ln]) { props[ATTR[ln]] = v; continue; }
      if (ln === 'value' && (tag === 'input' || tag === 'select' || tag === 'textarea')) { props.value = v == null ? '' : v; continue; }
      if (ln === 'checked') { props.checked = v === true || v === 'true' || v === ''; continue; }
      if (ln === 'disabled') { props.disabled = v === true || v === 'true' || v === '' || v === 'disabled'; continue; }
      if (n === 'xlink:href') n = 'href';
      if (svg && n.indexOf('-') > 0 && ln.indexOf('aria-') !== 0 && ln.indexOf('data-') !== 0) n = camel(n);
      props[n] = v;
    }
    if (VOID[tag]) return h(tag, props);
    return h.apply(null, [tag, props].concat(renderKids(node.childNodes, scope)));
  }
  window.DCLogic = class extends React.Component {};
  document.addEventListener('submit', function (e) { e.preventDefault(); });
  function boot() {
    var tpl = document.getElementById('dc-template');
    var code = document.getElementById('dc-logic').textContent;
    var spec = JSON.parse(document.getElementById('dc-props').textContent || '{}');
    var defaults = {};
    Object.keys(spec).forEach(function (k) { if (k.charAt(0) !== '$') defaults[k] = spec[k]['default']; });
    var Comp = new Function('DCLogic', 'React', code + '\nreturn Component;')(window.DCLogic, React);
    class Page extends Comp {
      render() { var vals = this.renderVals ? this.renderVals() : {}; return h(React.Fragment, null, renderKids(tpl.content.childNodes, vals)); }
    }
    ReactDOM.createRoot(document.getElementById('root')).render(h(Page, defaults));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
