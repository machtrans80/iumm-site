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
// 랜딩 스크립트(PLAN_PRICE·lpGo) — 인트로 스크립트와 구분해 고른다
const script = [...land.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('PLAN_PRICE'));
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
// 인트로(#intro)는 맥박·스크롤 안내 움직임이 요구 사항이라 제외하고 본다
// (인트로 그라데이션은 "아 · 이 · 움" 뒤 바탕 1개만 허용 — 글로우·그림자는 인트로도 금지)
const introEnd = land.indexOf('<section class="lp-hero" id="top">');
const introStart = land.lastIndexOf('<!-- ════', land.indexOf('<section class="it" id="intro"'));
const introPart = introStart >= 0 && introEnd > introStart ? land.slice(introStart, introEnd) : '';
check(!/gradient|box-shadow|glow|@keyframes|animation:/.test(visible.replace(introPart.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, ''), '')),
  '그라데이션·글로우·자동 애니메이션 없음 (인트로 제외)');
check(!/box-shadow|glow/.test(introPart) && (introPart.match(/gradient\(/g) || []).length === 3 &&
      introPart.includes('background:radial-gradient(closest-side,rgba(15,37,64,0.85),rgba(15,37,64,0))') &&
      introPart.includes('background:linear-gradient(to right,rgba(15,37,64,0.8),rgba(15,37,64,0) 60%)') &&
      introPart.includes("'linear-gradient(to bottom,#000 0px,#000 '"),
  '인트로 — 그라데이션은 3개뿐: 글자 뒤 바탕(radial) · 끝 제목 쪽 남색(linear) · 카드 줄 아래 지우는 mask · 글로우·그림자 없음');
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

// ── 15. 인트로 — 한반도에서 세계로 줌아웃 · 서울에서 세계로 선 (한국 중심 점 세계지도) ──
console.log('\n[15] 인트로');
{
  const i0 = html.indexOf('<section class="it" id="intro"'), top = html.indexOf('<section class="lp-hero" id="top">');
  check(i0 > 0 && top > i0 && !/<section[^>]*>/.test(html.slice(html.indexOf('</section>', i0) + 10, top).replace(/<script[\s\S]*?<\/script>/g, '')), '#intro 가 #top 바로 위');
  const it = html.slice(html.lastIndexOf('<!-- ════', i0), top);
  const js = it.match(/<script>([\s\S]*?)<\/script>/)[1];
  check(/\.it\{position:relative;height:330vh;/.test(it) && /@media\(max-width:640px\)\{\s*\.it\{height:290vh\}/.test(it), '바깥 높이 PC 330vh / 모바일 290vh');
  check(/\.it-stage\{position:sticky;top:0;height:100vh;height:100dvh;/.test(it), '무대 sticky · 100vh → 100dvh (iOS 주소창 높이 변화)');
  check(it.includes('<p class="it-head">당신을 세계로 이어 드립니다</p>') && !/<h1/.test(it), '위 문구 = p (h1 아님)');
  check(land.includes('<h1>공증 받으러<br>멀리 가지 마세요</h1>') && (land.match(/<h1[\s>]/g) || []).length === 1, 'h1 "공증 받으러 멀리 가지 마세요" 그대로 · 메인 화면에 하나뿐');

  // ── 지도 — 점 세계지도 + 한반도 윤곽
  const dm = it.match(/<g id="continents"><path id="land" class="land" d="([^"]*)"\/><path id="korea" class="korea" d="([^"]*)"\/><\/g>/);
  const d = dm ? dm[1] : '', kd = dm ? dm[2] : '';
  check(!!dm && /^M\d/.test(d) && /^[Mmh0-9 \-]+$/.test(d) && (d.match(/h0/g) || []).length > 3000,
    `점 지도 = <g id="continents"> 안 path 하나 · "h0" 점 ${(d.match(/h0/g) || []).length}개`);
  check(it.includes('.it-map .land{fill:none;stroke:rgba(255,255,255,0.42);stroke-width:2.4px;stroke-linecap:round;vector-effect:non-scaling-stroke}'),
    '점 = 둥근 선끝 · 지름 2.4px · 흰색 42% (줌해도 굵기 그대로)');
  check(/^M[\d.]+ [\d.]+l/.test(kd) && (kd.match(/z/g) || []).length === 12 && Buffer.byteLength(kd, 'utf8') <= 6 * 1024 &&
        it.includes('.it-map .korea{fill:rgba(93,224,188,0.15);stroke:#5DE0BC;stroke-width:1.5px;'),
    `한반도 = 50m 남·북 윤곽 path (고리 ${(kd.match(/z/g) || []).length}개 · ${(Buffer.byteLength(kd, 'utf8') / 1024).toFixed(1)}KB) · 민트 선 1.5px + 민트 12%`);
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
  check(it.includes('<circle class="pulse" r="5"/>') && it.includes('<circle class="kr" r="5"/>') && /<text class="lb home"[^>]*>SEOUL<\/text>/.test(it) && it.includes('.it-map .kr{fill:#5DE0BC}'),
    '서울 = 민트 점 + 맥박 + "SEOUL" (모바일도 표시)');
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
  check(it.includes('.it-map .rt{fill:none;stroke:rgba(93,224,188,0.7);stroke-width:1.2;') && it.includes('.it-map .dst{fill:none;stroke:#5DE0BC;stroke-width:4px;'),
    '선 1.2px · 민트 70% · 도착 점 지름 4px');
  check(/E2 = Z0 \* F > 2 \? 1 - Math\.log\(2 \/ F\) \/ Math\.log\(Z0\) : 0/.test(js) && /var q = E2 < 1 \? c01\(\(e - E2\) \/ \(1 - E2\)\)/.test(js),
    '곡선은 줌아웃 후반(실제 배율 2배 이하)부터, p 0.5 에 모두 도착');
  check(/'C' \+ f\(P1\[0\]\)/.test(js) && /% 360\) - 180/.test(js), '중심 경도(127°E) 기준 좌표 · 곡선 = 3차 베지어');
  check(/<g class="lens"><circle class="halo"\/><circle class="lf"\/><circle class="lr"\/><\/g>/.test(it) && it.indexOf('class="lens"') > it.indexOf('class="g-sp"') && it.indexOf('class="lens"') < it.indexOf('class="pulse"') &&
        it.includes('.it-map .lf{fill:#0F2540}') && it.includes('.it-map .lr{fill:none;stroke:#5DE0BC;stroke-width:1px;vector-effect:non-scaling-stroke}') &&
        it.includes('.it-map .halo{fill:url(#itHalo)}') && /<radialGradient id="itHalo"><stop offset="0" stop-color="#5DE0BC" stop-opacity="0\.25"\/>[^]*?<stop offset="1" stop-color="#5DE0BC" stop-opacity="0"\/><\/radialGradient>/.test(it) &&
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
          /requestAnimationFrame\(tick\)/.test(tick) && it.includes('.it-map .spark{fill:none;stroke:#5DE0BC;stroke-width:3px;'),
      '빛 점 — 지름 3px 민트 · 서울 → 도착지 2.4초 주기 · 선마다 시작 어긋남 · rAF 루프 하나 · transform 만');
    check(/setLive\(!still && ARR\.some\(Boolean\) && p < 0\.92\)/.test(js) && /\.it\.still \.it-hint,\.it\.still \.it-map \.spark,\.it\.still \.it-shade\{display:none\}/.test(it),
      'reduced-motion — 빛 점 없음 (루프 안 돌고 숨김)');
  }

  // ── 줌아웃
  check(/F = mob \? 1\.6 : 1;/.test(js) && /Z0 = kh > 0 \? Math\.max\(1\.5, r0 \* 2 \* 0\.74 \/ kh\) : 6 \/ F;/.test(js) && /var z = Math\.pow\(Z0, 1 - e\);/.test(js) &&
        /zoom\.style\.transform = 'translate\(' \+ f\(S\[0\]\) \+ 'px,' \+ f\(S\[1\]\) \+ 'px\) scale\(/.test(js) && it.includes('<g class="it-zoom">'),
    '줌아웃 — 서울 기준 transform:scale, 한반도가 카드에 차는 배율(PC 약 6배) → 최종 PC 1배 · 모바일 1.6배');

  // ── 글자 · 끝
  check(/<div class="it-plate">\s*<i class="it-bg" aria-hidden="true"><\/i>\s*<p class="w">[\s\S]*?<\/p>\s*<p class="s">당신을 세계로 이어 드립니다<\/p>\s*<\/div>/.test(it) &&
        it.includes('.it-bg{position:absolute;left:-30%;right:-30%;'), '"IUMM"·부제 뒤 radial 바탕 (좌우 -30% = 글자 폭 1.6배)');
  check(it.includes('<p class="w"><span>I</span><span>U</span><span>M</span><span>M</span></p>') && !/아 · 이 · 움|<span>아<\/span>/.test(it) &&
        /color:#5DE0BC;font-size:clamp\(48px,8vw,112px\);font-weight:800;letter-spacing:0\.18em;/.test(it) && /\.it-word \.s\{[^}]*color:rgba\(255,255,255,0\.8\)/.test(it) &&
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
  const mkEl = () => ({ style: {}, attr: {}, setAttribute(k, x){ this.attr[k] = x; }, removeAttribute(){}, cloneNode(){ return mkEl(); }, insertBefore(){}, getComputedTextLength: () => 60, getBoundingClientRect: () => ({ top: 0, bottom: 0 }), classList: { add(){} } });
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
  const vis = it.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  check(!/\bAI\b|인공지능|협력|부가세|사법공조|진술조서|최고|최저|유일/.test(vis), '인트로 금지 표현 없음');
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
