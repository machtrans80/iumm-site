// 크레딧 사용 기록 (2026-10-31) — 메뉴 '기록 › 크레딧 사용 기록'
// 서버(iumm-pipeline): GET /api/admin/credit-budget
//   → { ok, cap, spent, remaining, outsideCap, expires, rows:[{at,task,model,batch,calls,inTok,outTok,usd,inCap,memo}] }
// inCap=false 인 줄은 상한(US$50)을 정하기 전 사용분이라 합계에서 뺀다 → '상한 이전(합계 제외)' 표시.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function usd(n) { return '$' + (Number(n) || 0).toFixed(2); }
  function num(n) { return (Number(n) || 0).toLocaleString(); }
  function when(s) { if (!s) return '—'; var d = new Date(s); return isNaN(d) ? esc(s) : d.toLocaleString('ko-KR', { hour12: false }); }

  window.loadCreditBudget = async function () {
    var tb = $('credit-tbody');
    tb.innerHTML = '<tr class="empty-row"><td colspan="9">불러오는 중…</td></tr>';
    try {
      var r = await fetch(API_BASE + '/api/admin/credit-budget', { headers: { 'Authorization': 'Bearer ' + adminToken() } });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      var cap = Number(j.cap) || 50;
      $('credit-spent').textContent = usd(j.spent);
      $('credit-remaining').textContent = usd(j.remaining) + ' / $' + (cap % 1 === 0 ? cap.toFixed(0) : cap.toFixed(2));
      $('credit-expires').textContent = j.expires || '—';
      $('credit-note').textContent = Number(j.outsideCap) ? '상한을 정하기 전 사용 ' + usd(j.outsideCap) + ' 는 합계에서 뺐습니다.' : '';
      var rows = j.rows || [];
      if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="9">기록이 없습니다</td></tr>'; return; }
      tb.innerHTML = rows.map(function (x) {
        var out = x.inCap === false;
        return '<tr class="' + (out ? 'credit-out' : '') + '">'
          + '<td>' + when(x.at) + '</td>'
          + '<td>' + esc(x.task) + (out ? ' <span class="st st-check">상한 이전(합계 제외)</span>' : '') + '</td>'
          + '<td>' + esc(x.model) + '</td>'
          + '<td>' + (x.batch ? '배치' : '—') + '</td>'
          + '<td>' + num(x.calls) + '</td>'
          + '<td>' + num(x.inTok) + '</td>'
          + '<td>' + num(x.outTok) + '</td>'
          + '<td>' + usd(x.usd) + '</td>'
          + '<td>' + esc(x.memo) + '</td>'
          + '</tr>';
      }).join('');
    } catch (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="9">불러오지 못했습니다: ' + esc(e.message) + '</td></tr>';
    }
  };
})();
