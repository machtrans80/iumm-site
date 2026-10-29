// 무료 테스트 번역 · 무상 수정 1회 — index.html 의 화면 함수를 가짜 서버로 실행 (2026-10-30)
//   node scripts/verify_free_test_revision.mjs
// 실제 카카오·서버에 접속하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(HERE, '../index.html'), 'utf8').split('\r\n').join('\n');
const grab = (start, end) => { const a = html.indexOf(start), b = html.indexOf(end, a); if (a < 0 || b < 0) throw new Error('없음: ' + start); return html.slice(a, b); };
const code = grab('// ─── 무료 테스트 번역 (2026-10-29)', 'function goToPayment(){')
  + grab('// ─── 무료 테스트 · 14일 무상 수정', 'async function loadMyOrders(){')
  + grab('function corpOrderPayload(){', 'function goToPayment(){')
  + grab('function completeUserInfo(){', '\n}\n') + '\n}\n'
  + 'function _esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}'
  + 'function _myOrderDate(s){return String(s).slice(0,10);}';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.error('  ❌ ' + m); } };
const els = {};
const el = (id) => (els[id] = els[id] || { id, value: '', checked: false, style: {}, textContent: '', disabled: false, dataset: {}, options: [{ text: '게임 (…)' }], selectedIndex: 0, focus() {}, classList: { toggle() {} } });
const alerts = [], toasts = [], calls = [], store = {};
const ctx = {
  window: { _inputMode: 'paste' }, alert: (m) => alerts.push(m), console, JSON, Date,
  localStorage: { getItem: (k) => (k in store ? store[k] : JSON.stringify({ phone: '010-1234-5678' })), setItem: (k, v) => { store[k] = v; } },
  document: { getElementById: el, querySelector: () => null }, Kakao: { Auth: { getAccessToken: () => 'TOKEN' } }, MEMBER_API_BASE: 'https://mock',
  isLoggedIn: true, currentUser: 'kim@mach.co.kr', currentUserName: '김', currentUserKakaoId: '1', currentPlan: 'ai',
  closeModal() {}, showToast: (m) => toasts.push(m), loadMyOrders() {}, applyOrderPlanTheme() {}, showPage() {}, updateNavAfterLogin() {},
  getSourceText: () => el('pasteText').value,
  fetch: async (url, opt) => { calls.push({ url, opt }); return { ok: true, json: async () => ({ ok: true, orderNumber: 'IUM-1' }) }; },
};
vm.createContext(ctx); vm.runInContext(code, ctx);
['go-pay-btn', 'free-test-btn', 'freeTestInfo', 'free-test-box', 'freeTestChars'].forEach(el);

console.log('\n[1] 무료 테스트 — 글자 수(공백 제외, 유료와 같은 방식) · 회사명');
el('lang-select').value = '한국어 → 영어'; el('field-select').value = 'gaming'; el('orderCompany').value = '(주)마하';
for (const [n, ok] of [[999, true], [1000, true], [1001, false]]) {
  el('pasteText').value = '가 '.repeat(n); const before = calls.length; alerts.length = 0;
  await ctx.submitFreeTest();
  check(ok ? calls.length === before + 1 : (calls.length === before && /1,000자 이하로 발췌해/.test(alerts.at(-1) || '')), `${n.toLocaleString()}자(공백 ${n}개 별도) → ${ok ? '접수' : '서버 호출 없이 안내'}`);
}
const c = calls.at(-1), body = c && JSON.parse(c.opt.body);
check(c && c.url === 'https://mock/api/order/free-test' && c.opt.headers.Authorization === 'Bearer TOKEN', '/api/order/free-test · 카카오 토큰');
check(body && body.회원회사명 === '(주)마하' && !('결제금액' in body) && !('플랜' in body), '회사명 전달 · 금액·플랜은 서버가 정함');
el('orderCompany').value = ''; el('pasteText').value = '가'.repeat(10); const n0 = calls.length; await ctx.submitFreeTest();
check(calls.length === n0 && /회사명/.test(alerts.at(-1)), '주문 화면 회사명 없으면 막음');

console.log('\n[2] 가입 정보 입력 — 회사명 필수');
Object.assign(el('signup-name'), { value: '김대표' }); Object.assign(el('signup-phone'), { value: '010-1111-2222' });
el('agree-terms').checked = true; el('agree-privacy').checked = true; el('signup-company').value = '  ';
const n1 = calls.length; ctx.completeUserInfo();
check(toasts.at(-1) === '회사명을 입력해주세요' && calls.length === n1 && !store.iumm_userinfo_1, '회사명 빈칸 → 저장·서버 전송 없음');

console.log('\n[3] 무상 수정 — 유료 주문 1회');
const base = { orderNumber: 'IUM-9', revision: { can: true, reason: '', until: '2026-11-12T00:00:00Z', count: 0, max: 1 } };
check(ctx._myRevision(base).includes('>수정 요청</button>') && ctx._myRevision(base).includes('1회 무료') && !/남은 횟수/.test(ctx._myRevision(base)), '수정 가능 → [수정 요청] · 1회 무료');
const CLOSED = '수정 요청을 이미 사용했거나 수정 기간이 지났습니다. 문의해 주세요.';
check(ctx._myRevision({ ...base, revision: { ...base.revision, can: false, reason: 'max_reached', count: 1 } }).includes(CLOSED) && !ctx._myRevision({ ...base, revision: { ...base.revision, can: false, reason: 'max_reached' } }).includes('</button>'), '1회 사용 → 안내 문구 · 버튼 없음');
check(ctx._myRevision({ ...base, revision: { ...base.revision, can: false, reason: 'expired' } }).includes(CLOSED), '14일 지남 → 같은 안내 문구');
check(ctx._myRevision({ ...base, isFreeTest: true }) === '', '무료 테스트 주문 → 버튼·문구 없음');
check(ctx._myRevision({ ...base, revision: { can: false, reason: 'not_paid' } }) === '', '미결제·0원 주문 → 버튼·문구 없음');
check(ctx._myRevision({ ...base, revision: { reason: 'not_delivered' } }) === '', '납품 전 → 표시 없음');
const id = 'rev-IUM-9'; const box = { dataset: { order: 'IUM-9' }, querySelector: (q) => (q.includes('kind') ? { value: 'source_change' } : q === '.rev-reason' ? { value: '3문단 용어' } : { value: '3' }) };
els[id] = box; const n2 = calls.length; await ctx.submitRevision(id);
check(calls.length === n2 && /새 주문으로 접수/.test(alerts.at(-1)), '원문 변경 선택 → 새 주문 안내(요청 안 보냄)');
box.querySelector = (q) => (q.includes('kind') ? { value: 'fix' } : q === '.rev-reason' ? { value: '3문단 용어' } : { value: '3' });
await ctx.submitRevision(id); const rc = calls.at(-1);
check(rc.url === 'https://mock/api/member/orders/IUM-9/revision' && JSON.parse(rc.opt.body).kind === 'fix', '번역 수정 → /revision 호출');

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
