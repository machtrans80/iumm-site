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

// ── 1. SINCE 라벨 — 고정 문구 (연차 계산 없음) ──
console.log('\n[1] 첫 화면 라벨 — SINCE 2009');
const script = land.match(/<script>([\s\S]*?)<\/script>/)[1];
const els = {};
const sandbox = { window: {}, isLoggedIn: false, sessionStorage: { setItem(){} }, showPage(){}, location: {},
  document: { getElementById: (id) => (els[id] = els[id] || { textContent: '' }) } };
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
check(/<p class="lp-label">SINCE 2009 · 번역·공증·아포스티유<\/p>\s*<h1>/.test(land), 'h1 위 라벨 "SINCE 2009 · 번역·공증·아포스티유"');
check(!/lp-since|lpYears|년째/.test(land), '옛 문장(N년째)·lpYears 스크립트 없음');

// ── 2. 전문 번역 단가 — PLAN_PRICE 한 곳 ──
console.log('\n[2] 전문 번역 단가 단일 출처');
check(sandbox.PLAN_PRICE && sandbox.PLAN_PRICE.ai === 25 && sandbox.PLAN_PRICE.standard === 40, 'PLAN_PRICE = { ai:25, standard:40 }');
check(els['lp-plan-price'].textContent === '25원부터', '카드 금액 = PLAN_PRICE.ai');
check(!/currentPlan\s*===?\s*["']ai["']\s*\?\s*25\s*:\s*40/.test(html), '주문 모달 25:40 하드코딩 없음');
check(!/_memberRate(Ai|Pp)\s*\|\|\s*(25|40)\)/.test(html), '견적 기본 단가 하드코딩 없음');

// ── 3. 구성 ──
console.log('\n[3] 구성 — 누구에게나 같은 화면');
check(land.includes('공증 받으러<br>멀리 가지 마세요') && !html.includes('서울까지'), '제목');
check(land.includes('서류만 올리시면 번역부터 공증·아포스티유까지 마치고 집으로 보내드립니다.'), '부제');
check((land.match(/class="lp-card[ "]/g) || []).length === 2 && land.includes('lp-card main'), '카드 2개 · 1번 강조');
check(land.includes("onclick=\"lpGo('notary')\">번역공증 · 아포스티유 시작<"), '1번 버튼 → 위저드');
check(land.includes('<button type="button" class="lp-btn pro-btn" onclick="handleAI()">전문 번역 시작</button>') && land.includes('<div class="lp-card pro">'), '2번 카드 pro · 버튼 → 전문 번역 모달 (채운 버튼)');
check(['.lp-card.pro{border:2px solid #6FB8F0;background:rgba(111,184,240,0.08)}', '.lp-card.pro:hover{background:rgba(111,184,240,0.12);border-color:#9ACDF5}',
       '.lp-card.pro .k .no{border-color:#9ACDF5;color:#9ACDF5}', '.lp-card.pro li::before{background:#9ACDF5}', '.lp-card.pro .lp-big .n{color:#9ACDF5}',
       '.lp-btn.pro-btn{background:#6FB8F0;border-color:#6FB8F0;color:#06202f}', '.lp-btn.pro-btn:hover{background:#9ACDF5'].every(x => land.includes(x)),
  '전문 번역 카드 색 (#6FB8F0 / #9ACDF5) · 번호 원·점·가격·채운 버튼');
check(!/사법공조|진술조서|수사·법률|수사 서류|lpGo\('quote'\)/.test(html), 'index.html 전체에 기밀 서류명·견적 링크 없음');
check(['가족관계·기본·혼인 번역', '5,000원', '생활기록부 번역 · 쪽당</span><span class="n">9,000원', '그 외 서류 쪽당 9,000원 · 부가세 별도', '급행이면 다음 영업일 수령 (영업일 기준 예정)',
       '신분증·여권 사본공증 + 아포스티유도 가능'].every(t => land.includes(t)), '1번 카드 문구');
check(['번역의 기준이 바뀌었습니다', '분야별 용어집으로 번역하고, 용어·숫자·누락을 점검한 뒤, 최종 휴먼터치로 완성도를 높여 납품합니다.',
       '(부가세 별도)'].every(t => land.includes(t)), '2번 카드 문구');
