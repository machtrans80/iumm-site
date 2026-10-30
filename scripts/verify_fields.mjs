// 여덟 분야 섹션 — 실제 브라우저(헤드리스 Chrome, DevTools 프로토콜)로 index.html 을 열어 동작 확인 (2026-10-30)
//   node scripts/verify_fields.mjs        (Chrome 위치가 다르면 CHROME_PATH)
// 글꼴(hangeul.pstatic.net·jsdelivr)만 받고, 서버·카카오·결제 등 다른 외부 주소는 막는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.resolve(HERE, '../index.html')).href;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-fields-'));
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
let seq = 0; const waiting = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else if (m.method) events.push(m.method);
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(expr + '\n' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
async function open(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await ev('document.fonts.ready.then(() => 1)');
  await sleep(300);
}
const state = `(() => {
  const g = document.getElementById('lp-fields'), w = document.getElementById('lp-fd');
  const tiles = [...g.querySelectorAll('.lp-field')];
  const shown = [...w.querySelectorAll('.fd')].filter((x) => !x.hidden).map((x) => x.id);
  const kids = [...g.children];
  return {
    n: tiles.length, buttons: tiles.every((t) => t.tagName === 'BUTTON' && t.getAttribute('aria-controls')),
    sel: tiles.filter((t) => t.classList.contains('sel')).map((t) => t.dataset.field),
    exp: tiles.filter((t) => t.getAttribute('aria-expanded') === 'true').map((t) => t.dataset.field),
    open: !w.hidden && w.offsetHeight > 0, shown, wrapAt: kids.indexOf(w),
    visible: tiles.every((t) => t.offsetHeight > 0 && t.getBoundingClientRect().width > 0),
    tileW: Math.round(tiles[0].getBoundingClientRect().width), gridW: Math.round(g.getBoundingClientRect().width),
    rows: new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size,
    overflow: tiles.some((t) => [...t.querySelectorAll('span')].some((s) => s.getBoundingClientRect().right > t.getBoundingClientRect().right + 0.5)),
    hscroll: document.documentElement.scrollWidth > window.innerWidth,
    lit: shown[0] ? (() => { const p = document.getElementById(shown[0]).querySelector('.lit'); return p && p.offsetHeight > 0 ? { s: p.querySelector('s').textContent, yes: p.querySelector('.yes').textContent, dec: getComputedStyle(p.querySelector('s')).backgroundImage !== 'none' } : null; })() : null
  };
})()`;
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click(), 1`);

try {
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[데스크톱 1280px]');
  await open(1280, 900, false);
  let s = await ev(state);
  check(s.n === 8 && s.buttons && s.visible, '칸 8개 표시 · 모두 button + aria-controls');
  check(s.rows === 2, '데스크톱 4×2 배치');
  check(s.sel.join() === 'gaming' && s.exp.join() === 'gaming' && s.open && s.shown.join() === 'fd-gaming', "처음 '게임' 선택 · 상세 패널 열림 (aria-expanded=true)");
  check(s.wrapAt === 8, '상세 패널은 칸들 아래 하나');
  check(s.lit && s.lit.s === 'I will be your sword.' && s.lit.yes === 'この身、そなたの剣となろう' && s.lit.dec, '직역 대비 줄 — 직역 취소선 + 아이움 표기');
  check(!s.overflow && !s.hscroll, '칸 안 글자 넘침 없음 · 가로 스크롤 없음');
  await click('#ft-accounting');
  s = await ev(state);
  check(s.sel.join() === 'accounting' && s.exp.join() === 'accounting' && s.shown.join() === 'fd-accounting' && s.wrapAt === 8, '회계 누르면 선택·상세가 회계로 바뀜 (다른 칸은 해제)');
  check(s.lit && s.lit.s === 'important uncertainty about the continuing company' && s.lit.yes === 'Material Uncertainty Related to Going Concern', '회계 직역 대비 줄');
  await click('#ft-medical');
  s = await ev(state);
  check(s.sel.join() === 'medical' && s.lit && s.lit.s === 'severe adverse event', '의료 선택 · 직역 severe adverse event');
  const reqs = { gaming: 'gaming', legal: 'legal', medical: 'medical', accounting: 'accounting', patent: 'patent', academic: 'academic', esg: 'esg', manual: 'manual' };
  let quoteOk = true;
  for (const v of Object.keys(reqs)) {
    const r = await ev(`(() => {
      isLoggedIn = true; document.getElementById('field-select').value = 'general';
      document.getElementById('modal-order').style.display = 'none';
      document.getElementById('ft-${v}').click();
      document.querySelector('#fd-${v} .fq').click();
      const fs = document.getElementById('field-select');
      return { v: fs.value, t: fs.options[fs.selectedIndex].text, modal: document.getElementById('modal-order').style.display };
    })()`);
    if (!(r.v === reqs[v] && r.modal === 'block')) { quoteOk = false; console.error('    ', v, JSON.stringify(r)); }
  }
  check(quoteOk, '[이 분야로 견적 보기] 8개 — 주문 창이 열리고 분야 선택이 해당 분야로 골라짐');
  const out = await ev(`(() => { isLoggedIn = false; document.getElementById('modal-order').style.display='none'; document.getElementById('field-select').value='general';
    document.getElementById('ft-patent').click(); document.querySelector('#fd-patent .fq').click();
    return { v: document.getElementById('field-select').value, modal: document.getElementById('modal-order').style.display }; })()`);
  check(out.v === 'patent' && out.modal === 'none', '로그인 전에는 로그인 화면으로 — 분야 값은 골라 둔 채 유지');

  console.log('\n[태블릿 820px]');
  await open(820, 1100, false);
  s = await ev(state);
  check(s.rows === 4 && s.sel.join() === 'gaming' && s.wrapAt === 8, '태블릿 2×4 · 게임 선택 · 패널은 칸들 아래');
  check(!s.overflow && !s.hscroll, '태블릿 넘침·가로 스크롤 없음');

  console.log('\n[모바일 390px]');
  await open(390, 844, true);
  s = await ev(state);
  check(s.n === 8 && s.visible && s.rows === 4 && s.tileW * 2 <= s.gridW, '모바일 2열 · 8칸 모두 보임');
  check(!s.open && s.sel.length === 0 && s.exp.length === 0, '모바일 처음엔 상세 닫힘');
  check(!s.overflow && !s.hscroll, '390px 칸 넘침 없음 · 가로 스크롤 없음 (닫힌 상태)');
  await click('#ft-accounting');   // 2번째 줄 오른쪽 칸(4번째)
  s = await ev(state);
  check(s.open && s.sel.join() === 'accounting' && s.shown.join() === 'fd-accounting' && s.wrapAt === 4, '회계 누르면 그 줄 바로 아래에서 펼침');
  check(!s.hscroll, '390px 펼친 상태 가로 스크롤 없음');
  await click('#ft-legal');        // 1번째 줄 오른쪽 칸
  s = await ev(state);
  check(s.sel.join() === 'legal' && s.shown.join() === 'fd-legal' && s.wrapAt === 2 && s.exp.join() === 'legal', '다른 칸을 누르면 그 칸 아래로 옮겨 펼침 (먼저 연 칸은 닫힘)');
  await click('#ft-manual');
  s = await ev(state);
  check(s.wrapAt === 8 && s.lit && s.lit.s === 'Danger · Warning · Attention', '마지막 줄(매뉴얼) 아래 펼침 · 직역 대비 줄');
  await click('#ft-manual');
  s = await ev(state);
  check(!s.open && s.sel.length === 0, '같은 칸을 다시 누르면 닫힘');
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
