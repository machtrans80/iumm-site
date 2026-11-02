// 무료 테스트 화면 문구 (2026-11-02): 켬 = '회사당 1회, 1,000자 무료 · 넘으면 나머지만 결제' / 끔(서버 overflowEnabled=false) = 주문 화면만 예전 문구
//   node scripts/verify_free_test_copy.mjs   확인 + 캡처(free_test_copy_*.png). 하네스는 verify_consult_slots.mjs 와 같음 — /free-test/config 응답은 CDP Fetch 로 켬/끔을 바꿔 준다
// 사이트 폴더를 작은 로컬 서버로 띄운다(/assets/kakao-fab.js 를 1.5초 늦게 줘서 '늦게 불러와져도 깨지지 않음'도 본다).
// 외부 주소(카카오·네이버·서버·결제)는 막는다. 주문은 접수하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/nanpa/iumm_internal/site_preview';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  if (p === '/assets/kakao-fab.js') await sleep(1500);   // 늦게 불러와지는 경우
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = `http://127.0.0.1:${server.address().port}/`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-ftcopy-'));
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
let seq = 0; const waiting = new Map(); const events = []; const errors = []; const opened = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  else if (m.method) {
    events.push(m.method);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Page.windowOpen') opened.push(m.params.url);
  }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 200) + '\n' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
const vis = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; })()`);
const click = async (sel) => {
  // 페이지가 부드러운 스크롤이라 자리가 멈출 때까지 기다렸다가 누른다
  await ev(`(() => { document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center', behavior: 'instant' }); return 1; })()`);
  let r, prev = '';
  for (let i = 0; i < 30; i++) {
    r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    const k = JSON.stringify(r); if (k === prev) break; prev = k; await sleep(80);
  }
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(250);
  await send('Page.bringToFront');   // 새 창이 열려도 시험 화면을 앞으로(뒤로 가면 입력이 멈춘다)
};
const key = async (k) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }); await sleep(150); };
const inlineOpen = () => ev(`document.querySelector('#estimate-consult-btn .iumm-consult-inline').classList.contains('open')`);
const fabOpen = () => ev(`document.getElementById('iumm-kakao-fab').classList.contains('open')`);

async function open(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await ev('document.fonts.ready.then(() => 1)');
  await ev(`(() => { isLoggedIn = true; currentUser = 'kim@alpha.co.kr'; currentUserKakaoId = '1'; window.alert = () => {}; return 1; })()`);
}
const openOrder = (fn) => ev(`(() => { ${fn}(); document.getElementById('orderCompany').value = '알파 주식회사'; return 1; })()`);
const setText = (t) => ev(`(() => { const e = document.getElementById('pasteText'); e.value = ${JSON.stringify(t)}; e.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
async function shotEl(name, sel, pad = 16, extra = 0) {   // extra: 아래로 더 담기(떠서 펼친 경로)
  await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
  // 스크롤·모달 애니메이션이 멈춘 뒤 자리를 잰다
  let prev = '';
  for (let i = 0; i < 20; i++) { await sleep(150); const cur = await ev(`JSON.stringify(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect())`); if (cur === prev) break; prev = cur; }
  const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const a = e.getBoundingClientRect(); let f = e, fixed = false; while (f && f !== document.body) { if (getComputedStyle(f).position === 'fixed') { fixed = true; break; } f = f.parentElement; } const ox = fixed ? 0 : scrollX, oy = fixed ? 0 : scrollY; return { x: Math.max(0, a.left - ${pad}) + ox, y: Math.max(0, a.top - ${pad}) + oy, width: Math.min(window.innerWidth, a.width + ${pad * 2}), height: a.height + ${pad * 2} + ${extra} }; })()`);
  await sleep(250);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(s.result.data, 'base64'));
  console.log(`  캡처 ${path.join(SHOT_DIR, name)}`);
}

