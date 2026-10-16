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
check(/<p class="lp-label"><span class="en">SINCE 2009<\/span> · 번역·공증·아포스티유<\/p>\s*<h1>/.test(land), 'h1 위 라벨 "SINCE 2009 · 번역·공증·아포스티유"');
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
check(land.includes('<p class="lp-lead">서류만 올려 주시면 번역부터 공증·아포스티유까지 모두 마쳐 댁으로 보내 드립니다.</p>'), '부제');
check((land.match(/class="lp-card[ "]/g) || []).length === 2 && land.includes('lp-card main'), '카드 2개 · 1번 강조');
check(land.includes("<button type=\"button\" class=\"lp-btn\" onclick=\"lpGo('notary')\">번역공증 · 아포스티유 신청하기</button>"), '1번 버튼 → 위저드');
check(land.includes('<button type="button" class="lp-btn pro-btn" onclick="handleAI()">전문 번역 의뢰하기</button>') && land.includes('<div class="lp-card pro">'), '2번 카드 pro · 버튼 → 전문 번역 모달 (채운 버튼)');
check(['.lp-card.pro{border:2px solid #6FB8F0;background:rgba(111,184,240,0.06)}', '.lp-card.pro:hover{background:rgba(111,184,240,0.12);border-color:#9ACDF5}',
       '.lp-card.pro li::before{background:#9ACDF5}', '.lp-card.pro .lp-big .n{color:#9ACDF5}',
       '.lp-btn.pro-btn{background:#6FB8F0;border-color:#6FB8F0;color:#06202f}', '.lp-btn.pro-btn:hover{background:#9ACDF5'].every(x => land.includes(x)),
  '전문 번역 카드 색 (#6FB8F0 / #9ACDF5) · 점·가격·채운 버튼');
check(!/class="no">\d<\/span>/.test(land) && !land.includes('.lp-card .k .no{') && land.includes('<p class="k">번역공증 · 아포스티유 의뢰</p>') && land.includes('<p class="k">전문 번역 의뢰</p>'),
  '카드 번호 원 삭제 · 카드 제목 유지');
check(!/사법공조|진술조서|수사·법률|수사 서류|lpGo\('quote'\)/.test(html), 'index.html 전체에 기밀 서류명·견적 링크 없음');
check(['<span class="s">가족관계·기본·혼인증명서 번역</span><span class="n">5,000원</span>', '<span class="s">생활기록부 번역 (1페이지)</span><span class="n">9,000원</span>',
       '<li>그 외 서류 1페이지 9,000원</li>', '<li>급행 접수 시 다음 영업일 수령</li>', '<li>신분증·여권 사본공증 및 아포스티유</li>',
       ">번역공증 · 아포스티유 신청하기</button>"].every(t => land.includes(t)), '1번 카드 문구 · 버튼 "번역공증 · 아포스티유 신청하기"');
check(['<h3>비즈니스·학술 문서를 위한 전문 번역</h3>', '분야별 전용 용어집으로 번역하고 용어·숫자·누락을 점검한 뒤, 최종 휴먼터치로 완성해 납품합니다.',
       '<span class="n" id="lp-plan-price">25원부터</span></p>', 'onclick="handleAI()">전문 번역 의뢰하기</button>'].every(t => land.includes(t)), '2번 카드 문구 · 버튼 "전문 번역 의뢰하기"');
check((land.match(/<details>/g) || []).length === 5 && land.includes("showPage('faq')"), 'FAQ 5개 + 전체 보기');
check(land.includes('<h2 class="lp-h2">신청부터 수령까지, 세 단계면 충분합니다</h2>') &&
      ['<div class="t">서류 업로드</div><div class="d">필요한 서류를 선택하고 정부 사이트에서 발급받은 PDF를 올려 주세요. 발급 방법도 함께 안내해 드립니다.</div>',
       '<div class="t">일정 확인 · 결제</div><div class="d">받으실 날짜를 선택하시면 일정과 금액을 바로 확인하실 수 있습니다.</div>',
       '<div class="t">댁에서 수령</div><div class="d">공증 서류 스캔본을 마이페이지로 먼저 보내 드리고, 실물은 등기로 발송합니다.</div>'].every(t => land.includes(t)), '공증 3단계 제목·STEP 문구');
