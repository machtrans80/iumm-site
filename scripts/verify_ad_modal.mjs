// 25초 소개 영상 창 — 버튼으로 열기 · 재생 · 다시 보기 · 닫기 · 끝 화면 버튼 연결 · 390px 세로 · 움직임 줄이기 (2026-10-30)
//   node scripts/verify_ad_modal.mjs   (헤드리스 Chrome, 외부 서버 접속 차단)
// 미리보기 캡처: AD_PREVIEW_DIR (기본 C:/Users/nanpa/iumm_internal/site_preview) — ad_modal_desktop.png · ad_modal_mobile.png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.resolve(HERE, '../index.html')).href;
const html = fs.readFileSync(path.resolve(HERE, '../index.html'), 'utf8');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.AD_PREVIEW_DIR || 'C:/Users/nanpa/iumm_internal/site_preview';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('\n[정적]');
const act = html.slice(html.indexOf('<div class="lp-hero-act" id="lp-entry">'), html.indexOf('</div>', html.indexOf('<div class="lp-hero-act" id="lp-entry">')));
check(/onclick="handleAI\(\)">파일 올리고 바로 견적 보기<\/button>/.test(act) && /href="#field-standards">분야별 번역 기준 보기<\/a>/.test(act), '기존 첫 화면 버튼 2개 그대로');
check(/id="ad-open" onclick="openAd\(\)"[^>]*>25초 소개 영상<\/button>/.test(act), '첫 화면 버튼 줄에 [25초 소개 영상]');
check(/\.ad-cmp \.t,\.ad-cmp \.n\{white-space:nowrap\}/.test(fs.readFileSync(path.resolve(HERE, '../assets/ad25.js'), 'utf8')), '영상 3장면 밑줄·테두리 묶음은 줄 중간에서 안 갈라짐');
check(!/<script[^>]+src="[^"]*ad25\.js"/.test(html) && /s\.src = 'assets\/ad25\.js'/.test(html), '애니메이션 코드는 처음 불러오지 않고 창을 열 때만 불러옴');
check(!/autoplay/i.test(html.slice(html.indexOf('id="ad-modal"'), html.indexOf('id="ad-modal"') + 3000)), '자동 재생 없음');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-ad-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${tmp}`, 'about:blank']);
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
async function open(width, height, mobile, reduce = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await sleep(300);
  // 끝 화면 버튼 연결 확인용 — 기존 openFreeTest 를 기록만 하는 것으로 바꿔 둔다
  await ev(`window.__ft = 0; window.openFreeTest = function(){ window.__ft++; }; 1`);
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, file), Buffer.from(r.result.data, 'base64'));
}
// 지금 보이는 장면 번호(1~7) · 창 상태
const state = `(() => {
  const m = document.getElementById('ad-modal'), sc = [...document.querySelectorAll('#ad-screen .ad-sc')];
  const vis = sc.map((s, i) => [i + 1, +getComputedStyle(s).opacity, getComputedStyle(s).visibility]).filter((x) => x[2] === 'visible' && x[1] > 0.5).map((x) => x[0]);
  const scr = document.getElementById('ad-screen').getBoundingClientRect(), st = document.querySelector('#ad-screen .ad-st');
  return { open: !m.hidden && m.offsetHeight > 0, loaded: !!window.IUMMAd, scene: vis[0] || 0, v: m.classList.contains('v'), stV: !!st && st.classList.contains('ad-v'),
    w: Math.round(scr.width), h: Math.round(scr.height), focusIn: m.contains(document.activeElement),
    n: document.getElementById('ad-n').hidden ? null : document.getElementById('ad-n').textContent,
    hscroll: document.documentElement.scrollWidth > window.innerWidth };
})()`;

try {
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[데스크톱 1440×900 — 가로 영상]');
  await open(1440, 900, false);
  check(await ev('!window.IUMMAd && !document.querySelector(\'script[src*="ad25"]\')'), '창을 열기 전엔 애니메이션 코드 없음');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(1200);
  let s = await ev(state);
  check(s.open && s.loaded && s.focusIn, '버튼 → 창 열림 · 코드 불러옴 · 초점이 창 안');
  check(!s.v && !s.stV && Math.abs(s.w / s.h - 16 / 9) < 0.02, `가로 16:9 (${s.w}×${s.h})`);
  check(s.scene === 1, '처음부터 재생(1장면 지도)');
  check(await ev(`['ad-prev', 'ad-next', 'ad-n'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none') && getComputedStyle(document.getElementById('ad-replay')).display !== 'none'`), '재생 중엔 [이전]·[다음] 안 보임, [다시 보기]만');
  await sleep(2600);
  s = await ev(state);
  check(s.scene === 2, `재생이 진행됨(3초 뒤 2장면, 지금 ${s.scene})`);
  await sleep(4000);
  check((await ev(state)).scene === 3, '대조 패널 장면');
  await shot('ad_modal_desktop.png');
  await ev(`document.getElementById('ad-replay').click(), 1`);
  await sleep(400);
  check((await ev(state)).scene === 1, '[다시 보기] → 처음(1장면)부터');
  // 끝 화면 버튼
  check(await ev(`(() => { const b = document.querySelector('#ad-screen [data-ad="free"]'); return !!b && b.textContent === '무료 테스트 번역 신청'; })()`), '끝 화면에 [무료 테스트 번역 신청]');
  await ev(`document.querySelector('#ad-screen [data-ad="free"]').click(), 1`);
  s = await ev(state);
  check(!s.open && (await ev('window.__ft')) === 1, '끝 화면 버튼 → 창 닫고 기존 무료 테스트 신청(openFreeTest)');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(500);
  await ev(`document.getElementById('ad-close').click(), 1`);
  s = await ev(state);
  check(!s.open && (await ev(`document.activeElement === document.getElementById('ad-open')`)), '× 닫기 → 창 닫힘 · 초점이 버튼으로 돌아옴');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(300);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  check(!(await ev(state)).open, 'Esc 로 닫힘');
  check((await ev(`document.querySelectorAll('script[src*="ad25"]').length`)) === 1, '여러 번 열어도 코드는 한 번만 불러옴');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(300);
  await ev(`document.getElementById('ad-modal').dispatchEvent(new MouseEvent('click', { bubbles: true })), 1`);
  check(!(await ev(state)).open, '바깥(어두운 곳) 누르면 닫힘');

  console.log('\n[모바일 390×844 — 세로 영상]');
  await open(390, 844, true);
  check(!(await ev(state)).hscroll, '첫 화면 버튼 3개 — 가로 넘침 없음');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(1500);
  s = await ev(state);
  check(s.open && s.v && s.stV, '세로(9:16) 버전');
  check(s.w <= 358 && Math.abs(s.h / s.w - 16 / 9) < 0.02 && !s.hscroll, `화면 안에 들어감 (${s.w}×${s.h})`);
  check(await ev(`(() => { const r = document.querySelector('.ad-dlg').getBoundingClientRect(), x = document.getElementById('ad-close').getBoundingClientRect(), b = document.querySelector('.ad-bar').getBoundingClientRect(); return x.top >= 0 && b.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })()`), '닫기·다시 보기 버튼이 화면 안');
  await sleep(6000);
  await shot('ad_modal_mobile.png');
  await ev(`document.getElementById('ad-close').click(), 1`);

  console.log('\n[움직임 줄이기 — 정지 화면 + 이전·다음]');
  await open(1440, 900, false, true);
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(800);
  s = await ev(state);
  check(s.open && s.n === '1 / 7' && s.scene === 1, '1 / 7 정지 화면');
  check(await ev(`['ad-prev', 'ad-next'].every((id) => getComputedStyle(document.getElementById(id)).display !== 'none')`), '[이전]·[다음] 보임');
  await sleep(1500);
  check((await ev(state)).scene === 1, '저절로 넘어가지 않음');
  await ev(`document.getElementById('ad-next').click(), 1`);
  s = await ev(state);
  check(s.n === '2 / 7' && s.scene === 2, '[다음] → 2 / 7');
  await ev(`document.getElementById('ad-prev').click(), 1`);
  check((await ev(state)).n === '1 / 7', '[이전] → 1 / 7');
  for (let i = 0; i < 6; i++) await ev(`document.getElementById('ad-next').click(), 1`);
  s = await ev(state);
  check(s.n === '7 / 7' && s.scene === 7 && (await ev(`document.getElementById('ad-next').disabled`)), '끝 화면 7 / 7 · [다음] 꺼짐');
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exitCode = fail ? 1 : 0;
