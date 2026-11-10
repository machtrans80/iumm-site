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
  const S = window.__mock = { calls: [], intervals: [], opened: [], estimateAllowed: true, reviewAllowed: true, reviewMode: 'ok', job: '진행 중', manualWaiting: 0, hidden: {} };
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
    if (p === '/api/admin/login') return J({ success: true, token: S.loginToken || 'TEST_TOKEN' });
    // 로그인 만료 흉내(2026-11-02) — S.expiredToken 과 같은 토큰으로 오면 401
    if (S.expiredToken && rec.auth === 'Bearer ' + S.expiredToken) return J({ success: false, error: '토큰 만료' }, 401);
    // 번역 중 표시 · 재실행 중복 방지(2026-11-02)
    S.running = S.running || {};
    if (p === '/api/admin/orders/run-state') return J({ ok: true, orders: (u.searchParams.get('ids') || '').split(',').filter(Boolean).map((id) => ({ orderId: id, orderNumber: (S.runNum || {})[id] || id, running: !!S.running[id], pipelineStage: S.running[id] || '', aiScore: S.running[id] ? null : 91 })) });
    const rp = /^\/api\/admin\/reprocess\/([^/]+)$/.exec(p);
    if (rp) { if (S.running[rp[1]]) return J({ ok: false, error: '이미 번역 중입니다' }, 409); S.running[rp[1]] = 'V3:시작'; return J({ ok: true, orderNumber: 'ADMIN-RP-' + rp[1] }); }
    if (p === '/health') return J({ ok: true, commit: 'abcdef1' });
    if (p === '/api/admin/orders') {
      const tab = u.searchParams.get('tab');
      if (tab === 'ai_premium') return J({ success: true, orders: [order(1), order(2, { status: '납품완료' })] });
      // 서버와 같이: 숨긴(admin_hidden) 주문은 tab=failed 에 안 온다
      if (tab === 'failed') return J({ success: true, orders: [order(3, { orderStatus: '확인필요', status: '확인필요', failReason: '확인필요: P0003 숫자 확인', aiTranslation: 'text' })].concat(S.failedExtra || []).filter((o) => !S.hidden[o.orderId]) });
      return J({ success: true, orders: [] });
    }
    // 주문 상세 [용어 추출] (2026-11-02)
    const otx = /^\/api\/admin\/orders\/([^/]+)\/term-extract$/.exec(p);
    if (otx) {
      const O = S.otx = S.otx || {};
      if (m === 'POST') {
        if (O.already && !(rec.json && rec.json.rerun)) return J({ ok: false, error: 'already', already: O.already }, 409);
        O.job = { status: '처리 중', startedAt: '2026-11-02T01:00:00Z', estimate: 0.069 }; return J({ ok: true, job: O.job });
      }
      return J({ ok: true, orderNumber: 'IUMM-1001', usable: true, basis: 'GPT최종검수본', pair: '한국어→일본어', field: 'legal', scope: '공용', docType: '계약서', chars: 11000,
        estimate: { usd: 0.069, chunks: 2 }, budget: { remaining: 46.5, ok: O.budgetOk !== false, message: O.budgetOk === false ? '예상 비용이 남은 예산을 넘습니다.' : '' }, already: O.already || null, hash: 'h1', job: O.job || null });
    }
    // 기업 고객 탭 — 회사별 전용 용어 (2026-11-02)
    if (p === '/api/admin/corp-customers') return J({ ok: true, corps: [{ company: '알파 주식회사', bizNo: '2208162517', firstOrderAt: '2026-11-01', lastOrderAt: '2026-11-02', orderCount: 2, totalPaid: 180000, terms: { 승인: 2, 후보: 1, 충돌: 0 }, consentAt: '2026-11-01' }] });
    if (p === '/api/admin/corp-customers/2208162517') return J({ ok: true, corp: { company: '알파 주식회사', bizNo: '2208162517' },
      orders: [{ orderNumber: 'IUMM-2001', receivedAt: '2026-11-01', direction: '한국어 → 영어', docType: '계약서', status: '납품완료', amount: 90000 }],
      terms: [{ source: '알파 엔진', target: 'Alpha Engine', pair: '한국어→영어', docType: '계약서', status: '승인', count: 3 }, { source: '납품 검수', target: 'acceptance inspection', pair: '한국어→영어', docType: '계약서', status: '후보', count: 1 }] });
    if (p === '/api/admin/orders/hide') { const ids = (rec.json && rec.json.recordIds) || []; ids.forEach((i) => { S.hidden[i] = 1; }); return J({ ok: true, hiddenCount: ids.length }); }
    if (p === '/api/admin/terms') return J({ ok: true, terms: [{ id: 't1', pair: '한국어→영어', source: '계약', target: 'contract', status: '승인', scope: '일반', count: 3, field: '법률', docType: '계약서', lastAt: '2026-10-20', sourceType: '용어구축', memo: '근거: 공식 | https://elaw.klri.re.kr/x' }], facets: { field: ['법률'], docType: ['계약서'], scope: ['일반'], status: ['승인'], sourceType: ['용어구축', '번역결과'] } });
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
    // 납품 전 점검(2026-11-10) — 본문 없이 항목·문단 번호만
    const PD_ITEMS = [['①', '문단 1:1'], ['②', '보호 값'], ['③', '한글 잔존'], ['④', '직함·성씨·설명 괄호'], ['⑤', '주소·도시명'], ['⑥', '지정 용어'], ['⑦', '검수 고침 반영'], ['⑧', '숫자']];
    const pdRep = (bad, by) => { const items = PD_ITEMS.map(([no, label]) => { const l = bad[no] || []; return { no, label, ok: !l.length, n: l.length, list: l }; });
      const n = items.reduce((a, x) => a + x.n, 0);
      return { v: 1, ok: !n, at: '2026-11-10T05:00:00Z', by, blocks: { src: 3, trg: 3 }, items, held: !!n, codeFixed: 1, edited: 0, first: { ok: false, n: n + 1 },
        reason: n ? '납품 보류 — 납품 전 점검 ' + n + '건(' + items.filter((x) => !x.ok).map((x) => x.no + ' ' + x.label + ' ' + x.n).join(' · ') + '; 문단 2,3)' : '' }; };
    S.PD_HOLD = pdRep({ '②': [{ paragraph: 2, kind: '이메일 빠짐(원문 1 · 번역 0)' }], '⑥': [{ paragraph: 2, kind: '지정 용어 없음' }, { paragraph: 3, kind: '지정 용어 없음' }] }, '승인');
    S.PD_OK = pdRep({}, '승인');
    if (/\/save-translation$/.test(p)) { const j = rec.json || {};
      if (j.check && S.saveFix) return J({ ok: true, isFinal: false, preDelivery: pdRep(S.saveFix === 'hold' ? { '⑥': [{ paragraph: 1, kind: '지정 용어 없음' }] } : {}, '저장'), fixedText: j.translation + ' [code-fixed]' });
      return J({ ok: true, isFinal: !!j.isFinal }); }
    // 긴 검수 = 작업(2026-11-10) — 요청은 바로 작업 번호, 화면은 진행 조회
    const jobView = (jb) => Object.assign({ id: jb.id, kind: jb.kind, orderNumber: jb.orderNumber, status: jb.status, startedAt: jb.startedAt, progress: jb.progress }, jb.status !== '진행' ? { code: 200, result: jb.result } : {});
    if (p === '/api/admin/review-job') { const jb = S.rvJob, qi = u.searchParams.get('id'), qn = u.searchParams.get('orderNumber');
      if (!jb || (qi && qi !== jb.id) || (qn && qn !== jb.orderNumber)) return J({ ok: false, error: '작업을 찾지 못했습니다 — 서버가 다시 시작됐을 수 있습니다' }, 404);
      if (jb.status === '진행') { jb.left--; jb.progress = Object.assign({}, jb.progress, { calls: 4 - Math.max(jb.left, 0), part: '단락 1~2/2' }); if (jb.left <= 0) jb.status = '완료'; S.jobPolls = (S.jobPolls || 0) + 1; }
      return J({ ok: true, job: jobView(jb) }); }
    if (p === '/api/admin/review-estimate') { const one = rec.json && rec.json.mode === 'fromRecord';
      return J({ ok: true, estimate: { inTok: 3000, outTok: 2000, perCall: 0.12, calls: one ? 3 : 4, parts: 1, usd: one ? 0.2 : 0.36 }, budget, allowed: S.reviewAllowed,
        message: S.reviewAllowed ? '' : '남은 예산이 부족합니다.' }); }
    // 2026-11-09 2차: 검수 → 최종본(고칠 곳만 코드로) → 재채점 → 승인
    const RV_FIN = 'La partie défenderesse a violé le contrat.\n\nLe demandeur a subi un préjudice.';
    const RV_C = [{ paragraph: 1, before: 'a respecté', after: 'a violé', reason: '오역(위반)', severity: '치명' },
      { paragraph: 1, before: 'La partie défenderesse', after: 'Le défendeur', reason: '용어', severity: '중대' },
      { paragraph: 2, before: 'pozwany', after: 'x', reason: '확인', severity: '경미' }];
    const rvRounds = (ap) => [[Object.assign({}, RV_C[0], { idx: 0, status: '적용' }),
      Object.assign({}, RV_C[1], { idx: 1, status: '자동 거절', termTouched: ['피고 → partie défenderesse'], why: '자동 판정 — 검수기 판정: 같은 뜻(지정 용어 유지)' }),
      Object.assign({}, RV_C[2], { idx: 2, status: '다음 회차로', why: "'지금'이 단락 2 번역에 글자 그대로 없음" })]];
    const RV_UNRES = [{ paragraph: 2, kind: '다음 회차로', before: 'pozwany', after: 'x', why: "'지금'이 단락 2 번역에 글자 그대로 없음" }];
    const rvFinal = (ap) => { const t = ap ? RV_FIN.replace('La partie défenderesse', 'Le défendeur') : RV_FIN; const i = t.indexOf('a violé');
      return { finalText: t, marks: (ap ? [{ start: 0, end: 12 }] : []).concat([{ start: i, end: i + 7 }]), rounds: rvRounds(ap) }; };
    if (p === '/api/admin/gpt-review-manual') {
      if (S.reviewMode === '402') return J({ ok: false, error: 'budget_exceeded', message: 'Claude 크레딧 예산을 넘었습니다.' }, 402);
      if (S.reviewMode === '503') return J({ ok: false, error: 'budget_unavailable', message: '예산 기록을 확인할 수 없습니다.' }, 503);
      const j = rec.json || {}, tl = j.targetLang || '영어';
      const base = { ok: true, engine: 'claude', mode: 'final', id: 'RV-' + (S.rvSeq = (S.rvSeq || 0) + 1), at: '2026-11-09T05:0' + S.rvSeq + ':00Z', kind: j.mode === 'fromRecord' ? '최종본 만들기' : '검수',
        orderNumber: j.orderNumber || null, targetLang: tl, terms: [{ source: '피고', target: 'partie défenderesse' }], termCount: 1, termSource: j.orderNumber ? '이 주문의 V3 용어표' : '지금 승인 용어(공용)',
        exactBase: true, approve: [], approveScored: [], stale: false, approved: null, calls: j.mode === 'fromRecord' ? 1 : 2, costUsd: 0.21, rules: 2, judged: { '0:1': '같음' }, rescores: 1, unresolved: [] };
      let out;
      if (S.reviewMode === 'zero') out = Object.assign(base, { opinions: [{ score: 100, deductions: [], summary: '좋습니다.', changes: [] }], rounds: [[]], final: { score: 100, deductions: [], summary: '좋습니다.', changes: [] },
        scoreBefore: 100, scoreAfter: 100, needsCheck: false, termSuggestions: [], finalText: 'Le texte.', marks: [], calls: 1, costUsd: 0.05 });
      else out = Object.assign(base, { opinions: [{ score: 70, deductions: [{ 분류: '정확성', 점수: 30, 이유: '오역' }], summary: 's', changes: RV_C }],
        final: { score: 96, deductions: [{ 분류: '문체', 점수: 4, 이유: '어색함' }], summary: '좋아졌습니다.', changes: [] }, scoreBefore: 70, scoreAfter: 96, needsCheck: false,
        termSuggestions: [{ source: '피고', current: 'partie défenderesse', suggested: 'défendeur', reason: '형사 사건' }], unresolved: RV_UNRES }, rvFinal(false));
      if (j.orderNumber && (S.rvHistory || []).length && j.mode !== 'fromRecord') Object.assign(out, { kind: '검수(이어받음)', inheritedRounds: 1, inheritedApplied: 1 });
      // 2026-11-10 — 주문 검수: 이 주문 용어표 고침 · 코드 의심 자리(미해결·놓침) · 점수 상한
      if (j.orderNumber && S.reviewMode !== 'zero') Object.assign(out, { termFixes: [{ source: '경장', from: 'gyeongjang (grade de la police coréenne)', to: 'agent de police principal', why: '직함 음역 + 설명 괄호' }],
        suspects: { found: 2, list: [], missed: [{ paragraph: 1, kind: '용어표 오류', word: 'gyeongjang', fix: 'agent de police principal' }], left: [{ paragraph: 1, kind: '용어표 오류', word: 'gyeongjang', fix: 'agent de police principal' }], leftCount: 1 } }, { final: Object.assign({}, out.final, { score: 89, capped: true }), scoreAfter: 89 });
      if (j.orderNumber) S.rvHistory = [out].concat(S.rvHistory || []).slice(0, 5);
      if (j.async && S.rvAsync) { S.rvJob = { id: 'RJ-' + S.rvSeq, kind: '검수', orderNumber: j.orderNumber || null, status: '진행', startedAt: new Date().toISOString(), left: 3, result: out, progress: { calls: 0, maxCalls: 4, label: '검수', usd: 0.12 } };
        return J({ ok: true, async: true, job: jobView(S.rvJob) }); }
      return J(out);
    }
    if (p === '/api/admin/review-apply') { const ap = (rec.json.approve || []).includes('0:1'); return J(Object.assign({ ok: true, approve: rec.json.approve, stale: ap }, rvFinal(ap))); }
    if (p === '/api/admin/review-rescore') { const ap = (rec.json.approve || []).includes('0:1');
      return J(Object.assign({ ok: true, final: { score: 94, deductions: [{ 분류: '용어', 점수: 6, 이유: '확인' }], summary: '다시 채점', changes: [] }, scoreAfter: 94, needsCheck: false, approveScored: [], stale: false, termSuggestions: [], costUsd: 0.1,
        rules: 2, judged: { '0:1': '같음' }, rescores: 2, unresolved: [], approve: [] }, rvFinal(ap))); }
    if (p === '/api/admin/review-approve-estimate') return J({ ok: true, preDelivery: S.approveHold ? S.PD_HOLD : S.PD_OK, orderStatus: '확인필요', scoreAfter: 96, aiScore: 70, termEstimate: { usd: 0.07, chunks: 1 }, budget: { remaining: 46.5, ok: true }, stale: false, approved: false,
      fatalWarning: { count: 1, message: '미해결 1곳 남음 — 직함 음역 "gyeongjang"', list: [{ paragraph: 1, kind: '용어표 오류', word: 'gyeongjang', fix: 'agent de police principal' }] } });
    if (p === '/api/admin/review-approve' && S.approveHold) return J({ ok: false, hold: true, error: S.PD_HOLD.reason, preDelivery: S.PD_HOLD }, 409);
    if (p === '/api/admin/review-approve') { S.approvedAt = '2026-11-09T06:00:00Z';
      return J({ ok: true, approved: { at: S.approvedAt, titleWarning: { count: 2, titles: ['경장'], message: '직함 음역 2곳 — 계급·직함을 뜻으로 고쳐 주세요(경장 → gyeongjang)' }, fatalWarning: { count: 1, message: '미해결 1곳 남음 — 직함 음역 "gyeongjang"' }, saved: { ok: true, chars: 76 }, score: { ok: true, before: 70, after: 96 }, status: { ok: true, text: '확인필요 → 납품대기(최종검토중)' }, terms: { status: '처리 중', estimate: 0.07 }, preDelivery: S.PD_OK } }); }
    if (p === '/api/admin/review-approval') return J({ ok: true, approved: { at: S.approvedAt, titleWarning: { count: 2, titles: ['경장'], message: '직함 음역 2곳 — 계급·직함을 뜻으로 고쳐 주세요(경장 → gyeongjang)' }, fatalWarning: { count: 1, message: '미해결 1곳 남음 — 직함 음역 "gyeongjang"' }, saved: { ok: true, chars: 76 }, score: { ok: true, before: 70, after: 96 }, status: { ok: true, text: '확인필요 → 납품대기(최종검토중)' },
      preDelivery: S.PD_OK, terms: { status: '완료', counts: { 새용어: 6, 승인: 2, 후보: 3, 충돌: 1, 거절: 1, 건너뜀: 0 }, costUsd: 0.06, file: { name: 'term_extracted_IUMM-FR-1_2026-11-09.txt', text: '원고 → demandeur | 승인 | 내부전용\n' } } } });
    if (p === '/api/admin/review-options') return J({ ok: true, langs: ['한국어', '영어', '프랑스어', '폴란드어'], fields: [{ code: 'general', name: '일반' }, { code: 'legal', name: '법률계약' }] });
    if (p === '/api/admin/review-order') {
      const no = u.searchParams.get('orderNumber');
      if (no === 'ORD-DEL') return J({ ok: false, deleted: true, orderNumber: no, message: '본문이 지워진 주문입니다 — 붙여 넣어 주세요' });
      return J({ ok: true, orderNumber: no, rawText: '[원문] 피고는 계약을 위반하였다.\n[번역] La partie défenderesse a violé le contrat.', basis: 'GPT최종검수본', sourceLang: '한국어', targetLang: '프랑스어',
        fieldCode: 'legal', scope: 'internal', termCount: 1, termSource: '이 주문의 V3 용어표', history: S.rvHistory || [] });
    }
    if (p === '/api/admin/credit-budget' && S.unlimited) return J({ ok: true, cap: null, remaining: null, unlimited: true, expired: true, spent: 60, monthSpent: 7.25, outsideCap: 0, expires: '2026-11-12', rows: [] });
    if (p === '/api/admin/credit-budget') return J({ ok: true, cap: 50, spent: 3.5, remaining: 46.5, outsideCap: 1.2, expires: '2026-11-12',
      rows: [{ at: '2026-10-30T10:00:00Z', task: '용어 확정', model: 'claude-opus', batch: true, calls: 12, inTok: 50000, outTok: 9000, usd: 2.1, inCap: true, memo: '' },
             { at: '2026-10-20T10:00:00Z', task: '시험 호출', model: 'claude-opus', batch: false, calls: 1, inTok: 100, outTok: 50, usd: 1.2, inCap: false, memo: '상한 전' }] });
    if (p === '/api/admin/v3-scores') return J({ ok: true, watchBelow: 90, total: { orders: 5, scored: 4, avg: 89.5 },
      rows: [{ pair: '한국어→일본어', orders: 2, scored: 2, unscored: 0, avg: 86, min: 84, last7: { orders: 1, avg: 88 }, watch: true },
             { pair: '한국어→영어', orders: 3, scored: 2, unscored: 1, avg: 93, min: 92, last7: { orders: 0, avg: null }, watch: false }] });
    if (p === '/api/admin/translate-bypass') return J({ success: true, orderNumber: 'IUMM-BP-1', orderId: 'recBP', airtableId: 'recBP' });
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
  check(await until(`document.getElementById('review-budget').textContent.includes('이번 주기 남은 예산 $46.50 / $50 · 주기 만료 2026-11-12')`), '검수 화면: 이번 주기 남은 예산 · 주기 만료일 표시');

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
  check(['크레딧 사용 기록', '정산 관리', '업종별 주문 수', '언어별 점수판'].every((x) => G['기록'].includes(x)), '기록: 크레딧 사용 기록 · 정산 관리 · 업종별 주문 수 · 언어별 점수판');
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

  console.log('\n[3-2] 확인필요·번역실패 카드 [숨기기]');
  const hideBtn = `[...document.querySelectorAll('#failed-list button')].find(b => b.textContent.trim() === '숨기기')`;
  check(await ev(`!!${hideBtn}`), '카드에 [숨기기] 버튼');
  check(await ev(`(() => { const c = getComputedStyle(${hideBtn}); return c.color === 'rgb(157, 183, 245)' && c.borderTopColor === 'rgb(31, 79, 209)'; })()`), '[숨기기] 파란색 (글자 #9DB7F5 · 테두리 #1F4FD1)');
  await ev(`window.__confirmMsg = ''; window.confirm = (m) => { window.__confirmMsg = m; return false; }; window.__mock.calls.length = 0; ${hideBtn}.click(), 1`);
  check(await ev(`/IUMM-1003/.test(window.__confirmMsg) && /보존/.test(window.__confirmMsg) && !window.__mock.calls.some(c => c.p === '/api/admin/orders/hide')`), '확인 창(주문번호·보존 안내) → [취소]면 숨기지 않음');
  await ev(`window.confirm = () => true; ${hideBtn}.click(), 1`);
  check(await until(`window.__mock.calls.some(c => c.p === '/api/admin/orders/hide' && c.m === 'POST' && JSON.stringify(c.json) === '{"recordIds":["rec3"]}')`), '[확인] → 기존 /api/admin/orders/hide 에 recordIds:[rec3]');
  check(await until(`/확인필요·번역실패 주문 없음/.test(document.getElementById('failed-list').textContent)`), '숨긴 뒤 목록 다시 불러옴 → 카드 사라짐');
  await click('#tab-ai');
  check(await until(`!!document.querySelector('#orders-wrap tr[data-id="rec1"]')`) && !(await ev(`!!document.querySelector('#orders-wrap tr[data-id="rec3"]')`)), 'AI 프리미엄 목록에도 숨긴 확인필요 주문 없음 (다른 주문은 그대로)');
  await ev(`window.__mock.hidden = {}; 1`);

  console.log('\n[4] 용어집 · 검수자');
  await click('#tab-terms');
  check(await until(`document.getElementById('terms-wrap').style.display === 'block' && /contract/.test(document.getElementById('terms-list').textContent)`), '용어집 열림 (가짜 용어 표시)');
  check(await ev(`[...document.querySelectorAll('#terms-filters select')].some(x => /출처 전체/.test(x.textContent) && /용어구축/.test(x.textContent)) && document.getElementById('terms-list').textContent.includes('근거: 공식 | https://elaw')`), "용어집: '출처' 필터(용어구축) · 근거(공식 | 주소) 표시");
  await ev(`termsFilter('sourceType', '용어구축'), 1`);
  check(await until(`window.__mock.calls.some(c => c.p === '/api/admin/terms' && /sourceType=%EC%9A%A9%EC%96%B4%EA%B5%AC%EC%B6%95/.test(c.q))`), "출처 '용어구축' 고르면 sourceType 으로 요청");
  await ev(`termsFilter('sourceType', ''), 1`);
  await click('#tab-rv');
  check(await until(`!!document.querySelector('#rv-tbody tr[data-id="r1"]')`), '검수자 승인 목록 열림');
  await click('#tab-credit');
  check(await until(`/\\$3\\.50/.test(document.getElementById('credit-spent').textContent)`), '크레딧 사용 기록: 사용액 $3.50');
  check(await ev(`document.getElementById('credit-remaining').textContent === '$46.50 / $50' && document.getElementById('credit-expires').textContent === '2026-11-12'`), '남은 예산 $46.50 / $50 · 만료일 2026-11-12');
  check(await ev(`document.querySelectorAll('#credit-tbody tr').length === 2 && /상한 이전\\(합계 제외\\)/.test(document.querySelector('#credit-tbody tr.credit-out').textContent)`), "표 2줄 · inCap=false 줄에 '상한 이전(합계 제외)'");
  await ev(`window.__mock.unlimited = true, loadCreditBudget(), 1`);
  check(await until(`document.getElementById('credit-remaining').textContent === '상한 없음 · 이번 달 사용액 $7.25'`), "주기 만료 뒤: '상한 없음 · 이번 달 사용액'");
  await ev(`loadReviewBudget(), 1`);
  check(await until(`document.getElementById('review-budget').textContent.includes('상한 없음 · 이번 달 사용액 $7.25')`), '주기 만료 뒤 검수 화면도 상한 없음 표시');
  await ev(`window.__mock.unlimited = false, loadCreditBudget(), 1`);

  await click('#tab-ls');
  check(await until(`document.getElementById('ls-wrap').style.display === 'block' && document.querySelectorAll('#ls-tbody tr').length === 2`), '언어별 점수판: 열림 · 언어 방향 2줄 (/api/admin/v3-scores)');
  check(await ev(`document.getElementById('orders-wrap').style.display === 'none' && /Claude 채점/.test(document.getElementById('ls-wrap').textContent) && /GPT 최종 검수 점수는 섞지 않습니다/.test(document.getElementById('ls-wrap').textContent)`), "점수판: 'Claude 채점' 표시 · GPT 점수 안 섞는다는 안내");
  check(await ev(`(() => { const tr = document.querySelectorAll('#ls-tbody tr'); return tr[0].classList.contains('ls-watch') && !tr[1].classList.contains('ls-watch') && /86/.test(tr[0].textContent) && /88 \\(1건\\)/.test(tr[0].textContent) && /평균 90 미만/.test(tr[0].textContent); })()`), '평균 90 미만(일본어 86) 줄만 강조 · 최근 7일 평균(건)');
  check(await ev(`(() => { const c = getComputedStyle(document.querySelector('#ls-tbody tr.ls-watch td')).backgroundColor; const m = c.match(/\\d+/g).map(Number); return m[2] > m[0] && m[2] > m[1]; })()`), '강조 색 = 파란 계열(빨강·초록 아님)');

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

  console.log('\n[6] 검수 — 언어 선택 · 검수 → 최종본 → 재채점 (2026-11-09 2차, ChatGPT 지시문 없음)');
  await click('#tab-gpt');
  check(await until(`document.getElementById('rv-tgt').options.length === 4 && document.getElementById('rv-field').options.length === 2`), '언어·분야 목록 = 서버 review-options');
  check(await ev(`document.getElementById('rv-src').value === '한국어' && document.getElementById('rv-tgt').value === '영어' && document.getElementById('rv-field').value === 'general' && document.getElementById('rv-scope').value === 'public'`), '기본값 한국어 → 영어 · 일반 · 공용');
  check(await ev(`!document.getElementById('review-engine-gpt') && !document.querySelector('input[name="review-engine"]')`), 'GPT 엔진 선택 숨김(Claude 하나)');
  check(await ev(`/어색한 영어 표현/.test(document.getElementById('rv-fixed').value) && !/영문/.test(document.getElementById('rv-fixed').value)`), "설명 문구 '어색한 영어 표현'(영문 아님)");
  await ev(`document.getElementById('rv-tgt').value = '프랑스어'; reviewLangChanged(); 1`);
  check(await ev(`/어색한 프랑스어 표현/.test(document.getElementById('rv-fixed').value)`), '도착어 바꾸면 설명도 프랑스어');
  check(await ev(`!document.getElementById('rv-instruction') && !document.getElementById('rv-include-full') && !document.getElementById('rv-copy-btn') && !/ChatGPT/.test(document.getElementById('gpt-review-wrap').textContent)`), 'ChatGPT 지시문 · [번역문 전체 함께 넣기] · 지시문 [복사] 없음');
  await ev(`sessionStorage.removeItem('iumm_review_paste_v1'); document.getElementById('gpt-raw-text').value = '[원문] 피고는 계약을 위반하였다.\\n[번역] La partie défenderesse a respecté le contrat.'; window.__mock.calls.length = 0; 1`);
  await click('#gpt-submit-btn');
  check(await until(`document.getElementById('gpt-result-wrap').style.display === 'block'`), '검수 실행 → 결과 표시');
  const rv = await ev(`window.__mock.calls.filter(c => ['/api/admin/review-estimate', '/api/admin/gpt-review-manual'].includes(c.p)).map(c => c.json)`);
  check(rv.length === 2 && rv.every((j) => j.sourceLang === '한국어' && j.targetLang === '프랑스어' && j.fieldCode === 'general' && j.scope === 'public' && !('orderNumber' in j)) && rv[1].engine === 'claude', '예상 → 검수 모두 고른 언어·분야·범위로(주문번호 없음)');
  check(await ev(`/예상 비용 최대 \\$0\\.36 \\(Claude Opus 4회 — 검수 1 \\+ 재채점 최대 3\\) · 남은 예산 \\$46\\.50 \\/ \\$50/.test(document.getElementById('review-estimate').textContent) && /실제 비용 \\$0\\.21/.test(document.getElementById('review-estimate').textContent)`), '예상 비용(최대 회차) · 남은 예산 · 실제 비용');
  check(await ev(`document.getElementById('gpt-result-score').textContent === '70 → 96' && /문체 −4/.test(document.getElementById('rv-deductions').textContent) && /최종본 기준/.test(document.getElementById('rv-deductions').textContent)`), '점수 전 → 후 · 감점 근거(최종본 기준)');
  check(await ev(`document.getElementById('rv-final').textContent === 'La partie défenderesse a violé le contrat.\\n\\nLe demandeur a subi un préjudice.' && [...document.querySelectorAll('#rv-final mark.rv-mark')].map(m => m.textContent).join('|') === 'a violé'`), '최종본 전체 + 바뀐 곳 파란 배경');
  check(await ev(`getComputedStyle(document.querySelector('#rv-final mark')).backgroundColor === 'rgba(31, 79, 209, 0.55)'`), '바뀐 곳 배경 = 파랑');
  check(await ev(`(() => { const t = document.getElementById('gpt-change-list').textContent; return document.querySelectorAll('#gpt-change-list .gr-change-item').length === 1 && /지금a respecté/.test(t) && /고친 것a violé/.test(t) && /오역\\(위반\\)/.test(t) && /치명/.test(t); })()`), '바뀐 곳 목록(지금 → 고친 것, 이유)');
  check(await ev(`document.getElementById('rv-auto-wrap').style.display === 'block' && /자동 판정 · 지정 용어 유지/.test(document.getElementById('rv-auto-list').textContent) && /같은 뜻/.test(document.getElementById('rv-auto-list').textContent) && /피고 → partie défenderesse/.test(document.getElementById('rv-auto-list').textContent)`), "지정 용어 고칠 곳 = '자동 판정'(이유 표시)");
  check(await ev(`!document.querySelector('#gpt-result-wrap input[type=checkbox]') && typeof window.reviewToggleCheck === 'undefined' && !/확인 필요 \\(/.test(document.getElementById('gpt-result-wrap').textContent)`), "체크 상자 없음 · '확인 필요' 목록 없음");
  check(await ev(`document.getElementById('rv-unres-wrap').style.display === 'block' && /글자 그대로 없음/.test(document.getElementById('rv-unres-list').textContent) && document.getElementById('rv-fail-wrap').style.display === 'none'`), "못 찾은 고칠 곳 = '미해결'(이유)");
  check(await ev(`document.getElementById('rv-sugg-wrap').style.display === 'block' && /défendeur/.test(document.getElementById('rv-sugg-list').textContent) && /적용하지 않음/.test(document.getElementById('rv-sugg-wrap').textContent)`), '용어 변경 제안(보여 주기만)');
  check(await ev(`document.getElementById('rv-approve-btn').style.display === 'none'`), '붙여 넣은 검수 = [승인] 없음(복사만)');
  check(await ev(`(() => { const a = JSON.parse(sessionStorage.getItem('iumm_review_paste_v1') || '[]'); return a.length === 1 && a[0].finalText.includes('a violé') && /이 탭에서 붙여 넣은 검수/.test(document.getElementById('rv-history').textContent); })()`), '붙여 넣은 검수 = 이 탭 sessionStorage 에만 · 목록');
  await ev(`window.__clip = null; navigator.clipboard.writeText = async (t) => { window.__clip = t; }; 1`);
  await click('#rv-copy-final');
  check(await until(`window.__clip === 'La partie défenderesse a violé le contrat.\\n\\nLe demandeur a subi un préjudice.'`), '[복사] → 최종본 그대로 클립보드');
  await ev(`window.__mock.calls.length = 0; 1`);
  await click('#rv-rescore-btn');
  check(await until(`document.getElementById('gpt-result-score').textContent === '70 → 94' && document.getElementById('rv-unres-wrap').style.display === 'none'`), '[다시 채점] → 새 점수 · 미해결 0');
  const rsc = await ev(`window.__mock.calls.filter(c => c.p === '/api/admin/review-rescore').map(c => c.json)`);
  check(rsc.length === 1 && Array.isArray(rsc[0].opinions) && rsc[0].judged && rsc[0].judged['0:1'] === '같음' && !(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/review-apply')`)), '[다시 채점] = 붙여 넣은 검수는 고칠 곳·판정을 함께 보냄(체크 반영 없음)');
  {
    await ev(`(document.getElementById('gpt-result-wrap').scrollIntoView({ block: 'start' }), 1)`); await sleep(200);
    const r = await ev(`(() => { const p = document.getElementById('gpt-result-wrap').getBoundingClientRect(); return { x: Math.max(0, p.left - 8), y: Math.max(0, p.top + scrollY - 8), width: p.width + 16, height: Math.min(p.height + 16, 2400) }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_review_final_result.png'), Buffer.from(sh.result.data, 'base64'));
  }
  await ev(`window.__mock.reviewMode = 'zero'; 1`);
  await click('#gpt-submit-btn');
  check(await until(`/고칠 곳 없음 — 그대로 납품 가능/.test(document.getElementById('gpt-change-list').textContent) && document.getElementById('gpt-result-score').textContent === '100 → 100'`), '고칠 곳 0 → 한 줄');
  await ev(`window.__mock.reviewMode = 'ok'; 1`);

  console.log('\n[6-1] 주문번호로 불러오기 → 검수 기록 → 승인');
  await ev(`document.getElementById('rv-order-no').value = 'IUMM-FR-1'; window.__mock.calls.length = 0; 1`);
  await click('#rv-order-btn');
  check(await until(`/IUMM-FR-1 불러옴/.test(document.getElementById('rv-order-msg').textContent)`), '불러오기 → 안내');
  check(await ev(`document.getElementById('gpt-raw-text').value.startsWith('[원문] 피고는') && document.getElementById('rv-tgt').value === '프랑스어' && document.getElementById('rv-field').value === 'legal' && document.getElementById('rv-scope').value === 'internal' && /이 주문의 V3 용어표 1개/.test(document.getElementById('rv-order-msg').textContent)`), '원문·번역·번역방향·분야·내부전용·용어표 채움');
  check(await ev(`/지난 검수 없음/.test(document.getElementById('rv-history').textContent)`), '지난 검수 0');
  await ev(`window.__mock.calls.length = 0; 1`);
  await click('#gpt-submit-btn');
  await until(`window.__mock.calls.some(c => c.p === '/api/admin/gpt-review-manual')`);
  const ro = await ev(`window.__mock.calls.filter(c => c.p === '/api/admin/gpt-review-manual').map(c => c.json)[0]`);
  check(ro && ro.orderNumber === 'IUMM-FR-1' && ro.targetLang === '프랑스어' && ro.scope === 'internal', '불러온 주문 → 검수 때 주문번호 함께');
  check(await until(`document.getElementById('rv-approve-btn').style.display === ''`), '주문번호로 불러온 검수 = [승인] 보임');
  check(await ev(`(() => { const t = document.getElementById('rv-terms-info').textContent; return /이 주문 용어표 고침 1건/.test(t) && t.includes('gyeongjang (grade de la police coréenne) → agent de police principal'); })()`), "'이 주문 용어표 고침' — 옛 번역어 → 고친 번역어(2026-11-10)");
  check(await ev(`(() => { const t = document.getElementById('rv-score-flags').textContent; return /미해결 1곳/.test(t) && /점수 상한 89/.test(t) && /검수가 고칠 곳으로 내지 않은 의심 자리 1곳/.test(t) && /gyeongjang → agent de police principal/.test(t); })()`), '미해결 · 점수 상한 89 · 검수가 놓친 의심 자리 표시');
  await click('#rv-order-btn');   // 새로 불러오기 = 새로고침 뒤와 같음(서버 기록)
  // (이어받기 표시는 아래 '다시 검수' 뒤에 확인)
  check(await until(`document.querySelectorAll('#rv-history .rv-hist-row').length === 1 && /70 → 89/.test(document.getElementById('rv-history').textContent) && /승인 전/.test(document.getElementById('rv-history').textContent)`), "다시 불러오면 '지난 검수'에 보임(시각 · 점수 전→후 · 승인 여부)");
  check(await ev(`['열기', '이 검수로 최종본 만들기', '다시 검수', '승인'].every(t => [...document.querySelectorAll('#rv-history button')].some(b => b.textContent === t))`), '지난 검수 버튼 — 열기 · 이 검수로 최종본 만들기 · 다시 검수 · 승인');
  await ev(`window.__mock.calls.length = 0; document.getElementById('gpt-result-wrap').style.display = 'none'; 1`);
  await ev(`[...document.querySelectorAll('#rv-history button')].find(b => b.textContent === '열기').click(), 1`);
  check(await until(`document.getElementById('gpt-result-wrap').style.display === 'block' && /비용 없음/.test(document.getElementById('gpt-status-msg').textContent)`), '[열기] → 저장된 결과');
  check(await ev(`!window.__mock.calls.some(c => /gpt-review-manual|review-rescore|review-estimate/.test(c.p))`), '[열기] = AI 호출 없음');
  await ev(`window.__mock.calls.length = 0; 1`);
  await ev(`[...document.querySelectorAll('#rv-history button')].find(b => b.textContent === '이 검수로 최종본 만들기').click(), 1`);
  await until(`window.__mock.calls.some(c => c.p === '/api/admin/gpt-review-manual')`);
  const fr2 = await ev(`window.__mock.calls.filter(c => c.p === '/api/admin/gpt-review-manual' || c.p === '/api/admin/review-estimate').map(c => c.json)`);
  check(fr2.length === 2 && fr2.every((j) => j.mode === 'fromRecord' && /^RV-/.test(j.recordId)) && /재채점 최대 3회/.test(await ev(`document.getElementById('review-estimate').textContent`)), '[이 검수로 최종본 만들기] → 기록 번호로 · 예상 재채점 최대 3회');
  check(await until(`document.querySelectorAll('#rv-history .rv-hist-row').length === 2 && /최종본 만들기/.test(document.getElementById('rv-history').textContent)`), '새 기록이 목록 맨 위에');
  await click('#gpt-submit-btn');   // 승인 안 한 기록이 있는 주문을 다시 검수 → 이어받기(2026-11-10 2차)
  check(await until(`/이전 검수에서 이어받은 고침 1곳/.test(document.getElementById('rv-score-flags').textContent) && document.querySelectorAll('#rv-history .rv-hist-row').length === 3`), "승인 안 한 기록이 있으면 '이전 검수에서 이어받은 고침 n곳'");
  await click('#rv-approve-btn');
  check(await until(`/이 최종본을 납품본으로 저장하고, 점수 반영 · 용어 추출을 진행합니다\\./.test(document.getElementById('rv-confirm').textContent) && /용어 추출 예상 \\$0\\.07/.test(document.getElementById('rv-confirm').textContent)`), '승인 전 확인창(화면 안) — 문구 · 용어 추출 예상 비용');
  check(!(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/review-approve')`)), '확인 전에는 승인 안 함');
  check(await ev(`/⚠ 미해결 1곳 남음/.test(document.getElementById('rv-confirm').textContent) && document.getElementById('rv-approve-go').textContent === '그래도 승인'`), "승인 확인창 — '미해결 n곳 남음' 경고 · [그래도 승인](막지 않음)");
  await click('#rv-approve-go');
  check(await until(`document.getElementById('rv-approved').style.display === 'block'`), '[승인 진행] → 승인');
  const apr = (await calls('^/api/admin/review-approve$'))[0];
  check(apr && apr.json.orderNumber === 'IUMM-FR-1' && /^RV-/.test(apr.json.recordId), '승인 요청 = 주문번호 · 기록 번호');
  check(await ev(`(() => { const t = document.getElementById('rv-approved').textContent; return /납품본반영됨/.test(t) && /점수반영됨 — AI종합점수 70 → 96/.test(t) && /상태확인필요 → 납품대기/.test(t) && /용어 추출처리 중/.test(t); })()`), "승인 뒤 '납품본 반영됨 · 점수 반영됨 · 상태 · 용어 추출' 한 줄씩");
  check(await ev(`document.getElementById('rv-approve-btn').style.display === 'none' && document.getElementById('rv-rescore-btn').style.display === 'none'`), '승인 뒤 [승인]·[다시 채점] 없음');
  check(await until(`/완료 — 승인 2 · 충돌 1 · 후보 3 · 거절 1/.test(document.getElementById('rv-approved').textContent) && /용어 파일 저장/.test(document.getElementById('rv-approved').textContent)`, 9000), '용어 추출 결과 요약 · [용어 파일 저장]');
  check(await ev(`/경고직함 음역 2곳/.test(document.getElementById('rv-approved').textContent)`), "승인 뒤 '직함 음역 n곳' 경고 줄(2026-11-09 — 막지 않음)");
  check(await ev(`/경고미해결 1곳 남음/.test(document.getElementById('rv-approved').textContent)`), "승인 뒤 '미해결 n곳 남음' 경고 줄(2026-11-10)");
  check(await ev(`/납품 전 점검납품 전 점검: 통과/.test(document.getElementById('rv-approved').textContent.replace(/\\s+/g, ''))`) || await ev(`/납품 전 점검\\s*납품 전 점검: 통과/.test(document.getElementById('rv-approved').textContent)`), "승인 뒤 '납품 전 점검: 통과' 줄");
  check(await ev(`_rvState.approved.terms.file.name === 'term_extracted_IUMM-FR-1_2026-11-09.txt' && /승인됨/.test(document.getElementById('rv-history').textContent) && /최종본 만들기/.test(document.getElementById('rv-history').textContent) && !/order|paste/.test(document.getElementById('rv-history').textContent)`), '파일 이름 term_extracted_<주문번호>_<날짜>.txt · 목록에 승인됨');
  {
    await ev(`(document.getElementById('gpt-result-wrap').scrollIntoView({ block: 'start' }), 1)`); await sleep(200);
    const r = await ev(`(() => { const p = document.getElementById('gpt-result-wrap').getBoundingClientRect(); return { x: Math.max(0, p.left - 8), y: Math.max(0, p.top + scrollY - 8), width: p.width + 16, height: Math.min(p.height + 16, 1400) }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_review_final_approved.png'), Buffer.from(sh.result.data, 'base64'));
    await ev(`(document.querySelector('#gpt-review-wrap .gr-section').scrollIntoView({ block: 'start' }), 1)`); await sleep(200);
    const r2 = await ev(`(() => { const a = document.querySelector('#gpt-review-wrap .gr-section').getBoundingClientRect(); return { x: Math.max(0, a.left - 8), y: Math.max(0, a.top + scrollY - 8), width: a.width + 16, height: a.height + 16 }; })()`);
    const sh2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...r2, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_review_final_history.png'), Buffer.from(sh2.result.data, 'base64'));
  }
  await ev(`document.getElementById('rv-order-no').value = 'ORD-DEL'; reviewOrderInput(); 1`);
  check(await ev(`/불러온 주문을 풀었습니다/.test(document.getElementById('rv-order-msg').textContent)`), '주문번호 바꾸면 불러온 주문 풀림');
  await click('#rv-order-btn');
  check(await until(`document.getElementById('rv-order-msg').textContent === '본문이 지워진 주문입니다 — 붙여 넣어 주세요' && document.getElementById('rv-order-msg').classList.contains('rv-warn')`), '지워진 주문 → 안내');
  await ev(`window.__mock.calls.length = 0; 1`);
  await click('#gpt-submit-btn');
  await until(`window.__mock.calls.some(c => c.p === '/api/admin/gpt-review-manual')`);
  check(await ev(`!('orderNumber' in window.__mock.calls.filter(c => c.p === '/api/admin/gpt-review-manual')[0].json)`), '지워진 주문은 주문번호 안 보냄(지금 승인 용어)');

  console.log('\n[6-3] 긴 검수 = 작업(진행 표시 · 새로 고쳐도 이어보기) · 납품 전 점검 보류(2026-11-10)');
  await ev(`window.RV_JOB_POLL_MS = 120; window.__mock.rvAsync = true; window.__mock.calls.length = 0; document.getElementById('rv-order-no').value = 'IUMM-PL-9'; 1`);
  await click('#rv-order-btn');
  await until(`/IUMM-PL-9 불러옴/.test(document.getElementById('rv-order-msg').textContent)`);
  await click('#gpt-submit-btn');
  check(await until(`/검수 진행 중 — 검수 · Claude \\d\\/4회/.test(document.getElementById('gpt-status-msg').textContent) && /새로 고쳐도 이어서 봅니다/.test(document.getElementById('gpt-status-msg').textContent)`), "검수 = 작업 — '검수 진행 중 · Claude n/4회 · 경과' 표시");
  check(await ev(`window.__mock.calls.find(c => c.p === '/api/admin/gpt-review-manual').json.async === true`), '검수 요청에 async:true');
  check(await ev(`(() => { try { return JSON.parse(localStorage.getItem('iumm_review_job_v1')).orderNumber === 'IUMM-PL-9'; } catch (e) { return false; } })()`), '진행 중 작업 번호를 브라우저에 기억(새로 고침 대비)');
  check(await until(`/완료 — Claude/.test(document.getElementById('gpt-status-msg').textContent) && document.getElementById('gpt-result-wrap').style.display === 'block'`, 6000), '작업 끝 → 결과 화면(오류 없음)');
  check(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/review-job') && !localStorage.getItem('iumm_review_job_v1')`), '진행 조회(/api/admin/review-job) · 끝나면 기억 지움');
  // 새로 고침 흉내 — 서버에서 작업이 돌고 있는 주문을 다시 불러오면 이어서 본다
  await ev(`(() => { const S = window.__mock; S.rvSeq++; const r = Object.assign({}, S.rvHistory[0], { id: 'RV-' + S.rvSeq, at: '2026-11-10T06:00:00Z', scoreAfter: 97 }); S.rvHistory = [r].concat(S.rvHistory).slice(0, 5);
    S.rvJob = { id: 'RJ-R', kind: '다시 채점', orderNumber: 'IUMM-PL-9', status: '진행', startedAt: new Date(Date.now() - 330e3).toISOString(), left: 3, result: Object.assign({}, r), progress: { calls: 1, maxCalls: 4, label: '다시 채점' } };
    _rvState = null; document.getElementById('gpt-result-wrap').style.display = 'none'; S.calls.length = 0; return 1; })()`);
  await click('#rv-order-btn');
  check(await until(`/다시 채점 진행 중/.test(document.getElementById('gpt-status-msg').textContent) && /5분/.test(document.getElementById('gpt-status-msg').textContent) && document.getElementById('gpt-submit-btn').disabled`), '다시 불러오면 진행 중 작업을 이어서 표시(5분 넘음 · 버튼 잠김)');
  check(await until(`_rvState && _rvState.id === window.__mock.rvJob.result.id && document.getElementById('gpt-result-wrap').style.display === 'block' && !document.getElementById('gpt-submit-btn').disabled`, 6000), '끝나면 지난 검수 목록을 다시 읽어 그 결과를 연다');
  // 서버가 다시 시작돼 작업을 잃음(404) → 지난 검수 목록을 다시 읽음
  await ev(`window.__mock.rvJob = null; 1`);
  // 승인 — 납품 전 점검 미리 보기 · 남으면 보류(저장 안 함)
  await ev(`window.__mock.approveHold = true; window.__mock.calls.length = 0; 1`);
  await click('#rv-approve-btn');
  check(await until(`/납품 전 점검: 보류 3건\\(② 보호 값, ⑥ 지정 용어\\)/.test(document.getElementById('rv-confirm').textContent) && /그래도 남으면 저장하지 않고 납품 보류/.test(document.getElementById('rv-confirm').textContent)`), '승인 확인창 — 납품 전 점검 미리 보기(보류 n건 · 항목명)');
  await click('#rv-approve-go');
  check(await until(`/납품 보류 — 승인하지 않았습니다/.test(document.getElementById('rv-confirm').textContent)`), '승인 → 409 보류 → 승인하지 않았다고 표시');
  check(await ev(`(() => { const t = document.getElementById('rv-confirm').textContent; return /②보호 값보류 1건문단 2 이메일 빠짐/.test(t.replace(/\\s+/g, '')) || /② ?보호 값 ?보류 1건 ?문단 2 이메일 빠짐/.test(t); })()`), '보류 항목별 — 문단 번호 · 종류(본문 없음)');
  check(await ev(`document.getElementById('rv-approved').style.display !== 'block' && document.getElementById('rv-approve-btn').style.display === ''`), '보류면 승인됨 표시 없음 · [승인] 그대로');
  await ev(`window.__mock.approveHold = false; window.__mock.rvAsync = false; document.getElementById('rv-confirm').style.display = 'none'; 1`);

  console.log('\n[6-2] 예산');
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
  await ev(`window.__mock.reviewMode = 'ok'; 1`);

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
    for (const [t, n] of [['#tab-tx', 'term_extract'], ['#tab-gpt', 'review'], ['#tab-credit', 'credit'], ['#tab-ls', 'lang_scores']]) {
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

  console.log('\n[10] 검수 탭 — 주문 목록을 부르지 않음 (2026-11-02)');
  await open(1440, 900, false, { token: 'TEST_TOKEN' });
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  const err0 = errors.length;
  await ev(`window.__mock.calls.length = 0, 1`);
  await ev(`setAdminMode('tx', true), switchTab('gpt_review'), 1`); await sleep(400);
  check(!(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/orders' && /gpt_review/.test(c.q))`)), '검수 탭: /api/admin/orders?tab=gpt_review 를 부르지 않음(예전 400)');
  check(await ev(`document.getElementById('gpt-review-wrap').style.display === 'block'`), '검수 화면은 그대로 보임');
  check(errors.length === err0, '검수 탭을 눌러도 콘솔 오류 0');

  console.log('\n[11-0] 주문 상세 납품 전 점검 · 목록 배지 · 저장(Ctrl+S) 점검 (2026-11-10)');
  await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  await click('#orders-tbody tr[data-id="rec1"]'); await sleep(200);
  check(await ev(`document.getElementById('predelivery-box').style.display === 'none'`), '점검 기록 없는 주문 = 상자 없음');
  await ev(`(pdShow({ aiQualityDetail: { preDelivery: window.__mock.PD_HOLD } }), 1)`);
  {
    const t = await ev(`document.getElementById('predelivery-box').textContent`);
    check(/납품 전 점검: 보류 3건\(② 보호 값, ⑥ 지정 용어\)/.test(t) && /검수 승인/.test(t) && /문단 3\/3/.test(t), `상세 상자 — '보류 3건(항목명)' · 누가 · 문단 수`);
    check(['① 문단 1:1', '⑧ 숫자'].every((x) => t.replace(/\s+/g, ' ').includes(x.split(' ')[0])) && /통과/.test(t) && /문단 2 지정 용어 없음 · 문단 3 지정 용어 없음/.test(t), '항목 8개마다 통과/보류 · 보류는 문단 번호 · 종류');
    check(await ev(`document.querySelector('#predelivery-box details').open`), '보류면 펼친 채');
    const col = await ev(`(() => { const out = []; document.querySelectorAll('#predelivery-box *').forEach(el => { const cs = getComputedStyle(el); [cs.color, cs.backgroundColor].forEach(c => { const m = c.match(/\\d+(\\.\\d+)?/g); if (!m) return; const [r, g, b, a] = m.map(Number); if (a === 0) return; if (r > g + 40 && r > b + 40) out.push(c); if (g > b + 40 && g > r + 20) out.push(c); }); }); return out; })()`);
    check(col.length === 0, '파란색 계열만(빨강·초록 없음)' + (col.length ? ' — ' + col.slice(0, 3).join(' | ') : ''));
  }
  await ev(`(pdShow({ aiQualityDetail: { preDelivery: window.__mock.PD_OK } }), 1)`);
  check(await ev(`/납품 전 점검: 통과/.test(document.getElementById('predelivery-box').textContent) && !document.querySelector('#predelivery-box details').open`), "통과 = '납품 전 점검: 통과'(접힌 채)");
  check(await ev(`/점검 보류 3/.test(pdBadgeHtml({ aiQualityDetail: { preDelivery: window.__mock.PD_HOLD } })) && /점검 통과/.test(pdBadgeHtml({ aiQualityDetail: { preDelivery: window.__mock.PD_OK } })) && pdBadgeHtml({}) === ''`), '목록 배지 — 점검 통과 / 점검 보류 n · 기록 없으면 없음');
  check(await ev(`/납품 전 점검/.test(holdInfo({ orderStatus: '확인필요', failReason: window.__mock.PD_HOLD.reason }).label)`), "확인필요 사유 이름 = '납품 전 점검'");
  // 저장(Ctrl+S) = 점검(코드 고침만) · 자동 저장은 점검 안 함
  await ev(`(window.__pdOrig = document.getElementById('panel-translation').value, window.__mock.saveFix = 'ok', window.__mock.calls.length = 0, 1)`);
  await ev(`(document.getElementById('panel-translation').value = window.__pdOrig + ' X', saveTranslationDraft(false), 1)`);
  check(await until(`/납품 전 점검 통과\\(코드 고침 1\\)/.test(document.getElementById('save-status').textContent)`), "저장 → '납품 전 점검 통과(코드 고침 1)'");
  check(await ev(`(() => { const c = window.__mock.calls.find(c => /save-translation$/.test(c.p)); return c && c.json.check === true; })()`), '저장(Ctrl+S) 요청에 check:true');
  check(await ev(`document.getElementById('panel-translation').value === window.__pdOrig + ' X [code-fixed]' && _lastSavedText === window.__pdOrig + ' X [code-fixed]'`), '코드가 고친 글로 번역 칸 바꿈(손대지 않았을 때)');
  await ev(`(window.__mock.saveFix = 'hold', window.__mock.calls.length = 0, saveTranslationDraft(false), 1)`);
  check(await until(`/납품 전 점검 보류 1건/.test(document.getElementById('save-status').textContent) && /보류 1건\\(⑥ 지정 용어\\)/.test(document.getElementById('predelivery-box').textContent)`), '저장 → 보류 n건 · 상세 상자 갱신');
  await ev(`(window.__mock.calls.length = 0, saveTranslationDraft(true), 1)`); await sleep(150);
  check(await ev(`(() => { const c = window.__mock.calls.find(c => /save-translation$/.test(c.p)); return c && c.json.check === false; })()`), '자동 저장 = 점검 안 함(check:false)');
  await ev(`(window.__mock.saveFix = null, document.getElementById('panel-translation').value = window.__pdOrig, _lastSavedText = window.__pdOrig, selectedOrder.aiQualityDetail = null, pdShow(selectedOrder), 1)`);

  console.log('\n[11] 주문 상세 [이 번역 용어 추출 → 용어집 업데이트] (2026-11-02)');
  await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
  await click('#orders-tbody tr[data-id="rec1"]');
  check(await until(`!!document.getElementById('otx-btn')`), '번역문 아래에 버튼 보임');
  check(await ev(`(() => { const b = document.getElementById('otx-box').getBoundingClientRect(), t = document.getElementById('panel-translation').getBoundingClientRect(); return b.top >= t.bottom - 1; })()`), '버튼 위치 — 번역문 아래');
  await ev(`document.getElementById('panel-translation').value = _lastSavedText + ' 수정', 1`);
  await click('#otx-btn'); await sleep(200);
  check(await ev(`/먼저 저장하세요/.test(document.getElementById('otx-msg').textContent)`), '저장 안 한 수정 → "먼저 저장하세요"로 멈춤');
  await ev(`document.getElementById('panel-translation').value = _lastSavedText, window.__mock.calls.length = 0, 1`);
  await click('#otx-btn');
  check(await until(`/예상 비용 \\$0\\.069/.test(document.getElementById('otx-msg').textContent)`), '누르면 예상 비용 먼저 표시');
  check(!(await ev(`window.__mock.calls.some(c => /term-extract$/.test(c.p) && c.m === 'POST')`)), '[확인] 전에는 실행하지 않음');
  await click('#otx-msg button');
  check(await until(`/처리 중/.test(document.getElementById('otx-msg').textContent)`), '[확인] → 처리 중 표시');
  check(await ev(`(() => { const c = window.__mock.calls.find(c => /term-extract$/.test(c.p) && c.m === 'POST'); return !!c && c.json.hash === 'h1' && c.json.rerun === false; })()`), '실행 요청에 화면이 본 번역본(hash)');
  check(await ev(`document.getElementById('otx-btn').disabled`), '처리 중엔 버튼 잠김');
  await ev(`otxShow(window._orders[0]), 1`);   // 새로고침 뒤 다시 연 것과 같음 — 서버가 기억한 상태
  check(await until(`/처리 중/.test(document.getElementById('otx-msg').textContent)`), '다시 열어도 처리 중 유지');
  await ev(`window.__mock.otx.job = { status: '완료', startedAt: '2026-11-02T01:00:00Z', finishedAt: '2026-11-02T01:06:00Z', result: { counts: { 새용어: 3, 승인: 1, 후보: 1, 충돌: 1, 건너뜀: 2 }, costUsd: 0.051 } }, otxShow(window._orders[0]), 1`);
  check(await until(`/새 용어 3개 \\(승인 1 \\/ 후보 1 \\/ 충돌 1\\) · 건너뜀 2개 · 사용 금액 \\$0\\.051/.test(document.getElementById('otx-msg').textContent)`), '끝나면 새 용어(승인/후보/충돌)·건너뜀·사용 금액');
  check(await ev(`!/거절/.test(document.getElementById('otx-msg').textContent) && !document.getElementById('otx-skipped')`), '예전 결과(거절·건너뛴 목록 없음)는 그대로 표시');
  // 보완판 결과 (2026-11-02): 새 용어 = 승인+후보+충돌 · 거절 따로 · 건너뛴 원어 펼쳐 보기
  await ev(`window.__mock.otx.job = { status: '완료', startedAt: '2026-11-02T01:00:00Z', finishedAt: '2026-11-02T01:06:00Z', result: { counts: { 새용어: 29, 승인: 25, 후보: 4, 충돌: 0, 거절: 2, 건너뜀: 5 }, skipped: ['피의자', '범죄사실', '수사기관', '<b>사이버수사대</b>', '공조요청'], costUsd: 0.088 } }, otxShow(window._orders[0]), 1`);
  check(await until(`/새 용어 29개 \\(승인 25 \\/ 후보 4 \\/ 충돌 0\\) · 거절 2개 · 건너뜀 5개 · 사용 금액 \\$0\\.088/.test(document.getElementById('otx-msg').textContent)`), "'새 용어 N(승인/후보/충돌)'과 '거절 N' 따로");
  check(await ev(`(() => { const d = document.getElementById('otx-skipped'); return !!d && !d.open && /건너뛴 용어 5개 보기/.test(d.querySelector('summary').textContent); })()`), '건너뛴 용어는 접힌 채로 개수 표시');
  await click('#otx-skipped summary'); await sleep(150);
  check(await ev(`(() => { const d = document.getElementById('otx-skipped'); return d.open && /피의자 · 범죄사실 · 수사기관/.test(d.textContent) && !d.querySelector('b') && d.textContent.includes('<b>사이버수사대</b>'); })()`), '누르면 건너뛴 원어 목록 펼침(글자 그대로 — HTML 로 안 읽음)');
  // 캡처는 깨끗한 가짜 데이터로 (실제 추출 실행 없음)
  await ev(`window.__mock.otx.job.result.skipped = ['피의자', '범죄사실', '수사기관', '사이버수사대', '공조요청'], otxShow(window._orders[0]), 1`);
  await until(`!!document.getElementById('otx-skipped')`); await click('#otx-skipped summary');
  await ev(`(document.getElementById('otx-box').scrollIntoView({ block: 'center' }), 1)`); await sleep(200);
  {
    const r = await ev(`(() => { const p = document.getElementById('otx-box').getBoundingClientRect(); return { x: Math.max(0, p.left - 8), y: Math.max(0, p.top - 8), width: p.width + 16, height: p.height + 16 }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'order_term_extract_done_v2.png'), Buffer.from(sh.result.data, 'base64'));
  }
  await ev(`window.__mock.calls.length = 0, 1`);
  await click('#otx-msg button');
  check(await until(`window.__mock.calls.some(c => c.p === '/api/admin/terms' && /order=IUMM-1001/.test(c.q)) && document.getElementById('terms-wrap').style.display === 'block'`), '[용어집에서 보기] → 용어집 탭을 그 주문번호로 걸러 열기');
  await ev(`window.__mock.otx = { already: '2026-11-02T03:00:00Z' }, setAdminMode('orders', true), switchTab('ai_premium'), 1`);
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`); await click('#orders-tbody tr[data-id="rec1"]');
  await until(`!!document.getElementById('otx-btn')`);
  check(await until(`/이미 반영됨/.test(document.getElementById('otx-msg').textContent)`), '같은 번역본으로 돌린 적 있음 → 이미 반영됨(날짜)');
  await click('#otx-btn');
  check(await until(`/다시 돌릴까요/.test(document.getElementById('otx-msg').textContent)`), '다시 돌릴지 확인');
  await click('#otx-msg button');
  check(await until(`window.__mock.calls.some(c => /term-extract$/.test(c.p) && c.m === 'POST' && c.json.rerun === true)`), '다시 돌리기 → rerun 으로 요청');
  await ev(`window.__mock.otx = { budgetOk: false }, otxShow(window._orders[0]), 1`); await sleep(200);
  await click('#otx-btn');
  check(await until(`/예산이 부족해 실행하지 않습니다/.test(document.getElementById('otx-msg').textContent) && !document.querySelector('#otx-msg button')`), '예산 부족 → 실행 버튼 없이 안내');
  check(!(await ev(`document.getElementById('otx-box').innerHTML.match(/claude|opus|gpt|모델/i)`)), '버튼 영역에 모델 이름 없음');

  console.log('\n[12] 기업 고객 탭 — 회사별 전용 용어 (2026-11-02)');
  await ev(`setAdminMode('orders', true), switchTab('corp'), 1`);
  check(await until(`/알파 주식회사/.test(document.getElementById('corp-list').textContent) && /220-81-62517/.test(document.getElementById('corp-list').textContent)`), '회사 목록에 회사명·사업자등록번호');
  check(await ev(`/2\\s*\\/\\s*1/.test(document.querySelector('#corp-list tbody tr').textContent)`), '회사별 전용 용어 수(승인/후보)');
  await click('#corp-list tbody tr');
  check(await until(`/전용 용어 2개/.test(document.getElementById('corp-detail').textContent) && /알파 엔진/.test(document.getElementById('corp-detail').textContent) && /Alpha Engine/.test(document.getElementById('corp-detail').textContent)`), '회사를 누르면 그 회사 전용 용어 목록');

  console.log('\n[13] 우회 주문 — 제출 국가 · 영어 표기 (2026-11-02)');
  await ev(`setAdminMode('orders', true), switchTab('bypass'), 1`); await sleep(200);
  const setDir = (d) => ev(`(() => { const s = document.getElementById('bp-direction'); s.value = ${JSON.stringify(d)}; s.dispatchEvent(new Event('change')); return 1; })()`);
  const setDest = (n, v) => ev(`(() => { document.getElementById('bp-dest-nation').value = ${JSON.stringify(n)}; document.getElementById('bp-dest-variant').value = ${JSON.stringify(v)}; bpDestRefresh(); return document.getElementById('bp-dest-judge').textContent; })()`);
  const destShown = () => ev(`getComputedStyle(document.getElementById('bp-dest-row')).display !== 'none'`);
  const variantShown = () => ev(`getComputedStyle(document.getElementById('bp-dest-variant-col')).display !== 'none'`);
  await setDir('포르투갈어 → 한국어');
  check((await destShown()) && !(await variantShown()), '도착어가 영어가 아니어도 제출 국가 칸은 보임 · 영어 표기 선택은 숨김(2026-11-02)');
  await setDir('한국어 → 영어');
  check((await destShown()) && (await variantShown()), '한국어 → 영어 고르면 영어 표기 선택도 보임');
  check(await ev(`(() => { const all = [...document.getElementById('bypass-wrap').querySelectorAll('*')]; return all.indexOf(document.getElementById('bp-dest-row')) > all.indexOf(document.getElementById('bp-direction')) && all.indexOf(document.getElementById('bp-dest-row')) < all.indexOf(document.getElementById('bp-text')); })()`), '위치: 번역 방향 바로 아래(원문 텍스트 위)');
  check((await setDest('', 'auto')) === '→ 미국식 (제출 국가 없음 — 기본값)', '비움 + 자동 → 미국식(기본값)');
  check((await setDest('캄보디아', 'auto')) === '→ 미국식', '캄보디아 + 자동 → 미국식');
  check((await setDest('호주', 'auto')) === '→ 영국식', '호주 + 자동 → 영국식');
  check((await setDest('인도네시아', 'auto')) === '→ 미국식', "'인도네시아'는 인도(영연방)로 보지 않음");
  await setDest('호주', 'US');
  check(await ev(`bpDestLine()`) === '제출 국가: 호주 · 영어 표기: 미국식', '직접 고르면 그 값 그대로(호주 + 미국식)');
  await setDest('', 'auto');
  check(await ev(`bpDestLine()`) === '', '비움 + 자동 → 줄 안 씀');
  // 새 주문: 지시사항 첫 줄로 · 예전 줄은 바꿔 씀(중복 없음)
  await setDest('캄보디아', 'auto');
  await ev(`document.getElementById('bp-text').value = '원문입니다', document.getElementById('bp-reference-notes').value = '제출 국가: 영국 · 영어 표기: 영국식\\n공증용 서류입니다', window.__mock.calls.length = 0, 1`);
  await ev(`submitBypassOrder()`);
  const bp2 = (await calls('^/api/admin/translate-bypass$'))[0];
  check(bp2 && bp2.json.referenceNotes === '제출 국가: 캄보디아 · 영어 표기: 자동(미국식)\n공증용 서류입니다', `새 주문 → 번역지시사항 첫 줄 "제출 국가: 캄보디아 · 영어 표기: 자동(미국식)" · 예전 줄 바꿔 씀 (${bp2 && JSON.stringify(bp2.json.referenceNotes)})`);
  check(bp2 && bp2.json.direction === '한국어 → 영어', '번역 방향 그대로');
  // 영어 밖 도착어: 스페인어 + 멕시코 → "제출 국가: 멕시코" 한 줄(영어 표기 없음)
  await setDir('한국어 → 스페인어');
  await setDest('멕시코', 'UK');
  check(await ev(`bpDestLine()`) === '제출 국가: 멕시코', '스페인어 + 멕시코 → "제출 국가: 멕시코"(영어 표기 안 붙음)');
  await ev(`document.getElementById('bp-text').value = '원문입니다', document.getElementById('bp-reference-notes').value = '존댓말로', window.__mock.calls.length = 0, 1`);
  await ev(`submitBypassOrder()`);
  const bp3 = (await calls('^/api/admin/translate-bypass$'))[0];
  check(bp3 && bp3.json.referenceNotes === '제출 국가: 멕시코\n존댓말로' && bp3.json.direction === '한국어 → 스페인어', `도착어 스페인어 → 지시사항 첫 줄 저장 (${bp3 && JSON.stringify(bp3.json.referenceNotes)})`);
  await setDir('한국어 → 영어');
  // [폼에 불러오기] → 칸에 다시 채우고 나머지만 지시사항에 · 다시 저장해도 한 줄
  await ev(`window._failedOrders = [{ orderId: 'recF1', orderNumber: 'ADMIN-TEST-1', originalText: '원문', direction: '한국어 → 영어', referenceNotes: '제출 국가: 캄보디아 · 영어 표기: 영국식\\n격식체로' }], loadFailedToBypassForm(0), 1`); await sleep(200);
  const ld = await ev(`({ n: document.getElementById('bp-dest-nation').value, v: document.getElementById('bp-dest-variant').value, notes: document.getElementById('bp-reference-notes').value, shown: getComputedStyle(document.getElementById('bp-dest-row')).display !== 'none' })`);
  check(ld.n === '캄보디아' && ld.v === 'UK' && ld.notes === '격식체로' && ld.shown, `불러오기: 제출 국가·영어 표기 칸 채움 · 지시사항엔 나머지만 (${JSON.stringify(ld)})`);
  const merged = await ev(`bpDestMerge(document.getElementById('bp-reference-notes').value)`);
  check(merged === '제출 국가: 캄보디아 · 영어 표기: 영국식\n격식체로' && merged.split('\n').filter((l) => /제출 국가|영어 표기/.test(l)).length === 1, '불러온 뒤 다시 저장 → 그 줄 1개(중복 없음)');
  check(await ev(`bpDestMerge('제출 국가: 캄보디아 · 영어 표기: 영국식\\n영어 표기: 미국식\\n격식체로')`) === '제출 국가: 캄보디아 · 영어 표기: 영국식\n격식체로', '예전 줄이 여러 개여도 하나로');
  {
    await setDest('캄보디아', 'auto');   // 캡처: 자동 + 판단 결과 보이게
    await ev(`(document.activeElement && document.activeElement.blur(), document.getElementById('toast').classList.remove('show'), 1)`);
    await ev(`(document.getElementById('bp-direction').scrollIntoView({ block: 'center' }), 1)`); await sleep(200);
    const r = await ev(`(() => { const a = document.getElementById('bp-direction').closest('.bp-row').getBoundingClientRect(), b = document.getElementById('bp-dest-row').getBoundingClientRect(); return { x: Math.max(0, a.left - 12), y: Math.max(0, a.top - 12), width: a.width + 24, height: b.bottom - a.top + 24 }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_destination_select.png'), Buffer.from(sh.result.data, 'base64'));
  }
  await ev(`exitReprocessMode(), 1`);
  check(await ev(`document.getElementById('bp-dest-nation').value === '' && document.getElementById('bp-dest-variant').value === 'auto'`), '재실행 모드 해제 → 칸 비움');
  await setDir('한국어 → 일본어');
  await setDest('호주', 'UK');
  check((await destShown()) && await ev(`bpDestLine()`) === '제출 국가: 호주' && await ev(`bpDestMerge('제출 국가: 미국 · 영어 표기: 영국식\\n메모')`) === '제출 국가: 호주\n메모', '도착어가 영어가 아니면 "제출 국가:"만(영어 표기 없음) · 예전 줄은 바꿔 씀');
  await setDest('', 'auto');
  check(await ev(`bpDestLine()`) === '' && await ev(`bpDestMerge('제출 국가: 호주\\n메모')`) === '메모', '영어 밖 · 제출 국가 비움 → 줄 안 씀(예전 줄은 뺌)');
  await setDir('포르투갈어 → 한국어'); await setDest('', 'auto');
  // 주문 상세: 번역문 위 한 줄 — 처리 기록 destination
  await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`); await click('#orders-tbody tr[data-id="rec1"]'); await sleep(200);
  check(await ev(`document.getElementById('dest-line').style.display === 'none'`), '처리 기록에 제출처 없으면 줄 안 보임');
  await ev(`destShowOrder({ aiQualityDetail: { v3: { destination: { country: 'US', label: '미국식', basis: '관리자 지정', nation: '캄보디아' }, variant: { fixed: 2, recordOnly: 1 } } } }), 1`);
  check(await ev(`document.getElementById('dest-line').textContent.trim()`) === '제출 국가: 캄보디아 · 영어 표기: 미국식 (근거: 관리자 지정)', '주문 상세: "제출 국가: 캄보디아 · 영어 표기: 미국식 (근거: 관리자 지정)"');
  check(await ev(`(() => { const d = document.getElementById('dest-line').getBoundingClientRect(), t = document.getElementById('panel-translation').getBoundingClientRect(); return d.bottom <= t.top + 1; })()`), '위치 — 번역문 위');
  await ev(`destShowOrder({ aiQualityDetail: { v2: { destination: { country: 'UK', basis: '문서 첫머리(영국 대사관)', nation: '' } } } }), 1`);
  check(await ev(`document.getElementById('dest-line').textContent.trim()`) === '제출 국가: 지정 없음 · 영어 표기: 영국식 (근거: 문서 첫머리)', 'V2 기록 · 문서 첫머리 근거');
  await ev(`destShowOrder({ aiQualityDetail: { v3: { destination: { country: 'US', basis: '기본값', nation: '' } } } }), 1`);
  check(/미국식 \(근거: 기본값\)/.test(await ev(`document.getElementById('dest-line').textContent`)), '기본값 근거');
  check(adminSrc.includes("row3('철자 관례', '자동 맞춤 '") && adminSrc.includes("'곳 · 기록만 '"), "V3 처리 기록에 '철자 관례 자동 맞춤 N곳 · 기록만 N곳'");

  console.log('\n[14] 주문 상세 검색 — 찾은 곳으로 이동 (2026-11-02)');
  await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
  await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`); await click('#orders-tbody tr[data-id="rec1"]'); await sleep(200);
  const HIT_TR = [5, 80, 150, 190], HIT_SRC = [10, 90, 160];
  await ev(`(() => {
    const tr = [], src = [];
    for (let i = 1; i <= 200; i++) {
      tr.push(${JSON.stringify(HIT_TR)}.includes(i) ? 'Line ' + i + ' the Counsel stated that the meeting was held.' : i === 30 ? 'A: Where were you that day?' : 'Line ' + i + ' ordinary statement text for the record.');
      src.push(${JSON.stringify(HIT_SRC)}.includes(i) ? i + '번째 줄 counsel 진술' : i + '번째 줄 진술 내용');
    }
    document.getElementById('panel-source').value = src.join('\\n');
    document.getElementById('panel-translation').value = tr.join('\\n');
    _lastSavedText = document.getElementById('panel-translation').value;
    document.getElementById('panel-translation').scrollTop = 0; document.getElementById('panel-source').scrollTop = 0;
    return 1; })()`);
  const typeQ = (q) => ev(`(() => { openAdminSearch(); const i = document.getElementById('panel-search-inp'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  const key = (opt) => ev(`(document.getElementById('panel-search-inp').dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: 'Enter', bubbles: true, cancelable: true }, ${JSON.stringify(opt || {})}))), 1)`);
  const where = () => ev(`(() => { const ta = document.getElementById('panel-translation'), mk = document.getElementById('ov-tr').querySelector('mark.search-cur');
    return { tr: document.getElementById('sc-tr').textContent, src: document.getElementById('sc-src').textContent, top: ta.scrollTop, h: ta.clientHeight,
      rel: mk ? mk.offsetTop - ta.scrollTop : null, sel: ta.value.slice(ta.selectionStart, ta.selectionEnd), line: mk ? ta.value.slice(0, ta.selectionStart).split('\\n').length : null,
      srcTop: document.getElementById('panel-source').scrollTop, marks: document.getElementById('ov-tr').querySelectorAll('mark.search-hit').length }; })()`);
  await typeQ('counsel');
  let w = await where();
  check(w.tr === '번역 1/4' && w.src === '원문 1/3' && w.sel === 'Counsel' && w.line === 5 && w.marks === 4, `입력하면 번역문 첫 결과로 · 몇 번째/전체 · 대소문자 무시 · 그 글자 선택 (${JSON.stringify(w)})`);
  await key();
  w = await where();
  check(w.tr === '번역 2/4' && w.line === 80 && w.top > 0 && Math.abs(w.rel - w.h / 3) < 40, `Enter = 다음 → 80번째 줄, 칸 위쪽 1/3 지점(${Math.round(w.rel)} / ${w.h})`);
  check(w.rel >= 0 && w.rel < w.h, '화면 밖에 있던 결과가 칸 안에 보임');
  await sleep(400);
  { const w2 = await where(); check(w2.srcTop > 0 && w2.top === w.top, `동기화 켜져 있으면 원문 칸도 따라 내려감 · 원문 스크롤이 번역 칸 위치를 되돌려 옮기지 않음(${w.top} → ${w2.top})`); }
  // 원문·번역 길이가 크게 다를 때(실제 주문처럼) — 동기화가 번역 칸을 다른 곳으로 끌고 가지 않음
  await ev(`(document.getElementById('panel-source').value = document.getElementById('panel-source').value.split('\\n').slice(0, 60).join('\\n'), 1)`);
  await typeQ('counsel'); await key(); await key();
  await sleep(400);
  w = await where();
  check(w.tr === '번역 3/4' && w.line === 150 && Math.abs(w.rel - w.h / 3) < 40, `원문이 짧아도(60줄 / 번역 200줄) 이동한 자리 그대로 (${Math.round(w.rel)} / ${w.h})`);
  await ev(`(() => { const s = []; for (let i = 1; i <= 200; i++) s.push(${JSON.stringify(HIT_SRC)}.includes(i) ? i + '번째 줄 counsel 진술' : i + '번째 줄 진술 내용'); document.getElementById('panel-source').value = s.join('\\n'); return 1; })()`);
  await typeQ('counsel'); await key();
  await key(); await key();
  w = await where();
  check(w.tr === '번역 4/4' && w.line === 190, 'Enter 두 번 더 → 4/4');
  await key();
  check((await where()).tr === '번역 1/4', '끝에서 다음 → 처음(1/4)');
  await key({ shiftKey: true });
  w = await where();
  check(w.tr === '번역 4/4' && w.line === 190, 'Shift+Enter = 이전 → 4/4');
  const colors = await ev(`(() => { const ms = [...document.getElementById('ov-tr').querySelectorAll('mark.search-hit')]; return { cur: getComputedStyle(ms.find(m => m.classList.contains('search-cur'))).backgroundColor, other: getComputedStyle(ms.find(m => !m.classList.contains('search-cur'))).backgroundColor }; })()`);
  check(colors.cur === 'rgba(31, 79, 209, 0.62)' && colors.other === 'rgba(120, 170, 255, 0.24)', `지금 결과 진한 파랑 · 나머지 옅은 파랑 (${colors.cur} / ${colors.other})`);
  await click('#srch-tr-prev');
  w = await where();
  check(w.tr === '번역 3/4' && w.line === 150 && await ev(`document.activeElement === document.getElementById('panel-translation')`), '[▲ 이전] → 3/4 · 번역문에 초점(선택한 글자 바로 고쳐 쓰기)');
  await click('#srch-src-next');
  check((await where()).src === '원문 2/3', '원문 [▼ 다음] → 원문 2/3');
  await ev(`document.getElementById('panel-search-inp').focus(), 1`);
  await key({ ctrlKey: true });
  check(await ev(`document.activeElement === document.getElementById('panel-translation') && document.getElementById('panel-translation').value.slice(document.getElementById('panel-translation').selectionStart, document.getElementById('panel-translation').selectionEnd) === 'Counsel'`), 'Ctrl+Enter → 번역문에서 그 글자 선택한 채 고치기');
  // 고쳐 쓰면 찾은 자리 다시 계산
  await ev(`(() => { const ta = document.getElementById('panel-translation'); ta.setRangeText('Lawyer'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  check((await where()).tr.endsWith('/3'), '고쳐 쓰면 찾은 수 다시 계산(4 → 3)');
  // 화면 캡처 — 검색 이동 · 몇 번째/전체
  {
    await ev(`(document.getElementById('panel-translation').value = document.getElementById('panel-translation').value.replace('Lawyer', 'Counsel'), _lastSavedText = document.getElementById('panel-translation').value, 1)`);
    await typeQ('counsel'); await key();
    await ev(`(document.getElementById('toast').classList.remove('show'), document.getElementById('confirm-panel').scrollIntoView({ block: 'start' }), 1)`); await sleep(250);
    await key({});
    await ev(`(document.getElementById('panel-search-inp').focus(), 1)`); await sleep(150);
    const r = await ev(`(() => { const a = document.getElementById('confirm-panel').getBoundingClientRect(); return { x: Math.max(0, a.left), y: Math.max(0, a.top), width: Math.min(a.width, 1440), height: Math.min(560, innerHeight - Math.max(0, a.top)) }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_search_jump.png'), Buffer.from(sh.result.data, 'base64'));
  }
  // 집중 모드에서도
  await ev(`toggleFocusMode(), 1`); await sleep(200);
  await typeQ('counsel'); await key(); await key();
  w = await where();
  check(await ev(`document.body.classList.contains('admin-focus')`) && w.tr === '번역 3/4' && w.line === 150 && w.rel >= 0 && w.rel < w.h, `집중 모드에서도 같은 이동 (${w.tr})`);
  await ev(`toggleFocusMode(), closeAdminSearch(), 1`);

  console.log('\n[15] 주문 상세 — 채점 근거 (2026-11-02)');
  const RICH = { v3: { score: { total: 88, first: 88, applied: 1, reworked: 0, scorer: 'claude',
    deductions: [{ 분류: '정확성', 점수: 5, 이유: '부정어 하나 빠짐' }, { 분류: '형식', 점수: 4, 이유: '문/답 표시' }, { 분류: '문체', 점수: 3, 이유: '직역투' }],
    changes: [
      { id: 'P0030', paragraph: 'P0030', reason: '질문인데 A 로 표시', before: 'A: Where were you that day?', after: 'Q: Where were you that day?', result: '반영', why: '문·답 표시 교정' },
      { id: 'P0150', paragraph: 'P0150', reason: '자연스럽게', before: 'the old wording', after: 'Line 150 the Counsel stated', result: '반영' },
      { id: 'P0077', paragraph: 'P0077', reason: '통화 단위', before: '5,000,000', after: 'KRW 5,000,000', result: '반영 안 함', why: '원칙 위반(통화 단위)' }] },
    trace: { v: 1, edits: [{ id: 'P0190', before: 'Line 190 the counsel said', after: 'Line 190 the Counsel stated that the meeting was held.' }], editRejected: [],
      review: [{ id: 'P0080', severity: '중대', type: '오역', quote: '변호인은', problem: '고소인 쪽 변호사', rebut: '수용', result: '반영', at: 'Line 80 the Counsel stated that the meeting was held.' }],
      back: [{ id: 'P0005', kind: '부정어', quote: '하지 아니하였다', problem: '부정 빠짐', at: 'Line 5 the Counsel stated that' }],
      qaFixes: [{ id: 'P0030', step: '⑨ 채점기 수정안', before: 'A: Where were you that day?', after: 'Q: Where were you that day?', at: 'A: Where were you that day?' }],
      retranslated: [], sentenceMismatch: [{ id: 'P0120', why: '문장 수 원문 1 → 번역 2(문장을 나누거나 합치지 말 것)', at: 'Line 120 ordinary statement text for the record.' }] } } };
  await ev(`(window.__srOrder = { orderId: 'rec1', aiQualityDetail: ${JSON.stringify(RICH)} }, populateAiScoreSection(window.__srOrder), 1)`);
  check(await ev(`!!document.getElementById('sr-details') && !document.getElementById('sr-details').open && /채점 근거 보기/.test(document.querySelector('#sr-details summary').textContent)`), '점수 아래 [채점 근거 보기] (접힌 채)');
  await click('#sr-details summary'); await sleep(150);
  const srText = await ev(`document.getElementById('score-reasons').textContent`);
  check(['① 감점 요약', '② 채점기 지적', '③ 고친 곳', '④ 교차 검수·역확인 지적', '⑤ 문장 수가 원문과 다른 문단', '⑥ 문·답 표시 교정'].every((x) => srText.includes(x)), '① 감점 요약 ② 채점기 지적 ③ 고친 곳 ④ 교차 검수·역확인 ⑤ 문장 수 ⑥ 문·답 표시 교정');
  check(/⑥ 문·답 표시 교정 \(1\) ?P0030 ⑨ 채점기 수정안 ?A: Where were you that day\? → Q: Where were you that day\?/.test(srText.replace(/\s+/g, ' ')), `⑥ 문·답 표시 교정: 문단 · 단계 · 수정 전 → 후 — ${(srText.replace(/\s+/g, ' ').match(/⑥.{0,120}/) || [''])[0]}`);
  check(/합계 −12 = 100 − 88/.test(srText) && /정확성−5부정어하나빠짐/.test(srText.replace(/\s+/g, '')), '감점 요약: 분류별 점수·이유 · 합계 = 100 − 점수');
  check(/P0030 질문인데 A 로 표시 반영 문·답 표시 교정/.test(srText.replace(/\s+/g, ' ')) && /P0077 통화 단위 반영 안 함 원칙 위반\(통화 단위\)/.test(srText.replace(/\s+/g, ' ')) && /P0150 자연스럽게 반영/.test(srText.replace(/\s+/g, ' ')), '채점기 지적: 문단 · 이유 · 결과(반영 / 반영 안 함 + 이유)');
  await ev(`(document.getElementById('panel-translation').scrollTop = 0, 1)`);
  await ev(`[...document.querySelectorAll('#score-reasons .sr-id')].find(b => b.textContent === 'P0150').click(), 1`); await sleep(150);
  w = await where();
  check(w.line === 150 && w.rel >= 0 && w.rel < w.h && /^Line 150 the Counsel stated/i.test(await ev(`document.getElementById('panel-search-inp').value`)), `문단 번호(P0150, 반영된 수정안) 누르면 번역문의 그 자리로 이동·파랑 강조 (줄 ${w.line})`);
  await ev(`[...document.querySelectorAll('#score-reasons .sr-before')].find(b => /^A: Where/.test(b.textContent)).click(), 1`); await sleep(150);
  w = await where();
  check(w.line === 30 && w.sel === 'A: Where were you that day?', "'수정 전' 글 누르면 그 자리 · 글자 선택");
  await ev(`(document.getElementById('panel-translation').scrollTop = 0, [...document.querySelectorAll('#score-reasons .sr-sec')].find(x => /⑥ 문·답/.test(x.textContent)).querySelector('.sr-id').click(), 1)`); await sleep(150);
  check((await where()).line === 30, '⑥ 문·답 표시 교정 문단 번호 누르면 그 자리로 이동');
  await ev(`[...document.querySelectorAll('#score-reasons .sr-id')].find(b => b.textContent === 'P0120').click(), 1`); await sleep(150);
  check((await where()).line === 120, '⑤ 문장 수 다른 문단도 눌러서 이동');
  await ev(`[...document.querySelectorAll('#score-reasons .sr-id')].find(b => b.textContent === 'P0077').click(), 1`); await sleep(150);
  check(/찾지 못했습니다/.test(await ev(`document.getElementById('sr-msg').textContent`)), '번역문에 없는 글 → "찾지 못했습니다" 안내');
  {
    // 캡처: 화면을 길게 늘려 채점 근거 전체가 한 화면에 들어오게(알림·위쪽 고정 막대에 가리지 않게)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });
    await ev(`(closeAdminSearch(), document.getElementById('toast').classList.remove('show'), document.getElementById('sr-msg').textContent = '', document.getElementById('score-reasons').scrollIntoView({ block: 'start' }), window.scrollBy(0, -120), 1)`); await sleep(300);
    const r = await ev(`(() => { const a = document.getElementById('score-reasons').getBoundingClientRect(); return { x: Math.max(0, a.left - 8), y: Math.max(0, a.top - 8), width: a.width + 16, height: Math.min(a.height + 16, 2300) }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_score_reasons.png'), Buffer.from(sh.result.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  // 예전 주문 — 저장된 이유 목록만 + "자세한 기록 없음" + 검색어 입력칸
  await ev(`(populateAiScoreSection({ orderId: 'rec1', aiQualityDetail: { v3: { score: { total: 88, changes: [{ paragraph: 3, reason: '변호인 용어가 고소인 쪽 변호사에 맞지 않음' }, { paragraph: 9, reason: '직역투' }] } } } }), 1)`);
  await click('#sr-details summary'); await sleep(100);
  const old = await ev(`document.getElementById('score-reasons').textContent`);
  check(/자세한 기록 없음/.test(old) && /변호인 용어가 고소인 쪽 변호사에 맞지 않음/.test(old) && /감점 요약 없음\(예전 주문\)/.test(old) && await ev(`document.querySelectorAll('#score-reasons .sr-q').length === 2 && !document.querySelector('#score-reasons .sr-id')`),
    '예전 주문: 이유 목록만 · "자세한 기록 없음" · 문단 번호 버튼 대신 검색어 입력칸');
  await ev(`(document.getElementById('sr-q-0').value = 'COUNSEL', document.querySelector('#score-reasons .sr-go').click(), 1)`); await sleep(150);
  check((await where()).tr === '번역 1/4', '검색어 입력 → [찾기] → 번역문 첫 결과로 이동');
  // 관리자 '검수' 탭 [승인] 반영(2026-11-09 2차) — 최신(검수 반영) 근거 먼저, 엔진 점수는 아래
  const AR = Object.assign({}, RICH, { adminReviews: [{ label: '관리자 검수 반영(2026-11-09 15:00)', at: '2026-11-09T06:00:00Z', score: 96, scoreBefore: 70, prevAiScore: 88,
    deductions: [{ 분류: '문체', 점수: 4, 이유: '어색함' }], changes: [{ paragraph: 1, before: 'a respecté', after: 'a violé', reason: '오역(위반)' }] }] });
  await ev(`(closeAdminSearch(), populateAiScoreSection({ orderId: 'rec1', aiQualityDetail: ${JSON.stringify(AR)} }), 1)`);
  await click('#sr-details summary'); await sleep(100);
  const arText = (await ev(`document.getElementById('score-reasons').textContent`)).replace(/\s+/g, ' ');
  check(arText.indexOf('관리자 검수 반영(2026-11-09 15:00)') >= 0 && arText.indexOf('관리자 검수 반영') < arText.indexOf('엔진 점수(⑨ 채점) 88점') && arText.indexOf('엔진 점수') < arText.indexOf('① 감점 요약')
    && /점수 70 → 96 \(AI종합점수 88 → 96\)/.test(arText) && /a respecté → a violé/.test(arText), `[채점 근거 보기] — 관리자 검수 반영 먼저 · 엔진 점수 아래`);
  await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 96, aiQualityDetail: { adminReviews: ${JSON.stringify(AR.adminReviews)} } }), 1)`);
  check(await ev(`document.getElementById('score-reasons').style.display === '' && /엔진\\(⑨\\) 채점 기록 없음/.test(document.getElementById('score-reasons').textContent)`), 'V3 기록 없는 주문도 검수 반영 근거는 보임');
  await ev(`closeAdminSearch(), populateAiScoreSection({ orderId: 'rec1', aiScore: 90 }), 1`);
  check(await ev(`document.getElementById('score-reasons').style.display === 'none'`), 'V3 기록 없는 주문(V1·V2)은 채점 근거 없음');
  check(!(await ev(`/claude|opus|gpt|모델/i.test(document.getElementById('score-reasons').innerHTML)`)), '채점 근거 영역에 모델 이름 없음');
  // 2026-11-10 — 'AI 종합점수' 칸: 검수 승인 기록이 있으면 AI종합점수(최신 승인) + 바뀐 과정, 없으면 V3 번역 채점 / V1·V2 AI종합점수
  {
    const badge = `({ n: document.getElementById('ai-score-total').textContent, label: document.getElementById('ai-score-total-label').textContent, color: document.getElementById('ai-score-total').style.color,
      hist: document.getElementById('ai-score-history').style.display === 'none' ? '' : document.getElementById('ai-score-history').textContent })`;
    const twoRv = [{ label: '관리자 검수 반영(2026-11-10 13:00)', score: 100, prevAiScore: 94 }, { label: '관리자 검수 반영(2026-11-10 09:00)', score: 94, prevAiScore: 89 }];
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 100, aiQualityDetail: { v3: { score: { total: 89 } }, adminReviews: ${JSON.stringify(twoRv)} } }), 1)`);
    let b = await ev(badge);
    check(b.n === '100' && b.label === 'AI 종합점수' && b.hist === '번역 채점 89 → 검수 94 → 검수 100' && b.color === 'var(--green)', `승인 기록 있는 V3 — AI종합점수 100 · '번역 채점 89 → 검수 94 → 검수 100' · 색은 이 점수 기준 (${JSON.stringify(b)})`);
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 100, gptFinalScore: 95, aiQualityDetail: { v3: { score: { total: 89 } }, adminReviews: ${JSON.stringify(twoRv)} } }), 1)`);
    b = await ev(badge);
    check(b.n === '100' && b.label === 'AI 종합점수', 'GPT 최종 검수 점수가 있어도 같은 기준(이름 AI 종합점수)');
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 70, aiQualityDetail: { v3: { score: { total: 72 } } } }), 1)`);
    b = await ev(badge);
    check(b.n === '72' && b.label === 'Claude 채점' && !b.hist && b.color === 'var(--red)', `승인 기록 없는 V3 — 지금처럼 번역 채점 72 · 과정 줄 없음 (${JSON.stringify(b)})`);
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 85, aiQualityDetail: { v2: { score: { total: 85 } } } }), 1)`);
    b = await ev(badge);
    check(b.n === '85' && b.label === 'AI 종합점수' && !b.hist && b.color === 'var(--gold)', `V2 — AI종합점수 85 그대로 (${JSON.stringify(b)})`);
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 91 }), 1)`);
    b = await ev(badge);
    check(b.n === '91' && b.label === 'AI 종합점수' && !b.hist, 'V1 — AI종합점수 그대로');
    await ev(`(populateAiScoreSection({ orderId: 'rec1', aiScore: 96, aiQualityDetail: { adminReviews: [{ score: 96, prevAiScore: 88 }] } }), 1)`);
    b = await ev(badge);
    check(b.n === '96' && b.hist === '번역 채점 88 → 검수 96', 'V1·V2 에 승인 기록 → 번역 채점은 승인 전 AI종합점수');
  }

  console.log('\n[16] 우회 주문 — 전문 분야 목록 · 내부전용 기본 분야 (2026-11-02)');
  {
    const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'iumm-pipeline', 'server.js');
    const vals = await ev(`[...document.querySelectorAll('#bp-field option')].map(o => o.value)`);
    if (fs.existsSync(SERVER)) {
      const keys = Object.keys(Function(`return (${fs.readFileSync(SERVER, 'utf8').match(/const FIELD_TO_FOLDER = (\{[\s\S]*?\});/)[1]})`)());
      check(vals.every((v) => keys.includes(v)) && keys.every((k) => vals.includes(k)), `#bp-field 값 ${vals.length}개 = 서버 FIELD_TO_FOLDER 키 ${keys.length}개 (빠진 것·남는 것 없음)`);
    } else ok('(파이프라인 저장소 없음 — 서버 키 대조 건너뜀)');
    check(vals.slice(0, 3).join() === 'general,criminal,legal' && vals.includes('gaming') && !vals.includes('game'), "순서: 일반 · 범죄수사·공문 · 법률·계약 · 게임 값 'gaming'");
    check(/수사 서류는 범죄수사·공문 지침으로 번역합니다/.test(await ev(`document.getElementById('bp-field-hint').textContent`)), '분야 옆 안내');
    const fieldAfterToggle = async (start) => ev(`(() => { const f = document.getElementById('bp-field'), c = document.getElementById('bp-internal'); c.checked = false; bpScopeChanged(); f.value = ${JSON.stringify(start)}; c.checked = true; c.dispatchEvent(new Event('change')); const v = f.value; c.checked = false; bpScopeChanged(); return v; })()`);
    check((await fieldAfterToggle('general')) === 'criminal', '내부전용 켜면 일반 → 범죄수사·공문');
    check((await fieldAfterToggle('legal')) === 'legal', '다른 분야를 골랐으면 그대로(법률·계약)');
    // 예전 'game' 주문 [폼에 불러오기] → gaming 으로 채우고 재실행도 gaming
    await ev(`window._failedOrders = [{ orderId: 'recG1', orderNumber: 'ADMIN-TEST-G', originalText: '원문', direction: '한국어 → 영어', fieldCode: 'game', referenceNotes: '' }], loadFailedToBypassForm(0), 1`); await sleep(200);
    check(await ev(`document.getElementById('bp-field').value`) === 'gaming', "예전 'game' 값 불러오기 → gaming");
    await ev(`window.__mock.calls.length = 0, submitBypassOrder(), 1`); await sleep(300);
    const rp = (await ev(`window.__mock.calls.filter(c => c.m !== 'GET').map(c => c.json || {})`)).find((j) => j.fieldCode);
    check(rp && rp.fieldCode === 'gaming', `재실행 → 분야 gaming 으로 보냄 (${rp && rp.fieldCode})`);
    await ev(`window._failedOrders = [{ orderId: 'recG2', orderNumber: 'ADMIN-TEST-H', originalText: '원문', direction: '한국어 → 영어', fieldCode: 'unknown_x', referenceNotes: '' }], loadFailedToBypassForm(0), 1`); await sleep(200);
    check(await ev(`document.getElementById('bp-field').value`) === 'general', '목록에 없는 값 → 일반');
    await ev(`exitReprocessMode(), 1`);
    // 캡처: 목록 전체를 펼친 모양(크기만 잠깐 늘림)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
    await ev(`(() => { const f = document.getElementById('bp-field'); f.value = 'criminal'; f.size = f.options.length; f.style.height = 'auto'; document.getElementById('toast').classList.remove('show'); f.scrollIntoView({ block: 'center' }); return 1; })()`); await sleep(250);
    const r = await ev(`(() => { const a = document.getElementById('bp-field').closest('.bp-col').getBoundingClientRect(); return { x: Math.max(0, a.left - 10), y: Math.max(0, a.top - 10), width: a.width + 20, height: a.height + 20 }; })()`);
    const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
    fs.writeFileSync(path.join(SHOT_DIR, 'admin_field_list.png'), Buffer.from(sh.result.data, 'base64'));
    await ev(`(() => { const f = document.getElementById('bp-field'); f.size = 0; f.style.height = ''; f.value = 'general'; return 1; })()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  }

  console.log('\n[17] 번역 중 표시 · 로그인 만료 · 재실행 중복 방지 · 폼 임시 저장 (2026-11-02)');
  {
    // ── 주문 목록·상세: 번역 중 배지 · 잠금 · 자동 삭제 예정일 ──
    await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
    await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
    await ev(`(window.__mock.running.recRUN = 'V3:⑧-2 최종 편집', window.__mock.runNum = { recRUN: 'ADMIN-RUN-1' },
      window._orders.unshift({ orderId: 'recRUN', orderNumber: 'ADMIN-RUN-1', running: true, pipelineStage: 'V3:⑧-2 최종 편집', autoDeleteAt: '2026-11-23T19:00:00.000Z', plan: 'AI 프리미엄', charCount: 7397, receivedAt: '2026-11-02T03:00:00Z', originalText: '원문', aiTranslation: '번역' }), renderOrderTable(), 1)`);
    const badge = await ev(`(document.querySelector('#orders-tbody tr[data-id="recRUN"] .st-run') || {}).textContent || ''`);
    check(badge === '번역 중 · ⑧-2 최종 편집', `주문 목록 '번역 중 · 단계' 배지 (${badge})`);
    await click('#orders-tbody tr[data-id="recRUN"]'); await sleep(200);
    const det = await ev(`({ line: document.getElementById('run-line').style.display !== 'none' && /번역 중입니다 — 끝나면 자동으로 새로 고칩니다/.test(document.getElementById('run-line').textContent),
      del: document.getElementById('autodel-line').textContent, save: document.getElementById('btn-save-draft').disabled, deliver: document.getElementById('btn-deliver').disabled, ro: document.getElementById('panel-translation').readOnly,
      color: getComputedStyle(document.querySelector('#run-line .st-run')).color })`);
    check(det.line, "주문 상세 위 '번역 중입니다 — 끝나면 자동으로 새로 고칩니다'");
    check(det.save && det.deliver && det.ro, '번역 중에는 번역 칸·저장·납품 잠금');
    check(det.del === '본문 자동 삭제 예정: 11월 24일', `관리자 주문 '${det.del}'`);
    const rgb = (det.color.match(/\d+/g) || []).map(Number);
    check(rgb.length >= 3 && rgb[2] > rgb[0] && rgb[2] > rgb[1], `배지 색 파랑 계열 (${det.color})`);
    {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
      await ev(`(document.getElementById('toast').classList.remove('show'), document.getElementById('orders-wrap').scrollIntoView({ block: 'start' }), window.scrollBy(0, -60), 1)`); await sleep(250);
      const r = await ev(`(() => { const a = document.getElementById('orders-wrap').getBoundingClientRect(), b = document.getElementById('autodel-line').getBoundingClientRect(); const y = Math.max(0, a.top - 10); return { x: 0, y, width: 1440, height: Math.min(1500, Math.max(a.bottom, b.bottom) - y + 20) }; })()`);
      const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
      fs.writeFileSync(path.join(SHOT_DIR, 'admin_running_badge.png'), Buffer.from(sh.result.data, 'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    }
    // 30초 상태 확인 — 끝나면 목록 새로 고침 + '번역 끝' 알림
    await ev(`(window.__mock.running.recRUN = 'V3:⑨ 채점', window.__mock.calls.length = 0, 1)`);
    await ev(`window.runPollNow().then(() => 1)`); await sleep(100);
    check(await ev(`(document.querySelector('[data-run="recRUN"]') || {}).textContent`) === '번역 중 · ⑨ 채점', '상태만 다시 읽어 단계 갱신');
    const rs = await ev(`window.__mock.calls.filter(c => c.p === '/api/admin/orders/run-state').map(c => ({ m: c.m, q: decodeURIComponent(c.q), body: !!(c.json || c.raw) }))`);
    check(rs.length === 1 && rs[0].m === 'GET' && !rs[0].body && /ids=.*recRUN/.test(rs[0].q), `상태 확인은 run-state 한 번(GET · 주문 ID만 · 본문 없음) ${JSON.stringify(rs)}`);
    await ev(`(delete window.__mock.running.recRUN, window.__mock.calls.length = 0, 1)`);
    await ev(`window.runPollNow().then(() => 1)`); await sleep(400);
    check(/번역 끝: ADMIN-RUN-1 \(91점\)/.test(await ev(`document.getElementById('toast').textContent`)), "끝나면 '번역 끝: 주문번호 (점수)' 알림");
    check(await ev(`window.__mock.calls.some(c => c.p === '/api/admin/orders' && /tab=ai_premium/.test(c.q))`), '끝나면 목록 새로 고침');

    // ── 번역실패 탭: 번역 중 카드 — 불러오기·재실행 잠금 ──
    await ev(`(window.__mock.failedExtra = [{ orderId: 'recRUN2', orderNumber: 'ADMIN-RUN-2', running: true, pipelineStage: 'V3:③ 번역', charCount: 100, direction: '한국어 → 스페인어' }], window.__mock.running.recRUN2 = 'V3:③ 번역', setAdminMode('orders', true), switchTab('failed'), 1)`);
    await until(`!!document.querySelector('#failed-list [data-run="recRUN2"]')`);
    const card = await ev(`(() => { const b = document.querySelector('#failed-list [data-run="recRUN2"]'); const c = b.closest('div[style*="padding:16px"]'); return { t: b.textContent, load: !!c.querySelector('button'), msg: /번역 중입니다/.test(c.textContent) }; })()`);
    check(card.t === '번역 중 · ③ 번역' && !card.load && card.msg, `번역실패 탭 번역 중 카드 — 배지 · 버튼 없음 (${card.t})`);
    await ev(`(window.__mock.failedExtra = [], delete window.__mock.running.recRUN2, 1)`);

    // ── 본문 자동 삭제 뒤 빈 코멘트·빈 수정요청내역·빈 실패사유 (2026-11-02 코멘트 4칸도 함께 비움) ──
    {
      const e0 = errors.length;
      await ev(`(window.__mock.failedExtra = [{ orderId: 'recEMP1', orderNumber: 'IUM-EMPTY-1', orderStatus: '번역실패', status: '번역실패', failReason: '', charCount: 0, direction: '한국어 → 영어' }], switchTab('failed'), 1)`);
      await until(`/IUM-EMPTY-1/.test(document.getElementById('failed-list').textContent)`);
      const fc = await ev(`(() => { const t = document.getElementById('failed-list').textContent; return { ok: /IUM-EMPTY-1/.test(t), undef: /undefined|null/.test(t) }; })()`);
      check(fc.ok && !fc.undef, '빈 실패사유 — 번역실패 탭 카드가 오류·undefined 없이 보임');
      await ev(`(window.__mock.failedExtra = [], 1)`);
      await ev(`(switchTab('revisions'), 1)`); await sleep(300);
      await ev(`(window._orders.unshift(
        { orderId: 'recEMP2', orderNumber: 'IUM-EMPTY-2', plan: 'AI 프리미엄', charCount: 0, receivedAt: '2026-10-01T00:00:00Z', reviewerComment: '', failReason: '', revisionLog: [], revisionState: '재납품완료', revisionCount: 1, originalText: '', aiTranslation: '', gptFinalReview: '', reviewerTranslation: '' },
        { orderId: 'recEMP3', orderNumber: 'IUM-EMPTY-3', plan: 'AI 프리미엄', charCount: 0, receivedAt: '2026-10-01T00:00:00Z', reviewerComment: '', failReason: '', revisionLog: '', revisionState: '요청됨', revisionCount: 1, originalText: '', aiTranslation: '' }), renderOrderTable(), 1)`);
      const rows = await ev(`['recEMP2','recEMP3'].map(id => { const r = document.querySelector('#orders-tbody tr[data-id="' + id + '"]'); return r ? !/undefined|null/.test(r.textContent) : false; })`);
      check(rows.every(Boolean), '빈 수정요청내역(배열·빈 글) — 수정 요청 탭 목록이 오류·undefined 없이 보임');
      await click('#orders-tbody tr[data-id="recEMP2"]'); await sleep(250);
      check(await ev(`document.getElementById('panel-ordnum').textContent === 'IUM-EMPTY-2' && !/undefined|null/.test(document.getElementById('panel-meta').textContent + document.getElementById('panel-translation').value)`), '빈 검수자코멘트·빈 본문 주문 상세가 undefined 없이 열림');
      check(errors.length === e0, '빈 코멘트·수정요청내역·실패사유로 콘솔 오류 0' + (errors.length > e0 ? ' — ' + errors.slice(e0, e0 + 2).join(' | ') : ''));
      await ev(`(window._orders = window._orders.filter(o => !/^recEMP/.test(o.orderId)), switchTab('ai_premium'), 1)`); await sleep(200);
    }

    // ── 재실행 중복 방지: 같은 주문 두 번 연속 → 응답 전 두 번째는 안 보냄, 번역 중이면 서버 409 ──
    await ev(`(window.__mock.calls.length = 0, window.__r1 = _doReprocess('recDUP', { text: 'x', direction: '한국어 → 영어' }, 'ADMIN-DUP'), window.__r2 = _doReprocess('recDUP', { text: 'x', direction: '한국어 → 영어' }, 'ADMIN-DUP'), 1)`);
    const dup = await ev(`Promise.all([window.__r1, window.__r2]).then(r => ({ r, n: window.__mock.calls.filter(c => c.p === '/api/admin/reprocess/recDUP').length }))`);
    check(dup.r[0] === true && dup.r[1] === false && dup.n === 1, `두 번 연속 → 응답 오기 전 두 번째는 보내지 않음 (보낸 수 ${dup.n})`);
    const third = await ev(`_doReprocess('recDUP', { text: 'x', direction: '한국어 → 영어' }, 'ADMIN-DUP').then(ok => ({ ok, toast: document.getElementById('toast').textContent }))`);
    check(third.ok === false && /이미 번역 중입니다/.test(third.toast), `번역 중인 주문 다시 재실행 → 409 '이미 번역 중입니다'`);

    // ── 우회 접수 직후 그 자리에서 '번역 중' ──
    await ev(`(setAdminMode('orders', true), switchTab('bypass'), exitReprocessMode(), document.getElementById('bp-text').value = '원문 시험', document.getElementById('bp-direction').selectedIndex = 1, 1)`);
    await ev(`submitBypassOrder().then(() => 1)`); await sleep(200);
    check(/번역 중 · 시작/.test(await ev(`document.getElementById('bp-result-run').textContent`)), "우회 [번역 시작] 직후 '번역 중' 배지");

    // ── 로그인 만료: 저장·재실행·우회 접수 → 그 자리 비밀번호 칸 → 로그인 뒤 같은 요청 자동 재시도 · 폼 내용 유지 ──
    await ev(`(window.__mock.expiredToken = 'OLD_TOKEN', window.__mock.loginToken = 'NEW_TOKEN', 1)`);
    const relogin = async (label, start, pathRe, keepExpr, expect, shotName) => {
      await ev(`(window.__mock.calls.length = 0, localStorage.setItem('adminToken', 'OLD_TOKEN'), window.__p = (${start}), 1)`);
      const shown = await until(`!!document.getElementById('relogin-box')`);
      const keep1 = await ev(keepExpr);
      if (shotName) {
        const r = await ev(`(() => { const a = document.querySelector('#relogin-box .rl').getBoundingClientRect(); return { x: Math.max(0, a.left - 30), y: Math.max(0, a.top - 30), width: a.width + 60, height: a.height + 60 }; })()`);
        const sh = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
        fs.writeFileSync(path.join(SHOT_DIR, shotName), Buffer.from(sh.result.data, 'base64'));
      }
      await ev(`(document.getElementById('relogin-pw').value = 'pw', document.getElementById('relogin-go').click(), 1)`);
      await until(`!document.getElementById('relogin-box')`);
      await ev(`Promise.resolve(window.__p).then(() => 1)`); await sleep(250);
      const calls = await ev(`window.__mock.calls.filter(c => ${pathRe}.test(c.p)).map(c => c.auth)`);
      check(shown && calls.length === 2 && calls[0] === 'Bearer OLD_TOKEN' && calls[1] === 'Bearer NEW_TOKEN' && keep1 === expect,
        `만료된 토큰으로 ${label} → 그 자리 로그인 칸 → 로그인 뒤 같은 요청 자동 재시도(${calls.length}회) · 입력 내용 그대로`);
      check(await ev(`document.getElementById('admin-view').style.display !== 'none' && localStorage.getItem('adminToken') === 'NEW_TOKEN'`), `${label}: 화면을 새로 고치지 않음 · 새 토큰 저장`);
    };
    await ev(`(setAdminMode('orders', true), switchTab('ai_premium'), 1)`);
    await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
    await click('#orders-tbody tr[data-id="rec1"]'); await sleep(200);
    await ev(`(document.getElementById('panel-translation').value = 'EDITED-TRANSLATION-1', 1)`);
    await relogin('번역 칸 저장', `saveTranslationDraft()`, '/save-translation$/', `document.getElementById('panel-translation').value`, 'EDITED-TRANSLATION-1', 'admin_relogin.png');
    check(await ev(`document.getElementById('panel-translation').value`) === 'EDITED-TRANSLATION-1', '로그인 뒤에도 번역 칸 내용 그대로');
    await ev(`(window._failedOrders = [{ orderId: 'recEXP', orderNumber: 'ADMIN-EXP-1', originalText: '불러온 원문', direction: '한국어 → 영어', fieldCode: 'legal', referenceNotes: '메모' }], loadFailedToBypassForm(0), 1)`); await sleep(200);
    await relogin('재실행', `submitBypassOrder()`, '/reprocess\\/recEXP$/', `document.getElementById('bp-text').value`, '불러온 원문');
    await ev(`(exitReprocessMode(), document.getElementById('bp-text').value = '우회 원문 EXP', document.getElementById('bp-direction').selectedIndex = 1, 1)`);
    await relogin('우회 접수', `submitBypassOrder()`, '/translate-bypass$/', `document.getElementById('bp-text').value`, '우회 원문 EXP');
    check(await ev(`document.getElementById('bp-text').value`) === '우회 원문 EXP', '우회 접수 뒤 원문 칸 그대로');
    await ev(`(window.__mock.expiredToken = null, localStorage.setItem('adminToken', 'TEST_TOKEN'), 1)`);

    // ── 우회 폼 임시 저장: sessionStorage 에만 · 새로고침해도 남음 · 접수 성공하면 지움 ──
    await ev(`(window._failedOrders = [{ orderId: 'recSS', orderNumber: 'ADMIN-SS-1', originalText: '임시 저장 원문', direction: '한국어 → 영어', fieldCode: 'legal', referenceNotes: '' }], loadFailedToBypassForm(0), 1)`); await sleep(200);
    await ev(`(document.getElementById('bp-notes').value = '메모 SS', document.getElementById('bp-notes').dispatchEvent(new Event('input', { bubbles: true })), 1)`); await sleep(700);
    const ss = await ev(`({ s: sessionStorage.getItem('iumm.bpDraft') || '', l: Object.keys(localStorage).map(k => localStorage.getItem(k)).join('|') })`);
    check(/임시 저장 원문/.test(ss.s) && /recSS/.test(ss.s) && !/임시 저장 원문/.test(ss.l), '폼 내용은 sessionStorage 에만(localStorage 에 본문 없음)');
    events.length = 0; await send('Page.reload', {}); for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100); await sleep(500);
    const back = await ev(`({ t: document.getElementById('bp-text').value, n: document.getElementById('bp-notes').value, rp: window._bpReprocessOrderId })`);
    check(back.t === '임시 저장 원문' && back.n === '메모 SS' && back.rp === 'recSS', '새로고침해도 폼·재실행 주문 그대로');
    await ev(`(setAdminMode('orders', true), switchTab('bypass'), submitBypassOrder().then(() => 1))`); await sleep(400);
    check(await ev(`sessionStorage.getItem('iumm.bpDraft') === null`), '접수(재실행) 성공하면 임시 저장 지움');
  }

  // 실제 주문 화면 확인(선택) — REAL_ORDER_JSON=<저장소 밖 파일>. 가짜 fetch 그대로라 서버에 아무것도 보내지 않고, 번역문을 고치지 않는다. 내용은 출력하지 않음(건수만)
  if (process.env.REAL_ORDER_JSON) {
    console.log('\n[실제 주문 — 읽기 전용 화면 확인]');
    const o = JSON.parse(fs.readFileSync(process.env.REAL_ORDER_JSON, 'utf8'));
    await ev(`setAdminMode('orders', true), switchTab('ai_premium'), 1`);
    await until(`!!document.querySelector('#orders-tbody tr[data-id="rec1"]')`);
    await ev(`(Object.assign(window._orders.find(x => x.orderId === 'rec1'), ${JSON.stringify(o)}, { orderId: 'rec1' }), 1)`);
    await click('#orders-tbody tr[data-id="rec1"]'); await sleep(300);
    const before = await ev(`document.getElementById('panel-translation').value`);
    const q = await ev(`(() => { const t = document.getElementById('panel-translation').value; const words = (t.match(/[A-Za-z]{6,}/g) || []); const c = {}; words.forEach(w => { w = w.toLowerCase(); c[w] = (c[w] || 0) + 1; }); return Object.keys(c).filter(w => c[w] >= 3 && c[w] <= 12).sort((a, b) => t.toLowerCase().lastIndexOf(b) - t.toLowerCase().lastIndexOf(a))[0] || 'the'; })()`);
    await ev(`(() => { openAdminSearch(); const i = document.getElementById('panel-search-inp'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
    for (let k = 0; k < 20; k++) await ev(`(document.getElementById('panel-search-inp').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, shiftKey: true })), 1)`);
    const r = await ev(`(() => { const ta = document.getElementById('panel-translation'), mk = document.getElementById('ov-tr').querySelector('mark.search-cur'); const ov = document.getElementById('ov-tr');
      return { sc: document.getElementById('sc-tr').textContent, rel: mk ? mk.offsetTop - ta.scrollTop : null, h: ta.clientHeight, top: ta.scrollTop, sh: ta.scrollHeight, osh: ov.scrollHeight, ow: ov.clientWidth, tw: ta.clientWidth, mt: mk ? mk.offsetTop : null }; })()`);
    check(/^번역 \d+\/\d+$/.test(r.sc) && r.rel >= 0 && r.rel < r.h, `검색 이동 — ${r.sc} · 칸 안에 보임 ${JSON.stringify(r)}`);
    await ev(`closeAdminSearch(), 1`);
    await until(`!!document.getElementById('sr-details')`);
    await click('#sr-details summary'); await sleep(150);
    const sr = await ev(`({ items: document.querySelectorAll('#score-reasons .sr-old').length, note: /자세한 기록 없음/.test(document.getElementById('score-reasons').textContent), inputs: document.querySelectorAll('#score-reasons .sr-q').length })`);
    check(sr.note && sr.items === (o.aiQualityDetail?.v3?.score?.changes || []).length && sr.inputs === sr.items, `저장된 이유 목록 ${sr.items}개 · "자세한 기록 없음" · 이유마다 검색어 입력칸`);
    check(await ev(`document.getElementById('panel-translation').value`) === before && !(await ev(`window.__mock.calls.some(c => c.m !== 'GET' && /orders\\/rec1|translation|draft|save/.test(c.p))`)), '번역문 그대로(바꾸지 않음) · 저장 요청 없음');
  }

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
console.log(`스크린숏: ${SHOT_DIR}/admin_preview_desktop.png · admin_preview_mobile.png · admin_destination_select.png · admin_search_jump.png · admin_score_reasons.png`);
process.exit(fail ? 1 : 0);