check(!land.includes('lp-seo') && !land.includes('맡길 수 있는 서류:'), '맨 아래 "맡길 수 있는 서류" 한 줄 삭제');
check(/>전문 번역<\/a>/.test(html) && !/>전문번역<\/a>/.test(html), '메뉴 "전문 번역" (PC·모바일)');
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
  check(/id="process">\s*<div class="lp">\s*<p class="lp-label">번역공증 · 아포스티유<\/p>\s*<h2 class="lp-h2">신청부터 수령까지, 세 단계면 충분합니다<\/h2>/.test(land) && !land.includes('HOW IT WORKS'),
    '공증 3단계 라벨 "번역공증 · 아포스티유" (HOW IT WORKS 없음)');
  const sec = land.slice(pb, pc);
  check(sec.includes('<p class="lp-label">전문 번역</p>') && sec.includes('용어는 끝까지 같게, 숫자는 하나도 틀리지 않게'), '라벨·제목');
  check(['<div class="t">파일 업로드</div><div class="d">파일을 올리거나 텍스트를 붙여 넣으시면 글자 수와 금액이 바로 산출됩니다.',
         '<div class="t">분야별 번역</div><div class="d">문서 분야에 맞는 전용 용어집을 기준으로 번역합니다.',
         '<div class="t">정밀 점검</div><div class="d">용어가 문서 전체에서 같은지, 숫자·날짜·이름이 정확한지, 빠진 문장은 없는지 확인합니다.',
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
        sec.includes('<p class="lp-pro-note">공식 제출·계약 문서에는 프리미엄 플러스를 권해 드립니다.</p>'), '플랜 이름·권장 문구 (부가세 문구 없음)');
  check(sec.includes('<p class="lp-trust">납품 후 5일 이내, 명백한 오역은 무상으로 재번역해 드립니다.</p>') &&
        /무료 재번역 또는 A\/S\(품질수정\)/.test(html) && /납품일로부터 <span class="highlight">5일 이내<\/span>/.test(html),
    '신뢰 문구 — 약관 제7조(5일 이내 무료 재번역)와 일치');
  check(sec.includes('<button type="button" class="lp-btn pro-btn" onclick="handleAI()">전문 번역 의뢰하기</button>'), 'CTA 띠 버튼 → handleAI() · 첫 화면 전문 번역 버튼과 같은 스타일');
  check(sec.includes('<button type="button" class="lp-plan" onclick="handleAI()"><span class="nm">스탠다드') &&
        sec.includes('<button type="button" class="lp-plan" onclick="handleStandard()"><span class="nm">프리미엄 플러스') &&
        (sec.match(/<span class="go">이 플랜으로 의뢰 →<\/span>/g) || []).length === 2 &&
        land.includes('.lp-plan:hover{border-color:#9ACDF5') && land.includes('.lp-plan:focus-visible{outline:2px solid #9ACDF5') && /\.lp-plan\{[^}]*cursor:pointer/.test(land),
    '플랜 박스 = 버튼 (스탠다드 → handleAI · 프리미엄 플러스 → handleStandard) · "이 플랜으로 의뢰 →" · hover·키보드');
  check(land.includes('.lp-pro-act{margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px 24px;padding:20px 24px;border-radius:12px;border:1px solid rgba(22,184,148,0.35);background:rgba(22,184,148,0.06)}') &&
        land.includes('.pro-sec .lp-pro-act{border-color:rgba(111,184,240,0.35);background:rgba(111,184,240,0.06)}') &&
        land.includes('.lp-pro-act .lp-trust{margin:0;font-size:16px;color:rgba(255,255,255,0.85)') &&
        /\.lp-pro-act\{flex-direction:column;align-items:stretch/.test(land) && land.includes('.lp-pro-act .lp-btn{width:100%}'),
    'CTA 띠 — 섹션 색 6% · 1px · 12px · 20px 24px · 문구 16px 흰 85% · 모바일 세로 · 버튼 전체 폭');
  check(land.includes('.lp-sec.pro-sec .lp-label{color:#9ACDF5}') && land.includes('.pro-sec .lp-step .no{color:#9ACDF5}'), '하늘색 계열 — 라벨·STEP 번호');
  const vis = sec.replace(/<!--[\s\S]*?-->/g, '');
  check(!/\bAI\b|자동\s?번역|엔진|모델|인공지능|최고|최저|유일|협력|검수자|단계 수/.test(vis), '금지 표현 없음 (AI·자동번역·엔진·모델·최상급·협력·내부 공정)');
}

// ── 9. 공증 3단계 시작 버튼 ──
console.log('\n[9] 공증 3단계 — 시작 버튼');
{
  const ps = land.slice(land.indexOf('id="process"'), land.indexOf('id="process-pro"'));
  check(/<\/div>\s*<div class="lp-pro-act">\s*<p class="lp-trust">급행 접수 시 다음 영업일에 받아 보실 수 있습니다\.<\/p>\s*<button type="button" class="lp-btn" onclick="lpGo\('notary'\)">번역공증 · 아포스티유 신청하기<\/button>\s*<\/div>/.test(ps),
    'CTA 띠 — "급행 접수 시…" + [번역공증 · 아포스티유 신청하기] → lpGo(notary)');
  check(html.includes(`<button class="nav-cta" id="nav-order-btn" onclick="lpGo('notary')">번역공증 신청</button>`) &&
        html.includes(`onclick="document.getElementById('nav-mobile-menu').classList.remove('open');lpGo('notary')">번역공증 신청</button`) &&
        !html.includes("location.href='/notary/'"), '상단 번역공증 신청(PC·모바일) → lpGo(notary)');
  check(html.includes('<a href="https://pf.kakao.com/_BlpKX/chat" target="_blank" rel="noopener noreferrer">고객센터</a>'), '푸터 고객센터 → 카카오 채널 새 창');
}

// ── 10. 금색 '번역공증 신청' 떠 있는 버튼 삭제 ──
console.log('\n[10] 떠 있는 버튼 — 카카오톡 문의만');
check(!/iumm-fab|fabGlow|fab-ico|fab-txt|◆ ?<\/span><span class="fab-txt">번역공증 신청/.test(html), '금색 번역공증 신청 버튼·CSS(iumm-fab·fabGlow) 없음');
check(html.includes('<script src="/assets/kakao-fab.js?v=3" defer></script>'), '카카오톡 문의 버튼(공통 조각)은 그대로');

// ── 11. 메인 보이는 영역 — 부가세·단서 문구 없음 (조건은 결제 단계에서만) ──
console.log('\n[11] 메인 — 부가세 문구 없음');
{
  // 보이는 영역 = 랜딩(첫 화면·카드·3단계·전문 번역·메인 FAQ·서류 한 줄). 스크립트·스타일·주석 제외
  const vis = land.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  check(!/부가세/.test(vis), `메인 보이는 영역 "부가세" 0건 (${(vis.match(/부가세/g) || []).length}건)`);
  const faqSum = land.slice(land.indexOf('id="faq-summary"'));
  check(/얼마나 걸리나요\?<\/summary><p>[^<]*\(영업일 기준 예정\)/.test(faqSum), '메인 FAQ "얼마나 걸리나요?"의 (영업일 기준 예정)은 유지');
  check(faqSum.includes('<summary>비용은 얼마인가요?</summary><p>번역 비용은 가족관계·기본·혼인증명서 각 5,000원, 그 외 서류 1페이지 9,000원입니다. 공증·아포스티유를 포함한 금액은 서류를 올리시면 바로 확인하실 수 있습니다.</p>'), '메인 FAQ "비용은" 답변 — 새 문구 · 부가세 문구 없음');
  check(!faqSum.includes('결제 후 취소할 수 있나요?') && faqSum.includes('<summary>어떤 서류를 맡길 수 있나요?</summary><p>가족관계·기본·혼인증명서, 생활기록부, 졸업·성적증명서, 재직증명서, 정관, 신분증·여권 사본 등을 맡기실 수 있습니다. 목록에 없는 서류는 카카오톡으로 문의해 주세요.</p>'),
    '메인 FAQ — 취소 질문 빼고 "어떤 서류를 맡길 수 있나요?"');
  check(/결제 후 취소·환불이 되나요\?/.test(html.slice(html.indexOf('id="page-faq"'), html.indexOf('id="page-faq"') + 60000)), '취소 질문은 전체 FAQ 에 있음');
  const pageFaq = html.slice(html.indexOf('id="page-faq"'), html.indexOf('id="page-faq"') + 60000);
  check(/1페이지 9,000원\(부가세 별도\)/.test(pageFaq), '전체 FAQ 페이지의 (부가세 별도)는 그대로');
}

// ── 12. 검색·공유 문구 · 모바일 카카오 원형 ──
console.log('\n[12] 검색·공유 문구 · 카카오 버튼');
{
  const D = '공증 받으러 멀리 가지 마세요. 서류만 올려 주시면 번역부터 공증·아포스티유까지 모두 마쳐 댁으로 보내 드립니다. 가족관계·기본·혼인증명서 번역 5,000원, 생활기록부 1페이지 9,000원.';
  check(html.includes('<title>IUMM 아이움 — 온라인 번역공증 · 아포스티유</title>'), 'title');
  check(['name="description"', 'property="og:description"', 'name="twitter:description"'].every(k => html.includes('<meta ' + k + ' content="' + D + '">')), 'meta·OG·twitter 설명 3곳 같은 문구 (부가세·쪽당 없음)');
  const kf = fs.readFileSync(path.resolve(HERE, '../assets/kakao-fab.js'), 'utf8');
  check(kf.includes('#iumm-kakao-fab a{width:52px;height:52px;padding:0;border-radius:50%;gap:0}') && kf.includes('#iumm-kakao-fab a span{display:none}') && kf.includes('aria-label="카카오톡 문의"'), '모바일 카카오 — 52px 원형 아이콘 · aria-label 카카오톡 문의');
}

// ── 13. '쪽' → '페이지' (손님에게 보이는 곳) ──
console.log('\n[13] 쪽 → 페이지');
{
  // 주석을 뺀 줄에서 "쪽당"·"N쪽"·"'쪽'" 표기를 찾는다 (오른쪽·이쪽·한쪽 같은 낱말은 제외)
  const files = ['../index.html', '../notary/index.html', '../notary/edit.html'];
  const hits = [];
  for (const f of files) {
    fs.readFileSync(path.resolve(HERE, f), 'utf8').split(/\r?\n/).forEach((l, i) => {
      const t = l.replace(/<!--.*?-->/g, '').replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
      if (/^(\*|<!--)/.test(t)) return;
      if (/쪽당|\d\s*쪽|\+\s*'쪽|'쪽 /.test(t)) hits.push(f.replace('../', '') + ':' + (i + 1));
    });
  }
  check(hits.length === 0, `손님 화면 '쪽당'·'N쪽' 0건${hits.length ? ' — ' + hits.join(', ') : ''}`);
}

// ── 14. 디자인·색감 ──
console.log('\n[14] 디자인·색감');
check(/\.nav-cta\{background:#16B894;color:#06202f;/.test(html) && html.includes('<button style="background:#16B894;color:#06202f;'), 'nav 번역공증 신청 버튼 글자 #06202f (PC·모바일 메뉴)');
check(land.includes('.lp-card.main{border:2px solid var(--mint);background:rgba(22,184,148,0.09)}'), '공증 카드 배경 0.09 · 전문 번역 0.06');
check(land.includes('.lp-label{font-size:13px;letter-spacing:1px;') && land.includes('.lp-label .en{letter-spacing:3px}') &&
      land.includes('<p class="lp-label"><span class="en">FAQ</span></p>') && land.includes('<p class="lp-label">번역공증 · 아포스티유</p>') && land.includes('<p class="lp-label">전문 번역</p>'),
  '라벨 자간 — 기본 1px, 영문(SINCE 2009·FAQ)만 3px');
check(html.includes('<div class="footer-biz" style="font-size:12px;color:rgba(255,255,255,0.5);') &&
      (html.match(/<span style="margin:0 8px;color:rgba\(255,255,255,0\.25\)">\|<\/span>/g) || []).length === 6 &&
      /footer > div:nth-child\(2\)\{text-align:center;font-size:12px !important/.test(html), '푸터 사업자 정보 12px · 흰 50% · 구분선 25% (모바일도 12px)');

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
