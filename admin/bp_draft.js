// 우회 번역 폼 임시 저장 (2026-11-02) — 번역실패에서 [폼에 불러오기] 한 것 포함
// sessionStorage 에만(본문이라 localStorage 는 쓰지 않는다): 새로고침해도 남고, 탭을 닫으면 브라우저가 지운다.
// 접수(재실행 포함)에 성공하면 bpDraftClear() 로 지운다(index.html submitBypassOrder).
// 재실행 모드(불러온 주문번호)도 함께 남겨, 새로고침 뒤에도 같은 주문 재실행으로 이어진다.
(function () {
  var KEY = 'iumm.bpDraft';
  var IDS = ['bp-text', 'bp-email', 'bp-notes', 'bp-reference-text', 'bp-reference-glossary', 'bp-reference-notes',
    'bp-direction', 'bp-field', 'bp-plan', 'bp-corp-bizno', 'bp-corp-name', 'bp-dest-nation', 'bp-dest-variant'];
  var timer = null;
  function $(id) { return document.getElementById(id); }
  function store() { try { return window.sessionStorage; } catch (e) { return null; } }

  function save() {
    var st = store(); if (!st) return;
    var d = { v: {}, internal: !!($('bp-internal') || {}).checked, rp: window._bpReprocessOrderId || null, rpn: window._bpReprocessOrderNum || null };
    var any = false;
    IDS.forEach(function (id) { var el = $(id); if (el) { d.v[id] = el.value; if (el.tagName !== 'SELECT' && el.value) any = true; } });
    try { if (any || d.rp) st.setItem(KEY, JSON.stringify(d)); else st.removeItem(KEY); } catch (e) { /* 저장 공간 부족 — 임시 저장만 건너뜀 */ }
  }
  function later() { clearTimeout(timer); timer = setTimeout(save, 400); }

  window.bpDraftSave = save;
  window.bpDraftClear = function () { var st = store(); try { st && st.removeItem(KEY); } catch (e) { /* 무시 */ } };

  function restore() {
    var st = store(); if (!st) return;
    var d = null; try { d = JSON.parse(st.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !d.v) return;
    IDS.forEach(function (id) { var el = $(id); if (el && d.v[id] != null) el.value = d.v[id]; });
    var cb = $('bp-internal'); if (cb) cb.checked = !!d.internal;
    if (typeof bpScopeChanged === 'function') bpScopeChanged();
    if (window.bpDestRefresh) bpDestRefresh();
    if (typeof bpPlanChanged === 'function') bpPlanChanged();
    if (typeof bpUpdateCharCount === 'function') bpUpdateCharCount();
    if (d.rp && typeof enterReprocessMode === 'function') enterReprocessMode(d.rp, d.rpn);
    if (typeof showToast === 'function' && (d.v['bp-text'] || d.rp)) showToast('우회 번역 폼 — 임시 저장한 내용을 다시 불러왔습니다', '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = $('bypass-wrap') || document;
    wrap.addEventListener('input', later, true);
    wrap.addEventListener('change', later, true);
    restore();
  });
})();
