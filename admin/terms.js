// ═══════════════════════════════════════════════════════════
// 관리자 — 용어 관리 · 기업고객 (서버: iumm-pipeline term_routes.js)
// ═══════════════════════════════════════════════════════════
// index.html 의 adminFetch · showToast · _ne(escape) 를 그대로 쓴다.
// 용어는 번역에만 쓰고 고객에게 전달하지 않는다 — 이 화면은 관리자 전용.
(function () {
  'use strict';

  // 언어 방향은 서버 필터가 아니라 탭(VIEW.tab)으로 나눈다 — 탭마다 묶음 수를 세려면 전체가 필요
  var TF = { field: '', docType: '', scope: '', status: '', biz: '', q: '' };
  var VIEW = { tab: '', page: 1 };
  var PAGE_SIZE = 50;
  var FIXED_TABS = ['한국어→영어', '영어→한국어'];
  var _terms = [];
  var _sel = {};
  // 색은 파란색 계열로 통일(진한 파랑=사용 중·충돌, 연한 파랑=후보·기업전용, 회색=대체됨·거절·내부전용)
  var BLUE = '#3b82f6', BLUE_DEEP = '#1d4ed8', BLUE_LIGHT = '#93c5fd', GRAY = '#9ca3af';
  var STATUS_COLOR = { '후보': BLUE_LIGHT, '승인': BLUE, '거절': 'rgba(255,255,255,0.35)', '충돌': BLUE, '대체됨': GRAY };
  var SCOPE_COLOR = { '공용': 'rgba(255,255,255,0.6)', '기업전용': BLUE_LIGHT, '내부전용': GRAY };
  var inp = 'padding:7px 10px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fafaf8;font-size:12.5px;outline:none';
  var btn = 'padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#fafaf8;font-size:12px;cursor:pointer;margin:1px';
  var esc = function (s) { return window._ne ? window._ne(s) : String(s == null ? '' : s); };
  var day = function (iso) { if (!iso) return '—'; var d = new Date(iso); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var won = function (n) { return '₩' + Number(n || 0).toLocaleString('ko-KR'); };
  var qs = function (o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); };

  // ── 용어 관리 ─────────────────────────────────────────────
  // 주소 #terms?tab=…&page=…&scope=… — 새로 고침해도 같은 탭·페이지·필터
  function readHash() {
    var h = location.hash || '';
    if (h.indexOf('#terms') !== 0) return false;
    var p = new URLSearchParams(h.split('?')[1] || '');
    Object.keys(TF).forEach(function (k) { TF[k] = p.get(k) || ''; });
    VIEW.tab = p.get('tab') || '';
    VIEW.page = Math.max(1, parseInt(p.get('page'), 10) || 1);
    return true;
  }
  function writeHash() {
    var q = qs(Object.assign({ tab: VIEW.tab, page: VIEW.page > 1 ? VIEW.page : '' }, TF));
    var h = '#terms' + (q ? '?' + q : '');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }
  var _hashRead = false;

  window.loadTerms = async function () {
    if (!_hashRead) { _hashRead = true; readHash(); }
    var wrap = document.getElementById('terms-list');
    wrap.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:13px">로딩 중…</p>';
    // 묶음이 잘리지 않게 전체를 받는다(서버 기본 500건)
    var r = await adminFetch('/api/admin/terms?' + qs(Object.assign({ limit: 10000 }, TF)));
    if (!r.ok) { wrap.innerHTML = '<p style="color:#f87171">로드 실패: ' + esc(r.error) + '</p>'; return; }
    _terms = r.terms || []; _sel = {};
    await checkServer();
    _facets = r.facets || {};
    renderTerms();
  };
  var _facets = {};

  function opt(list, cur, label) {
    return '<option value="">' + label + ' 전체</option>' + (list || []).map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function renderTermFilters(f, counts) {
    var el = document.getElementById('terms-filters');
    el.innerHTML =
      '<select style="' + inp + '" onchange="termsFilter(\'field\',this.value)">' + opt(f.field, TF.field, '분야') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'docType\',this.value)">' + opt(f.docType, TF.docType, '문서유형') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'scope\',this.value)">' + opt(f.scope, TF.scope, '범위') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'status\',this.value)">' + opt(f.status, TF.status, '상태') + '</select>' +
      '<input style="' + inp + ';width:170px" placeholder="기업 (회사명·사업자번호)" value="' + esc(TF.biz) + '" onchange="termsFilter(\'biz\',this.value)">' +
      '<input style="' + inp + ';width:150px" placeholder="용어 검색" value="' + esc(TF.q) + '" onchange="termsFilter(\'q\',this.value)">' +
      '<span style="font-size:12px;color:rgba(255,255,255,0.45);margin-left:6px">' +
      Object.keys(counts).map(function (k) { return '<span style="color:' + (STATUS_COLOR[k] || '#fff') + '">' + k + ' ' + counts[k] + '</span>'; }).join(' · ') + '</span>';
  }
  window.termsFilter = function (k, v) { TF[k] = String(v || '').trim(); VIEW.page = 1; loadTerms(); };

  function metaLine(t) {
    return '등장 ' + t.count + ' · ' + esc(t.docType) + ' · ' + day(t.lastAt);
  }

  // ── 서버 버전 확인 — 되돌리기 고침(33dd2b9) 이전 서버에선 되돌리기·충돌 해결을 끈다 ──
  // 이전 서버는 되돌린 용어를 '충돌'로 남겨 다시 원상복구되기 쉬웠다. /health 의 commit 이 이전 목록(terms_old_commits.js)에 없으면 켠다.
  // commit 이 비어 있으면(CLI 직접 배포) 용어 응답에 새 서버만 주는 locked 값이 있는지로 판단한다.
  var _srv = { checked: false, ready: false, commit: '' };
  var _srvTimer = null;
  async function checkServer() {
    try {
      var h = await fetch(API_BASE + '/health', { cache: 'no-store' }).then(function (r) { return r.json(); });
      var c = String(h.commit || '').slice(0, 7);
      var old = window.TERMS_PRE_FIX_COMMITS || [];
      _srv.commit = c;
      _srv.ready = c ? old.indexOf(c) < 0 : _terms.some(function (t) { return 'locked' in t; });
    } catch (e) { _srv.ready = false; }
    _srv.checked = true;
    // 꺼져 있는 동안은 1분마다 다시 확인 — 배포되면 새로고침 없이 켜진다
    if (!_srv.ready && !_srvTimer) _srvTimer = setInterval(async function () {
      var wrap = document.getElementById('terms-wrap');
      if (!wrap || wrap.style.display === 'none') return;
      await checkServer();
      if (_srv.ready) { clearInterval(_srvTimer); _srvTimer = null; renderTerms(); showToast('서버 업데이트 확인 — 되돌리기·충돌 해결을 다시 쓸 수 있습니다', 'success'); }
    }, 60000);
  }
  var _open = {};   // 예전 번역(대체됨·거절)을 펼친 묶음

  var GROUP_CSS =
    '.tg{border:1px solid rgba(255,255,255,0.12);border-radius:6px;margin-bottom:10px;background:rgba(255,255,255,0.02)}' +
    '.tg.cf{border:2px solid ' + BLUE + '}' +
    '.tg-h{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.08)}' +
    '.tg-h strong{font-size:14.5px;word-break:break-all}' +
    '.tg-h .m{font-size:12px;color:rgba(255,255,255,0.45)}' +
    '.tr{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:flex-start;padding:8px 12px;border-top:1px solid rgba(255,255,255,0.05)}' +
    '.tr:first-child{border-top:0}' +
    '.tr .t{flex:1 1 220px;min-width:0;word-break:break-word}' +
    '.tr .t b{font-size:13.5px}' +
    '.tr .s{font-size:11.5px;color:rgba(255,255,255,0.5);margin-top:2px}' +
    '.tr .a{flex:0 1 auto;display:flex;flex-wrap:wrap;gap:2px;align-items:center}' +
    '.tr.used{background:rgba(59,130,246,0.09)}' +
    '.tr.past{opacity:0.75}' +
    '.tbadge{display:inline-block;font-size:10.5px;padding:1px 6px;border-radius:9px;border:1px solid currentColor;margin-left:4px;vertical-align:1px;white-space:nowrap}' +
    '.tg-more{display:block;width:100%;text-align:left;padding:7px 12px;background:transparent;border:0;border-top:1px dashed rgba(255,255,255,0.1);color:rgba(255,255,255,0.55);font-size:12px;cursor:pointer}' +
    '.tg-cmp{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}' +
    '.tg-cmp>div{flex:1 1 200px;padding:6px 8px;border:1px solid rgba(255,255,255,0.12);border-radius:4px}' +
    '.tbtn[disabled]{opacity:0.35;cursor:not-allowed}' +
    '.tmodal{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}' +
    '.tmodal>div{background:#1a1a1a;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:18px;max-width:420px;width:100%;font-size:14px;line-height:1.6;color:#fafaf8}' +
    '.tmodal .btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}' +
    '.ttabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1)}' +
    '.ttab{padding:7px 12px;background:transparent;border:0;border-bottom:2px solid transparent;color:rgba(255,255,255,0.6);font-size:13px;cursor:pointer}' +
    '.ttab.on{color:#fafaf8;border-bottom-color:' + BLUE + ';font-weight:600}' +
    '.ttab .n{font-size:11px;color:' + BLUE_LIGHT + ';margin-left:4px}' +
    '.ttab-sel{display:none;width:100%;margin-bottom:10px}' +
    '.tpager{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center;margin:14px 0 4px}' +
    '.tpager button{min-width:34px;padding:6px 9px;border-radius:4px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#fafaf8;font-size:12.5px;cursor:pointer}' +
    '.tpager button.on{background:' + BLUE_DEEP + ';border-color:' + BLUE + '}' +
    '.tpager button[disabled]{opacity:0.3;cursor:default}' +
    '@media (max-width:640px){.tr .a{width:100%}.tr .a button{flex:1 1 auto;padding:8px 10px}.ttabs{display:none}.ttab-sel{display:block}}';
  function ensureCss() {
    if (document.getElementById('terms-group-css')) return;
    var s = document.createElement('style'); s.id = 'terms-group-css'; s.textContent = GROUP_CSS; document.head.appendChild(s);
  }

  // 같은 원어·같은 언어 방향을 한 묶음으로.
  // 묶음 순서 = 충돌 있는 묶음 → 승인(사용 중) 있는 묶음 → 후보만 있는 묶음 → 예전 번역만 남은 묶음, 같은 단계 안에선 묶음 안 모든 번역의 등장 합계순
  var HIDDEN = { '대체됨': 1, '거절': 1 };
  var IN_GROUP = { '승인': 0, '충돌': 1, '후보': 2, '대체됨': 3, '거절': 4 };
  function groupTerms(list) {
    var map = {}, order = [];
    list.forEach(function (t) {
      var k = t.pair + '\u0000' + t.source;
      if (!map[k]) { map[k] = { key: k, source: t.source, pair: t.pair, items: [], sum: 0, conflict: false, used: false, cand: false }; order.push(map[k]); }
      var g = map[k];
      g.items.push(t); g.sum += Number(t.count) || 0;
      if (t.status === '충돌') g.conflict = true;
      if (t.status === '승인') g.used = true;
      if (t.status === '후보') g.cand = true;
    });
    var rank = function (g) { return g.conflict ? 0 : g.used ? 1 : g.cand ? 2 : 3; };
    order.forEach(function (g) { g.items.sort(function (a, b) { return (IN_GROUP[a.status] - IN_GROUP[b.status]) || (b.count - a.count); }); });
    return order.sort(function (a, b) { return (rank(a) - rank(b)) || (b.sum - a.sum); });
  }

  var LOCK_MSG = '서버 업데이트 후 사용 가능';
  function lockedBtn(style, onclick, label) {
    return _srv.ready
      ? '<button class="tbtn" style="' + btn + style + '" onclick="' + onclick + '">' + label + '</button>'
      : '<button class="tbtn" style="' + btn + style + '" disabled title="' + LOCK_MSG + '">' + label + '</button>';
  }

  function termRow(t, g) {
    var badges = '';
    if (t.status === '승인') badges += '<span class="tbadge" style="color:#fff;background:' + BLUE + ';border-color:' + BLUE + '">사용 중</span>';
    else if (t.status === '충돌') badges += '<span class="tbadge" style="color:#fff;background:' + BLUE_DEEP + ';border-color:' + BLUE + '">충돌</span>';
    else badges += '<span class="tbadge" style="color:' + (STATUS_COLOR[t.status] || '#fff') + '">' + esc(t.status) + '</span>';
    badges += '<span class="tbadge" style="color:' + SCOPE_COLOR[t.scope] + '">' + esc(t.scope) + (t.company ? ' · ' + esc(t.company) : '') + '</span>';
    if (t.locked) badges += '<span class="tbadge" style="color:rgba(255,255,255,0.55)" title="관리자가 직접 고른 결정 — 수정본 자동 승인이 바꾸지 않음">직접 결정</span>';
    var sub = '등장 ' + t.count + ' · ' + esc(t.field || '분야 없음') + ' · ' + esc(t.docType || '') + ' · ' + day(t.lastAt) + (t.sourceType ? ' · ' + esc(t.sourceType) : '');
    var acts = '', extra = '';
    if (t.status === '충돌') {
      var olds = (t.counterparts || []).map(function (o) {
        return '<div><span style="font-size:11px;color:rgba(255,255,255,0.45)">기존</span> <strong>' + esc(o.target) + '</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.5)">' + metaLine(o) + '</span></div>';
      }).join('');
      extra = '<div class="tg-cmp">' + olds + '<div style="border-color:' + BLUE + '"><span style="font-size:11px;color:' + BLUE_LIGHT + '">신규</span> <strong>' + esc(t.target) + '</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.5)">' + metaLine(t) + '</span></div></div>';
      acts = lockedBtn(';border-color:' + BLUE + ';color:' + BLUE_LIGHT, 'termsResolve(\'' + t.id + '\',\'new\')', '신규로 대체') +
        lockedBtn('', 'termsResolve(\'' + t.id + '\',\'old\')', '기존 유지');
    } else if (t.status === '후보' || t.status === '거절') {
      acts = (t.status === '후보' ? '<input type="checkbox" title="일괄 승인 선택" style="margin:0 4px" onchange="termsPick(\'' + t.id + '\',this.checked)">' : '') +
        '<button style="' + btn + ';border-color:' + BLUE + ';color:' + BLUE_LIGHT + '" onclick="termsAct(\'approve\',\'' + t.id + '\')">승인</button>' +
        '<button style="' + btn + '" onclick="termsEditApprove(\'' + t.id + '\')">수정 후 승인</button>' +
        (t.status === '후보' ? '<button style="' + btn + '" onclick="termsAct(\'reject\',\'' + t.id + '\')">거절</button>' : '');
    } else if (t.status === '승인') {
      acts = '<button style="' + btn + '" onclick="termsEditApprove(\'' + t.id + '\')">번역어 수정</button>' +
        '<button style="' + btn + '" onclick="termsAct(\'reject\',\'' + t.id + '\')">거절</button>';
    } else if (t.status === '대체됨') {
      var by = t.replacedByTerm && t.replacedByTerm.target;
      sub += '<br><span style="color:' + (by ? 'rgba(255,255,255,0.5)' : BLUE_LIGHT) + '">→ ' + (by ? esc(by) + '(으)로 대체됨' : '⚠ 대체 대상 없음') + '</span>';
      acts = lockedBtn(';border-color:' + BLUE_LIGHT + ';color:' + BLUE_LIGHT, 'termsRevertAsk(\'' + t.id + '\')', '예전 번역으로 되돌리기');
    }
    if (t.scope === '기업전용' && t.status !== '대체됨') acts += '<button style="' + btn + ';color:rgba(255,255,255,0.6)" onclick="termsToPublic(\'' + t.id + '\',\'' + esc(t.scope) + '\')">공용 전환</button>';
    var cls = 'tr' + (t.status === '승인' ? ' used' : HIDDEN[t.status] ? ' past' : '');
    return '<div class="' + cls + '"><div class="t"><b>' + (t.status === '충돌' ? '<span style="color:' + BLUE_LIGHT + '">충돌 — 아래에서 고르세요</span>' : esc(t.target)) + '</b>' + badges +
      '<div class="s">' + sub + '</div>' + extra + '</div><div class="a">' + acts + '</div></div>';
  }

  // 탭 순서: 한국어→영어(기본) → 영어→한국어 → 나머지는 용어 수 많은 순. 탭 옆 숫자 = 묶음 수(현재 필터 기준)
  function buildTabs(groups) {
    var n = {}, rows = {};
    groups.forEach(function (g) { n[g.pair] = (n[g.pair] || 0) + 1; rows[g.pair] = (rows[g.pair] || 0) + g.items.length; });
    var rest = Object.keys(n).filter(function (p) { return FIXED_TABS.indexOf(p) < 0; })
      .sort(function (a, b) { return (rows[b] - rows[a]) || a.localeCompare(b); });
    return FIXED_TABS.concat(rest).map(function (p) { return { pair: p, groups: n[p] || 0 }; });
  }
  function pagerHtml(page, pages) {
    if (pages <= 1) return '';
    var b = function (p, label, on, dis) { return '<button' + (on ? ' class="on"' : '') + (dis ? ' disabled' : ' onclick="termsPage(' + p + ')"') + '>' + label + '</button>'; };
    var from = Math.max(1, page - 2), to = Math.min(pages, from + 4); from = Math.max(1, to - 4);
    var nums = '';
    for (var i = from; i <= to; i++) nums += b(i, i, i === page, false);
    return '<div class="tpager">' + b(1, '처음', false, page === 1) + b(page - 1, '이전', false, page === 1) + nums +
      b(page + 1, '다음', false, page === pages) + b(pages, '끝', false, page === pages) +
      '<span style="font-size:12px;color:rgba(255,255,255,0.45);margin-left:6px">' + page + ' / ' + pages + '쪽</span></div>';
  }

  function renderTerms() {
    ensureCss();
    var wrap = document.getElementById('terms-list');
    var all = groupTerms(_terms);
    var tabs = buildTabs(all);
    // 탭 지정이 없으면 한국어→영어, 비어 있으면 묶음이 있는 첫 탭
    if (!VIEW.tab || !tabs.some(function (t) { return t.pair === VIEW.tab; })) {
      var first = tabs.filter(function (t) { return t.groups; })[0];
      VIEW.tab = tabs[0].groups || !first ? tabs[0].pair : first.pair;
    }
    var groups = all.filter(function (g) { return g.pair === VIEW.tab; });
    var tabTerms = _terms.filter(function (t) { return t.pair === VIEW.tab; });
    var counts = {};
    tabTerms.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
    renderTermFilters(_facets, counts);

    var pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
    if (VIEW.page > pages) VIEW.page = pages;
    writeHash();

    var tabBar = '<div class="ttabs">' + tabs.map(function (t) {
      return '<button class="ttab' + (t.pair === VIEW.tab ? ' on' : '') + '" onclick="termsTab(\'' + encodeURIComponent(t.pair) + '\')">' + esc(t.pair) + '<span class="n">' + t.groups + '</span></button>';
    }).join('') + '</div>' +
      '<select class="ttab-sel" style="' + inp + '" onchange="termsTab(encodeURIComponent(this.value))">' + tabs.map(function (t) {
        return '<option value="' + esc(t.pair) + '"' + (t.pair === VIEW.tab ? ' selected' : '') + '>' + esc(t.pair) + ' (' + t.groups + '묶음)</option>';
      }).join('') + '</select>';

    var notice = _srv.ready ? '' :
      '<div style="padding:8px 12px;margin-bottom:10px;border:1px solid ' + BLUE + ';border-radius:6px;color:' + BLUE_LIGHT + ';font-size:12.5px">' +
      'ℹ️ \'예전 번역으로 되돌리기\'·\'충돌 해결\'은 ' + LOCK_MSG + '입니다' + (_srv.checked ? ' (현재 서버 ' + esc(_srv.commit || '확인 불가') + ')' : '') +
      '. 서버가 바뀌면 자동으로 켜집니다.</div>';

    if (!groups.length) {
      wrap.innerHTML = notice + tabBar + '<p style="color:rgba(255,255,255,0.4);font-size:13px">해당하는 용어가 없습니다.</p>';
      return;
    }
    // 상태 필터로 대체됨·거절을 고른 경우엔 접지 않는다(접으면 빈 화면)
    var showAll = !!HIDDEN[TF.status];
    var start = (VIEW.page - 1) * PAGE_SIZE;
    var html = groups.slice(start, start + PAGE_SIZE).map(function (g) {
      var vis = g.items.filter(function (t) { return showAll || !HIDDEN[t.status]; });
      var past = showAll ? [] : g.items.filter(function (t) { return HIDDEN[t.status]; });
      var open = !!_open[g.key];
      var body = vis.map(function (t) { return termRow(t, g); }).join('');
      if (!vis.length) body = '<div class="tr"><div class="t s">사용 중인 번역 없음</div></div>';
      if (past.length) {
        body += '<button class="tg-more" onclick="termsTogglePast(\'' + encodeURIComponent(g.key) + '\')">' + (open ? '예전 번역 접기' : '예전 번역 보기 (' + past.length + ')') + '</button>';
        if (open) body += past.map(function (t) { return termRow(t, g); }).join('');
      }
      return '<div class="tg' + (g.conflict ? ' cf' : '') + '"><div class="tg-h"><strong>' + esc(g.source) + '</strong>' +
        '<span class="m">등장 합계 ' + g.sum + ' · 번역 ' + g.items.length + '개</span></div>' + body + '</div>';
    }).join('');
    wrap.innerHTML = notice + tabBar +
      '<div style="display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-bottom:10px"><button style="' + btn + ';border-color:' + BLUE + ';color:' + BLUE_LIGHT + '" onclick="termsBulk()">선택 일괄 승인</button>' +
      '<span style="font-size:12px;color:rgba(255,255,255,0.45)">' + groups.length + '묶음 · ' + tabTerms.length + '건 · ' + (start + 1) + '–' + Math.min(start + PAGE_SIZE, groups.length) + '번째 묶음 · 충돌 → 사용 중 → 후보만, 각각 등장 합계순</span></div>' +
      html + pagerHtml(VIEW.page, pages);
  }
  window.termsTab = function (p) {
    VIEW.tab = decodeURIComponent(p); VIEW.page = 1; _sel = {};
    renderTerms();
  };
  window.termsPage = function (p) {
    VIEW.page = p;
    renderTerms();
    var w = document.getElementById('terms-wrap'); if (w) w.scrollIntoView({ block: 'start' });
  };
  window.termsTogglePast = function (k) {
    k = decodeURIComponent(k);
    if (_open[k]) delete _open[k]; else _open[k] = 1;
    renderTerms();
  };

  // 화면 안 확인 상자(브라우저 기본 알림창 대신)
  function askBox(html, okLabel) {
    return new Promise(function (resolve) {
      var m = document.createElement('div'); m.className = 'tmodal';
      m.innerHTML = '<div role="dialog" aria-modal="true"><div>' + html + '</div><div class="btns">' +
        '<button style="' + btn + ';padding:7px 14px" data-v="0">취소</button>' +
        '<button style="' + btn + ';padding:7px 14px;border-color:' + BLUE + ';color:' + BLUE_LIGHT + '" data-v="1">' + okLabel + '</button></div></div>';
      var done = function (v) { m.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape') done(false); };
      m.addEventListener('click', function (e) { if (e.target === m) done(false); var v = e.target.getAttribute && e.target.getAttribute('data-v'); if (v != null) done(v === '1'); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(m);
      m.querySelector('[data-v="1"]').focus();
    });
  }
  window.termsRevertAsk = async function (id) {
    if (!_srv.ready) { showToast(LOCK_MSG, 'error'); return; }
    var t = _terms.find(function (x) { return x.id === id; }); if (!t) return;
    var cur = _terms.filter(function (x) { return x.status === '승인' && x.source === t.source && x.pair === t.pair; }).map(function (x) { return x.target; });
    if (!cur.length && t.replacedByTerm && t.replacedByTerm.target) cur = [t.replacedByTerm.target];
    var ok = await askBox('<strong>' + esc(t.source) + '</strong><br>' +
      (cur.length ? '지금 사용 중인 <strong>' + cur.map(esc).join(', ') + '</strong> 대신 ' : '') +
      '<strong style="color:' + BLUE_LIGHT + '">' + esc(t.target) + '</strong>를 다시 쓰게 됩니다. 계속할까요?', '되돌리기');
    if (ok) termsAct('revert', id);
  };
  window.termsPick = function (id, on) { if (on) _sel[id] = 1; else delete _sel[id]; };

  // 서버 오류·응답이 JSON 이 아닌 경우(게이트웨이 오류 등)·네트워크 오류도 화면에 실패로 알린다
  async function post(path, body, method) {
    var r;
    try { r = await adminFetch(path, { method: method || 'POST', body: JSON.stringify(body || {}) }); }
    catch (e) { r = { ok: false, error: '서버 응답을 받지 못했습니다 — 반영되지 않았을 수 있으니 목록을 다시 확인하세요' }; }
    if (!r || !r.ok) { r = r || { ok: false }; showToast('⚠️ 실패: ' + (r.error || '알 수 없는 오류'), 'error'); }
    return r;
  }
  window.termsAct = async function (act, id) {
    var r = await post('/api/admin/terms/' + id + '/' + act);
    if (r.ok) {
      var msg = act === 'approve' ? '✅ 승인' : act === 'reject' ? '거절' :
        '되돌림 — ' + r.term.target + ' 사용 중' + ((r.replaced || []).length ? ' · ' + r.replaced.map(function (x) { return x.target; }).join(', ') + ' 대체됨' : '');
      showToast(msg, 'success');
    }
    loadTerms();
  };
  window.termsEditApprove = async function (id) {
    var t = _terms.find(function (x) { return x.id === id; }); if (!t) return;
    var v = prompt('번역어 (' + t.source + ')', t.target);
    if (v == null || !v.trim()) return;
    var r = t.status === '승인' ? await post('/api/admin/terms/' + id, { target: v.trim() }, 'PATCH') : await post('/api/admin/terms/' + id + '/approve', { target: v.trim() });
    if (r.ok) { showToast('✅ 저장', 'success'); loadTerms(); } else if (r.code === 'CONFLICT') loadTerms();
  };
  window.termsResolve = async function (id, choice) {
    if (!_srv.ready) { showToast(LOCK_MSG, 'error'); return; }
    var r = await post('/api/admin/terms/' + id + '/resolve', { choice: choice });
    if (r.ok) { showToast(choice === 'new' ? '신규로 대체 (기존은 대체됨)' : '기존 유지 (신규 거절)', 'success'); loadTerms(); }
  };
  window.termsToPublic = async function (id, scope) {
    if (!confirm(scope + ' 용어를 공용으로 전환합니다.\n공용 용어는 모든 고객의 번역에 쓰입니다. 진행할까요?')) return;
    var r = await post('/api/admin/terms/' + id + '/to-public');
    if (r.ok) { showToast('공용으로 전환', 'success'); loadTerms(); }
  };
  window.termsBulk = async function () {
    var ids = Object.keys(_sel);
    if (!ids.length) { showToast('선택한 후보가 없습니다', 'error'); return; }
    var r = await post('/api/admin/terms/bulk-approve', { ids: ids });
    if (r.ok) { showToast('✅ ' + r.approved.length + '건 승인' + (r.skipped.length ? ' · 충돌 ' + r.skipped.length + '건 제외' : ''), 'success'); loadTerms(); }
  };
  window.termsShowCorp = function (bizNo) {
    TF = { field: '', docType: '', scope: '기업전용', status: '', biz: bizNo, q: '' };
    VIEW = { tab: '', page: 1 }; _hashRead = true;
    switchTab('terms');
  };

  // ── 기업고객 ──────────────────────────────────────────────
  var CF = { q: '', sort: 'recent' };
  window.loadCorps = async function () {
    var wrap = document.getElementById('corp-list');
    document.getElementById('corp-detail').style.display = 'none';
    wrap.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:13px">로딩 중…</p>';
    var r = await adminFetch('/api/admin/corp-customers?' + qs(CF));
    if (!r.ok) { wrap.innerHTML = '<p style="color:#f87171">로드 실패: ' + esc(r.error) + '</p>'; return; }
    var list = r.corps || [];
    if (!list.length) { wrap.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:13px">기업 고객이 없습니다. 주문 화면에서 \'기업 고객\'을 체크한 주문이 들어오면 자동으로 등록됩니다.</p>'; return; }
    wrap.innerHTML = '<table class="orders-table" style="font-size:13px"><thead><tr><th>회사명</th><th>사업자등록번호</th><th>최초 주문일</th><th>최근 주문일</th><th style="text-align:right">주문 건수</th><th style="text-align:right">누적 결제액</th><th>전용 용어 (승인/후보)</th><th>동의 일시</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr style="cursor:pointer" onclick="corpOpen(\'' + c.bizNo + '\')">' +
          '<td><strong>' + esc(c.company || '—') + '</strong>' + (c.linkedMember ? ' <span style="font-size:10px;color:var(--gold)">기업회원</span>' : '') + '</td>' +
          '<td>' + c.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3') + '</td>' +
          '<td>' + day(c.firstOrderAt) + '</td><td>' + day(c.lastOrderAt) + '</td>' +
          '<td style="text-align:right">' + c.orderCount + '</td><td style="text-align:right">' + won(c.totalPaid) + '</td>' +
          '<td><span style="color:#16B894">' + c.terms['승인'] + '</span> / <span style="color:#facc15">' + c.terms['후보'] + '</span>' + (c.terms['충돌'] ? ' <span style="color:#f87171">충돌 ' + c.terms['충돌'] + '</span>' : '') + '</td>' +
          '<td style="font-size:12px">' + day(c.consentAt) + '</td></tr>';
      }).join('') + '</tbody></table>';
  };
  window.corpFilter = function (k, v) { CF[k] = v; loadCorps(); };

  window.corpOpen = async function (bizNo) {
    var el = document.getElementById('corp-detail');
    el.style.display = 'block'; el.innerHTML = '<p style="color:rgba(255,255,255,0.4)">로딩 중…</p>';
    var r = await adminFetch('/api/admin/corp-customers/' + bizNo);
    if (!r.ok) { el.innerHTML = '<p style="color:#f87171">' + esc(r.error) + '</p>'; return; }
    var c = r.corp || { company: '', bizNo: bizNo };
    var fmt = bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><h3 style="margin:0;font-size:16px">' + esc(c.company || '—') + ' <span style="font-size:12px;color:rgba(255,255,255,0.5)">' + fmt + '</span></h3>' +
      '<button style="' + btn + '" onclick="termsShowCorp(\'' + bizNo + '\')">용어 관리에서 보기</button>' +
      '<button style="' + btn + ';margin-left:auto;border-color:#f87171;color:#f87171" onclick="corpDeleteTerms(\'' + bizNo + '\',' + r.terms.length + ')">전용 용어 전체 삭제</button></div>' +
      '<h4 style="font-size:13px;margin:10px 0 6px;color:rgba(255,255,255,0.7)">주문 ' + r.orders.length + '건</h4>' +
      '<table class="orders-table" style="font-size:12.5px"><thead><tr><th>주문번호</th><th>접수일</th><th>번역방향</th><th>문서유형</th><th>상태</th><th style="text-align:right">금액</th></tr></thead><tbody>' +
      (r.orders.map(function (o) { return '<tr><td>' + esc(o.orderNumber) + '</td><td>' + day(o.receivedAt) + '</td><td>' + esc(o.direction) + '</td><td>' + esc(o.docType) + '</td><td>' + esc(o.status) + '</td><td style="text-align:right">' + won(o.amount) + '</td></tr>'; }).join('') || '<tr><td colspan="6" style="color:rgba(255,255,255,0.4)">주문 없음</td></tr>') +
      '</tbody></table>' +
      '<h4 style="font-size:13px;margin:16px 0 6px;color:rgba(255,255,255,0.7)">전용 용어 ' + r.terms.length + '개</h4>' +
      '<table class="orders-table" style="font-size:12.5px"><thead><tr><th>원어</th><th>번역어</th><th>언어쌍</th><th>문서유형</th><th>상태</th><th style="text-align:right">등장</th></tr></thead><tbody>' +
      (r.terms.map(function (t) { return '<tr><td>' + esc(t.source) + '</td><td>' + esc(t.target) + '</td><td>' + esc(t.pair) + '</td><td>' + esc(t.docType) + '</td><td style="color:' + (STATUS_COLOR[t.status] || '#fff') + '">' + esc(t.status) + '</td><td style="text-align:right">' + t.count + '</td></tr>'; }).join('') || '<tr><td colspan="6" style="color:rgba(255,255,255,0.4)">아직 없음</td></tr>') +
      '</tbody></table>';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.corpDeleteTerms = async function (bizNo, n) {
    var fmt = bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
    var typed = prompt('이 기업의 전용 용어 ' + n + '개를 모두 삭제합니다. 되돌릴 수 없습니다.\n확인을 위해 사업자등록번호(' + fmt + ')를 입력하세요.');
    if (typed == null) return;
    var r = await post('/api/admin/corp-customers/' + bizNo + '/terms', { confirm: typed }, 'DELETE');
    if (r.ok) { showToast('전용 용어 ' + r.deleted + '개 삭제', 'success'); corpOpen(bizNo); }
  };
})();
