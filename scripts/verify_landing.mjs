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


// ── v2 (2026-10-29) — "두 전문가가 함께 번역합니다" · 번역공증·아포스티유 제거 · 새 팔레트 ──
console.log('\n[1] 첫 화면');
const script = [...land.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('PLAN_PRICE'));
const els = {}, planEls = [{ k: 'ai', textContent: '' }, { k: 'standard', textContent: '' }];
const sandbox = { window: {}, handleAI(){}, location: { hostname: 'iumm.kr', protocol: 'https:', search: '' },
  document: { documentElement: { setAttribute(){} }, getElementById: (id) => (els[id] = els[id] || { textContent: '' }),
  querySelectorAll: (q) => q.startsWith('template') ? [] : planEls.map(e => ({ getAttribute: () => e.k, set textContent(v){ e.textContent = v; } })) } };
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
check(land.includes('<p class="lp-lead">아이움 AI는 정확하게 기억하고,<br>전문 번역가는 깊이 이해합니다.</p>'), '서브 문구');
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
check(land.includes('<p class="lp-sub">아이움 AI와 전문 번역가가 9단계 검증을 거쳐 완성합니다.</p>'), '과정 부제');
check(/<h2 class="lp-h2 mb">한 문장이 10단계를 거쳐 납품됩니다<\/h2>\s*<p class="lp-sub">단순 AI 번역이 아닙니다\.<\/p>/.test(land), 'V3 10단계 제목 아래 부제 (작은 라벨 없음)');
check(!/class="lp-label"|class="lp-kicker"/.test(html), '구역 제목 위 작은 라벨 없음');
check(land.includes('<li>IGDA 게임 현지화 모범 사례</li>') && land.includes('<li>IEC/IEEE 82079-1 (사용 정보 작성 표준)</li>') && !land.includes('STD_'), '게임·매뉴얼 기준 배지 = 스타일시트 반영분');
check((land.match(/<div class="lp-field">/g) || []).length === 8 && land.includes('<details class="lp-other">') && land.includes('그 밖의 분야(비즈니스 · 마케팅 · 공공 등)도 분야별 기준으로 번역합니다.'), '분야 카드 8장 + 그 밖의 분야 접기');
check(land.includes('<h2 class="lp-h2 mb">아이움이 특화한 여덟 분야</h2>') && !/lp-fields-more|네 분야 더 보기/.test(html) && /\.lp-field:not\(\.open\) \.more\{display:none\}/.test(html) &&
      (land.match(/<button type="button" class="fmore" aria-expanded="false">예시·기준 보기<\/button>/g) || []).length === 8, '여덟 분야 — 모바일 2열 8칸 모두 보임, 누르면 예시·기준 펼침 (더 보기 없음)');
