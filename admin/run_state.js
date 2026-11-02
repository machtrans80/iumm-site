// 관리자 '번역 중' 표시 (2026-11-02)
// - 주문 목록·번역실패 탭·주문 상세: 파이프라인 하트비트가 살아 있는 주문(서버 running)은 '번역 중 · <파이프라인단계>' 파란 배지
// - 주문 상세 위쪽 한 줄 + 번역 칸 저장·납품 버튼 잠금 / 관리자 주문은 '본문 자동 삭제 예정: <월> <일>'(서버가 준 실제 04:00 정리 날)
// - 화면에 번역 중 주문이 있으면 30초마다 상태만 다시 읽고(/api/admin/orders/run-state — 본문 없음),
//   끝나면 그 목록을 새로 고치고 '번역 끝: <주문번호> (점수)' 알림
// - 우회 번역 [번역 시작]·[재실행] 직후 runWatchAdd 로 그 자리에서 바로 '번역 중'
// index.html 의 adminFetch · showToast · selectOrder · loadOrders · loadFailedOrders · currentTab 을 쓴다.
(function () {
  var POLL_MS = 30000;
  var watch = {};          // orderId → { orderNumber, stage }
  var timer = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** 단계 표시 — 'V3:⑧-2 최종 편집' → '⑧-2 최종 편집' */
  function stageLabel(s) { return String(s || '').replace(/^V\d:\s*/, '').replace(/^V\d /, '') || '시작'; }

  window.runBadgeHtml = function (o) {
    if (!o || !o.running) return '';
    return ' <span class="st st-run" data-run="' + esc(o.orderId) + '">번역 중 · ' + esc(stageLabel(o.pipelineStage)) + '</span>';
  };

  /** 화면에 있는 주문 중 번역 중인 것을 감시 목록에 */
  function collect() {
    [].concat(window._orders || [], window._failedOrders || []).forEach(function (o) {
      if (o && o.running) watch[o.orderId] = { orderNumber: o.orderNumber, stage: o.pipelineStage };
    });
    if (window.selectedOrder && window.selectedOrder.running) watch[selectedOrder.orderId] = { orderNumber: selectedOrder.orderNumber, stage: selectedOrder.pipelineStage };
  }
  /** 우회 번역 [번역 시작]·[재실행] 직후 — 그 자리에서 바로 '번역 중' */
  window.runWatchAdd = function (orderId, orderNumber) {
    if (!orderId) return;
    watch[orderId] = { orderNumber: orderNumber || '', stage: '시작' };
    [].concat(window._orders || [], window._failedOrders || []).forEach(function (o) { if (o.orderId === orderId) { o.running = true; o.pipelineStage = o.pipelineStage || '시작'; } });
    var r = $('bp-result-run'); if (r) { r.innerHTML = window.runBadgeHtml({ orderId: orderId, running: true, pipelineStage: '시작' }); r.style.display = ''; }
    schedule();
  };

  function schedule() {
    if (timer || !Object.keys(watch).length) return;
    timer = setTimeout(function () { timer = null; poll(); }, POLL_MS);
  }
  async function poll() {
    var ids = Object.keys(watch);
    if (!ids.length) return;
    var res = await adminFetch('/api/admin/orders/run-state?ids=' + encodeURIComponent(ids.join(','))).catch(function () { return null; });
    var ended = [];
    ((res && res.orders) || []).forEach(function (s) {
      var w = watch[s.orderId]; if (!w) return;
      if (s.running) {
        w.stage = s.pipelineStage;
        document.querySelectorAll('[data-run="' + s.orderId + '"]').forEach(function (el) { el.textContent = '번역 중 · ' + stageLabel(s.pipelineStage); });
        [].concat(window._orders || [], window._failedOrders || []).forEach(function (o) { if (o.orderId === s.orderId) o.pipelineStage = s.pipelineStage; });
      } else { ended.push(s); delete watch[s.orderId]; }
    });
    ended.forEach(function (s) { showToast('번역 끝: ' + (s.orderNumber || s.orderId) + (s.aiScore != null ? ' (' + s.aiScore + '점)' : ''), 'success'); });
    if (ended.length) refreshEnded(ended);
    schedule();
  }
  /** 끝난 주문: 보고 있던 목록을 새로 고치고, 열려 있던 주문이면 다시 연다 */
  async function refreshEnded(ended) {
    var openId = window.selectedOrder && selectedOrder.orderId;
    var reopen = ended.some(function (s) { return s.orderId === openId; });
    if (currentTab === 'failed' && window.loadFailedOrders) await loadFailedOrders();
    else if (window.loadOrders && (currentTab === 'ai_premium' || currentTab === 'premium_plus')) {
      if (reopen) window._holdOpenId = openId;
      await loadOrders();
    }
    var r = $('bp-result-run'); if (r && ended.some(function (s) { return r.innerHTML.indexOf(s.orderId) >= 0; })) r.style.display = 'none';
    collect(); schedule();
  }

  /** 주문 상세: 번역 중 한 줄 + 잠금 · 관리자 주문 자동 삭제 예정일 */
  window.runShowOrder = function (order) {
    var bar = $('run-line'), del = $('autodel-line');
    var running = !!(order && order.running);
    if (bar) {
      bar.innerHTML = running ? '<i class="ti ti-loader-2" style="font-size:12px;vertical-align:-1px;margin-right:4px"></i>번역 중입니다 — 끝나면 자동으로 새로 고칩니다' + window.runBadgeHtml(order) : '';
      bar.style.display = running ? '' : 'none';
    }
    ['btn-save-draft', 'btn-deliver'].forEach(function (id) { var b = $(id); if (b) { b.disabled = running; b.title = running ? '번역 중에는 잠깁니다' : ''; b.style.opacity = running ? '0.45' : ''; } });
    var ta = $('panel-translation'); if (ta) ta.readOnly = running;
    if (del) {
      var at = order && order.autoDeleteAt ? new Date(order.autoDeleteAt) : null;
      del.textContent = at ? '본문 자동 삭제 예정: ' + (at.getMonth() + 1) + '월 ' + at.getDate() + '일' : '';
      del.style.display = at ? '' : 'none';
    }
    if (running) { collect(); schedule(); }
  };
  window.runPollNow = poll;   // 시험용(30초 기다리지 않고 한 번)
  /** 목록을 그린 뒤 — 번역 중 주문 감시 시작 */
  window.runListRendered = function () { collect(); schedule(); };
})();
