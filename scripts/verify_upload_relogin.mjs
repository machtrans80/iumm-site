// 파일 올리기 중 로그인 만료 → '다시 로그인' 안내 → 카카오 다시 로그인 → 주문 창 복귀·입력 유지 (2026-10-30)
//   node scripts/verify_upload_relogin.mjs
// index.html 의 실제 함수를 가짜 카카오 SDK·가짜 서버·가짜 화면으로 실행한다. 실제 카카오·서버에 접속하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(HERE, '../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const grab = (start, end) => { const a = html.indexOf(start), b = html.indexOf(end, a); if (a < 0 || b < 0) throw new Error('없음: ' + start); return html.slice(a, b); };
const code = grab('function consumeLoginNext(){', '// 페이지 진입 시 URL hash')
  + grab('function kakaoLogin(){', '// 기존 doSignup/doLogin')
  + grab('function uploadAuthHeaders(){', '/* [D-1c-frontend] 참고자료 업로드 헬퍼 */')
  + grab('async function runCustomerOcr() {', '  } catch(err) {') + '} catch(err){} }\n'
  + 'async ' + grab('function handleExtractFileChange(input) {', 'function clearPasteText()')
  + grab('function goToPayment(){', '  // estimate-amount에 이미') + '  window._paymentOpened=true;\n}\n';

check(html.includes('보안을 위해 다시 로그인해 주세요.') && html.includes('>카카오로 다시 로그인</button>'), "주문 창 안내 문구 '보안을 위해 다시 로그인해 주세요.' + [카카오로 다시 로그인] 버튼");

function setup({ token = null, server401 = false } = {}) {
  const el = (v = '') => ({ value: v, style: { display: 'none' }, textContent: '', innerHTML: '', dataset: {}, checked: false, scrollIntoView() {} });
  const els = {
    'modal-order': el(), 'upload-relogin-notice': el(), 'login-notice': el(),
    pasteText: el('붙여 넣은 원문입니다.'), 'lang-select': el('한국어→영어'), 'field-select': el('legal'),
    'extract-file-name': el(), 'btn-clear-extract': el(), 'extract-status': el(), 'extracted-notice': el(),
    'btn-customer-ocr': el(), 'ocr-customer-status': el(), 'ocr-result-section': el(), 'ocr-result-text': el(),
  };
  els['modal-order'].style.display = 'block';
  const st = { page: '', toasts: [], uploads: [], closed: [], token, plan: 'standard' };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Promise, Array, Error, String,
    MEMBER_API_BASE: 'https://mock', EXTRACT_API: 'https://mock/api/extract-source', IMAGE_EXTS: ['jpg', 'png'],
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, removeItem() {} },
    location: { replace() {}, origin: 'https://iumm.kr' },
    document: { getElementById: (id) => els[id] || null },
    setTimeout: () => {}, alert: () => {},
    showPage: (p) => { st.page = p; }, showToast: (m) => st.toasts.push(m), updateNavAfterLogin() {},
    closeModal: (id) => { st.closed.push(id); if (els['modal-' + id]) els['modal-' + id].style.display = 'none'; },
    checkFreeTrialUsed: () => false, calcTextChads() {}, showEstimate() {},
    getSourceText: () => els.pasteText.value, checkCorpBeforePayment: () => true,
    isLoggedIn: true, currentUserKakaoId: 111, currentUserName: '김대표', currentUser: 'kim@alpha.co.kr', freeTrialUsed: false,
    FormData: class { append() {} },
    fetch: async (url, opt) => {
      if (url.endsWith('/api/member/login-sync')) return { ok: true, status: 200, json: async () => ({ ok: true, isMember: true, signupCompleted: true, profile: { name: '김대표' } }) };
      st.uploads.push({ url, auth: (opt.headers || {}).Authorization || '' });
      if (server401) return { ok: false, status: 401, json: async () => ({ success: false, code: 'LOGIN_REQUIRED' }) };
      return { ok: true, status: 200, json: async () => ({ success: true, text: '추출된 원문', charCount: 5 }) };
    },
    Kakao: {
      isInitialized: () => true, init() {},
      Auth: { login(o) { st.token = 'NEW_TOKEN'; o.success({ access_token: 'NEW_TOKEN' }); }, getAccessToken: () => st.token },
      API: { request(o) { o.success({ id: 111, kakao_account: { email: 'kim@alpha.co.kr', profile: { nickname: '카톡닉' } } }); } },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code
    + '\nfunction safeNext(u){return u||"";}'
    + '\nfunction saveProfileFromServer(){return {};}'
    + '\nfunction hasLocalUserInfo(){return true;}'
    + '\nfunction memberLoginSync(t){return fetch(MEMBER_API_BASE+"/api/member/login-sync",{}).then(function(r){return r.json();});}'
    + '\nfunction loginDecision(s){return s&&s.signupCompleted?"member":"new";}', ctx);
  return { st, els, ctx };
}
const tick = () => new Promise((r) => setTimeout(r, 30));
const fileInput = (name) => ({ files: [{ name }], value: 'fakepath/' + name });

