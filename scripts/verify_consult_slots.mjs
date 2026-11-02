// 사이트에 직접 있던 카카오톡 주소 3곳 → 공용 상담 버튼 (2026-11-02): 결제 [문의하기] · 랜딩 [NDA 체결 문의] · 푸터 [고객센터]
//   node scripts/verify_consult_slots.mjs   확인 + 캡처(consult_*.png). 하네스는 verify_estimate_consult.mjs 와 같음
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-slots-'));
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
  const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center', behavior: 'instant' }); const a = e.getBoundingClientRect(); return { x: Math.max(0, a.left - ${pad}) + scrollX, y: Math.max(0, a.top - ${pad}) + scrollY, width: Math.min(window.innerWidth, a.width + ${pad * 2}), height: a.height + ${pad * 2} + ${extra} }; })()`);
  await sleep(250);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(s.result.data, 'base64'));
  console.log(`  캡처 ${path.join(SHOT_DIR, name)}`);
}
const isOpen = (sel) => ev(`document.querySelector(${JSON.stringify(sel + ' .iumm-consult-inline')}).classList.contains('open')`);
const away = async () => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 }); await sleep(200); };
const sameRoutes = (sel) => ev(`(() => { const a = [...document.querySelectorAll(${JSON.stringify(sel + ' .ci-go a')})], f = [...document.querySelectorAll('#iumm-kakao-fab .fab-go a')];
  const bg = (x) => getComputedStyle(x).backgroundColor;
  return a.length === 2 && a.every((x, i) => x.href === f[i].href && x.target === '_blank' && /noopener/.test(x.rel) && !!x.querySelector('svg') && bg(x) === bg(f[i])); })()`);
