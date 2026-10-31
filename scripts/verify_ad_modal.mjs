// 소개 영상 창(모션그래픽 시안 mp4, 2026-10-31) — 버튼으로 열기 · 소리 켠 채 재생 · 소리 끄기 · 다시 보기 · 닫으면 멈춤 · 무료 테스트 연결 · 390px 세로 · 움직임 줄이기
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
check(/id="ad-open" onclick="openAd\(\)"[^>]*>20초 소개 영상<\/button>/.test(act), '첫 화면 버튼 줄에 [20초 소개 영상]');
const modalHtml = html.slice(html.indexOf('<div class="ad-modal" id="ad-modal"'), html.indexOf('<script>', html.indexOf('<div class="ad-modal" id="ad-modal"')));
check(/<video id="ad-video" playsinline preload="none"><\/video>/.test(modalHtml) && !/autoplay|\ssrc=/.test(modalHtml), '처음엔 영상 파일을 불러오지 않음(preload none · src 없음 · autoplay 속성 없음)');
check(['assets/motion_16x9.mp4', 'assets/motion_9x16.mp4', 'assets/motion_poster_16x9.jpg', 'assets/motion_poster_9x16.jpg'].every((f) => fs.existsSync(path.resolve(HERE, '..', f))), '영상 파일 가로·세로 + 첫 화면 그림');
check(!/<script[^>]+src="[^"]*ad25\.js"/.test(html) && !/assets\/ad25\.js/.test(html), '예전 애니메이션 코드(ad25.js)는 이 화면에서 안 씀');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-ad-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${tmp}`, 'about:blank']);
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
// 창·영상 상태
const state = `(() => {
  const m = document.getElementById('ad-modal'), vd = document.getElementById('ad-video');
  const scr = vd.getBoundingClientRect(), sb = document.getElementById('ad-snd').getBoundingClientRect();
  return { open: !m.hidden && m.offsetHeight > 0, v: m.classList.contains('v'), src: vd.getAttribute('src') || '', t: vd.currentTime, paused: vd.paused, muted: vd.muted,
    controls: vd.controls, snd: document.getElementById('ad-snd-t').textContent, pressed: document.getElementById('ad-snd').getAttribute('aria-pressed'),
    vw: vd.videoWidth, vh: vd.videoHeight, w: Math.round(scr.width), h: Math.round(scr.height), focusIn: m.contains(document.activeElement),
    sndTopRight: sb.right <= scr.right + 1 && sb.right > scr.right - 30 && sb.top >= scr.top - 1 && sb.top < scr.top + 30,
    hscroll: document.documentElement.scrollWidth > window.innerWidth };
})()`;
const until = async (expr, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await ev(expr)) return true; await sleep(100); } return false; };

try {
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });

  console.log('\n[데스크톱 1440×900 — 가로 영상]');
  await open(1440, 900, false);
  check(await ev(`!document.getElementById('ad-video').getAttribute('src')`), '창을 열기 전엔 영상 파일 안 불러옴');
  await ev(`document.getElementById('ad-open').click(), 1`);
  check(await until(`document.getElementById('ad-video').currentTime > 1`), '버튼 → 재생 시작');
  let s = await ev(state);
  check(s.open && s.focusIn && /assets\/motion_16x9\.mp4$/.test(s.src), `창 열림 · 초점이 창 안 · 가로 영상 (${s.src})`);
  check(!s.muted && s.snd === '소리 끄기' && s.pressed === 'false', '소리 켜진 채로 시작 · [소리 끄기]');
  check(s.sndTopRight, '소리 단추 = 영상 오른쪽 위');
  check(s.vw === 1920 && s.vh === 1080 && Math.abs(s.w / s.h - 16 / 9) < 0.02, `가로 16:9 (${s.w}×${s.h}, 원본 ${s.vw}×${s.vh})`);
  await ev(`document.getElementById('ad-snd').click(), 1`);
  s = await ev(state);
  check(s.muted && s.snd === '소리 켜기' && s.pressed === 'true' && !s.paused, '[소리 끄기] → 소리만 꺼짐(영상은 계속)');
  await ev(`document.getElementById('ad-snd').click(), 1`);
  check(!(await ev(state)).muted, '[소리 켜기] → 다시 켜짐');
  await sleep(1500);
  await shot('ad_modal_desktop.png');
  await ev(`document.getElementById('ad-replay').click(), 1`);
  check((await ev(state)).t < 0.6, '[다시 보기] → 처음부터');
  await ev(`document.getElementById('ad-close').click(), 1`);
  s = await ev(state);
  check(!s.open && s.paused && s.t === 0 && (await ev(`document.activeElement === document.getElementById('ad-open')`)), '× 닫기 → 바로 멈춤(소리도) · 처음으로 · 초점이 버튼으로');
  await sleep(700);
  check((await ev(state)).paused, '닫은 뒤에도 멈춘 채');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await until(`!document.getElementById('ad-video').paused`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  s = await ev(state);
  check(!s.open && s.paused, 'Esc → 닫히고 멈춤');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await until(`!document.getElementById('ad-video').paused`);
  await ev(`document.getElementById('ad-modal').dispatchEvent(new MouseEvent('click', { bubbles: true })), 1`);
  s = await ev(state);
  check(!s.open && s.paused, '바깥(어두운 곳) 누르면 닫히고 멈춤');
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(300);
  await ev(`document.getElementById('ad-free').click(), 1`);
  s = await ev(state);
  check(!s.open && s.paused && (await ev('window.__ft')) === 1, '[무료 테스트 번역 신청] → 창 닫고(멈춤) 기존 무료 테스트 신청(openFreeTest)');

  console.log('\n[모바일 390×844 — 세로 영상]');
  await open(390, 844, true);
  check(!(await ev(state)).hscroll, '첫 화면 버튼 3개 — 가로 넘침 없음');
  await ev(`document.getElementById('ad-open').click(), 1`);
  check(await until(`document.getElementById('ad-video').currentTime > 0.5`), '재생 시작');
  s = await ev(state);
  check(s.open && s.v && /assets\/motion_9x16\.mp4$/.test(s.src) && s.vw === 1080 && s.vh === 1920, '세로(9:16) 영상');
  check(s.w <= 358 && Math.abs(s.h / s.w - 16 / 9) < 0.03 && !s.hscroll, `화면 안에 들어감 (${s.w}×${s.h})`);
  check(s.sndTopRight && !s.muted, '세로에서도 오른쪽 위 [소리 끄기] · 소리 켜짐');
  check(await ev(`(() => { const r = document.querySelector('.ad-dlg').getBoundingClientRect(), x = document.getElementById('ad-close').getBoundingClientRect(), b = document.querySelector('.ad-bar').getBoundingClientRect(); return x.top >= 0 && b.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })()`), '× 와 아래 단추가 화면 안');
  await sleep(4000);
  await shot('ad_modal_mobile.png');
  await ev(`document.getElementById('ad-close').click(), 1`);
  check((await ev(state)).paused, '닫으면 멈춤');

  console.log('\n[움직임 줄이기 — 저절로 재생하지 않음]');
  await open(1440, 900, false, true);
  await ev(`document.getElementById('ad-open').click(), 1`);
  await sleep(1200);
  s = await ev(state);
  check(s.open && s.paused && s.controls && s.t === 0, '창은 열리되 재생 단추만(자동 재생 없음)');
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
process.exitCode = fail ? 1 : 0;