console.log('\n[1] 토큰 만료(없음) 상태에서 파일 추출 → 서버로 보내지 않고 안내');
{
  const { st, els, ctx } = setup({ token: null });
  const input = fileInput('계약서.pdf');
  await ctx.handleExtractFileChange(input);
  check(st.uploads.length === 0, '토큰 없이 업로드 요청을 보내지 않음');
  check(els['upload-relogin-notice'].style.display === 'block', "'보안을 위해 다시 로그인해 주세요.' 안내 표시");
  check(input.value === '', '파일 선택 비움(다시 골라야 함)');
  check(els.pasteText.value === '붙여 넣은 원문입니다.', '붙여 넣은 글 유지');

  console.log('\n[2] [카카오로 다시 로그인] → 주문 창으로 복귀 · 입력 유지');
  ctx.uploadRelogin();
  await tick();
  check(st.page === '', "메인 화면으로 옮기지 않음(showPage('main') 안 부름)");
  check(els['modal-order'].style.display === 'block', '주문 창 그대로 열림');
  check(els['upload-relogin-notice'].style.display === 'none', '안내 닫힘');
  check(els.pasteText.value === '붙여 넣은 원문입니다.' && els['lang-select'].value === '한국어→영어' && els['field-select'].value === 'legal' && st.plan === 'standard', '요금제·분야·언어·붙여 넣은 글 유지');
  check(st.toasts.some((t) => /파일은 다시 골라 주세요/.test(t)), "'파일은 다시 골라 주세요' 안내");
  check(ctx._uploadReloginPending === false, '다시 로그인 표시 해제');

  console.log('\n[3] 다시 로그인 뒤 파일 추출 → 새 토큰으로 업로드');
  await ctx.handleExtractFileChange(fileInput('계약서.pdf'));
  check(st.uploads.length === 1 && st.uploads[0].auth === 'Bearer NEW_TOKEN', '새 카카오 토큰(Authorization: Bearer) 붙여 업로드');
}

console.log('\n[4] 토큰은 있으나 서버가 401(만료) → 같은 안내');
{
  const { st, els, ctx } = setup({ token: 'OLD_TOKEN', server401: true });
  const input = fileInput('scan.png');
  await ctx.handleExtractFileChange(input);
  check(st.uploads.length === 1 && els['upload-relogin-notice'].style.display === 'block', '401 → 다시 로그인 안내');
  check(/다시 로그인해 주세요/.test(els['extract-status'].innerHTML) && input.value === '', '상태 문구 + 파일 선택 비움');
  ctx._ocrCustomerFiles = [{ name: 'a.pdf' }];
  els['upload-relogin-notice'].style.display = 'none';
  await ctx.runCustomerOcr();
  check(els['upload-relogin-notice'].style.display === 'block' && /다시 로그인/.test(els['ocr-customer-status'].textContent), 'OCR 버튼도 401 → 같은 안내');
}

console.log('\n[5] 결제 직전: 원문 파일·참고자료가 있고 토큰이 없으면 결제 창을 열지 않음');
{
  const { st, els, ctx } = setup({ token: null });
  ctx._iummSourceFiles = [{ name: 'a.pdf' }];
  ctx.goToPayment();
  check(!ctx._paymentOpened && !st.closed.includes('order') && els['upload-relogin-notice'].style.display === 'block', '결제 전에 다시 로그인 안내(주문 창 유지)');
  ctx._iummSourceFiles = []; ctx._referenceFiles = [];
  ctx.goToPayment();
  check(ctx._paymentOpened === true, '올릴 파일이 없으면 그대로 결제로 진행');
  const t = setup({ token: 'TOKEN' }); t.ctx._referenceFiles = [{ name: 'ref.docx' }];
  t.ctx.goToPayment();
  check(t.ctx._paymentOpened === true, '토큰이 있으면 그대로 결제로 진행');
}

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
