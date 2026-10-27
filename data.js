/* 《박곰희 연금 부자 수업》(인플루엔셜, 2025) 기반 데이터
 * 상품명은 책(2025년 6월 출간) 기준. 매수 전 증권사 앱에서 현재 상장 여부, 이름 변경, 보수를 확인하세요.
 * expRet: 시뮬레이션 기본 가정 수익률(책 서술을 바탕으로 한 앱 가정치, 보장 아님)
 */
var BOOK = {
  title: '박곰희 연금 부자 수업',

  accounts: {
    p1:   { key: 'p1',   name: '연금저축1', sub: '세액공제 O', color: '#2f6fed', role: '연금의 주축. 연 600만 원까지 세액공제', strategy: '자산배분' },
    p2:   { key: 'p2',   name: '연금저축2', sub: '세액공제 X', color: '#7a5af8', role: '한도 초과분 저장고, 원금 비과세 인출(비상금 겸용)', strategy: '자산배분' },
    irp:  { key: 'irp',  name: '저축 IRP',  sub: '세액공제 O', color: '#12a594', role: '연금저축과 합산 연 900만 원까지 세액공제', strategy: 'TDF' },
    isa:  { key: 'isa',  name: 'ISA',       sub: '중개형',     color: '#f59e0b', role: '3년 후 만기 → 연금계좌 전환(추가 세액공제 10%, 최대 300만 원)', strategy: '월배당' },
    rirp: { key: 'rirp', name: '퇴직 IRP',  sub: '퇴직금',     color: '#64748b', role: '퇴직금 수령 계좌. 저축 IRP와 분리 관리', strategy: '안정형' }
  },

  /* Chapter 4. 투자 금액별 납입 시나리오 (만 원/월) */
  scenarios: [
    { m: 50,  p1: 10, irp: 0,  isa: 40,  who: '노후까지 시간 여유가 있는 20~30대', goal: '세제혜택, 장기 복리' },
    { m: 100, p1: 20, irp: 0,  isa: 80,  who: '유연한 현금흐름이 필요한 사람', goal: '세제혜택, 안정적 현금흐름' },
    { m: 150, p1: 50, irp: 0,  isa: 100, who: '본격적인 은퇴 준비를 하는 40~50대', goal: '세제혜택 극대화, 노후 자금 구축' },
    { m: 200, p1: 50, irp: 25, isa: 125, who: '고소득 근로자, 자영업자', goal: '세제혜택 극대화, 조기 은퇴 자금' }
  ],

  limits: {
    p1Credit: 600,      // 연금저축 세액공제 한도(만 원/년)
    totalCredit: 900,   // 연금저축+IRP 합산 세액공제 한도
    pensionPay: 1800,   // 연금계좌 연간 납입 한도
    isaPay: 2000,       // ISA 연간 납입 한도
    isaTaxFree: 200,    // ISA 일반형 비과세(서민형 400)
    isaConvCredit: 300, // ISA 만기 전환 추가 세액공제 대상 한도
    privatePension: 1500 // 사적연금 저율과세 연간 한도
  },

  /* 연금소득세(지방세 포함) */
  pensionTax: function (age) { return age >= 80 ? 0.033 : age >= 70 ? 0.044 : 0.055; },

  portfolios: {
    /* Chapter 6. 통장1·통장2 자산배분 포트폴리오 */
    aa_6040_kr: { group: 'aa', name: '6대4 포트폴리오 (국내)', risk: 'aggressive', expRet: 7, yieldTxt: '책: 연평균 약 8%',
      desc: '주식 60, 채권 40. 가장 기본적인 자산배분 모델.',
      items: [
        { asset: '주식', name: 'VIP 한국형가치투자A-e', w: 60, type: '펀드', note: '저평가 국내 우량기업 장기투자' },
        { asset: '채권', name: 'TIGER 종합채권(AA-이상)액티브', w: 40, type: 'ETF' }
      ] },
    aa_6040_us: { group: 'aa', name: '6대4 포트폴리오 (미국)', risk: 'aggressive', expRet: 7, yieldTxt: '책: 연평균 약 8%',
      desc: '미국 S&P500 60, 미국채10년 40. (H)는 환헤지.',
      items: [
        { asset: '주식', name: 'PLUS 미국S&P500(H)', w: 60, type: 'ETF' },
        { asset: '채권', name: 'TIGER 미국채10년선물', w: 40, type: 'ETF' }
      ] },
    aa_gomhee: { group: 'aa', name: '박곰희 포트폴리오', risk: 'aggressive', expRet: 7, yieldTxt: '책: 자산배분 기대수익률 7%대',
      desc: '글로벌 분산 + 배당주·리츠로 현금흐름, 금·달러로 위험 분산.',
      items: [
        { asset: '국내주식', name: 'VIP 한국형가치투자A-e', w: 30, type: '펀드' },
        { asset: '해외주식', name: 'PLUS 미국S&P500(H)', w: 25, type: 'ETF' },
        { asset: '채권', name: 'KODEX 국고채30년액티브', w: 20, type: 'ETF' },
        { asset: '배당주', name: 'SOL 미국배당다우존스(H)', w: 10, type: 'ETF', note: '환율이 충분히 낮아지면 환노출(H 없는) 상품으로 교체 권장' },
        { asset: '리츠', name: 'KODEX 한국부동산리츠인프라', w: 5, type: 'ETF' },
        { asset: '금', name: 'ACE KRX금현물', w: 5, type: 'ETF' },
        { asset: '달러', name: 'TIGER 미국달러SOFR금리액티브(합성)', w: 5, type: 'ETF' }
      ] },
    aa_perm_kr: { group: 'aa', name: '영구 포트폴리오 (국내)', risk: 'conservative', expRet: 6, yieldTxt: '책: 연평균 5~7%, 최대 손실폭 낮음',
      desc: '주식·채권·금·현금(달러) 각 25%. 어떤 경제 환경에서도 생존.',
      items: [
        { asset: '주식', name: 'VIP 한국형가치투자A-e', w: 25, type: '펀드' },
        { asset: '채권', name: 'RISE 종합채권(A-이상)액티브', w: 25, type: 'ETF' },
        { asset: '금', name: 'ACE KRX금현물', w: 25, type: 'ETF' },
        { asset: '달러', name: 'TIGER 미국달러SOFR금리액티브(합성)', w: 25, type: 'ETF' }
      ] },
    aa_perm_us: { group: 'aa', name: '영구 포트폴리오 (미국)', risk: 'conservative', expRet: 6, yieldTxt: '책: 연평균 5~7%, 최대 손실폭 낮음',
      desc: '나스닥100·미국채10년·금·달러 각 25%.',
      items: [
        { asset: '주식', name: 'KODEX 미국나스닥100', w: 25, type: 'ETF' },
        { asset: '채권', name: 'TIGER 미국채10년선물', w: 25, type: 'ETF' },
        { asset: '금', name: 'ACE KRX금현물', w: 25, type: 'ETF' },
        { asset: '달러', name: 'ACE 미국달러SOFR금리(합성)', w: 25, type: 'ETF' }
      ] },
    aa_season_kr: { group: 'aa', name: '올시즌 포트폴리오 (국내)', risk: 'conservative', expRet: 6, yieldTxt: '책: 안정적 성과, 낮은 리스크',
      desc: '올웨더 단순화 버전. 장기채 비중이 높아 금리 하락기에 강함.',
      items: [
        { asset: '주식', name: 'VIP 한국형가치투자A-e', w: 30, type: '펀드' },
        { asset: '장기채권', name: 'KODEX 국고채30년액티브', w: 40, type: 'ETF' },
        { asset: '중기채권', name: 'KIWOOM 국고채10년', w: 15, type: 'ETF' },
        { asset: '원자재', name: 'TIGER 구리실물', w: 7.5, type: 'ETF' },
        { asset: '금', name: 'ACE KRX금현물', w: 7.5, type: 'ETF' }
      ] },
    aa_season_us: { group: 'aa', name: '올시즌 포트폴리오 (미국)', risk: 'conservative', expRet: 6, yieldTxt: '책: 안정적 성과, 낮은 리스크',
      desc: '미국 장기채 40, 중기채 15, 주식 30, 구리·금 각 7.5.',
      items: [
        { asset: '주식', name: 'PLUS 미국S&P500(H)', w: 30, type: 'ETF' },
        { asset: '장기채권', name: 'ACE 미국30년국채액티브', w: 40, type: 'ETF' },
        { asset: '중기채권', name: 'KODEX 미국10년국채선물', w: 15, type: 'ETF' },
        { asset: '원자재', name: 'TIGER 구리실물', w: 7.5, type: 'ETF' },
        { asset: '금', name: 'ACE KRX금현물', w: 7.5, type: 'ETF' }
      ] },

    /* Chapter 6. 통장4 월배당 포트폴리오 (수령기 전환에도 사용) */
    div_defense: { group: 'div', name: "'우주 방어' 월배당", risk: 'conservative', expRet: 4.5, yieldTxt: '예상 배당수익률 4~5%',
      desc: '원금 보존 최우선. 주식·채권 반반.',
      items: [
        { asset: '국내주식', name: 'PLUS 고배당주', w: 25, type: 'ETF' },
        { asset: '국내채권', name: 'RISE 25-11 회사채(AA-이상)액티브', w: 25, type: 'ETF', warn: '만기 2025년 11월인 만기매칭형 ETF라 지금은 매수 불가일 수 있음. 같은 유형(AA- 이상 회사채)의 다른 ETF로 대체하세요.' },
        { asset: '미국채권', name: 'TIGER 미국투자등급회사채액티브(H)', w: 25, type: 'ETF' },
        { asset: '미국주식', name: 'SOL 미국배당다우존스(H)', w: 25, type: 'ETF' }
      ] },
    div_balance: { group: 'div', name: "'균형 추구' 월배당", risk: 'moderate', expRet: 6.5, yieldTxt: '예상 배당수익률 6~7%',
      desc: '안정성과 수익성의 균형. 가장 보편적인 선택.',
      items: [
        { asset: '국내주식', name: 'TIGER 은행고배당플러스TOP10', w: 25, type: 'ETF' },
        { asset: '미국채권', name: 'ACE 미국하이일드액티브(H)', w: 25, type: 'ETF' },
        { asset: '국내부동산', name: 'KODEX 한국부동산리츠인프라', w: 25, type: 'ETF' },
        { asset: '미국주식', name: 'SOL 미국배당다우존스(H)', w: 25, type: 'ETF' }
      ] },
    div_cc: { group: 'div', name: "'커버드콜 한 방울' 월배당", risk: 'aggressive', expRet: 9.5, yieldTxt: '예상 배당수익률 9~10%',
      desc: '커버드콜 ETF를 일부 섞어 분배금을 높임. 변동성과 위험도 큼.',
      items: [
        { asset: '국내주식', name: 'TIGER 은행고배당플러스TOP10', w: 25, type: 'ETF' },
        { asset: '미국채권', name: 'ACE 미국하이일드액티브(H)', w: 25, type: 'ETF' },
        { asset: '국내부동산', name: 'KODEX 한국부동산리츠인프라', w: 20, type: 'ETF' },
        { asset: '미국주식', name: 'TIGER 미국배당다우존스타겟데일리커버드콜', w: 30, type: 'ETF', note: '빅테크 없는 배당주 기반 커버드콜(책 추천 이유)' }
      ] },

    /* Chapter 5. 대기자금 */
    safe: { group: 'safe', name: 'MMF·금리형 ETF (대기자금)', risk: 'conservative', expRet: 3, yieldTxt: '기준금리 + α 수준',
      desc: '입금 후 투자처를 정하기 전 임시 운용. 현금으로 방치하지 않기.',
      items: [
        { asset: '금리형', name: 'KODEX CD금리액티브(합성)', w: 50, type: 'ETF', note: '예시 상품(책 본문 상품명 아님)' },
        { asset: '금리형', name: 'KODEX KOFR금리액티브(합성)', w: 50, type: 'ETF', note: '예시 상품(책 본문 상품명 아님)' }
      ] }
  },

  /* 통장3 TDF: 출생연도 + 60 과 가장 가까운 빈티지 */
  tdf: {
    expRet: 6,
    etfs: {
      2030: ['KODEX TDF2030액티브', 'ACE TDF2030액티브', 'RISE TDF2030액티브', 'KIWOOM TDF2030액티브'],
      2040: ['KODEX TDF2040액티브', 'RISE TDF2040액티브', 'KIWOOM TDF2040액티브', 'PLUS TDF2040액티브'],
      2045: ['TIGER TDF2045'],
      2050: ['KODEX TDF2050액티브', 'ACE TDF2050액티브', 'RISE TDF2050액티브', 'KIWOOM TDF2050액티브']
    },
    fundSeries: ['미래에셋전략배분TDF', '한국투자TDF알아서', '삼성한국형TDF', 'KB온국민TDF', '키움키워드림TDF'],
    vintages: [2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060]
  },

  checklists: {
    p77: { title: '55세 연금 준비, 이것만은 꼭 챙기세요! (p.77)', items: [
      '현재 가입한 연금 상품 확인하기',
      '월 납입액 계산하기 (소득의 10~15% 권장)',
      '세액공제 한도 확인하기',
      '기존 적립금 통합 검토하기',
      '배우자와 연금 전략 상의하기'
    ] },
    allocTip: { title: '나에게 딱 맞는 자산배분 포트폴리오 찾기', items: [
      '투자 성향 파악하기',
      '투자 기간 고려하기 (은퇴가 멀면 주식↑, 가까우면 채권↑)',
      '운용사 신뢰도 보기 (자산 규모, 운용 기간, 운용 실적)',
      '비용 비교하기 (비슷한 전략이면 보수가 낮은 쪽)'
    ] },
    etfPick: { title: '연금 투자에 적합한 ETF 고르는 법', items: [
      '투자 목표에 맞는 자산군·지수 고르기',
      '순자산 300억 원 이상으로 거르기',
      '보수가 낮은 ETF 우선',
      '추적오차·괴리율이 낮은지 확인',
      '거래량(유동성) 점검'
    ] },
    payout: { title: '연금 수령의 황금 공식, 5단계 (Ch.7)', items: [
      '1단계: 세액공제 받은 연금저축 + 저축 IRP 합치기 (전액 이전, 현금화 후 이전)',
      '2단계: 하루 날 잡아 월배당 중심 포트폴리오로 한 번에 전환',
      '3단계: 연간 배당액·연금수령한도·1,500만 원 총한도 체크',
      '4단계: 수령 방식 선택 (월배당→정액, 자산배분→정률, 주식→자율)',
      '5단계: 자가배당 여부와 주식 비중(20~40%) 정하기'
    ] }
  }
};
