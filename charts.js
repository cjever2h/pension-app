/* 의존성 없는 SVG 차트 */
var CHART = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  function niceStep(range, n) {
    var raw = range / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), r = raw / mag;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function frame(box, W, H) {
    box.innerHTML = '';
    box.classList.add('chart');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, box);
    var tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip);
    return { svg: svg, tip: tip };
  }
  function axes(svg, o) {
    var g = el('g', {}, svg);
    var step = niceStep(o.yMax - o.yMin, 4);
    for (var v = Math.ceil(o.yMin / step) * step; v <= o.yMax + 1e-9; v += step) {
      var y = o.sy(v);
      el('line', { x1: o.pl, x2: o.W - o.pr, y1: y, y2: y, stroke: '#e9ecf1', 'stroke-width': 1 }, g);
      var t = el('text', { x: o.pl - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8a93a3' }, g); t.textContent = o.yFmt(v);
    }
    var xs = niceStep(o.xMax - o.xMin, o.W < 500 ? 5 : 8);
    if (xs < 1) xs = 1;
    var prevLabel = null;
    for (var x = Math.ceil(o.xMin / xs) * xs; x <= o.xMax + 1e-9; x += xs) {
      var lab = o.xFmt(x); if (lab === prevLabel) continue; prevLabel = lab;
      var tx = el('text', { x: o.sx(x), y: o.H - o.pb + 16, 'text-anchor': 'middle', 'font-size': 11, fill: '#8a93a3' }, g); tx.textContent = lab;
    }
  }

  /* 선/면 차트 */
  function line(box, cfg) {
    var W = Math.max(300, box.clientWidth || cfg.width || 680), H = cfg.height || (W < 500 ? 230 : 300), pl = 54, pr = 12, pt = 12, pb = 26;
    var f = frame(box, W, H), svg = f.svg;
    var all = [];
    cfg.series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) return;
    var xMin = Math.min.apply(null, all.map(function (p) { return p.x; })), xMax = Math.max.apply(null, all.map(function (p) { return p.x; }));
    var yMax = Math.max.apply(null, all.map(function (p) { return p.y; })) * 1.05 || 1, yMin = 0;
    if (xMax === xMin) xMax = xMin + 1;
    var sx = function (x) { return pl + (x - xMin) / (xMax - xMin) * (W - pl - pr); };
    var sy = function (y) { return H - pb - (y - yMin) / (yMax - yMin) * (H - pt - pb); };
    axes(svg, { W: W, H: H, pl: pl, pr: pr, pb: pb, sx: sx, sy: sy, xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax, yFmt: cfg.yFmt, xFmt: cfg.xFmt });
    (cfg.bands || []).forEach(function (b) {
      var d = b.upper.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x) + ' ' + sy(p.y); }).join(' ');
      d += ' ' + b.lower.slice().reverse().map(function (p) { return 'L' + sx(p.x) + ' ' + sy(p.y); }).join(' ') + 'Z';
      el('path', { d: d, fill: b.color, opacity: 0.13 }, svg);
    });
    (cfg.markers || []).forEach(function (mk) {
      var x = sx(mk.x);
      el('line', { x1: x, x2: x, y1: pt, y2: H - pb, stroke: mk.color || '#94a3b8', 'stroke-dasharray': '4 4' }, svg);
      var t = el('text', { x: x + 4, y: pt + 12, 'font-size': 11, fill: mk.color || '#64748b', 'font-weight': 700 }, svg); t.textContent = mk.label;
    });
    cfg.series.forEach(function (s) {
      if (!s.points.length) return;
      var d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join(' ');
      if (s.fill) el('path', { d: d + ' L' + sx(s.points[s.points.length - 1].x) + ' ' + sy(0) + ' L' + sx(s.points[0].x) + ' ' + sy(0) + 'Z', fill: s.color, opacity: 0.12 }, svg);
      el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.2, 'stroke-dasharray': s.dash || '', 'stroke-linejoin': 'round' }, svg);
      if (s.dots) s.points.forEach(function (p) { el('circle', { cx: sx(p.x), cy: sy(p.y), r: 3, fill: s.color }, svg); });
    });
    // hover
    var hl = el('line', { y1: pt, y2: H - pb, stroke: '#1b2333', 'stroke-width': 1, opacity: 0 }, svg);
    var hit = el('rect', { x: pl, y: pt, width: W - pl - pr, height: H - pt - pb, fill: 'transparent' }, svg);
    function move(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.clientX - r.left) / r.width * W;
      var xv = xMin + (cx - pl) / (W - pl - pr) * (xMax - xMin);
      var main = cfg.series[0].points, best = main[0];
      main.forEach(function (p) { if (Math.abs(p.x - xv) < Math.abs(best.x - xv)) best = p; });
      hl.setAttribute('x1', sx(best.x)); hl.setAttribute('x2', sx(best.x)); hl.setAttribute('opacity', 0.3);
      var lines = [cfg.xFmt(best.x, true)];
      cfg.series.forEach(function (s) {
        var q = null; s.points.forEach(function (p) { if (Math.abs(p.x - best.x) < 1e-6) q = p; });
        if (q) lines.push(s.name + ' ' + cfg.tipFmt(q.y));
      });
      f.tip.innerHTML = lines.join('<br>');
      f.tip.style.display = 'block';
      f.tip.style.left = Math.min(Math.max(sx(best.x) / W * r.width, 70), r.width - 70) + 'px';
      f.tip.style.top = (sy(best.y) / H * r.height - 8) + 'px';
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', function () { f.tip.style.display = 'none'; hl.setAttribute('opacity', 0); });
  }

  /* 누적 막대 + 목표선 */
  function bars(box, cfg) {
    var W = Math.max(300, box.clientWidth || cfg.width || 680), H = cfg.height || (W < 500 ? 220 : 260), pl = 46, pr = 10, pt = 12, pb = 26;
    var f = frame(box, W, H), svg = f.svg, data = cfg.data;
    if (!data.length) return;
    var yMax = 1;
    data.forEach(function (d) { var s = 0; d.parts.forEach(function (p) { s += Math.max(0, p); }); yMax = Math.max(yMax, s, d.target || 0); });
    yMax *= 1.08;
    var bw = (W - pl - pr) / data.length;
    var xMin = data[0].x, xMax = data[data.length - 1].x;
    var sx = function (x) { return pl + (x - xMin + 0.5) * bw; };
    var sy = function (y) { return H - pb - y / yMax * (H - pt - pb); };
    axes(svg, { W: W, H: H, pl: pl, pr: pr, pb: pb, sx: sx, sy: sy, xMin: xMin, xMax: xMax, yMin: 0, yMax: yMax, yFmt: cfg.yFmt, xFmt: cfg.xFmt });
    data.forEach(function (d) {
      var base = 0;
      d.parts.forEach(function (p, i) {
        if (p <= 0) return;
        el('rect', { x: sx(d.x) - bw * 0.38, y: sy(base + p), width: bw * 0.76, height: sy(base) - sy(base + p), fill: cfg.colors[i], rx: 1.5 }, svg);
        base += p;
      });
    });
    if (cfg.targetName) {
      var d = data.map(function (q, i) { return (i ? 'L' : 'M') + sx(q.x) + ' ' + sy(q.target); }).join(' ');
      el('path', { d: d, fill: 'none', stroke: '#dc2626', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, svg);
    }
    var hit = el('rect', { x: pl, y: pt, width: W - pl - pr, height: H - pt - pb, fill: 'transparent' }, svg);
    function move(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(data.length - 1, Math.floor((cx - pl) / bw))), q = data[i], s = 0;
      var lines = [cfg.xFmt(q.x, true)];
      q.parts.forEach(function (p, k) { s += p; lines.push(cfg.names[k] + ' ' + cfg.tipFmt(p)); });
      lines.push('합계 ' + cfg.tipFmt(s));
      if (cfg.targetName) lines.push(cfg.targetName + ' ' + cfg.tipFmt(q.target));
      f.tip.innerHTML = lines.join('<br>'); f.tip.style.display = 'block';
      f.tip.style.left = Math.min(Math.max(sx(q.x) / W * r.width, 70), r.width - 70) + 'px';
      f.tip.style.top = (sy(Math.max(s, q.target || 0)) / H * r.height - 8) + 'px';
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', function () { f.tip.style.display = 'none'; });
  }

  /* 도넛 */
  function donut(items, colors, size) {
    size = size || 92;
    var r = size / 2 - 8, c = size / 2, total = 0, acc = 0, out = '';
    items.forEach(function (it) { total += it.w; });
    items.forEach(function (it, i) {
      var a0 = acc / total * Math.PI * 2 - Math.PI / 2; acc += it.w;
      var a1 = acc / total * Math.PI * 2 - Math.PI / 2;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      out += '<path d="M' + (c + r * Math.cos(a0)).toFixed(2) + ' ' + (c + r * Math.sin(a0)).toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (c + r * Math.cos(a1)).toFixed(2) + ' ' + (c + r * Math.sin(a1)).toFixed(2) + '" stroke="' + colors[i % colors.length] + '" stroke-width="14" fill="none"/>';
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + out + '</svg>';
  }

  return { line: line, bars: bars, donut: donut };
})();
