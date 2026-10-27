(function () {
  'use strict';
  var KEY = 'pensionPlanner.v1';
  var ACC = BOOK.accounts, PF = BOOK.portfolios;
  var ACC_KEYS = ['p1', 'p2', 'irp', 'isa', 'rirp'];
  var COLORS = ['#2f6fed', '#12a594', '#f59e0b', '#7a5af8', '#ef4444', '#0ea5e9', '#b7791f', '#64748b'];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ───────── 상태 ───────── */
  function addYears(ym, y) { return SIM.indexToYm(SIM.ymToIndex(ym) + Math.round(y * 12)); }
  function defaults() {
    var now = SIM.nowYm();
    return {
      inp: {
        age: 52, monthly: 150, years: 13, startYm: now, payoutYm: addYears(now, 13), lifeAge: 100,
        allocMode: 'book', custom: { p1: 50, p2: 0, irp: 25, isa: 75 },
        rets: { p1: 7, p2: 7, irp: 6, isa: 6.5, rirp: 3 }, retsAuto: true, payRet: 5,
        incomeLow: true, isaLow: false, isaConvert: true,
        exPension: 0, exIsa: 0, exRirp: 0, npsMonthly: 100, npsAge: 65, target: 300, inflation: 2.5,
        method: 'rate', rate: 4, fixedMonthly: 150, fixedInflate: true, periodYears: 25,
        growth: 0, rirpTax: 3, has5y: false
      },
      style: { aa: 'aa_gomhee', div: 'div_balance', payDiv: 'div_defense', tdfTilt: 0, quiz: {} },
      records: [], holdings: { p1: [], p2: [], irp: [], isa: [], rirp: [] },
      checks: {}, rebal: {}, ui: { real: false, holdAcc: 'p1' }
    };
  }
  function merge(d, s) {
    if (!s || typeof s !== 'object') return d;
    for (var k in d) {
      if (!(k in s)) continue;
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) d[k] = merge(d[k], s[k]);
      else d[k] = s[k];
    }
    for (var k2 in s) if (!(k2 in d)) d[k2] = s[k2];
    return d;
  }
  var state;
  try { state = merge(defaults(), JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { state = defaults(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function retsFromStyle() {
    var aa = PF[state.style.aa].expRet;
    return { p1: aa, p2: aa, irp: BOOK.tdf.expRet, isa: Math.min(PF[state.style.div].expRet, 7), rirp: state.inp.rets.rirp };
  }
  if (state.inp.retsAuto) state.inp.rets = retsFromStyle();

  /* ───────── 포맷 ───────── */
  function num(x) { return Math.round(x).toLocaleString('ko-KR'); }
  function man(x) {
    x = +x || 0;
    var neg = x < 0; x = Math.abs(x);
    var s;
    if (x >= 10000) { var e = Math.floor(x / 10000), r = Math.round(x - e * 10000); if (r === 10000) { e++; r = 0; } s = e + '억' + (r ? ' ' + num(r) + '만' : '') + ' 원'; }
    else s = (x < 10 && x > 0 ? (Math.round(x * 10) / 10) : num(x)) + '만 원';
    return (neg ? '-' : '') + s;
  }
  function manShort(x) { return x >= 10000 ? (Math.round(x / 1000) / 10) + '억' : num(x) + '만'; }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ymLabel(ym) { var p = ym.split('-'); return p[0] + '년 ' + (+p[1]) + '월'; }
  function naver(q) { return 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q + ' ETF'); }
  function getK(path) { var o = state.inp, ps = path.split('.'); for (var i = 0; i < ps.length; i++) o = o == null ? undefined : o[ps[i]]; return o; }
  function setK(path, v) { var o = state.inp, ps = path.split('.'); for (var i = 0; i < ps.length - 1; i++) o = o[ps[i]]; o[ps[ps.length - 1]] = v; }

  /* ───────── 탭 ───────── */
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]'); if (!b) return;
    $$('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'v-' + b.dataset.tab); });
    document.body.className = 'tab-' + b.dataset.tab;
    if (b.dataset.tab === 'sim') renderSimOut();
    if (b.dataset.tab === 'style') renderStyle();
    if (b.dataset.tab === 'track') renderTrack();
    if (b.dataset.tab === 'guide') renderGuide();
    window.scrollTo(0, 0);
  });

  /* ═════════ 1. 시뮬레이션 ═════════ */
  function fld(k, label, unit, attrs, hint) {
    var v = getK(k);
    return '<label class="f">' + label + (unit ? '<div class="unit"><input type="number" inputmode="decimal" data-k="' + k + '" value="' + esc(v) + '" ' + (attrs || '') + '><span>' + unit + '</span></div>' : '<input data-k="' + k + '" value="' + esc(v) + '" ' + (attrs || '') + '>') + (hint ? '<span class="hint" id="h-' + k.replace('.', '-') + '">' + hint + '</span>' : '') + '</label>';
  }
  function sw(k, label) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-k="' + k + '"' + (getK(k) ? ' checked' : '') + '></label>'; }
  function seg(k, opts) {
    return '<div class="seg" data-seg="' + k + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (getK(k) === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }

  function renderSim() {
    var I = state.inp;
    var html = '<div class="layout"><div>' +
      '<div class="card"><h3>기본 정보</h3><div class="grid gf">' +
        fld('age', '현재 나이 (만)', '세', 'min="18" max="80" step="1"') +
        fld('monthly', '월 투자금액', '만 원', 'min="0" step="5"') +
        fld('years', '납입 기간', '년', 'min="0" max="50" step="1"', '') +
        '<label class="f">납입 시작<input type="month" data-k="startYm" value="' + I.startYm + '"></label>' +
        '<label class="f">수령 개시 날짜<input type="month" data-k="payoutYm" value="' + I.payoutYm + '"><span class="hint" id="h-pay"></span></label>' +
        fld('lifeAge', '수령 종료 (기대수명)', '세', 'min="60" max="110" step="1"') +
      '</div><div class="row" style="margin-top:10px"><span class="small muted">수령 개시 나이 빠른 선택</span><div class="chips">' +
        [55, 60, 65, 70].map(function (a) { return '<button class="chip" data-payage="' + a + '">' + a + '세</button>'; }).join('') +
        '<button class="chip" data-payage="end">납입 끝나면 바로</button></div></div></div>' +

      '<div class="card"><h3>계좌 배분 <span class="muted small">4개의 통장</span></h3>' +
        seg('allocMode', [['book', '책 시나리오'], ['credit', '세액공제 먼저'], ['custom', '직접 입력']]) +
        '<div id="custom-box" class="grid gf" style="margin-top:10px;' + (I.allocMode === 'custom' ? '' : 'display:none') + '">' +
          fld('custom.p1', '연금저축1', '만') + fld('custom.p2', '연금저축2', '만') + fld('custom.irp', '저축 IRP', '만') + fld('custom.isa', 'ISA', '만') +
        '</div><div id="alloc-box" style="margin-top:12px"></div></div>' +

      '<div class="card"><h3>투자 스타일 · 수익률 <span class="muted small">연 %</span></h3>' +
        '<div class="small muted" id="style-sum" style="margin-bottom:8px"></div>' +
        sw('retsAuto', '선택한 투자 스타일의 기본 수익률 쓰기') +
        '<div class="grid gf" style="margin-top:6px">' +
          fld('rets.p1', '연금저축1 (자산배분)', '%', 'step="0.5"') + fld('rets.p2', '연금저축2 (자산배분)', '%', 'step="0.5"') +
          fld('rets.irp', '저축 IRP (TDF)', '%', 'step="0.5"') + fld('rets.isa', 'ISA (월배당)', '%', 'step="0.5"') +
          fld('rets.rirp', '퇴직 IRP', '%', 'step="0.5"') + fld('payRet', '수령기 수익률 (월배당 전환 후)', '%', 'step="0.5"') +
        '</div><p class="tiny muted">기본값은 책의 서술(자산배분 7%대, 영구 5~7%, 월배당 4~10%)을 바탕으로 한 가정입니다. 결과 그래프에는 ±2%p 범위도 함께 표시됩니다.</p></div>' +

      '<div class="card"><h3>세금 · 연금 정보</h3>' +
        sw('incomeLow', '총급여 5,500만 원 이하 (세액공제 16.5%, 초과 시 13.2%)') +
        sw('isaConvert', 'ISA 3년 만기마다 연금계좌로 전환 (추가 세액공제)') +
        sw('isaLow', 'ISA 서민형 (비과세 400만 원)') +
        '<div class="grid gf" style="margin-top:8px">' +
          fld('exPension', '지금 있는 연금저축·IRP', '만 원') + fld('exIsa', '지금 있는 ISA', '만 원') +
          fld('exRirp', '퇴직금 · 퇴직 IRP', '만 원') + fld('npsMonthly', '국민연금 예상 월액 (현재가치)', '만 원') +
          fld('npsAge', '국민연금 개시 나이', '세') + fld('target', '목표 노후 생활비 (월, 현재가치)', '만 원') +
          fld('inflation', '물가상승률', '%', 'step="0.1"') +
        '</div><p class="tiny muted">국민연금 예상액은 국민연금공단 \'내 연금 알아보기\'에서 확인해 넣으세요. 책은 월평균 약 100만 원, 적정 노후 생활비 월 300만 원을 기준으로 설명합니다.</p></div>' +

      '<div class="card"><h3>수령 방식 <span class="muted small">Ch.7 4단계</span></h3>' +
        seg('method', [['rate', '정률 (4% 룰)'], ['fixed', '정액'], ['period', '기간 확정']]) +
        '<div style="margin-top:10px">' +
          '<div data-show="rate">' + fld('rate', '매년 인출 비율', '%', 'step="0.5" min="1" max="12"', '책: 4~6% 인출이면 원금을 거의 유지') + '</div>' +
          '<div data-show="fixed">' + fld('fixedMonthly', '매달 받을 금액 (세전)', '만 원') + sw('fixedInflate', '물가만큼 매년 올리기 (현재가치 기준 금액)') + '</div>' +
          '<div data-show="period">' + fld('periodYears', '나눠 받을 기간', '년', 'min="10" max="50"', '연금 수령은 최소 10년 이상 나눠 받는 구조') + '</div>' +
        '</div><p class="tiny muted" id="method-tip"></p></div>' +

      '<div class="card"><details><summary>고급 설정</summary><div class="grid gf" style="margin-top:10px">' +
        fld('growth', '월 투자금 연 증가율', '%', 'step="1"') + fld('rirpTax', '퇴직 IRP 인출 실효세율 (가정)', '%', 'step="0.5"') +
        '</div>' + sw('has5y', '연금계좌 가입 5년 이상 됨 (수령 연차 계산용)') + '</details></div>' +
      '</div><div id="sim-out"></div></div>';
    $('#v-sim').innerHTML = html;
    updateFormBits();
    renderSimOut();
  }

  function updateFormBits() {
    var I = state.inp;
    $$('[data-show]', $('#v-sim')).forEach(function (d) { d.style.display = d.dataset.show === I.method ? '' : 'none'; });
    var cb = $('#custom-box'); if (cb) cb.style.display = I.allocMode === 'custom' ? '' : 'none';
    var payAge = +I.age + (SIM.ymToIndex(I.payoutYm) - SIM.ymToIndex(I.startYm)) / 12;
    var hp = $('#h-pay');
    if (hp) hp.textContent = '수령 시작 만 ' + Math.floor(payAge) + '세 · 납입 종료 만 ' + Math.floor(+I.age + +I.years) + '세';
    var tip = { rate: '정률은 노벨재단 방식. 자산배분 포트폴리오와 어울리고 원금 보존에 유리합니다.', fixed: '정액은 예측 가능한 생활비. 주식 비중이 작은 월배당 포트폴리오와 어울립니다.', period: '기간 확정은 정해진 기간 동안 원금까지 나눠 쓰는 방식입니다.' };
    var mt = $('#method-tip'); if (mt) mt.textContent = '책 추천: ' + tip[I.method];
    var ss = $('#style-sum');
    if (ss) ss.innerHTML = '통장1·2 <b>' + PF[state.style.aa].name + '</b> · IRP <b>TDF</b> · ISA <b>' + PF[state.style.div].name + '</b> <a href="#" data-goto="style">바꾸기</a>';
    $$('[data-k^="rets."]').forEach(function (x) { x.disabled = !!I.retsAuto && x.dataset.k !== 'rets.rirp'; if (I.retsAuto) x.value = getK(x.dataset.k); });
  }

  var simTimer = null;
  $('#v-sim').addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset.k) return;
    var k = t.dataset.k, v;
    if (t.type === 'checkbox') v = t.checked; else if (t.type === 'number') v = t.value === '' ? 0 : +t.value; else v = t.value;
    setK(k, v);
    if (k === 'retsAuto' && v) state.inp.rets = retsFromStyle();
    save(); updateFormBits();
    clearTimeout(simTimer); simTimer = setTimeout(renderSimOut, 120);
  });
  $('#v-sim').addEventListener('click', function (e) {
    var s = e.target.closest('[data-seg] button');
    if (s) { setK(s.parentNode.dataset.seg, s.dataset.v); save(); $$('button', s.parentNode).forEach(function (b) { b.classList.toggle('on', b === s); }); updateFormBits(); renderSimOut(); return; }
    var pa = e.target.closest('[data-payage]');
    if (pa) {
      var I = state.inp, y = pa.dataset.payage === 'end' ? +I.years : (+pa.dataset.payage - +I.age);
      I.payoutYm = addYears(I.startYm, Math.max(0, y)); save();
      $('[data-k="payoutYm"]').value = I.payoutYm; updateFormBits(); renderSimOut(); return;
    }
    var g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); $('#tabs button[data-tab="' + g.dataset.goto + '"]').click(); return; }
    var rv = e.target.closest('[data-real]');
    if (rv) { state.ui.real = rv.dataset.real === '1'; save(); renderSimOut(); }
  });

  var lastSim = null;
  function simInput() { return JSON.parse(JSON.stringify(state.inp)); }
  function renderSimOut() {
    var I = state.inp, out = $('#sim-out'); if (!out) return;
    var r = SIM.run(simInput()); lastSim = r;
    var lo = SIM.run(simInput(), { dRet: -2 }), hi = SIM.run(simInput(), { dRet: 2 });
    var payAge = r.payStartAge, first = r.first;
    var a = r.alloc, aSum = a.p1 + a.p2 + a.irp + a.isa;

    // 계좌 배분 박스
    var scen = BOOK.scenarios.reduce(function (p, c) { return Math.abs(c.m - I.monthly) < Math.abs(p.m - I.monthly) ? c : p; });
    var ab = $('#alloc-box');
    if (ab) {
      ab.innerHTML = '<div class="bar">' + ['p1', 'p2', 'irp', 'isa'].map(function (k) { return a[k] > 0 ? '<i style="width:' + (a[k] / aSum * 100) + '%;background:' + ACC[k].color + '"></i>' : ''; }).join('') + '</div>' +
        ['p1', 'p2', 'irp', 'isa'].map(function (k) { return '<div class="alloc-row"><span><span class="dot" style="background:' + ACC[k].color + '"></span>' + ACC[k].name + ' <span class="muted tiny">' + ACC[k].sub + '</span></span><b>월 ' + man(a[k]) + ' <span class="muted tiny">(연 ' + manShort(a[k] * 12) + ')</span></b></div>'; }).join('') +
        (I.allocMode === 'book' ? '<p class="tiny muted" style="margin:6px 0 0">책 시나리오 \'월 ' + scen.m + '만 원\': ' + scen.who + ' · 목적 ' + scen.goal + '. 그 사이 금액은 시나리오를 이어서 계산했어요.</p>' : '') +
        (I.allocMode === 'credit' ? '<p class="tiny muted" style="margin:6px 0 0">앱 옵션: 세액공제 한도(연 900만 원 = 월 75만 원)를 먼저 채우고 나머지를 ISA로. 책 시나리오보다 유동성은 낮습니다.</p>' : '') +
        (r.overCap ? '<div class="note bad">연금계좌 연간 납입 한도(1,800만 원)를 넘습니다.</div>' : '');
    }

    var warns = [];
    if (payAge < 55) warns.push(['bad', '연금 수령은 만 55세부터 가능합니다. 수령 개시 날짜를 늦춰 주세요.']);
    if (I.years * 12 > (SIM.ymToIndex(I.payoutYm) - SIM.ymToIndex(I.startYm)) + 0.5) warns.push(['', '납입 기간이 수령 개시 이후까지 이어집니다. 수령 시작 후 납입분은 계산에서 빠집니다.']);
    if (payAge < 65 && I.npsAge >= 65 && payAge >= 55) warns.push(['info', '만 ' + Math.floor(payAge) + '세~' + I.npsAge + '세는 국민연금이 없는 \'소득 크레바스\' 구간입니다. 책: 해지하지 말고 운용을 이어가세요.']);
    if (r.over1500Years.length) warns.push(['', '세액공제 계좌 인출이 연 1,500만 원을 넘는 해가 있습니다(만 ' + r.over1500Years[0] + '세 등). 넘으면 16.5% 분리과세 또는 종합과세. 책: 수령 기간을 늘려 한도 안으로.']);
    if (r.overLimitYears.length) warns.push(['', '연금수령한도(평가액 ÷ (11 − 연차) × 120%)를 넘는 해가 있습니다(만 ' + r.overLimitYears.join(', ') + '세). 초과분은 기타소득세 16.5%로 계산했어요.']);
    if (r.depleteAge && I.method === 'period') warns.push(['info', '기간 확정 방식이라 계획대로 만 ' + r.depleteAge + '세 무렵 연금 자산을 모두 씁니다. 이후는 국민연금만 남습니다.']);
    else if (r.depleteAge) warns.push(['bad', '이 방식이면 만 ' + r.depleteAge + '세에 연금 자산이 바닥납니다. 인출률을 낮추거나 수령을 늦춰 보세요.']);
    if (payAge < 70 && payAge >= 55) warns.push(['ok', '수령을 늦출수록 연금소득세가 낮아집니다: 55~69세 5.5% → 70~79세 4.4% → 80세 이상 3.3%.']);

    var cashNow = first ? first.cash : 0, targetNow = first ? first.target : I.target;
    var cover = targetNow ? Math.min(1, cashNow / targetNow) : 0;
    var realFactor = first ? (first.target / I.target) : 1;

    var html = '<div class="kpis">' +
      kpi('수령 개시 시점 예상 자산', man(r.atPayout), '만 ' + Math.floor(payAge) + '세 (' + ymLabel(I.payoutYm) + ') · 현재가치 ' + man(r.atPayoutReal), true) +
      kpi('납입 원금 / 투자 수익', man(r.principalAtPayout), '수익 ' + man(r.atPayout - r.principalAtPayout) + ' (기존 자산 포함)') +
      kpi('세액공제 환급 누적', man(r.creditSum), '세액공제율 ' + (I.incomeLow ? '16.5%' : '13.2%') + (I.isaConvert ? ' · ISA 전환분 포함' : '')) +
      kpi('첫해 월 연금 (세후)', first ? man(first.netMonthly) : '-', first ? '세전 ' + man(first.gross / 12) + ' · 세금 월 ' + man(first.tax / 12) : '') +
      kpi('국민연금 포함 월 현금흐름', first ? man(cashNow) : '-', '목표 ' + man(targetNow) + ' (물가 반영) 대비 ' + Math.round(cover * 100) + '%<div class="bar" style="margin-top:6px"><i style="width:' + (cover * 100) + '%;background:' + (cover >= 1 ? '#12a594' : '#f59e0b') + '"></i></div>') +
      kpi('자산 지속 기간', r.depleteAge ? '만 ' + r.depleteAge + '세 소진' : I.lifeAge + '세까지 유지', r.depleteAge ? '수령 방식 조정 필요' : '마지막 해 잔액 ' + man(r.endBalance)) +
      '</div>';
    html += warns.map(function (w) { return '<div class="note ' + w[0] + '">' + w[1] + '</div>'; }).join('');

    html += '<div class="card" style="margin-top:12px"><h3>자산 흐름</h3><div id="ch-asset"></div>' +
      '<div class="legend"><span><span class="dot" style="background:#2f6fed"></span>예상 자산</span><span><span class="dot" style="background:#94a3b8"></span>누적 납입 원금</span><span><span class="dot" style="background:#2f6fed;opacity:.3"></span>수익률 ±2%p 범위</span></div></div>';

    html += '<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">노후 월 현금흐름 (세후)</h3>' +
      '<div class="seg" style="width:180px"><button data-real="0" class="' + (!state.ui.real ? 'on' : '') + '">명목</button><button data-real="1" class="' + (state.ui.real ? 'on' : '') + '">현재가치</button></div></div>' +
      '<div id="ch-cash" style="margin-top:8px"></div><div class="legend"><span><span class="dot" style="background:#2f6fed"></span>개인연금 (연금저축·IRP·ISA·퇴직IRP)</span><span><span class="dot" style="background:#12a594"></span>국민연금</span><span><span class="dot" style="background:#dc2626"></span>목표 생활비</span></div></div>';

    // 인출률 비교 + 목표 역산
    var w = [4, 5, 6].map(function (p) { return '<tr><td>' + p + '% 인출</td><td>' + man(r.atPayout * p / 100) + '</td><td><b>' + man(r.atPayout * p / 1200) + '</b></td></tr>'; }).join('');
    var goals = [[30000, '현실적인 3억 원'], [50000, '여유로운 5억 원'], [90000, '풍요로운 9억 원']].map(function (g) {
      var need = SIM.solveMonthly(simInput(), g[0]);
      return '<tr><td>' + g[1] + '</td><td>' + (need >= 2999 ? '기간 부족' : '월 ' + man(need)) + '</td><td>' + man(g[0] * 0.05 / 12) + '</td></tr>';
    }).join('');
    html += '<div class="grid g2"><div class="card"><h3>인출률별 월 수령액 <span class="muted small">세전</span></h3><div class="tbl-wrap"><table><tr><th>방식</th><th>연간</th><th>월</th></tr>' + w + '</table></div>' +
      '<p class="tiny muted">책: 4% 룰은 원금을 거의 유지. 금리가 높은 시기를 감안해 6%까지 계산 예시를 듭니다.</p></div>' +
      '<div class="card"><h3>책의 노후 시나리오 역산</h3><div class="tbl-wrap"><table><tr><th>목표 (수령 시점)</th><th>필요 월 투자금</th><th>배당 5% 월</th></tr>' + goals + '</table></div>' +
      '<p class="tiny muted">지금 설정(나이, 기간, 배분, 수익률)으로 수령 개시 시점에 목표 자산을 만들려면 매달 얼마가 필요한지 계산했어요.</p></div></div>';

    // 연도별 표
    html += '<div class="card"><details><summary>연도별 상세 표</summary><div class="tbl-wrap" style="max-height:420px;margin-top:8px"><table><tr><th>연도</th><th>나이</th><th>구분</th><th>연 납입</th><th>세액공제</th><th>연말 자산</th><th>연 인출(세전)</th><th>세금</th><th>월 연금(세후)</th><th>국민연금(월)</th><th>월 합계</th></tr>' +
      r.rows.map(function (x) {
        return '<tr class="' + (x.overLimit || x.over1500 ? 'flag' : x.phase === '수령' ? 'pay' : '') + '"><td>' + x.year + '</td><td>' + x.age + '</td><td>' + x.phase + '</td><td>' + num(x.contrib) + '</td><td>' + num(x.credit) + '</td><td>' + num(x.total) + '</td><td>' + num(x.gross) + '</td><td>' + num(x.tax) + '</td><td>' + num(x.netMonthly) + '</td><td>' + num(x.nps) + '</td><td><b>' + num(x.cash) + '</b></td></tr>';
      }).join('') + '</table></div><p class="tiny muted">단위: 만 원. 노란 줄은 1,500만 원 또는 연금수령한도를 넘는 해. ISA는 3년마다 연금저축으로 전환(10%·최대 300만 원 추가 세액공제, 비과세 한도 초과 수익 9.9%)하고, 수령 개시 때 남은 ISA는 정리해 합칩니다. 인출 순서는 책대로 세액공제 계좌(연 1,500만 원 이내) → 비과세 원금 → 퇴직 IRP.</p></details></div>';

    out.innerHTML = html;
    var stk = $('#sim-sticky');
    if (!stk) { stk = document.createElement('div'); stk.id = 'sim-sticky'; document.body.appendChild(stk); stk.addEventListener('click', function () { var o = $('#sim-out'); if (o) window.scrollTo(0, o.getBoundingClientRect().top + window.scrollY - 10); }); }
    stk.className = 'show';
    stk.innerHTML = '<span>' + Math.floor(payAge) + '세 자산 <b>' + manShort(r.atPayout) + '</b></span><span>월 <b>' + (first ? manShort(cashNow) : '-') + '</b> / 목표 ' + manShort(targetNow) + '</span><span class="tiny">결과 보기</span>';

    // 차트
    var ser = function (res, key) { return [{ x: +I.age, y: key === 'principal' ? (+I.exPension + +I.exIsa + +I.exRirp) : (+I.exPension + +I.exIsa + +I.exRirp) }].concat(res.series.map(function (p) { return { x: p.age, y: p[key] }; })); };
    CHART.line($('#ch-asset'), {
      series: [{ name: '예상 자산', color: '#2f6fed', points: ser(r, 'total'), fill: true }, { name: '납입 원금', color: '#94a3b8', points: ser(r, 'principal'), dash: '5 4', width: 1.6 },
        { name: '수익률 -2%p', color: '#93b4f5', points: ser(lo, 'total'), width: 1 }, { name: '수익률 +2%p', color: '#93b4f5', points: ser(hi, 'total'), width: 1 }],
      bands: [{ upper: ser(hi, 'total'), lower: ser(lo, 'total'), color: '#2f6fed' }],
      markers: [{ x: payAge, label: '수령 개시 ' + Math.floor(payAge) + '세', color: '#2f6fed' }],
      yFmt: manShort, xFmt: function (x, full) { return full ? '만 ' + Math.floor(x) + '세' : Math.round(x) + '세'; }, tipFmt: man
    });
    var real = state.ui.real;
    var cashRows = r.rows.filter(function (x) { return x.phase === '수령' || x.nps > 0; });
    CHART.bars($('#ch-cash'), {
      data: cashRows.map(function (x) { var d = real ? x.target / I.target : 1; return { x: x.age, parts: [x.netMonthly / d, x.nps / d], target: x.target / d }; }),
      colors: ['#2f6fed', '#12a594'], names: ['개인연금', '국민연금'], targetName: '목표',
      yFmt: manShort, xFmt: function (x, full) { return full ? '만 ' + x + '세' : x + '세'; }, tipFmt: man
    });
  }
  function kpi(l, v, s, hl) { return '<div class="kpi' + (hl ? ' hl' : '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }

  /* ═════════ 2. 투자 스타일 ═════════ */
  var QUIZ = [
    { k: 'risk', t: '투자한 돈이 1년 새 20% 떨어지면?', o: [['c', '불안해서 팔고 싶다'], ['m', '그냥 기다린다'], ['a', '오히려 더 산다']] },
    { k: 'manage', t: '관리는 어떻게 하고 싶나요?', o: [['auto', '알아서 굴러가면 좋겠다'], ['diy', '1년에 한 번 리밸런싱 정도는 직접']] },
    { k: 'region', t: '어느 시장이 편한가요?', o: [['kr', '국내 위주'], ['us', '미국 위주'], ['mix', '섞어서 골고루']] },
    { k: 'cash', t: '배당 현금흐름은?', o: [['no', '지금은 필요 없다'], ['yes', '조금씩 받아 보고 싶다']] }
  ];
  function recommend() {
    var q = state.style.quiz, yrs = lastSim ? lastSim.yearsToPay : 10;
    var risk = q.risk || 'm', lowered = false;
    if (yrs < 5 && risk !== 'c') { risk = risk === 'a' ? 'm' : 'c'; lowered = true; }
    var region = q.region || 'mix', aa;
    if (risk === 'a') aa = region === 'kr' ? 'aa_6040_kr' : region === 'us' ? 'aa_6040_us' : 'aa_gomhee';
    else if (risk === 'm') aa = 'aa_gomhee';
    else aa = region === 'us' ? 'aa_perm_us' : (region === 'kr' ? 'aa_perm_kr' : 'aa_season_kr');
    var div = risk === 'a' ? 'div_cc' : risk === 'm' ? 'div_balance' : 'div_defense';
    return { aa: aa, div: div, tilt: risk === 'a' ? 1 : risk === 'c' ? -1 : 0, risk: risk, lowered: lowered, yrs: yrs };
  }
  var RISK_TXT = { aggressive: '공격형', moderate: '중립형', conservative: '보수형', a: '공격형', m: '중립형', c: '보수형' };

  function pfCard(id, monthly, opts) {
    var p = PF[id]; opts = opts || {};
    var cols = p.items.map(function (_, i) { return COLORS[i % COLORS.length]; });
    return '<div class="pf' + (opts.sel ? ' sel' : '') + '"><div class="pf-head">' + CHART.donut(p.items, cols, 84) +
      '<div><div class="t">' + p.name + '</div><div class="row" style="gap:6px;margin:3px 0"><span class="tag ' + p.risk + '">' + RISK_TXT[p.risk] + '</span><span class="tag">' + p.yieldTxt + '</span></div><div class="small muted">' + p.desc + '</div></div></div>' +
      '<div style="margin-top:8px">' + p.items.map(function (it, i) {
        return '<div class="prod"><div class="n"><span class="dot" style="background:' + cols[i] + '"></span><a href="' + naver(it.name) + '" target="_blank" rel="noopener">' + esc(it.name) + '</a> <span class="tiny muted">' + it.asset + ' · ' + it.type + '</span>' +
          (it.note ? '<div class="tiny muted">' + it.note + '</div>' : '') + (it.warn ? '<div class="tiny" style="color:#b45309">주의: ' + it.warn + '</div>' : '') + '</div>' +
          '<div class="w">' + it.w + '%</div><div class="amt">' + (monthly ? '월 ' + manShort(monthly * it.w / 100) : '') + '</div></div>';
      }).join('') + '</div>' + (opts.foot || '') + '</div>';
  }
  function pfSelect(group, cur, key) {
    return '<select data-pf="' + key + '" style="margin:8px 0">' + Object.keys(PF).filter(function (k) { return PF[k].group === group; }).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + PF[k].name + '</option>'; }).join('') + '</select>';
  }

  function renderStyle() {
    if (!lastSim) lastSim = SIM.run(simInput());
    var S = state.style, a = lastSim.alloc, I = state.inp;
    var rec = recommend(), q = S.quiz;
    var birth = new Date().getFullYear() - (+I.age);
    var tv = SIM.tdfVintage(birth, S.tdfTilt);
    var etfYears = Object.keys(BOOK.tdf.etfs).map(Number);
    var etfVs = BOOK.tdf.etfs[tv.vintage] ? [tv.vintage] : (function () {
      var md = Math.min.apply(null, etfYears.map(function (y) { return Math.abs(y - tv.vintage); }));
      return etfYears.filter(function (y) { return Math.abs(y - tv.vintage) === md; });
    })();
    var etfV = etfVs[0];
    var payMethod = PF[S.payDiv] ? '정액' : '정률';

    var html = '<h2>투자 스타일 고르기</h2>' +
      '<div class="card"><h3>1. 성향 진단 <span class="muted small">책의 \'자산배분 포트폴리오 찾기\' 4가지 기준</span></h3>' +
      QUIZ.map(function (qq) { return '<div class="q"><div class="qt">' + qq.t + '</div><div class="chips">' + qq.o.map(function (o) { return '<button class="chip' + (q[qq.k] === o[0] ? ' on' : '') + '" data-quiz="' + qq.k + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="note info">투자 기간: 수령 개시까지 <b>' + rec.yrs.toFixed(1) + '년</b> (시뮬레이션 설정 기준). ' + (rec.yrs < 5 ? '은퇴가 가까우니 채권 비중을 높이는 쪽으로 한 단계 낮춰 추천합니다.' : '은퇴까지 시간이 있어 주식 비중을 가져갈 수 있습니다.') + '</div>' +
      '<div class="row" style="justify-content:space-between"><div class="small">추천: <b>' + RISK_TXT[rec.risk] + '</b> → 통장1·2 <b>' + PF[rec.aa].name + '</b>, ISA <b>' + PF[rec.div].name + '</b>, TDF ' + (rec.tilt > 0 ? '한 단계 늦은 빈티지' : rec.tilt < 0 ? '한 단계 이른 빈티지' : '기본 빈티지') + '</div>' +
      '<button class="btn" data-apply-rec>추천대로 적용</button></div>' +
      (q.manage === 'auto' ? '<p class="tiny muted">관리를 맡기고 싶다면 IRP의 TDF처럼 \'설정하고 잊는\' 방식이 편합니다. 통장1·2에 TDF를 쓰는 건 책의 기본 배치는 아니고 앱의 참고 의견입니다.</p>' : '') +
      (q.cash === 'yes' ? '<p class="tiny muted">책은 ISA 3년 동안 월배당을 경험해 보라고 권합니다. 수령기 월배당 전환의 예행연습이 되기 때문입니다.</p>' : '') +
      '</div>';

    html += '<h2>2. 계좌별 추천 상품</h2><p class="small muted">월 금액은 시뮬레이션의 계좌 배분(월 ' + man(+I.monthly) + ') 기준입니다. 상품명을 누르면 네이버 검색으로 현재 시세·보수를 확인할 수 있어요.</p><div class="grid g2">';

    var p12 = a.p1 + a.p2;
    html += '<div class="card"><div class="acc-badge"><span class="dot" style="background:' + ACC.p1.color + '"></span>통장1·2 연금저축 → 자산배분</div>' +
      '<p class="small muted" style="margin:4px 0">꾸준히 적립하는 계좌라 고수익보다 안정적인 수익이 중요. 1년에 한 번(생일·연말) 리밸런싱.</p>' +
      pfSelect('aa', S.aa, 'aa') + pfCard(S.aa, p12, { sel: true, foot: '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-applyhold="p1" data-pfid="' + S.aa + '">연금저축1에 적용</button>' + (a.p2 > 0 ? '<button class="btn sm ghost" data-applyhold="p2" data-pfid="' + S.aa + '">연금저축2에 적용</button>' : '') + '</div>' }) +
      '<p class="tiny muted">책: 공격적이면 6대4·박곰희, 보수적이면 영구·올시즌.</p></div>';

    html += '<div class="card"><div class="acc-badge"><span class="dot" style="background:' + ACC.irp.color + '"></span>통장3 저축 IRP → TDF</div>' +
      '<p class="small muted" style="margin:4px 0">소액(연 300만 원 안팎)을 쪼개 관리하기보다 TDF 하나로 \'설정하고 잊기\'.</p>' +
      '<div class="seg" style="margin:8px 0" data-tilt>' + [[-1, '보수 (이른 연도)'], [0, '기본'], [1, '공격 (늦은 연도)']].map(function (o) { return '<button data-v="' + o[0] + '" class="' + (S.tdfTilt === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="pf sel"><div class="t" style="font-weight:800">TDF ' + tv.vintage + '</div><div class="small muted">출생연도 ' + birth + ' + 60 = ' + tv.target + ' → 가장 가까운 빈티지 ' + tv.vintage + (a.irp ? ' · 월 ' + man(a.irp) : ' · 현재 배분상 IRP 납입 없음') + '</div>' +
      '<div style="margin-top:8px"><div class="small" style="font-weight:700">ETF (' + etfVs.join(' / ') + (etfV !== tv.vintage ? ': ' + tv.vintage + ' ETF가 없어 가까운 연도. 이른 연도일수록 보수적' : '') + ')</div>' +
      etfVs.map(function (v) { return BOOK.tdf.etfs[v].map(function (n) { return '<div class="prod"><div class="n"><a href="' + naver(n) + '" target="_blank" rel="noopener">' + n + '</a></div><div></div><div></div></div>'; }).join(''); }).join('') +
      '<div class="small" style="font-weight:700;margin-top:8px">펀드 (' + tv.vintage + ')</div>' +
      BOOK.tdf.fundSeries.map(function (n) { return '<div class="prod"><div class="n"><a href="' + naver(n + tv.vintage) + '" target="_blank" rel="noopener">' + n + tv.vintage + '</a></div><div></div><div></div></div>'; }).join('') +
      '</div><p class="tiny muted">책은 TDF 고르는 규칙만 제시합니다. 위 상품명은 현재 시장의 TDF 예시이며, 운용사별 빈티지 유무와 보수(낮을수록 유리)를 확인하세요.</p>' +
      '<div class="row">' + etfVs.map(function (v) { var n = BOOK.tdf.etfs[v][0]; return '<button class="btn sm ghost" data-applytdf="' + esc(n) + '">IRP에 ' + esc(n) + ' 적용</button>'; }).join('') + '</div></div></div>';

    html += '<div class="card"><div class="acc-badge"><span class="dot" style="background:' + ACC.isa.color + '"></span>통장4 ISA → 월배당</div>' +
      '<p class="small muted" style="margin:4px 0">이자·배당 비과세(200만/서민형 400만), 초과분 9.9%. 3년 뒤 만기 자금은 연금저축으로 전환.</p>' +
      pfSelect('div', S.div, 'div') + pfCard(S.div, a.isa, { sel: true, foot: '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-applyhold="isa" data-pfid="' + S.div + '">ISA에 적용</button></div>' }) + '</div>';

    html += '<div class="card"><div class="acc-badge"><span class="dot" style="background:#94a3b8"></span>대기자금 → MMF · 금리형 ETF</div>' +
      '<p class="small muted" style="margin:4px 0">연금계좌에 입금하고 투자처를 정하기 전, 현금으로 놀리지 않기.</p>' + pfCard('safe', 0) + '</div>';

    html += '</div><h2>3. 수령기 포트폴리오 <span class="muted small">Ch.7 2단계</span></h2><div class="card">' +
      '<p class="small">수령을 시작하면 하루 날을 잡아 모든 연금 자산을 <b>월배당 중심</b>으로 한 번에 바꾸라고 책은 권합니다. 수령 기간이 30년 이상이면 주식(성장)을 20~40% 남겨 두세요.</p>' +
      pfSelect('div', S.payDiv, 'payDiv') + pfCard(S.payDiv, 0, { sel: true }) +
      '<div class="note info">' + (lastSim.paidAtStart ? '수령 개시 시점 연금 자산 ' + man(lastSim.paidAtStart.pension) + ' × 배당 ' + PF[S.payDiv].yieldTxt.replace('예상 배당수익률 ', '') + ' → 월 약 ' + man(lastSim.paidAtStart.pension * PF[S.payDiv].expRet / 1200) + ' (세전). ' : '') + '책: 월배당이면 <b>정액 수령</b>, 자산배분이면 <b>정률 수령</b>, 주식이면 <b>자율 수령</b>.</div></div>';

    html += '<div class="card"><details><summary>책의 모든 포트폴리오 보기</summary><div class="grid g2" style="margin-top:10px">' +
      Object.keys(PF).filter(function (k) { return k !== 'safe'; }).map(function (k) { return pfCard(k, 0); }).join('') + '</div></details></div>';

    $('#v-style').innerHTML = html;
  }

  $('#v-style').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-quiz]'))) { state.style.quiz[t.dataset.quiz] = t.dataset.v; save(); renderStyle(); return; }
    if (e.target.closest('[data-apply-rec]')) {
      var rec = recommend(); state.style.aa = rec.aa; state.style.div = rec.div; state.style.tdfTilt = rec.tilt;
      if (state.inp.retsAuto) state.inp.rets = retsFromStyle();
      save(); renderSim(); renderStyle(); toast('추천 포트폴리오를 적용했어요. 시뮬레이션 수익률도 바뀌었습니다.'); return;
    }
    if ((t = e.target.closest('[data-tilt] button'))) { state.style.tdfTilt = +t.dataset.v; save(); renderStyle(); return; }
    if ((t = e.target.closest('[data-applyhold]'))) { applyHoldings(t.dataset.applyhold, PF[t.dataset.pfid].items.map(function (it) { return { name: it.name, w: it.w, v: 0 }; })); return; }
    if ((t = e.target.closest('[data-applytdf]'))) { applyHoldings('irp', [{ name: t.dataset.applytdf, w: 100, v: 0 }]); return; }
  });
  $('#v-style').addEventListener('change', function (e) {
    var t = e.target.closest('[data-pf]'); if (!t) return;
    state.style[t.dataset.pf] = t.value;
    if (state.inp.retsAuto) state.inp.rets = retsFromStyle();
    save(); renderSim(); renderStyle();
  });
  function applyHoldings(acc, list) {
    var cur = state.holdings[acc] || [];
    if (cur.length && !confirm(ACC[acc].name + '의 기존 보유 종목 ' + cur.length + '개를 이 포트폴리오로 바꿀까요?')) return;
    state.holdings[acc] = list; state.ui.holdAcc = acc; save();
    toast(ACC[acc].name + '에 적용했어요. \'내 투자\' 탭에서 평가액을 입력하면 리밸런싱을 계산합니다.');
  }

  /* ═════════ 3. 내 투자 (추적) ═════════ */
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function accStats() {
    var recs = state.records.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var st = {};
    ACC_KEYS.forEach(function (k) { st[k] = { prin: 0, value: null, last: null, div: 0 }; });
    recs.forEach(function (r) {
      var s = st[r.acc]; if (!s) return;
      s.prin += +r.dep || 0; s.div += +r.div || 0;
      if (r.val !== '' && r.val != null) s.value = +r.val;
      s.last = r.date;
    });
    ACC_KEYS.forEach(function (k) { if (st[k].value === null) st[k].value = st[k].prin; });
    return { st: st, recs: recs };
  }
  function seriesOverTime(recs) {
    var dates = [], seen = {};
    recs.forEach(function (r) { if (!seen[r.date]) { seen[r.date] = 1; dates.push(r.date); } });
    var out = [];
    dates.forEach(function (d) {
      var prin = 0, val = 0, accs = {};
      recs.forEach(function (r) {
        if (r.date > d) return;
        var s = accs[r.acc] || (accs[r.acc] = { prin: 0, val: null });
        s.prin += +r.dep || 0; if (r.val !== '' && r.val != null) s.val = +r.val;
      });
      for (var k in accs) { prin += accs[k].prin; val += accs[k].val === null ? accs[k].prin : accs[k].val; }
      out.push({ d: d, prin: prin, val: val });
    });
    return out;
  }
  function planRet() {
    var a = (lastSim || SIM.run(simInput())).alloc, R = state.inp.rets, s = a.p1 + a.p2 + a.irp + a.isa;
    if (!s) return R.p1;
    return (a.p1 * R.p1 + a.p2 * R.p2 + a.irp * R.irp + a.isa * R.isa) / s;
  }

  function renderTrack() {
    var A = accStats(), st = A.st, recs = A.recs;
    var prin = 0, val = 0, divs = 0;
    ACC_KEYS.forEach(function (k) { prin += st[k].prin; val += st[k].value; divs += st[k].div; });
    var flows = recs.filter(function (r) { return +r.dep; }).map(function (r) { return { d: new Date(r.date), v: -(+r.dep) }; });
    var lastDate = recs.length ? recs[recs.length - 1].date : today();
    if (flows.length) flows.push({ d: new Date(lastDate), v: val });
    var irr = flows.length > 1 && (flows[flows.length - 1].d - flows[0].d) >= 90 * 864e5 ? SIM.xirr(flows) : null;
    var pr = planRet();

    var yr = String(new Date().getFullYear()), y = { p1: 0, p2: 0, irp: 0, isa: 0 };
    recs.forEach(function (r) { if (!r.init && r.date.slice(0, 4) === yr && y.hasOwnProperty(r.acc)) y[r.acc] += +r.dep || 0; });
    var cred = Math.min(y.p1, 600) + Math.min(y.irp, 900 - Math.min(y.p1, 600));
    var refund = cred * (state.inp.incomeLow ? 0.165 : 0.132);
    function lim(label, v, max, color) { var p = Math.min(1, v / max); return '<div style="margin:8px 0"><div class="alloc-row"><span>' + label + '</span><b>' + man(v) + ' / ' + man(max) + '</b></div><div class="bar"><i style="width:' + (p * 100) + '%;background:' + color + '"></i></div></div>'; }

    var html = '<h2>내 투자 추적</h2><div class="kpis">' +
      kpi('현재 평가액', man(val), recs.length ? '최근 기록 ' + lastDate : '아직 기록이 없어요', true) +
      kpi('누적 납입 원금', man(prin), '분배금 기록 합계 ' + man(divs)) +
      kpi('평가 손익', '<span class="' + (val - prin >= 0 ? 'pos' : 'neg') + '">' + man(val - prin) + '</span>', prin ? '단순 수익률 ' + pct((val - prin) / prin) : '') +
      kpi('연환산 수익률 (XIRR)', irr === null ? '-' : pct(irr), '계획 가정 ' + pr.toFixed(1) + '% ' + (irr === null ? '(기록이 3개월 이상 쌓이면 계산)' : (irr * 100 >= pr ? '· 계획보다 좋음' : '· 계획보다 낮음'))) +
      '</div>';

    html += '<div class="grid g2" style="margin-top:12px"><div class="card"><h3>기록 추가</h3><div class="grid g2">' +
      '<label class="f">날짜<input type="date" id="r-date" value="' + today() + '"></label>' +
      '<label class="f">계좌<select id="r-acc">' + ACC_KEYS.map(function (k) { return '<option value="' + k + '">' + ACC[k].name + ' (' + ACC[k].sub + ')</option>'; }).join('') + '</select></label>' +
      '<label class="f">이번 납입액<div class="unit"><input type="number" inputmode="decimal" id="r-dep" placeholder="0"><span>만 원</span></div></label>' +
      '<label class="f">현재 평가액<div class="unit"><input type="number" inputmode="decimal" id="r-val" placeholder="계좌 총액"><span>만 원</span></div></label>' +
      '<label class="f">받은 분배금<div class="unit"><input type="number" inputmode="decimal" id="r-div" placeholder="선택"><span>만 원</span></div></label>' +
      '<label class="f">메모<input id="r-memo" placeholder="예: 10월 자동이체"></label>' +
      '<label class="switch" style="grid-column:1/-1"><span class="small">기존 잔액 첫 등록 (올해 납입 한도·세액공제 계산에서 제외)</span><input type="checkbox" id="r-init"></label>' +
      '</div><div class="row" style="margin-top:10px"><button class="btn" id="r-add">저장</button><span class="tiny muted">처음엔 지금까지 넣은 원금을 납입액에, 계좌 총액을 평가액에 넣으세요. 이후 매달 납입액과 평가액만 기록하면 됩니다.</span></div></div>' +
      '<div class="card"><h3>' + yr + '년 납입 한도</h3>' +
        lim('연금저축 세액공제 (600만)', y.p1, 600, ACC.p1.color) +
        lim('연금저축 + IRP 세액공제 (900만)', y.p1 + y.irp, 900, ACC.irp.color) +
        lim('연금계좌 전체 납입 (1,800만)', y.p1 + y.p2 + y.irp, 1800, ACC.p2.color) +
        lim('ISA 납입 (2,000만, 미사용분 이월)', y.isa, 2000, ACC.isa.color) +
        '<div class="note ok">올해 예상 세액공제 환급: <b>' + man(refund) + '</b> (공제 대상 ' + man(cred) + ' × ' + (state.inp.incomeLow ? '16.5%' : '13.2%') + ')</div></div></div>';

    html += '<div class="card"><h3>원금 vs 평가액</h3><div id="ch-track"></div><div class="legend"><span><span class="dot" style="background:#2f6fed"></span>평가액</span><span><span class="dot" style="background:#94a3b8"></span>납입 원금</span><span><span class="dot" style="background:#f59e0b"></span>계획 수익률로 굴렸다면</span></div></div>';

    html += '<div class="card"><h3>계좌별 현황</h3><div class="tbl-wrap"><table><tr><th>계좌</th><th>원금</th><th>평가액</th><th>손익</th><th>수익률</th><th>최근 기록</th></tr>' +
      ACC_KEYS.map(function (k) { var s = st[k]; if (!s.last) return ''; var g = s.value - s.prin; return '<tr><td><span class="dot" style="background:' + ACC[k].color + '"></span>' + ACC[k].name + '</td><td>' + num(s.prin) + '</td><td>' + num(s.value) + '</td><td class="' + (g >= 0 ? 'pos' : 'neg') + '">' + num(g) + '</td><td>' + (s.prin ? pct(g / s.prin) : '-') + '</td><td>' + s.last + '</td></tr>'; }).join('') +
      '</table></div>' + (recs.length ? '' : '<p class="small muted">기록을 추가하면 여기에 계좌별 수익률이 나옵니다.</p>') + '<p class="tiny muted">단위: 만 원</p></div>';

    // 보유 종목 & 리밸런싱 (입력 중 재렌더링하지 않도록 계산 칸만 갱신)
    var hk = state.ui.holdAcc || 'p1', H = state.holdings[hk] || [];
    var extra = +state.ui.extra || 0;
    var lastReb = state.rebal[hk], days = lastReb ? Math.floor((Date.now() - new Date(lastReb)) / 864e5) : null;
    html += '<div class="card"><h3>보유 종목 · 리밸런싱 <span class="muted small">연 1회 권장</span></h3>' +
      '<div class="chips" style="margin-bottom:10px">' + ACC_KEYS.map(function (k) { return '<button class="chip' + (k === hk ? ' on' : '') + '" data-hacc="' + k + '">' + ACC[k].name + ((state.holdings[k] || []).length ? ' (' + state.holdings[k].length + ')' : '') + '</button>'; }).join('') + '</div>' +
      (H.length ? '<div class="hold h"><span>종목</span><span>목표%</span><span>평가액(만)</span><span class="c4">현재%</span><span class="c5">조정(만)</span><span></span></div>' +
        H.map(function (h, i) {
          return '<div class="hold"><input data-h="' + i + '" data-f="name" value="' + esc(h.name) + '"><input type="number" inputmode="decimal" data-h="' + i + '" data-f="w" value="' + esc(h.w) + '"><input type="number" inputmode="decimal" data-h="' + i + '" data-f="v" value="' + esc(h.v) + '">' +
            '<span class="c4" data-hcw="' + i + '"></span><span class="c5" data-hadj="' + i + '"></span><button class="btn sm gray" data-hdel="' + i + '" title="삭제">×</button></div>';
        }).join('') : '<p class="small muted">아직 종목이 없어요. \'투자 스타일\' 탭에서 포트폴리오를 적용하거나 직접 추가하세요.</p>') +
      '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-hadd>종목 추가</button><span class="small muted" id="h-sum"></span></div>' +
      (H.length ? '<div class="grid g2" style="margin-top:12px"><div><label class="f">이번에 새로 넣을 돈 (팔지 않고 맞추기)<div class="unit"><input type="number" inputmode="decimal" id="h-extra" value="' + (extra || '') + '" placeholder="예: 50"><span>만 원</span></div></label>' +
        '<div id="h-dist" style="margin-top:6px"></div></div>' +
        '<div><div class="small">마지막 리밸런싱: <b>' + (lastReb || '기록 없음') + '</b>' + (days !== null ? ' (' + days + '일 전)' : '') + '</div>' +
        (days !== null && days >= 365 ? '<div class="note">1년이 지났어요. 책: 생일이나 연말 같은 날을 정해 1년에 한 번 원래 비율로 되돌리세요.</div>' : '') +
        '<button class="btn sm" data-rebal style="margin-top:8px">오늘 리밸런싱 완료</button><p class="tiny muted">\'조정\'은 목표 비중으로 맞추려면 사고(+) 팔아야(−) 할 금액입니다.</p></div></div>' : '') +
      '</div>';

    html += '<div class="card"><h3>기록 내역</h3>' + (recs.length ? '<div class="tbl-wrap" style="max-height:360px"><table><tr><th>날짜</th><th>계좌</th><th>납입</th><th>평가액</th><th>분배금</th><th>메모</th><th></th></tr>' +
      recs.slice().reverse().map(function (r) { return '<tr><td>' + r.date + (r.init ? ' <span class="tag">기존</span>' : '') + '</td><td>' + ACC[r.acc].name + '</td><td>' + (r.dep ? num(r.dep) : '') + '</td><td>' + (r.val !== '' && r.val != null ? num(r.val) : '') + '</td><td>' + (r.div ? num(r.div) : '') + '</td><td style="text-align:left">' + esc(r.memo || '') + '</td><td><button class="btn sm gray" data-rdel="' + r.id + '">삭제</button></td></tr>'; }).join('') +
      '</table></div>' : '<p class="small muted">기록이 없습니다.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn sm ghost" id="exp">백업 내보내기 (JSON)</button><label class="btn sm ghost" style="cursor:pointer">백업 가져오기<input type="file" id="imp" accept="application/json" style="display:none"></label><button class="btn sm danger" id="reset">전체 초기화</button></div>' +
      '<p class="tiny muted">데이터는 이 기기 브라우저에만 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업하세요.</p></div>';

    $('#v-track').innerHTML = html;

    var ser = seriesOverTime(recs);
    if (ser.length) {
      var t0 = new Date(ser[0].d).getTime(), xs = function (d) { return (new Date(d).getTime() - t0) / 864e5; };
      // 계획 수익률 경로 (납입 흐름에 계획 수익률 적용)
      var plan = [], bal = 0, prevT = 0, rr = pr / 100;
      ser.forEach(function (p, i) { var x = xs(p.d); bal *= Math.pow(1 + rr, (x - prevT) / 365.25); bal += p.prin - (i ? ser[i - 1].prin : 0); prevT = x; plan.push({ x: x, y: bal }); });
      CHART.line($('#ch-track'), {
        series: [{ name: '평가액', color: '#2f6fed', points: ser.map(function (p) { return { x: xs(p.d), y: p.val }; }), fill: true, dots: ser.length < 40 },
          { name: '원금', color: '#94a3b8', points: ser.map(function (p) { return { x: xs(p.d), y: p.prin }; }), dash: '5 4' },
          { name: '계획', color: '#f59e0b', points: plan, width: 1.6, dash: '2 3' }],
        yFmt: manShort, xFmt: function (x) { var d = new Date(t0 + x * 864e5); return (d.getFullYear() % 100) + '.' + (d.getMonth() + 1); }, tipFmt: man, height: 240
      });
    } else $('#ch-track').innerHTML = '<p class="small muted">기록을 2개 이상 남기면 그래프가 그려집니다.</p>';
    updateHold();
  }

  function updateHold() {
    var H = state.holdings[state.ui.holdAcc] || [], tot = 0, wsum = 0, extra = +state.ui.extra || 0;
    H.forEach(function (h) { tot += +h.v || 0; wsum += +h.w || 0; });
    H.forEach(function (h, i) {
      var cw = tot ? (+h.v || 0) / tot : 0, adj = (wsum ? h.w / wsum : 0) * tot - (+h.v || 0);
      var a = $('[data-hcw="' + i + '"]'), b = $('[data-hadj="' + i + '"]');
      if (a) a.textContent = pct(cw, 0);
      if (b) { b.textContent = tot ? (adj >= 0 ? '+' : '') + num(adj) : '-'; b.className = 'c5 ' + (adj >= 0 ? 'pos' : 'neg'); }
    });
    var s = $('#h-sum'); if (s) s.innerHTML = H.length ? '합계 ' + man(tot) + ' · 목표 비중 합 <b style="color:' + (Math.abs(wsum - 100) < 0.01 ? 'inherit' : '#dc2626') + '">' + wsum + '%</b>' : '';
    var d = $('#h-dist');
    if (d) {
      var T = tot + extra, needs = H.map(function (h) { return Math.max(0, (wsum ? h.w / wsum : 0) * T - (+h.v || 0)); }), ns = needs.reduce(function (x, y) { return x + y; }, 0);
      d.innerHTML = extra > 0 ? H.map(function (h, i) { var v = ns ? extra * needs[i] / ns : extra * (wsum ? h.w / wsum : 0); return v >= 0.05 ? '<div class="alloc-row"><span>' + esc(h.name) + ' 사기</span><b>' + man(v) + '</b></div>' : ''; }).join('') : '';
    }
  }
  $('#v-track').addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.h != null) { var h = state.holdings[state.ui.holdAcc][+t.dataset.h]; h[t.dataset.f] = t.dataset.f === 'name' ? t.value : (t.value === '' ? 0 : +t.value); save(); updateHold(); return; }
    if (t.id === 'h-extra') { state.ui.extra = t.value === '' ? 0 : +t.value; save(); updateHold(); }
  });
  $('#v-track').addEventListener('click', function (e) {
    var t;
    if (e.target.id === 'r-add') {
      var dep = $('#r-dep').value, val = $('#r-val').value, dv = $('#r-div').value;
      if (dep === '' && val === '' && dv === '') { toast('납입액이나 평가액 중 하나는 입력하세요.'); return; }
      state.records.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: $('#r-date').value || today(), acc: $('#r-acc').value, dep: dep === '' ? 0 : +dep, val: val === '' ? '' : +val, div: dv === '' ? 0 : +dv, memo: $('#r-memo').value.trim(), init: $('#r-init').checked });
      save(); renderTrack(); toast('기록했어요.'); return;
    }
    if ((t = e.target.closest('[data-rdel]'))) { if (!confirm('이 기록을 삭제할까요?')) return; state.records = state.records.filter(function (r) { return r.id !== t.dataset.rdel; }); save(); renderTrack(); return; }
    if ((t = e.target.closest('[data-hacc]'))) { state.ui.holdAcc = t.dataset.hacc; save(); renderTrack(); return; }
    if (e.target.closest('[data-hadd]')) { var hk = state.ui.holdAcc; (state.holdings[hk] = state.holdings[hk] || []).push({ name: '새 종목', w: 0, v: 0 }); save(); renderTrack(); return; }
    if ((t = e.target.closest('[data-hdel]'))) { state.holdings[state.ui.holdAcc].splice(+t.dataset.hdel, 1); save(); renderTrack(); return; }
    if (e.target.closest('[data-rebal]')) { state.rebal[state.ui.holdAcc] = today(); save(); renderTrack(); toast('리밸런싱 날짜를 기록했어요.'); return; }
    if (e.target.id === 'exp') {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var aEl = document.createElement('a'); aEl.href = URL.createObjectURL(blob); aEl.download = '연금플래너-백업-' + today() + '.json'; aEl.click(); return;
    }
    if (e.target.id === 'reset') { if (confirm('모든 설정과 기록을 지울까요? 되돌릴 수 없습니다.')) { state = defaults(); save(); renderAll(); toast('초기화했어요.'); } return; }
  });
  $('#v-track').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'imp' && t.files[0]) {
      var fr = new FileReader();
      fr.onload = function () { try { state = merge(defaults(), JSON.parse(fr.result)); save(); renderAll(); toast('백업을 불러왔어요.'); } catch (err) { toast('파일을 읽지 못했어요.'); } };
      fr.readAsText(t.files[0]);
    }
  });

  /* ═════════ 4. 가이드 ═════════ */
  function renderGuide() {
    var C = BOOK.checklists;
    function cl(key) {
      var c = C[key], ck = state.checks[key] || [], done = ck.filter(Boolean).length;
      return '<div class="card check"><h3>' + c.title + ' <span class="muted small">' + done + '/' + c.items.length + '</span></h3><ul>' +
        c.items.map(function (it, i) { return '<li class="' + (ck[i] ? 'done' : '') + '"><input type="checkbox" data-ck="' + key + '" data-i="' + i + '"' + (ck[i] ? ' checked' : '') + '><span>' + it + '</span></li>'; }).join('') + '</ul></div>';
    }
    var html = '<h2>책 핵심 정리 · 체크리스트</h2><div class="grid g2">' + cl('p77') + cl('allocTip') + cl('etfPick') + cl('payout') + '</div>' +
      '<div class="card"><h3>4개의 통장 (Ch.3)</h3><div class="tbl-wrap"><table><tr><th>통장</th><th>역할</th><th>운용 (Ch.6)</th></tr>' +
      ['p1', 'p2', 'irp', 'isa', 'rirp'].map(function (k) { var a = ACC[k]; return '<tr><td><span class="dot" style="background:' + a.color + '"></span>' + a.name + ' <span class="muted tiny">' + a.sub + '</span></td><td style="text-align:left;white-space:normal">' + a.role + '</td><td>' + a.strategy + '</td></tr>'; }).join('') + '</table></div></div>' +
      '<div class="grid g2"><div class="card"><h3>세금 규칙 요약</h3><div class="tbl-wrap"><table>' +
        '<tr><td>세액공제</td><td style="white-space:normal">연금저축 600만, IRP 합산 900만. 총급여 5,500만 이하 16.5%, 초과 13.2% (최대 148.5만 원)</td></tr>' +
        '<tr><td>연금소득세</td><td>55~69세 5.5% · 70~79세 4.4% · 80세+ 3.3%</td></tr>' +
        '<tr><td>사적연금 총한도</td><td style="white-space:normal">세액공제 계좌 인출 연 1,500만 원(월 125만) 초과 시 종합과세 또는 16.5% 분리과세</td></tr>' +
        '<tr><td>연금수령한도</td><td style="white-space:normal">1월 1일 평가액 ÷ (11 − 연차) × 120%. 55세에 1연차 시작</td></tr>' +
        '<tr><td>중도해지</td><td style="white-space:normal">세액공제 받은 원금+수익에 기타소득세 16.5%. 급하면 연금저축 담보대출 검토</td></tr>' +
        '<tr><td>ISA</td><td style="white-space:normal">3년 의무, 비과세 200만(서민형 400만), 초과 9.9%. 만기 60일 내 연금 전환 시 10%(최대 300만) 추가 공제</td></tr>' +
      '</table></div></div>' +
      '<div class="card"><h3>생애주기 3단계</h3><div class="tbl-wrap"><table>' +
        '<tr><td>적립기 30~55세</td><td style="white-space:normal">자산 성장 집중, 세액공제 900만 최대 활용</td></tr>' +
        '<tr><td>전환기 55~65세</td><td style="white-space:normal">소득 크레바스 대비. 추가 납입은 안 해도 해지하지 말고 운용 지속</td></tr>' +
        '<tr><td>수령기 65~100세</td><td style="white-space:normal">저율과세 활용, 늦게 받을수록 세율↓. 4~5% 인출로 원금 유지</td></tr>' +
      '</table></div><h3 style="margin-top:14px">계좌별 인출 순서 (Ch.7)</h3><ol class="small" style="margin:0;padding-left:18px"><li>세액공제 받은 연금계좌 (연 1,500만 원 이내)</li><li>세액공제 안 받은 계좌 (비과세 원금)</li><li>퇴직 IRP</li></ol></div></div>' +
      '<div class="card small muted">출처: 박곰희, 《박곰희 연금 부자 수업》(인플루엔셜, 2025). p.77 체크리스트와 자산배분 팁 박스 문구는 책 원문을 옮긴 것이고, 계산식·추천 로직·TDF 상품 예시·MMF 예시 상품은 앱이 덧붙인 것입니다. 세법은 2025년 책 기준이며 바뀔 수 있습니다.</div>';
    $('#v-guide').innerHTML = html;
  }
  $('#v-guide').addEventListener('change', function (e) {
    var t = e.target.closest('[data-ck]'); if (!t) return;
    var arr = state.checks[t.dataset.ck] = state.checks[t.dataset.ck] || [];
    arr[+t.dataset.i] = t.checked; save(); renderGuide();
  });

  /* ───────── 공통 ───────── */
  var toastEl = document.createElement('div');
  toastEl.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1b2333;color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;z-index:50;display:none;max-width:90vw;text-align:center';
  document.body.appendChild(toastEl);
  var toastT;
  function toast(m) { toastEl.textContent = m; toastEl.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.display = 'none'; }, 2600); }

  function renderAll() { renderSim(); renderStyle(); renderTrack(); renderGuide(); }
  var rzT, lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - lastW) < 40) return; lastW = window.innerWidth; clearTimeout(rzT); rzT = setTimeout(function () { var on = document.querySelector('.view.on'); if (on && on.id === 'v-sim') renderSimOut(); if (on && on.id === 'v-track') renderTrack(); }, 200); });
  document.body.className = 'tab-sim';
  renderAll();
  window.__app = { state: function () { return state; }, SIM: SIM };
})();
