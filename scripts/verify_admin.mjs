// 관리자 화면 — 실제 브라우저(헤드리스 Chrome, DevTools 프로토콜)로 admin/index.html 을 열어 확인 (2026-10-31)
//   node scripts/verify_admin.mjs        (Chrome 위치가 다르면 CHROME_PATH)
// 저장소를 작은 로컬 서버로 띄우고, 관리자 API(fetch)는 모두 가짜 응답으로 바꾼다. 실제 서버·결제에는 접속하지 않는다.
// 글꼴(jsdelivr·hangeul.pstatic.net)만 받는다. 첫 화면 스크린숏을 SHOT_DIR(기본 C:\Users\nanpa\iumm_internal\site_preview)에 저장한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/nanpa/iumm_internal/site_preview';
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.error(`  ❌ ${m}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adminSrc = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');

// ── 로컬 정적 서버 ──
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = `http://127.0.0.1:${server.address().port}/admin/index.html`;

// ── 올릴 파일 (가짜) ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iumm-admin-'));
const upDir = path.join(tmp, 'up'); fs.mkdirSync(upDir);
const UP = ['계약서_원문.docx', '계약서_번역.docx', '메모_원문만.txt'].map((n) => { const f = path.join(upDir, n); fs.writeFileSync(f, 'x'); return f; });

// ── 가짜 API (페이지가 뜨기 전에 심는다) ──
const MOCK = String.raw`(() => {
  const S = window.__mock = { calls: [], intervals: [], opened: [], estimateAllowed: true, reviewAllowed: true, reviewMode: 'ok', job: '진행 중', manualWaiting: 0 };
  const _si = window.setInterval;
  window.setInterval = function (fn, ms) { S.intervals.push(ms); return _si.apply(this, arguments); };
  window.open = (u) => { S.opened.push(String(u)); return null; };
  window.confirm = () => true; window.alert = () => {};
  const J = (b, status) => new Response(JSON.stringify(b), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  const budget = { cap: 50, spent: 3.5, remaining: 46.5, expires: '2026-11-12' };
  const order = (i, extra) => Object.assign({ orderId: 'rec' + i, orderNumber: 'IUMM-100' + i, customerEmail: 'kim' + i + '@alpha.co.kr', charCount: 1200 * i,
    plan: 'ai_premium', status: '관리자대기', receivedAt: '2026-10-30T01:00:00Z', paymentAmount: 30000 * i }, extra || {});
  window.fetch = async (url, opt) => {
    opt = opt || {};
    const u = new URL(String(url), location.href), p = u.pathname, m = (opt.method || 'GET').toUpperCase();
    const h = opt.headers || {};
    const rec = { p, m, q: u.search, auth: h.Authorization || h.authorization || '' };
    if (opt.body instanceof FormData) { rec.form = {}; for (const [k, v] of opt.body.entries()) (rec.form[k] = rec.form[k] || []).push(v instanceof File ? v.name : v); }
    else if (typeof opt.body === 'string') { try { rec.json = JSON.parse(opt.body); } catch (e) { rec.raw = opt.body; } }
    S.calls.push(rec);
    if (!/^\/(api|health)/.test(p)) return J({ ok: false }, 404);
    if (p === '/api/admin/login') return J({ success: true, token: 'TEST_TOKEN' });
    if (p === '/health') return J({ ok: true, commit: 'abcdef1' });
    if (p === '/api/admin/orders') {
      const tab = u.searchParams.get('tab');
      if (tab === 'ai_premium') return J({ success: true, orders: [order(1), order(2, { status: '납품완료' })] });
      if (tab === 'failed') return J({ success: true, orders: [order(3, { orderStatus: '확인필요', status: '확인필요', failReason: '확인필요: P0003 숫자 확인', aiTranslation: 'text' })] });
      return J({ success: true, orders: [] });
    }
    if (p === '/api/admin/terms') return J({ ok: true, terms: [{ id: 't1', pair: '한국어→영어', source: '계약', target: 'contract', status: '승인', scope: '일반', count: 3, field: '법률', docType: '계약서', lastAt: '2026-10-20' }], facets: { field: ['법률'], docType: ['계약서'], scope: ['일반'], status: ['승인'] } });
    if (p === '/api/admin/reviewers/pending') return J({ success: true, reviewers: [{ id: 'r1', name: '김검수', grade: 'S', expertise: ['법률'], languages: ['영어'], phone: '010-0000-0000', signupAt: '2026-10-01' }] });
    if (p === '/api/admin/term-extract/options') return J({ ok: true, fields: [{ code: 'legal', name: '법률' }, { code: 'medical', name: '의료' }, { code: 'etc', name: '그 밖' }],
      scopes: [{ code: 'general', name: '일반' }, { code: 'corp', name: '기업전용' }, { code: 'internal', name: '내부전용' }], exts: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'],
      onlySourceMessage: '원문만 있는 파일은 받지 않습니다.', running: null, budget });
    if (p === '/api/admin/term-extract/estimate') return J({ ok: true, docs: [{ name: '계약서', kind: 'pair', chunks: 4 }], rejected: [{ name: '메모_원문만.txt', why: '원문만 있는 파일은 받지 않습니다.' }],
      chars: 12345, estimate: { chunks: 4, inTok: 20000, outTok: 6000, usd: 0.42, model: 'claude-opus', batch: true },
      budget: S.estimateAllowed ? budget : { cap: 50, spent: 49.9, remaining: 0.1, expires: '2026-11-12' }, allowed: S.estimateAllowed,
      message: S.estimateAllowed ? '' : '남은 예산 $0.10 으로는 이 작업(예상 $0.42)을 시작할 수 없습니다.' });
    if (p === '/api/admin/term-extract/start') return J({ ok: true, jobId: 'job1', estimate: { usd: 0.42 }, rejected: [] });
    if (p === '/api/admin/term-extract/jobs/job1') return J(S.job === '완료'
      ? { ok: true, jobId: 'job1', status: '완료', startedAt: '2026-10-31T01:00:00Z', finishedAt: '2026-10-31T01:20:00Z', progress: ['조각 4개 보냄', '확정 끝'], rejected: [], estimate: { usd: 0.42 },
          result: { ok: true, stat: { 뽑음: 40, 대조탈락: 3, 새후보: 30, 기존가산: 7, 제외: 2, 조각실패: 0 }, result: { 묶음: 30, 확정: 25, AI가_버림: 2, 응답누락: 0 }, excludedReasons: { 개인정보: 2 }, costUsd: 0.39 } }
      : { ok: true, jobId: 'job1', status: '진행 중', startedAt: '2026-10-31T01:00:00Z', progress: ['조각 4개 보냄', '배치 대기 중'], rejected: [], estimate: { usd: 0.42 } });
    if (p === '/api/admin/review-estimate') return J({ ok: true, estimate: { inTok: 3000, outTok: 2000, usd: 0.12 }, budget, allowed: S.reviewAllowed,
      message: S.reviewAllowed ? '' : '남은 예산이 부족합니다.' });
    if (p === '/api/admin/gpt-review-manual') {
      if (S.reviewMode === '402') return J({ ok: false, error: 'budget_exceeded', message: 'Claude 크레딧 예산을 넘었습니다.' }, 402);
      if (S.reviewMode === '503') return J({ ok: false, error: 'budget_unavailable', message: '예산 기록을 확인할 수 없습니다.' }, 503);
      const eng = (rec.json && rec.json.engine) || 'claude';
      return J(Object.assign({ ok: true, score: 92, summary: '전체적으로 좋습니다.', revisedTranslation: 'Revised text', changes: [{ paragraph: 1, before: 'pilot use', after: 'pilot operation', reason: '용어 통일' }],
        processingTimeMs: 3000, engine: eng }, eng === 'claude' ? { costUsd: 0.11 } : {}));
    }
    if (p === '/api/admin/credit-budget') return J({ ok: true, cap: 50, spent: 3.5, remaining: 46.5, outsideCap: 1.2, expires: '2026-11-12',
      rows: [{ at: '2026-10-30T10:00:00Z', task: '용어 확정', model: 'claude-opus', batch: true, calls: 12, inTok: 50000, outTok: 9000, usd: 2.1, inCap: true, memo: '' },
             { at: '2026-10-20T10:00:00Z', task: '시험 호출', model: 'claude-opus', batch: false, calls: 1, inTok: 100, outTok: 50, usd: 1.2, inCap: false, memo: '상한 전' }] });
    if (p === '/api/admin/translate-bypass') return J({ success: true, orderNumber: 'IUMM-BP-1', orderId: 'recBP' });
    if (p === '/api/notary/config') return J({ ok: true, documents: [{ code: 'family', name: '가족관계증명서', ready: true }], langs: [{ code: 'en', name: '영어', ready: true }] });
    if (p === '/api/notary/admin/direct' && m === 'GET') return J({ ok: true, orders: [{ orderNumber: 'NTR-ADM-0001', docType: '가족관계증명서', statusKey: 'done', statusLabel: '완료', receivedAt: '2026-10-30T01:00:00Z' }] });
    if (/^\/api\/notary\/admin\/direct\/[^/]+\/reopen$/.test(p)) return J({ ok: true, editUrl: 'https://iumm.kr/notary/edit.html?t=EDIT_TOKEN' });
    if (p === '/api/notary/admin/shipping') return J({ ok: true, orders: [], manualWaiting: S.manualWaiting, manualOldestDays: S.manualWaiting ? 3 : 0 });
    return J({ success: true, ok: true, orders: [], items: [], reviewers: [], members: [] });
  };
})();`;

const prof = path.join(tmp, 'prof');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${prof}`, 'about:blank']);
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const mm = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (mm) res(mm[1]); });
  setTimeout(() => rej(new Error('Chrome 시작 실패')), 15000);
});
const port = new URL(wsUrl).port;
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0; const waiting = new Map(); const events = []; const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
  else if (msg.method) { events.push(msg.method); if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('console.error ' + (msg.params.args || []).map((a) => a.value ?? a.description).join(' ')); }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 200) + '\n' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
const until = async (expr, ms = 4000) => { for (let t = 0; t < ms; t += 50) { if (await ev(expr)) return true; await sleep(50); } return false; };
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click(), 1`);
const calls = (re) => ev(`window.__mock.calls.filter(c => new RegExp(${JSON.stringify(re)}).test(c.p))`);
async function open(width, height, mobile, { token } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  events.length = 0;
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  if (token !== undefined) {
    await ev(token ? `localStorage.setItem('adminToken', ${JSON.stringify(token)}), 1` : `localStorage.removeItem('adminToken'), 1`);
    events.length = 0;
    await send('Page.reload', {});
    for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  }
  await ev('document.fonts.ready.then(() => 1)');
  await sleep(300);
}
async function tabKeyUntil(expr, max = 40) {
  for (let i = 0; i < max; i++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    if (await ev(expr)) return true;
  }
  return false;
}
// 민트·청록·초록·빨강 계열 색인지 (채도가 있는 색만)
const COLOR_SCAN = `((root) => {
  const bad = [];
  const hue = (s) => { const m = s.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/); if (!m) return null;
    if (m[4] !== undefined && +m[4] === 0) return null;
    const r = m[1] / 255, g = m[2] / 255, b = m[3] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.12) return null; const l = (mx + mn) / 2, sat = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, sat }; };
  for (const el of root.querySelectorAll('*')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    for (const k of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor']) {
      if (k.startsWith('border') && parseFloat(cs[k.replace('Color', 'Width')]) === 0) continue;
      const v = hue(cs[k]); if (!v || v.sat < 0.3) continue;
      if ((v.h >= 75 && v.h <= 195) || v.h < 12 || v.h > 340) bad.push((el.id || el.className || el.tagName) + ' ' + k + ' ' + cs[k]);
    }
  }
  return bad.slice(0, 8);
})(document)`;
const NO_HSCROLL = `(() => {
  const vw = window.innerWidth; const out = [];
  if (document.documentElement.scrollWidth > vw + 1) out.push('documentElement ' + document.documentElement.scrollWidth);
  for (const el of document.querySelectorAll('#admin-view *')) {
    if (!el.getClientRects().length) continue;
    let p = el.parentElement, inBox = false;
    while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { inBox = p.id !== '' || p.className !== ''; if (inBox) break; } p = p.parentElement; }
    if (inBox) continue;
    const r = el.getBoundingClientRect(); if (r.right > vw + 1) out.push((el.id || el.className || el.tagName) + ' ' + Math.round(r.right));
  }
  return out.slice(0, 6);
})()`;

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable');
  await send('Network.setBlockedURLs', { urls: ['*railway.app*', '*kakao*', '*portone*', '*iumm.kr*', '*google*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK });

  console.log('\n[1] 로그인 → 관리자 화면');
  await open(1440, 900, false, { token: null });
  check(await ev(`getComputedStyle(document.getElementById('login-view')).display !== 'none' && getComputedStyle(document.getElementById('admin-view')).display === 'none'`), '처음엔 로그인 화면');
  await ev(`document.getElementById('admin-pw').value = 'pw', 1`);
  await click('.btn-login');
  check(await until(`document.getElementById('admin-view').style.display === 'flex' && document.getElementById('login-view').style.display === 'none'`), '로그인 → 관리자 화면 열림');
  check(await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`), '주문 탭(AI 프리미엄 납품 대기) 목록 표시 (가짜 목록)');
  check(await ev(`(() => { const c = window.__mock.calls.find(c => c.p === '/api/admin/orders'); return !!c && c.auth === 'Bearer TEST_TOKEN'; })()`), '관리자 API에 Authorization: Bearer 토큰');
  check(await ev(`!!document.querySelector('#orders-tbody .st.st-done') && document.querySelector('#orders-tbody .st.st-done').textContent === '납품완료'`), '납품완료 표시 = 완료(네이비) 배지');

  console.log('\n[2] 맨 위 작업 버튼 3개');
  const wb = await ev(`(() => {
    const bs = [...document.querySelectorAll('.work-bar .work-btn')];
    const first = [...document.querySelectorAll('#admin-view .admin-body > *')].find(e => e.getClientRects().length);
    const big = bs.map(b => b.getBoundingClientRect());
    const tabs = [...document.querySelectorAll('.tab-btn')].filter(t => t.getClientRects().length).map(t => t.getBoundingClientRect().height);
    return { names: bs.map(b => b.textContent.trim()), first: first && first.className, top: big.length ? Math.round(big[0].top) : -1,
      minH: Math.min(...big.map(r => r.height)), maxTab: Math.max(...tabs), fs: bs.length ? parseFloat(getComputedStyle(bs[0]).fontSize) : 0,
      deco: bs.some(b => b.querySelector('i,svg,img') || getComputedStyle(b).backgroundImage !== 'none') };
  })()`);
  check(wb.names.join() === '우회 번역,번역공증 작업,검수', "작업 버튼 [우회 번역] [번역공증 작업] [검수]");
  check(wb.first === 'work-bar' && wb.top < 120, '관리자 본문 맨 위(첫 요소)에 있음');
  check(wb.minH >= 2 * wb.maxTab && wb.fs >= 20, `가장 큰 요소 (높이 ${wb.minH}px · 글자 ${wb.fs}px, 메뉴 탭 최대 ${wb.maxTab}px)`);
  check(!wb.deco, '장식 없음 (아이콘·그림·그라데이션 없음)');
  await click('#work-bypass');
  check(await ev(`document.getElementById('bypass-wrap').style.display === 'block' && document.getElementById('tab-bypass').classList.contains('active') && document.getElementById('work-bypass').classList.contains('active')`), '[우회 번역] → 우회 번역(우회 주문) 화면');
  await click('#work-ntr');
  check(await ev(`document.getElementById('ntrd-wrap').style.display === 'block' && document.getElementById('tab-ntr').classList.contains('active') && document.getElementById('work-ntr').classList.contains('active')`), '[번역공증 작업] → 통합 화면(직접 번역 + 고객 공증 배송 관리)');
  check((await calls('^/api/notary/admin/shipping$')).length >= 1, '번역공증 작업 목록 API 그대로 (/api/notary/admin/shipping)');
  await click('#work-review');
  check(await ev(`document.getElementById('gpt-review-wrap').style.display === 'block' && document.getElementById('tab-gpt').classList.contains('active')`), '[검수] → 검수 화면');

  console.log('\n[3] 메뉴 묶음');
  const groups = await ev(`[...document.querySelectorAll('.menu-group')].map(g => ({ t: g.querySelector('.menu-group-title').textContent, items: [...g.querySelectorAll('.tab-btn')].map(b => b.id + ':' + [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()), shown: [...g.querySelectorAll('.tab-btn')].every(b => b.getClientRects().length) }))`);
  const G = Object.fromEntries(groups.map((g) => [g.t, g.items.map((x) => x.split(':')[1])]));
  check(groups.map((g) => g.t).join() === '작업,주문·고객,용어,검수자,기록', '묶음 순서: 작업 · 주문·고객 · 용어 · 검수자 · 기록');
  check(G['작업'].join() === '우회 번역,번역공증 작업,검수', `작업: 우회 번역 · 번역공증 작업 · 검수 — 직접 번역 항목 없음 (${G['작업'].join(' · ')})`);
  check((await ev(`[...document.querySelectorAll('.menu-groups .tab-btn, .work-bar .work-btn')].filter(b => /번역공증 작업/.test(b.textContent)).map(b => b.className.split(' ')[0]).join()`)) === 'work-btn,tab-btn', "'번역공증 작업'은 큰 버튼 1개 + 메뉴 1개");
  check(!(await ev(`/직접 번역/.test(document.querySelector('.menu-groups').textContent + document.querySelector('.work-bar').textContent)`)), "메뉴·큰 버튼에 '직접 번역' 없음");
  check(['AI 프리미엄 납품 대기', '프리미엄 플러스 컨펌', '입금대기', '확인필요·번역실패', '무료 테스트', '수정 요청', '기업 고객', '회원 관리'].every((x) => G['주문·고객'].includes(x)), '주문·고객: 주문 목록(AI 프리미엄·프리미엄 플러스·입금대기·확인필요) · 무료 테스트 · 수정 요청 · 기업 고객 · 회원 관리');
  check(G['용어'].join() === '용어집,용어 추출', '용어: 용어집 · 용어 추출');
  check(['검수자 승인', '승인된 검수자', '반려된 검수자', '배정 (미배정)'].every((x) => G['검수자'].includes(x)), '검수자: 검수자 관리(승인·승인됨·반려) · 배정');
  check(['크레딧 사용 기록', '정산 관리', '업종별 주문 수'].every((x) => G['기록'].includes(x)), '기록: 크레딧 사용 기록 · 정산 관리 · 업종별 주문 수');
  check(groups.every((g) => g.shown), '모든 메뉴가 항상 보임 (업무 모드로 숨기지 않음)');
  const ids = groups.flatMap((g) => g.items.map((x) => x.split(':')[0]));
  const oldIds = ['tab-bp', 'tab-ai', 'tab-pp', 'tab-rv', 'tab-rv-approved', 'tab-rv-rejected', 'tab-st', 'tab-ua', 'tab-failed', 'tab-bypass', 'tab-gpt', 'tab-members', 'tab-terms', 'tab-rev', 'tab-ft', 'tab-corp', 'tab-ntr'];
  check(oldIds.every((x) => ids.includes(x)), '예전 탭 17개 메뉴에 있음 (id 그대로 · 직접 번역은 번역공증 작업으로 합침)');
  check(!/GPT 검수/.test(await ev(`document.querySelector('.menu-groups').textContent + document.querySelector('.work-bar').textContent + document.getElementById('gpt-submit-btn').textContent`)), "메뉴·버튼에 'GPT 검수' 없음 → '검수'");
  const onclick = await ev(`Object.fromEntries([...document.querySelectorAll('.menu-groups .tab-btn')].map(b => [b.id, b.getAttribute('onclick')]))`);
  const OLD_ONCLICK = { 'tab-bp': 'bank_pending', 'tab-ai': 'ai_premium', 'tab-pp': 'premium_plus', 'tab-rv': 'reviewers', 'tab-rv-approved': 'reviewers_approved', 'tab-rv-rejected': 'reviewers_rejected', 'tab-st': 'settlement', 'tab-ua': 'unassigned', 'tab-failed': 'failed', 'tab-bypass': 'bypass', 'tab-gpt': 'gpt_review', 'tab-members': 'members', 'tab-terms': 'terms', 'tab-rev': 'revisions', 'tab-ft': 'free_test', 'tab-corp': 'corp', 'tab-ntr': 'notary_work' };
  check(Object.entries(OLD_ONCLICK).every(([id, t]) => onclick[id] === `switchTab('${t}')`), '탭마다 같은 switchTab 값 (기능·경로 그대로)');
  await click('#tab-rev');
  check(await until(`window.__mock.calls.some(c => c.p === '/api/admin/orders' && c.q === '?tab=revisions')`), '수정 요청 → /api/admin/orders?tab=revisions (예전과 같음)');
  await click('#tab-failed');
  check(await until(`!!document.querySelector('#failed-list .st.st-check')`), '확인필요 = 금색 테두리 배지');
  check(await ev(`getComputedStyle(document.querySelector('#failed-list .st.st-check')).borderTopColor === 'rgb(176, 141, 87)'`), '확인필요 배지 테두리 #B08D57');

  console.log('\n[4] 용어집 · 검수자');
  await click('#tab-terms');
  check(await until(`document.getElementById('terms-wrap').style.display === 'block' && /contract/.test(document.getElementById('terms-list').textContent)`), '용어집 열림 (가짜 용어 표시)');
  await click('#tab-rv');
  check(await until(`!!document.querySelector('#rv-tbody tr[data-id="r1"]')`), '검수자 승인 목록 열림');
  await click('#tab-credit');
  check(await until(`/\\$3\\.50/.test(document.getElementById('credit-spent').textContent)`), '크레딧 사용 기록: 사용액 $3.50');
  check(await ev(`document.getElementById('credit-remaining').textContent === '$46.50 / $50' && document.getElementById('credit-expires').textContent === '2026-11-12'`), '남은 예산 $46.50 / $50 · 만료일 2026-11-12');
  check(await ev(`document.querySelectorAll('#credit-tbody tr').length === 2 && /상한 이전\\(합계 제외\\)/.test(document.querySelector('#credit-tbody tr.credit-out').textContent)`), "표 2줄 · inCap=false 줄에 '상한 이전(합계 제외)'");

  console.log('\n[5] 용어 추출');
  await click('#tab-tx');
  check(await until(`document.getElementById('tx-field').options.length === 3 && document.getElementById('tx-pair').options.length > 30`), '분야(옵션 API) · 언어쌍(우회 번역 목록) 채움');
  check(await ev(`document.getElementById('tx-pair').value === '한국어→영어' && [...document.getElementById('tx-pair').options].some(o => o.value === '중국어(간체)→한국어')`), '언어쌍 값 "출발어→도착어" (공백 없음)');
  const rule = await ev(`document.querySelector('#tx-wrap').textContent.replace(/\\s+/g, ' ')`);
  check(rule.includes('원문+번역 한 쌍은 파일 이름 끝을 _원문 / _번역 으로 (예: 계약서_원문.docx + 계약서_번역.docx). 원문과 번역이 함께 있는 대조 문서는 그대로 올리면 됩니다(예: 계약서_대조.docx). 여러 쌍을 한 번에 올릴 수 있습니다.'), '파일 이름 규칙 문구');
  check(rule.includes('원문만 있는 파일은 받지 않습니다.'), "'원문만 있는 파일은 받지 않습니다.'");
  check(rule.includes('배치로 처리해 몇 분~수십 분 걸릴 수 있습니다. 올린 파일과 중간 결과는 처리 후 서버에서 지웁니다.'), '처리 시간·삭제 안내 문구');
  check(await ev(`document.getElementById('tx-corp-row').style.display === 'none'`), '범위 일반 → 회사명·사업자등록번호 숨김');
  await ev(`(() => { const s = document.getElementById('tx-scope'); s.value = 'corp'; s.dispatchEvent(new Event('change')); return 1; })()`);
  check(await ev(`document.getElementById('tx-corp-row').style.display === ''`), '기업전용 → 회사명·사업자등록번호 보임');
  const doc = await send('DOM.getDocument', {});
  const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#tx-files' });
  await send('DOM.setFileInputFiles', { nodeId: node.result.nodeId, files: UP });
  await ev(`document.getElementById('tx-files').dispatchEvent(new Event('change')), 1`);
  check(await ev(`document.getElementById('tx-start-btn').disabled`), '예상 비용을 보기 전엔 [추출 시작] 꺼짐');
  await click('#tx-estimate-btn');
  check(await until(`/기업전용은 회사명과 사업자등록번호/.test(document.getElementById('tx-msg').textContent)`), '기업전용인데 회사명·번호 없으면 안내 (서버로 안 보냄)');
  await ev(`document.getElementById('tx-company').value = '알파'; document.getElementById('tx-bizno').value = '123-45-67890'; 1`);
  await click('#tx-estimate-btn');
  check(await until(`document.getElementById('tx-estimate').style.display === 'block'`), '예상 비용 표시');
  const est = (await calls('^/api/admin/term-extract/estimate$')).pop();
  check(est && est.m === 'POST' && est.form.files.length === 3 && est.form.pair[0] === '한국어→영어' && est.form.scope[0] === 'corp' && est.form.company[0] === '알파' && est.form.bizNo[0] === '123-45-67890' && est.form.field[0] === 'legal' && est.auth === 'Bearer TEST_TOKEN',
    'estimate: multipart(files×3 · pair · field · scope · company · bizNo) + 관리자 토큰');
  check(await ev(`document.getElementById('tx-est-usd').textContent === '$0.42' && document.getElementById('tx-est-remaining').textContent === '$46.50 / $50'`), '예상 비용 $0.42 · 남은 예산 / 상한 $46.50 / $50');
  check(await ev(`/메모_원문만\\.txt — 원문만 있는 파일은 받지 않습니다\\./.test(document.querySelector('#tx-estimate .tx-rejected').textContent)`), '원문만 있는 파일은 받지 않은 파일로 이유와 함께 표시');
  check(await ev(`/계약서/.test(document.getElementById('tx-estimate').textContent) && /조각 4개/.test(document.getElementById('tx-estimate').textContent)`), '처리할 문서·조각 수 표시');
  check(await ev(`!document.getElementById('tx-start-btn').disabled`), '예산 안 → [추출 시작] 켜짐');
  await ev(`window.__mock.estimateAllowed = false, 1`);
  await click('#tx-estimate-btn');
  check(await until(`document.getElementById('tx-start-btn').disabled && /시작할 수 없습니다/.test(document.getElementById('tx-msg').textContent)`), 'allowed=false → [추출 시작] 꺼짐 + 서버 안내 문구');
  await ev(`window.__mock.estimateAllowed = true, 1`);
  await click('#tx-estimate-btn');
  await until(`!document.getElementById('tx-start-btn').disabled`);
  await click('#tx-start-btn');
  check(await until(`document.getElementById('tx-job').style.display === 'block' && /진행 중/.test(document.getElementById('tx-job-status').textContent)`), '[추출 시작] → 진행 상황 (진행 중)');
  check((await calls('^/api/admin/term-extract/start$')).length === 1, 'start 호출 1번');
  check(await ev(`window.__mock.intervals.includes(10000)`), '10초마다 진행 상황 불러오기');
  check(await ev(`/배치 대기 중/.test(document.getElementById('tx-job-progress').textContent) && !!document.querySelector('#tx-job-status .st-progress')`), '진행 줄 표시 · 진행 중 = 연파랑 배지');
  await ev(`window.__mock.job = '완료', 1`);
  await ev(`txPoll()`);
  check(await until(`/완료/.test(document.getElementById('tx-job-status').textContent)`), '완료로 바뀜');
  const sum = await ev(`document.getElementById('tx-job-result').textContent`);
  check(/뽑은 용어40/.test(sum) && /새 후보30/.test(sum) && /확정25/.test(sum) && /AI가 버림2/.test(sum) && /개인정보 — 2건/.test(sum), '결과 요약 (한국어 이름)');
  check(await ev(`document.getElementById('tx-job-cost').textContent === '$0.39' && !!document.querySelector('#tx-job-status .st-done')`), '실제 비용 $0.39 · 완료 = 네이비 배지');

  console.log('\n[6] 검수 — 엔진 선택');
  await click('#tab-gpt');
  check(await ev(`document.getElementById('review-engine-claude').checked && !document.getElementById('review-engine-gpt').checked`), '기본 엔진 = Claude');
  check(await ev(`[...document.querySelectorAll('.engine-opt')].map(l => l.textContent.trim()).join() === 'Claude (기본),GPT (기존)'`), "선택지 'Claude (기본)' / 'GPT (기존)'");
  check(await ev(`document.getElementById('review-engine-info').textContent === '번역한 AI와 다른 회사 AI로 검수하면 놓친 부분을 더 잘 찾습니다.'`), '안내 한 줄');
  await ev(`document.getElementById('gpt-raw-text').value = '[원문] 시범사용\\n[번역] pilot use'; 1`);
  await click('#gpt-submit-btn');
  check(await until(`document.getElementById('gpt-result-wrap').style.display === 'block'`), 'Claude 검수 실행 → 결과 표시');
  const rev = await ev(`window.__mock.calls.filter(c => ['/api/admin/review-estimate', '/api/admin/gpt-review-manual'].includes(c.p)).map(c => c.p + ':' + (c.json && c.json.engine))`);
  check(rev[0] === '/api/admin/review-estimate:undefined' && rev[1] === '/api/admin/gpt-review-manual:claude', '먼저 review-estimate → 그다음 gpt-review-manual(engine:claude)');
  check(await ev(`/예상 비용 \\$0\\.12 · 남은 예산 \\$46\\.50 \\/ \\$50/.test(document.getElementById('review-estimate').textContent)`), "'예상 비용 $0.12 · 남은 예산 $46.50 / $50'");
  check(await ev(`/실제 비용 \\$0\\.11/.test(document.getElementById('review-estimate').textContent)`), '실행 뒤 실제 비용 $0.11');
  check(await ev(`document.getElementById('gpt-result-score').textContent === '92 / 100' && document.getElementById('gpt-result-text').value === 'Revised text' && document.querySelectorAll('#gpt-change-list .gr-change-item').length === 1 && /용어 통일/.test(document.getElementById('gpt-change-list').textContent)`), '결과 그대로: 점수 · 수정본 · 지적 항목');
  await ev(`window.__mock.reviewAllowed = false; window.__mock.calls.length = 0; 1`);
  await click('#gpt-submit-btn');
  check(await until(`/남은 예산이 부족합니다/.test(document.getElementById('review-estimate').textContent)`), 'allowed=false → 안내 문구');
  check(!(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/gpt-review-manual')`)), 'allowed=false → 검수 실행 안 함');
  await ev(`window.__mock.reviewAllowed = true; window.__mock.reviewMode = '402'; 1`);
  await click('#gpt-submit-btn');
  check(await until(`/Claude 크레딧 예산을 넘었습니다/.test(document.getElementById('review-estimate').textContent) && document.getElementById('review-estimate').classList.contains('warn')`), '402 → 예산 초과 안내');
  await ev(`window.__mock.reviewMode = '503'; 1`);
  await click('#gpt-submit-btn');
  check(await until(`/예산 기록을 확인할 수 없습니다/.test(document.getElementById('review-estimate').textContent)`), '503 → 예산 확인 불가 안내');
  await ev(`window.__mock.reviewMode = 'ok'; window.__mock.calls.length = 0; document.getElementById('review-engine-gpt').click(); 1`);
  await click('#gpt-submit-btn');
  check(await until(`window.__mock.calls.some(c => c.p === '/api/admin/gpt-review-manual')`), 'GPT 검수 실행');
  const g = await ev(`window.__mock.calls.filter(c => ['/api/admin/review-estimate', '/api/admin/gpt-review-manual'].includes(c.p)).map(c => c.p + ':' + (c.json && c.json.engine))`);
  check(g.length === 1 && g[0] === '/api/admin/gpt-review-manual:gpt', 'GPT → engine:gpt 로 보내고 예상 비용 API는 안 부름');

  console.log('\n[7] 우회 번역 접수 · 번역공증 편집 열기');
  await click('#work-bypass');
  await ev(`document.getElementById('bp-text').value = '원문입니다'; window.__mock.calls.length = 0; 1`);
  await ev(`submitBypassOrder()`);
  const bp = (await calls('^/api/admin/translate-bypass$'))[0];
  check(bp && bp.m === 'POST' && bp.auth === 'Bearer TEST_TOKEN', '우회 번역 접수 → POST /api/admin/translate-bypass (예전과 같은 주소)');
  check(bp && bp.json && bp.json.direction === document_dir_expect(), '번역 방향 값 그대로 (예: "포르투갈어 → 한국어")');
  await click('#tab-ntr');
  check(await until(`/NTR-ADM-0001/.test(document.getElementById('ntrd-list').textContent)`), '번역공증 작업 → 최근 직접 번역 목록 열림');
  await ev(`window.__mock.opened.length = 0; ntrdReopen('NTR-ADM-0001')`);
  check(await until(`window.__mock.opened[0] === 'https://iumm.kr/notary/edit.html?t=EDIT_TOKEN'`), '공증 편집 열기: 서버가 준 editUrl(/notary/edit.html) 그대로 새 창');
  check(adminSrc.includes("window.open(NTRD_CUR.editUrl, '_blank')") && adminSrc.includes("window.open(j.editUrl, '_blank')") && adminSrc.includes("'/api/notary/admin/direct/' + encodeURIComponent(orderNumber) + '/reopen'"), '편집 화면 여는 코드·주소 main 과 같음');
  check(fs.existsSync(path.join(ROOT, 'notary/edit.html')), 'notary/edit.html 그대로 있음');

  console.log('\n[7-2] 번역공증 작업 통합 화면');
  await click('#tab-ntr');
  const ntrOrder = await ev(`(() => { const w = document.getElementById('ntrd-wrap'); const pos = (id) => [...w.querySelectorAll('*')].indexOf(document.getElementById(id));
    return { title: w.querySelector('.bp-section-title').textContent.replace(/\\s+/g, ' ').trim(), form: pos('ntrd-submit'), list: pos('ntrd-list'), ship: pos('ntr-ship-sec'), inside: w.contains(document.getElementById('ntr-wrap')) }; })()`);
  check(ntrOrder.title === '번역공증 작업 — 결제 없이 (관리자 전용)', `화면 제목 (${ntrOrder.title})`);
  check(ntrOrder.form >= 0 && ntrOrder.form < ntrOrder.list && ntrOrder.list < ntrOrder.ship && ntrOrder.inside, '위에서 아래로: 직접 번역 시작 → 최근 직접 번역 → 고객 공증 배송 관리');
  check(await until(`document.getElementById('ntrd-doc').options.length >= 1 && document.getElementById('ntrd-doc').value !== '' || [...document.getElementById('ntrd-doc').options].some(o => /가족관계증명서/.test(o.textContent))`) && await ev(`[...document.getElementById('ntrd-lang').options].some(o => o.value === 'en')`), '서류 종류·번역 언어 드롭다운 불러옴 (/api/notary/config)');
  check(await until(`document.getElementById('ntr-ship-sum').textContent === '처리할 배송 건 없음'`), "할 일 0 → '처리할 배송 건 없음' 한 줄");
  check(await ev(`document.getElementById('ntr-wrap').style.display === 'none' && document.getElementById('ntr-ship-toggle').getAttribute('aria-expanded') === 'false' && document.getElementById('ntr-badge').style.display === 'none'`), '할 일 0 → 접힘 · 메뉴 배지 없음');
  await click('#ntr-ship-toggle');
  check(await ev(`document.getElementById('ntr-wrap').style.display === 'block' && document.getElementById('ntr-ship-toggle').getAttribute('aria-expanded') === 'true'`), '누르면 펼쳐짐');
  check(await ev(`['all', 'progress', 'ready', 'shipped', 'manual'].every(f => !!document.querySelector('#ntr-wrap .ntr-f[data-f="' + f + '"]')) && document.querySelectorAll('#ntr-wrap .ntr-t').length === 6`), '펼친 안쪽: 기존 단계·등급 거르기 버튼 그대로');
  await ev(`window.__mock.calls.length = 0; [...document.querySelectorAll('#ntr-wrap button')].find(b => b.textContent.trim() === '새로고침').click(), 1`);
  check(await until(`window.__mock.calls.some(c => c.p === '/api/notary/admin/shipping')`), '배송 [새로고침] → /api/notary/admin/shipping');
  await click('#ntr-ship-toggle');
  check(await ev(`document.getElementById('ntr-wrap').style.display === 'none'`), '다시 누르면 접힘');
  await ev(`window.__mock.manualWaiting = 2; 1`);
  await click('#tab-ai'); await click('#tab-ntr');
  check(await until(`document.getElementById('ntr-wrap').style.display === 'block'`), '할 일 있음 → 섹션 자동 펼침');
  check(await ev(`document.getElementById('ntr-badge').style.display !== 'none' && document.getElementById('ntr-badge').textContent === '2' && /처리할 건 2건/.test(document.getElementById('ntr-ship-sum').textContent)`), '메뉴 배지 2 · 요약 "처리할 건 2건"');
  for (const old of ['notary_ship', 'notary_direct']) {
    await click('#tab-ai');
    await ev(`switchTab('${old}'), 1`);
    check(await ev(`currentTab === 'notary_work' && document.getElementById('ntrd-wrap').style.display === 'block' && document.getElementById('tab-ntr').classList.contains('active')`), `예전 탭 이름 '${old}' → 통합 화면`);
  }
  for (const h of ['#notary_direct', '#notary_ship']) {
    await click('#tab-ai');
    await ev(`location.hash = '${h}', 1`);
    check(await until(`currentTab === 'notary_work' && document.getElementById('ntrd-wrap').style.display === 'block'`), `주소 ${h} → 통합 화면`);
  }
  await ev(`history.replaceState(null, '', location.pathname); window.__mock.manualWaiting = 0; 1`);
  check(adminSrc.includes('function ntrdSubmit()') && adminSrc.includes('async function loadNotaryDirect()') && adminSrc.includes('async function loadNotaryShipping()') && adminSrc.includes('async function ntrdInit()'), '공증 함수 이름 그대로 (ntrdSubmit · loadNotaryDirect · loadNotaryShipping · ntrdInit)');

  console.log('\n[8] 색 · 초점 · 좁은 화면');
  await click('#tab-ai');
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  let bad = await ev(COLOR_SCAN);
  check(bad.length === 0, '첫 화면 계산된 색에 민트·청록·초록·빨강 없음' + (bad.length ? ' — ' + bad.join(' | ') : ''));
  const scanTabs = ['#tab-failed', '#tab-tx', '#tab-gpt', '#tab-credit', '#tab-ntr', '#tab-bypass', '#tab-terms'];
  const badAll = [];
  for (const t of scanTabs) { await click(t); await sleep(250); badAll.push(...(await ev(COLOR_SCAN)).map((x) => t + ' ' + x)); }
  check(badAll.length === 0, '다른 탭(확인필요·용어 추출·검수·크레딧·번역공증 작업·우회 번역·용어집)도 민트·초록·빨강 없음' + (badAll.length ? ' — ' + badAll.slice(0, 6).join(' | ') : ''));
  check(await ev(`getComputedStyle(document.body).backgroundColor === 'rgb(15, 37, 64)' && /Pretendard/.test(getComputedStyle(document.body).fontFamily)`), '바탕 네이비 #0F2540 · 글꼴 Pretendard');
  check(await ev(`getComputedStyle(document.querySelector('.work-btn')).backgroundColor === 'rgb(31, 79, 209)'`), '작업 버튼 파랑 #1F4FD1');
  check(!/fonts\.googleapis/.test(adminSrc) && /pretendard@v1\.3\.9/.test(adminSrc) && /MaruBuri-Regular\.woff2/.test(adminSrc), '글꼴: Pretendard(jsdelivr) + MaruBuri(pstatic) — 고객 홈페이지와 같은 방식, Google Fonts 없음');
  await click('#tab-ai');
  await ev(`document.activeElement && document.activeElement.blur(), 1`);
  check(await tabKeyUntil(`document.activeElement && document.activeElement.classList.contains('work-btn')`), 'Tab 키로 작업 버튼에 초점');
  const fv = await ev(`(() => { const a = document.activeElement, cs = getComputedStyle(a); return { m: a.matches(':focus-visible'), s: cs.outlineStyle, c: cs.outlineColor, w: parseFloat(cs.outlineWidth) }; })()`);
  check(fv.m && fv.s === 'solid' && fv.c === 'rgb(31, 79, 209)' && fv.w >= 2, `:focus-visible 파랑 테두리 (${fv.s} ${fv.w}px ${fv.c})`);

  if (process.env.EXTRA_SHOT_DIR) {   // 확인용 추가 스크린숏 (선택)
    for (const [t, n] of [['#tab-tx', 'term_extract'], ['#tab-gpt', 'review'], ['#tab-credit', 'credit']]) {
      await click(t); await sleep(300);
      const sh = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: await ev('document.documentElement.scrollHeight'), scale: 1 } });
      fs.writeFileSync(path.join(process.env.EXTRA_SHOT_DIR, 'admin_' + n + '.png'), Buffer.from(sh.result.data, 'base64'));
    }
    await click('#tab-ai'); await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  }
  // 스크린숏은 초점·알림 없이 첫 화면 그대로
  await ev(`(document.activeElement && document.activeElement.blur(), document.getElementById('toast').classList.remove('show'), window.scrollTo(0, 0), 1)`);
  await sleep(1200);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, 'admin_preview_desktop.png'), Buffer.from(shot.result.data, 'base64'));

  console.log('\n[9] 모바일 390px');
  await open(390, 844, true, { token: 'TEST_TOKEN' });
  check(await until(`document.getElementById('admin-view').style.display === 'flex' && !!document.querySelector('#orders-tbody tr[data-id="rec1"]')`), '저장된 토큰으로 바로 관리자 화면 (390px)');
  let hs = await ev(NO_HSCROLL);
  check(hs.length === 0, '390px 첫 화면 가로 스크롤 없음' + (hs.length ? ' — ' + hs.join(' | ') : ''));
  const mob = await ev(`(() => { const bs = [...document.querySelectorAll('.work-btn')].map(b => b.getBoundingClientRect()); const gs = [...document.querySelectorAll('.menu-group')].map(g => g.getBoundingClientRect());
    const ow = document.getElementById('orders-wrap'); const t = ow.querySelector('table');
    return { stacked: bs[1].top > bs[0].bottom - 1 && bs[2].top > bs[1].bottom - 1, full: gs.every(r => r.width > 340), groupsStacked: gs.every((r, i) => !i || r.top >= gs[i - 1].bottom - 1),
      tableScroll: t.getBoundingClientRect().width > ow.clientWidth && getComputedStyle(ow).overflowX === 'auto' }; })()`);
  check(mob.stacked, '작업 버튼 세로로 쌓임');
  check(mob.full && mob.groupsStacked, '메뉴 묶음이 한 줄씩 세로로');
  check(mob.tableScroll, '주문 표는 상자 안에서 가로 스크롤');
  for (const t of ['#tab-tx', '#tab-gpt', '#tab-credit', '#tab-bypass', '#tab-terms', '#tab-ntr']) {
    await click(t); await sleep(250);
    hs = await ev(NO_HSCROLL);
    check(hs.length === 0, `390px ${t} 가로 스크롤 없음` + (hs.length ? ' — ' + hs.join(' | ') : ''));
  }
  await click('#tab-ai');
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  await ev(`(document.activeElement && document.activeElement.blur(), document.getElementById('toast').classList.remove('show'), window.scrollTo(0, 0), 1)`);
  await sleep(1200);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, 'admin_preview_mobile.png'), Buffer.from(shot.result.data, 'base64'));
  check(errors.length === 0, '페이지 스크립트 오류 없음' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  server.close();
  await sleep(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
function document_dir_expect() { return '포르투갈어 → 한국어'; }
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} / 실패 ${fail}`);
console.log(`스크린숏: ${SHOT_DIR}/admin_preview_desktop.png · admin_preview_mobile.png`);
process.exit(fail ? 1 : 0);
