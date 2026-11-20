// 우회 주문 탭 — ① 번역 방식 고르기 · 버튼 켜고 끄기 · 문서 언어 경고 (2026-11-20)
// - 처음엔 아무것도 고르지 않은 상태. 고른 값은 sessionStorage 'iumm.bpMode'(새로 고쳐도 그대로, 탭을 닫으면 지워짐)
// - 텍스트 번역: ③ 추출 → ④ 원문 텍스트 → ⑤ 주문 정보 → [우회 주문 시작] / 원본 틀 번역: ③ 파일 + 가리기 → ④ 확인 → [번역 시작](layout_tl.js)
// - [폼에 불러오기](enterReprocessMode)는 텍스트 번역으로 바꾼다(index.html)
// - 번역 방향 기본값 없음: 방향을 안 고르면 [우회 주문 시작]·[번역 시작] 둘 다 꺼짐 + 버튼 옆에 이유 한 줄
// - 문서 언어: 서버(lang_guard.js)가 409 lang_mismatch 를 주면 경고 + 체크칸. 체크해야 버튼이 켜지고, 다시 누르면 langConfirmed=true 로 보낸다
(function () {
  var KEY = 'iumm.bpMode';
  var mode = '';
  function $(id) { return document.getElementById(id); }
  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function show(id, on) { var el = $(id); if (el) el.style.display = on ? '' : 'none'; }
  function direction() { return ($('bp-direction') || {}).value || ''; }

  window.bpMode = function () { return mode; };
  window.bpSetMode = function (m) {
    mode = m === 'text' || m === 'layout' ? m : '';
    var w = $('bypass-wrap'); if (w) w.setAttribute('data-bp-mode', mode);
    ['text', 'layout'].forEach(function (k) {
      var b = $('bp-mode-' + k); if (!b) return;
      b.classList.toggle('on', mode === k); b.setAttribute('aria-pressed', mode === k ? 'true' : 'false');
    });
    show('bp-mode-hint', !mode);
    show('bp-body', !!mode);
    show('bp-text-mode', mode === 'text');
    show('bp-layout-mode', mode === 'layout');
    show('bp-layout-internal', mode === 'layout');
    var st = store(); try { if (st) { if (mode) st.setItem(KEY, mode); else st.removeItem(KEY); } } catch (e) { /* 저장 못 해도 화면은 그대로 */ }
    window.bpGateRefresh();
    try { document.dispatchEvent(new CustomEvent('bp-mode', { detail: { mode: mode } })); } catch (e) { /* 옛 브라우저 */ }
  };

  // ── 문서 언어 경고(텍스트 번역) ──
  function langLabel(s) { return s === '한글' ? '한글' : (s || '알 수 없음') + ' 문자'; }
  window.bpLangMessage = function (d) {
    return d.message || ('올린 문서 글자는 ' + langLabel(d.detected) + '인데, 번역 방향의 원문은 ' + (d.sourceLang || direction().split('→')[0].trim()) + '(' + d.expected + ' 문자)입니다. 번역 방향을 확인하세요.');
  };
  function langShown() { var w = $('bp-lang-warn'); return !!(w && w.style.display !== 'none'); }
  window.bpLangShow = function (d) {
    var w = $('bp-lang-warn'); if (!w) return;
    $('bp-lang-msg').textContent = window.bpLangMessage(d || {});
    $('bp-lang-ok').checked = false;
    w.style.display = '';
    try { w.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* 무시 */ }
    window.bpGateRefresh();
  };
  window.bpLangHide = function () {
    var w = $('bp-lang-warn'); if (!w || w.style.display === 'none') return;
    w.style.display = 'none'; $('bp-lang-ok').checked = false;
    window.bpGateRefresh();
  };
  window.bpLangConfirmed = function () { return langShown() && !!($('bp-lang-ok') || {}).checked; };

  /** [우회 주문 시작] 켜고 끄기 + 이유 한 줄. 보내는 중(⏳)에는 손대지 않는다 */
  window.bpGateRefresh = function () {
    var btn = $('btn-bp-submit'), why = $('bp-submit-reason');
    if (!btn) return;
    var reason = !direction() ? '번역 방향을 고르세요 — ② 번역 설정'
      : langShown() && !$('bp-lang-ok').checked ? '문서 언어를 확인하세요 — 위 체크칸을 체크하면 켜집니다' : '';
    if (!/⏳/.test(btn.textContent)) btn.disabled = !!reason;
    if (why) { why.textContent = reason; why.style.display = reason ? '' : 'none'; }
  };

  function init() {
    var d = $('bp-direction');
    if (d) d.addEventListener('change', function () { window.bpLangHide(); window.bpGateRefresh(); });
    var t = $('bp-text');
    if (t) t.addEventListener('input', function () { if (langShown()) window.bpLangHide(); });
    var ok = $('bp-lang-ok');
    if (ok) ok.addEventListener('change', window.bpGateRefresh);
    // 재실행 모드가 이미 켜졌으면(임시 저장 복원) 텍스트 번역, 아니면 기억한 방식
    var st = store(), saved = '';
    try { saved = (st && st.getItem(KEY)) || ''; } catch (e) { saved = ''; }
    if (window._bpReprocessOrderId) saved = 'text';
    window.bpSetMode(saved);
  }
  // bp_draft.js 복원(DOMContentLoaded)이 끝난 뒤에 — 이 파일은 bp_draft.js 뒤에 싣는다
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
