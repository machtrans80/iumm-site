// 사이트 위저드 로직 회귀 — jsdom 없이 최소 DOM 을 흉내 내고
// notary/index.html 의 <script> 를 그대로 실행한다.
// ★목적: "서류를 고르면 상품이 자동으로 바뀌는가"를 배포 전에 확인하는 것.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

// ★금액·상품·서류 정의는 iumm-pipeline/notary/pricing.js 단일 출처에서 그대로 가져온다.
//   사이트가 자체 목록을 들고 있지 않다는 것 자체가 이 테스트의 검증 대상이다.
//   두 레포가 나란히 놓여 있지 않으면 건너뛴다(사이트만 클론한 환경).
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const PRICING = path.resolve(HERE, '../../iumm-pipeline/notary/pricing.js');
if (!fs.existsSync(PRICING)) {
  console.log('⚠ iumm-pipeline 이 옆에 없어 위저드 회귀를 건너뜁니다:', PRICING);
  process.exit(0);
}
const { publicConfig } = await import(url.pathToFileURL(PRICING).href);

const html = fs.readFileSync(path.resolve(HERE, '../notary/index.html'), 'utf8');
const code = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');

// ── 최소 DOM ──
const mk = (id) => ({
  id, innerHTML: '', textContent: '', value: '', style: {}, files: [],
  selectedOptions: [{ textContent: '' }],
  classList: { toggle(){}, add(){}, remove(){} },
  querySelectorAll: () => [],
  addEventListener(){}, onclick: null, disabled: false, checked: false,
});
const els = new Map();
const $id = (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); };

const sandbox = {
  console,
  document: {
    getElementById: $id,
    querySelectorAll: (sel) => sel.includes('ntr-panel')
      ? [] : [],
    addEventListener(){},
  },
  window: { scrollTo(){}, location: { href:'', search:'' } },
  location: { href:'', search:'', hash:'' },
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  navigator: { userAgent:'node' },
  fetch: async () => ({ json: async () => ({ ok:false }) }),
  URLSearchParams,
  setTimeout, clearTimeout, Math, Date, JSON, Number, String, Array, Object,
  alert(){}, FormData: class { append(){} },
  Kakao: undefined, PortOne: undefined,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'notary/index.html' });

// ── 서버 설정을 그대로 주입 (실제 publicConfig) ──
const cfg = publicConfig();
cfg.ok = true; cfg.countries = []; cfg.groupOrder = [];
sandbox.CFG = cfg;

let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log('  \u2705 ' + label); }
                               else { fail++; console.log('  \u274c ' + label); } };

