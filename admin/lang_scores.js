// 언어별 점수판 (2026-11-01) — 메뉴 '기록 › 언어별 점수판'
// 서버(iumm-pipeline): GET /api/admin/v3-scores
//   → { ok, rows:[{pair,orders,scored,unscored,avg,min,last7:{orders,avg},watch}], total:{orders,scored,avg}, watchBelow }
// 전 언어 V3 운영(2026-11-01) 뒤 언어 방향별 'Claude 채점'만 모은다. GPT 최종 검수 점수와 섞지 않는다.
// 평균이 watchBelow(90) 미만인 방향은 파란 계열로 강조(빨강·초록 안 씀). 관리자가 숨긴 주문은 빠진다.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sc(n) { return n == null ? '—' : String(n); }

  window.loadLangScores = async function () {
    var tb = $('ls-tbody');
    tb.innerHTML = '<tr class="empty-row"><td colspan="6">불러오는 중…</td></tr>';
    try {
      var r = await fetch(API_BASE + '/api/admin/v3-scores', { headers: { 'Authorization': 'Bearer ' + adminToken() } });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      var w = Number(j.watchBelow) || 90, t = j.total || {};
      $('ls-total').textContent = 'V3 주문 ' + (t.orders || 0) + '건 · Claude 채점 ' + (t.scored || 0) + '건 · 전체 평균 ' + sc(t.avg);
      $('ls-watch-note').textContent = '평균 ' + w + '점 미만 방향은 파란색으로 표시합니다.';
      var rows = j.rows || [];
      if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="6">V3 주문이 아직 없습니다</td></tr>'; return; }
      tb.innerHTML = rows.map(function (x) {
        var l7 = x.last7 || {};
        return '<tr class="' + (x.watch ? 'ls-watch' : '') + '">'
          + '<td>' + esc(x.pair) + (x.watch ? ' <span class="ls-flag">평균 ' + w + ' 미만</span>' : '') + '</td>'
          + '<td>' + (x.orders || 0) + '</td>'
          + '<td class="ls-avg">' + sc(x.avg) + '</td>'
          + '<td>' + sc(x.min) + '</td>'
          + '<td>' + (l7.orders ? sc(l7.avg) + ' (' + l7.orders + '건)' : '—') + '</td>'
          + '<td>' + (x.unscored || 0) + '</td>'
          + '</tr>';
      }).join('');
    } catch (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="6">불러오지 못했습니다: ' + esc(e.message) + '</td></tr>';
    }
  };
})();
