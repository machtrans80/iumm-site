// 카카오 로그인 후 회원 판단 — index.html 의 kakaoLogin()·restoreLogin() 을 가짜 카카오 SDK·가짜 서버로 실행 (2026-10-30)
//   node scripts/verify_login_flow.mjs
// 실제 카카오·서버에 접속하지 않는다.
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
  + grab('function kakaoLogin(){', '// 기존 doSignup/doLogin');

function run({ server, local, kakaoId = 111, next = '' }) {
  const store = {}; const session = next ? { iumm_login_next: next } : {};
  if (local) store['iumm_userinfo_' + kakaoId] = JSON.stringify(local);
  const st = { page: '', toasts: [], replaced: '', calls: [], notice: { style: { display: 'none' }, textContent: '' } };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Promise,
    MEMBER_API_BASE: 'https://mock',
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: (k) => session[k] || null, removeItem: (k) => { delete session[k]; } },
    location: { replace: (u) => { st.replaced = u; }, origin: 'https://iumm.kr' },
    document: { getElementById: (id) => (id === 'login-notice' ? st.notice : null) },
    setTimeout: () => {},
    showPage: (p) => { st.page = p; }, showToast: (m) => st.toasts.push(m), updateNavAfterLogin() {},
    checkFreeTrialUsed: () => false,
    isLoggedIn: false, currentUserKakaoId: null, currentUserName: '', currentUser: '', freeTrialUsed: false,
    fetch: async (url, opt) => {
      st.calls.push(url);
      if (server === 'down') throw new Error('network');
      if (server === 500) return { ok: false, status: 500, json: async () => ({ ok: false }) };
      return { ok: true, status: 200, json: async () => server };
    },
    Kakao: {
      isInitialized: () => true, init() {},
      Auth: { login(o) { o.success({ access_token: 'TOKEN' }); }, getAccessToken: () => 'TOKEN' },
      API: { request(o) { o.success({ id: kakaoId, kakao_account: { email: 'kim@alpha.co.kr', profile: { nickname: '카톡닉' } } }); } },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code + '\nfunction safeNext(u){return u||"";}', ctx);
  ctx.kakaoLogin();
  return new Promise((r) => setTimeout(() => r({ st, store, ctx }), 30));
}

const PROFILE = { name: '김대표', phone: '010-1111-2222', company: '주식회사 알파', mainLanguages: '한국어→영어' };

console.log('\n[1] 서버가 가입 완료로 답함 · 이 브라우저에 정보 없음 (다른 기기·시크릿 창)');
{
  const { st, store, ctx } = await run({ server: { ok: true, isMember: true, signupCompleted: true, profile: PROFILE } });
  check(st.calls.some((u) => u.endsWith('/api/member/login-sync')), 'login-sync 응답을 기다려 판단');
  check(st.page === 'main', '정보 입력 화면 없이 메인으로');
  const info = JSON.parse(store['iumm_userinfo_111'] || '{}');
  check(info.name === '김대표' && info.phone === '010-1111-2222' && info.company === '주식회사 알파' && info.fromLang === '한국어' && info.toLang === '영어', '서버 프로필로 브라우저 회원 정보 채움');
  check(ctx.currentUserName === '김대표' && st.toasts.some((t) => /김대표님 환영합니다/.test(t)), '환영 안내(실명)');
}
{
  const { st } = await run({ server: { ok: true, isMember: true, signupCompleted: true, profile: PROFILE }, next: '/notary/' });
  check(st.replaced === '/notary/' && st.page !== 'userinfo', '하위 페이지에서 왔으면 그쪽으로 복귀');
}

console.log('\n[2] 신규 · 탈퇴 · 가입 미완료 → 정보 입력');
check((await run({ server: { ok: true, isMember: false, signupCompleted: false } })).st.page === 'userinfo', '신규 회원 → 정보 입력');
check((await run({ server: { ok: true, isMember: false, wasDeleted: true, signupCompleted: false } })).st.page === 'userinfo', '탈퇴 회원 → 정보 입력(복구)');
check((await run({ server: { ok: true, isMember: true, signupCompleted: false }, local: { name: '옛', phone: '010' } })).st.page === 'userinfo', '서버가 가입 미완료라 하면 브라우저 저장값보다 서버를 따름');

console.log('\n[3] login-sync 실패');
{
  const { st, ctx, store } = await run({ server: 'down' });
  check(st.page === 'login' && st.notice.textContent === '회원 정보를 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.' && st.notice.style.display === 'block', '네트워크 오류 + 저장 정보 없음 → 안내 문구 (정보 입력 화면 아님)');
  check(ctx.isLoggedIn === false && !store.iumm_user, '로그인 상태 되돌림');
}
check((await run({ server: 500 })).st.page === 'login', '서버 500 + 저장 정보 없음 → 안내 문구');
check((await run({ server: 500, local: { name: '김대표', phone: '010-1111-2222' } })).st.page === 'main', '서버 500 + 저장 정보 있음 → 기존 회원');

console.log('\n[4] 새로고침 복원 — 브라우저에 회원 정보가 없으면 서버 프로필로 채움 (화면 이동 없음)');
{
  const { st, store, ctx } = await run({ server: { ok: true, isMember: true, signupCompleted: true, profile: PROFILE } });
  delete store['iumm_userinfo_111']; st.page = '';
  store.iumm_user = JSON.stringify({ kakaoId: 111, name: '카톡닉', email: 'kim@alpha.co.kr', loginTime: Date.now() });
  ctx.restoreLogin();
  await new Promise((r) => setTimeout(r, 30));
  check(ctx.isLoggedIn && JSON.parse(store['iumm_userinfo_111'] || '{}').company === '주식회사 알파' && st.page === '', '복원 시 프로필 채움 · 화면 그대로');
}

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