// ── 1. 첫 화면 카드는 세 장 ──
console.log('\n[1] 상품 선택 첫 화면 — T1/T2/T3 세 장 유지');
sandbox.renderTiers();
const cards = ($id('tiers').innerHTML.match(/class="ntr-tier/g) || []).length;
check(cards === 3, `카드 ${cards}장 (APO 는 미노출)`);
check(!$id('tiers').innerHTML.includes('>APO<'), 'APO 코드가 첫 화면에 없다');

// ── 2. 번역 상품에서 영문 발급 서류를 고르면 자동 전환 ──
console.log('\n[2] T2 선택 후 범죄경력회보서 → 아포스티유 단독 자동 전환');
sandbox.selectTier('T2');
check(sandbox.TIER.code === 'T2', '고객이 T2 를 골랐다');
// 실제 흐름대로 서류 화면까지 진행한 상태에서 서류를 고른다
sandbox.STEP_I = sandbox.STEPS.indexOf('lang');
check(sandbox.currentStep() === 'lang', '서류 선택 화면에 와 있다');
$id('docType').value = 'crime_record';
sandbox.onDocType();
check(sandbox.TIER.code === 'APO', `상품이 APO 로 자동 전환됨 (현재 ${sandbox.TIER.code})`);
check($id('apo-switch-note').innerHTML.includes('번역·공증이 필요 없습니다'), '전환 사유 안내가 뜬다');
check($id('apo-switch-note').innerHTML.includes('70,000원'), '전환 금액 70,000원 안내');
check($id('lang-field').style.display === 'none', '번역 언어 선택이 감춰진다');
check($id('korean-only-note').style.display === 'none', '"한글 원본" 경고가 감춰진다');
check($id('upload-head').textContent.includes('아포스티유'), '업로드 화면 제목이 바뀐다');

// ── 3. 단계 구성 — 서류 뒤에 국가를 묻는다 ──
console.log('\n[3] 단계 구성 — 자동 전환 시점에 국가를 건너뛰지 않는다');
check(sandbox.STEPS.join('>') === 'tier>lang>country>upload>ship>confirm',
  `APO 단계 = ${sandbox.STEPS.join(' > ')}`);
check(sandbox.STEPS.indexOf('country') > sandbox.STEPS.indexOf('lang'),
  '국가를 서류 뒤에 묻는다 (전환 후에도 도달 가능)');
check(sandbox.currentStep() === 'lang', '전환 직후에도 서류 화면에 머문다');

// ── 4. 되돌리기 ──
console.log('\n[4] 번역 서류로 되돌리면 원래 상품으로 복귀');
$id('docType').value = 'family_relation';
sandbox.onDocType();
check(sandbox.TIER.code === 'T2', `T2 로 복귀 (현재 ${sandbox.TIER.code})`);
check($id('apo-switch-note').innerHTML === '', '전환 안내가 사라진다');
check($id('lang-field').style.display === '', '번역 언어 선택이 다시 보인다');
check($id('korean-only-note').style.display === '', '"한글 원본" 경고가 다시 보인다');

// ── 5. 발급 안내 배너 ──
console.log('\n[5] 발급 안내 배너 — 대법원 3종 · 경찰청 2종');
for (const [code, must] of [
  ['family_relation', ['정부 사이트에서 무료로', 'efamily.scourt.go.kr', '상세', '전부 공개', 'PDF로 저장']],
  ['basic',           ['efamily.scourt.go.kr', '전부 공개']],
  ['marriage',        ['efamily.scourt.go.kr', '전부 공개']],
  ['crime_record',    ['영문으로 발급받으시면', 'crims.police.go.kr', '영문', '형의 실효 등에 관한 법률']],
  ['investigation',   ['crims.police.go.kr', '외국 입국·체류']],
]) {
  $id('docType').value = code;
  sandbox.renderIssueGuide();
  const h = $id('issue-guide').innerHTML;
  check(must.every(m => h.includes(m)), `${code} 배너 — ${must.length}개 항목 모두 포함`);
  check(h.includes('class="ntr-hl"'), `${code} 형광 강조 사용`);
  check(h.includes('target="_blank" rel="noopener noreferrer"'), `${code} 발급처는 새 창`);
}
$id('docType').value = 'adoption';
sandbox.renderIssueGuide();
check($id('issue-guide').innerHTML === '', '안내가 없는 서류에는 배너를 띄우지 않는다');

// ── 6. 결제 화면 문구 ──
console.log('\n[6] 결제 화면 — 상품에 맞는 안내');
$id('docType').value = 'crime_record';
sandbox.onDocType();
sandbox.buildSummary();
check($id('confirm-notes').innerHTML.includes('번역·공증을 진행하지 않습니다'), 'APO 결제 안내 문구');
check(!$id('confirm-notes').innerHTML.includes('서류 인식·번역이 자동으로'), '번역 문구가 섞이지 않는다');
check(!$id('pay-summary').innerHTML.includes('언어'), 'APO 요약에 언어 줄이 없다');
$id('docType').value = 'family_relation';
sandbox.onDocType();
sandbox.buildSummary();
check($id('confirm-notes').innerHTML.includes('서류 인식·번역이 자동으로'), '번역 상품 안내는 그대로');

console.log(`\n${fail ? '\u274c' : '\u2705'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
