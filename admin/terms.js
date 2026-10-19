// ═══════════════════════════════════════════════════════════
// 관리자 — 용어 관리 · 기업고객 (서버: iumm-pipeline term_routes.js)
// ═══════════════════════════════════════════════════════════
// index.html 의 adminFetch · showToast · _ne(escape) 를 그대로 쓴다.
// 용어는 번역에만 쓰고 고객에게 전달하지 않는다 — 이 화면은 관리자 전용.
(function () {
  'use strict';

  var TF = { pair: '', field: '', docType: '', scope: '', status: '', biz: '', q: '' };
  var _terms = [];
  var _sel = {};
  var STATUS_COLOR = { '후보': '#facc15', '승인': '#16B894', '거절': 'rgba(255,255,255,0.35)', '충돌': '#f87171', '대체됨': '#a78bfa' };
  var SCOPE_COLOR = { '공용': 'rgba(255,255,255,0.6)', '기업전용': '#60a5fa', '내부전용': '#9ca3af' };
  var inp = 'padding:7px 10px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fafaf8;font-size:12.5px;outline:none';
  var btn = 'padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#fafaf8;font-size:12px;cursor:pointer;margin:1px';
  var esc = function (s) { return window._ne ? window._ne(s) : String(s == null ? '' : s); };
  var day = function (iso) { if (!iso) return '—'; var d = new Date(iso); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var won = function (n) { return '₩' + Number(n || 0).toLocaleString('ko-KR'); };
  var qs = function (o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); };

  // ── 용어 관리 ─────────────────────────────────────────────
  window.loadTerms = async function () {
    var wrap = document.getElementById('terms-list');
    wrap.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:13px">로딩 중…</p>';
    var r = await adminFetch('/api/admin/terms?' + qs(TF));
    if (!r.ok) { wrap.innerHTML = '<p style="color:#f87171">로드 실패: ' + esc(r.error) + '</p>'; return; }
    _terms = r.terms || []; _sel = {};
    renderTermFilters(r.facets || {}, r.counts || {});
    renderTerms(r.total);
  };

  function opt(list, cur, label) {
    return '<option value="">' + label + ' 전체</option>' + (list || []).map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function renderTermFilters(f, counts) {
    var el = document.getElementById('terms-filters');
    el.innerHTML =
      '<select style="' + inp + '" onchange="termsFilter(\'pair\',this.value)">' + opt(f.pair, TF.pair, '언어쌍') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'field\',this.value)">' + opt(f.field, TF.field, '분야') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'docType\',this.value)">' + opt(f.docType, TF.docType, '문서유형') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'scope\',this.value)">' + opt(f.scope, TF.scope, '범위') + '</select>' +
      '<select style="' + inp + '" onchange="termsFilter(\'status\',this.value)">' + opt(f.status, TF.status, '상태') + '</select>' +
      '<input style="' + inp + ';width:170px" placeholder="기업 (회사명·사업자번호)" value="' + esc(TF.biz) + '" onchange="termsFilter(\'biz\',this.value)">' +
      '<input style="' + inp + ';width:150px" placeholder="용어 검색" value="' + esc(TF.q) + '" onchange="termsFilter(\'q\',this.value)">' +
      '<span style="font-size:12px;color:rgba(255,255,255,0.45);margin-left:6px">' +
      Object.keys(counts).map(function (k) { return '<span style="color:' + (STATUS_COLOR[k] || '#fff') + '">' + k + ' ' + counts[k] + '</span>'; }).join(' · ') + '</span>';
  }
  window.termsFilter = function (k, v) { TF[k] = String(v || '').trim(); loadTerms(); };

  function metaLine(t) {
    return '등장 ' + t.count + ' · ' + esc(t.docType) + ' · ' + day(t.lastAt);
  }
  function renderTerms(total) {
    var wrap = document.getElementById('terms-list');
    if (!_terms.length) { wrap.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:13px">해당하는 용어가 없습니다.</p>'; return; }
    var rows = _terms.map(function (t) {
      var scope = '<span style="color:' + SCOPE_COLOR[t.scope] + '">' + esc(t.scope) + '</span>' + (t.company ? '<br><span style="font-size:11px;color:#60a5fa">' + esc(t.company) + '</span>' : '');
      var st = '<span style="color:' + (STATUS_COLOR[t.status] || '#fff') + ';font-weight:600">' + esc(t.status) + '</span>';
      var acts = '';
      if (t.status === '충돌') {
        var olds = (t.counterparts || []).map(function (o) {
          return '<div style="padding:6px 8px;border:1px solid rgba(255,255,255,0.12);border-radius:4px;margin-bottom:4px"><span style="font-size:11px;color:rgba(255,255,255,0.45)">기존</span> <strong>' + esc(o.target) + '</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.5)">' + metaLine(o) + '</span></div>';
        }).join('');
        acts = '<div style="display:flex;gap:8px;align-items:stretch">' +
          '<div style="flex:1">' + olds + '</div>' +
          '<div style="flex:1;padding:6px 8px;border:1px solid rgba(248,113,113,0.5);border-radius:4px"><span style="font-size:11px;color:#f87171">신규</span> <strong>' + esc(t.target) + '</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.5)">' + metaLine(t) + '</span></div>' +
          '</div><div style="margin-top:4px"><button style="' + btn + ';border-color:#f87171;color:#f87171" onclick="termsResolve(\'' + t.id + '\',\'new\')">신규로 대체</button>' +
          '<button style="' + btn + '" onclick="termsResolve(\'' + t.id + '\',\'old\')">기존 유지</button></div>';
      } else if (t.status === '후보' || t.status === '거절') {
        acts = '<button style="' + btn + ';border-color:#16B894;color:#16B894" onclick="termsAct(\'approve\',\'' + t.id + '\')">승인</button>' +
          '<button style="' + btn + '" onclick="termsEditApprove(\'' + t.id + '\')">수정 후 승인</button>' +
          (t.status === '후보' ? '<button style="' + btn + '" onclick="termsAct(\'reject\',\'' + t.id + '\')">거절</button>' : '');
      } else if (t.status === '승인') {
        acts = '<button style="' + btn + '" onclick="termsEditApprove(\'' + t.id + '\')">번역어 수정</button>' +
          '<button style="' + btn + '" onclick="termsAct(\'reject\',\'' + t.id + '\')">거절</button>';
      } else if (t.status === '대체됨') {
        acts = '<span style="font-size:11px;color:rgba(255,255,255,0.5)">→ ' + esc(t.replacedByTerm && t.replacedByTerm.target || '') + '</span> ' +
          '<button style="' + btn + ';border-color:#a78bfa;color:#a78bfa" onclick="termsAct(\'revert\',\'' + t.id + '\')">되돌리기</button>';
      }
      if (t.scope === '기업전용' && t.status !== '대체됨') acts += '<button style="' + btn + ';color:rgba(255,255,255,0.6)" onclick="termsToPublic(\'' + t.id + '\',\'' + esc(t.scope) + '\')">공용 전환</button>';
      var canBulk = t.status === '후보';
      return '<tr style="' + (t.status === '충돌' ? 'background:rgba(248,113,113,0.06)' : '') + '">' +
        '<td>' + (canBulk ? '<input type="checkbox" onchange="termsPick(\'' + t.id + '\',this.checked)">' : '') + '</td>' +
        '<td><strong>' + esc(t.source) + '</strong></td>' +
        '<td>' + (t.status === '충돌' ? '' : esc(t.target)) + '</td>' +
        '<td style="font-size:12px">' + esc(t.pair) + '<br><span style="color:rgba(255,255,255,0.45)">' + esc(t.field || '') + '</span></td>' +
        '<td style="font-size:12px">' + esc(t.docType) + '</td>' +
        '<td style="font-size:12px">' + scope + '</td>' +
        '<td>' + st + '</td>' +
        '<td style="text-align:right">' + t.count + '</td>' +
        '<td style="font-size:12px">' + day(t.lastAt) + '<br><span style="color:rgba(255,255,255,0.4)">' + esc(t.sourceType || '') + '</span></td>' +
        '<td style="min-width:' + (t.status === '충돌' ? '360' : '180') + 'px">' + acts + '</td></tr>';
    }).join('');
    wrap.innerHTML =
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><button style="' + btn + ';border-color:#16B894;color:#16B894" onclick="termsBulk()">선택 일괄 승인</button>' +
      '<span style="font-size:12px;color:rgba(255,255,255,0.45)">' + total + '건 · 충돌 맨 위, 그다음 등장횟수순</span></div>' +
      '<table class="orders-table" style="font-size:13px"><thead><tr><th></th><th>원어</th><th>번역어</th><th>언어쌍/분야</th><th>문서유형</th><th>범위</th><th>상태</th><th>등장</th><th>최근/출처</th><th>작업</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  window.termsPick = function (id, on) { if (on) _sel[id] = 1; else delete _sel[id]; };

  async function post(path, body, method) {
    var r = await adminFetch(path, { method: method || 'POST', body: JSON.stringify(body || {}) });
    if (!r.ok) showToast('⚠️ ' + (r.error || '실패'), 'error');
    return r;
  }
  window.termsAct = async function (act, id) {
    var r = await post('/api/admin/terms/' + id + '/' + act);
    if (r.ok) { showToast(act === 'approve' ? '✅ 승인' : act === 'reject' ? '거절' : '되돌림', 'success'); loadTerms(); }
    else if (r.code === 'CONFLICT') loadTerms();
  };
  window.termsEditApprove = async function (id) {
    var t = _terms.find(function (x) { return x.id === id; }); if (!t) return;
    var v = prompt('번역어 (' + t.source + ')', t.target);
    if (v == null || !v.trim()) return;
    var r = t.status === '승인' ? await post('/api/admin/terms/' + id, { target: v.trim() }, 'PATCH') : await post('/api/admin/terms/' + id + '/approve', { target: v.trim() });
    if (r.ok) { showToast('✅ 저장', 'success'); loadTerms(); } else if (r.code === 'CONFLICT') loadTerms();
  };
  window.termsResolve = async function (id, choice) {
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
    TF = { pair: '', field: '', docType: '', scope: '기업전용', status: '', biz: bizNo, q: '' };
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
