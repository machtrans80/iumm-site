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
// 영문 발급 가능 서류를 아포스티유 단독으로 — 손님 동선 그대로: 협약국 → 아포스티유 체크(T3) → 아포스티유만으로 바꾸기
const toApo = (c) => { pick(c); sandbox.COUNTRY = { nameKo: '미국', isMember: true, effectiveNow: true, effectiveDate: '', group: '', unknown: false };
  sandbox.applyCountry(); $id('wantApostille').checked = true; sandbox.onScopeChange(); sandbox.chooseApo(true); };
const effective = { nameKo: '미국', isMember: true, effectiveNow: true, effectiveDate: '', group: '', unknown: false };
const consular  = { nameKo: '중국대만', isMember: false, effectiveNow: false, effectiveDate: '', group: '', unknown: false };

// ── 1. 첫 화면 = 서류 선택 (상품 카드 없음) ──
console.log('\n[1] 첫 화면 — 카테고리 탭 + 서류 버튼');
sandbox.renderDocPicker();
const cats = $id('doc-cats').innerHTML;
check(['개인', '유학', '기업', '기타'].every(c => cats.includes('>' + c + '<')), '탭 개인·유학·기업·기타');
const personal = $id('doc-list').innerHTML;
check(personal.includes('가족관계증명서') && personal.includes('범죄경력회보서'), '개인 탭에 가족관계·범죄경력');
check(/onclick="pickDoc\('driver_license'\)">운전면허증 사본<\/button>/.test(personal) &&
      !/disabled onclick="pickDoc\('driver_license'\)/.test(personal),
  '운전면허증 사본 — 활성 · 이름만');
check(!/아포스티유만|class="tag apo"|>번역공증<|국립 \/ 사립|사본공증\+아포스티유/.test(personal), '서류 버튼에 처리 방식 태그 없음 (아포스티유만·번역공증·사본공증·국립/사립)');
check(!/>아포스티유만<|tag apo">아포스티유만/.test(html), '위저드 어디에도 "아포스티유만" 태그 없음');
check(['주민등록증 사본', '여권 사본'].every(l => personal.includes(l)), '개인 탭에 주민등록증·여권 사본');
check(!html.includes('data-step="tier"'), '상품 카드 단계가 없다');
check(sandbox.STEPS.join() === 'doc', '서류를 고르기 전 단계 = 서류 선택뿐');

// ── 2. 3종 → 번역공증(T2) 기본 ──
console.log('\n[2] 가족관계증명서 → 번역공증 기본');
pick('family_relation');
check(sandbox.TIER && sandbox.TIER.code === 'T2', `T2 (현재 ${sandbox.TIER && sandbox.TIER.code})`);
check(steps() === 'doc>country>info>upload>ship>date>confirm', `단계 ${steps()} (받으실 날짜 포함)`);
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

// ── 5. 영문 발급 가능 서류 — 기본 번역공증, T3 에서만 "아포스티유만" 선택지 ──
console.log('\n[5] 범죄경력회보서 — 기본 번역공증(T2) · T3 에서 아포스티유만으로 바꾸기');
sandbox.STEP_I = 0;
pick('crime_record');
check(sandbox.TIER.code === 'T2', `자동 전환 없음 — T2 (현재 ${sandbox.TIER.code})`);
check($id('apo-switch-note').innerHTML === '', '서류를 고르자마자 뜨던 "아포스티유 단독으로 진행" 안내 없음');
check(steps() === 'doc>country>info>upload>ship>date>confirm', `단계 ${steps()} (언어·이름·날짜 포함)`);
check($id('scope-field').style.display === '', '"번역본만" 옵션 노출 (T1 가능)');
check($id('korean-only-note').style.display === '', '"한글 원본 PDF" 경고 표시 (번역 상품)');
$id('translateOnly').checked = true; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T1' && $id('apo-option-box').innerHTML === '', 'T1 가능 · 아포스티유만 선택지 안 뜸');
$id('translateOnly').checked = false; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T2' && $id('apo-option-box').innerHTML === '', 'T2 · 아포스티유만 선택지 안 뜸');
sandbox.STEP_I = sandbox.STEPS.indexOf('country');
sandbox.COUNTRY = effective; sandbox.applyCountry();
$id('wantApostille').checked = true; sandbox.onScopeChange();
const opt = $id('apo-option-box').innerHTML;
const apoSupply = cfg.tiers.find(t => t.code === 'APO').supply;
check(sandbox.TIER.code === 'T3' && opt.includes('이 서류는 영문으로 발급받으시면 번역·공증 없이 아포스티유만으로 끝납니다 (' + apoSupply.toLocaleString() + '원, 부가세 별도).') &&
      opt.includes('제출처가 번역공증본을 요구하지 않는다면 이쪽이 더 간단합니다.') && opt.includes('아포스티유만으로 바꾸기'),
  `T3 → 안내 박스 + [아포스티유만으로 바꾸기] (금액 = 서버 설정값 ${apoSupply.toLocaleString()}원)`);
check(/언어 — <span class="ntr-hl">\[국문\]/.test($id('issue-guide').innerHTML) && !/\[영문\]/.test($id('issue-guide').innerHTML), 'T3 발급 안내 = 국문');
sandbox.chooseApo(true);
check(sandbox.TIER.code === 'APO' && steps() === 'doc>country>upload>ship>confirm' && sandbox.currentStep() === 'country',
  `[아포스티유만으로 바꾸기] → APO · 단계 ${steps()} · 국가 화면 유지`);
check($id('apo-option-box').innerHTML.includes('번역공증으로 돌아가기'), 'APO 상태 — [번역공증으로 돌아가기]');
check($id('apostille-field').style.display === 'none', 'APO 상태 — "아포스티유도 함께" 체크 숨김 (상품 자체가 아포스티유)');
check(/언어 — <span class="ntr-hl">\[영문\]/.test($id('issue-guide').innerHTML) && $id('issue-guide').innerHTML.includes('class="ntr-g-danger"'),
  'APO 발급 안내 = 영문 · 목적 경고 유지');
check($id('korean-only-note').style.display === 'none', 'APO — "한글 원본" 경고 숨김');
sandbox.chooseApo(false);
check(sandbox.TIER.code === 'T3' && /\[국문\]/.test($id('issue-guide').innerHTML) && $id('issue-guide').innerHTML.includes('class="ntr-g-danger"'),
  '[번역공증으로 돌아가기] → T3 · 국문 안내 · 목적 경고 유지');
check($id('apostille-field').style.display === '' && $id('wantApostille').checked === true, '돌아오면 아포스티유 체크 다시 보임 · 체크됨');
for (const c of ['resident_full', 'resident_abstract', 'immigration', 'investigation', 'biz_registration', 'tax_payment']) {
  pick(c);
  check(sandbox.TIER.code !== 'APO' && sandbox.TIER.translate !== false && $id('apo-switch-note').innerHTML === '', `${c} → 번역공증 기본 ${sandbox.TIER.code} (자동 전환 없음)`);
}

// ── 6. 졸업·성적증명서 — 학교 구분 ──
console.log('\n[6] 졸업증명서 — 국립 = 번역공증 기본 + 아포스티유만 선택지 / 사립 = 번역공증');
sandbox.SCHOOL = '';
pick('graduation');
check(!sandbox.TIER && $id('school-field').style.display === '', '학교 구분 전에는 범위 미정 + 선택지 노출');
$id('wantApostille').checked = false;
sandbox.pickSchool('국립');
check(sandbox.TIER.code === 'T2', '국립 → T2 기본 (자동 전환 없음)');
sandbox.COUNTRY = effective; sandbox.applyCountry(); $id('wantApostille').checked = true; sandbox.onScopeChange();
check(sandbox.TIER.code === 'T3' && $id('apo-option-box').innerHTML.includes('아포스티유만으로 바꾸기'), '국립 + T3 → 아포스티유만 선택지');
sandbox.chooseApo(true);
check(sandbox.TIER.code === 'APO', '국립 → 아포스티유만으로 바꾸기 → APO');
$id('wantApostille').checked = false;
sandbox.pickSchool('사립');
check(sandbox.TIER.code === 'T2' && $id('apo-option-box').innerHTML === '', '사립 → T2 번역공증 (학교를 바꾸면 APO 해제 · 선택지 없음)');
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
  ['crime_record',    ['crims.police.go.kr', '외국입국/체류 허가', '본인확인용', '2년 이하의 징역', '2천만원 이하의 벌금', '[국문]']],
  ['immigration',     ['정부24', '개명하신 분은 온라인 발급이 되지 않습니다', '[국문]']],
  ['resident_full',   ['정부24', '[국문]']],
  ['tax_payment',     ['홈택스', '[국문]']],
]) {
  pick(c);
  sandbox.renderIssueGuide();
  const h = $id('issue-guide').innerHTML;
  check(must.every(m => h.includes(m)), `${c} 배너 — ${must.join(' · ')}`);
}
pick('crime_record');
check($id('issue-guide').innerHTML.includes('class="ntr-g-danger"') && !/영문으로 발급받으시면/.test($id('issue-guide').innerHTML),
  '범죄경력회보서(번역) — 목적 경고 + 한글 원본 발급 안내 제목');
sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'APO'); sandbox.renderIssueGuide();
check(['[영문]', '여권 철자', '영문으로 발급받으시면'].every(m => $id('issue-guide').innerHTML.includes(m)) &&
      $id('issue-guide').innerHTML.includes('class="ntr-g-danger"'), '범죄경력회보서(APO) — 영문 발급 안내 + 목적 경고');
pick('family_relation');
$id('docType').value = 'contract'; sandbox.renderIssueGuide();
check($id('issue-guide').innerHTML === '', '안내 없는 서류(계약서)는 배너 없음');

// ── 9. 결제 화면 문구 ──
console.log('\n[9] 결제 화면 — 경로별 안내 · 착수 후 취소·환불 불가');
pick('crime_record'); sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'APO'); sandbox.QUOTE = { route: 'apo', pages: 1 }; sandbox.buildSummary();
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

// ── 11. 받으실 날짜 · 급행 ──
console.log('\n[11] 받으실 날짜 — 급행 판정 안내 · 동의 · 요약');
{
  // 서버 /quote 응답 모양 그대로 (3종 T2, 목 11:30, 희망 10/16)
  const sched = {
    expressAvailable: true, expressDay: '2026-10-16', normalDay: '2026-10-20',
    expressLabel: '10월 16일(금)', normalLabel: '10월 20일(화)', cutoff: '12:00',
    intakeToday: true, intakeLabel: '10월 15일(목)', extraTranslationDay: false, needsConfirm: true,
    maxDay: '2026-12-14',
    selectable: [{ day: '2026-10-16', label: '10월 16일(금)', mode: 'express' },
                 { day: '2026-10-19', label: '10월 19일(월)', mode: 'express' },
                 { day: '2026-10-20', label: '10월 20일(화)', mode: 'normal' }],
  };
  pick('family_relation');
  check(sandbox.hasWishDate(sandbox.TIER) && steps().includes('>date>'), 'T2 → 받으실 날짜 단계');
  sandbox.PAGES = 1;
  sandbox.QUOTE = { route: 'auto', pages: 1, supply: 85000, amount: 93500, express: true,
    normalPrice: { supply: 55000 }, expressPrice: { supply: 85000 }, schedule: sched,
    wish: { mode: 'express', receiveDay: '2026-10-16' } };
  sandbox.WISH = '2026-10-16'; sandbox.WISH_KEY = 'T2|family_relation||1';
  $id('docType').value = 'family_relation';
  sandbox.renderDateStep();
  const m = $id('date-mode').innerHTML;
  check(m.includes('선택하신 날짜는 급행으로만 가능합니다. 급행 요금이 적용됩니다.') &&
        m.includes('10월 20일(화) 이후로 받으실 날을 지정하시면 일반 요금으로 진행됩니다.'), '급행 안내 문구');
  check(m.includes('55,000원') && m.includes('85,000원') && (m.match(/부가세 별도/g) || []).length === 2,
    '일반·급행 금액 나란히 (부가세 별도)');
  check(m.includes('급행은 오늘 낮 12시까지 결제와 번역본 확정을 마쳐야 합니다') && m.includes('다음 영업일 기준으로 다시 계산'),
    '3종 마감 안내 (결제와 번역본 확정)');
  check(!/번역 \(|공증 \(|등기|자격인증/.test(m), '금액 분해 없음');
  check($id('wishDate').innerHTML.includes('10월 16일(금) · 급행') && $id('wishDate').innerHTML.includes('10월 20일(화)</option>'),
    '날짜 목록 — 영업일·급행 표시');
  // 급행 동의 체크 — 급행일 때만 요구
  ['ag1','ag2','ag3','ag4','ag5'].forEach(id => { $id(id).checked = true; });
  $id('ag6').checked = false;
  check(sandbox.agreedAll() === false, '급행 + ag6 미체크 → 결제 불가');
  $id('ag6').checked = true;
  check(sandbox.agreedAll() === true, '급행 + ag6 체크 → 통과');
  sandbox.buildSummary();
  const sum = $id('pay-summary').innerHTML;
  check(sum.includes('10월 16일(금) 예정 · 급행') && sum.includes('빠른등기는 발송 다음 영업일 도착이 기본'),
    '요약: 받으실 날짜 · 공통 안내');

  // 3종 외 서류 — 마감 안내는 "결제"만, 번역 1영업일 추가 표시
  pick('school_record');
  sandbox.QUOTE = { route: 'manual', pages: 10, supply: 220000, amount: 242000, express: true,
    normalPrice: { supply: 145000 }, expressPrice: { supply: 220000 },
    schedule: { ...sched, needsConfirm: false, extraTranslationDay: true, expressLabel: '10월 19일(월)', normalLabel: '10월 21일(수)' },
    wish: { mode: 'express' } };
  sandbox.renderDateStep();
  check($id('date-mode').innerHTML.includes('낮 12시까지 결제를 마쳐야') && !$id('date-mode').innerHTML.includes('확정'),
    '3종 외 — 마감 안내 "결제"만');
  check($id('date-sched').innerHTML.includes('번역 분량에 따라 1영업일이 더해졌습니다'), '번역 1영업일 추가 안내');

  // 아포스티유(T3) 마감 11시
  sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'T3');
  sandbox.renderDateStep();
  check($id('date-mode').innerHTML.includes('오전 11시'), 'T3 마감 오전 11시');

  // 선택 불가 — 다음 단계·결제 막힘
  sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'T2');
  sandbox.QUOTE = { route: 'auto', pages: 1, supply: 55000, amount: 60500, express: false, schedule: sched,
    wish: { mode: 'invalid', error: '가장 빠른 수령일은 10월 16일(금)입니다' } };
  sandbox.STEPS = ['doc','date','confirm']; sandbox.STEP_I = 1;
  check(sandbox.stepBlockReason() === '가장 빠른 수령일은 10월 16일(금)입니다', '선택 불가 → 다음 단계 막힘');

  // APO·T1 — 날짜 단계 없음
  toApo('crime_record');
  check(!steps().includes('date'), 'APO → 날짜 단계 없음');
}
// ── 12. 메인 "아포스티유" 입구 (/notary/?apostille=1) ──
console.log('\n[12] 아포스티유 입구 — 협약국을 고르면 체크가 미리 켜진다 (한 번만)');
{
  $id('wantApostille').checked = false;
  sandbox.WANT_APO_PRESET = true;
  pick('family_relation');
  sandbox.COUNTRY = effective; sandbox.applyCountry();
  check(sandbox.TIER.code === 'T3' && $id('wantApostille').checked, '협약국 선택 → T3 (아포스티유 체크됨)');
  $id('wantApostille').checked = false; sandbox.onScopeChange();
  sandbox.applyCountry();
  check(sandbox.TIER.code === 'T2' && !$id('wantApostille').checked, '고객이 끄면 다시 켜지 않는다');
  sandbox.WANT_APO_PRESET = true;
  sandbox.COUNTRY = consular; sandbox.applyCountry();
  check(sandbox.TIER.code === 'T2' && sandbox.WANT_APO_PRESET === true, '비협약국에서는 켜지 않고 다음 협약국 선택까지 유지');
  pick('crime_record');
  check(sandbox.TIER.code !== 'APO', '영문 발급 가능 서류도 자동으로 아포스티유 단독이 되지 않는다');
  sandbox.WANT_APO_PRESET = false;
}
// ── 13. 서류별 업로드 규칙 ──
console.log('\n[13] 업로드 규칙 — 온라인 발급 PDF · 종이로만 받았어요 · 원본 우편');
{
  sandbox.CFG.mailAddress = '06236 서울 강남구 테헤란로 123 IUMM';
  pick('school_record');
  check($id('issuer-box').innerHTML.includes("'PDF로 저장'한 파일을 그대로 올려 주세요") &&
        $id('issuer-box').innerHTML.includes('발급처 바로가기') && $id('issuer-box').innerHTML.includes('www.gov.kr'),
    '생활기록부 선택 즉시 — 발급처 바로가기 + 온라인 PDF 안내');
  sandbox.renderUploadRule();
  check($id('upload-rule-box').innerHTML.includes('온라인으로 발급받은 PDF 원본을 올렸습니다') &&
        $id('upload-rule-box').innerHTML.includes('종이로만 받았어요'), '업로드: 필수 체크 + 종이로만 받았어요 링크');
  sandbox.STEPS = ['doc','upload','confirm']; sandbox.STEP_I = 1; sandbox.PRECHECK_OK = true;
  sandbox.FILES.main = [{ name: 'a.pdf', size: 1 }];
  $id('onlinePdfOk').checked = false;
  check(/PDF 원본을 올렸습니다/.test(sandbox.stepBlockReason()), '체크 안 하면 다음 단계 막힘');
  $id('onlinePdfOk').checked = true;
  check(sandbox.stepBlockReason() === '', '체크하면 통과');
  // ★2026-10-16 — "종이로만 받았어요"는 원본 우편 주문으로 바꾸지 않고 카카오톡 문의 안내만
  sandbox.paperOnly();
  check(sandbox.currentRule() === 'onlinePdf' && sandbox.PAPER_ONLY === false, '종이로만 → 주문 방식 그대로 (원본 우편 경로 없음)');
  const pbox = $id('upload-rule-box').innerHTML;
  check(pbox.includes('종이로만 받으신 서류는 원본 확인이 필요합니다. 오른쪽 카카오톡 문의로 서류 사진과 함께 문의해 주세요.') &&
        pbox.includes('pf.kakao.com/_BlpKX/chat') && pbox.includes('mailto:iumm.master@gmail.com') && pbox.includes('카카오톡 문의</a>'),
    '종이로만 → 카카오톡 문의 안내 · [카카오톡 문의] 버튼 · 이메일');
  sandbox.paperOnly(false);
  check(!$id('upload-rule-box').innerHTML.includes('종이로만 받으신 서류는'), '접기');
  // 온라인 발급본이 없는 서류 9종 — 결제 흐름 없이 카카오 안내만
  const KAKAO = ['bank_balance', 'articles', 'shareholders', 'employment', 'career', 'board_minutes', 'power_of_attorney', 'contract', 'financial_stmt'];
  check(KAKAO.every(c => (sandbox.docByCode(c) || {}).kakaoOnly === true), '설정 kakaoOnly 9종 (목록에는 유지)');
  for (const c of KAKAO) {
    pick(c);
    if (!(sandbox.TIER === null && $id('kakao-doc-box').style.display === '' && /카카오톡 문의로 접수/.test(sandbox.stepBlockReason())))
      check(false, `${c} → 카카오 안내 · 결제 단계 없음`);
  }
  pick('articles');
  const kbox = $id('kakao-doc-box').innerHTML;
  check(kbox.includes('이 서류는 온라인 발급본이 없어 원본 확인이 필요합니다. 오른쪽 카카오톡 문의로 서류 사진과 함께 문의해 주세요. 확인 후 금액과 진행 방법을 안내해 드립니다.') &&
        kbox.includes('카카오톡 문의</a>') && kbox.includes('mailto:iumm.master@gmail.com'),
    '정관 → 카카오 안내 문구 + [카카오톡 문의] + 이메일');
  check($id('issuer-box').innerHTML === '', '정관 → 원본 우편 안내 없음 (발급 안내 상자 비움)');
  check(/#form-area.other-mode #btn-next{display:none !important}/.test(fs.readFileSync(path.resolve(HERE, '../notary/notary.css'), 'utf8')), '결제 흐름 없는 서류 — 다음 버튼 숨김');
  check(sandbox.TIER === null && $id('scope-field').style.display === 'none' && /카카오톡 문의로 접수해 주세요/.test(sandbox.stepBlockReason()),
    `카카오 대상 ${KAKAO.length}종 — 상품 없음 · 다음 단계 막힘`);
  pick('family_relation');
  check($id('kakao-doc-box').style.display === 'none', '다른 서류로 바꾸면 카카오 안내 닫힘');
  check(!/"종이로만 받았어요"를 눌러/.test(html), '발급 안내에 "종이로만 받았어요를 눌러" 문구 없음');
  check(html.includes('재학생과 2003년 1월 이후 졸업자는 정부24에서 본인이 직접 온라인 발급할 수 있습니다(교육청에 따라 2004년 기준).') &&
        html.includes('2002년 이전 졸업자는 온라인 발급이 되지 않습니다 — 카카오톡으로 문의해 주세요.'), '생활기록부 발급 안내 문구 교체');
  // 원본 우편은 사본공증(CPA)만 — 요약·주소 안내는 그대로
  pick('id_card_copy');
  sandbox.QUOTE = { route: 'copy', pages: 1, supply: 65000, schedule: { awaitingOriginal: true, expressAvailable: false } };
  sandbox.buildSummary();
  check($id('pay-summary').innerHTML.includes('원본 도착 후 계산'), 'CPA 요약: 받으실 날짜 = 원본 도착 후 계산');
  sandbox.CFG.mailAddress = '';
  sandbox.renderIssuerBox();
  check($id('issuer-box').innerHTML.includes('결제 후 카카오 알림으로 안내드립니다'), '주소 미설정 → 카카오 알림 안내 문구');
  sandbox.showDone({ ok: true, mailOriginal: true, mailAddress: '서울 테헤란로 1' });
  check($id('mail-box').innerHTML.includes('서울 테헤란로 1'), '결제 완료 화면에 보낼 주소');
  pick('family_relation');
  sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'T1');
  check(!sandbox.onlinePdfOnly(), '번역만(T1)은 PDF 강제 없음');
}
// ── 14. 기밀 서류 비공개 ──
console.log('\n[14] 견적 전용 서류 — 공개 위저드에 없다 (비공개 페이지로만 접수)');
{
  sandbox.renderDocPicker();
  const cats2 = $id('doc-cats').innerHTML;
  check(!cfg.docCategoryOrder.some(c => /수사/.test(c)) && !/수사/.test(cats2), '카테고리 탭에 수사 서류 없음');
  check(!cfg.documents.some(d => d.uploadRule === 'quote'), '공개 설정에 견적 전용 서류 없음');
  const visible = html.replace(/<!--[\s\S]*?-->/g, '');
  check(!/사법공조|진술조서|수사·법률|수사 서류/.test(html), '위저드 소스(주석 포함)에 기밀 서류명 없음');
  check(!/quote-box|sendQuote|qt-contact/.test(visible), '견적 양식·코드 없음');
}
// ── 15. 아포스티유 준비 서류 ──
console.log('\n[15] 아포스티유 준비 서류 — 당사자 구분 · 준비 서류 목록 · 결제 직후 업로드');
{
  pick('family_relation');
  sandbox.COUNTRY = effective; sandbox.applyCountry();
  $id('wantApostille').checked = true; sandbox.onScopeChange();
  sandbox.renderPartyBox();
  check(sandbox.TIER.code === 'T3' && $id('party-box').style.display === '', 'T3 → 당사자 구분 표시');
  sandbox.STEPS = ['doc','country','confirm']; sandbox.STEP_I = 1;
  $id('party').value = '';
  check(/서류 당사자 구분/.test(sandbox.stepBlockReason()), '당사자 구분 없으면 국가 단계 통과 못 함');
  const docsOf = (p) => { $id('party').value = p; sandbox.renderPartyBox(); return $id('party-docs').innerHTML; };
  check(docsOf('개인').includes('신청인 신분증 사본') && docsOf('개인').includes('외교부 개인정보이용동의서'), '개인: 신분증 + 외교부 동의서');
  check(docsOf('미성년자').includes('부모 신분증 사본') && docsOf('미성년자').includes('가족관계증명서') && docsOf('미성년자').includes('부모가 서명한'), '미성년자: 부모 신분증 + 가족관계증명서 + 부모 서명 동의서');
  check(docsOf('법인').includes('사업자등록증 사본') && docsOf('법인').includes('명판 + 인감 날인'), '법인: 사업자등록증 + 명판·인감 동의서');
  check(docsOf('법인(명판없음)').includes('담당자가 확인 후 안내') && docsOf('법인(명판없음)').includes('iumm.master@gmail.com'), '법인(명판없음): 담당자 확인 안내');
  $id('party').value = '개인';
  check(sandbox.stepBlockReason() === '', '당사자 고르면 통과');
  sandbox.showDone({ ok: true });
  check($id('docs-box').style.display === '' && $id('dc-party').value === '개인', '결제 완료 화면에 준비 서류 양식 (당사자 미리 선택)');
  $id('dc-party').value = '법인(명판없음)'; sandbox.renderDocsBox();
  check($id('dc-btn').disabled === true, '명판 없는 법인 → 제출 버튼 비활성 (담당자 안내)');
  toApo('crime_record');
  sandbox.renderPartyBox();
  check(sandbox.TIER.code === 'APO' && $id('party-box').style.display === '', 'APO 도 당사자 구분 표시');
  sandbox.TIER = sandbox.CFG.tiers.find(t => t.code === 'T3');
  sandbox.QUOTE = { express: true, normalPrice: { supply: 75000 }, expressPrice: { supply: 120000 }, wish: { mode: 'express' },
    schedule: { expressLabel: '10월 20일(화)', normalLabel: '10월 22일(목)', cutoff: '11:00', intakeToday: true, needsConfirm: true, selectable: [] } };
  sandbox.WISH = '2026-10-20'; sandbox.WISH_KEY = 'T3|' + $id('docType').value + '||' + sandbox.PAGES;
  sandbox.renderDateStep();
  check($id('date-mode').innerHTML.includes('준비 서류(동의서·신분증) 업로드'), '급행 마감 안내에 준비 서류 업로드 포함');
}
// ── 16. 사본공증 + 아포스티유 (CPA) ──
console.log('\n[16] 신분증·여권 사본 → 사본공증 + 아포스티유 (CPA)');
{
  sandbox.STEP_I = 0; sandbox.COUNTRY = null; sandbox.PAPER_ONLY = false;
  for (const c of ['id_card_copy', 'driver_license', 'passport_copy']) {
    pick(c);
    check(sandbox.TIER && sandbox.TIER.code === 'CPA', `${c} → CPA`);
  }
  const cpa = cfg.tiers.find(t => t.code === 'CPA');
  check(cpa.supply === 65000, 'CPA 공급가 65,000 (서버 설정)');
  check($id('apo-switch-note').innerHTML.includes(cpa.supply.toLocaleString() + '원'), 'CPA 안내 금액 = 서버 설정값');
  check(steps() === 'doc>country>upload>ship>confirm', `단계 ${steps()} (언어·이름·날짜 없음)`);
  check($id('scope-field').style.display === 'none', '"번역본만" 옵션 숨김');
  check($id('issuer-box').innerHTML.includes('신분증·여권 원본 확인이 필요합니다') &&
        $id('issuer-box').innerHTML.includes('출국 일정이 없는지'), '원본 우편 안내 — 사본공증 문구');
  sandbox.STEP_I = sandbox.STEPS.indexOf('country');
  sandbox.COUNTRY = consular; sandbox.applyCountry();
  check($id('country-note').innerHTML.includes('사본공증 + 아포스티유로 접수할 수 없습니다'), '비협약국 → 판매 불가 안내');
  check($id('apostille-field').style.display === 'none', '아포스티유 체크 숨김 (상품 자체가 아포스티유)');
  $id('party').value = '개인';
  check(/협약이 발효 중인 국가에만/.test(sandbox.stepBlockReason()), '비협약국은 국가 단계 통과 못 함');
  sandbox.COUNTRY = { ...consular, unknown: true, nameKo: '기타' }; sandbox.applyCountry();
  check(/협약이 발효 중인 국가에만/.test(sandbox.stepBlockReason()), '목록에 없는 국가도 통과 못 함');
  sandbox.COUNTRY = effective; sandbox.applyCountry();
  check(sandbox.TIER.code === 'CPA' && sandbox.stepBlockReason() === '', '협약국 + 당사자 → 통과, CPA 유지');
  check($id('party-box').style.display === '', 'CPA 도 당사자 구분 표시');
  sandbox.applyTierCopy();
  check($id('upload-head').textContent.includes('신분증·여권'), '업로드 제목 — 신분증·여권');
  check(!$id('upload-req').innerHTML.includes('PDF만'), '사진·스캔 허용 (PDF 전용 아님)');
  check(sandbox.mailOriginalOrder() && !sandbox.onlinePdfOnly(), '원본 우편 주문');
  sandbox.QUOTE = { route: 'copy', pages: 1, schedule: { awaitingOriginal: true } }; sandbox.buildSummary();
  const cn = $id('confirm-notes').innerHTML;
  check(cn.includes('번역을 진행하지 않습니다') && cn.includes('원본과 대조'), '결제 전 안내 — 번역 없음 · 원본 대조');
  check(cn.includes('신분증·여권 원본 확인이 필요합니다'), '결제 전 안내 — 원본 우편 (사본공증 문구)');
  check($id('pay-summary').innerHTML.includes('사본공증 + 아포스티유') && !$id('pay-summary').innerHTML.includes('번역 언어'), '요약 — 처리 범위 CPA · 언어 줄 없음');
  check($id('ag3-label').innerHTML.includes('사본공증과 아포스티유만'), '동의 문구 — CPA');
  sandbox.showDone({ ok: true, mailOriginal: true, mailAddress: '' });
  check($id('done-sub').textContent.includes('원본이 도착하면 사본공증'), '완료 화면 — CPA 문구');
  // 고정가 — 예상 금액에 "쪽 기준" 문구 없음
  sandbox.QUOTE = { supply: 65000, pages: 1 }; sandbox.PRECHECK_OK = false; sandbox.renderQuoteLine();
  check($id('quote-line').innerHTML.includes('65,000') && !/(쪽|페이지) 기준/.test($id('quote-line').innerHTML) &&
        $id('quote-line').innerHTML.includes('(부가세 별도)'), 'CPA 예상 금액 — "1페이지 기준" 없음');
  toApo('crime_record'); sandbox.QUOTE = { supply: 40000, pages: 1 }; sandbox.renderQuoteLine();
  check(sandbox.TIER.code === 'APO' && !/(쪽|페이지) 기준/.test($id('quote-line').innerHTML), 'APO 예상 금액 — "1페이지 기준" 없음');
  pick('school_record'); sandbox.QUOTE = { supply: 60000, pages: 1 }; sandbox.renderQuoteLine();
  check(/1페이지 기준 · 업로드 후 확정/.test($id('quote-line').innerHTML), '페이지 단가 상품은 "1페이지 기준" 유지');
  check(html.includes('<a href="/" class="logo"><span class="lg-en">IUMM</span><span class="lg-ko">아이움</span></a>'), '위저드 로고 = IUMM(lg-en) + 아이움(lg-ko)');
  check($id('mail-box').innerHTML.includes('출국 일정'), '완료 화면 — 여권 출국 일정 안내');
  check($id('docs-box').style.display === '', '완료 화면 — 아포스티유 준비 서류');
  $id('wantApostille').checked = false; pick('family_relation');
  check(sandbox.TIER.code === 'T2', '다른 서류로 바꾸면 CPA 해제 (T2)');
}
// ── 17. 여러 파일 — 누적 · 중복 무시 · 순서 · 삭제 · 10개 상한 · 디바운스 ──
console.log('\n[17] 여러 파일 업로드 — 누적 · 순서 · 삭제 · 10개 상한 · 사전검증 1회');
{
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  pick('school_record');                             // 쪽당 서류 (파일 목록·쪽수 확인용)
  sandbox.FILES.main = []; sandbox.FILES.other = [];
  let calls = 0, lastFiles = [];
  sandbox.FormData = class { constructor(){ this.f = []; } append(k, v){ if (k === 'files') this.f.push(v.name); } };
  sandbox.fetch = async (url, opt) => {
    if (/precheck/.test(url)) { calls++; lastFiles = opt.body.f;
      const pg = { 'a.pdf': 2, 'b.pdf': 1, 'c.png': 1 };
      const fp = lastFiles.map(n => pg[n] || 1);
      return { json: async () => ({ ok: true, pages: fp.reduce((s, x) => s + x, 0), filePages: fp, warnings: [] }) };
    }
    return { json: async () => ({ ok: false }) };
  };
  const F = (name, size = 1000) => ({ name, size });
  sandbox.addFiles('main', [F('a.pdf', 2000), F('b.pdf', 1000)]);
  sandbox.addFiles('main', [F('c.png', 500)]);
  check(sandbox.FILES.main.map(f => f.name).join(',') === 'a.pdf,b.pdf,c.png', '다시 골라도 기존 목록에 누적 (덮어쓰기 없음)');
  sandbox.addFiles('main', [F('a.pdf', 2000)]);
  check(sandbox.FILES.main.length === 3, '같은 파일(이름+크기)은 무시');
  check(calls === 0, '고르는 즉시 사전검증을 쏘지 않는다 (디바운스)');
  await wait(900);
  check(calls === 1 && lastFiles.join(',') === 'a.pdf,b.pdf,c.png', `목록이 바뀐 뒤 사전검증 1회 (${calls}회) · 목록 순서대로 전송`);
  check(sandbox.PAGES === 4 && /2페이지/.test($id('file-list').innerHTML) && /전체 4페이지/.test($id('precheck-msg').innerHTML),
    `PDF 2쪽 + 1쪽 + 이미지 = ${sandbox.PAGES}쪽 · 파일별 쪽수 표시`);
  check(/공증본은 이 순서대로 묶입니다/.test($id('file-list').innerHTML) && /삭제/.test($id('file-list').innerHTML) &&
        /aria-label="위로"/.test($id('file-list').innerHTML), '목록 — 순서 안내 · 위/아래 · 삭제 버튼');
  sandbox.moveFile('main', 2, -1);
  check(sandbox.FILES.main.map(f => f.name).join(',') === 'a.pdf,c.png,b.pdf' && sandbox.FILE_PAGES.join(',') === '2,1,1', '순서 바꾸기 — 파일·쪽수 함께 이동');
  await wait(900);
  check(lastFiles.join(',') === 'a.pdf,c.png,b.pdf', '바뀐 순서로 다시 확인 (주문도 같은 순서로 보냄)');
  sandbox.removeFile('main', 0);
  await wait(900);
  check(sandbox.FILES.main.length === 2 && sandbox.PAGES === 2, `삭제 반영 — ${sandbox.FILES.main.length}개 · ${sandbox.PAGES}쪽`);
  const before = calls;
  for (let i = 0; i < 12; i++) sandbox.addFiles('main', [F('x' + i + '.pdf', 100 + i)]);
  check(sandbox.FILES.main.length === 10, `10개 상한 — 11번째부터 추가 안 함 (${sandbox.FILES.main.length}개)`);
  check(/한 번에 10개까지 올릴 수 있습니다. 더 많으면 오른쪽 카카오톡 문의 또는 iumm.master@gmail.com 으로 보내 주세요./.test($id('precheck-msg').innerHTML),
    '11번째 → 안내 문구');
  await wait(900);
  check(calls === before + 1, `12번 연달아 더해도 사전검증 1회 (${calls - before}회)`);
  sandbox.addFiles('main', [F('huge.pdf', 60 * 1024 * 1024)]);
  sandbox.FILES.main = [];
  sandbox.addFiles('main', [F('huge.pdf', 60 * 1024 * 1024)]);
  check(sandbox.FILES.main.length === 0 && /파일 1개당 50MB/.test($id('precheck-msg').innerHTML), '파일 1개당 50MB 초과 → 추가 안 함 + 안내 (서버 multer 와 같은 값)');
  check(/onchange="addFiles\('main', this\.files\); this\.value=''"/.test(html), '고른 뒤 input 비움 — 지웠다 같은 파일 다시 넣기 가능');
  check(/서류가 여러 파일로 나뉘어 있으면 모두 올려 주세요. 다른 서류는 서류마다 따로 신청해 주세요./.test(html), '여러 파일 안내 한 줄');
  check(/FILES\.main\.forEach\(function\(f\)\{ fd\.append\('files', f\); \}\);/.test(html), '주문 전송 = 목록 순서');
  // 기타 서류 문의도 같은 방식
  sandbox.addFiles('other', [F('o1.pdf')]); sandbox.addFiles('other', [F('o2.jpg')]);
  check(sandbox.FILES.other.length === 2 && /o2\.jpg/.test($id('other-file-list').innerHTML), '기타 서류 문의 파일도 누적');
  sandbox.FILES.main = []; sandbox.FILES.other = [];
  sandbox.fetch = async () => ({ json: async () => ({ ok: false }) });
  await wait(900);
}
// ── 국내/해외 2택 — 해외 = 카카오톡 상담만 · 가격 없음 ──
console.log('\n[국내/해외] 2택 · 해외 안내 · 나라 선택 · 카카오톡 상담 · 로그인 없이');
{
  sandbox.CFG = cfg;   // 앞 검사(설정 다시 읽기)가 CFG 를 바꿔 둘 수 있어 실제 설정으로 되돌린다
  sandbox.SCOPE = 'dom'; sandbox.DOM_DOC = ''; sandbox.DOC_CAT = ''; $id('docType').value = ''; sandbox.renderDocPicker();
  const sc = $id('doc-scope').innerHTML;
  check(/class="ntr-scope-btn sel" aria-pressed="true" onclick="pickScope\('dom'\)"><b>국내 서류<\/b><span>한국에서 발급받은 서류<\/span>/.test(sc) &&
        /class="ntr-scope-btn" aria-pressed="false" onclick="pickScope\('ovs'\)"><b>해외 서류<\/b><span>해외에서 발급받아 한국에 제출할 서류<\/span>/.test(sc) &&
        html.indexOf('id="doc-scope"') < html.indexOf('id="doc-cats"'),
    '서류 선택 맨 위 2택 — 국내 서류(기본) · 해외 서류 + 작은 설명');
  const c = $id('doc-cats').innerHTML;
  check(['개인', '유학', '기업', '기타'].every(t => c.includes('>' + t + '<')) && !c.includes('해외') && $id('doc-cats').style.display === '',
    '국내 = 기존 탭 개인·유학·기업·기타 그대로 (해외 탭 없음)');
  check(!JSON.stringify(cfg).includes('해외 서류') && !JSON.stringify(cfg).includes('__overseas__'), '파이프라인 설정 변경 없음');
  // 국내에서 서류를 고른 뒤 해외로
  sandbox.pickCat('유학'); sandbox.pickCat('개인'); pick('family_relation'); const domTier = sandbox.TIER && sandbox.TIER.code;
  sandbox.pickScope('ovs');
  check(sandbox.TIER === null && steps() === 'doc' && $id('overseas-box').style.display === '' && $id('doc-cats').style.display === 'none' &&
        $id('doc-list').style.display === 'none' && $id('docType').value === '__overseas__', '해외 → 탭 숨김 · 안내만 · TIER=null · 결제 단계 없음');
  check(/카카오톡 상담/.test(sandbox.stepBlockReason()), '해외 — 다음 단계로 넘어가지 않음');
  check(html.includes('<strong>해외 서류 아포스티유 + 한국어 번역공증</strong>') &&
        html.includes('해외에서 발급받은 서류를 한국에 제출해야 할 때, 현지 공증·아포스티유부터 한국어 번역공증까지 한 번에 진행합니다.') &&
        html.includes('아포스티유 증명서까지 함께 번역해 제출처에서 바로 쓰실 수 있게 보내 드립니다. 나라와 서류에 따라 절차와 비용이 달라 상담 후 안내해 드립니다.'),
    '제목·설명 문구');
  const radios = $id('overseas-radios').innerHTML, names = [...radios.matchAll(/\)">([^<]+)<\/button>/g)].map(m => m[1]);
  check(names.join() === '미국,일본,중국,베트남,캐나다,호주,영국,기타' && $id('overseas-guide').innerHTML === '', '나라 8개 · 고르기 전 안내 없음');
  sandbox.pickOverseas('일본');
  const g = $id('overseas-guide').innerHTML;
  check(g.includes('① 나라: 일본<br>② 서류 종류<br>③ 제출할 곳(예: 운전면허 교환, 출입국, 학교)<br>④ 한국어 번역공증 필요 여부<br>⑤ 서류 사진') &&
        g.includes('href="https://pf.kakao.com/_BlpKX/chat" target="_blank"') && g.includes('카카오톡으로 상담하기</a>') && g.includes('iumm.master@gmail.com'),
    '나라 선택 후 — ① 나라: 일본 … ⑤ 서류 사진 + [카카오톡으로 상담하기](새 창) + 이메일');
  const box = html.slice(html.indexOf('id="overseas-box"'), html.indexOf('id="other-doc-box"'));
  check(!/\d원|금액|가격|₩/.test(box + g), '해외 — 가격 표시 없음');
  sandbox.pickScope('dom');
  check(sandbox.DOC_CAT === '개인' && $id('docType').value === 'family_relation' && $id('overseas-box').style.display === 'none' && $id('doc-cats').style.display === '' &&
        /class="ntr-docbtn sel"[^>]*onclick="pickDoc\('family_relation'\)"/.test($id('doc-list').innerHTML),
    '해외 → 국내 — 이전 탭(개인)·서류(가족관계증명서) 선택 그대로');
  sandbox.pickScope('ovs'); sandbox.pickScope('dom');
  check(!!domTier && (sandbox.TIER && sandbox.TIER.code) === domTier, `국내 흐름 그대로 (돌아온 뒤 상품 ${domTier} 그대로)`);
  // 아무것도 고르기 전에 해외 → 국내
  sandbox.DOC_CAT = ''; $id('docType').value = ''; sandbox.onDocType(); sandbox.pickScope('ovs'); sandbox.pickScope('dom');
  check($id('docType').value === '' && sandbox.TIER === null && $id('overseas-box').style.display === 'none' && steps() === 'doc', '선택 전 해외 → 국내 — 빈 서류 선택 상태');
  // 로그인 없이 — ?overseas=1 일 때만
  sandbox.OVERSEAS_ENTRY = true; sandbox.ME.kakaoId = ''; sandbox.checkLogin();
  sandbox.SCOPE = 'ovs'; $id('docType').value = '__overseas__'; sandbox.renderDocPicker(); sandbox.onDocType();
  check(sandbox.GUEST === true && $id('form-area').style.display === '' && $id('card-login').style.display === 'none' && $id('overseas-box').style.display === '',
    '/notary/?overseas=1 — 로그인 없이 해외 안내');
  sandbox.pickScope('dom');
  check(sandbox.SCOPE === 'ovs' && $id('form-area').style.display === 'none' && $id('card-login').style.display === '', '로그인 없이 보던 손님이 "국내 서류"를 누르면 → 기존 로그인 화면');
  sandbox.OVERSEAS_ENTRY = false; sandbox.checkLogin();
  check(sandbox.GUEST === false && $id('card-login').style.display === '' && $id('form-area').style.display === 'none', 'overseas=1 이 아니면 기존대로 로그인부터');
  check(/if \(OVERSEAS_ENTRY\) \{ SCOPE = 'ovs'; DOM_DOC = \$\('docType'\)\.value; \$\('docType'\)\.value = OVERSEAS_CODE; \}/.test(html) &&
        /OVERSEAS_ENTRY = new URLSearchParams\(location\.search\)\.get\('overseas'\) === '1'/.test(html),
    '?overseas=1 — "해외 서류"가 선택된 채 열림');
  sandbox.GUEST = false; sandbox.SCOPE = 'dom'; sandbox.DOM_DOC = ''; sandbox.OVERSEAS_COUNTRY = ''; sandbox.DOC_CAT = ''; $id('docType').value = ''; $id('form-area').style.display = '';
}
const visible2 =html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/협력|대행사|업체/.test(visible2), '협력업체·대행 표현 없음');

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
