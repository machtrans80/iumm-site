// 확인필요(납품 보류) 주문 — 사유 요약·문단 표시·납품 탭 목록에 함께 보이기
// index.html 의 loadOrders · renderOrderTable · selectOrder · loadFailedOrders 가 부른다.
(function () {
  var BLUE = '#1F4FD1', BLUE_LIGHT = '#9DB7F5';
  var _e = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  // 코드 검사 사유 → 짧은 이름 (pipeline_v2.js codeCheck 문구)
  var KINDS = [
    [/^지정 용어 미준수/, '지정 용어'],
    [/^숫자 누락/, '숫자 누락'],
    [/^번역 없음/, '문단 누락'],
    [/^길이 비율/, '길이 이상'],
    [/^한글 \d+자 남음/, '한글 남음'],
    [/^라틴 낱말 남음/, '라틴 낱말 남음'],
    [/^발음만 옮긴/, '발음만 옮김'],
    [/^원문 문자/, '원문 문자 남음'],
    [/^금액 중복/, '금액 중복'],
    [/제출 표기/, '제출 국가 표기'],
    [/^보호 표식/, '보호 표식 사라짐'],
    [/^오류 문구/, '오류 문구'],
    [/^조각 이음새/, '이음새 중복'],
    [/괄호|병기/, '괄호·병기'],
  ];
  var kindOf = function (why) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i][0].test(why)) return KINDS[i][1];
    return '기타';
  };

  /** 확인필요 주문의 사유를 나눈다. 확인필요가 아니면 null.
   *  반환 { credit, items:[{text, id?, kind}], ids:[P…], counts:{이름:건수}, label } */
  window.holdInfo = function (o) {
    if (!o || o.orderStatus !== '확인필요') return null;
    // 앞에 붙은 '[관리자 확인 후 해제 …] ' · '[이어서 처리 …] ' 표시는 떼고 본다
    var raw = String(o.failReason || '').replace(/^(\[[^\]]*\]\s*)+/, '').replace(/^확인필요:\s*/, '');
    var credit = /^API 잔액 부족/.test(raw);
    var items = [], ids = [], counts = {};
    var addId = function (id) { if (ids.indexOf(id) < 0) ids.push(id); };
    raw.split(/\n- /).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (line) {
      var m = line.match(/^V2 코드 검사 실패 (P\d{4}): ([\s\S]*)$/);
      if (m) {
        addId(m[1]);
        m[2].split(/; /).forEach(function (why) {
          var k = kindOf(why);
          counts[k] = (counts[k] || 0) + 1;
          items.push({ id: m[1], kind: k, text: why });
        });
        return;
      }
      var k = credit ? 'API 잔액 부족'
        : /번역 조각 .*실패/.test(line) ? '번역 조각 실패'
        : /번역 못 한 문단/.test(line) ? '번역 못 한 문단'
        : /교차 검수 못 한/.test(line) ? '교차 검수 누락'
        : /처리 중 오류/.test(line) ? '처리 중 멈춤' : '기타';
      counts[k] = (counts[k] || 0) + 1;
      (line.match(/P\d{4}/g) || []).slice(0, 2).forEach(addId);
      items.push({ kind: k, text: line });
    });
    var parts = Object.keys(counts).map(function (k) { return k + ' ' + counts[k] + '건'; });
    var idPart = ids.length ? ' · ' + ids.slice(0, 3).join(', ') + (ids.length > 3 ? ' 외 ' + (ids.length - 3) : '') : '';
    return { credit: credit, items: items, ids: ids, counts: counts,
      label: '확인필요' + (parts.length ? ' · ' + parts.join(', ') : '') + idPart };
  };

  /** 납품 탭(AI 프리미엄·프리미엄 플러스)에 함께 보일 확인필요 주문: 번역문이 있고 잔액 부족 정지가 아닌 것 */
  window.holdDeliverable = function (o, tab) {
    var h = holdInfo(o);
    if (!h || h.credit || !(o.gptFinalReview || o.aiTranslation)) return false;
    var pp = /플러스|premium_plus/i.test(o.plan || '');
    return tab === 'premium_plus' ? pp : tab === 'ai_premium' ? !pp : false;
  };

  window.holdTagHtml = function (o) {
    var h = holdInfo(o);
    if (!h) return '';
    return ' <span class="st st-check" title="' + _e(o.failReason || '') + '">' + _e(h.label) + '</span>';
  };

  // V2 문단 ID(P0001…) = 원문에서 빈 줄이 아닌 줄의 순번. 번역은 같은 줄 위치를 지킨다(pipeline_v2.js segment·assemble).
  function lineOf(text, id) {
    var n = Number(String(id).slice(1)), k = 0, lines = String(text || '').split('\n');
    for (var i = 0; i < lines.length; i++) if (lines[i].trim() && ++k === n) return i;
    return -1;
  }

  var _cur = null;   // { lines:[줄 번호], ids:{줄:ID} } — 지금 열린 확인필요 주문
  function paint(taId, ovId) {
    var ta = document.getElementById(taId), ov = document.getElementById(ovId);
    if (!ta || !ov || !_cur) return;
    ov.innerHTML = ta.value.split('\n').map(function (l, i) {
      return _cur.lines.indexOf(i) >= 0 ? '<mark class="hold-hit">' + (_e(l) || ' ') + '</mark>' : _e(l);
    }).join('\n') + (/\n$/.test(ta.value) ? '​' : '');   // 끝 빈 줄도 textarea 처럼 높이를 차지하게(아니면 스크롤이 덜 내려가 줄이 어긋난다)
    ov.classList.add('visible');
    // textarea 스크롤 막대 폭만큼 오른쪽을 비워 줄바꿈 위치를 맞춘다
    ov.style.paddingRight = '';
    var gap = ov.clientWidth - ta.clientWidth;
    if (gap > 0) ov.style.paddingRight = (parseFloat(getComputedStyle(ov).paddingRight) + gap) + 'px';
    ov.scrollTop = ta.scrollTop;
    if (!ta._holdSync) { ta._holdSync = true; ta.addEventListener('scroll', function () { if (_cur) ov.scrollTop = ta.scrollTop; }); }
  }
  /** 확인필요 문단 형광 — 검색을 닫거나 번역을 고치면 다시 칠한다 */
  window.holdApplyOverlay = function () {
    if (!_cur || (typeof _adminSearchActive !== 'undefined' && _adminSearchActive)) return;
    paint('panel-source', 'ov-src');
    // Diff 화면에서는 번역 칸 위 형광을 걷는다(Diff 글자와 줄이 다르다)
    if (typeof _adminDiffOn !== 'undefined' && _adminDiffOn) { var ov = document.getElementById('ov-tr'); if (ov) { ov.innerHTML = ''; ov.classList.remove('visible'); } }
    else paint('panel-translation', 'ov-tr');
  };

  /** selectOrder 끝에서 부른다: 위쪽 사유 상자 + 문단 형광 */
  window.holdShowPanel = function (o) {
    var box = document.getElementById('hold-notice');
    var h = holdInfo(o);
    _cur = null;
    if (!box) return;
    if (!h) {
      box.style.display = 'none'; box.innerHTML = '';
      // 앞서 연 확인필요 주문의 형광이 남지 않게
      if (typeof _clearAdminOverlays === 'function' && !(typeof _adminSearchActive !== 'undefined' && _adminSearchActive)) _clearAdminOverlays();
      return;
    }
    var src = o.originalText || '';
    var trg = (document.getElementById('panel-translation') || {}).value || '';
    var lines = [], idAt = {};
    h.ids.forEach(function (id) { var i = lineOf(src, id); if (i >= 0) { lines.push(i); idAt[id] = i; } });
    _cur = { lines: lines };
    var srcLines = src.split('\n'), trgLines = trg.split('\n');
    var rows = h.items.map(function (it) {
      var at = it.id != null ? idAt[it.id] : undefined;
      return '<div style="padding:7px 0;border-top:1px solid rgba(157,183,245,0.18)">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          (it.id ? '<button type="button" onclick="holdJump(\'' + it.id + '\')" style="padding:3px 9px;background:' + BLUE + ';color:#fff;border:0;border-radius:3px;cursor:pointer;font-size:11.5px;font-weight:600">' + it.id + ' 위치로</button>' : '') +
          '<span style="font-size:12.5px;color:#EEF3FB">' + _e(it.kind) + '</span>' +
          '<span style="font-size:12px;color:rgba(255,255,255,0.55)">' + _e(it.text) + '</span>' +
        '</div>' +
        (at !== undefined
          ? '<div style="margin-top:5px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.75)"><span style="color:' + BLUE_LIGHT + '">원문</span> ' + _e(srcLines[at]) +
            '<br><span style="color:' + BLUE_LIGHT + '">번역</span> ' + _e(trgLines[at] || '') + '</div>'
          : '') +
        '</div>';
    }).join('');
    box.innerHTML = '<div style="font-size:13.5px;font-weight:600;color:#EEF3FB">⏸ ' + _e(h.label) + '</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.55);margin:3px 0 6px">자동 검사가 아래 문단을 확인하라고 멈춘 주문입니다. 번역문은 저장돼 있어 이 화면에서 그대로 확인·수정·다운로드·최종 납품할 수 있습니다. 표시된 줄은 파란색으로 칠해 두었습니다.</div>' +
      rows;
    box.style.display = 'block';
    setTimeout(holdApplyOverlay, 60);
  };

  /** 확인필요 문단으로 이동 — 원문·번역 둘 다 그 줄을 골라 둔다 */
  window.holdJump = function (id) {
    if (!selectedOrder) return;
    var i = lineOf(selectedOrder.originalText || '', id);
    if (i < 0) return;
    [['panel-source', 'ov-src'], ['panel-translation', 'ov-tr']].forEach(function (p) {
      var ta = document.getElementById(p[0]);
      if (!ta) return;
      var lines = ta.value.split('\n'), start = 0;
      for (var k = 0; k < i && k < lines.length; k++) start += lines[k].length + 1;
      var end = start + (lines[i] || '').length;
      // 줄 위치로 스크롤: 그 앞부분만 넣은 같은 폭의 복제본 높이로 잰다(줄바꿈 반영)
      var probe = ta.cloneNode(false);
      probe.style.cssText = getComputedStyle(ta).cssText;
      probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.height = 'auto'; probe.style.minHeight = '0';
      probe.style.width = ta.clientWidth + 'px';
      probe.value = ta.value.slice(0, start);
      document.body.appendChild(probe);
      var y = probe.scrollHeight;
      document.body.removeChild(probe);
      ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
      if (p[0] === 'panel-translation') { ta.focus({ preventScroll: true }); ta.setSelectionRange(start, end); }
    });
    holdApplyOverlay();
  };

  var css = document.createElement('style');
  css.textContent = 'mark.hold-hit{background:rgba(157,183,245,0.32);color:rgba(0,0,0,0);border-radius:2px;box-shadow:0 0 0 1px rgba(157,183,245,0.6)}' +
    '#hold-notice{display:none;margin:0;padding:12px 18px;background:rgba(157,183,245,0.08);border-bottom:1px solid rgba(157,183,245,0.35)}';
  document.head.appendChild(css);
})();
