// 사이트 위저드 로직 회귀 — jsdom 없이 최소 DOM 을 흉내 내고
// notary/index.html 의 <script> 를 그대로 실행한다.
// ★목적: "서류를 고르면 시스템이 범위·단계를 정하는가"를 배포 전에 확인하는 것.
//   (2026-10 개편: 상품 카드 단계 삭제 → 서류 선택이 첫 단계)
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
  contains: () => false, setAttribute(){}, focus(){},
});
const els = new Map();
const $id = (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); };

const sandbox = {
  console,
  document: {
    getElementById: $id,
    querySelectorAll: () => [],
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
$id('lang').value = 'en';

let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log('  ✅ ' + label); }
                               else { fail++; console.log('  ❌ ' + label); } };
const steps = () => sandbox.STEPS.join('>');
const pick = (c) => sandbox.pickDoc(c);
const effective = { nameKo: '미국', isMember: true, effectiveNow: true, effectiveDate: '', group: '', unknown: false };
const consular  = { nameKo: '중국대만', isMember: false, effectiveNow: false, effectiveDate: '', group: '', unknown: false };

// ── 1. 첫 화면 = 서류 선택 (상품 카드 없음) ──
console.log('\n[1] 첫 화면 — 카테고리 탭 + 서류 버튼');
sandbox.renderDocPicker();
const cats = $id('doc-cats').innerHTML;
check(['개인', '유학', '기업', '기타'].every(c => cats.includes('>' + c + '<')), '탭 개인·유학·기업·기타');
const personal = $id('doc-list').innerHTML;
check(personal.includes('가족관계증명서') && personal.includes('범죄경력회보서'), '개인 탭에 가족관계·범죄경력');
check(/disabled onclick="pickDoc\('driver_license'\)">운전면허증<span class="tag">준비 중/.test(personal),
  '운전면허증 준비 중(비활성)');
check(!html.includes('data-step="tier"'), '상품 카드 단계가 없다');
check(sandbox.STEPS.join() === 'doc', '서류를 고르기 전 단계 = 서류 선택뿐');

// ── 2. 3종 → 번역공증(T2) 기본 ──
console.log('\n[2] 가족관계증명서 → 번역공증 기본');
pick('family_relation');
check(sandbox.TIER && sandbox.TIER.code === 'T2', `T2 (현재 ${sandbox.TIER && sandbox.TIER.code})`);
check(steps() === 'doc>country>info>upload>ship>confirm', `단계 ${steps()}`);
check($id('family-field').style.display === '', '가족 영문 이름 입력 노출');
check($id('scope-field').style.display === '', '"번역본만" 옵션 노출');
check($id('korean-only-note').style.display === '', '"한글 원본 PDF" 경고 (3종 + 영어)');

// ── 3. 번역만 ──
console.log('\n[3] "번역본만" 체크 → T1 · 국가·배송 단계 없음');
$id('translateOnly').checked = true; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T1' && steps() === 'doc>info>upload>confirm', `T1 / ${steps()}`);
check($id('tier-note').innerHTML.includes('번역확인서 등은 제공되지 않습니다'), '번역확인서 미제공 안내');
$id('translateOnly').checked = false; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T2', 'T2 로 복귀');

// ── 4. 아포스티유 — 협약국에서만 체크 노출 ──
console.log('\n[4] 아포스티유 체크 — 협약국만');
sandbox.STEP_I = sandbox.STEPS.indexOf('country');
sandbox.COUNTRY = consular; sandbox.applyCountry();
check($id('apostille-field').style.display === 'none', '비협약국 → 체크 숨김');
check($id('country-note').innerHTML.includes('담당자가 진행 방법을 안내'), '비협약국 담당자 안내');
sandbox.COUNTRY = effective; sandbox.applyCountry();
check($id('apostille-field').style.display === '', '협약국 → 체크 노출');
$id('wantApostille').checked = true; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T3' && sandbox.currentStep() === 'country', 'T3 전환, 국가 화면 유지');
sandbox.COUNTRY = consular; sandbox.applyCountry();
check(sandbox.TIER.code === 'T2' && $id('wantApostille').checked === false, '비협약국으로 바꾸면 체크 해제 + T2');

// ── 5. 영문 발급 서류 → 아포스티유 단독 ──
console.log('\n[5] 범죄경력회보서 → 아포스티유 단독 자동 전환');
sandbox.STEP_I = 0;
pick('crime_record');
check(sandbox.TIER.code === 'APO', `APO (현재 ${sandbox.TIER.code})`);
const apoNote = $id('apo-switch-note').innerHTML;
check(apoNote.includes('영문으로 발급받으시면 번역·공증 없이 아포스티유만'), '"영문으로 발급받으시면…" 안내');
const apoSupply = cfg.tiers.find(t => t.code === 'APO').supply;
check(apoNote.includes(apoSupply.toLocaleString() + '원'), `금액 = 서버 설정값 ${apoSupply.toLocaleString()}원 (하드코딩 아님)`);
check(!apoNote.includes('70,000'), '구 금액 70,000 미표기');
check(steps() === 'doc>country>upload>ship>confirm', `단계 ${steps()} (언어·이름 없음)`);
check($id('scope-field').style.display === 'none', '"번역본만" 옵션 숨김');
check($id('korean-only-note').style.display === 'none', '"한글 원본" 경고 숨김');
for (const c of ['resident_full', 'resident_abstract', 'immigration', 'investigation', 'biz_registration', 'tax_payment']) {
  pick(c);
  check(sandbox.TIER.code === 'APO', `${c} → APO`);
}

