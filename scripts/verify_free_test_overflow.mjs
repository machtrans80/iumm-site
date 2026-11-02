// 무료 테스트 1,000자 초과 → '1,000자 무료 + 나머지 결제' (2026-11-02): 실제 브라우저(헤드리스 Chrome)로 index.html 을 열어 확인
//   node scripts/verify_free_test_overflow.mjs     확인 + 캡처(free_test_overflow_*.png)
// 서버·카카오·결제 등 외부 주소는 막고, /api/order/free-test/check 는 페이지 안 가짜 fetch 가 답한다(스위치 켬/끔 둘 다).
// 실제 결제·주문은 하지 않는다(결제 화면까지만, 주문 접수는 보낼 값·헤더만 본다).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.resolve(HERE, '../index.html')).href;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/nanpa/iumm_internal/site_preview';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-ftov-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${tmp}`, 'about:blank']);
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  setTimeout(() => rej(new Error('Chrome 시작 실패')), 15000);
});
const port = new URL(wsUrl).port;
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0; const waiting = new Map(); const events = []; const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  else if (m.method) { events.push(m.method); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 200) + '\n' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};

// 페이지 안 가짜 서버 — window.__ft 로 응답을 바꾼다. 호출은 window.__calls 에 남는다
const FAKE = `(() => {
  window.__calls = []; window.__alerts = [];
  window.alert = (m) => window.__alerts.push(String(m));
  window.Kakao = { Auth: { getAccessToken: () => 'TOK' }, isInitialized: () => true, init() {} };
  isLoggedIn = true; currentUser = 'kim@alpha.co.kr'; currentUserName = '김'; currentUserKakaoId = '1';
  try { localStorage.setItem('iumm_userinfo_1', JSON.stringify({ phone: '010-1111-2222', company: '알파 주식회사' })); } catch (e) {}
  window.__ft = { overflowEnabled: true, rate: 25, code: '' };
  const vat = (b) => b + Math.round(b * 0.1);
  window.fetch = async (url, opt = {}) => {
    window.__calls.push({ url: String(url), headers: opt.headers || {}, body: opt.body ? JSON.parse(opt.body) : null });
    const json = (status, o) => ({ ok: status < 300, status, json: async () => o });
    if (String(url).includes('/api/order/free-test/check')) {
      const b = JSON.parse(opt.body); const n = String(b.원문텍스트 || '').replace(/\\s/g, '').length; const f = window.__ft;
      if (f.code === 'ALREADY_USED') return json(409, { ok: false, overflowEnabled: f.overflowEnabled, code: 'ALREADY_USED', error: '무료 테스트는 이미 사용하셨습니다' });
      if (!f.overflowEnabled && n > 1000) return json(400, { ok: false, overflowEnabled: false, code: 'TOO_LONG', error: '1,000자 이하로 발췌해 올려 주세요' });
      const pay = Math.max(0, n - 1000), raw = pay > 0 ? vat(pay * f.rate) : 0, amount = raw >= 1000 ? raw : 0;
      return json(200, { ok: true, overflowEnabled: f.overflowEnabled, chars: n, freeChars: 1000, payChars: amount ? pay : 0, amount, rate: f.rate });
    }
    if (String(url).includes('/api/order/free-test')) return json(200, { ok: true, orderNumber: 'IUM-FT' });
    if (String(url).includes('/api/order/create')) return json(200, { ok: true, orderNumber: 'IUM-X', pipelineStarted: true });
    return json(404, {});
  };
  return 1;
})()`;

