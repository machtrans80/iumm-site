// 메인 랜딩 회귀 — "N년째" 계산 · 금지 표현 · 전문 번역 단가 단일 출처
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

// ── 1. N년째 — KST 연도 기준, 2009년 = 1년째 ──
console.log('\n[1] 업력 "N년째" — 하드코딩 없이 계산');
const script = land.match(/<script>([\s\S]*?)<\/script>/)[1];
const els = {};
const sandbox = { window: {}, isLoggedIn: false, sessionStorage: { setItem(){} }, showPage(){}, location: {},
  document: { getElementById: (id) => (els[id] = els[id] || { textContent: '' }) } };
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
const years = sandbox.window.lpYears;
check(years(Date.UTC(2009, 0, 1, 0, 0)) === 1, '2009년 = 1년째');
check(years(Date.UTC(2026, 9, 15, 3, 0)) === 18, '2026-10-15 = 18년째');
check(years(Date.UTC(2026, 11, 31, 14, 59)) === 18, '2026-12-31 23:59 KST = 18년째');
check(years(Date.UTC(2026, 11, 31, 15, 0)) === 19, '2027-01-01 00:00 KST(= UTC 12-31 15:00) = 19년째');
const nowN = new Date(Date.now() + 9 * 3600e3).getUTCFullYear() - 2008;
check(els['lp-since'].textContent === `2009년부터 이어 온 번역·공증 실무, 올해로 ${nowN}년째입니다.`, `화면 문구 = 올해로 ${nowN}년째`);
check(!/올해로\s*\d+\s*년째/.test(land.replace(/<script>[\s\S]*?<\/script>/g, '')), 'HTML 에 숫자 하드코딩 없음');

// ── 2. 전문 번역 단가 — PLAN_PRICE 한 곳 ──
console.log('\n[2] 전문 번역 단가 단일 출처');
check(sandbox.PLAN_PRICE && sandbox.PLAN_PRICE.ai === 25 && sandbox.PLAN_PRICE.standard === 40, 'PLAN_PRICE = { ai:25, standard:40 }');
check(els['lp-plan-price'].textContent === '25원부터', '카드 금액 = PLAN_PRICE.ai');
check(!/currentPlan\s*===?\s*["']ai["']\s*\?\s*25\s*:\s*40/.test(html), '주문 모달 25:40 하드코딩 없음');
check(!/_memberRate(Ai|Pp)\s*\|\|\s*(25|40)\)/.test(html), '견적 기본 단가 하드코딩 없음');

// ── 3. 구성 ──
console.log('\n[3] 구성 — 누구에게나 같은 화면');
check(land.includes('공증 받으러<br>서울까지 가지 마세요'), '제목');
check(land.includes('서류만 올리시면 번역부터 공증·아포스티유까지 마치고 집으로 보내드립니다.'), '부제');
check((land.match(/class="lp-card[ "]/g) || []).length === 2 && land.includes('lp-card main'), '카드 2개 · 1번 강조');
check(land.includes("onclick=\"lpGo('notary')\">번역공증 · 아포스티유 시작<"), '1번 버튼 → 위저드');
check(land.includes('onclick="handleAI()">전문 번역 시작<') && land.includes('lp-btn line'), '2번 버튼 → 전문 번역 모달 (외곽선)');
check(land.includes("lpGo('quote')") && land.includes('수사·법률 서류 견적'), '수사·법률 견적 링크');
check(['가족관계·기본·혼인 번역', '5,000원', '그 외 서류 쪽당 9,000원 · 부가세 별도', '급행이면 다음 영업일 수령 (영업일 기준 예정)',
       '신분증·여권 사본공증 + 아포스티유도 가능'].every(t => land.includes(t)), '1번 카드 문구');
check(['번역의 기준이 바뀌었습니다', '분야별 용어집으로 번역하고, 용어·숫자·누락을 점검한 뒤, 전문 번역사가 마지막 문장까지 직접 검수합니다.',
       '(부가세 별도)'].every(t => land.includes(t)), '2번 카드 문구');
check((land.match(/<details>/g) || []).length === 5 && land.includes("showPage('faq')"), 'FAQ 5개 + 전체 보기');
check(land.includes('3단계면 끝납니다'), '3단계 안내');
check(land.includes('신분증·여권 사본, 사법공조요청서, 진술조서 등'), '맡길 수 있는 서류 한 줄');
check(!/lp-in|lpApplyLogin|lp-member|lp-join|카카오로 시작하기/.test(land), '회원 전용·가입 유도 블록 없음');

// ── 4. 금지 표현 ──
console.log('\n[4] 금지 표현');
const visible = land.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/\bAI\b|인공지능|스마트/.test(visible.replace(/PLAN_PRICE\.ai|ai\s*:|handleAI|'ai'/g, '')), 'AI·인공지능·스마트 없음');
check(!/gradient|box-shadow|glow|@keyframes|animation:/.test(visible), '그라데이션·글로우·자동 애니메이션 없음');
check(!/✦|[\u{1F300}-\u{1FAFF}]|[☀-➿]/u.test(visible), '✦·이모지 없음');
check(!html.includes('✦'), 'index.html 전체 ✦ 없음');
check(!/최고|최저|최초|유일|1위|완벽/.test(visible), '최상급 표현 없음');

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
