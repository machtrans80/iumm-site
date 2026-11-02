// 주문 상세 [이 번역 용어 추출 → 용어집 업데이트] (2026-11-02) — 우회 번역(ADMIN-)·고객 주문 공통
// 기준 글: 원문 + 저장된 최신 번역본(전문가검수완료본 → GPT최종검수본 → AI번역결과). 새 용어만 용어집에 넣는다.
// 누르면 예상 비용 → [확인] 해야 실행. 상태는 서버가 기억해서 새로고침해도 '처리 중'이 이어진다.
// index.html 의 selectOrder 가 otxShow(order) 를 부른다. 서버: GET/POST /api/admin/orders/:id/term-extract
(function () {
  var BLUE = '#1F4FD1', BLUE_LIGHT = '#9DB7F5';
  var _e = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var cur = null, info = null, timer = null;
  var BTN = 'padding:7px 14px;border-radius:4px;cursor:pointer;font-size:12.5px;font-family:\'Noto Sans KR\',sans-serif;';
  var btnMain = BTN + 'background:rgba(31,79,209,0.18);color:' + BLUE_LIGHT + ';border:1px solid ' + BLUE;
  var btnSub = BTN + 'background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.2)';
  var FIELD = { gaming: '게임', legal: '법률', medical: '의료·제약·의료관광', accounting: '회계·재무', patent: '특허·지식재산', academic: '학술·논문', manual: '매뉴얼·기술 문서', esg: 'ESG', general: '그 밖', criminal: '수사' };
  var BASIS = { '전문가검수완료본': '저장된 수정본', 'GPT최종검수본': '최종 검수본', 'AI번역결과': 'AI 번역 결과' };

  function box() { return document.getElementById('otx-box'); }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function msg(html) { var m = document.getElementById('otx-msg'); if (m) m.innerHTML = html; }
  function render() {
    var b = box(); if (!b || !cur) return;
    b.innerHTML = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">' +
      '<button type="button" id="otx-btn" style="' + btnMain + '" onclick="otxStart()"><i class="ti ti-book-2" style="font-size:12px;vertical-align:-1px;margin-right:4px"></i>이 번역 용어 추출 → 용어집 업데이트</button>' +
      '<span style="font-size:11.5px;color:rgba(255,255,255,0.45)">원문과 저장된 번역본에서 새 용어만 뽑아 용어집에 넣습니다</span></div>' +
      '<div id="otx-msg" role="status" aria-live="polite" style="margin-top:8px;font-size:12.5px;line-height:1.7;color:rgba(255,255,255,0.8)"></div>';
  }
  function setBusy(on) { var b = document.getElementById('otx-btn'); if (b) { b.disabled = on; b.style.opacity = on ? '0.5' : '1'; b.style.cursor = on ? 'default' : 'pointer'; } }
  function stopPoll() { if (timer) { clearTimeout(timer); timer = null; } }
  function poll() { stopPoll(); timer = setTimeout(function () { refresh(false); }, 6000); }

  function showJob(job) {
    if (!job) return;
    if (job.status === '처리 중') {
      setBusy(true);
      msg('<span style="color:' + BLUE_LIGHT + '">처리 중…</span> 시작 ' + when(job.startedAt) + (job.estimate != null ? ' · 예상 $' + Number(job.estimate).toFixed(3) : '') + ' <span style="color:rgba(255,255,255,0.45)">(몇 분 걸릴 수 있습니다. 새로고침해도 이어서 보입니다)</span>');
      poll(); return;
    }
    setBusy(false);
    var r = job.result || {};
    if (job.status === '완료' && r.counts) {
      var c = r.counts;
      msg('<strong style="color:' + BLUE_LIGHT + '">끝났습니다</strong> ' + when(job.finishedAt) + '<br>' +
        '새 용어 <strong>' + c.새용어 + '</strong>개 (승인 ' + c.승인 + ' / 후보 ' + c.후보 + ' / 충돌 ' + c.충돌 + ') · 건너뜀 ' + c.건너뜀 + '개 · 사용 금액 $' + Number(r.costUsd || 0).toFixed(3) +
        ' <button type="button" style="' + btnSub + ';margin-left:6px;padding:4px 10px" onclick="otxOpenTerms()">용어집에서 보기</button>');
    } else if (job.status === '멈춤') {
      msg('멈췄습니다: ' + _e(r.message || r.error || ''));
    } else if (job.status === '실패') {
      msg('실패했습니다: ' + _e(job.error || '') + ' <span style="color:rgba(255,255,255,0.45)">(다시 누르면 처음부터 합니다)</span>');
    }
  }
  async function refresh(first) {
    if (!cur) return;
    var id = cur.orderId;
    var r = await adminFetch('/api/admin/orders/' + id + '/term-extract').catch(function () { return null; });
    if (!cur || cur.orderId !== id || !r || !r.ok) return;
    info = r;
    if (r.job) showJob(r.job);
    else if (first && r.already) msg('이 번역본은 이미 반영됨 (' + when(r.already) + ')');
  }

  window.otxShow = function (order) {
    stopPoll(); cur = order; info = null;
    if (!box()) return;
    render(); refresh(true);
  };
  window.otxStart = async function () {
    if (!cur) return;
    // 화면에 저장 안 한 수정이 있으면 멈춤(기준은 저장된 번역본)
    var ta = document.getElementById('panel-translation');
    if (ta && typeof _lastSavedText === 'string' && ta.value !== _lastSavedText) { msg('<span style="color:' + BLUE_LIGHT + '">번역문에 저장하지 않은 수정이 있습니다. 먼저 저장하세요.</span>'); return; }
    setBusy(true); msg('예상 비용을 계산하는 중…');
    var r = await adminFetch('/api/admin/orders/' + cur.orderId + '/term-extract').catch(function (e) { return { ok: false, error: e.message }; });
    setBusy(false);
    if (!r.ok) { msg('불러오지 못했습니다: ' + _e(r.error || '')); return; }
    info = r;
    if (r.job && r.job.status === '처리 중') { showJob(r.job); return; }
    if (!r.usable) { msg(_e(r.message || '원문과 저장된 번역본이 있어야 합니다')); return; }
    var head = '기준: 원문 + ' + (BASIS[r.basis] || r.basis) + ' · ' + _e(r.pair) + ' · ' + (FIELD[r.field] || _e(r.field)) + ' · ' + _e(r.scope) + ' · ' + Number(r.chars || 0).toLocaleString() + '자<br>' +
      '예상 비용 <strong style="color:' + BLUE_LIGHT + '">$' + Number(r.estimate.usd).toFixed(3) + '</strong>' + (r.budget.unlimited ? '' : ' · 남은 예산 $' + Number(r.budget.remaining || 0).toFixed(2));
    if (!r.budget.ok) { msg(head + '<br><span style="color:' + BLUE_LIGHT + '">예산이 부족해 실행하지 않습니다.</span> ' + _e(r.budget.message || '')); return; }
    var again = r.already ? '<br><span style="color:' + BLUE_LIGHT + '">이미 반영됨 (' + when(r.already) + ')</span> — 같은 번역본입니다. 다시 돌릴까요?' : '';
    msg(head + again + '<div style="margin-top:8px;display:flex;gap:8px">' +
      '<button type="button" style="' + btnMain + '" onclick="otxConfirm(' + (r.already ? 'true' : 'false') + ')">' + (r.already ? '다시 돌리기' : '확인 — 실행') + '</button>' +
      '<button type="button" style="' + btnSub + '" onclick="otxCancel()">취소</button></div>');
  };
  window.otxCancel = function () { msg(''); };
  window.otxConfirm = async function (rerun) {
    if (!cur || !info) return;
    setBusy(true); msg('시작하는 중…');
    var r = await adminFetch('/api/admin/orders/' + cur.orderId + '/term-extract', { method: 'POST', body: JSON.stringify({ hash: info.hash, rerun: !!rerun }) }).catch(function (e) { return { ok: false, error: e.message }; });
    if (r.ok) { showJob(r.job); return; }
    setBusy(false);
    if (r.error === 'already') { info.already = r.already; otxStart(); return; }
    if (r.error === 'budget_exceeded') { msg('예산이 부족해 실행하지 않습니다. ' + _e(r.message || '')); return; }
    if (r.job) { showJob(r.job); return; }
    msg('시작하지 못했습니다: ' + _e(r.error || ''));
  };
  window.otxOpenTerms = function () {
    if (!cur) return;
    var n = (info && info.orderNumber) || cur.orderNumber, pair = info && info.pair;
    stopPoll();
    if (window.termsShowOrder) termsShowOrder(n, pair);
    setAdminMode('tx', true); switchTab('terms');
  };
})();
