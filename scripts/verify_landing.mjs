// 메인 랜딩 회귀 — SINCE 라벨 · 금지 표현 · 전문 번역 단가 단일 출처
//   node scripts/verify_landing.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(HERE, '../index.html'), 'utf8').split('\r\n').join('\n');

let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log('  ✅ ' + label); }
                               else { fail++; console.log('  ❌ ' + label); } };

const a = html.indexOf('<!-- HERO -->'), b = html.indexOf('<!-- 스탠다드 주문 모달 -->');
const land = html.slice(a, b);
check(a > 0 && b > a, '랜딩 구역 찾음');


// ── v2 (2026-10-29, 문구 2026-10-31 "한 단어도 허투루 옮기지 않습니다") · 번역공증·아포스티유 제거 · 새 팔레트 ──
console.log('\n[1] 첫 화면');
const script = [...land.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('PLAN_PRICE'));
const els = {}, planEls = [{ k: 'ai', textContent: '' }, { k: 'standard', textContent: '' }];
const sandbox = { window: {}, handleAI(){}, location: { hostname: 'iumm.kr', protocol: 'https:', search: '' },
  document: { documentElement: { setAttribute(){} }, getElementById: (id) => (els[id] = els[id] || { textContent: '' }),
  querySelectorAll: (q) => q.startsWith('template') ? [] : planEls.map(e => ({ getAttribute: () => e.k, set textContent(v){ e.textContent = v; } })) } };
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
check(land.includes('<p class="lp-lead"><span class="ko-nw">아이움 AI 엔진</span>은 정확하게 기억하고,<br>전문 번역가는 깊이 이해합니다.</p>'), '서브 문구 (아이움 AI 엔진)');
check(land.includes('<p class="lp-fieldline">게임 · 법률 · 의료 · 회계 · 특허 · <span class="nb">학술 · 매뉴얼 · ESG</span></p>'), '분야 줄 (여덟 분야)');
check(/id="lp-entry">\s*<button type="button" class="lp-btn" onclick="handleAI\(\)">파일 올리고 바로 견적 보기<\/button>\s*<a class="lp-btn line" href="#field-standards">분야별 번역 기준 보기<\/a>/.test(land), '버튼 2개 (견적 → 주문 창 · 기준 → #field-standards), 인트로 mask 기준 #lp-entry 유지');