async function routesOpenEach(sel) {
  opened.length = 0;
  await click(sel + ' a.ntalk');
  await click(sel + ' .ci-main');
  await click(sel + ' a.kakao');
  return opened.length === 2 && opened[0].includes('talk.naver.com') && opened[1].includes('pf.kakao.com');
}
async function notClosingEachOther(sel) {
  await click(sel + ' .ci-main');
  await click('#iumm-kakao-fab .fab-main');
  const a = (await isOpen(sel)) && (await fabOpen());
  await click(sel + ' .ci-main');           // 이쪽 닫기
  const b = !(await isOpen(sel)) && (await fabOpen());
  await click(sel + ' .ci-main');           // 다시 열기
  const c = (await isOpen(sel)) && (await fabOpen());
  await click('#iumm-kakao-fab .fab-main'); // 오른쪽 아래 닫기
  const d = (await isOpen(sel)) && !(await fabOpen());
  await key('Escape');
  return a && b && c && d && !(await isOpen(sel));
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao.com*', '*kakaocdn*', '*naver.com*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[0] 주소는 kakao-fab.js 에만');
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  check(!/pf\.kakao\.com|talk\.naver\.com/.test(html), 'index.html 에 pf.kakao.com · talk.naver.com 0곳');
  check(html.includes('/assets/kakao-fab.js?v=7') && !/kakao-fab\.js\?v=[0-6]\b/.test(html), 'kakao-fab.js?v=7');

  console.log('\n[1] 결제 화면 [문의하기]');
  await open(1280, 1000, false);
  await openOrder('handleAI');
  await setText('계약 조건을 확인해 주세요. '.repeat(30));
  await ev(`(() => { goToPayment(); return 1; })()`); await sleep(300);
  check(await vis('#modal-payment') && await vis('#pay-consult .ci-main'), '결제 화면에 [문의하기]');
  check(await ev(`document.querySelector('#pay-consult .ci-main').textContent.trim() === '문의하기' && /궁금한 점이 있으신가요\\?/.test(document.getElementById('pay-consult').parentElement.textContent)`), "'궁금한 점이 있으신가요?' + [문의하기]");
  check(await ev(`(() => { const a = document.querySelector('#pay-consult .ci-main').getBoundingClientRect(), b = document.getElementById('pay-btn').getBoundingClientRect(); return a.height < b.height && a.width < b.width && Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)) < 2; })()`), '결제 버튼보다 작게 · 가운데');
  await ev(`(() => { document.getElementById('lang-agree').checked = true; return 1; })()`);
  const before = await ev(`JSON.stringify([document.getElementById('payment-amount').textContent, document.getElementById('payment-lang').textContent, document.getElementById('lang-agree').checked, document.getElementById('pasteText').value.length])`);
  await click('#pay-consult .ci-main');
  check(await vis('#pay-consult a.ntalk') && await vis('#pay-consult a.kakao') && await sameRoutes('#pay-consult'), '누르면 네이버 톡톡·카카오톡 (같은 주소·색·아이콘·새 창)');
  check(await ev(`(() => { const g = [...document.querySelectorAll('#pay-consult .ci-go a')].map(a => a.getBoundingClientRect()), b = document.querySelector('#pay-consult .ci-main').getBoundingClientRect(); const mid = (g[0].left + g[1].right) / 2; return g[0].top >= b.bottom && Math.abs(mid - (b.left + b.width / 2)) < 3; })()`), '버튼 아래 가운데로 펼침');
  await away(); await shotEl('consult_payment.png', '#pay-consult', 40);
  check(await routesOpenEach('#pay-consult'), '각각 새 창으로 열림');
  check(await ev(`JSON.stringify([document.getElementById('payment-amount').textContent, document.getElementById('payment-lang').textContent, document.getElementById('lang-agree').checked, document.getElementById('pasteText').value.length])`) === before && await vis('#modal-payment'), '결제 창 내용 그대로 (금액·번역 방향·동의 체크·원문)');
  check(await notClosingEachOther('#pay-consult'), '오른쪽 아래 상담하기와 서로 안 닫힘 · Esc 로 닫힘');
  check(await vis('#modal-payment'), 'Esc 뒤에도 결제 창 그대로');

  console.log('\n[2] 랜딩 [NDA 체결 문의]');
  await open(1280, 1000, false);
  check(await vis('#nda-consult .ci-main') && await ev(`document.querySelector('#nda-consult .ci-main').textContent.trim() === 'NDA 체결 문의'`), '[NDA 체결 문의] 보임');
  const sz = await ev(`(() => { const n = document.querySelector('#nda-consult .ci-main').getBoundingClientRect(), f = document.querySelector('.lp-biz-act .lp-btn:not(.ci-main)').getBoundingClientRect(); return { nh: n.height, fh: f.height, top: Math.abs(n.top - f.top), nl: n.left - f.right }; })()`);
  check(sz.nh === sz.fh && sz.top < 1 && sz.nl > 0, `지금 크기·위치 그대로 (높이 ${sz.nh}px, 무료 테스트 버튼 옆)`);
  check(await ev(`(() => { const ref = document.createElement('a'); ref.className = 'lp-btn line dark'; ref.textContent = 'NDA 체결 문의'; document.querySelector('.lp-biz-act').appendChild(ref);
    const a = getComputedStyle(document.querySelector('#nda-consult .ci-main')), r = getComputedStyle(ref);
    const ok = ['backgroundColor', 'color', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'fontSize', 'fontWeight', 'minHeight', 'paddingLeft'].every((k) => a[k] === r[k]); ref.remove(); return ok; })()`), '모양 그대로 (예전 lp-btn line dark 와 색·테두리·글자·크기 같음)');
  const rowShape = () => ev(`(() => { const row = document.querySelector('.lp-biz-act').getBoundingClientRect(), f = document.querySelector('.lp-biz-act .lp-btn:not(.ci-main)').getBoundingClientRect(), n = document.querySelector('#nda-consult .ci-main').getBoundingClientRect();
    return JSON.stringify([f.width, f.height, f.left - row.left, f.top - row.top, n.width, n.height, n.left - row.left, n.top - row.top]); })()`);
  const ftBefore = await rowShape();
  await click('#nda-consult .ci-main');
  check(await vis('#nda-consult a.ntalk') && await vis('#nda-consult a.kakao') && await sameRoutes('#nda-consult'), '누르면 네이버 톡톡·카카오톡 (같은 주소·색·아이콘·새 창)');
  check(await rowShape() === ftBefore, '펼쳐도 [NDA 체결 문의]·옆 [무료 테스트 번역 신청] 크기·자리 그대로 (경로는 그 아래로)');
  await away(); await shotEl('consult_nda.png', '.lp-biz-act', 24);
  check(await routesOpenEach('#nda-consult'), '각각 새 창으로 열림');
  check(await notClosingEachOther('#nda-consult'), '오른쪽 아래 상담하기와 서로 안 닫힘 · Esc 로 닫힘');

  console.log('\n[3] 푸터 [고객센터] → 오른쪽 아래 상담하기 펼침');
  const footer = 'footer .footer-links a:last-child';
  check(await ev(`(() => { const a = document.querySelector(${JSON.stringify(footer)}); return a.textContent.trim() === '고객센터' && a.getAttribute('href') === '#'; })()`), '고객센터 링크(주소 없음)');
  await click(footer); await sleep(150);
  check(await fabOpen() && await vis('#iumm-kakao-fab a.ntalk') && await vis('#iumm-kakao-fab a.kakao'), '누르면 오른쪽 아래 상담하기가 펼쳐짐 (같은 클릭에 다시 닫히지 않음)');
  check(await ev(`document.activeElement === document.querySelector('#iumm-kakao-fab .fab-go a')`), '초점이 첫 경로로');
  check(await ev(`location.hash === '' || location.hash === '#'`) && await ev(`window.scrollY > 0`), '페이지 이동·맨 위로 튀지 않음');
  await away(); await shotEl('consult_footer.png', '#iumm-kakao-fab', 16);
  opened.length = 0;
  await click('#iumm-kakao-fab a.ntalk'); await click(footer); await sleep(150); await click('#iumm-kakao-fab a.kakao');
  check(opened.length === 2 && opened[0].includes('talk.naver.com') && opened[1].includes('pf.kakao.com'), '각각 새 창으로 열림');
  await click(footer); await sleep(150); await key('Escape');
  check(!(await fabOpen()), 'Esc 로 닫힘');

  console.log('\n[모바일 390px]');
  await open(390, 844, true);
  const nm = await ev(`(() => { const n = document.querySelector('#nda-consult .ci-main').getBoundingClientRect(), f = document.querySelector('.lp-biz-act .lp-btn:not(.ci-main)').getBoundingClientRect(); return { w: Math.abs(n.width - f.width) < 1, below: n.top >= f.bottom, hs: document.documentElement.scrollWidth > window.innerWidth }; })()`);
  check(nm.w && nm.below && !nm.hs, 'NDA 버튼 = 무료 테스트 버튼과 같은 너비(한 줄씩) · 가로 넘침 없음');
  await click('#nda-consult .ci-main');
  check(await ev(`(() => { const g = [...document.querySelectorAll('#nda-consult .ci-go a')].map(a => a.getBoundingClientRect()); const top = (a) => { const r = a.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return a.contains(h); };
    const apart = !(g[0].right > g[1].left && g[0].left < g[1].right && g[0].bottom > g[1].top && g[0].top < g[1].bottom);
    return g.every(r => r.left >= 0 && r.right <= window.innerWidth) && apart && [...document.querySelectorAll('#nda-consult .ci-go a')].every(top) && document.documentElement.scrollWidth <= window.innerWidth; })()`), 'NDA 펼침 — 화면 안 · 겹침 없음 · 다음 구역에 가리지 않음');
  await away(); await shotEl('consult_nda_mobile.png', '.lp-biz-act', 24);
  await key('Escape');
  await openOrder('handleAI');
  await setText('계약 조건을 확인해 주세요. '.repeat(30));
  await ev(`(() => { goToPayment(); return 1; })()`); await sleep(300);
  await click('#pay-consult .ci-main');
  check(await ev(`(() => { const g = [...document.querySelectorAll('#pay-consult .ci-go a')].map(a => a.getBoundingClientRect()), m = document.querySelector('#modal-payment .modal-box, #modal-payment > div') || document.getElementById('modal-payment'); const inside = g.every(r => r.left >= 0 && r.right <= window.innerWidth); const apart = !(g[0].right > g[1].left && g[0].left < g[1].right && g[0].bottom > g[1].top && g[0].top < g[1].bottom); return inside && apart && g.every(r => r.height <= 36); })()`), '결제 [문의하기] 펼침 — 화면 안 · 겹침·줄바꿈 없음');
  check(await ev(`(() => { const m = document.getElementById('modal-payment'); m.scrollTop = 1e6;
    const f = document.querySelector('#iumm-kakao-fab .fab-main').getBoundingClientRect();
    return [...document.querySelectorAll('#pay-consult .ci-go a, #pay-consult .ci-main')].map(a => a.getBoundingClientRect()).every(k => !(k.right > f.left && k.left < f.right && k.bottom > f.top && k.top < f.bottom)); })()`), '결제 창 끝까지 내리면 펼친 경로가 오른쪽 아래 상담하기에 안 가림');
  await away(); await shotEl('consult_payment_mobile.png', '#pay-consult', 40);
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill(); server.close();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
