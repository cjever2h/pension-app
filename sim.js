/* 연금 시뮬레이션 엔진 (단위: 만 원)
 * 복리 방식: 책 예시와 동일하게 월 이율 = 연수익률/12, 매월 초 납입.
 *   (검증: 월 50만, 7%, 30년 → 61,354만 원 = 책 표와 일치)
 */
var SIM = (function () {
  var L = BOOK.limits;

  function ymToIndex(ym) { var p = String(ym).split('-'); return (+p[0]) * 12 + (+p[1] - 1); }
  function indexToYm(i) { var y = Math.floor(i / 12), m = i % 12 + 1; return y + '-' + (m < 10 ? '0' : '') + m; }
  function nowYm() { var d = new Date(); return indexToYm(d.getFullYear() * 12 + d.getMonth()); }

  /* 책 Chapter 4 시나리오(50/100/150/200만 원)를 잇는 배분 규칙 */
  function allocate(m, mode, custom) {
    var a = { p1: 0, p2: 0, irp: 0, isa: 0 };
    if (m <= 0) return a;
    var isaCap = L.isaPay / 12;
    if (mode === 'custom' && custom) {
      a.p1 = +custom.p1 || 0; a.p2 = +custom.p2 || 0; a.irp = +custom.irp || 0; a.isa = +custom.isa || 0;
      return a;
    }
    if (mode === 'credit') {           // 앱 옵션: 세액공제 한도(월 75만)부터 채우기
      a.p1 = Math.min(m, 50);
      a.irp = Math.min(m - a.p1, 25);
      a.isa = Math.min(m - a.p1 - a.irp, isaCap);
      a.p2 = m - a.p1 - a.irp - a.isa;
      return a;
    }
    // 'book'
    if (m <= 100) a.p1 = 0.2 * m;
    else if (m < 150) a.p1 = 20 + (m - 100) * 0.6;
    else a.p1 = 50;
    if (m >= 200) a.irp = 25; else if (m > 150) a.irp = (m - 150) * 0.5;
    a.isa = Math.min(m - a.p1 - a.irp, isaCap);
    a.p2 = Math.max(0, m - a.p1 - a.irp - a.isa);
    return a;
  }

  function pmt(rate, n, pv) { // 연간 기준
    if (n <= 0) return pv;
    if (Math.abs(rate) < 1e-9) return pv / n;
    return pv * rate / (1 - Math.pow(1 + rate, -n));
  }

  /* 메인 시뮬레이션 */
  function run(inp, opt) {
    opt = opt || {};
    var dAcc = opt.dRet || 0, dPay = opt.dRet || 0;
    var age0 = +inp.age;
    var start = ymToIndex(inp.startYm || nowYm());
    var P = Math.max(0, ymToIndex(inp.payoutYm) - start);       // 수령 개시까지 개월 수
    var contribMonths = Math.round((+inp.years) * 12);
    var endM = Math.max(P + 12, Math.round((+inp.lifeAge - age0) * 12));
    var credRate = inp.incomeLow ? 0.165 : 0.132;
    var inf = (+inp.inflation || 0) / 100;
    var r = inp.rets || {};
    var rr = {
      p1: ((+r.p1 || 0) + dAcc) / 1200, p2: ((+r.p2 || 0) + dAcc) / 1200,
      irp: ((+r.irp || 0) + dAcc) / 1200, isa: ((+r.isa || 0) + dAcc) / 1200,
      rirp: ((+r.rirp || 0) + dAcc) / 1200
    };
    var payR = ((+inp.payRet || 0) + dPay) / 1200;
    var isaFree = inp.isaLow ? 400 : L.isaTaxFree;

    var b = { p1: +inp.exPension || 0, p2: 0, irp: 0, isa: +inp.exIsa || 0, rirp: +inp.exRirp || 0 };
    var F = 0;                         // 연금계좌 내 세액공제 안 받은 원금(비과세)
    var principal = b.p1 + b.isa + b.rirp;
    var isaPrin = b.isa, isaAge = 0;   // ISA 원금, 개설 후 개월 수
    var creditSum = 0, isaTaxSum = 0;
    var yearAcc = { p1: 0, irp: 0, contrib: 0, credit: 0, conv: 0 };
    var rows = [], series = [];
    var allocNow = null, overCap = false;
    var payStartAge = age0 + P / 12;
    // 연금수령 연차 기준: 55세, 기존 연금자산이 없으면 가입 5년 충족 시점
    var eligAge = Math.max(55, (+inp.exPension > 0 || inp.has5y) ? 55 : age0 + 5);

    var pay = null; // 연간 인출 계획
    var res = { depleteAge: null, overLimitYears: [], over1500Years: [] };
    var paidAtStart = null;
    var B = 0, T0 = 0;

    function isaConvert() {
      var gain = b.isa - isaPrin;
      var tax = Math.max(0, gain - isaFree) * 0.099;
      isaTaxSum += tax;
      var amt = b.isa - tax;
      var credPart = Math.min(amt * 0.1, L.isaConvCredit);
      yearAcc.credit += credPart * credRate; creditSum += credPart * credRate;
      yearAcc.conv += amt;
      b.p1 += credPart; b.p2 += amt - credPart; F += amt - credPart;
      b.isa = 0; isaPrin = 0; isaAge = 0;
    }

    for (var m = 0; m < endM; m++) {
      var age = age0 + m / 12;
      var yIdx = Math.floor(m / 12);
      if (m % 12 === 0) yearAcc = { p1: 0, irp: 0, contrib: 0, credit: 0, conv: 0, wT: 0, wF: 0, wR: 0, tax: 0, gross: 0 };

      if (m < P) {
        /* ── 적립기 / 거치기 ── */
        if (m < contribMonths) {
          var amt = (+inp.monthly) * Math.pow(1 + (+inp.growth || 0) / 100, yIdx);
          var a = allocate(amt, inp.allocMode, inp.custom);
          if (m === 0) allocNow = a;
          if (a.p1 + a.p2 + a.irp > L.pensionPay / 12 + 1e-6) overCap = true;
          // 세액공제 한도 초과분은 비과세 원금으로 처리
          var p1Cred = Math.max(0, Math.min(a.p1, L.p1Credit - yearAcc.p1));
          var irpCred = Math.max(0, Math.min(a.irp, L.totalCredit - Math.min(L.p1Credit, yearAcc.p1 + a.p1) - yearAcc.irp));
          F += (a.p1 - p1Cred) + (a.irp - irpCred) + a.p2;
          yearAcc.p1 += a.p1; yearAcc.irp += a.irp;
          var cr = (p1Cred + irpCred) * credRate;
          yearAcc.credit += cr; creditSum += cr;
          b.p1 += a.p1; b.p2 += a.p2; b.irp += a.irp; b.isa += a.isa; isaPrin += a.isa;
          principal += amt; yearAcc.contrib += amt;
        }
        b.p1 *= 1 + rr.p1; b.p2 *= 1 + rr.p2; b.irp *= 1 + rr.irp; b.isa *= 1 + rr.isa; b.rirp *= 1 + rr.rirp;
        if (b.isa > 0 || isaPrin > 0) isaAge++;
        if (inp.isaConvert && isaAge >= 36 && b.isa > 0) isaConvert();
      } else {
        /* ── 수령기 ── */
        if (m === P) {
          // 1단계: 계좌 합치기. 남은 ISA는 정리해서 비과세 원금으로 합류
          if (b.isa > 0) {
            var g2 = b.isa - isaPrin, t2 = Math.max(0, g2 - isaFree) * 0.099;
            isaTaxSum += t2; F += b.isa - t2; B = b.p1 + b.p2 + b.irp + b.isa - t2; b.isa = 0;
          } else B = b.p1 + b.p2 + b.irp;
          if (F > B) F = B;
          paidAtStart = { pension: B, rirp: b.rirp, F: F };
          res.atPayoutTotal = B + b.rirp;
        }
        if ((m - P) % 12 === 0) {
          var pyIdx = (m - P) / 12;
          var remainYears = Math.max(1, Math.round((endM - m) / 12));
          var pool = B + b.rirp, W;
          if (inp.method === 'fixed') W = (+inp.fixedMonthly) * 12 * (inp.fixedInflate ? Math.pow(1 + inf, age - age0) : 1);
          else if (inp.method === 'period') W = pmt(Math.pow(1 + payR, 12) - 1, Math.max(1, Math.min(remainYears, (+inp.periodYears || remainYears) - pyIdx)), pool);
          else W = pool * (+inp.rate) / 100;
          if (inp.method === 'period' && pyIdx >= (+inp.periodYears || 999)) W = 0;
          // 연금수령한도
          var yr = Math.floor(age) - eligAge + 1;
          var limit = (yr >= 1 && yr <= 10) ? B / (11 - yr) * 1.2 : (yr < 1 ? 0 : Infinity);
          // 인출 순서(책): 세액공제 계좌 1,500만 이내 → 비과세 원금 → 퇴직 IRP → 나머지
          var T = Math.max(0, B - F);
          var need = W, wT = Math.min(need, T, L.privatePension); need -= wT;
          var wF = Math.min(need, F); need -= wF;
          var wR = Math.min(need, b.rirp); need -= wR;
          var wT2 = Math.min(need, T - wT); need -= wT2;
          wT += wT2;
          pay = { W: W, wT: wT, wF: wF, wR: wR, limit: limit, short: need > 1e-6 };
          var rateAge = BOOK.pensionTax(Math.floor(age));
          var taxT = wT > L.privatePension ? wT * 0.165 : wT * rateAge;
          var over = Math.max(0, (wT + wF) - limit);
          if (over > 0) { taxT += Math.min(over, wT) * (0.165 - (wT > L.privatePension ? 0.165 : rateAge)); res.overLimitYears.push(Math.floor(age)); }
          if (wT > L.privatePension) res.over1500Years.push(Math.floor(age));
          pay.tax = taxT + wR * (+inp.rirpTax || 0) / 100;
          if (pay.short && res.depleteAge === null) res.depleteAge = Math.floor(age);
        }
        // 매월 인출
        var mt = Math.min(pay.wT / 12, Math.max(0, B - F)), mf = Math.min(pay.wF / 12, F), mr = Math.min(pay.wR / 12, b.rirp);
        B -= mt + mf; F -= mf; b.rirp -= mr;
        yearAcc.wT += mt; yearAcc.wF += mf; yearAcc.wR += mr; yearAcc.tax += pay.tax / 12; yearAcc.gross += mt + mf + mr;
        B *= 1 + payR; b.rirp *= 1 + payR;
        if (B < 0.01) { B = 0; F = 0; }
        if (b.rirp < 0.01) b.rirp = 0;
        if ((B + b.rirp) <= 0.5 && res.depleteAge === null) res.depleteAge = Math.floor(age);
      }

      var total = (m < P) ? (b.p1 + b.p2 + b.irp + b.isa + b.rirp) : (B + b.rirp);
      if (m % 12 === 11 || m === endM - 1 || m === P - 1) series.push({ m: m + 1, age: age0 + (m + 1) / 12, total: total, principal: principal });

      if (m % 12 === 11 || m === endM - 1) {
        var ageY = Math.floor(age0 + yIdx);
        var deflator = Math.pow(1 + inf, yIdx + 1);
        var npsOn = ageY >= (+inp.npsAge || 65);
        var nps = npsOn ? (+inp.npsMonthly || 0) * Math.pow(1 + inf, yIdx) : 0;
        var inPay = (m >= P);
        var netMonthly = inPay ? (yearAcc.gross - yearAcc.tax) / 12 : 0;
        rows.push({
          year: Math.floor((start + m) / 12), age: ageY,
          phase: m < Math.min(contribMonths, P) ? '적립' : (m < P ? '거치' : '수령'),
          contrib: yearAcc.contrib, credit: yearAcc.credit, conv: yearAcc.conv,
          total: total, principal: principal,
          gross: yearAcc.gross, tax: yearAcc.tax, net: yearAcc.gross - yearAcc.tax,
          rirpW: yearAcc.wR,
          netMonthly: netMonthly, nps: nps, cash: netMonthly + nps,
          cashReal: (netMonthly + nps) / Math.pow(1 + inf, yIdx),
          target: (+inp.target || 0) * Math.pow(1 + inf, yIdx),
          overLimit: res.overLimitYears.indexOf(ageY) >= 0,
          over1500: res.over1500Years.indexOf(ageY) >= 0
        });
      }
    }

    // 수령 첫해 요약
    var first = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].phase === '수령') { first = rows[i]; break; }
    var yearsToPay = P / 12;
    var atPay = res.atPayoutTotal;
    var prinAtPay = 0;
    for (var j = 0; j < series.length; j++) if (series[j].m <= P) prinAtPay = series[j].principal;
    if (P === 0) prinAtPay = principal;
    var last = rows[rows.length - 1];

    return {
      rows: rows, series: series, alloc: allocNow || allocate(+inp.monthly, inp.allocMode, inp.custom), overCap: overCap,
      payStartAge: payStartAge, yearsToPay: yearsToPay,
      atPayout: atPay || 0, atPayoutReal: (atPay || 0) / Math.pow(1 + inf, yearsToPay),
      principalAtPayout: prinAtPay, creditSum: creditSum, isaTaxSum: isaTaxSum,
      paidAtStart: paidAtStart, first: first,
      depleteAge: res.depleteAge, endBalance: last ? last.total : 0,
      overLimitYears: res.overLimitYears, over1500Years: res.over1500Years,
      eligAge: eligAge, credRate: credRate
    };
  }

  /* 목표 자산(수령 개시 시점, 만 원)을 위한 월 투자금 역산 */
  function solveMonthly(inp, target) {
    var lo = 0, hi = 3000, k, x;
    var base = JSON.parse(JSON.stringify(inp));
    for (k = 0; k < 40; k++) {
      x = (lo + hi) / 2; base.monthly = x;
      if (run(base).atPayout < target) lo = x; else hi = x;
    }
    return hi;
  }

  /* 투자 추적: XIRR (flows: [{d: Date, v: number}], 투자자 관점 납입 음수) */
  function xirr(flows) {
    if (flows.length < 2) return null;
    var t0 = flows[0].d.getTime();
    function f(r) { var s = 0; for (var i = 0; i < flows.length; i++) s += flows[i].v / Math.pow(1 + r, (flows[i].d.getTime() - t0) / 31557600000); return s; }
    var lo = -0.99, hi = 5, flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) return null;
    for (var k = 0; k < 100; k++) { var mid = (lo + hi) / 2, fm = f(mid); if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; } }
    return (lo + hi) / 2;
  }

  function tdfVintage(birthYear, tilt) {
    var target = birthYear + 60, best = 2025, bd = 1e9, vs = BOOK.tdf.vintages;
    for (var i = 0; i < vs.length; i++) { var d = Math.abs(vs[i] - target); if (d < bd || (d === bd && ((tilt > 0 && vs[i] > best) || (tilt < 0 && vs[i] < best)))) { bd = d; best = vs[i]; } }
    if (tilt > 0 && best < target) best = Math.min(2060, best + 5);
    if (tilt < 0 && best > target) best = Math.max(2025, best - 5);
    return { target: target, vintage: best };
  }

  return { run: run, allocate: allocate, solveMonthly: solveMonthly, xirr: xirr, tdfVintage: tdfVintage,
    ymToIndex: ymToIndex, indexToYm: indexToYm, nowYm: nowYm };
})();
