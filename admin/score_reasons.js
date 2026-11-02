// 주문 상세 '채점 근거' (2026-11-02) — 점수 아래 [채점 근거 보기] 펼침
//   ① 감점 요약 ② 채점기 지적(문단 · 이유 · 수정 전 → 수정안 · 결과) ③ 고친 곳(⑧-2 편집 · ⑨ 반영·재작업 · ⑧ 재번역 전/후)
//   ④ 교차 검수·역확인 지적 ⑤ 문장 수가 다른 문단
//   기록: 주문 AI품질상세 v3.score(changes·deductions) · v3.trace (pipeline_v3.js)
//   문단 번호·'수정 전' 글을 누르면 번역문의 그 자리로 이동·파랑 강조(index.html adminJumpToText = 검색 이동 재사용)
//   예전 주문(trace 없음)은 저장된 이유 목록만 + "자세한 기록 없음" — 문단 번호가 화면 문단과 다를 수 있어 이유마다 검색어 입력칸
(function () {
  var J = [];   // 이동 후보 글 목록(버튼 번호 → 후보)
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function dim(t) { return '<span class="sr-dim">' + t + '</span>'; }
  function jumpBtn(label, cands, cls) {
    J.push(cands);
    return '<button type="button" class="' + (cls || 'sr-id') + '" data-j="' + (J.length - 1) + '" title="번역문에서 이 자리로">' + esc(label) + '</button>';
  }
  function badge(result, why) {
    var c = result === '반영' ? 'sr-b-ok' : result === '재작업' ? 'sr-b-re' : 'sr-b-no';
    return '<span class="sr-badge ' + c + '">' + esc(result || '—') + '</span>' + (why ? ' ' + dim(esc(why)) : '');
  }
  function ba(before, after, cands) {
    return '<div class="sr-ba">' + (before ? jumpBtn(before, cands, 'sr-before') : dim('(없음)')) + ' <span class="sr-arrow">→</span> <span class="sr-after">' + esc(after || '') + '</span></div>';
  }
  function sec(no, title, n, body) {
    return '<div class="sr-sec"><div class="sr-h">' + no + ' ' + title + (n != null ? ' ' + dim('(' + n + ')') : '') + '</div>' + body + '</div>';
  }
  function none(t) { return '<div class="sr-none">' + (t || '없음') + '</div>'; }

  window.srShow = function (order) {
    var el = document.getElementById('score-reasons'); if (!el) return;
    J = [];
    var v3 = order && order.aiQualityDetail && order.aiQualityDetail.v3;
    var sc = v3 && v3.score;
    if (!sc) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var t = v3.trace || null;
    var changes = Array.isArray(sc.changes) ? sc.changes : [];
    var rich = !!t && changes.every(function (c) { return c && c.result; });
    var h = '';
    // ① 감점 요약
    var ded = Array.isArray(sc.deductions) ? sc.deductions : [];
    h += sec('①', '감점 요약', null, ded.length
      ? '<table class="sr-tbl">' + ded.map(function (d) { return '<tr><td class="sr-k">' + esc(d['분류']) + '</td><td class="sr-pt">−' + esc(d['점수']) + '</td><td>' + esc(d['이유']) + '</td></tr>'; }).join('') + '</table>'
        + dim('합계 −' + ded.reduce(function (a, d) { return a + (Number(d['점수']) || 0); }, 0) + (sc.total != null ? ' = 100 − ' + sc.total : ''))
      : none(rich ? '감점 없음' : '감점 요약 없음(예전 주문)'));
    // ② 채점기 지적
    if (rich) {
      h += sec('②', '채점기 지적', changes.length, changes.length ? changes.map(function (c) {
        var cands = c.result === '반영' ? [c.after, c.before] : [c.before, c.after];
        return '<div class="sr-item">' + (c.id ? jumpBtn(c.id, cands) : dim('문단 ?')) + ' ' + esc(c.reason) + ' ' + badge(c.result, c.why) + ba(c.before, c.after, cands) + '</div>';
      }).join('') : none());
    } else {
      h += sec('②', '채점기 지적', changes.length, '<div class="sr-note">자세한 기록 없음 — 저장된 이유 목록만 보여 줍니다. 문단 번호는 화면 문단과 다를 수 있어 검색어로 찾아 주세요.</div>' +
        (changes.length ? changes.map(function (c, i) {
          return '<div class="sr-item sr-old">' + dim('단락 ' + esc(c.paragraph != null ? c.paragraph : '?')) + ' ' + esc(c.reason) +
            '<div class="sr-find"><input type="text" class="sr-q" id="sr-q-' + i + '" placeholder="번역문에서 찾을 말" aria-label="번역문에서 찾을 말"><button type="button" class="sr-go" data-q="sr-q-' + i + '">찾기</button></div></div>';
        }).join('') : none()));
    }
    if (rich) {
      // ③ 고친 곳
      var edits = t.edits || [], fixed = changes.filter(function (c) { return c.result === '반영' || c.result === '재작업'; }), re = t.retranslated || [];
      h += sec('③', '고친 곳', edits.length + fixed.length + re.length,
        '<div class="sr-sub">⑧-2 최종 편집 ' + dim(edits.length + '문단') + '</div>' + (edits.length ? edits.map(function (e) { return '<div class="sr-item">' + jumpBtn(e.id, [e.after, e.before]) + ba(e.before, e.after, [e.after, e.before]) + '</div>'; }).join('') : none()) +
        '<div class="sr-sub">⑨ 채점 반영·재작업 ' + dim(fixed.length + '곳') + '</div>' + (fixed.length ? fixed.map(function (c) { return '<div class="sr-item">' + jumpBtn(c.id || '?', [c.after, c.before]) + ' ' + badge(c.result) + ba(c.before, c.after, [c.after, c.before]) + '</div>'; }).join('') : none()) +
        '<div class="sr-sub">⑧ 코드 점검으로 다시 번역 ' + dim(re.length + '문단') + '</div>' + (re.length ? re.map(function (r) { return '<div class="sr-item">' + jumpBtn(r.id, [r.after, r.before]) + ' ' + dim(esc(r.reasons)) + ba(r.before, r.after, [r.after, r.before]) + '</div>'; }).join('') : none()));
      // ④ 교차 검수·역확인
      var rv = t.review || [], bk = t.back || [];
      h += sec('④', '교차 검수·역확인 지적', rv.length + bk.length,
        '<div class="sr-sub">교차 검수 ' + dim(rv.length + '건') + '</div>' + (rv.length ? rv.map(function (r) {
          return '<div class="sr-item">' + jumpBtn(r.id, [r.at]) + ' <span class="sr-badge sr-b-re">' + esc(r.severity) + '</span> ' + esc(r.type) + ' — ' + esc(r.problem) +
            '<div class="sr-q-line">' + dim('원문 인용') + ' “' + esc(r.quote) + '”</div><div class="sr-q-line">' + dim('반론') + ' ' + esc(r.rebut) + ' · ' + dim('결과') + ' ' + esc(r.result) + '</div></div>';
        }).join('') : none()) +
        '<div class="sr-sub">역확인 ' + dim(bk.length + '건') + '</div>' + (bk.length ? bk.map(function (b) {
          return '<div class="sr-item">' + jumpBtn(b.id, [b.at]) + ' ' + esc(b.kind) + ' — ' + esc(b.problem) + '<div class="sr-q-line">' + dim('원문 인용') + ' “' + esc(b.quote) + '”</div></div>';
        }).join('') : none()));
      // ⑤ 문장 수
      var sm = t.sentenceMismatch || [];
      h += sec('⑤', '문장 수가 원문과 다른 문단', sm.length, sm.length ? sm.map(function (x) { return '<div class="sr-item">' + jumpBtn(x.id, [x.at]) + ' ' + esc(x.why) + '</div>'; }).join('') : none());
      if (t.trimmed) h += '<div class="sr-note">기록이 길어 일부 목록은 앞부분만 저장했습니다.</div>';
    }
    el.innerHTML = '<details id="sr-details" class="sr"><summary>채점 근거 보기' + (rich ? '' : ' ' + dim('(예전 주문 — 이유 목록만)')) + '</summary><div class="sr-body">' + h +
      '<div class="sr-msg" id="sr-msg" role="status"></div></div></details>';
    el.style.display = '';
  };

  function msg(t) { var m = document.getElementById('sr-msg'); if (m) m.textContent = t || ''; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#score-reasons [data-j]');
    if (b) {
      var cands = J[Number(b.getAttribute('data-j'))] || [];
      msg('');
      if (!(window.adminJumpToText && adminJumpToText(cands))) msg('번역문에서 그 글을 찾지 못했습니다 — 이미 고쳐졌을 수 있습니다. 위 검색칸에 다른 말로 찾아 보세요.');
      return;
    }
    var g = e.target.closest && e.target.closest('#score-reasons .sr-go');
    if (g) {
      var inp = document.getElementById(g.getAttribute('data-q'));
      var q = inp ? inp.value.trim() : '';
      if (!q) { if (inp) inp.focus(); return; }
      msg('');
      if (!(window.adminJumpToText && adminJumpToText([q]))) msg('번역문에서 "' + q + '"을(를) 찾지 못했습니다.');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('sr-q')) {
      e.preventDefault();
      var g = e.target.parentNode.querySelector('.sr-go'); if (g) g.click();
    }
  });

  var css = document.createElement('style');
  css.textContent = [
    '#score-reasons{margin-top:10px}',
    '.sr summary{cursor:pointer;font-size:12px;font-weight:600;color:#a9cdff;padding:6px 0;list-style-position:inside}',
    '.sr-body{padding:6px 0 4px;font-size:12px;color:rgba(255,255,255,0.78);line-height:1.6}',
    '.sr-sec{margin:8px 0 12px;padding:8px 10px;border:1px solid rgba(74,144,226,0.22);border-radius:6px;background:rgba(74,144,226,0.05)}',
    '.sr-h{font-weight:700;color:#a9cdff;margin-bottom:6px}',
    '.sr-sub{margin:8px 0 4px;font-weight:600;color:rgba(169,205,255,0.85)}',
    '.sr-dim{color:rgba(255,255,255,0.4)}',
    '.sr-none{color:rgba(255,255,255,0.35)}',
    '.sr-note{color:rgba(169,205,255,0.8);margin:2px 0 6px}',
    '.sr-item{padding:5px 0;border-top:1px dashed rgba(255,255,255,0.08)}',
    '.sr-item:first-of-type{border-top:none}',
    '.sr-tbl{border-collapse:collapse;width:100%}',
    '.sr-tbl td{padding:3px 6px;vertical-align:top;border-top:1px solid rgba(255,255,255,0.06)}',
    '.sr-k{white-space:nowrap;width:1%;color:#a9cdff}.sr-pt{white-space:nowrap;width:1%;text-align:right;color:#7fb4ff;font-weight:600}',
    '.sr-id{background:rgba(31,79,209,0.25);border:1px solid rgba(74,144,226,0.5);color:#cfe1ff;border-radius:3px;padding:0 6px;font-size:11px;cursor:pointer;font-family:inherit}',
    '.sr-id:hover,.sr-before:hover{background:rgba(31,79,209,0.45)}',
    '.sr-ba{margin-top:3px}',
    '.sr-before{background:rgba(74,144,226,0.1);border:1px solid rgba(74,144,226,0.3);color:rgba(255,255,255,0.85);border-radius:3px;padding:1px 6px;font-size:12px;cursor:pointer;text-align:left;font-family:inherit;max-width:100%;white-space:normal;word-break:break-word}',
    '.sr-arrow{color:#7fb4ff}.sr-after{color:#dbe8ff;word-break:break-word}',
    '.sr-badge{display:inline-block;padding:0 6px;border-radius:9px;font-size:11px;font-weight:600}',
    '.sr-b-ok{background:rgba(31,79,209,0.55);color:#fff}.sr-b-re{background:rgba(74,144,226,0.28);color:#cfe1ff}.sr-b-no{background:rgba(157,183,245,0.12);color:rgba(207,225,255,0.75);border:1px solid rgba(157,183,245,0.3)}',
    '.sr-q-line{margin-top:2px;word-break:break-word}',
    '.sr-find{display:flex;gap:6px;margin-top:4px}',
    '.sr-q{flex:1;min-width:0;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(74,144,226,0.35);border-radius:4px;color:#fff;font-size:12px;font-family:inherit}',
    '.sr-go{padding:4px 10px;background:rgba(31,79,209,0.35);border:1px solid rgba(74,144,226,0.5);color:#cfe1ff;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit}',
    '.sr-msg{color:#a9cdff;min-height:1em}',
  ].join('\n');
  document.head.appendChild(css);
})();