// ── 6. 졸업·성적증명서 — 학교 구분 ──
console.log('\n[6] 졸업증명서 — 국립 = 단독 / 사립 = 번역공증');
sandbox.SCHOOL = '';
pick('graduation');
check(!sandbox.TIER && $id('school-field').style.display === '', '학교 구분 전에는 범위 미정 + 선택지 노출');
sandbox.pickSchool('국립');
check(sandbox.TIER.code === 'APO', '국립 → APO');
sandbox.pickSchool('사립');
check(sandbox.TIER.code === 'T2', '사립 → T2 번역공증');
pick('school_record');
check(sandbox.SCHOOL === '' && $id('school-field').style.display === 'none', '다른 서류로 바꾸면 학교 구분 초기화');
check($id('korean-only-note').style.display === 'none', '수동 경로 — "한글 원본 PDF" 경고 숨김 (사진 허용)');

// ── 7. 영문 이름 검증 ──
console.log('\n[7] 영문 이름 — 서버와 같은 기준');
for (const [v, ok] of [['HONG GILDONG', true], ['Hong Gil-dong', true], ["O'BRIEN J.", true],
                       ['홍길동', false], ['', false], ['A', false], ['HONG1', false]]) {
  $id('englishName').value = v;
  check(sandbox.englishNameOk() === ok, `"${v}" → ${ok ? '통과' : '거부'}`);
}

// ── 8. 발급 안내 배너 ──
console.log('\n[8] 발급 안내 배너');
for (const [c, must] of [
  ['family_relation', ['efamily.scourt.go.kr', '상세', '전부 공개', 'PDF로 저장']],
  ['crime_record',    ['crims.police.go.kr', '외국 입국·체류', '본인확인용', '2년 이하의 징역', '2천만원 이하의 벌금', '영문', '여권 철자']],
  ['immigration',     ['정부24', '개명하신 분은 온라인 발급이 되지 않습니다']],
  ['resident_full',   ['정부24', '영문']],
  ['tax_payment',     ['홈택스', '영문']],
]) {
  $id('docType').value = c;
  sandbox.renderIssueGuide();
  const h = $id('issue-guide').innerHTML;
  check(must.every(m => h.includes(m)), `${c} 배너 — ${must.join(' · ')}`);
}
$id('docType').value = 'crime_record'; sandbox.renderIssueGuide();
check($id('issue-guide').innerHTML.includes('class="ntr-g-danger"'), '범죄경력회보서 목적 경고 = 경고색 블록');
$id('docType').value = 'contract'; sandbox.renderIssueGuide();
check($id('issue-guide').innerHTML === '', '안내 없는 서류(계약서)는 배너 없음');

// ── 9. 결제 화면 문구 ──
console.log('\n[9] 결제 화면 — 경로별 안내 · 착수 후 취소·환불 불가');
pick('crime_record'); sandbox.QUOTE = { route: 'apo', pages: 1 }; sandbox.buildSummary();
check($id('confirm-notes').innerHTML.includes('번역·공증을 진행하지 않습니다'), 'APO 안내');
check(!$id('pay-summary').innerHTML.includes('번역 언어'), 'APO 요약에 언어 줄 없음');
pick('school_record'); sandbox.QUOTE = { route: 'manual', pages: 10 }; sandbox.buildSummary();
const mn = $id('confirm-notes').innerHTML;
check(mn.includes('결제 즉시 번역이 착수되며, 착수 후에는 취소·환불이 불가합니다'), '수동 경로 — 착수 후 취소·환불 불가');
check(mn.includes('스캔본을 먼저'), '스캔본 먼저 안내');
check($id('pay-summary').innerHTML.includes('발송 전 제공 (포함)'), '스캔본 기본 포함 (금액 표시 없음)');
check($id('ag2-label').innerHTML.includes('착수 후에는 취소·환불이 불가'), '동의 체크 문구');
pick('family_relation'); sandbox.QUOTE = { route: 'auto', pages: 1 }; sandbox.buildSummary();
check($id('confirm-notes').innerHTML.includes('확인·수정 화면'), '3종 자동 경로 안내 유지');

// ── 10. 고객 화면 표현 ──
console.log('\n[10] 고객 화면 표현');
const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/\bAI\b|GPT|Claude|인공지능|자동 ?번역/.test(visible), 'AI·자동번역 표현 없음');
check(!/최저|최고|BEST/.test(visible), '최상급 표현 없음');

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
