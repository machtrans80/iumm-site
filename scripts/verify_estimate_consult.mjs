// 견적 칸 '견적 상담하기' (2026-11-02): 실제 브라우저(헤드리스 Chrome)로 확인
//   node scripts/verify_estimate_consult.mjs     확인 + 캡처(estimate_consult*.png)
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-consult-'));
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
  const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await sleep(100);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(250);
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
async function shot(name) {
  const r = await ev(`(() => { const e = document.getElementById('estimate-result'); e.scrollIntoView({ block: 'center' }); const a = e.getBoundingClientRect(); return { x: Math.max(0, a.left - 16), y: Math.max(0, a.top - 16), width: Math.min(window.innerWidth, a.width + 32), height: a.height + 32 }; })()`);
  await sleep(250);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(s.result.data, 'base64'));
  console.log(`  캡처 ${path.join(SHOT_DIR, name)}`);
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao.com*', '*kakaocdn*', '*naver.com*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[데스크톱 1280px]');
  await open(1280, 1000, false);
  check(await ev(`!!window.iummConsult && !!document.querySelector('#estimate-consult-btn .iumm-consult-inline .ci-main')`), 'kakao-fab.js 를 1.5초 늦게 불러와도 버튼이 그려짐');
  check(await ev(`document.querySelector('script[src*="kakao-fab.js"]').getAttribute('src') === '/assets/kakao-fab.js?v=6'`), 'kakao-fab.js?v=6');
  await openOrder('handleAI');
  check(!(await vis('#estimate-consult-btn .ci-main')), '견적 전 → 안 보임');
  const TEXT = '계약 조건을 확인해 주세요. '.repeat(30);
  await setText(TEXT);
  check(await vis('#estimate-result') && await vis('#estimate-consult-btn .ci-main'), '견적이 나오면 → 보임 (스탠다드)');
  check(await ev(`document.querySelector('#estimate-consult-btn .ci-main').textContent.trim() === '견적 상담하기'`)
    && /자동 견적 대신 담당자 견적을 원하시면 견적 상담하기를 눌러 대화해 주세요\./.test(await ev(`document.getElementById('estimate-consult').textContent`)), "문구 · [견적 상담하기]");
  check(await ev(`(() => { const r = document.getElementById('estimate-consult').getBoundingClientRect(), d = document.getElementById('delivery-time').getBoundingClientRect(), box = document.getElementById('estimate-result').getBoundingClientRect(); return r.top >= d.bottom && r.bottom <= box.bottom; })()`), '견적 칸 맨 아래, 예상 납품 시간 줄 밑');
  check(await ev(`(() => { const a = document.querySelector('#estimate-consult-btn .ci-main').getBoundingClientRect(), b = document.getElementById('go-pay-btn').getBoundingClientRect(); return a.height < b.height && a.width < b.width; })()`), '결제 버튼보다 작음');
  check(!(await vis('#estimate-consult-btn .ci-go')), '처음엔 경로 닫힘');

  await click('#estimate-consult-btn .ci-main');
  check(await vis('#estimate-consult-btn .ci-go a.ntalk') && await vis('#estimate-consult-btn .ci-go a.kakao'), '누르면 그 자리에서 네이버 톡톡·카카오톡 펼침');
  check(await ev(`(() => { const b = document.querySelector('#estimate-consult-btn .ci-main').getBoundingClientRect(), g = document.querySelector('#estimate-consult-btn .ci-go').getBoundingClientRect(); return g.top >= b.bottom; })()`), '버튼 아래로 펼침');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 }); await sleep(250);   // 마우스를 치워 hover 색 제외
  const colors = await ev(`(() => { const c = (s) => getComputedStyle(document.querySelector(s)).backgroundColor; return [c('#estimate-consult-btn .ci-main'), c('#estimate-consult-btn a.ntalk'), c('#estimate-consult-btn a.kakao'), c('#iumm-kakao-fab .fab-main'), c('#iumm-kakao-fab a.ntalk'), c('#iumm-kakao-fab a.kakao')]; })()`);
  console.log('    색:', colors.join(' / '));
  check(colors[0] === colors[3] && colors[1] === colors[4] && colors[2] === colors[5] && colors[0] === 'rgb(15, 37, 64)' && colors[1] === 'rgb(3, 199, 90)' && colors[2] === 'rgb(254, 229, 0)', '색 = 기존 상담 버튼(남색 · 네이버 초록 · 카카오 노랑)');
  check(await ev(`(() => { const a = [...document.querySelectorAll('#estimate-consult-btn .ci-go a')], f = [...document.querySelectorAll('#iumm-kakao-fab .fab-go a')]; return a.length === 2 && a.every((x, i) => x.href === f[i].href && x.target === '_blank' && /noopener/.test(x.rel) && x.querySelector('svg')); })()`), '두 경로 주소·새 창·아이콘이 오른쪽 아래 상담하기와 같음');
  check(await ev(`document.querySelector('#estimate-consult-btn a.ntalk').href.startsWith('https://talk.naver.com/') && document.querySelector('#estimate-consult-btn a.kakao').href.startsWith('https://pf.kakao.com/')`), 'talk.naver.com · pf.kakao.com');
  await shot('estimate_consult.png');

  opened.length = 0;
  await click('#estimate-consult-btn a.ntalk');
  await click('#estimate-consult-btn .ci-main');
  await click('#estimate-consult-btn a.kakao');
  check(opened.length === 2 && opened[0].includes('talk.naver.com') && opened[1].includes('pf.kakao.com'), `각각 새 창으로 열림 (${opened.map((u) => new URL(u).host).join(', ')})`);
  check(await ev(`document.getElementById('pasteText').value === ${JSON.stringify(TEXT)} && document.getElementById('modal-order').style.display !== 'none' && document.getElementById('orderCompany').value === '알파 주식회사'`), '작성 중인 주문 그대로 (원문·회사명·주문 창)');
  check(!(await inlineOpen()), '경로를 누르면 펼침이 닫힘');

  // 오른쪽 아래 상담하기와 번갈아
  await click('#estimate-consult-btn .ci-main');
  await click('#iumm-kakao-fab .fab-main');
  check(await inlineOpen() && await fabOpen(), '견적 상담 펼친 채 오른쪽 아래 상담하기 → 둘 다 열림');
  await click('#estimate-consult-btn .ci-main');   // 견적 상담 닫기
  check(!(await inlineOpen()) && await fabOpen(), '견적 상담을 닫아도 오른쪽 아래는 그대로');
  await click('#estimate-consult-btn .ci-main');
  check(await inlineOpen() && await fabOpen(), '견적 상담을 다시 열어도 오른쪽 아래가 안 닫힘');
  await click('#iumm-kakao-fab .fab-main');        // 오른쪽 아래 닫기
  check(await inlineOpen() && !(await fabOpen()), '오른쪽 아래를 닫아도 견적 상담은 그대로');
  await click('#char-count');                        // 바깥
  check(!(await inlineOpen()), '바깥 누르기 → 닫힘');
  await click('#estimate-consult-btn .ci-main'); await key('Escape');
  check(!(await inlineOpen()) && await ev(`document.activeElement === document.querySelector('#estimate-consult-btn .ci-main')`), 'Esc → 닫힘 (버튼으로 초점)');
  check(await ev(`document.getElementById('modal-order').style.display !== 'none' && document.getElementById('pasteText').value.length > 0`), 'Esc 뒤에도 주문 창·원문 그대로');

  // 프리미엄 플러스 · 무료 테스트
  await ev(`closeModal('order')`); await openOrder('handleStandard'); await setText(TEXT);
  check(await vis('#estimate-consult-btn .ci-main'), '프리미엄 플러스 견적 → 보임');
  await ev(`closeModal('order')`); await openOrder('handleAI'); await setText(TEXT);
  await ev(`(() => { const c = document.getElementById('freeTestCheck'); c.checked = true; c.dispatchEvent(new Event('change')); return 1; })()`); await sleep(200);
  check(await vis('#estimate-consult-btn .ci-main'), '무료 테스트 체크 상태 → 보임');
  check(await ev(`document.querySelectorAll('.iumm-consult-inline').length === 1`), '버튼은 한 개만 (다시 열어도 겹쳐 그리지 않음)');

  console.log('\n[모바일 390px]');
  await open(390, 844, true);
  await openOrder('handleAI'); await setText(TEXT);
  await click('#estimate-consult-btn .ci-main');
  const m = await ev(`(() => { const box = document.getElementById('estimate-result').getBoundingClientRect(), b = document.querySelector('#estimate-consult-btn .ci-main').getBoundingClientRect(),
      n = document.querySelector('#estimate-consult-btn a.ntalk').getBoundingClientRect(), k = document.querySelector('#estimate-consult-btn a.kakao').getBoundingClientRect(), p = document.querySelector('#estimate-consult p').getBoundingClientRect();
    const inside = (r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
    const apart = !(n.right > k.left && n.left < k.right && n.bottom > k.top && n.top < k.bottom);
    return { inside: [b, n, k, p].every(inside), apart, oneLine: [b, n, k].every((r) => r.height <= 36), hs: document.documentElement.scrollWidth > window.innerWidth }; })()`);
  check(m.inside && m.apart && m.oneLine && !m.hs, '390px — 칸 안에 들어감 · 두 경로 겹침 없음 · 버튼 글자 한 줄 · 가로 넘침 없음');
  await shot('estimate_consult_mobile.png');
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill(); server.close();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