console.log('\n[2] 단가 단일 출처');
check(sandbox.PLAN_PRICE && sandbox.PLAN_PRICE.ai === 25 && sandbox.PLAN_PRICE.standard === 40, 'PLAN_PRICE = { ai:25, standard:40 }');
check(planEls[0].textContent === 25 && planEls[1].textContent === 40, '요금 카드 data-plan = PLAN_PRICE');
check(!/currentPlan\s*===?\s*["']ai["']\s*\?\s*25\s*:\s*40/.test(html), '주문 모달 25:40 하드코딩 없음');

console.log('\n[3] 구성 · 순서');
const order = ['id="top"', 'id="team"', 'id="iumm-about"', 'id="process"', 'id="field-standards"', 'id="business"', 'id="pricing"', 'id="faq-summary"', 'id="cta-final"'].map(x => land.indexOf(x));
check(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), '첫 화면 → 번역팀 → 왜 아이움 → 과정 → 분야 → 맡겨야 하는 이유 → 요금 → FAQ → 마지막');
check(!/id="promise"|세 가지 약속|lp-promise/.test(html) && !/href="#promise"/.test(html), "'세 가지 약속' 구역·링크 없음 (2026-10-30)");
{ const secBg = (id) => (land.match(new RegExp('<section class="([^"]*)" id="' + id + '"')) || [])[1] || '';
  check(secBg('team') === 'lp-sec' && secBg('iumm-about') === 'lp-sec tight' && secBg('process') === 'lp-sec band' && secBg('field-standards') === 'lp-sec' &&
        secBg('business') === 'lp-sec pale' && secBg('pricing') === 'lp-sec' && secBg('faq-summary') === 'lp-sec lp-faq' && /class="lp-final" id="cta-final"/.test(land),
    '구역 배경 순서 — 남색 → 오프화이트(번역팀·왜 아이움) → 남색 띠(과정) → 오프화이트(분야) → 페일 블루(이유) → 오프화이트(요금·FAQ) → 남색'); }
const curFlow = land.slice(land.search(/<div class="v3-cur">\s*<h2 class="lp-h2 mb">단순 AI 번역이 아닙니다<\/h2>/));
check(curFlow.length < land.length && (curFlow.match(/<ol class="lp-flow10">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length === 9, "현재 번역 과정 9단계 · 큰 제목 '단순 AI 번역이 아닙니다'");
check(land.includes('<p class="lp-sub">번역하는 AI와 검수하는 AI를 따로 두고, 서로 반박하게 했습니다. 중요한 지적은 근거를 따져 맞는 것만 반영하고, 마지막은 최종 휴먼터치로 완성합니다.</p>') && (land.match(/<div class="lp-relay" role="img"/g) || []).length === 2 && /\.lp-relay \.c\{[^}]*stroke:var\(--v-gold\)/.test(html) && /@media\(max-width:640px\)\{\s*\.lp-relay\{flex-direction:column/.test(html),
  '과정 부제(번역 AI·검수 AI 반박) · 흐름 그림(번역 AI ⇄ 검수 AI → 근거 확인 → 최종 휴먼터치, 금색 선·화살표, 모바일 세로) — 현재·V3');
check(land.includes('<span class="d">번역을 맡은 AI가 분야별 기준에 맞춰 옮깁니다.</span>') && land.includes('<span class="d">번역에 참여하지 않은 다른 AI가 원문을 근거로 오역·누락·숫자를 짚어 냅니다.</span>') && land.includes('<span class="d">중요한 지적마다 번역한 AI가 근거를 따져 받아들이거나 반박하고, 확인된 지적만 반영합니다.</span>'), '3~5단계 = V2 코드(번역 모델 · 다른 회사 검수 모델 · 치명·중대 반론)');
check(land.includes('<h2 class="lp-h2 mb">한 문장이 10단계를 거쳐 납품됩니다</h2>\n    <p class="lp-sub">번역하는 AI와 검수하는 AI를 따로 두고, 서로 반박하게 했습니다. 중요한 지적은 근거를 따져 맞는 것만 반영하고, 마지막은 최종 휴먼터치로 완성합니다.</p>'), 'V3 10단계 제목 아래 같은 부제');
check(!/class="lp-label"|class="lp-kicker"/.test(html), '구역 제목 위 작은 라벨 없음');
check(land.includes('<li>IGDA 게임 현지화 모범 사례</li>') && land.includes('<li>IEC/IEEE 82079-1 (사용 정보 작성 표준)</li>') && !land.includes('STD_'), '게임·매뉴얼 기준 배지 = 스타일시트 반영분');
check((land.match(/<button type="button" class="lp-field[ "]/g) || []).length === 8 && land.includes('<details class="lp-other">') && land.includes('그 밖의 분야(비즈니스 · 마케팅 · 공공 등)도 분야별 기준으로 번역합니다.'), '분야 칸 8개(button) + 그 밖의 분야 접기');
check(/<h2 class="lp-h2 mb">분야마다 쓰는 말이 다릅니다<\/h2>\s*<p class="lp-sub">아이움은 여덟 분야를 특화해, 분야마다 정해진 기준과 용어로 옮깁니다\.<\/p>/.test(land) && !land.includes('아이움이 특화한 여덟 분야</h2>'), "분야 제목 '분야마다 쓰는 말이 다릅니다' + 부제");
{ // 칸 = 원문 → 아이움 표기(마루 부리·골드 밑줄) → 근거 → 분야명 → 한 줄 소개 · 상세 = 직역 대비 + 견적 버튼
  const F8 = [['gaming', '이 몸이 그대의 검이 되어 주겠노라', 'この身、そなたの剣となろう', '캐릭터 말투(고어체) 유지', 'I will be your sword.'],
    ['legal', '손해배상액의 예정', 'liquidated damages', '민법 제398조 영문 표기', 'estimated amount of damages'],
    ['medical', '중대한 이상사례', 'serious adverse event', 'ICH E2A (severe와 구분)', 'severe adverse event'],
    ['accounting', '계속기업 관련 중요한 불확실성', 'Material Uncertainty Related to Going Concern', '국제감사기준 ISA 570', 'important uncertainty about the continuing company'],
    ['patent', '진보성', 'inventive step', 'PCT·EPC 표기 (미국은 <span class="nb">non-obviousness</span>)', 'progressiveness'],
    ['academic', '~한 것으로 사료된다', 'These findings suggest that…', '학술 영어의 완곡 표현', 'It is considered that…'],
    ['esg', '이중 중대성 평가', 'double materiality assessment', 'ESRS·EFRAG 표기', 'dual importance evaluation'],
    ['manual', '위험 · 경고 · 주의', 'DANGER · WARNING · CAUTION', 'ANSI Z535·ISO 3864-2 신호어 체계', 'Danger · Warning · Attention']];
  for (const [v, src, x, why, lit] of F8) {
    const t = land.match(new RegExp(`<button type="button" class="lp-field[^"]*" id="ft-${v}" data-field="${v}" aria-expanded="(true|false)" aria-controls="fd-${v}">([^]*?)</button>`));
    const p = land.match(new RegExp(`<div class="fd" id="fd-${v}"[^>]*>([^]*?)<button type="button" class="lp-btn fq" data-field="${v}">이 분야로 견적 보기</button>`));
    const order = t && ['class="src">' + src, 'class="x mb"><span class="u" lang="', '>' + x + '</span>', 'class="why">' + why, 'class="f">', 'class="d">'].map((s) => t[2].indexOf(s));
    check(t && order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])) && p && p[1].includes('<span class="k">직역하면</span> <s lang="en">' + lit + '</s>') && p[1].includes('>' + x + '</span>') &&
      html.includes(`<option value="${v}"`), `분야 칸·상세 '${v}' — 원문→표기→근거→분야명→소개 · 직역 대비 · 견적 버튼(주문 창 분야 값 있음)`);
  }
  check(/id="ft-gaming" data-field="gaming" aria-expanded="true"/.test(land) && (land.match(/aria-expanded="true" aria-controls="fd-/g) || []).length === 1, "처음 '게임' 선택");
  check(land.includes('뜻은 맞지만 캐릭터의 말투가 사라집니다.') && land.includes('ICH 기준에서 severe는 증상의 ‘정도’를 뜻하는 다른 말입니다.') && land.includes('‘주의’는 CAUTION이 정해진 신호어입니다.'), '직역 대비 설명 3곳(게임·의료·매뉴얼)');
  check(/\.lp-fields \[lang="ja"\][^{]*\{font-family:'Yu Mincho'[^}]*'Noto Serif CJK JP'/.test(html), '일본어 표기 글꼴 대체 (마루 부리에 없는 글자 → 시스템 일본어 명조)');
  check(/\.lp-field\.sel\{background:var\(--v-navy\)/.test(html) && /\.lp-fd\{[^}]*background:var\(--v-pale\)/.test(html) && /\.lp-field:focus-visible\{outline:3px solid/.test(html), '선택 칸 네이비 · 상세 패널 라이트블루 · 키보드 포커스 표시');
  check(/@media\(prefers-reduced-motion:reduce\)\{\.lp-field\.sel \.u,\.lp-fd \.fd\.play \.lit s\{animation:none\}\}/.test(html), '움직임 두 가지(밑줄·취소선)는 reduced-motion 이면 정지');
}
check(/\.lp-fields\{display:grid;grid-template-columns:repeat\(4,1fr\)/.test(html) && /\.lp-field\{[^}]*border-top:1px solid[^}]*border-radius:0;background:var\(--v-bg\)/.test(html) && /\.lp-fd \.std li\{display:inline\}/.test(html), '분야 칸 = 오프화이트·위쪽 가는 선 · 데스크톱 4×2 · 기준은 한 줄 글자');
for (const b of ['ICH 가이드라인', 'K-IFRS', 'ISA 국제감사기준', 'WIPO Pearl 특허 용어', '지식재산처 PCT 용어 해설', '학회 공식 용어 우선', 'GRI Standards', 'ISSB IFRS S1·S2', 'KSSB 지속가능성 공시기준', '원작 공식 표기 우선'])
  check(land.includes('<li>' + b + '</li>'), `기준 배지 '${b}'`);
check(land.includes('주요 시장: 영어 · 중국어(간체·번체) · 일본어 등'), '게임 주요 시장 줄');

console.log('\n[3-2] 기업 고객 · 무료 테스트 · 14일 무상 수정');
check(land.includes('<h2 class="lp-h2 mb">아이움에 맡겨야 하는 이유</h2>') && !/기업이 아이움에 맡기는 이유/.test(html) && (land.match(/<div class="c"><p class="k mb">/g) || []).length === 7, "'아이움에 맡겨야 하는 이유' 6칸 + V3 품질 리포트 1");
{ const ks = [...land.matchAll(/<p class="k mb">([\s\S]*?)<\/p><p class="d">([^<]*)<\/p>/g)].map(m => [m[1].replace(/<[^>]+>/g, ''), m[2]]);
  const want = ['글자당 원부터', '5,000자 24시간', '기업용 보안 처리', 'NDA 체결', '1,000자 무료', '14일 1회 무상 수정', '품질 리포트'];
  check(ks.map(k => k[0]).join('|') === want.join('|'), '핵심 사실 = ' + ks.map(k => k[0]).join(' · '));
  check(land.includes('<p class="k mb">글자당 <span data-plan="ai"></span>원부터</p>') && !/추가 요금 없이/.test(html), "단가 = PLAN_PRICE '부터' · '추가 요금 없이' 없음");
  check(ks[1][1] === '스탠다드는 5,000자까지 24시간 이내에 납품합니다.' && html.includes("{max:5000,  label:'5,000자까지',      ai:'24시간 이내', standard:'2일 이내'}"), '납기 = DELIVERY_TABLE(주문 화면 표·견적 칸 공통) 스탠다드 5,000자까지 24시간 이내');
  // 대표 원칙 — 부가세·접수 시간 같은 조건 문구는 메인에 넣지 않고 견적·결제 단계에서 보여 준다
  check(!/부가세|19시/.test(land.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')), "메인 화면 글자(숨김·V3 포함)에 '부가세'·'19시' 없음");
  check(html.includes('id="estimate-vat-note" style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">부가세 별도</p>') && html.includes('※ 19시 이후 접수 건은 익일 09시 접수 기준으로 납품일이 계산됩니다.') && html.includes('>부가세 (10%)</p>'),
    "견적 칸 '부가세 별도' · 소요시간 표 아래 19시 안내 · 결제 화면 부가세(10%) 줄 그대로");
  check(ks[2][1] === '학습에 쓰이지 않는 기업용 연결로만 처리합니다. 개인정보 번호는 유출·노출되지 않도록 자동으로 가려진 상태로 번역이 시작되고, 파일은 납품 21일 후 삭제합니다.' && land.includes('문서는 납품 21일 후 삭제합니다.') && !/21일 안에/.test(land) && !ks[2][1].includes('회사별 용어뿐'),
    "21일 삭제 = '납품 21일 후'(cron 실제) · 보안 칸에 '회사별 용어뿐' 문장 없음(용어 수집 개인정보 제외가 완전하지 않음)"); }
check(/\.lp-why \.k\{[^}]*color:var\(--v-navy\);background:linear-gradient\(var\(--v-gold\),var\(--v-gold\)\) no-repeat 0 100%\/40px 2px/.test(html), '핵심 사실 = 남색 글자 + 골드 짧은 선 (골드 글자는 대비 부족)');
check(!/원본 형식 그대로/.test(land), "'원본 형식 그대로' 카드 없음 (형식 유지 납품 미지원)");
check(/onclick="openFreeTest\(\)">무료 테스트 번역 신청<\/button>/.test(land) && /href="https:\/\/pf\.kakao\.com\/_BlpKX\/chat"[^>]*>NDA 체결 문의<\/a>/.test(land), '버튼: 무료 테스트 신청 · NDA 문의(카카오 상담)');
check(!/후불|월 정산|외상/.test(html.replace(/<!--[\s\S]*?-->/g, '')), '후불·월 정산·외상 없음');
check(html.includes("fetch(MEMBER_API_BASE+'/api/order/free-test'") && /FREE_TEST_MAX_CHARS=1000/.test(html), '무료 테스트 → /api/order/free-test · 1,000자');
check(html.includes("'/revision',{method:'POST'") && html.includes("REVISION_CLOSED_MSG='수정 요청을 이미 사용했거나 수정 기간이 지났습니다. 문의해 주세요.'"), '마이페이지 수정 요청 → /revision · 사용·기간 지남 안내');

// ── 2026-10-30 통합 명령 — 무료 테스트 하나로 · 무상 수정 유료 1회 · 수사·공증 문구 · 약관 개정 ──
console.log('\n[3-3] 무료 테스트 하나로 · 무상 수정 유료 1회 · 약관 개정 (2026-10-30)');
const terms = html.slice(html.indexOf('<div id="page-terms"'), html.indexOf('<!-- FAQ 페이지'));
const priv = html.slice(html.indexOf('<div id="page-privacy"'), html.indexOf('<!-- 기업회원 추가 약관 페이지 -->'));
check(!/300자|300글자/.test(html), "'300자·300글자' 문구 없음 (주석 포함)");
check(!/2회/.test(html), "'2회' 없음 (무상 수정 1회)");
check((html.match(/유료 주문은 납품 후 14일 이내 1회 무료로 수정해 드립니다\./g) || []).length === 3, '카드·랜딩 FAQ·FAQ 페이지 = 유료 주문 14일 이내 1회');
check((html.match(/원문이 바뀌거나 분량이 늘어난 경우는 새 주문으로 접수됩니다\./g) || []).length === 2, 'FAQ 2곳 — 원문 변경·분량 추가는 새 주문');
check(html.includes("if(!v||o.isFreeTest||v.reason==='not_delivered') return '';") && html.includes("if(v.reason==='not_paid') return '';"), '무료 테스트·미결제 주문에는 수정 요청 버튼 없음');
check(html.includes('<button id="tab-free" onclick="switchOrderPlan(\'free\')">무료 테스트</button>') && !html.includes('id="free-trial-banner"') && !html.includes('id="free-discount-row"'), '주문 탭 = 무료 테스트 · 옛 첫 주문 할인 배너·줄 없음');
check(/function handleFreeTrial\(\)\{ openFreeTest\(\); \}/.test(html), '옛 무료체험 진입점 → 무료 테스트');
check(/회사명 <span style="color:#e05555">\*<\/span><\/label>\n\s*<input type="text" id="signup-company"/.test(html) && html.includes("if(!companyVal){showToast('회사명을 입력해주세요')"), '가입 정보 입력 — 회사명 필수');
check(!/수사|진술|사법공조|증거 자료|공문|공증|아포스티유/.test(terms), '이용약관에 수사·진술·사법공조·증거 자료·공문·공증·아포스티유 없음');
check(!terms.includes('11.4') && terms.includes('11.3 통화 환산 금지 원칙'), '11.3(수사 예외) 삭제 · 통화 환산 = 11.3');
check(terms.includes('공고일: 2026년 10월 30일 &nbsp;|&nbsp; 시행일: 2026년 11월 6일') && priv.includes('공고일: 2026년 10월 30일 &nbsp;|&nbsp; 시행일: 2026년 11월 6일'), '약관·개인정보 공고 10-30 · 시행 11-06 (7일 전 공지, main 합친 날 기준)');
check(terms.includes('href="/legal/terms-2026-10-26"') && priv.includes('href="/legal/privacy-2026-10-26"') && fs.existsSync(path.resolve(HERE, '../legal/terms-2026-10-26.html')) && fs.existsSync(path.resolve(HERE, '../legal/privacy-2026-10-26.html')), '이전 약관·개인정보 보기 = 2026-10-26 시행본 보관 파일');
check(terms.includes('회사당 1회, 1,000자(공백 제외) 이하의 무료 테스트 번역') && terms.includes('무료 테스트 번역은 무상 수정 대상이 아닙니다.'), '약관 5.6 무료 테스트 — 회사당 1회 1,000자 · 수정 대상 아님');
check(terms.includes('유료 주문은 납품 후 14일 이내 1회 무상으로 수정') && terms.includes('무상 수정 횟수와 별개') && !/5일/.test(terms.slice(terms.indexOf('<h2>제1조')).replace(/15일|25일/g, '')), '약관 5.3·6조·7조 — 14일 1회 · 회사 귀책 별개 · 5일 기한 없음');
check(terms.includes('제7조의2 (비밀유지계약)'), '약관 제7조의2 비밀유지계약 신설');
check(!/기업 고객 전용|용어 수집|자동 삭제/.test(terms.slice(terms.indexOf('terms-revision-notice'), terms.indexOf('<h2>제1조'))), '개정 안내에 기업 고객 전용·용어 수집·자동 삭제 없음');
check(priv.includes('무료 테스트 번역 회사당·회원당 1회 제한 관리'), '개인정보 제2조 — 무료 테스트 회사당·회원당 1회');
check(['게임', '법률', '의료·제약·의료관광', '회계·재무', '특허·지식재산', '학술·논문', '매뉴얼·기술 문서', 'ESG', '그 밖'].every(v => html.includes(`<option value="${v}">${v}</option>`)), '업종 선택지 = 서버 ORDER_INDUSTRIES');
check(!/value="criminal"/.test(html), '주문 화면 수사 분야 선택지 없음');
for (const q of ['맡기기 전에 품질을 확인할 수 있나요?', '비밀유지계약을 맺을 수 있나요?', '납품 후 수정이 필요하면요?'])
  check(html.split(q).length - 1 === 2, `FAQ '${q}' (요약 · 전체)`);
check(!/납품일로부터 <strong>5일 이내<\/strong>/.test(html.slice(html.indexOf('<div id="page-faq"'))) || html.indexOf('<div id="page-faq"') < 0, 'FAQ 의 5일 A/S 문구 교체');

console.log('\n[4] 공증·아포스티유 제거');
const vis = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
const mainVis = vis.slice(0, vis.indexOf('id="page-terms"') > 0 ? vis.indexOf('id="page-terms"') : vis.length);
check(!/lpGo\('(notary|apostille)'\)/.test(html), '메뉴·버튼의 공증 위저드 입구 없음');
const landVis = land.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
check(!/공증|아포스티유|등기|급행|수령일/.test(landVis), '메인 랜딩 화면 글자에 공증·아포스티유·등기·급행·수령일 없음');
const headMeta = html.slice(0, html.indexOf('</head>'));
check(!/공증|아포스티유/.test(headMeta.replace(/<style[\s\S]*?<\/style>/g, '')), '제목·검색 설명·공유 문구에 공증 없음');
const faqPage = html.slice(html.indexOf('<div id="page-faq"'), html.indexOf('<!-- 하단 문의 -->'));
check(!/data-cat="(notary|apostille)"|공증|아포스티유/.test(faqPage.replace(/<!--[\s\S]*?-->/g, '')), '전체 FAQ 화면에 공증 항목 없음');
check(!fs.readFileSync(path.resolve(HERE, '../sitemap.xml'), 'utf8').includes('/notary/'), 'sitemap 에 /notary/ 없음');

console.log('\n[5] 문구 원칙');
check(!/자동 번역|기계 번역|AI 도구|돌린다|돌려서|모든 문장을/.test(landVis), 'AI 도구 표현 · 사람 일 부풀리기 없음');
check(!/사법공조|진술조서|수사|GPT|Claude|Gemini|프롬프트|원가|최고|최저|유일|1위/.test(landVis), '모델 이름·수사·원가·최상급 표현 없음');
check(!/용어 고정|역번역|95점|별의 기사|Starblade|귀사의 용어를 기억|품질 리포트/.test(landVis), '아직 없는 기능 문구 없음(later_copy.md 보관분)');
check(land.includes('<p class="lp-slogan" lang="en">Faithful to every word.</p>') && !/\.lp-slogan b\{/.test(html), "영문 한 줄 'Faithful to every word.' (첫 글자 강조 없음)");
{ // 2026-10-31 문구 개편 — 제목·공유 미리보기·바닥글 · 옛 문구는 손님 화면에 없음(개인정보처리방침 본문·주석 제외)
  const NEWT = 'IUMM 아이움 — 한 단어도 허투루 옮기지 않습니다';
  check(html.includes('<title>' + NEWT + '</title>') && html.includes('<meta property="og:title" content="' + NEWT + '">') && html.includes('<meta name="twitter:title" content="' + NEWT + '">') && html.includes('<meta property="og:image:alt" content="' + NEWT + '">'), "title · og:title · twitter:title · og:image:alt = '" + NEWT + "'");
  check(html.includes('>한 단어도 허투루 옮기지 않습니다</p>\n      <p lang="en" style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:400;letter-spacing:0.5px;margin:6px 0 0">IUMM · Intelligence Uniting Mind and Machine</p>'), "바닥글 'IUMM · Intelligence Uniting Mind and Machine' (작은 글씨, 강조 없음)");
  const pv = html.indexOf('<div id="page-privacy"'), pe = html.indexOf('<!-- 기업회원 추가 약관 페이지 -->');
  const cust = (html.slice(0, pv) + html.slice(pe)).replace(/<!--[\s\S]*?-->/g, '');
  check(pv > 0 && pe > pv && !/두 전문가|AI에 보내기 전|처리 전에 자동으로 가립|Intelligence Unites|Mind &(amp;)? Machine|Man &(amp;)? Machine|완전 삭제/.test(cust),
    "손님 화면(숨김·V3 포함, 처리방침 본문 제외)에 '두 전문가'·'AI에 보내기 전'·'처리 전에 자동으로 가립'·'Intelligence Unites'·'Mind & Machine'·'완전 삭제' 없음");
  check((cust.match(/자동으로 가려진 상태로 번역이 시작/g) || []).length >= 8 && !/전문 번역가가 마지막으로 확인/.test(cust), "가림 문구 = '자동으로 가려진 상태로 번역이 시작' · '전문 번역가가 마지막으로 확인' 없음");
  check(land.includes('<td class="me" data-h="아이움">유출·노출되지 않도록 자동으로 가려진 상태로 번역이 시작됩니다</td>') && land.includes('<td class="me" data-h="아이움">담당자가 최종 휴먼터치로 마무리합니다(프리미엄 플러스는 전문 번역가가 최종 확인)</td>'), '비교표 아이움 칸 — 가림 · 마무리(플랜 구분)');
  check((land.match(/<span class="t">최종 휴먼터치<\/span><span class="d">담당자가 마지막으로 다듬어 납품합니다\. 프리미엄 플러스는 전문 번역가가 최종 확인합니다\./g) || []).length === 2 && (land.match(/<span class="n">최종 휴먼터치<\/span>/g) || []).length === 2 && land.includes('확인합니다. 확정된 용어는 귀사 전용 용어집에 쌓여 다음 주문으로 이어집니다.</span>'), "과정 마지막 단계 '최종 휴먼터치'(V2·V3) · 흐름 그림 끝 · V3 용어 축적 문장 유지");
  check((land.match(/담당자가 최종 휴먼터치로 마무리하고, 프리미엄 플러스는 전문 번역가가 최종 확인합니다/g) || []).length === 2 && (html.match(/담당자가 최종 휴먼터치로 마무리하고, 프리미엄 플러스는 전문 번역가가 최종 확인합니다/g) || []).length === 4, 'FAQ(메인·전체) 최종 확인 문장 = 플랜 구분'); }
check(land.includes('<p class="lp-trust">SINCE 2011 · 32개 언어 · 누적 1만 건 이상</p>'), '신뢰 표시 한 줄');
{ const pairs = (html.match(/<select id="lang-select"[\s\S]*?<\/select>/)[0].match(/<option[^>]*>한국어 → [^<]+<\/option>/g) || []).length;
  check(pairs === 32, `신뢰 표시 '32개 언어' = 주문 화면 한국어→외국어 목록 ${pairs}개`); }
check(!/이음|잇습니다|잇고|이어 드립니다/.test(landVis) && !/이음/.test(html.replace(/<!--[\s\S]*?-->/g, '')), "'이음' 브랜드 표현 · '잇다' 문구 없음 (숨김 V3 포함)");
check(land.includes('<section class="lp-sec tight" id="iumm-about">') && land.includes('<h2 class="lp-h2 mb">AI 채팅창에 붙여 넣는 번역과 다릅니다</h2>') && !land.includes('빠르면서도, 정확하게</h2>'), "비교 섹션 (제목 'AI 채팅창에 붙여 넣는 번역과 다릅니다')");
{ const t = land.match(/<table class="lp-vs">[^]*?<\/table>/);
  const rows = t ? [...t[0].matchAll(/<tr><th scope="row">([^<]+)<\/th><td data-h="일반 AI 채팅">([^<]+)<\/td><td class="me" data-h="아이움">([^<]+)<\/td><\/tr>/g)].map(m => m[1]) : [];
  check(rows.join('|') === 'AI 학습|개인정보 번호|파일 보관|용어 축적|검수|마무리' && (t[0].match(/<tr><th scope="row">/g) || []).length === 6 && t[0].includes('<th scope="col" class="me">아이움</th>'), "비교 6줄 — '용어 축적'은 '파일 보관' 바로 다음 (항목 / 일반 AI 채팅 / 아이움)");
  check(t[0].includes('<td data-h="일반 AI 채팅">같은 용어도 번역할 때마다 달라질 수 있습니다</td><td class="me" data-h="아이움">고객님의 다음 번역을 위해 개인정보와 문서 내용은 모두 제외하고, 번역 전문 용어만 축적합니다. 다음 번역부터 같은 용어로 통일됩니다.</td>'), "'용어 축적' 줄 문구");
  check(/\.lp-vs td\.me\{font-weight:700;color:var\(--v-navy\)\}/.test(html) && /\.lp-vs td::before\{content:attr\(data-h\)/.test(html), '아이움 열만 남색 · 모바일은 항목별 카드(위 일반 AI 채팅, 아래 아이움)'); }
{ const q = '일반 AI 채팅에 직접 넣어 번역하는 것과 무엇이 다른가요?';
  check(land.includes('<details><summary>' + q + '</summary>') && html.includes('Q.</span>' + q + '<span class="faq-arrow">') && (html.match(/보안 점검을 위해 보관한 기록도 기본 30일 안에 삭제됩니다\./g) || []).length === 2, 'FAQ 추가 — 랜딩·전체 FAQ 둘 다 (외부 AI 보관 기본 30일)'); }
check(land.includes('<p class="s">당신의 가능성을 세계로 연결합니다.</p>'), '마지막 섹션 대표 문구');

// ── 2026-10-31 '아이움 AI' → '아이움 AI 엔진' 통일 · FAQ 'AI 번역인가요?' · 품질 점수 배지 ──
console.log('\n[엔진] 아이움 AI 엔진 표기 · FAQ · 품질 점수 배지');
{ // 고객이 여는 파일 전부(관리자·약관/처리방침(legal) 제외) — '아이움 AI' 뒤에 '엔진'이 없는 표기가 없어야 한다
  const ROOT = path.resolve(HERE, '..'), SKIP = new Set(['admin', 'legal', 'scripts', 'node_modules', '.git']);
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(f); } else if (/\.(html|js|json|xml|txt|webmanifest)$/.test(e.name)) files.push(f); } };
  walk(ROOT);
  const bad = files.flatMap((f) => { const t = fs.readFileSync(f, 'utf8'); return [...t.matchAll(/아이움 ?AI(?! 엔진)/g)].map((m) => path.relative(ROOT, f) + ':' + t.slice(0, m.index).split('\n').length); });
  check(files.length > 5 && bad.length === 0, `고객 화면에 '아이움 AI' 단독 표기 없음 — 파일 ${files.length}개 검사${bad.length ? ' · 남은 곳 ' + bad.join(', ') : ''}`);
  check(!/엔진 엔진|엔진<\/span> 엔진/.test(html) && !/엔진 엔진/.test(fs.readFileSync(path.join(ROOT, 'scripts/motion20.js'), 'utf8')), "'엔진 엔진' 중복 없음");
  check(['<meta name="description" content="아이움 AI 엔진은', '<meta property="og:description" content="아이움 AI 엔진은', '<meta name="twitter:description" content="아이움 AI 엔진은'].every((x) => html.includes(x)), '메타 설명 · OG · 트위터 문구');
  { const mv = fs.readFileSync(path.join(ROOT, 'scripts/motion20.js'), 'utf8');
    check(!/아이움 ?AI(?! 엔진)/.test(mv) && !/thirty \(30\)/.test(mv) && mv.includes("'within 30 days'"), "20초 소개 영상 문구 — 단독 '아이움 AI' 없음 · 원문 '30일' → 'within 30 days'(괄호·글자 표기 덧붙이지 않음)"); }
  check(!fs.existsSync(path.join(ROOT, 'assets/ad25.js')) && !fs.existsSync(path.join(ROOT, 'scripts/record_ad.mjs')), '예전 25초 영상 코드(ad25.js · record_ad.mjs) 없음');
  check(!/thirty \(30\)/.test(html), "대조 패널 — 원문이 숫자만('30일')이면 번역도 숫자만('30 days')");
  check(/번역 AI<\/span>[\s\S]{0,200}검수 AI<\/span>/.test(land), "흐름의 '번역 AI ⇄ 검수 AI' 역할 이름은 그대로"); }
{ const E = '<span class="ko-nw">아이움 AI 엔진</span>';
  const A = '<p>' + E + '과 전문 번역가가 한 팀으로 번역합니다.</p><p>' + E + '은 아이움이 직접 설계한 전용 번역 엔진입니다. 여러 AI에 번역·검수·원문 대조 역할을 나눠 맡겨 서로의 결과를 검증하게 하고, 분야별 번역 기준과 축적된 용어로 최적화했습니다. 내부 품질 평가 100건 실측 결과 평균 <span class="ko-nw">95~99점</span>을 기록했습니다 (2026년 <span class="ko-nw">8~10월</span> 기준).</p><p>고객 문서는 AI 학습에 쓰이지 않으며 외부에 공개되지 않고, 개인정보는 유출·노출되지 않도록 자동으로 가려진 상태로 번역이 시작됩니다.</p><p>마지막으로 담당자가 최종 휴먼터치로 마무리하고, 프리미엄 플러스는 전문 번역가가 최종 확인합니다.</p>';
  check(land.includes('<summary>AI 번역인가요?</summary>' + A + '</details>') && html.includes('AI 번역인가요?<span class="faq-arrow">▼</span></div>\n        <div class="faq-a">' + A + '</div>'), "FAQ 'AI 번역인가요?' 새 답변 4문단 — 랜딩·전체 FAQ 둘 다");
  const badges = land.match(/<p class="lp-score">[^\n]*<\/p>/g) || [];
  check(badges.length === 2 && badges.every((b) => b === '<p class="lp-score"><span class="ko-nw">내부 품질 평가 100건 실측</span><span class="sep" aria-hidden="true">·</span><span class="ko-nw">평균 <b class="mb">95~99점</b></span><small class="ko-nw">2026년 8~10월 기준</small></p>'), '품질 점수 배지 — 현재 화면·V3 흐름 아래 (숫자만 강조, 기준 작게)');
  check([...land.matchAll(/<\/div>\n    <p class="lp-score">/g)].length === 2 && land.indexOf('<p class="lp-score">') > land.indexOf('<div class="lp-relay"'), '배지 위치 = 번역 과정 흐름 바로 아래');
  check(/\.ko-nw\{white-space:nowrap\}/.test(html), "'95~99점' · '8~10월' · '아이움 AI 엔진' 은 줄 중간에서 안 쪼갬");
  const vis = land.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
  check(!/최저가|최고|완벽/.test(vis), "'최저가 · 최고 · 완벽' 표현 없음"); }


console.log('\n[6] 색 — 새 팔레트');
check(/--v-navy:#0F2540;--v-ink:#1F4FD1;--v-ink-hover:#1A43B3;[^}]*--v-bg:#FAFAF7;--v-pale:#EEF3FB;\s*--v-text:#1B2433;--v-sub:#4A5568;--v-gold:#B08D57;/.test(html), '랜딩 토큰 (네이비·잉크 블루·오프화이트·페일 블루·본문·보조·샴페인 골드)');
check(!/#16B894|#5DE0BC|rgba\(22,184,148|rgba\(93,224,188|#06202f/i.test(html), '민트·초록·민트 위 남색 글자 없음 (사이트 전체 index.html)');
check(/\.nav-cta\{background:#1F4FD1;color:#fff;[^}]*font-weight:800/.test(html) && html.includes('.nav-cta:hover{background:#1A43B3;color:#fff}'), '상단 견적 버튼 = 잉크 블루 + 흰 굵은 글씨, 올리면 진한 잉크 블루');
check(/\.lp-btn\{[^}]*background:var\(--v-ink\);color:#fff;[^}]*font-weight:800/.test(html) && /\.lp-btn:hover\{background:var\(--v-ink-hover\)/.test(html), '랜딩 버튼 = 잉크 블루 + 흰 굵은 글씨');
const gold = (html.match(/[^;{]*(?:#B08D57|var\(--v-gold\))[^;}]*/g) || []);
check(gold.every(d => !/(^|[^-])color:\s*(#B08D57|var\(--v-gold\))/.test(d)), '샴페인 골드는 글자색으로 안 씀');

console.log('\n[7] 주문 화면 — 회사명 필수 · 업종 선택');
check(html.includes('id="orderCompany"') && html.includes('개인사업자·프리랜서는 상호나 본인 이름을 입력해 주세요.'), '회사명 입력 + 안내 한 줄');
check(html.includes('<option value="">선택 안 함</option>') && !/value="(의료·의료관광|제조·매뉴얼)"/.test(html), '업종 9개(위 [3-2]) + 비워도 됨 · 옛 선택지 없음');
check(/if\(oc&&!oc\.value\.trim\(\)\)\{alert\('회사명을 입력해 주세요/.test(html), '회사명 비면 결제 진행 막음');
check(/out\.회원회사명=oc\.value\.trim\(\)/.test(html) && /out\.업종=oi\.value/.test(html), '주문 데이터에 회원회사명·업종');

console.log('\n[15] 인트로');
{
  const i0 = html.indexOf('<section class="it" id="intro"'), top = html.indexOf('<section class="lp-hero" id="top">');
  check(i0 > 0 && top > i0 && !/<section[^>]*>/.test(html.slice(html.indexOf('</section>', i0) + 10, top).replace(/<script[\s\S]*?<\/script>/g, '')), '#intro 가 #top 바로 위');
  const it = html.slice(html.lastIndexOf('<!-- ════', i0), top);
  const js = it.match(/<script>([\s\S]*?)<\/script>/)[1];
  check(/\.it\{position:relative;height:330vh;/.test(it) && /@media\(max-width:640px\)\{\s*\.it\{height:290vh\}/.test(it), '바깥 높이 PC 330vh / 모바일 290vh');
  check(/\.it-stage\{position:sticky;top:0;height:100vh;height:100dvh;/.test(it), '무대 sticky · 100vh → 100dvh (iOS 주소창 높이 변화)');
  check(it.includes('<p class="it-head">당신의 가능성을 세계로 연결합니다</p>') && !/<h1/.test(it), '위 문구 = p (h1 아님)');
  check(land.includes('<h1 class="serif">한 단어도<br class="pc-br"> <span class="nw">허투루 옮기지 않습니다.</span></h1>') && (land.match(/<h1[\s>]/g) || []).length === 1 && /@media\(max-width:640px\)\{[^@]*\.lp-hero h1 \.pc-br\{display:none\}/.test(html), 'h1 "한 단어도 / 허투루 옮기지 않습니다." (데스크톱 두 줄, 모바일 자연 줄바꿈) · 메인 화면에 하나뿐');

  // ── 지도 — 점 세계지도 + 한반도 윤곽
  const dm = it.match(/<g id="continents"><path id="land" class="land" d="([^"]*)"\/><path id="korea" class="korea" d="([^"]*)"\/><\/g>/);
  const d = dm ? dm[1] : '', kd = dm ? dm[2] : '';
  check(!!dm && /^M\d/.test(d) && /^[Mmh0-9 \-]+$/.test(d) && (d.match(/h0/g) || []).length > 3000,
    `점 지도 = <g id="continents"> 안 path 하나 · "h0" 점 ${(d.match(/h0/g) || []).length}개`);
  check(it.includes('.it-map .land{fill:none;stroke:rgba(255,255,255,0.42);stroke-width:2.4px;stroke-linecap:round;vector-effect:non-scaling-stroke}'),
    '점 = 둥근 선끝 · 지름 2.4px · 흰색 42% (줌해도 굵기 그대로)');
  check(/^M[\d.]+ [\d.]+l/.test(kd) && (kd.match(/z/g) || []).length === 12 && Buffer.byteLength(kd, 'utf8') <= 6 * 1024 &&
        it.includes('.it-map .korea{fill:rgba(176,141,87,0.16);stroke:#C9A877;stroke-width:1.5px;'),
    `한반도 = 50m 남·북 윤곽 path (고리 ${(kd.match(/z/g) || []).length}개 · ${(Buffer.byteLength(kd, 'utf8') / 1024).toFixed(1)}KB) · 샴페인 골드 선 1.5px + 골드 16%`);
  const mapBytes = Buffer.byteLength(d + kd, 'utf8');
  check(mapBytes <= 40 * 1024, `지도 용량 ${(mapBytes / 1024).toFixed(1)}KB (점 ${(Buffer.byteLength(d, 'utf8') / 1024).toFixed(1)} + 한반도 ${(Buffer.byteLength(kd, 'utf8') / 1024).toFixed(1)}, ≤ 40KB)`);
  check(it.indexOf('id="korea"') < it.indexOf('class="pulse"') && it.indexOf('class="pulse"') < it.indexOf('class="kr"'), '서울 점·맥박은 한반도 위');
  {
    const bm = fs.readFileSync(path.resolve(HERE, 'build_intro_map.mjs'), 'utf8');
    check(/STEP = 1\.8, LON0 = 127, LAT_TOP = 75, COLS = 200, ROWS = 72/.test(bm) && /LON0 = 127, STEP = 1\.8, LAT_TOP = 75, COLS = 200,/.test(it) && /\['KOR', 'PRK'\]/.test(bm),
      '투영 값 일치 — 변환 스크립트 ↔ 인트로 (중심 127°E · 1.8° · 75°N부터 72행) · 한반도 = KOR·PRK');
    check(!['ne_110m_land.geojson', 'ne_50m_admin_0_countries.geojson'].some(n => fs.existsSync(path.resolve(HERE, '..', n)) || fs.existsSync(path.resolve(HERE, n))),
      'Natural Earth 원본 파일은 저장소에 없음');
  }
  check(!/veil/.test(it), '지도 전체 남색 막 없음 (글자 뒤 바탕만)');

  // ── 서울 · 도시 · 라벨
  check(it.includes('<circle class="pulse" r="5"/>') && it.includes('<circle class="kr" r="5"/>') && /<text class="lb home"[^>]*>SEOUL<\/text>/.test(it) && it.includes('.it-map .kr{fill:#9DB7F5}'),
    '서울 = 밝은 블루 점 + 맥박 + "SEOUL" (모바일도 표시)');
  const dirs = [...it.matchAll(/<text class="lb dir pc-hide"[^>]*>([^<]+)<\/text>/g)].map(m => m[1]);
  const cities = [...((js.match(/var CITY = \[([\s\S]*?)\n  \];/) || [])[1] || '').matchAll(/\['([A-Z ]+)', (-?[\d.]+), (-?[\d.]+), (\d), (\d)\]/g)].map(m => ({ n: m[1], lon: +m[2], lat: +m[3], w: +m[4], lb: +m[5] }));
  const WANT = { TOKYO: [139.7, 35.7], BEIJING: [116.4, 39.9], ULAANBAATAR: [106.9, 47.9], MOSCOW: [37.6, 55.8], ANCHORAGE: [-149.9, 61.2], VANCOUVER: [-123.1, 49.3],
    'LOS ANGELES': [-118.2, 34.1], 'NEW YORK': [-74.0, 40.7], TORONTO: [-79.4, 43.7], HONOLULU: [-157.8, 21.3], 'MEXICO CITY': [-99.1, 19.4], LIMA: [-77.0, -12.0],
    MANILA: [121.0, 14.6], JAKARTA: [106.8, -6.2], SYDNEY: [151.2, -33.9], AUCKLAND: [174.8, -36.8], 'HO CHI MINH': [106.7, 10.8], BANGKOK: [100.5, 13.8],
    SINGAPORE: [103.8, 1.35], 'NEW DELHI': [77.2, 28.6], DUBAI: [55.3, 25.2], ISTANBUL: [29.0, 41.0], CAIRO: [31.2, 30.0], JOHANNESBURG: [28.0, -26.2],
    FRANKFURT: [8.7, 50.1], PARIS: [2.35, 48.9], LONDON: [-0.1, 51.5] };
  const relL = (lon) => ((lon - 127 + 540) % 360) - 180;
  check(cities.length === 27 && new Set(cities.map(c => c.n)).size === 27 && cities.every(c => WANT[c.n] && WANT[c.n][0] === c.lon && WANT[c.n][1] === c.lat) &&
        cities.every(c => Math.abs(relL(c.lon)) <= 170) && it.includes('<g class="g-rt"></g><g class="g-dst"></g><g class="g-sp"></g>') && !/<path class="rt"/.test(it),
    `연결 도시 27곳 (좌표 일치 · 지도 좌우 끝 10° 안 도시 없음, 가장 먼 곳 ${Math.max(...cities.map(c => Math.abs(relL(c.lon)))).toFixed(1)}°) — 곡선·점·빛 점·라벨은 CITY 에서 생성`);
  {
    const WAVES = [['TOKYO', 'BEIJING', 'ULAANBAATAR', 'MANILA', 'JAKARTA', 'HO CHI MINH', 'BANGKOK', 'SINGAPORE', 'NEW DELHI'],
      ['DUBAI', 'MOSCOW', 'ISTANBUL', 'FRANKFURT', 'PARIS', 'LONDON', 'SYDNEY', 'AUCKLAND'],
      ['CAIRO', 'JOHANNESBURG', 'ANCHORAGE', 'VANCOUVER', 'LOS ANGELES', 'NEW YORK', 'TORONTO', 'HONOLULU', 'MEXICO CITY', 'LIMA']];
    const ws = cities.map(c => c.w), sorted = ws.every((w, i) => !i || w >= ws[i - 1]);
    const ang = (c) => Math.atan2(-(c.lat - 37.57), relL(c.lon) - relL(126.98)) * 180 / Math.PI, adiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    const avg = [0, 1, 2].map(w => { const l = cities.filter(c => c.w === w); let s = 0; for (let i = 1; i < l.length; i++) s += adiff(ang(l[i - 1]), ang(l[i])); return s / (l.length - 1); });
    check(sorted && WAVES.every((l, w) => cities.filter(c => c.w === w).map(c => c.n).sort().join() === l.slice().sort().join()) && avg.every(a => a >= 60) &&
          /var WAVE = \[\[0, 0\.31\], \[0\.34, 0\.65\], \[0\.68, 1\]\], DUR = 0\.16/.test(js),
      `물결 순서 ① 가까운 곳·아시아 9 → ② 중동·유럽·오세아니아 8 → ③ 아프리카·미주 10 · 물결 안 이웃 도시 방향 차 평균 ${avg.map(a => a.toFixed(0) + '°').join(' / ')} (≥ 60°, 한쪽 쏠림 없음)`);
  }
  check(cities.filter(c => c.lb).map(c => c.n).sort().join('|') === ['TOKYO', 'BEIJING', 'MOSCOW', 'VANCOUVER', 'NEW YORK', 'LOS ANGELES', 'MEXICO CITY', 'SYDNEY', 'SINGAPORE', 'NEW DELHI', 'DUBAI', 'LONDON', 'PARIS', 'JOHANNESBURG'].sort().join('|') &&
        cities.filter(c => c.lb === 2).map(c => c.n).sort().join('|') === 'BEIJING|SINGAPORE|SYDNEY|TOKYO' && /'lb to' \+ \(c\[4\] < 2 \? ' m-hide' : ''\)/.test(js) &&
        !/class="lb home[^"]*m-hide/.test(it) && dirs.join('|') === '← EUROPE|USA →' &&
        /\.it-map \.lb\.m-hide\{display:none\}/.test(it) && /min-width:641px\)\{\s*\.it-map \.lb\.pc-hide\{display:none\}/.test(it),
    '라벨 — PC 14곳(TOKYO·BEIJING·MOSCOW·VANCOUVER·NEW YORK·LOS ANGELES·MEXICO CITY·SYDNEY·SINGAPORE·NEW DELHI·DUBAI·LONDON·PARIS·JOHANNESBURG), 나머지는 점만 · 모바일 SEOUL·TOKYO·BEIJING·SYDNEY·SINGAPORE·← EUROPE·USA → 만');
  check(/if \(c\[0\] === 'LONDON'\) EU = i;/.test(js) && /if \(c\[0\] === 'NEW YORK'\) US = i;/.test(js) && /dirs\[0\]\.style\.opacity = dd\[EU\] >= DIR\[0\]/.test(js) && /dirs\[1\]\.style\.opacity = dd\[US\] >= DIR\[1\]/.test(js) && /\.it-map\{[^}]*overflow:hidden/.test(it),
    '모바일 — 화면 밖 곡선은 끝까지 그리고, LONDON·NEW YORK 곡선이 화면 끝에 닿으면 방향 라벨');
  check(it.includes('.it-map .lb{fill:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;') && /function hit\(bx\)/.test(js) && /SPOT_UP = \[/.test(js) && /SPOT_DN = \[/.test(js),
    '라벨 11px · 자간 2px · 흰색 70% · 겹치면 다음 후보 자리로');
  check(it.includes('.it-map .rt{fill:none;stroke:rgba(201,168,119,0.75);stroke-width:1.2;') && it.includes('.it-map .dst{fill:none;stroke:#9DB7F5;stroke-width:4px;'),
    '선 1.2px · 샴페인 골드 75% · 도착 점 밝은 블루 지름 4px');
  check(/E2 = Z0 \* F > 2 \? 1 - Math\.log\(2 \/ F\) \/ Math\.log\(Z0\) : 0/.test(js) && /var q = E2 < 1 \? c01\(\(e - E2\) \/ \(1 - E2\)\)/.test(js),
    '곡선은 줌아웃 후반(실제 배율 2배 이하)부터, p 0.5 에 모두 도착');
  check(/'C' \+ f\(P1\[0\]\)/.test(js) && /% 360\) - 180/.test(js), '중심 경도(127°E) 기준 좌표 · 곡선 = 3차 베지어');
  check(/<g class="lens"><circle class="halo"\/><circle class="lf"\/><circle class="lr"\/><\/g>/.test(it) && it.indexOf('class="lens"') > it.indexOf('class="g-sp"') && it.indexOf('class="lens"') < it.indexOf('class="pulse"') &&
        it.includes('.it-map .lf{fill:#0F2540}') && it.includes('.it-map .lr{fill:none;stroke:#C9A877;stroke-width:1px;vector-effect:non-scaling-stroke}') &&
        it.includes('.it-map .halo{fill:url(#itHalo)}') && /<radialGradient id="itHalo"><stop offset="0" stop-color="#9DB7F5" stop-opacity="0\.25"\/>[^]*?<stop offset="1" stop-color="#9DB7F5" stop-opacity="0"\/><\/radialGradient>/.test(it) &&
        /LC\.k = korea\.cloneNode\(false\); LC\.k\.removeAttribute\('id'\); lens\.insertBefore\(LC\.k, LC\.r\);/.test(js) && (it.match(/id="korea"/g) || []).length === 1 &&
        /LR = mob \? 32 : 46;/.test(js) && /c === LC\.h \? LR \+ 12 : LR/.test(js),
    '한반도 렌즈 — 지름 PC 92 · 모바일 64px · 남색(#0F2540) 불투명 채움 · 한반도 path 복제(마크업 한 번) · 민트 1px 테두리 + 바깥 12px 민트 25% → 투명 · 곡선 위 · 서울 점 아래');
  check(/lens\.style\.opacity = \(c01\(\(2 - z \* F\) \/ 0\.3\) \* keep\)/.test(js) && /home\.setAttribute\('y', f\(C\[1\] \+ LR \+ 15\)\)/.test(js),
    '렌즈 — 실제 배율 2배 이하에서 0→1 · 끝에서는 지도와 같이 0.14 (첫 화면 제목 뒤에도 같은 모양) · SEOUL 은 렌즈 바로 아래');
  check(/ARR\[i\] = d >= 0\.999;/.test(js) && /dots\[i\]\.style\.opacity = ARR\[i\] \? '1' : '0';/.test(js) && /sparks\[i\]\.style\.opacity = ARR\[i\] \? gone : '0';/.test(js) && /lb\.style\.opacity = ARR\[i\] \? gone : '0';/.test(js) && /lb\.style\.transform = 'translate\(/.test(js),
    '선이 도착하면 도시 점·이름·빛 점이 켜짐 (줌 중에는 도시 점을 따라감)');
  {
    const tick = (js.match(/function tick\(now\)\{[\s\S]*?\n  \}/) || [''])[0];
    check(/var t = \(now \/ 2400 \+ PH\[i\]\) % 1/.test(tick) && /PH\[i\] = \(i \* 0\.377\) % 1/.test(js) && [...tick.matchAll(/\.style\.(\w+)/g)].every(m => m[1] === 'transform') &&
          /requestAnimationFrame\(tick\)/.test(tick) && it.includes('.it-map .spark{fill:none;stroke:#DCE5FC;stroke-width:3px;'),
      '빛 점 — 지름 3px 민트 · 서울 → 도착지 2.4초 주기 · 선마다 시작 어긋남 · rAF 루프 하나 · transform 만');
    check(/setLive\(!still && ARR\.some\(Boolean\) && p < 0\.92\)/.test(js) && /\.it\.still \.it-map \.spark,\.it\.still \.it-shade\{display:none\}/.test(it),
      'reduced-motion — 빛 점 없음 (루프 안 돌고 숨김)');
  }

  // ── 줌아웃
  check(/F = mob \? 1\.6 : 1;/.test(js) && /Z0 = kh > 0 \? Math\.max\(1\.5, r0 \* 2 \* 0\.74 \/ kh\) : 6 \/ F;/.test(js) && /var z = Math\.pow\(Z0, 1 - e\);/.test(js) &&
        /zoom\.style\.transform = 'translate\(' \+ f\(S\[0\]\) \+ 'px,' \+ f\(S\[1\]\) \+ 'px\) scale\(/.test(js) && it.includes('<g class="it-zoom">'),
    '줌아웃 — 서울 기준 transform:scale, 한반도가 카드에 차는 배율(PC 약 6배) → 최종 PC 1배 · 모바일 1.6배');

  // ── 글자 · 끝
  check(/<div class="it-plate">\s*<i class="it-bg" aria-hidden="true"><\/i>\s*<p class="w">[\s\S]*?<\/p>\s*<p class="s">당신의 가능성을 세계로 연결합니다<\/p>\s*<\/div>/.test(it) &&
        it.includes('.it-bg{position:absolute;left:-30%;right:-30%;'), '"IUMM"·부제 뒤 radial 바탕 (좌우 -30% = 글자 폭 1.6배)');
  check(it.includes('<p class="w"><span>I</span><span>U</span><span>M</span><span>M</span></p>') && !/아 · 이 · 움|<span>아<\/span>/.test(it) &&
        /color:#C9D7FB;font-size:clamp\(48px,8vw,112px\);font-weight:800;letter-spacing:0\.18em;/.test(it) && /\.it-word \.s\{[^}]*color:rgba\(255,255,255,0\.8\)/.test(it) &&
        /var e = ease\(c01\(p \/ 0\.5\)\);/.test(js) && /var at = \[0\.5, 0\.525, 0\.55, 0\.575\];/.test(js) && /c01\(\(p - at\[j\]\) \/ 0\.03\)/.test(js) && /sub\.style\.opacity = c01\(\(p - 0\.585\) \/ 0\.035\)/.test(js),
    '줌아웃·곡선 p 0→0.5 · "IUMM" I·U·M·M 하나씩 + 부제 (p 0.5→0.62) · 민트 clamp(48px,8vw,112px) · 자간 0.18em · 800 · 부제 흰색 80%');
  check(!/0\.35/.test(js) && /var g = c01\(\(p - 0\.84\) \/ 0\.08\), gone = \(1 - g\)\.toFixed\(3\), keep = lerp\(1, 0\.14, g\)\.toFixed\(3\);/.test(js) &&
        /word\.style\.opacity = gone;/.test(js) && /word\.style\.transform = 'translate3d\(0,calc\(-50% \+ ' \+ lift/.test(js) && /home\.style\.opacity = gone;/.test(js) &&
        /zoom\.style\.opacity = kr\.style\.opacity = pulse\.style\.opacity = keep;/.test(js) && !/stage\.style\.opacity/.test(js),
    '끝 ① p 0.84→0.92 IUMM·부제·도시명·빛 점은 0(살짝 위로) · 지도 점·한반도·곡선은 0.14 까지만 흐려져 남음');
  check(/map\.style\.transform = 'translate3d\(' \+ f\(W \/ 6 \* g\)/.test(js) && /shade\.style\.opacity = g\.toFixed\(3\)/.test(js) && /tint\.style\.opacity = gone;/.test(js) &&
        /card\.style\.maskImage = card\.style\.webkitMaskImage = m;/.test(js) && (it.match(/class="it-map"/g) || []).length === 1 && (it.match(/id="land"/g) || []).length === 1,
    '남은 지도 — 서울이 오른쪽 1/3(W/6 이동) · 제목 쪽 남색 그라데이션 · 카드 줄 아래 mask · 지도 SVG 하나만(재사용)');
  check(/heroIn = heroIn \|\| document\.querySelector\('#top > \.lp'\)/.test(js) && /var h = c01\(\(p - 0\.92\) \/ 0\.08\)/.test(js) &&
        /'translate3d\(0,' \+ \(16 \* \(1 - h\)\)/.test(js) && /DOMContentLoaded', update/.test(js),
    '끝 ② p 0.92→1 #top 내용(라벨·h1·lead·카드) opacity 0→1 · 16px→0 (위로 돌아가면 역순)');
  {
    const pcPad = +(land.match(/\.lp-hero\{[^}]*padding:(\d+)px /) || [])[1], moPad = +(land.match(/section\.lp-hero\{padding:(\d+)px /) || [])[1];
    check(pcPad <= 40 && moPad <= 40 && /\.it\{[^}]*margin-bottom:calc\(-1 \* var\(--it-tail, 0px\)\)/.test(it) && /Math\.max\(0, Math\.floor\(H - navH\)\)/.test(js) &&
          /\.lp-hero\{position:relative;z-index:1;[^}]*background:transparent\}/.test(land) && /body\{[^}]*background:#0F2540/.test(html) && /--black:#0F2540/.test(html) &&
          /\.it-stage\{[^}]*z-index:0;background:var\(--black\);pointer-events:none\}/.test(it) && /\.it\{[^}]*background:var\(--black\)/.test(it),
      `인트로·#top·body 같은 남색(#0F2540) · 무대는 #top 아래(z 0), #top 배경 투명 · #top 이 내비 바로 아래 (빈 구간 0, 첫 줄까지 PC ${pcPad}px / 모바일 ${moPad}px)`);
  }

  // ── 정리 — 움직이는 속성·용량·외부 리소스
  check(!/<script[^>]+src=|https?:\/\/(?!www\.w3\.org)/.test(it), '외부 라이브러리·외부 리소스 없음');
  check(Buffer.byteLength(it, 'utf8') <= 60 * 1024, `인트로 전체 ${(Buffer.byteLength(it, 'utf8') / 1024).toFixed(1)}KB (지도 포함, ≤ 60KB)`);
  check(!/\.style\.(width|height|top|left|right|bottom|margin|padding)\b/.test(js), '레이아웃 속성 변경 없음');
  check([...js.matchAll(/\.style\.(\w+) =/g)].every(m => ['clipPath', 'opacity', 'transform', 'strokeDashoffset', 'maskImage', 'webkitMaskImage'].includes(m[1])),
    '움직이는 style = clip-path · opacity · transform · stroke-dashoffset · mask 뿐');
  check(/requestAnimationFrame/.test(js) && /passive:\s*true/.test(js) && !/setTimeout|setInterval/.test(js), 'rAF + passive 스크롤 · 자동 재생 없음');
  check(!/sessionStorage|iumm_intro_seen|static/.test(js) && !/\.it\.static/.test(it), '재방문 생략 규칙 없음 (sessionStorage·static 없음)');
  // 같은 세션 두 번 → 두 번 다 연출 · 움직임 줄이기만 정지 장면
  const mkEl = () => ({ style: {}, attr: {}, setAttribute(k, x){ this.attr[k] = x; }, removeAttribute(){}, cloneNode(){ return mkEl(); }, insertBefore(){}, getComputedTextLength: () => 60, getBoundingClientRect: () => ({ top: 0, bottom: 0 }), classList: { on: {}, add(){}, toggle(c, x){ this.on[c] = !!x; } } });
  const store = {};
  const run = ({ reduce }) => {
    const one = {}, all = {};
    const sec = { classList: { list: [], add(c){ this.list.push(c); } }, offsetHeight: 2000, getBoundingClientRect: () => ({ top: 0 }), style: { setProperty(){} },
      querySelector: (q) => one[q] = one[q] || (q === '.it-frame' ? { setAttribute(){}, style: {}, querySelector: () => (one['frame rect'] = one['frame rect'] || mkEl()) } : mkEl()),
      querySelectorAll: (q) => all[q] = all[q] || Array.from({ length: 2 }, mkEl) };
    const made = (cls, el) => { (all['made ' + cls] = all['made ' + cls] || []).push(el); return el; };
    const raf = { n: 0 };
    let listens = 0;
    const hero = { style: {} };   // #top > .lp
    const topEl = { id: 'top' }, cards = { offsetTop: 300, offsetParent: topEl };   // #top · 카드 줄(#lp-entry) — p=1 에서 무대 기준 70 + 300 = 370px
    const sb = { document: { createElementNS: () => { const el = mkEl(), sa = el.setAttribute; el.setAttribute = function(k, x){ sa.call(this, k, x); if (k === 'class') made(x, this); }; return el; }, getElementById: (id) => id === 'top' ? topEl : id === 'lp-entry' ? cards : sec,
      querySelector: (q) => q === '#top > .lp' ? hero : q === 'nav' ? { offsetHeight: 70 } : null },
      window: { innerWidth: 1280, innerHeight: 800, addEventListener(){ listens++; }, matchMedia: () => ({ matches: reduce }) },
      matchMedia: () => ({ matches: reduce }), sessionStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
      requestAnimationFrame: () => { raf.n++; }, Math, Number };
    vm.createContext(sb); vm.runInContext(js, sb);
    const scene = () => JSON.stringify([Object.keys(one).sort().map(k => [k, one[k].style]), Object.keys(all).sort().map(k => [k, all[k].map(e => e.style)]), hero.style]);
    return { cls: sec.classList.list, listens, hasRender: !!sb.window.__itRender, render: sb.window.__itRender, hero, scene, one, all, raf };
  };
  const first = run({ reduce: false }), second = run({ reduce: false });
  check(!first.cls.includes('still') && !second.cls.includes('still') && first.listens >= 2 && second.listens >= 2 && first.hasRender && Object.keys(store).length === 0,
    '같은 세션 두 번 열어도 두 번 다 스크롤 연출 (저장 없음)');
  check(run({ reduce: true }).cls.includes('still') && /\.it\.still\{height:60vh\}/.test(it) && /\.it\.still \.it-stage\{position:relative;height:100%\}/.test(it) && /render\(0\.7\);   \/\/ 정지 장면/.test(js),
    'prefers-reduced-motion 만 정지 장면 (높이 60vh · 머무는 구간의 완성 장면)');
  {
    // 머무는 구간(p 0.62~0.84) — 장면 전체 style 이 하나도 안 바뀐다 (실제 render 를 p 별로 돌려 본다)
    const m = run({ reduce: false }), snap = (p) => { m.render(p); return m.scene(); };
    const s62 = snap(0.62), same = [0.66, 0.7, 0.75, 0.8, 0.84].every(p => snap(p) === s62), moved = snap(0.86) !== s62 && snap(0.6) !== s62;
    check(same && moved, '머무는 구간 p 0.62~0.84 장면 불변 (0.62·0.66·0.7·0.75·0.8·0.84 style 동일, 0.6·0.86 은 다름) · 서울 맥박은 CSS 애니메이션');
    // 인트로가 남아 있는 동안(p<0.92) #top 내용 opacity 0
    const r = run({ reduce: false }), at = (p) => { r.render(p); return { o: r.hero.style.opacity, t: r.hero.style.transform }; };
    const hidden = [0, 0.5, 0.7, 0.84, 0.86, 0.88, 0.9, 0.92].every(p => Number(at(p).o) === 0);
    const mid = at(0.96), done = at(1), back = at(0.88);
    check(hidden && Number(mid.o) > 0 && Number(mid.o) < 1 && /translate3d\(0,8\.0px,0\)/.test(mid.t) && done.o === '' && done.t === '' && Number(back.o) === 0,
      `p 0.84~0.92 사이 #top 내용 opacity 0 · 0.96 → ${mid.o} · p=1 다 보임(style 비움) · 다시 0.88 로 돌아가면 0`);
    {
      // 끝난 뒤(p=1) — 남는 지도 0.14 · 사라지는 것 0 · 카드 줄(370px)에서 mask 0
      const e = run({ reduce: false }); e.render(0.5); e.render(1);
      const o = e.one, a = e.all, st = (k) => (o[k] || {}).style || {};
      const keep = ['.it-zoom', '.it-map .kr', '.it-map .pulse'].every(k => st(k).opacity === '0.140');
      const gone = ['.it-word', '.it-map .home', '.it-tint'].every(k => st(k).opacity === '0.000') &&
                   a['made lb to'].concat(a['made lb to m-hide']).every(x => x.style.opacity === '0.000') && a['made spark'].length === 27 && a['made spark'].every(x => x.style.opacity === '0.000') &&
                   a['.it-map .lb.dir'].slice(0, 2).every(x => x.style.opacity === '0.000' || x.style.opacity === '0');
      check(keep && gone && st('.it-shade').opacity === '1.000' && /translate3d\(213\.3px,0,0\)/.test(st('.it-map').transform),
        `#top 배경 지도 — 지도 점·한반도·곡선·서울 ${st('.it-zoom').opacity} · IUMM·부제·도시명·빛 점 0 · 제목 쪽 남색 1 · 서울 오른쪽 1/3 (+W/6)`);
      const m = st('.it-card').maskImage || '';
      check(m === 'linear-gradient(to bottom,#000 0px,#000 250.0px,rgba(0,0,0,0.000) 370.0px)' && st('.it-card').webkitMaskImage === m,
        `카드 뒤 지도 0 — mask 가 카드 줄 위쪽 끝(370px)에서 0, 그 위 120px 동안 서서히 (${m.slice(0, 60)}…)`);
      e.render(0.7);
      check(!st('.it-card').maskImage && st('.it-zoom').opacity === '1.000', '머무는 구간·연출 중에는 mask 없음 · 지도 그대로');
    }
    {
      // 렌즈 테두리 출발 — 출발점 27개가 서로 다른 각도(360°/27 간격) · 곡선이 렌즈 안으로 들어오지 않음
      const r = run({ reduce: false }), rts = r.all['made rt'] || [], lr = r.one['.it-map .lr'].attr, cx = +lr.cx, cy = +lr.cy, R = +lr.r;
      const cv = rts.map(e => (e.attr.d || '').match(/-?[\d.]+/g).map(Number)).map(n => [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]]);
      const ang = cv.map(P => ((Math.atan2(P[0][1] - cy, P[0][0] - cx) * 180 / Math.PI) + 360) % 360).sort((x, y) => x - y);
      const gaps = ang.map((x, i) => ((i ? x - ang[i - 1] : x + 360 - ang[ang.length - 1]) + 360) % 360);
      const onRim = cv.every(P => Math.abs(Math.hypot(P[0][0] - cx, P[0][1] - cy) - R) < 0.2);
      let minIn = 1e9;
      for (const P of cv) for (let s = 0; s <= 200; s++) { const t = s / 200, u = 1 - t, x = u*u*u*P[0][0] + 3*u*u*t*P[1][0] + 3*u*t*t*P[2][0] + t*t*t*P[3][0], y = u*u*u*P[0][1] + 3*u*u*t*P[1][1] + 3*u*t*t*P[2][1] + t*t*t*P[3][1]; minIn = Math.min(minIn, Math.hypot(x - cx, y - cy) - R); }
      const first = cv.every(P => { const d0 = Math.hypot(P[3][0] - P[0][0], P[3][1] - P[0][1]), d1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
        const ox = (P[0][0] - cx) / R, oy = (P[0][1] - cy) / R; return Math.abs(d1 - 0.3 * d0) < 0.3 && Math.abs((P[1][0] - P[0][0]) * oy - (P[1][1] - P[0][1]) * ox) / d1 < 0.05; });
      check(cv.length === 27 && R === 46 && onRim && new Set(ang.map(x => x.toFixed(1))).size === 27 && gaps.every(g => Math.abs(g - 360 / 27) < 0.2) && minIn > -0.3 && first,
        `렌즈 테두리 출발 — 출발점 27개 서로 다른 각도 (간격 ${Math.min(...gaps).toFixed(2)}~${Math.max(...gaps).toFixed(2)}° = 360°/27) · 첫 제어점 = 출발 방향 거리 30% · 렌즈 안 침범 없음 (테두리와 가장 가까운 곳 ${minIn.toFixed(2)}px)`);
      const lbs = (r.all['made lb to'] || []).concat(r.all['made lb to m-hide'] || []);
      check((r.all['made spark'] || []).length === 27 && (r.all['made dst'] || []).length === 27 && lbs.length === 14 && rts.every(e => e.attr.pathLength === '1'),
        '곡선 · 도시 점 · 빛 점 27개씩, 라벨 14개 생성');
      const n0 = r.raf.n; r.render(0.7);
      const q = run({ reduce: true }), q0 = q.raf.n; q.render(0.7); q.render(0.8);
      check(r.raf.n > n0 && q.raf.n === q0 && /setLive\(!still && /.test(js), `reduced-motion 빛 점 없음 — 빛 점 루프 요청 일반 ${r.raf.n - n0}회 · 움직임 줄이기 ${q.raf.n - q0}회`);
    }
    const s = run({ reduce: true });
    s.render(0.9); s.render(1);
    // snap 은 시험 결과 휠 한 칸으로 못 벗어나 뺐다 — 페이지 어디에도 snap 없음 (reduced-motion 포함)
    const css = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    check(s.hero.style.opacity === undefined && s.hero.style.transform === undefined && !/scroll-snap-(type|align)/.test(css),
      'reduced-motion 에서 #top 내용 항상 보임 (opacity·transform 을 건드리지 않음) · snap 없음 (페이지 전체)');
  }
  // ── "바로 신청하기 ↓" 버튼 · 경계 자동 착지
  check(it.includes('<button type="button" class="it-hint">바로 신청하기 <i aria-hidden="true">↓</i></button>') &&
        /\.it-hint\{[^}]*pointer-events:auto;[^}]*font-size:14px;[^}]*color:rgba\(255,255,255,0\.75\);[^}]*border:1px solid rgba\(255,255,255,0\.25\);border-radius:999px;/.test(it) &&
        /hint\.classList\.toggle\('off', p >= 0\.62\);/.test(js) && /\.it-hint\.off\{opacity:0;visibility:hidden;pointer-events:none\}/.test(it),
    '"바로 신청하기 ↓" — 무대 하단 가운데 · 흰색 75% 14px · 테두리 1px 흰색 25% · radius 999px · p 0.62 부터 숨김');
  {
    const r = run({ reduce: false }), hint = r.one['.it-hint'];
    r.render(0.3); const a = hint.classList.on.off; r.render(0.62); const b = hint.classList.on.off;
    check(a === false && b === true, '버튼 — p 0.3 보임 · p 0.62 숨김 (모의 실행)');
  }
  {
    const tEnd = html.indexOf('</section>', top) + 10, ls = html.slice(tEnd, tEnd + 6000).match(/^\s*<script>([\s\S]*?)<\/script>/);
    const lj = ls ? ls[1] : '';
    check(!!lj && /인트로 → 첫 화면 경계 자동 착지/.test(lj) && !/scroll-snap-(type|align)/.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')) && !/lpGo/.test(lj),
      '경계 자동 착지 = #top 바로 뒤 별도 스크립트 · scroll-snap 없음 · 버튼은 lpGo 아닌 스크롤 이동');
    // 모의 브라우저 — 섹션 0~2640px, 화면 800, 내비 70 → T = 2640 - (800 - 70) - 70 = 1840 · 구간 1545.6 ~ 2120
    const mk = ({ reduce = false, still = false, scrollend = true } = {}) => {
      let y = 0, t = 0, raf = [], timers = [], calls = [];
      const L = {}, on = (n, fn) => (L[n] = L[n] || []).push(fn), fire = (n) => (L[n] || []).forEach(fn => fn({}));
      const secH = still ? 480 : 2640, topTop = still ? 480 : 2640 - (800 - 70);
      const btnL = {};
      const sec = { offsetHeight: secH, getBoundingClientRect: () => ({ top: 0 - y }), classList: { contains: (c) => c === 'still' && still },
        querySelector: () => ({ addEventListener: (n, fn) => { btnL[n] = fn; } }) };
      const topEl = { getBoundingClientRect: () => ({ top: topTop - y }) };
      const win = { innerHeight: 800, get pageYOffset(){ return y; }, addEventListener: on, matchMedia: () => ({ matches: reduce }),
        scrollTo: (o) => { calls.push(o); y = o.top; } };
      if (scrollend) win.onscrollend = null;
      const sb = { window: win, document: { getElementById: (id) => id === 'intro' ? sec : id === 'top' ? topEl : null, querySelector: (q) => q === 'nav' ? { offsetHeight: 70 } : null },
        performance: { now: () => t }, matchMedia: win.matchMedia, Math,
        requestAnimationFrame: (fn) => { raf.push(fn); return raf.length; }, cancelAnimationFrame: () => { raf = []; },
        setTimeout: (fn, ms) => { timers.push([t + ms, fn]); return timers.length; }, clearTimeout: () => {} };
      sb.window.pageYOffset; vm.createContext(sb); vm.runInContext(lj, sb);
      const api = {
        get y(){ return y; }, calls, L, btnL,
        set(v){ y = v; },
        tick(ms){ const end = t + ms; while (t < end) { t += 16; const q = raf; raf = []; q.forEach(fn => fn(t)); const due = timers.filter(x => x[0] <= t); timers = timers.filter(x => x[0] > t); due.forEach(x => x[1]()); } },
        stopAt(v){ y = v; fire('scroll'); t += 200; fire(scrollend ? 'scrollend' : 'scroll'); api.tick(700); },
        fire
      };
      return api;
    };
    const T = 1840;
    let m = mk(); m.stopAt(1700);
    check(Math.abs(m.y - T) < 0.5 && m.calls.length > 10 && m.calls.every(c => c.behavior === 'instant'),
      `착지 구간 계산 — 섹션 2640 · 화면 800 · 내비 70 → T = 1840, 구간 1545.6~2120 · p 0.92(1700)에서 멈추면 0.4초에 걸쳐 T 로 (${m.calls.length}프레임, 도착 ${m.y.toFixed(1)})`);
    const ease = (() => { const k = mk(); k.set(1600); k.fire('scroll'); k.tick(200); k.fire('scrollend'); k.tick(160); const ys = k.calls.map(c => c.top); return ys.length > 5 && ys[1] - ys[0] > ys[ys.length - 1] - ys[ys.length - 2]; })();
    check(ease, '착지 이동 = ease-out (처음 빠르고 끝이 느림)');
    const outs = [0, 1000, 1540, 2130, 3000].map(p => { const k = mk(); if (p === 2130) k.stopAt(1700); const c = k.calls.length; k.stopAt(p); return k.calls.length - c; });
    check(outs.every(n => n === 0), `구간 밖 무개입 — 0 · 1000 · 1540(p 0.84 위) · 2130(T 에서 출발) · 3000 에서 멈추면 이동 0회 (${outs.join('/')})`);
    { const k = mk(); k.stopAt(1700); const c0 = k.calls.length; k.stopAt(2000); const down = k.calls.length - c0;
      const k2 = mk(); k2.stopAt(1700); const c1 = k2.calls.length; k2.stopAt(1650); const up = k2.calls.length - c1;
      const k3 = mk(); k3.stopAt(1200); const c2 = k3.calls.length; k3.stopAt(2050); const over = k3.calls.length - c2;
      check(down === 0 && up > 0 && Math.abs(k2.y - T) < 0.5 && over > 0 && Math.abs(k3.y - T) < 0.5,
        `T 에서 아래로 내린 스크롤은 되돌리지 않음(이동 ${down}회) · T 에서 위로 살짝 → T 복귀 · 인트로에서 T 를 지나쳐 2050 → T 복귀`); }
    { const k = mk(); k.stopAt(4000); k.stopAt(1846); check(Math.abs(k.y - T) < 0.5, '아래(카드 쪽)에서 위로 올라와 T + 6px(앵커 #top) 에 멈추면 → T 착지'); }
    // 인트로에서 빠르게 지나친 경우만 아래 끝 T + 70% (화면 800 → 2400). T 에서 시작한 아래 스크롤은 그대로 무개입
    { const k = mk(); k.stopAt(1200); const c0 = k.calls.length; k.stopAt(T + 0.6 * 800); const fromIntro = k.calls.length - c0, yi = k.y;
      const k2 = mk(); k2.stopAt(1700); const c1 = k2.calls.length; k2.stopAt(T + 0.6 * 800); const fromT = k2.calls.length - c1, yt = k2.y;
      const k3 = mk(); k3.stopAt(1200); const c3 = k3.calls.length; k3.stopAt(T + 0.75 * 800); const beyond = k3.calls.length - c3;
      const k4 = mk(); k4.stopAt(2600); k4.stopAt(T + 0.6 * 800); const fromBelow = k4.calls.length;
      check(fromIntro > 0 && Math.abs(yi - T) < 0.5 && fromT === 0 && Math.abs(yt - (T + 480)) < 0.5 && beyond === 0 && fromBelow === 0,
        `인트로(1200)에서 시작해 T+60%(2320)에 멈추면 T 로 착지 · T 에서 시작해 T+60% 에 멈추면 개입 없음 · 인트로에서 T+75% 는 구간 밖 · 아래(2600)에서 올라와 T+60% 는 개입 없음`); }
    { const k = mk(); k.set(1600); k.fire('scroll'); k.tick(200); k.fire('scrollend'); k.tick(150); const mid = k.y; k.fire('wheel'); const c = k.calls.length; k.tick(100);
      const k2 = mk(); k2.set(1600); k2.fire('scroll'); k2.tick(200); k2.fire('scrollend'); k2.tick(100); k2.fire('touchstart'); const c2 = k2.calls.length; k2.tick(100);
      const k3 = mk(); k3.set(1600); k3.fire('scroll'); k3.tick(200); k3.fire('scrollend'); k3.tick(100); k3.fire('keydown'); const c3 = k3.calls.length; k3.tick(100);
      check(mid > 1600 && mid < T && k.calls.length === c && k2.calls.length === c2 && k3.calls.length === c3,
        `이동 중 휠·터치·키 입력 → 즉시 중단 (중단 위치 ${mid.toFixed(0)}px, 그 뒤 이동 0)`); }
    { const k = mk(); k.set(1600); k.fire('scroll'); k.tick(200); k.fire('scrollend'); k.tick(150); const c = k.calls.length; k.set(1500); k.tick(300);
      check(k.calls.length === c && k.y === 1500, '이동 중 다른 스크롤(관성 등)이 끼어들면 즉시 멈춤 — 손님 쪽 위치 유지'); }
    { const k = mk(); k.set(1700); k.fire('touchstart'); k.fire('scroll'); k.tick(200); k.fire('scrollend'); k.tick(300); const held = k.calls.length; k.fire('touchend'); k.tick(800);
      check(held === 0 && Math.abs(k.y - T) < 0.5, '손가락이 닿아 있는 동안은 기다리고, 뗀 뒤(관성 끝) 착지'); }
    { const k = mk({ scrollend: false }); k.set(1700); k.fire('scroll'); k.tick(100); const early = k.calls.length; k.tick(900);
      check(early === 0 && Math.abs(k.y - T) < 0.5, 'scrollend 없는 브라우저 — 마지막 scroll 뒤 140ms 무입력이면 착지'); }
    { const k = mk({ reduce: true }); k.stopAt(1700);
      check(k.calls.length === 1 && k.calls[0].top === T && k.calls[0].behavior === 'instant', 'reduced-motion — 애니메이션 없이 즉시 T (scrollTo 1회, behavior instant)'); }
    { const k = mk(); k.set(300); k.btnL.click(); k.tick(500); const k2 = mk({ reduce: true }); k2.set(300); k2.btnL.click();
      check(Math.abs(k.y - T) < 0.5 && k.calls.length > 10 && k2.calls.length === 1 && k2.y === T, '"바로 신청하기 ↓" 클릭 → T 로 부드럽게 (reduced-motion 은 즉시)'); }
  }
  const vis = it.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  check(!/\bAI\b|인공지능|협력|부가세|사법공조|진술조서|최고|최저|유일/.test(vis), '인트로 금지 표현 없음');
}

// ── 고객 주문 화면 분야 — 수사 관련 문서명 없음 (2026-10-29) ──
console.log('\n[분야] 고객 주문 화면');
{ const fs = html.match(/<select id="field-select"[\s\S]*?<\/select>/)[0];
  check(!/criminal|수사|진술|범죄/.test(fs), "분야 선택에 '범죄·수사·공문' 없음");
  check(fs.includes('법률·계약 (계약서, 약관, 법령, 소송·법원 서류)</option>') && !/공문/.test(fs), "법률 항목 설명 = 계약서·약관·법령·소송·법원 서류 ('공문' 없음, 2026-10-30)"); }

// ── V3 공개 스위치 (2026-10-29) ──
console.log('\n[V3] 공개 스위치');
{
  check(/var SHOW_V3 = false;/.test(land), 'SHOW_V3 = false (이번 작업은 꺼 둠)');
  const tpls = [...land.matchAll(/<template data-v3="(replace|insert)">([\s\S]*?)<\/template>/g)];
  check(tpls.length === 5, 'V3 template 5개 (번역팀 카드 1 · 10단계 · 회사 기억 · 품질 리포트 카드 · FAQ 1)');
  const inT = tpls.map(m => m[2]).join('\n');
  const outT = land.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const w of ['10단계', '귀사를 기억', '용어를 기억해', '별의 기사', '전용 용어집', '역번역', '판정'])
    check(inT.includes(w) && !outT.includes(w), `V3 문구 '${w}' — template 안에만 (스위치 꺼짐 = 화면·검색 미노출)`);
  check((inT.match(/<ol class="lp-flow10">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length === 10, 'V3 공정 10단계');
  check(/<span class="tag">예시<\/span>/.test(inT), "V3 가상 예시에 '예시' 표시");
  check(!/제출/.test(outT) && !/제출/.test(inT), "'제출' 표현 없음 (대상 독자·대상 시장)");
  const S1 = '<span class="t">문서 분석</span><span class="d">고객이 고른 분야와 문서 종류에 맞는 번역 기준을 적용합니다. 개인정보 번호는 자동으로 가려진 상태로 번역이 시작됩니다.</span>';
  check(outT.includes(S1) && inT.includes(S1), "1단계 '문서 분석' = 코드 기준 문구 (V2·V3 같음)");
  check(!/영국식|미국식|대상 시장|대상 독자|제출처|제출 국가/.test(html), "'영국식·미국식·대상 시장·대상 독자·제출처·제출 국가' 없음 (숨김·template 포함)");
  // 켜지는 조건 — 운영 주소는 ?v3=1 이 있어도 꺼짐, 브랜치 미리보기만 켜짐
  const sw = script.slice(script.indexOf('var SHOW_V3'), script.indexOf('/* 메인 랜딩 v2'));
  const run = (hostname, search, flag) => {
    let n = 0; const t = { getAttribute: () => 'insert', content: { cloneNode: () => ({}) }, parentNode: { replaceChild(){ n++; } } };
    const ctx = { location: { hostname, protocol: 'https:', search }, document: { documentElement: { setAttribute(){} }, querySelectorAll: () => [t] } };
    vm.createContext(ctx); vm.runInContext(flag ? sw.replace('SHOW_V3 = false', 'SHOW_V3 = true') : sw, ctx); return n;
  };
  check(run('iumm.kr', '?v3=1') === 0, '운영 iumm.kr + ?v3=1 → 꺼짐');
  check(run('iumm-site.pages.dev', '?v3=1') === 0, '운영 pages.dev + ?v3=1 → 꺼짐');
  check(run('site-v2-two-experts.iumm-site.pages.dev', '?v3=1') === 1, '미리보기 브랜치 + ?v3=1 → 켜짐');
  check(run('site-v2-two-experts.iumm-site.pages.dev', '') === 0, '미리보기 브랜치 기본 → 꺼짐');
  check(run('iumm.kr', '', true) === 1, 'SHOW_V3 = true → 운영에서 켜짐');
}

// ── 2026-10-30 디자인 개편 ──
console.log('\n[디자인] 대조 패널 · 글꼴 · 색 · 상담 버튼');
{
  const hero = land.slice(land.indexOf('<section class="lp-hero" id="top">'), land.indexOf('</section>', land.indexOf('<section class="lp-hero" id="top">')));
  const txt = (h) => h.replace(/<[^>]+>/g, '');
  const pane = (id) => { const m = hero.match(new RegExp('<div class="cmp-pane" id="cmp-p-' + id + '"[\\s\\S]*?<div class="cmp-col" lang="ko">[\\s\\S]*?<p class="cmp-s mb">([\\s\\S]*?)</p></div>\\s*<div class="cmp-col" lang="en">[\\s\\S]*?<p class="cmp-s mb">([\\s\\S]*?)</p></div>')); return m ? [m[1], m[2]] : ['', '']; };
  const EX = {
    contract: ['갑은 본 계약 체결일로부터 30일 이내에 계약금 5,000,000원을 을에게 지급한다.', 'Party A shall pay Party B a deposit of KRW 5,000,000 within 30 days from the date of execution of this Agreement.',
      [['갑', 'Party A'], ['을', 'Party B'], ['본 계약', 'this Agreement'], ['계약금', 'deposit']], [['30일', '30 days'], ['5,000,000원', 'KRW 5,000,000']]],
    game: ['전설의 검을 얻으려면 북쪽 성채의 수호자를 쓰러뜨려야 한다.', 'To obtain the Legendary Sword, you must defeat the Guardian of the Northern Citadel.',
      [['전설의 검', 'Legendary Sword'], ['북쪽 성채', 'Northern Citadel'], ['수호자', 'Guardian']], []],
    manual: ['전원 코드를 뽑고 10분이 지난 뒤 필터를 분리하십시오.', 'Unplug the power cord and wait 10 minutes before removing the filter.',
      [['전원 코드', 'power cord'], ['필터', 'filter']], [['10분', '10 minutes']]] };
  for (const [id, [ko, en, terms, nums]] of Object.entries(EX)) {
    const [k, e] = pane(id);
    const pairs = (cls, h) => Object.fromEntries([...h.matchAll(new RegExp('<span class="' + cls + '" data-k="(\\w)">([^<]+)</span>', 'g'))].map(m => [m[1], m[2]]));
    const tk = pairs('t', k), te = pairs('t', e), nk = pairs('n', k), ne = pairs('n', e);
    const got = (a, b) => Object.keys(a).map(x => [a[x], b[x]]).sort().join('|');
    check(txt(k) === ko && txt(e) === en && got(tk, te) === terms.slice().sort().join('|') && got(nk, ne) === nums.slice().sort().join('|'),
      `예시 ${id} — 문장 그대로 · 용어 짝 ${terms.length} · 숫자 짝 ${nums.length}`);
  }
  check(/<span class="cmp-tag">예시<\/span>/.test(hero) && (hero.match(/role="tab"/g) || []).length === 3 && /aria-selected="true">계약서</.test(hero) && /id="cmp-p-game"[^>]*hidden/.test(hero) && /id="cmp-p-manual"[^>]*hidden/.test(hero),
    "패널 '예시' 표시 · 탭 계약서/게임/매뉴얼 (기본 계약서, JS 없이도 계약서가 보임)");
  check(/\.lp-cmp \.t,\.lp-cmp \.n\{white-space:nowrap\}/.test(html), '대조 패널 밑줄·테두리 묶음(KRW 5,000,000 · 30 days 등)은 줄 중간에서 안 갈라짐');
  check(txt(hero.match(/<ul class="cmp-checks">[\s\S]*?<\/ul>/)[0]).replace(/\s+/g, ' ').trim() === '용어 일치 숫자 대조 최종 휴먼터치', '패널 아래 확인 3개 — 용어 일치 · 숫자 대조 · 최종 휴먼터치');
  check(hero.indexOf('id="lp-entry"') < hero.indexOf('id="lp-cmp"') && /@media\(min-width:1024px\)\{\s*\.lp-hero \.lp\{display:grid;grid-template-columns:minmax\(0,1\.2fr\) minmax\(0,1fr\)/.test(html) && /\.cmp-row\{grid-template-columns:1fr;gap:18px\}/.test(html),
    '데스크톱 = 글 왼쪽·패널 오른쪽 / 모바일 = 글 아래 패널, 원문 위·번역 아래');
  check(/\.lp-cmp \.t\{[^}]*background:linear-gradient\(var\(--v-gold\),var\(--v-gold\)\) no-repeat 0 100%\/100% 2px/.test(html) && /\.lp-cmp \.n\{[^}]*border:1px solid rgba\(15,37,64,0\.5\)/.test(html),
    '용어 = 골드 밑줄 · 숫자·금액·날짜 = 가는 테두리');
  const pj = (land.match(/<script>\s*\/\* 원문·번역 대조 패널[\s\S]*?<\/script>/) || [''])[0];
  check(/prefers-reduced-motion: reduce/.test(pj) && /if \(reduce\) return;\s*box\.classList\.add\('pre'\)/.test(pj) && /@media\(prefers-reduced-motion:reduce\)\{\.lp-cmp \*\{transition:none !important\}\}/.test(html),
    '움직임 줄이기 = 처음부터 완성 상태 (숨김 상태를 걸지 않음)');
  check(/getComputedStyle\(wrap\)\.opacity\) < 0\.99/.test(pj) && /run\('1'\)/.test(pj) && /if \(played\) run\('0\.45'\)/.test(pj) && /\.cmp-checks li:nth-child\(3\)\{transition-delay:calc\(1\.9s \* var\(--u\)\)\}/.test(html),
    '인트로가 끝나 첫 화면이 다 보일 때 한 번(약 2초) · 탭 전환은 0.45배로 짧게');
  check(/mouseover/.test(pj) && /closest\('\[data-k\]'\)/.test(pj) && /ArrowRight/.test(pj), '용어 짝 마우스·터치 강조 · 탭 화살표 키');
  // 움직임은 패널 안에서만 — 다른 랜딩 스크립트에 스크롤 연출 없음
  const lpCss = html.slice(html.indexOf('<!-- HERO -->'), html.indexOf('<!-- ── 인트로'));
  check(!/@keyframes|animation:/.test(lpCss.replace(/\.lp-cmp[^{]*\{[^}]*\}/g, '').replace(/@keyframes lp-(ul|st)\{from\{[^}]*\}to\{[^}]*\}\}/g, '').replace(/\.lp-field\.sel \.u\{animation:lp-ul [^}]*\}|\.lp-fd \.fd\.play \.lit s\{animation:lp-st [^}]*\}|@media\(prefers-reduced-motion:reduce\)\{\.lp-field\.sel[^}]*\}\}/g, '')),
    '랜딩 CSS 에 대조 패널·분야(밑줄·취소선) 밖 애니메이션 없음');

  // 글꼴 — 마루 부리 + Pretendard 두 가지만
  check(/@font-face\{font-family:'MaruBuri';font-style:normal;font-weight:400;font-display:swap;src:url\(https:\/\/hangeul\.pstatic\.net\/hangeul_static\/webfont\/MaruBuri\/MaruBuri-Regular\.woff2\) format\('woff2'\)\}/.test(html) &&
        /@font-face\{font-family:'MaruBuri';font-style:normal;font-weight:700;font-display:swap;src:url\(https:\/\/hangeul\.pstatic\.net\/hangeul_static\/webfont\/MaruBuri\/MaruBuri-Bold\.woff2\) format\('woff2'\)\}/.test(html) &&
        (html.match(/@font-face/g) || []).length === 2, '마루 부리 = 네이버 공식 배포처 woff2 · 400·700 두 굵기 · swap');
  check(!/Nanum|Noto Sans|fonts\.googleapis/.test(html) && html.includes('pretendardvariable-dynamic-subset.min.css'), '나눔명조·Noto Sans KR·Google Fonts 없음 — Pretendard + 마루 부리만');
  check(/\.lp-hero h1\{[^}]*font-size:64px;[^}]*line-height:1\.25/.test(html) && /\.lp-h2\{[^}]*font-size:40px;[^}]*line-height:1\.25/.test(html) && /\.lp-hero h1\{font-size:38px\}/.test(html) && /\.lp-h2,\.lp-final \.h\{font-size:28px\}/.test(html),
    '크기 — 첫 화면 제목 64/38 · 구역 제목 40/28 · 줄간격 1.25');
  check(/\.lp-flow10 li::before\{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var\(--v-gold\)\}/.test(html) && /\.lp-flow10 li\{position:relative;padding:0 0 30px 72px\}/.test(html) && !/\.lp-flow10 \.no\{[^}]*background/.test(html),
    '번역 과정 선 = 골드 2px 한 줄(단계 사이 여백이 li 안이라 끊김 없음) · 번호가 선을 가리지 않음');
  check(/\.lp-sub\{[^}]*max-width:40em;font-size:17px;[^}]*line-height:1\.75/.test(html), '본문 17px · 줄간격 1.75 · 폭 약 40자');
  // 색 · 모양
  check(!/box-shadow/.test(lpCss) && !/radial-gradient/.test(lpCss), '랜딩에 장식 그림자·방사 그라데이션 없음');
  check([...lpCss.matchAll(/border-radius:([^;}]+)/g)].every(m => /^(0|6px|6px 6px 0 0|50%)$/.test(m[1].trim())), '모서리 6px (버튼·탭), 원형은 확인 아이콘·이음 점만 (분야 칸은 0 = 둥근 상자 없음)');
  check(!/<(button|a)[^>]*>[^<]*→\s*<\/(button|a)>/.test(land) && !/검수자 선택하기 →/.test(html), "버튼·링크 글자에 '→' 없음");
  check(!/<span class="what">전문 번역가 검수<\/span>/.test(land),"프리미엄 플러스 부제 '전문 번역가 검수' 삭제 (배지는 유지)");
  check(land.includes('<span class="badge">전문 번역가 검수</span>'), '프리미엄 플러스 배지 유지');
  // 상담하기 버튼
  const fab = fs.readFileSync(path.resolve(HERE, '../assets/kakao-fab.js'), 'utf8');
  check(/<span>상담하기<\/span><\/button>/.test(fab) && /aria-expanded/.test(fab) && /\.fab-main\{[^']*background:#0F2540/.test(fab) && /a\.ntalk\{background:#03C75A/.test(fab) && /a\.kakao\{background:#FEE500/.test(fab) && /Escape/.test(fab) && !/box-shadow/.test(fab),
    "떠 있는 상담 버튼 = 남색 '상담하기' 하나 → 네이버 톡톡·카카오톡 두 경로 펼침 (Esc·바깥 누르면 닫힘)");
  check(html.includes('/assets/kakao-fab.js?v=5'), '상담 버튼 캐시 버전 v=5');
}

console.log('\n[공증] 고객 화면 정리 (2026-10-30)');
{
  const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
  const privAll = html.slice(html.indexOf('<div id="page-privacy"'), html.indexOf('<!-- 기업회원 추가 약관 페이지 -->'));
  const privBody = privAll.slice(privAll.indexOf('</div>', privAll.indexOf('privacy-revision-notice')));
  check(!/공증|아포스티유|등기|영사/.test(privBody), '개인정보처리방침 본문에 공증·아포스티유·등기·영사 없음');
  check(privAll.includes('<li>제1조 ④, 제3조, 제5조, 제6조, 제8조: 더 이상 제공하지 않는 서비스 관련 조항 삭제 (제1조 ⑤ 수집 방법 → ④)</li>') && privAll.includes('개정 사유: 무료 테스트 번역 기준 변경 (회사당 1회, 1,000자 이하), 더 이상 제공하지 않는 서비스 관련 조항 삭제, 문서 삭제 시점과 외부 처리 내용의 정확한 안내, 기업 문의 개인정보 처리 안내</li>') && !/공증/.test(privAll) && privBody.includes('④ 수집 방법') && !privBody.includes('⑤ 수집 방법'), "개정 안내 '더 이상 제공하지 않는 서비스 관련 조항 삭제'(공증 없음) · 번호 ⑤→④");
  // 2026-10-30 보안 마무리: 삭제 시점 = cron 실제(납품+21일 지난 뒤), '완전' 금지(Airtable 변경 기록 미확인), 수탁사별 학습·보관·가림, 국외 이전 문의처
  check((privBody.match(/납품 후 21일이 지나면 자동으로 삭제/g) || []).length === 3 && !/21일 이내|완전/.test(privBody), "처리방침 제1조 ③·제3조·제6조 = '납품 후 21일이 지나면 자동으로 삭제' · '21일 이내'·'완전' 없음");
  { const ai = (privBody.match(/<li id="privacy-5-ai">[^]*?<\/ul>/) || [''])[0], ocr = (privBody.match(/<li id="privacy-5-ocr">[^]*?<\/ul>/) || [''])[0];
    check(ai.includes('AI 학습에 사용하지 않습니다') && ai.includes('Anthropic PBC는 입력·출력을 기본 30일 안에 삭제합니다') && ai.includes('남용 감시 기록을 최대 30일 보관') && ai.includes('더 오래 보관될 수 있습니다') && ai.includes('AI에 보내기 전에 자동으로 가리고'), '제5조 AI 번역·검수 — 학습 안 함 · 보관 30일(예외) · 보내기 전 가림');
    check(ocr.includes('AI 학습에 사용하지 않습니다') && ocr.includes('이미지와 인식 결과를 저장하지 않고') && ocr.includes('원본 이미지가 가림 처리 없이 전송됩니다'), '제5조 문서 OCR — 학습 안 함 · 저장 안 함 · 원본 이미지 전송(가림은 AI 전)'); }
  { const c = (privBody.match(/<li id="privacy-6-contacts">[^]*?<\/ul>/) || [''])[0];
    check(['privacy@airtable.com', 'dsar@openai.com', 'dpo@openai.com', 'privacy@anthropic.com', 'privacy@railway.com', 'support.google.com/policies?p=privpol_privts'].every(s => c.includes(s)), '제6조 이전 받는 자별 문의처 (공식 문서 확인분)'); }
  check(privAll.includes("<li>제5조: AI 번역·검수, 문서 OCR(문자인식) 수탁사별 AI 학습 사용 여부, 수탁사 측 보관 기간, 보내기 전 처리(개인정보 번호 가림) 명시</li>") && privAll.includes('<li>제6조: 이전 받는 자별 개인정보 문의처 추가</li>') && (privAll.match(/공고일: 2026년 10월 30일 &nbsp;\|&nbsp; 시행일: 2026년 11월 6일/g) || []).length === 1 && privAll.includes('공지일: 2026년 10월 30일 &nbsp;|&nbsp; 시행일: <span class="highlight">2026년 11월 6일</span>') && privBody.includes('변경 시 시행 7일 전 서비스 내 공지합니다'), '개정 안내 — 삭제 시점·제5조·제6조 항목 · 공고 10-30 · 시행 11-06 (제11조 7일 전 공지)');
  check(!/서버에서 완전히 삭제|회원 정보 완전 삭제/.test(html) && !/완전히 삭제/.test(fs.readFileSync(path.resolve(HERE, '../notary/edit.html'), 'utf8')), "고객 화면 '완전히 삭제' 없음 → '자동으로 삭제'");
  const outside = strip(html).replace(privAll, '');
  check(!/공증|아포스티유|번역공증|사본공증|등기/.test(outside), '메인 index.html(개인정보 개정 안내 밖)에 공증·아포스티유·등기 없음');
  check(!/loadMyNotaryOrders|my-notary|_ntr|openNotaryOrder|\/api\/notary/.test(html), '마이페이지 공증 주문 목록·스크립트 없음');
  check(!fs.existsSync(path.resolve(HERE, '../notary/index.html')) && fs.existsSync(path.resolve(HERE, '../notary/edit.html')), '고객 공증 입구(notary/index.html) 삭제 · 관리자 공증 도구가 여는 edit.html 유지');
  const rd = fs.readFileSync(path.resolve(HERE, '../_redirects'), 'utf8');
  check(['/notary / 301', '/notary/ / 301', '/notary/index.html / 301'].every(l => rd.split(/\r?\n/).includes(l)) && !/edit/.test(rd.replace(/^#.*$/m, '')), '_redirects — /notary/ → / 301 (edit.html 은 그대로)');
  check(!fs.existsSync(path.resolve(HERE, '../legal/terms-2026-10-22.html')) && !fs.existsSync(path.resolve(HERE, '../legal/privacy-2026-10-22.html')), '2026-10-22 보관본은 공개 사이트에서 내림 (내부 보관)');
  check(!/notary/i.test(fs.readFileSync(path.resolve(HERE, '../sitemap.xml'), 'utf8')), 'sitemap 에 공증 없음');
}

console.log('\n[보안] 파일 올리기에 로그인 토큰 (2026-10-30, 서버 upload_guard.js)');
{
  const calls = [...html.matchAll(/fetch\(([^;]*?(?:\/api\/customer\/ocr|EXTRACT_API|\/api\/order\/attach-source-files|\/api\/upload-reference)[^;]*?)\)/g)].map(m => m[1]);
  check(calls.length === 7 && calls.every(c => c.includes('uploadAuthHeaders(')), `고객 화면 OCR·원문 추출·원문 첨부·참고자료 호출 ${calls.length}곳 모두 카카오 토큰(uploadAuthHeaders)`);
  check(/function uploadAuthHeaders\(\)\{\s*var t=\(typeof Kakao!=='undefined'&&Kakao\.Auth&&Kakao\.Auth\.getAccessToken\)\?Kakao\.Auth\.getAccessToken\(\):null;\s*return t\?\{'Authorization':'Bearer '\+t\}:\{\};/.test(html), 'uploadAuthHeaders = 카카오 access token → Authorization: Bearer');
  const admin = fs.readFileSync(path.resolve(HERE, '../admin/index.html'), 'utf8');
  const ac = [...admin.matchAll(/fetch\(([^;]*?(?:BP_EXTRACT_API|\/api\/order\/attach-source-files|\/api\/admin\/upload-reference)[^;]*?)\)/g)].map(m => m[1]);
  check(ac.length === 3 && ac.every(c => c.includes("'Authorization': 'Bearer ' + adminToken(")), `관리자 화면 원문 추출·원문 첨부·참고자료 ${ac.length}곳 관리자 토큰`);
  check(html.includes('id="upload-relogin-notice"') && html.includes('보안을 위해 다시 로그인해 주세요.') && html.includes('>카카오로 다시 로그인</button>'), '토큰 없음·만료 → 주문 창 안 다시 로그인 안내 (동작은 verify_upload_relogin.mjs)');
}

console.log('\n[기업 문의] 처리방침·양식 문구 — 접수 후 21일 삭제 (2026-10-30)');
{
  const s12 = html.indexOf('id="privacy-1-2"'); const sec = html.slice(s12, html.indexOf('<h2>제2조', s12));
  check(/수집 항목: \(필수\) 회사명, 담당자명, 이메일 \/ \(선택\) 직책, 전화번호/.test(sec) && sec.includes('번역 언어, 주요 용어·분야, 계약 형태, 매월 예상 분량, 추가 요청사항'), '제1조의2 수집 항목 = 실제 양식 입력란');
  check(sec.includes('이용 목적: 견적·상담') && sec.includes('접수 후 21일이 지나면 자동으로 삭제'), '목적 견적·상담 · 보유 접수 후 21일');
  check(html.includes('기업 문의 기록: 접수 후 21일이 지나면 자동으로 삭제'), '제3조 보유 기간');
  check(html.includes('문의 내용은 견적·상담에만 사용되며, 접수 후 21일이 지나면 자동으로 삭제됩니다.') && !html.includes('영업 목적으로만'), '기업 문의 양식 문구가 처리방침과 같음');
  const notice = html.slice(html.indexOf('id="privacy-revision-notice"'), html.indexOf('이전 개인정보처리방침 보기'));
  check(notice.includes('id="privacy-rev-biz"') && notice.includes('시행일: <span class="highlight">2026년 11월 6일</span>'), '개정 안내에 기업 문의 항목 · 시행일 2026-11-06(공고 10-30 + 7일)');
  check(!/완전 삭제|완전히 삭제/.test(sec), "'완전 삭제' 표현 없음");
}

// ── 8. FAQ 낡은 문구 ──

console.log(`
${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