async function open(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await ev('document.fonts.ready.then(() => 1)');
  await ev(FAKE);
  await ev(`(() => { handleAI(); document.getElementById('orderCompany').value = '알파 주식회사'; document.getElementById('lang-select').value = '한국어 → 영어'; return 1; })()`);
  await sleep(300);
}
const setText = (n) => ev(`(() => { const e = document.getElementById('pasteText'); e.value = '가'.repeat(${n}); e.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const tick = async (on) => { await ev(`(() => { const c = document.getElementById('freeTestCheck'); c.checked = ${on}; c.dispatchEvent(new Event('change')); return 1; })()`); await sleep(200); };
const txt = (id) => ev(`(document.getElementById('${id}').textContent || '').trim()`);
const shown = (id) => ev(`(() => { const e = document.getElementById('${id}'); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; })()`);
async function shot(name, id) {
  const r = await ev(`(() => { const e = document.getElementById('${id}'); e.scrollIntoView({ block: 'start' }); const a = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, a.top - 12), width: window.innerWidth, height: Math.min(window.innerHeight, a.height + 24) }; })()`);
  await sleep(200);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(s.result.data, 'base64'));
  console.log(`  캡처 ${path.join(SHOT_DIR, name)}`);
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[1] 스위치 켬 — 체크 → 자격 확인 → 할인 금액');
  await open(1280, 1400, false);
  await setText(2445);
  await tick(true);
  const c1 = await ev(`window.__calls.filter(c => c.url.includes('/free-test/check'))`);
  check(c1.length === 1 && c1[0].headers.Authorization === 'Bearer TOK' && c1[0].body.회원회사명 === '알파 주식회사', '체크하는 순간 /free-test/check (카카오 토큰 · 회사명)');
  check(await shown('freeTestQuote') && /1,000자 무료 적용 — 나머지 1,445자만 결제합니다/.test(await txt('freeTestQuote')), "'1,000자 무료 적용 — 나머지 1,445자만 결제합니다'");
  check(await ev(`(() => { const q = document.getElementById('freeTestQuote'); return q.querySelector('s').textContent === '67,238원' && q.querySelector('strong').textContent === '39,738원'; })()`), '정가 67,238원에 줄 · 할인 후 39,738원');
  check(!/발췌/.test(await txt('freeTestHint')), "'길면 발췌' 안내 대신 금액 안내");
  check(await txt('free-test-btn') === '무료 1,000자 적용하고 결제하기', "버튼 '무료 1,000자 적용하고 결제하기'");
  await shot('free_test_overflow_order.png', 'free-test-box');
  await ev(`submitFreeTest()`); await sleep(300);
  check((await ev(`window.__calls.filter(c => c.url.includes('/free-test/check')).length`)) === 2, '버튼 → 결제 전에 자격 다시 확인');
  check(await shown('modal-payment') && await shown('payment-discount-row'), '기존 결제 화면으로 · 할인 줄 보임');
  check(await txt('payment-discount-label') === '무료 테스트 1,000자' && await txt('payment-discount-amount') === '- 25,000원', "결제 화면 '무료 테스트 1,000자  - 25,000원'");
  check(await txt('payment-amount-base') === '61,125원' && await txt('payment-vat') === '3,613원' && await txt('payment-amount') === '39,738원', '번역 금액 61,125원 · 부가세 3,613원 · 최종 39,738원');
  check(!(await ev(`(window.__calls.some(c => c.url.endsWith('/api/order/free-test')))`)), '0원 무료 신청은 보내지 않음');
  await shot('free_test_overflow_payment.png', 'payment-form');
  // 접수 값 — completePayment 끝의 두 줄과 같은 처리(결제창 없이)
  await ev(`(async () => { const data = { 주문번호: 'IUM-T', 결제금액: 39738 }; if (window._ftPaySnap) { data.무료테스트적용 = true; window._ftPaySnap = null; } await submitOrderToServer(data); return 1; })()`);
  const oc = await ev(`window.__calls.filter(c => c.url.includes('/api/order/create')).at(-1)`);
  check(oc && oc.body.무료테스트적용 === true && oc.headers.Authorization === 'Bearer TOK', '/api/order/create 에 무료테스트적용=true · 카카오 토큰');
  await ev(`closeModal('payment')`);

  console.log('\n[2] 스위치 켬 — 1,036자 이하는 지금 무료 신청 그대로');
  await open(1280, 1400, false);
  await setText(1036); await tick(true);
  check(!(await shown('freeTestQuote')) && await txt('free-test-btn') === '무료 테스트 번역 신청하기', '1,036자 → 금액 줄 없음 · 무료 신청 버튼');
  await ev(`submitFreeTest()`); await sleep(300);
  check(await ev(`window.__calls.some(c => c.url.endsWith('/api/order/free-test'))`), '→ /api/order/free-test (0원)');
  await setText(1037); await tick(false); await tick(true);
  check(/나머지 37자만 결제/.test(await txt('freeTestQuote')) && /1,018원/.test(await txt('freeTestQuote')), '1,037자 → 37자 1,018원');

  console.log('\n[3] 이미 사용한 회사 — 결제 전에 안내 후 일반 주문으로');
  await open(1280, 1400, false);
  await ev(`window.__ft.code = 'ALREADY_USED'`);
  await setText(2445); await tick(true);
  check((await ev(`window.__alerts.at(-1) || ''`)).startsWith('무료 테스트는 이미 사용하셨습니다.'), "'무료 테스트는 이미 사용하셨습니다' 안내");
  check(await ev(`document.getElementById('freeTestCheck').checked === false`) && await shown('go-pay-btn') && !(await shown('free-test-btn')), '체크 풀림 · 일반 결제 버튼');

  console.log('\n[4] 협상 단가 회원');
  await open(1280, 1400, false);
  await ev(`window.__ft.rate = 20`);
  await setText(2445); await tick(true);
  check(/31,790원/.test(await txt('freeTestQuote')) && /글자당 20원/.test(await txt('freeTestQuote')), '20원 → 31,790원');

  console.log('\n[5] 스위치 꺼짐 — 지금 화면 그대로');
  await open(1280, 1400, false);
  await ev(`window.__ft.overflowEnabled = false`);
  await setText(2445); await tick(true);
  check(!(await shown('freeTestQuote')) && /길면 1,000자 이하로 발췌해 올려 주세요/.test(await txt('freeTestHint')) && await txt('free-test-btn') === '무료 테스트 번역 신청하기', '금액 줄 없음 · 발췌 안내 · 버튼 그대로');
  check(await ev(`document.getElementById('freeTestChars').style.color`) === 'rgb(255, 107, 107)', '1,000자 초과 글자 수 빨간 표시 그대로');
  await shot('free_test_overflow_off.png', 'free-test-box');
  await ev(`submitFreeTest()`); await sleep(300);
  check(/1,000자 이하로 발췌해 올려 주세요/.test(await ev(`window.__alerts.at(-1) || ''`)) && !(await shown('modal-payment')), '신청 → 발췌 안내 · 결제 화면 안 열림');
  await ev(`window.__ft.code = 'ALREADY_USED'`); await tick(false); await tick(true);
  check(await ev(`document.getElementById('freeTestCheck').checked === true`), '꺼짐이면 체크 시 자격 결과를 쓰지 않음(지금처럼 신청 때 서버가 막음)');

  console.log('\n[모바일 390px]');
  await open(390, 1200, true);
  await setText(2445); await tick(true);
  check(!(await ev(`document.documentElement.scrollWidth > window.innerWidth`)), '390px 가로 넘침 없음');
  await shot('free_test_overflow_order_mobile.png', 'free-test-box');
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
