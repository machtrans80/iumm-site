// 주문 창 — 회사별 전용 용어집 (2026-11-02): 실제 브라우저(헤드리스 Chrome)로 index.html 을 열어 확인
//   node scripts/verify_order_corp.mjs            확인 + 캡처(order_corp_after*.png)
//   node scripts/verify_order_corp.mjs --before   캡처만(order_corp_before*.png — 바꾸기 전 화면용)
// 서버·카카오·결제 등 외부 주소는 막는다. 실제 주문은 접수하지 않는다(접수 함수는 부르지 않고 보낼 값만 본다).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.resolve(HERE, '../index.html')).href;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/nanpa/iumm_internal/site_preview';
const BEFORE = process.argv.includes('--before');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-corp-'));
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
async function open(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await ev('document.fonts.ready.then(() => 1)');
  // 주문 창만 띄운다(로그인·결제 없이). 회사명 칸은 회원 정보로 채워진 것처럼
  await ev(`(() => { const m = document.getElementById('modal-order'); m.style.display = 'block'; document.getElementById('orderCompany').value = '알파 주식회사';
    const top = document.getElementById('order-org-box'); m.scrollTop = 0; m.scrollTop = top.getBoundingClientRect().top - 40; return 1; })()`);
  await sleep(400);
}
async function shot(name) {
  const r = await ev(`(() => { const a = document.getElementById('order-org-box').getBoundingClientRect(), b = document.getElementById('corp-box').getBoundingClientRect();
    const top = Math.min(a.top, b.top) - 12, bottom = Math.max(a.bottom, b.bottom) + 12; return { x: 0, y: Math.max(0, top), width: window.innerWidth, height: bottom - Math.max(0, top) }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(s.result.data, 'base64'));
  console.log(`  캡처 ${path.join(SHOT_DIR, name)}`);
}
const payload = () => ev(`JSON.stringify(corpOrderPayload())`).then(JSON.parse);
const setBiz = (v) => ev(`(() => { const e = document.getElementById('corpBizNo'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input')); return 1; })()`);
const setConsent = (on) => ev(`(() => { const e = document.getElementById('corpConsent'); e.checked = ${on}; e.dispatchEvent(new Event('change')); return 1; })()`);

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });
  const tag = BEFORE ? 'before' : 'after';

  console.log('\n[데스크톱 1280px]');
  await open(1280, 1400, false);
  await shot(`order_corp_${tag}.png`);
  if (!BEFORE) {
    check(!(await ev(`!!document.getElementById('corpCheck') || !!document.getElementById('corpName')`)), "'기업 고객입니다' 체크·별도 회사명 칸 없음");
    const pos = await ev(`(() => { const c = document.getElementById('orderCompany').getBoundingClientRect(), b = document.getElementById('corpBizNo'), k = document.getElementById('corpConsent');
      return { shown: b.offsetHeight > 0 && k.getClientRects().length > 0, below: b.getBoundingClientRect().top > c.bottom, before: document.getElementById('corp-box').getBoundingClientRect().top < document.getElementById('free-test-box').getBoundingClientRect().top }; })()`);
    check(pos.shown && pos.below && pos.before, '회사명(필수) 바로 아래에 사업자등록번호·동의 체크가 처음부터 보임');
    check(await ev(`/사업자등록번호[\\s\\S]*\\(선택\\)/.test(document.querySelector('label[for="corpBizNo"]').textContent)`), "사업자등록번호 '(선택)'");
    check(await ev(`document.getElementById('corpConsent').checked === false`), '동의는 기본 미체크');
    check(await ev(`(() => { const t = document.getElementById('corp-box').textContent; return t.includes('번역할수록 귀사의 용어가 쌓여, 다음 번역부터 같은 표현으로 통일됩니다.') && t.includes('용어만 저장하며, 개인정보는 저장하지 않습니다.'); })()`), '기존 안내 문구 유지');
    let p = await payload();
    check(!p.기업고객 && !p.사업자등록번호 && p.회원회사명 === '알파 주식회사', '사업자등록번호 비움 → 공용(기업 값 안 보냄)');
    await setBiz('2208162517');
    p = await payload();
    check(!p.기업고객 && await ev(`/전용 용어집을 쓰려면 동의에 체크해 주세요/.test(document.getElementById('corpConsentHint').textContent)`), '번호만 넣고 동의 안 함 → 한 줄 안내 · 공용 처리');
    check(await ev(`checkCorpBeforePayment() === true`), '번호만 넣고 동의 안 함 → 주문은 막지 않음');
    await setConsent(true);
    p = await payload();
    check(p.기업고객 === true && p.사업자등록번호 === '2208162517' && p.기업용어집동의 === true && p.기업회사명 === '알파 주식회사', '번호 + 동의 → 기업전용 값(회사명은 위 회사명 칸)이 서버로 감');
    check(await ev(`document.getElementById('corpConsentHint').textContent === ''`), '동의하면 안내 사라짐');
    await setBiz('220-81-62518');
    check(await ev(`(() => { const a = window.alert; let m = ''; window.alert = (x) => { m = x; }; const r = checkCorpBeforePayment(); window.alert = a; return r === false && /사업자등록번호/.test(m); })()`), '동의했는데 번호가 틀리면 결제 전에 확인 요청');
    check(!(await ev(`document.documentElement.scrollWidth > window.innerWidth`)), '가로 스크롤 없음');
    await setBiz(''); await setConsent(false);
  }

  console.log('\n[모바일 390px]');
  await open(390, 1400, true);
  if (!BEFORE) {
    check(!(await ev(`document.documentElement.scrollWidth > window.innerWidth`)) && await ev(`document.getElementById('corpBizNo').getBoundingClientRect().right <= window.innerWidth`), '390px 가로 넘침 없음');
    await setBiz('2208162517');
  }
  await shot(`order_corp_${tag}_mobile.png`);
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