// /api/order/free-test/config 응답 — CONFIG.on 으로 켬/끔
const CONFIG = { on: true, hits: 0 };
ws.addEventListener('message', async (e) => {
  const m = JSON.parse(e.data);
  if (m.method !== 'Fetch.requestPaused') return;
  CONFIG.hits++;
  const body = Buffer.from(JSON.stringify({ ok: true, overflowEnabled: CONFIG.on, freeChars: 1000 })).toString('base64');
  send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, body,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: '*' }] });
});
const MORE = '1,000자를 넘으면 1,000자는 무료, 나머지만 결제합니다.';
const text = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}).textContent || '').replace(/\\s+/g, ' ').trim()`);
const showP = (p) => ev(`(() => { showPage(${JSON.stringify(p)}); return 1; })()`).then(() => sleep(300));
const noOverflow = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return document.documentElement.scrollWidth <= window.innerWidth && e.scrollWidth <= e.clientWidth + 1; })()`);
const waitConfig = async () => { for (let i = 0; i < 40 && CONFIG.hits === 0; i++) await sleep(100); await sleep(200); };
const orderFree = async () => {
  await openOrder('handleAI');
  await ev(`(() => { const c = document.getElementById('freeTestCheck'); c.checked = true; c.dispatchEvent(new Event('change')); return 1; })()`); await sleep(300);
};

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*kakao.com*', '*kakaocdn*', '*naver.com*', '*portone*', '*iumm.kr*', '*google*'] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*free-test/config*' }] });

  console.log('\n[0] 페이지 원본 — 고정 문구(켬 기준)에 예전 표현이 없음');
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body'));
  // 약관·처리방침 본문과 지난 개정 안내(page-terms·page-privacy)는 이번에 고치지 않는다 — 그 밖에서만 본다
  const cut = (s, id) => { const a = s.indexOf(`<div id="${id}"`); if (a < 0) return s; let d = 0, i = a; const re = /<div\b|<\/div>/g; re.lastIndex = a; let m; while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0) { i = re.lastIndex; break; } } return s.slice(0, a) + s.slice(i); };
  const shown = ['page-terms', 'page-privacy', 'page-biz-terms'].reduce(cut, body).replace(/<script[\s\S]*?<\/script>/g, '');
  check(!/1,000자 이하|결제 없이|결제 없음|발췌/.test(shown), "화면 HTML(약관 본문 제외)에 '1,000자 이하'·'결제 없이'·'결제 없음'·'발췌' 없음");
  check(html.includes("품질 확인이 목적이라면 무료 테스트 번역(회사당 1회, 1,000자 무료)을 이용해 주세요.") && !html.includes('품질 확인이 목적이라면 무료 테스트 번역(회사당 1회, 1,000자 이하)'), '1,000원 미만 경고창 — (회사당 1회, 1,000자 무료)');

  console.log('\n[1] 스위치 켬 (서버 overflowEnabled=true)');
  CONFIG.on = true; CONFIG.hits = 0;
  await open(1280, 1000, false); await waitConfig();
  check(CONFIG.hits === 1, '페이지가 /api/order/free-test/config 를 한 번 물음');
  check((await text('#business')).includes('회사당 1회, 1,000자까지 무료로 번역해 드립니다. ' + MORE), '랜딩 카드');
  check((await ev(`[...document.querySelectorAll('details')].map(d => d.textContent.replace(/\\s+/g, ' ')).find(t => t.includes('품질을 확인')) || ''`)).includes('무료 테스트 번역을 해 드립니다. ' + MORE), '랜딩 FAQ');
  await showP('faq');
  check((await text('#page-faq')).includes('무료 테스트 번역을 해 드립니다. ' + MORE), 'FAQ 페이지');
  await showP('login');
  check((await text('#page-login')).includes('무료 테스트 번역 — 회사당 1회, 1,000자 무료') && !/1,000자 이하/.test(await text('#page-login')), '로그인 화면');
  await shotEl('free_test_copy_login.png', '#page-login p[style*="line-height:1.9"]', 24);
  await showP('userinfo');
  check((await text('#page-userinfo')).includes('무료 테스트 번역 — 회사당 1회, 1,000자 무료') && !/결제 없음/.test(await text('#page-userinfo')), '가입 정보 화면');
  await ev(`(() => { document.getElementById('page-userinfo').style.display = 'none'; document.getElementById('page-login').style.display = 'none'; document.getElementById('page-faq').style.display = 'none'; document.body.style.overflow = ''; return 1; })()`);

  await orderFree();
  check(await text('#freeTestDesc') === '회사당 1회, 1,000자(공백 제외) 무료 · ' + MORE, '주문 화면 무료 테스트 칸 설명');
  check(await text('#freeTestHint') === MORE + ' 위에 적은 회사명으로 신청됩니다.', '주문 화면 안내(발췌 안내 없음)');
  check(await text('#plan-desc') === '무료 테스트 번역 · 회사당 1회 · 1,000자 무료 · 넘으면 나머지만 결제', '주문 화면 무료 테스트 탭 설명');
  check(!/결제 없이|결제 없음|발췌|1,000자 이하/.test(await text('#free-test-box')), "무료 테스트 칸에 '결제 없이'·'발췌'·'1,000자 이하' 없음");
  await shotEl('free_test_copy_order_on.png', '#free-test-box', 16);
  await setText('가'.repeat(1036));
  check(/함께 무료로 번역합니다/.test(await text('#freeTestHint')) && !/결제 없이/.test(await text('#freeTestHint')), '1,036자 안내 — 결제 없이 대신 함께 무료로');
  await setText('계약 조건을 확인해 주세요. '.repeat(30));
  await ev(`(() => { goToPayment(); return 1; })()`); await sleep(300);
  check((await text('#payment-form')).includes('무료 테스트 번역(회사당 1회, 1,000자 무료)을 이용해 주세요.'), '결제 화면 안내');
  await shotEl('free_test_copy_payment.png', '#payment-form p:has(> a[onclick*="openFreeTest"])', 12);

  console.log('\n[2] 스위치 끔 (서버 overflowEnabled=false) — 주문 화면만 예전 문구, 고정 문구는 켬 기준 그대로');
  CONFIG.on = false; CONFIG.hits = 0;
  await open(1280, 1000, false); await waitConfig();
  await orderFree();
  check(await text('#freeTestDesc') === '회사당 1회, 1,000자(공백 제외)까지 결제 없이 번역해 드립니다.', '칸 설명 → 예전');
  check(await text('#freeTestHint') === '길면 1,000자 이하로 발췌해 올려 주세요. 위에 적은 회사명으로 신청됩니다.', '안내 → 예전(발췌)');
  check(await text('#plan-desc') === '무료 테스트 번역 · 회사당 1회 · 1,000자 이하 · 결제 없음', '탭 설명 → 예전');
  check((await text('#business')).includes(MORE), '랜딩 카드는 켬 기준 그대로');
  await shotEl('free_test_copy_order_off.png', '#free-test-box', 16);

  console.log('\n[3] 서버 응답이 없어도 깨지지 않음 (켬 문구 기본값)');
  await send('Fetch.disable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao.com*', '*naver.com*', '*iumm.kr*', '*google*'] });
  await open(1280, 1000, false); await sleep(500);
  await orderFree();
  check(await text('#freeTestDesc') === '회사당 1회, 1,000자(공백 제외) 무료 · ' + MORE, '설정을 못 받으면 켬 문구(지금 운영 상태) 그대로');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*free-test/config*' }] });
  await send('Network.setBlockedURLs', { urls: ['*kakao.com*', '*kakaocdn*', '*naver.com*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[모바일 390px] 줄바꿈 · 넘침');
  CONFIG.on = true; CONFIG.hits = 0;
  await open(390, 844, true); await waitConfig();
  check(await noOverflow('#business'), '랜딩 카드 — 가로 넘침 없음');
  await shotEl('free_test_copy_landing_mobile.png', '#business .c:nth-child(5)', 12);
  await showP('login');
  check(await noOverflow('#page-login'), '로그인 화면 — 넘침 없음');
  await ev(`(() => { document.getElementById('page-login').style.display = 'none'; return 1; })()`);
  await orderFree();
  check(await ev(`(() => { const d = document.getElementById('freeTestDesc'), h = document.getElementById('freeTestHint'), box = document.getElementById('free-test-box').getBoundingClientRect();
    return [d, h].every(e => { const r = e.getBoundingClientRect(); return r.right <= box.right + 0.5 && e.scrollWidth <= e.clientWidth + 1; }) && document.documentElement.scrollWidth <= window.innerWidth; })()`), '주문 화면 무료 테스트 칸 — 칸 안에서 줄바꿈, 넘침 없음');
  await ev(`document.getElementById('free-test-box').scrollIntoView({ block: 'center', behavior: 'instant' })`); await sleep(800);
  { const s = await send('Page.captureScreenshot', { format: 'png' });   // 390px 화면 전체 — 칸 안 줄바꿈을 앞뒤와 함께
    fs.writeFileSync(path.join(SHOT_DIR, 'free_test_copy_order_mobile.png'), Buffer.from(s.result.data, 'base64'));
    console.log(`  캡처 ${path.join(SHOT_DIR, 'free_test_copy_order_mobile.png')}`); }
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill(); server.close();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