check((land.match(/<details>/g) || []).length === 5 && land.includes("showPage('faq')"), 'FAQ 5개 + 전체 보기');
check(land.includes('3단계면 끝납니다'), '3단계 안내');
check(land.includes('맡길 수 있는 서류: 가족관계·기본·혼인증명서, 생활기록부, 졸업·성적증명서, 재직증명서, 정관, 신분증·여권 사본 등<'), '맡길 수 있는 서류 한 줄');
check(!/lp-in|lpApplyLogin|lp-member|lp-join|카카오로 시작하기/.test(land), '회원 전용·가입 유도 블록 없음');

// ── 4. 금지 표현 ──
console.log('\n[4] 금지 표현');
const visible = land.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/\bAI\b|인공지능|스마트/.test(visible.replace(/PLAN_PRICE\.ai|ai\s*:|handleAI|'ai'/g, '')), 'AI·인공지능·스마트 없음');
check(!/gradient|box-shadow|glow|@keyframes|animation:/.test(visible), '그라데이션·글로우·자동 애니메이션 없음');
check(!/✦|[\u{1F300}-\u{1FAFF}]|[☀-➿]/u.test(visible), '✦·이모지 없음');
check(!html.includes('✦'), 'index.html 전체 ✦ 없음');
check(!/최고|최저|최초|유일|1위|완벽/.test(visible), '최상급 표현 없음');
{
  // 고객 화면 "AI" — 약관·처리방침(법정 고지)과 결제 payload 의 내부 플랜값('AI 프리미엄')은 제외
  const noLegal = html.replace(/<div id="page-(terms|privacy|biz-terms)"[\s\S]*?<\/div>\s*<\/div>\s*(?=<)/g, '');
  const lines = noLegal.split('\n').map(l => l.replace(/\/\/.*$/, '').replace(/<!--.*?-->/g, '').replace(/\/\*.*?\*\//g, ''))
    .filter(l => /\bAI\b|인공지능/.test(l) && !/플랜:\s*currentPlan/.test(l) && !/AI 기반 전문 번역 플랫폼|AI 번역·검수 처리/.test(l));
  check(lines.length === 0, `고객 화면 "AI" 0건${lines.length ? ' — ' + lines.map(l => l.trim().slice(0, 60)).join(' | ') : ''}`);
}
check(!/마지막 문장까지|직접 검수|직접 대조|원문과 대조/.test(html), '전문 번역 — 마지막 문장까지·직접 검수·직접 대조 표현 없음 (index.html 전체)');
check(html.includes('최종 휴먼터치로 번역의 완성도를 높이는 IUMM 전문 번역사입니다') &&
      html.includes('번역이 끝나면 최종 휴먼터치로 완성도를 높여 납품합니다.'), '전문 번역사 부제·검수 안내 = 최종 휴먼터치');

// ── 5. 전문 번역 주문 창 — 톤 (표시만) ──
console.log('\n[5] 전문 번역 주문 창');
{
  const m0 = html.indexOf('<!-- 스탠다드 주문 모달 -->'), m1 = html.indexOf('<!-- 계좌입금 안내 모달');
  const modal = html.slice(m0, m1);
  check(/<button id="tab-free"[^>]*>무료체험<\/button>/.test(modal) && /<button id="tab-ai"[^>]*>스탠다드<\/button>/.test(modal) &&
        /<button id="tab-standard"[^>]*>프리미엄 플러스<\/button>/.test(modal) && modal.includes('id="plan-desc"'),
    '탭 = 무료체험 / 스탠다드 / 프리미엄 플러스 + 설명 줄');
  check(!/#c9a84c|201,\s*168,\s*76|#d97706|217,\s*119,\s*6|#97c459|99,\s*153,\s*34|linear-gradient|box-shadow/.test(modal), '주문 창 금색·그라데이션·그림자 없음');
  check(!/[\u{1F300}-\u{1FAFF}]|⚠|✏|✓|✗|⏱/u.test(modal), '주문 창 이모지 없음 (닫기 ✕만)');
  const conf = html.slice(html.indexOf('function showPaymentConfirmModal'), html.indexOf('function showPaymentConfirmModal') + 6000);
  check(!/⚠|✓|✗|201,168,76|linear-gradient/.test(conf), '결제 전 최종 확인 창 이모지·금색 없음');
  check(/#tab-free,#tab-ai,#tab-standard\{font-size:13px/.test(html), '모바일 탭 13px (한 줄)');
}
{
  const faqNew = '영문으로 발급받으시면 번역·공증 없이 아포스티유만 받으실 수 있습니다. 제출처가 한글본 번역공증을 요구하면 번역공증도 가능합니다.';
  check(html.split(faqNew).length - 1 === 2 && !/자동으로 아포스티유 단독으로 안내|서류를 고르시면 자동으로 안내/.test(html),
    'FAQ "영문으로 발급되는 서류" 2곳 교체 · 자동 안내 문장 삭제');
}

// ── 7. 전문 번역 과정 섹션 ──
console.log('\n[7] 전문 번역 과정 섹션');
{
  const pa = land.indexOf('id="process"'), pb = land.indexOf('id="process-pro"'), pc = land.indexOf('id="faq-summary"');
  check(pa > 0 && pb > pa && pc > pb, '위치 — 공증 3단계(#process) 바로 아래, FAQ 위');
  check(/id="process">\s*<div class="lp">\s*<p class="lp-label">번역공증 · 아포스티유<\/p>\s*<h2 class="lp-h2">3단계면 끝납니다<\/h2>/.test(land) && !land.includes('HOW IT WORKS'),
    '공증 3단계 라벨 "번역공증 · 아포스티유" (HOW IT WORKS 없음)');
  const sec = land.slice(pb, pc);
  check(sec.includes('<p class="lp-label">전문 번역</p>') && sec.includes('용어는 끝까지 같게, 숫자는 하나도 틀리지 않게'), '라벨·제목');
  check(['<div class="t">올리기</div><div class="d">파일을 올리거나 붙여 넣으면 글자 수와 금액이 바로 나옵니다.',
         '<div class="t">분야별 번역</div><div class="d">문서 분야에 맞는 전용 용어집을 기준으로 번역합니다.',
         '<div class="t">점검</div><div class="d">용어가 문서 전체에서 같은지, 숫자·날짜·이름이 정확한지, 빠진 문장은 없는지 확인합니다.',
         '<div class="t">휴먼터치 · 납품</div><div class="d">최종 휴먼터치로 자연스럽게 다듬어 마이페이지로 납품하고, 알림톡으로 알려 드립니다.'].every(x => sec.includes(x)) &&
        (sec.match(/class="lp-step"/g) || []).length === 4, 'STEP 1~4 문구');
  check(sec.includes('class="lp-steps four"') && land.includes('.lp-steps.four{grid-template-columns:repeat(4,1fr)}') &&
        /max-width:1024px\)\{\s*\.lp-steps\.four\{grid-template-columns:repeat\(2,1fr\)\}/.test(land) && /\.lp-steps\.four\{grid-template-columns:1fr\}/.test(land),
    '그리드 PC 4열 / 태블릿 2열 / 모바일 1열');
  // 금액 — PLAN_PRICE 에서 채운다 (하드코딩 금지)
  check(!/글자당\s*<b>\s*\d/.test(sec) && sec.includes('data-plan="ai"') && sec.includes('data-plan="standard"'), '플랜 금액 하드코딩 없음 (data-plan)');
  const plans = ['ai', 'standard'].map(k => ({ k, t: '', getAttribute(){ return this.k; }, set textContent(v){ this.t = v; } }));
  const sb2 = { window: {}, isLoggedIn: false, sessionStorage: { setItem(){} }, showPage(){}, location: {},
    document: { getElementById: () => null, querySelectorAll: (q) => q === '[data-plan]' ? plans : [] } };
  vm.createContext(sb2); vm.runInContext(script, sb2);
  check(plans[0].t === sb2.PLAN_PRICE.ai && plans[1].t === sb2.PLAN_PRICE.standard, `플랜 금액 = PLAN_PRICE (${plans[0].t} / ${plans[1].t})`);
  check(sec.includes('스탠다드 <span>(일반 검수)</span>') && sec.includes('프리미엄 플러스 <span>(전문가 검수)</span>') &&
        sec.includes('제출·계약용 문서는 프리미엄 플러스를 권합니다.') && sec.includes('부가세 별도'), '플랜 이름·권장 문구·부가세 별도');
  check(sec.includes('명백한 오역은 납품 후 5일 이내 무료로 다시 번역해 드립니다.') &&
        /무료 재번역 또는 A\/S\(품질수정\)/.test(html) && /납품일로부터 <span class="highlight">5일 이내<\/span>/.test(html),
    '신뢰 문구 — 약관 제7조(5일 이내 무료 재번역)와 일치');
  check(sec.includes('<button type="button" class="lp-btn pro-btn" onclick="handleAI()">전문 번역 시작</button>'), '버튼 → handleAI() · 첫 화면 전문 번역 버튼과 같은 스타일');
  check(land.includes('.lp-sec.pro-sec .lp-label{color:#9ACDF5}') && land.includes('.pro-sec .lp-step .no{color:#9ACDF5}'), '하늘색 계열 — 라벨·STEP 번호');
  const vis = sec.replace(/<!--[\s\S]*?-->/g, '');
  check(!/\bAI\b|자동\s?번역|엔진|모델|인공지능|최고|최저|유일|협력|검수자|단계 수/.test(vis), '금지 표현 없음 (AI·자동번역·엔진·모델·최상급·협력·내부 공정)');
}

// ── 9. 공증 3단계 시작 버튼 ──
console.log('\n[9] 공증 3단계 — 시작 버튼');
{
  const ps = land.slice(land.indexOf('id="process"'), land.indexOf('id="process-pro"'));
  check(/<\/div>\s*<div class="lp-pro-act">\s*<p class="lp-trust">급행이면 다음 영업일에 받으실 수 있습니다 \(영업일 기준 예정\)\.<\/p>\s*<button type="button" class="lp-btn" onclick="lpGo\('notary'\)">번역공증 · 아포스티유 시작<\/button>\s*<\/div>/.test(ps),
    '.lp-steps 아래 안내 한 줄 + [번역공증 · 아포스티유 시작] → lpGo(notary), 민트 채운 버튼');
}

// ── 8. FAQ 낡은 문구 ──
console.log('\n[8] FAQ 문구 정리');
{
  const plain = html.replace(/<[^>]+>/g, '');
  check(html.includes('온라인 발급본이 없는 서류는 카카오톡으로 문의해 주시면 진행 방법을 안내해 드립니다. 신분증·여권 사본공증은 원본을 빠른등기로 보내 주시면 공증 후 함께 돌려드립니다.') &&
        !html.includes('온라인 발급이 없는 서류와 신분증·여권 사본공증은 원본을 빠른등기로'), '"직접 가지 않아도" 답변 — 카카오 문의 · 사본공증만 원본 우편');
  check(plain.includes('메인 화면의 전문 번역 의뢰에서') && !plain.includes('번역만 필요하신가요?에서'), '전체 FAQ — "메인 화면의 전문 번역 의뢰에서"');
  check(!/은행잔고증명서, 예방접종증명서\(유학\), 사업자등록증명, 법인등기부등본, 정관/.test(html) &&
        html.includes('재무제표처럼 온라인 발급본이 없는 서류는 카카오톡으로 문의해 주시면 진행 방법을 안내해 드립니다.'),
    '전체 FAQ 접수 서류 목록 — 카카오 문의 서류 분리');
}

// ── 6. 로고 — 메인·푸터·공증 화면 같은 모양 ──
console.log('\n[6] 로고');
{
  const LOGO = '<span class="lg-en">IUMM</span><span class="lg-ko">아이움</span>';
  const css = fs.readFileSync(path.resolve(HERE, '../notary/notary.css'), 'utf8');
  const wz = fs.readFileSync(path.resolve(HERE, '../notary/index.html'), 'utf8') + fs.readFileSync(path.resolve(HERE, '../notary/edit.html'), 'utf8');
  check(/class="nav-logo"[^>]*>\s*<span class="lg-en">IUMM<\/span><span class="lg-ko">아이움<\/span>/.test(html) &&
        html.includes('<div class="footer-logo" style="margin-bottom:8px">' + LOGO), '메인 내비·푸터 로고 마크업');
  check(wz.split('class="logo">' + LOGO).length - 1 === 2, '공증 신청·서류 보완(edit) 로고 마크업');
  check(/\.lg-en\{color:var\(--mint-light\);font-weight:800;letter-spacing:0\.14em\}/.test(html) &&
        /\.lg-ko\{color:rgba\(255,255,255,0\.9\);font-weight:500;font-size:calc\(1em - 2px\);letter-spacing:0;margin-left:8px\}/.test(html),
    '메인 로고 스타일 (#5DE0BC 800 0.14em / 흰 90% 500 -2px 8px)');
  check(/\.ntr-nav \.logo \.lg-en\{color:var\(--gold-light\);font-weight:800;letter-spacing:0\.14em\}/.test(css) &&
        /\.ntr-nav \.logo \.lg-ko\{color:rgba\(255,255,255,0\.9\);font-weight:500;font-size:calc\(1em - 2px\)/.test(css),
    '공증 로고 스타일 (--gold-light = #5DE0BC)');
  check(!/gradient|animation/.test((html.match(/\.nav-logo[^{]*\{[^}]*\}/g) || []).join('') + (css.match(/\.ntr-nav \.logo[^{]*\{[^}]*\}/g) || []).join('')),
    '로고 그라데이션·애니메이션 없음');
}

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
