/* ══════════════════════════════════════════════════════════════
   번역공증 틀 자산 · 옛 번역 넣기 (관리자) — 2026-11-18
   ══════════════════════════════════════════════════════════════
   ★처리한 서류마다 틀(서류 × 양식 판)과 문구 기억이 쌓인다. 같은 서류가 다시 오면
     틀·기억으로 채우고 남은 칸만 Opus 로 보낸다 → 쓸수록 Opus 칸·비용이 준다.
   ★틀 '후보'는 대표가 [확정]을 눌러야 쓰인다(고객 주문 자동 번역도 확정 틀이 있어야 열린다).
   ★옛 번역 넣기: 파일 → 코드로 개인정보를 가린 미리보기 → 대표가 확인 → [보내기]를 눌러야 API.
     원본 파일은 글자를 뽑은 뒤 서버에 남지 않는다.
   ★이 화면에는 개인정보가 나오지 않는다 — 칸 수 · 비용 · 고정 문구(칸 이름) 만. */
(function () {
  var LEG = null;          // 진행 중 옛 번역 작업 id
  var LEG_TIMER = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hdr() { return { 'Authorization': 'Bearer ' + adminToken() }; }
  function muted(t) { return '<p style="color:rgba(255,255,255,0.4);font-size:12px;margin:6px 0">' + t + '</p>'; }
  var TH = 'style="text-align:left;padding:6px 8px;font-size:11px;color:rgba(255,255,255,0.45);font-weight:500;border-bottom:1px solid rgba(255,255,255,0.08)"';
  var TD = 'style="padding:6px 8px;font-size:12px;color:rgba(255,255,255,0.75);border-bottom:1px solid rgba(255,255,255,0.04)"';
  function table(head, rows) {
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin:6px 0 14px">' +
      '<tr>' + head.map(function (h) { return '<th ' + TH + '>' + h + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td ' + TD + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</table></div>';
  }
  function sub(t) { return '<div style="font-size:12px;color:var(--gold);margin:14px 0 4px;font-weight:600">' + t + '</div>'; }

  var DOC_LABEL = {};

  window.ntraLoad = async function (reload) {
    var box = document.getElementById('ntra-body');
    box.innerHTML = muted('불러오는 중…');
    try {
      var r = await authFetch(API_BASE + '/api/notary/admin/assets' + (reload ? '?reload=1' : ''), { headers: hdr() });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '조회 실패');
      (j.docs || []).forEach(function (d) { DOC_LABEL[d.code] = d.label; });
      box.innerHTML = render(j) + legacyForm();
    } catch (e) {
      box.innerHTML = '<p style="color:#D9BC8C;font-size:13px">불러오지 못했습니다: ' + esc(e.message) + '</p>' + legacyForm();
    }
  };

  function render(j) {
    var h = '';
    h += '<div style="background:rgba(157,183,245,0.06);border-left:3px solid var(--gold);padding:10px 14px;border-radius:4px;font-size:12px;color:rgba(255,255,255,0.6);line-height:1.8">' +
      '틀 ' + (j.status && j.status.templates || 0) + '개 · 문구 기억 ' + (j.status && j.status.memory || 0) + '개' +
      (j.customerOpus ? '' : '<br><span style="color:#D9BC8C">고객 주문의 Opus(원본 그림 전송)는 꺼져 있습니다 — 개인정보처리방침 개정 전까지 관리자 직접 번역에서만 씁니다.</span>') +
      '</div>';

    h += sub('서류별 상태');
    h += table(['서류', '방식', '확정 틀', '고객 자동 번역'], (j.docs || []).map(function (d) {
      return [esc(d.label), d.engine === 'asset' ? '틀 자산' : '파서·사전',
        d.confirmed ? '<span style="color:#9DB7F5">있음</span>' : '<span style="color:rgba(255,255,255,0.35)">없음</span>',
        d.customerAuto ? '<span style="color:#9DB7F5">켜짐</span>' : '꺼짐'];
    }));

    h += sub('틀 (서류 × 양식 판 × 판)');
    var tpls = (j.templates || []).slice().sort(function (a, b) {
      return String(a.docCode).localeCompare(String(b.docCode)) || String(a.variant).localeCompare(String(b.variant)) || b.version - a.version; });
    h += tpls.length ? table(['서류', '양식 판', '판', '상태', '출처', '고정 문구', '사용', ''], tpls.map(function (t) {
      var st = t.status === '확정' ? '<span style="color:#9DB7F5">확정</span>' : (t.status === '후보' ? '<span style="color:#E8C66A">후보</span>' : '<span style="color:rgba(255,255,255,0.35)">지난판</span>');
      var btn = t.status === '후보' ? '<button class="tab-btn" style="text-transform:none;letter-spacing:0" onclick="ntraConfirm(\'' + esc(t.recordId) + '\')">확정</button>' : '';
      return [esc(DOC_LABEL[t.docCode] || t.docCode), esc(t.variant), esc(t.version), st, esc(t.source), esc(t.fixed != null ? t.fixed : t.slots), esc(t.uses || 0), btn];
    })) : muted('아직 틀이 없습니다 — 서류를 처리하거나 옛 번역을 넣으면 후보가 생깁니다.');

    h += sub('문구 기억 (서류별 · 출처별)');
    var ms = j.memory || {};
    var mk = Object.keys(ms);
    h += mk.length ? table(['서류', '전체', '대표수정', '대표번역', 'AI확인', 'AI'], mk.map(function (k) {
      var m = ms[k]; return [esc(DOC_LABEL[k] || k), m.total, m['대표수정'] || 0, m['대표번역'] || 0, m['AI확인'] || 0, m['AI'] || 0];
    })) : muted('문구 기억이 없습니다.');

    // 충돌은 저장 직후 Opus 가 자동 판정한다(통일 · 문맥별). 여기에는 판정 못 한 것(unsure)만 남는다.
    h += sub('충돌 — 자동 판정이 못 한 것만 (같은 원문, 다른 번역)');
    var cf = j.conflicts || [];
    h += cf.length ? table(['원문', '쓰이는 번역', '다른 번역'], cf.slice(0, 100).map(function (c) {
      return [esc(c.ko), esc(c.winner) + ' <span style="color:rgba(255,255,255,0.35)">(' + esc(c.winnerSource) + ')</span>',
        c.options.slice(1).map(function (o) { return esc(o.en) + ' <span style="color:rgba(255,255,255,0.35)">(' + esc(o.source) + (o.docCode ? ' · ' + esc(DOC_LABEL[o.docCode] || o.docCode) : '') + (o.variant ? ' · ' + esc(o.variant) : '') + (o.pending ? ' · 판정대기' : '') + ')</span>'; }).join('<br>')];
    })) : muted('판정 못 한 충돌 없음');
    var jl = j.judgeLog || [];
    h += '<details style="margin:6px 0 2px"><summary style="cursor:pointer;font-size:12px;color:#9DB7F5">자동 판정 기록 (' + jl.length + '건)</summary>' +
      (jl.length ? table(['날짜', '원문', '판정', '고른 값', '다른 값', '이유'], jl.slice(0, 200).map(function (e) {
        return [esc(e.date), esc(e.ko), esc(e.kind),
          e.chosen.map(function (c) { return esc(c.en) + (e.kind === '문맥별' ? ' <span style="color:rgba(255,255,255,0.35)">(' + esc(DOC_LABEL[c.docCode] || c.docCode || '공통') + (c.variant ? ' · ' + esc(c.variant) : '') + ')</span>' : ''); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('<br>'),
          esc(e.others), esc(e.reason)];
      })) : muted('기록 없음')) + '</details>';

    h += sub('서류별 처리 비용 추이 — 같은 서류가 쌓일수록 Opus 칸이 줄어야 합니다');
    var tr = j.trend || {};
    var tk = Object.keys(tr);
    h += tk.length ? tk.map(function (k) {
      return '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px">' + esc(DOC_LABEL[k] || k) + '</div>' +
        table(['주문', '처리', '칸 전체', '틀·기억·코드', 'Opus 칸', 'Opus 호출', '비용', '확정 학습'], tr[k].map(function (x) {
          var c = x.cells || {};
          return [esc(x.orderNumber), _nd(x.at), c.total != null ? c.total : '-', c.byAssets != null ? c.byAssets : '-',
            c.opus != null ? c.opus : '-', x.calls, '$' + Number(x.usd || 0).toFixed(4),
            x.learn ? '고친 칸 ' + x.learn.edited + ' · 확인 ' + x.learn.confirmedAi : '-'];
        }));
    }).join('') : muted('처리 기록이 없습니다.');
    return h;
  }

  window.ntraConfirm = async function (recordId) {
    try {
      var r = await authFetch(API_BASE + '/api/notary/admin/assets/templates/' + encodeURIComponent(recordId) + '/confirm', { method: 'POST', headers: hdr() });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '확정 실패');
      showToast('틀 확정 — ' + (DOC_LABEL[j.template.docCode] || j.template.docCode) + ' 판 ' + j.template.version, 'success');
      ntraLoad(false);
    } catch (e) { showToast('확정하지 못했습니다: ' + e.message, ''); }
  };

  // ── 옛 번역 넣기 ──────────────────────────────────────────
  function legacyForm() {
    return sub('옛 번역 넣기 — 대표가 예전에 한 번역을 자산으로') +
      '<div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.8;margin-bottom:8px">' +
      '한국어 원본 + 영문 번역본을 <b>같은 순서</b>로 올리면 짝으로, 영문만 올리면 영문만으로 처리합니다. PDF · DOCX · HWP · HWPX · 이미지 · TXT, 여러 개.<br>' +
      '① [미리보기] — 서버가 글자를 뽑아 <b>코드로 개인정보를 가립니다</b>(원본 파일은 남기지 않음) · API 호출 없음<br>' +
      '② 가린 글을 확인 → ③ [보내기]를 눌러야 Opus(Batch, 50% 할인)로 갑니다 → 틀 후보 + 문구 기억</div>' +
      '<div class="bp-row"><div class="bp-col"><label class="bp-label">한국어 원본 (선택)</label><input type="file" id="ntra-ko" multiple class="bp-inp"></div>' +
      '<div class="bp-col"><label class="bp-label">영문 번역본 (필수)</label><input type="file" id="ntra-en" multiple class="bp-inp"></div></div>' +
      '<button class="btn-ocr" onclick="ntraPreview()">미리보기 (가리기만 — API 없음)</button>' +
      '<div id="ntra-leg" style="margin-top:10px"></div>';
  }

  window.ntraPreview = async function () {
    var ko = document.getElementById('ntra-ko').files, en = document.getElementById('ntra-en').files;
    var out = document.getElementById('ntra-leg');
    if (!en.length) { out.innerHTML = '<span style="color:#D9BC8C;font-size:12px">영문 번역본을 1개 이상 골라 주세요</span>'; return; }
    var fd = new FormData();
    for (var i = 0; i < ko.length; i++) fd.append('ko', ko[i]);
    for (var k = 0; k < en.length; k++) fd.append('en', en[k]);
    out.innerHTML = muted('글자를 뽑고 가리는 중… (스캔 PDF·그림은 문자 인식이라 조금 걸립니다)');
    try {
      var r = await authFetch(API_BASE + '/api/notary/admin/legacy/preview', { method: 'POST', headers: hdr(), body: fd });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '미리보기 실패');
      LEG = j.job.id;
      out.innerHTML = j.job.items.map(function (it) {
        var cnt = function (c) { return Object.keys(c || {}).map(function (x) { return x + ' ' + c[x]; }).join(' · ') || '없음'; };
        return '<div style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px;margin-bottom:10px">' +
          '<div style="font-size:12px;color:#FAFAF7">' + (it.idx + 1) + '. ' + esc(it.enName) + (it.koName ? ' ↔ ' + esc(it.koName) : '') +
          ' <span style="color:rgba(255,255,255,0.4)">(' + (it.mode === 'pair' ? '짝' : '영문만') + ')</span></div>' +
          (it.error ? '<div style="color:#D9BC8C;font-size:12px">' + esc(it.error) + '</div>' :
            '<div style="font-size:11px;color:rgba(255,255,255,0.45);margin:4px 0">가린 것 — 영문: ' + cnt(it.counts && it.counts.en) + (it.mode === 'pair' ? ' / 한국어: ' + cnt(it.counts && it.counts.ko) : '') + '</div>' +
            (it.ko ? '<pre style="white-space:pre-wrap;max-height:220px;overflow:auto;font-size:11px;background:rgba(0,0,0,0.25);padding:8px;border-radius:4px;color:rgba(255,255,255,0.7)">' + esc(it.ko) + '</pre>' : '') +
            '<pre style="white-space:pre-wrap;max-height:220px;overflow:auto;font-size:11px;background:rgba(0,0,0,0.25);padding:8px;border-radius:4px;color:rgba(255,255,255,0.7)">' + esc(it.en) + '</pre>') +
          '</div>';
      }).join('') +
        '<div style="font-size:12px;color:#E8C66A;margin:6px 0">가려지지 않은 이름·번호가 보이면 보내지 말고 파일을 고쳐 다시 올려 주세요.</div>' +
        '<button class="btn-bp-submit" onclick="ntraSend()">보내기 (Opus Batch)</button>';
    } catch (e) { out.innerHTML = '<span style="color:#D9BC8C;font-size:12px">미리보기 실패: ' + esc(e.message) + '</span>'; }
  };

  window.ntraSend = async function () {
    if (!LEG) return;
    var out = document.getElementById('ntra-leg');
    try {
      var r = await authFetch(API_BASE + '/api/notary/admin/legacy/' + encodeURIComponent(LEG) + '/send', { method: 'POST', headers: hdr() });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '보내기 실패');
      out.innerHTML = muted('보냈습니다 — Batch 처리 중 (보통 몇 분, 길면 1시간). 이 화면을 닫아도 서버에서 계속됩니다.');
      ntraPoll();
    } catch (e) { out.innerHTML = '<span style="color:#D9BC8C;font-size:12px">보내기 실패: ' + esc(e.message) + '</span>'; }
  };

  async function ntraPoll() {
    if (LEG_TIMER) { clearTimeout(LEG_TIMER); LEG_TIMER = null; }
    var out = document.getElementById('ntra-leg');
    try {
      var r = await authFetch(API_BASE + '/api/notary/admin/legacy/' + encodeURIComponent(LEG), { headers: hdr() });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '조회 실패');
      var job = j.job;
      if (job.status === '완료' && job.result) {
        var res = job.result;
        out.innerHTML = '<div style="font-size:12px;color:#9DB7F5;margin-bottom:4px">완료 — Batch ' + res.calls + '건 · 실패 ' + res.failed + ' · $' + Number(res.usd).toFixed(4) +
          (res.judge ? ' · 기억 충돌 판정: 통일 ' + (res.judge.unify || 0) + ' · 문맥별 ' + (res.judge.context || 0) + ' · 못 함 ' + (res.judge.unsure || 0) + ' · $' + Number(res.judge.usd || 0).toFixed(4) : '') + '</div>' +
          table(['파일', '방식', '서류', '틀', '문구(저장)', '확정', '후보', '막음(개인정보)', '오류'], res.docs.map(function (d) {
            return [esc(d.file), d.mode === 'pair' ? '짝' : '영문만', esc(DOC_LABEL[d.docCode] || d.docCode || '-'), (d.templates ? '후보 생성' : '-') + (d.variantLine ? '<br><span style="font-size:11px;color:#9DB7F5">' + esc(d.variantLine) + '</span>' : ''),
              d.pairs, d.confirmed, d.candidates, d.blocked, d.error ? '<span style="color:#D9BC8C">' + esc(d.error) + '</span>' : ''];
          })) + muted('틀 후보는 위 [불러오기] → 틀 목록에서 [확정]을 눌러야 쓰입니다.');
        return;
      }
      if (job.status === '실패') { out.innerHTML = '<span style="color:#D9BC8C;font-size:12px">실패: ' + esc(job.error) + '</span>'; return; }
      out.innerHTML = muted(esc(job.status) + ' … (30초마다 확인)');
      LEG_TIMER = setTimeout(ntraPoll, 30000);
    } catch (e) { out.innerHTML = '<span style="color:#D9BC8C;font-size:12px">상태 조회 실패: ' + esc(e.message) + '</span>'; }
  }
})();