check(/\.lp-fields\{display:grid;grid-template-columns:repeat\(4,1fr\)/.test(html) && /\.lp-field\{padding:22px 0 0;border-top:1px solid/.test(html) && /\.lp-field \.std li\{display:inline\}/.test(html), '분야 타일 = 위쪽 가는 선 · 데스크톱 4×2 · 기준은 한 줄 글자(배지 없음)');
for (const b of ['ICH 가이드라인', 'K-IFRS', 'ISA 국제감사기준', 'WIPO Pearl 특허 용어', '지식재산처 PCT 용어 해설', '학회 공식 용어 우선', 'GRI Standards', 'ISSB IFRS S1·S2', 'KSSB 지속가능성 공시기준', '원작 공식 표기 우선'])
  check(land.includes('<li>' + b + '</li>'), `기준 배지 '${b}'`);
check(land.includes('주요 시장: 영어 · 중국어(간체·번체) · 일본어 등'), '게임 주요 시장 줄');

console.log('\n[3-2] 기업 고객 · 무료 테스트 · 14일 무상 수정');
check(land.includes('<h2 class="lp-h2 mb">아이움에 맡겨야 하는 이유</h2>') && !/기업이 아이움에 맡기는 이유/.test(html) && (land.match(/<div class="c"><p class="k mb">/g) || []).length === 7, "'아이움에 맡겨야 하는 이유' 6칸 + V3 품질 리포트 1");
{ const ks = [...land.matchAll(/<p class="k mb">([\s\S]*?)<\/p><p class="d">([^<]*)<\/p>/g)].map(m => [m[1].replace(/<[^>]+>/g, ''), m[2]]);
  const want = ['글자당 원부터', '5,000자 24시간', '자동 가림', 'NDA 체결', '1,000자 무료', '14일 1회 무상 수정', '품질 리포트'];
  check(ks.map(k => k[0]).join('|') === want.join('|'), '핵심 사실 = ' + ks.map(k => k[0]).join(' · '));
  check(land.includes('<p class="k mb">글자당 <span data-plan="ai"></span>원부터</p>') && !/추가 요금 없이/.test(html), "단가 = PLAN_PRICE '부터' · '추가 요금 없이' 없음");
  check(ks[1][1] === '스탠다드는 5,000자까지 24시간 이내에 납품합니다.' && html.includes("{max:5000,  label:'5,000자까지',      ai:'24시간 이내', standard:'2일 이내'}"), '납기 = DELIVERY_TABLE(주문 화면 표·견적 칸 공통) 스탠다드 5,000자까지 24시간 이내');
  // 대표 원칙 — 부가세·접수 시간 같은 조건 문구는 메인에 넣지 않고 견적·결제 단계에서 보여 준다
  check(!/부가세|19시/.test(land.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')), "메인 화면 글자(숨김·V3 포함)에 '부가세'·'19시' 없음");
  check(html.includes('id="estimate-vat-note" style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">부가세 별도</p>') && html.includes('※ 19시 이후 접수 건은 익일 09시 접수 기준으로 납품일이 계산됩니다.') && html.includes('>부가세 (10%)</p>'),
    "견적 칸 '부가세 별도' · 소요시간 표 아래 19시 안내 · 결제 화면 부가세(10%) 줄 그대로");
  check(ks[2][1].includes('납품 후 21일 안에 삭제합니다.') && land.includes('문서는 납품 후 21일 안에 삭제합니다.'), '21일 삭제 문구 (이유·FAQ)'); }
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
check(land.includes('<p class="lp-slogan" lang="en">IUMM — <b>I</b>ntelligence <b>U</b>nites <b>M</b>ind &amp; <b>M</b>achine</p>'), '영문 슬로건 (I·U·M·M 첫 글자만 굵게)');
check(land.includes('<p class="lp-trust">SINCE 2011 · 32개 언어 · 누적 1만 건 이상</p>'), '신뢰 표시 한 줄');
{ const pairs = (html.match(/<select id="lang-select"[\s\S]*?<\/select>/)[0].match(/<option[^>]*>한국어 → [^<]+<\/option>/g) || []).length;
  check(pairs === 32, `신뢰 표시 '32개 언어' = 주문 화면 한국어→외국어 목록 ${pairs}개`); }
check(!/이음|잇습니다|잇고|이어 드립니다/.test(landVis) && !/이음/.test(html.replace(/<!--[\s\S]*?-->/g, '')), "'이음' 브랜드 표현 · '잇다' 문구 없음 (숨김 V3 포함)");
check(land.includes('<section class="lp-sec tight" id="iumm-about">') && land.includes('<h2 class="lp-h2 mb">빠르면서도, 정확하게</h2>'), '왜 아이움인가 섹션 (제목 빠르면서도, 정확하게)');
check(land.includes('<p class="s">당신의 가능성을 세계로 연결합니다.</p>'), '마지막 섹션 대표 문구');

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
  check(land.includes('<h1 class="serif">두 전문가가<br>함께 번역합니다</h1>') && (land.match(/<h1[\s>]/g) || []).length === 1, 'h1 "두 전문가가 함께 번역합니다" · 메인 화면에 하나뿐');

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
  for (const w of ['10단계', '귀사를 기억', '용어를 기억하고', '별의 기사', '전용 용어집', '역번역', '판정'])
    check(inT.includes(w) && !outT.includes(w), `V3 문구 '${w}' — template 안에만 (스위치 꺼짐 = 화면·검색 미노출)`);
  check((inT.match(/<ol class="lp-flow10">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length === 10, 'V3 공정 10단계');
  check(/<span class="tag">예시<\/span>/.test(inT), "V3 가상 예시에 '예시' 표시");
  check(!/제출/.test(outT) && !/제출/.test(inT), "'제출' 표현 없음 (대상 독자·대상 시장)");
  const S1 = '<span class="t">문서 분석</span><span class="d">고객이 고른 분야와 문서 종류에 맞는 번역 기준을 적용하고, 개인정보 번호는 처리 전에 자동으로 가립니다.</span>';
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
    contract: ['갑은 본 계약 체결일로부터 30일 이내에 계약금 5,000,000원을 을에게 지급한다.', 'Party A shall pay Party B a deposit of KRW 5,000,000 within thirty (30) days from the date of execution of this Agreement.',
      [['갑', 'Party A'], ['을', 'Party B'], ['본 계약', 'this Agreement'], ['계약금', 'deposit']], [['30일', 'thirty (30) days'], ['5,000,000원', 'KRW 5,000,000']]],
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
  check(txt(hero.match(/<ul class="cmp-checks">[\s\S]*?<\/ul>/)[0]).replace(/\s+/g, ' ').trim() === '용어 일치 숫자 대조 전문 번역가 최종 확인', '패널 아래 확인 3개 — 용어 일치 · 숫자 대조 · 전문 번역가 최종 확인');
  check(hero.indexOf('id="lp-entry"') < hero.indexOf('id="lp-cmp"') && /@media\(min-width:1024px\)\{\s*\.lp-hero \.lp\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.1fr\)/.test(html) && /\.cmp-row\{grid-template-columns:1fr;gap:18px\}/.test(html),
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
  check(!/@keyframes|animation:/.test(lpCss.replace(/\.lp-cmp[^{]*\{[^}]*\}/g, '')), '랜딩 CSS 에 패널 밖 애니메이션 없음');

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
  check([...lpCss.matchAll(/border-radius:([^;}]+)/g)].every(m => /^(6px|6px 6px 0 0|50%)$/.test(m[1].trim())), '모서리 6px (버튼·탭), 원형은 확인 아이콘·이음 점만');
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
  check(privAll.includes('<li>제1조 ④, 제3조, 제5조, 제6조, 제8조: 공증 서비스 종료에 따른 관련 조항 삭제 (제1조 ⑤ 수집 방법 → ④)</li>') && privBody.includes('④ 수집 방법') && !privBody.includes('⑤ 수집 방법'), "개정 안내 '공증 서비스 종료에 따른 관련 조항 삭제' · 번호 ⑤→④");
  const outside = strip(html).replace(privAll, '');
  check(!/공증|아포스티유|번역공증|사본공증|등기/.test(outside), '메인 index.html(개인정보 개정 안내 밖)에 공증·아포스티유·등기 없음');
  check(!/loadMyNotaryOrders|my-notary|_ntr|openNotaryOrder|\/api\/notary/.test(html), '마이페이지 공증 주문 목록·스크립트 없음');
  check(!fs.existsSync(path.resolve(HERE, '../notary/index.html')) && fs.existsSync(path.resolve(HERE, '../notary/edit.html')), '고객 공증 입구(notary/index.html) 삭제 · 관리자 공증 도구가 여는 edit.html 유지');
  const rd = fs.readFileSync(path.resolve(HERE, '../_redirects'), 'utf8');
  check(['/notary / 301', '/notary/ / 301', '/notary/index.html / 301'].every(l => rd.split(/\r?\n/).includes(l)) && !/edit/.test(rd.replace(/^#.*$/m, '')), '_redirects — /notary/ → / 301 (edit.html 은 그대로)');
  check(!fs.existsSync(path.resolve(HERE, '../legal/terms-2026-10-22.html')) && !fs.existsSync(path.resolve(HERE, '../legal/privacy-2026-10-22.html')), '2026-10-22 보관본은 공개 사이트에서 내림 (내부 보관)');
  check(!/notary/i.test(fs.readFileSync(path.resolve(HERE, '../sitemap.xml'), 'utf8')), 'sitemap 에 공증 없음');
}

// ── 8. FAQ 낡은 문구 ──

console.log(`
${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
