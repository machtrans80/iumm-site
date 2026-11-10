// 납품 전 점검(2026-11-10) — 주문 상세 상자 · 목록 배지 · 검수/재채점 작업 진행(5분 넘는 검수)
//   기록: 주문 AI품질상세.preDelivery = { ok, at, by, items:[{no,label,ok,n,list:[{paragraph,kind}]}], held, reason, codeFixed, edited }
//   본문은 없다(문단 번호·항목·종류·개수만) — 화면에도 본문을 보이지 않는다.
//   index.html: selectOrder → pdShow(order) · 목록 → pdBadgeHtml(o) · 저장(Ctrl+S) → pdSaveNote(res) · 검수 → rvJobRun / rvJobResume
(function () {
  var BLUE = '#1F4FD1', BLUE_LIGHT = '#9DB7F5';
  var e = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var tm = function (iso) { try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (x) { return ''; } };
  var BY = { '승인': '검수 승인', 'V3': '번역 엔진(V3)', '저장': '관리자 저장' };

  /** 한 줄 요약 — '납품 전 점검: 통과' · '보류 3건(② 보호 값, ⑥ 지정 용어)' */
  window.pdLabel = function (pd) {
    if (!pd || !pd.items) return '';
    if (pd.ok) return '납품 전 점검: 통과';
    var bad = pd.items.filter(function (x) { return !x.ok; });
    var n = bad.reduce(function (a, x) { return a + (x.n || 0); }, 0);
    return '납품 전 점검: 보류 ' + n + '건(' + bad.map(function (x) { return x.no + ' ' + x.label; }).join(', ') + ')';
  };
  function pdOf(o) { return (o && o.aiQualityDetail && o.aiQualityDetail.preDelivery) || null; }
  window.pdOf = pdOf;

  /** 목록 배지 — 점검 기록이 있는 주문만 */
  window.pdBadgeHtml = function (o) {
    var pd = pdOf(o);
    if (!pd || !pd.items) return '';
    return ' <span class="pd-tag ' + (pd.ok ? 'pd-ok' : 'pd-hold') + '" title="' + e(pdLabel(pd) + (pd.at ? ' · ' + tm(pd.at) : '')) + '">' +
      (pd.ok ? '점검 통과' : '점검 보류 ' + pd.items.filter(function (x) { return !x.ok; }).reduce(function (a, x) { return a + (x.n || 0); }, 0)) + '</span>';
  };

  /** 항목 8개 표 — 상세·검수 승인 결과에 같이 쓴다 */
  window.pdItemsHtml = function (pd) {
    if (!pd || !pd.items) return '';
    return '<div class="pd-items">' + pd.items.map(function (it) {
      var where = !it.ok && it.list && it.list.length
        ? '<span class="pd-where">' + e(it.list.slice(0, 8).map(function (x) { return (x.paragraph != null ? '문단 ' + x.paragraph : '전체') + ' ' + x.kind; }).join(' · ')) + (it.n > 8 ? ' 외 ' + (it.n - 8) : '') + '</span>'
        : '';
      return '<div class="pd-row"><span class="pd-no">' + e(it.no) + '</span><span class="pd-name">' + e(it.label) + '</span>' +
        '<span class="pd-st ' + (it.ok ? 'pd-ok' : 'pd-hold') + '">' + (it.ok ? '통과' : '보류 ' + (it.n || 0) + '건') + '</span>' + where + '</div>';
    }).join('') + '</div>';
  };
  function metaLine(pd) {
    var bits = [];
    if (pd.by) bits.push(BY[pd.by] || pd.by);
    if (pd.at) bits.push(tm(pd.at));
    if (pd.blocks) bits.push('문단 ' + pd.blocks.src + '/' + pd.blocks.trg);
    if (pd.first && pd.first.n) bits.push('처음 ' + pd.first.n + '건');
    if (pd.codeFixed) bits.push('코드 고침 ' + pd.codeFixed);
    if (pd.edited) bits.push('문단 고침 ' + pd.edited);
    if (pd.editFailed) bits.push('고침 단계 실패');
    return bits.join(' · ');
  }

  /** 주문 상세 상자 */
  window.pdShow = function (order) {
    var box = document.getElementById('predelivery-box');
    if (!box) return;
    var pd = pdOf(order);
    if (!pd || !pd.items) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.className = 'pd-box ' + (pd.ok ? 'pd-box-ok' : 'pd-box-hold');
    box.innerHTML = '<details' + (pd.ok ? '' : ' open') + '><summary><span class="pd-head">' + e(pdLabel(pd)) + '</span> <span class="pd-meta">' + e(metaLine(pd)) + '</span></summary>' +
      pdItemsHtml(pd) +
      (pd.ok ? '' : '<div class="pd-note">남은 항목은 납품하지 않고 멈춰 두었습니다(확인필요 · 납품 보류). 번역문을 고쳐 저장(Ctrl+S)하면 다시 점검하고, 통과하면 납품대기로 돌아갑니다.</div>') +
      '</details>';
    box.style.display = '';
  };

  /** 저장(Ctrl+S) 응답 → 상태 글자 · 상세 상자 */
  window.pdSaveNote = function (res) {
    var pd = res && res.preDelivery;
    if (!pd) return '';
    if (window.selectedOrder) {
      selectedOrder.aiQualityDetail = Object.assign({}, selectedOrder.aiQualityDetail || {}, { preDelivery: pd });
      pdShow(selectedOrder);
    }
    return pd.ok ? '납품 전 점검 통과' + (pd.codeFixed ? '(코드 고침 ' + pd.codeFixed + ')' : '') : '납품 전 점검 보류 ' + pd.items.filter(function (x) { return !x.ok; }).reduce(function (a, x) { return a + (x.n || 0); }, 0) + '건';
  };

  // ── 검수·재채점 작업(5분 넘는 검수) — 요청은 바로 작업 번호로 끝나고 화면이 진행을 묻는다 ──────────
  var JOB_KEY = 'iumm_review_job_v1';
  function jobSaved() { try { return JSON.parse(localStorage.getItem(JOB_KEY) || 'null'); } catch (x) { return null; } }
  function jobSave(j) { try { if (j) localStorage.setItem(JOB_KEY, JSON.stringify(j)); else localStorage.removeItem(JOB_KEY); } catch (x) { /* 저장 못 해도 진행은 그대로 */ } }
  window.rvJobSaved = jobSaved;
  window.rvJobProgressText = function (job) {
    var p = (job && job.progress) || {};
    var sec = job && job.startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(job.startedAt)) / 1000)) : 0;
    var mm = Math.floor(sec / 60), ss = sec % 60;
    return (job && job.kind || '검수') + ' 진행 중 — ' + (p.label || '') + ' · Claude ' + (p.calls || 0) + (p.maxCalls ? '/' + p.maxCalls : '') + '회' +
      (p.part ? ' · ' + p.part : '') + (p.usd ? ' · $' + Number(p.usd).toFixed(2) : '') + ' · ' + mm + '분 ' + (ss < 10 ? '0' : '') + ss + '초' +
      ' (새로 고쳐도 이어서 봅니다)';
  };
  async function getJob(q) {
    var r = await authFetch(API_BASE + '/api/admin/review-job?' + q, { headers: { 'Authorization': 'Bearer ' + adminToken() } });
    var j = null; try { j = await r.json(); } catch (x) { j = null; }
    return { status: r.status, data: j || {} };
  }
  /** 작업이 끝날 때까지 기다린다 → { status, data }(예전 동기 응답과 같은 꼴) · 서버가 다시 시작돼 작업을 잃으면 status 410 */
  async function waitJob(job, onProgress) {
    var miss = 0;
    for (;;) {
      await new Promise(function (r) { setTimeout(r, window.RV_JOB_POLL_MS || 4000); });
      var g;
      try { g = await getJob('id=' + encodeURIComponent(job.id)); } catch (x) { if (++miss > 30) return { status: 0, data: { ok: false, error: '진행을 확인하지 못했습니다: ' + x.message } }; continue; }
      if (g.status === 404) { jobSave(null); return { status: 410, data: { ok: false, error: g.data.error || '작업을 찾지 못했습니다', lost: true } }; }
      if (g.status !== 200 || !g.data.job) { if (++miss > 30) return { status: g.status, data: g.data }; continue; }
      miss = 0;
      var j = g.data.job;
      if (j.status === '진행') { if (onProgress) onProgress(j); continue; }
      jobSave(null);
      return { status: j.code || (j.status === '완료' ? 200 : 500), data: j.result || { ok: false, error: '결과 없음' } };
    }
  }
  /** 검수·재채점 실행 — body 에 async:true 를 붙여 보내고 끝날 때까지 진행 표시 */
  window.rvJobRun = async function (path, body, onProgress) {
    var r = await adminPostJson(path, Object.assign({}, body, { async: true }));
    if (r.status === 409 && r.data.job) { if (onProgress) onProgress(r.data.job); jobSave({ id: r.data.job.id, orderNumber: r.data.job.orderNumber, kind: r.data.job.kind, path: path }); return waitJob(r.data.job, onProgress); }
    if (r.status !== 200 || !r.data.async || !r.data.job) return r;   // 예산 부족·오류 등은 바로 돌아옴(작업 아님)
    jobSave({ id: r.data.job.id, orderNumber: r.data.job.orderNumber, kind: r.data.job.kind, path: path });
    if (onProgress) onProgress(r.data.job);
    return waitJob(r.data.job, onProgress);
  };
  /** 주문을 불러올 때 — 그 주문의 작업이 진행 중이면 이어서 본다. 반환 null(없음) | { status, data, kind } */
  window.rvJobResume = async function (orderNumber, onProgress) {
    var s = jobSaved();
    var g;
    try { g = await getJob(s && s.orderNumber === orderNumber ? 'id=' + encodeURIComponent(s.id) : 'orderNumber=' + encodeURIComponent(orderNumber)); } catch (x) { return null; }
    if (g.status !== 200 || !g.data.job) { if (s && s.orderNumber === orderNumber) jobSave(null); return null; }
    var j = g.data.job;
    if (j.status !== '진행') { if (s && s.id === j.id) jobSave(null); return null; }   // 끝난 작업은 지난 검수 목록에 이미 있다
    jobSave({ id: j.id, orderNumber: j.orderNumber, kind: j.kind });
    if (onProgress) onProgress(j);
    var out = await waitJob(j, onProgress);
    out.kind = j.kind;
    return out;
  };

  var css = document.createElement('style');
  css.textContent =
    '.pd-tag{display:inline-block;margin-left:4px;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;white-space:nowrap}' +
    '.pd-tag.pd-ok{background:rgba(157,183,245,0.12);color:' + BLUE_LIGHT + ';border:1px solid rgba(157,183,245,0.35)}' +
    '.pd-tag.pd-hold{background:' + BLUE + ';color:#fff;border:1px solid ' + BLUE + '}' +
    '.pd-box{margin:0;padding:10px 18px;border-bottom:1px solid rgba(157,183,245,0.3);background:rgba(157,183,245,0.05)}' +
    '.pd-box-hold{background:rgba(31,79,209,0.12);border-bottom-color:rgba(31,79,209,0.6)}' +
    '.pd-box summary{cursor:pointer;list-style:revert;font-size:13px;color:#EEF3FB}' +
    '.pd-head{font-weight:600}.pd-meta{font-size:11.5px;color:rgba(255,255,255,0.5);margin-left:6px}' +
    '.pd-items{margin-top:8px;display:grid;gap:3px}' +
    '.pd-row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:12.5px;line-height:1.6}' +
    '.pd-no{color:' + BLUE_LIGHT + ';width:16px}.pd-name{color:rgba(255,255,255,0.8);min-width:130px}' +
    '.pd-st{font-weight:600;min-width:54px}.pd-st.pd-ok{color:' + BLUE_LIGHT + '}.pd-st.pd-hold{color:#fff;background:' + BLUE + ';padding:0 6px;border-radius:3px}' +
    '.pd-where{font-size:11.5px;color:rgba(255,255,255,0.55)}' +
    '.pd-note{margin-top:8px;font-size:12px;color:rgba(255,255,255,0.6)}';
  document.head.appendChild(css);
})();
