// 관리자 '원본 틀 번역(시범)' (2026-11-10) — 끌어다 놓기·[파일 첨부] → [시작] 한 번 → 클로드가 읽고 틀 점검 → 번역 주문(내부전용)까지
// 번역 방향·분야·제출 국가는 아래 '우회 주문 정보' 칸 값을 그대로 쓴다(bp-direction · bp-field · bpDestLine).
// 진행: 서버 작업(/api/admin/layout/jobs/:id)을 조회 — 작업 번호를 브라우저에 기억해 새로 고쳐도 이어서 본다. 본문은 화면에 없다(쪽·단계·항목·비용만).
// 주문 상세: [원문 틀 워드](언제든) · [번역 틀 워드](승인 뒤) — ltShowOrder(order)
// 2026-11-20: 파일당 100쪽(실수 방지 상한) · 쪽마다 서버에 저장 → 서버가 다시 시작돼 끊기면 같은 파일을 다시 올려 [이어 하기](남은 쪽부터) · 쪽이 많으면 진행을 칸 격자로
(function () {
  var KEY = 'iumm_layout_job_v1', MAX_PAGES = 100, MAX_MB = 150, COMPACT = 12, EXT = /\.(jpe?g|png|webp|pdf)$/i;
  var files = [], timer = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function api(path, opt) { opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + adminToken() }, opt.headers || {}); return authFetch(API_BASE + path, opt); }
  function usd(n) { return '$' + Number(n || 0).toFixed(n >= 1 ? 2 : 4); }
  function remember(id) { try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch (e) {} }
  function remembered() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  var BOX = 'padding:10px 12px;border-radius:6px;font-size:12.5px;line-height:1.6;margin-top:10px;';
  var BLUE = BOX + 'background:rgba(157,183,245,0.08);border:1px solid rgba(157,183,245,0.30);color:#C9D8FA;';
  var DEEP = BOX + 'background:rgba(127,180,255,0.14);border:1px solid rgba(127,180,255,0.55);color:#DCE7FF;';

  function render() {
    var host = $('lt-section'); if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.className = 'bp-section';
    host.innerHTML =
      '<div class="bp-section-title">🗂 원본 틀 번역 (시범)</div>' +
      '<div style="' + BLUE + 'margin-top:0">서류 그림·PDF를 끌어다 놓으면 클로드가 원본 틀(제목·문단·표·칸 합치기·도장 자리)을 읽고, 틀 점검을 통과하면 번역 주문(내부전용)을 자동으로 만듭니다.<br>' +
      'JPG·PNG·WebP·PDF · 파일당 ' + MAX_PAGES + '쪽까지(실수 방지 상한) · 파일마다 주문 1건. 번역 방향·분야·제출 국가는 아래 <strong>우회 주문 정보</strong> 칸 값을 씁니다.<br>' +
      '쪽마다 끝나는 대로 저장합니다. 서버가 다시 시작돼 끊기면 같은 파일을 다시 올리세요 — 저장된 쪽 다음부터 <strong>이어 하기</strong>로 읽습니다.</div>' +
      '<div id="lt-drop" tabindex="0" style="margin-top:10px;padding:22px 14px;border:1.5px dashed rgba(157,183,245,0.45);border-radius:8px;text-align:center;color:#9DB7F5;font-size:13px;cursor:pointer">여기에 파일을 끌어다 놓으세요 · 또는 ' +
      '<label for="lt-files" style="display:inline-block;padding:5px 12px;margin-left:4px;background:rgba(157,183,245,0.12);border:1px solid rgba(157,183,245,0.35);border-radius:3px;cursor:pointer">파일 첨부</label></div>' +
      '<input type="file" id="lt-files" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" style="display:none">' +
      '<div id="lt-list" style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:8px"></div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;color:rgba(255,255,255,0.85);cursor:pointer">' +
      '<input type="checkbox" id="lt-mask" checked style="accent-color:#9DB7F5"> <span><strong style="color:#9DB7F5">개인정보 칸 가리고 읽기</strong> — 주민·외국인등록번호·여권·계좌·카드·전화·이메일 자리를 까맣게 칠한 그림을 클로드에 보냅니다(끄면 원본 그대로). 켬/끔은 주문 기록에 남습니다.</span></label>' +
      '<div id="lt-est" style="display:none;' + BLUE + '"></div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:10px"><button type="button" id="lt-start" class="btn-dl" disabled style="padding:8px 18px;font-size:13px">시작</button>' +
      '<span id="lt-msg" style="font-size:12px;color:#9DB7F5"></span></div>' +
      '<div id="lt-progress"></div>';
    var drop = $('lt-drop');
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.style.background = 'rgba(157,183,245,0.10)'; }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.style.background = ''; }); });
    drop.addEventListener('drop', function (e) { setFiles(e.dataTransfer && e.dataTransfer.files); });
    drop.addEventListener('click', function (e) { if (e.target.tagName !== 'LABEL') $('lt-files').click(); });
    $('lt-files').addEventListener('change', function () { setFiles(this.files); });
    $('lt-mask').addEventListener('change', function () { if (files.length) estimate(); });
    $('lt-start').addEventListener('click', start);
    var id = remembered(); if (id) follow(id);
  }

  function form() {
    var fd = new FormData();
    files.forEach(function (f) { fd.append('files', f); });
    fd.append('direction', ($('bp-direction') || {}).value || '');
    fd.append('fieldCode', ($('bp-field') || {}).value || 'general');
    fd.append('referenceNotes', window.bpDestLine ? bpDestLine() : '');
    fd.append('mask', $('lt-mask').checked ? 'true' : 'false');
    return fd;
  }

  function setFiles(list) {
    var arr = Array.prototype.slice.call(list || []);
    var bad = arr.filter(function (f) { return !EXT.test(f.name); });
    var big = arr.filter(function (f) { return EXT.test(f.name) && f.size > MAX_MB * 1048576; });
    files = arr.filter(function (f) { return EXT.test(f.name) && f.size <= MAX_MB * 1048576; }).slice(0, 5);
    $('lt-list').innerHTML = files.map(function (f) { return '· ' + esc(f.name) + ' <span style="color:rgba(255,255,255,0.45)">(' + Math.round(f.size / 1024) + 'KB)</span>'; }).join('<br>') +
      (bad.length ? '<div style="color:#9DB7F5;margin-top:4px">받지 않는 형식 ' + bad.length + '개는 뺐습니다 (JPG·PNG·WebP·PDF만)</div>' : '') +
      (big.length ? '<div style="color:#9DB7F5;margin-top:4px">' + MAX_MB + 'MB 넘는 파일 ' + big.length + '개는 뺐습니다 (나눠 올리세요)</div>' : '');
    $('lt-start').disabled = true;
    if (files.length) estimate(); else $('lt-est').style.display = 'none';
  }

  async function estimate() {
    $('lt-msg').textContent = '쪽 수·예상 비용 확인 중…';
    try {
      var r = await api('/api/admin/layout/estimate', { method: 'POST', body: form() });
      var d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || ('오류 ' + r.status));
      var e = d.estimate;
      var resumed = d.files.filter(function (f) { return f.resume; });
      $('lt-est').style.display = 'block';
      $('lt-est').innerHTML = (resumed.length ? '<div class="lt-resume" style="margin-bottom:6px"><strong>끊긴 작업을 찾았습니다</strong> — ' + resumed.map(function (f) {
          return esc(f.name) + ' ' + f.pages + '쪽 중 ' + f.resume.done + '쪽 저장됨 → <strong>' + f.resume.from + '쪽부터</strong> 이어 하기'; }).join(' · ') + '</div>' : '') +
        '<strong>예상 비용</strong> — ' + (resumed.length ? '남은 ' : '') + e.pages + '쪽 × 쪽당 ' + usd(e.perPage) + ' = <strong>' + usd(e.usd) + '</strong>' +
        '<br>쪽당: 읽기 약 $0.03~0.04 + 틀 점검 약 $0.03 + 위치 잡기 약 $0.0015(구글 비전 매달 1,000쪽 무료)' +
        '<br>틀 점검을 못 통과한 쪽은 Opus 로 다시 읽어 그 쪽에 약 ' + usd(e.opusRetryPerPage) + ' 더 듭니다(최대 ' + usd(e.worstUsd) + ').' +
        '<br>' + d.files.map(function (f) { return esc(f.name) + ' ' + f.pages + '쪽'; }).join(' · ') +
        (d.budget && d.budget.remaining != null ? '<br>남은 예산 ' + usd(d.budget.remaining) : '') +
        (d.markLabels !== '도착어' ? '<br>도장·서명 자리 표시: ' + esc(d.markLabels) : '') +
        (d.pageStore === false ? '<br>⚠ 쪽 저장 표가 없어 이어 하기를 쓸 수 없습니다(끊기면 처음부터). 긴 문서는 저장 칸이 모자라 실패할 수 있습니다.' : '');
      $('lt-start').textContent = resumed.length ? '이어 하기' : '시작';
      $('lt-start').disabled = !d.allowed;
      $('lt-msg').textContent = d.allowed ? '' : (d.message || '예산이 부족합니다');
    } catch (err) { $('lt-msg').textContent = '⚠ ' + err.message; $('lt-est').style.display = 'none'; }
  }

  async function start() {
    if (!files.length) return;
    $('lt-start').disabled = true; $('lt-msg').textContent = '시작하는 중…';
    try {
      var r = await api('/api/admin/layout/start', { method: 'POST', body: form() });
      var d = await r.json();
      if (r.status === 409 && d.jobId) { follow(d.jobId); $('lt-msg').textContent = '다른 작업이 진행 중입니다 — 그 작업을 보여 드립니다'; return; }
      if (!r.ok || !d.ok) throw new Error(d.message || d.error || ('오류 ' + r.status));
      files = []; $('lt-list').innerHTML = ''; $('lt-files').value = ''; $('lt-est').style.display = 'none'; $('lt-start').textContent = '시작';
      $('lt-msg').textContent = '';
      follow(d.job.id, d.job);
    } catch (err) { $('lt-msg').textContent = '⚠ ' + err.message; $('lt-start').disabled = false; }
  }

  function follow(id, first) {
    remember(id);
    if (timer) clearTimeout(timer);
    if (first) show(first);
    var tick = async function () {
      try {
        var r = await api('/api/admin/layout/jobs/' + encodeURIComponent(id));
        var d = await r.json();
        if (r.status === 404) { remember(''); $('lt-progress').innerHTML = '<div class="lt-gone" style="' + BLUE + '">' + (d.interrupted ? '<strong>작업이 끊겼습니다</strong> — ' : '') + esc(d.error || '작업을 찾지 못했습니다') + '</div>'; return; }
        if (!r.ok || !d.ok) throw new Error(d.error || ('오류 ' + r.status));
        show(d.job);
        if (d.job.status === '진행') timer = setTimeout(tick, window.LT_POLL_MS || 3000);
        else remember('');
      } catch (err) { timer = setTimeout(tick, (window.LT_POLL_MS || 3000) * 2); }
    };
    tick();
  }

  function show(j) {
    var done = j.status !== '진행';
    var h = '<div style="' + (done ? DEEP : BLUE) + '"><strong>' + (done ? '끝 — ' + esc(j.status) : '진행 중') + '</strong> · ' + esc(j.direction) +
      ' · 개인정보 칸 가리고 읽기 ' + (j.mask ? '켬' : '끔') + ' · 실제 비용 <strong id="lt-cost">' + usd(j.usd) + '</strong>' + (done ? '' : ' · 새로 고쳐도 이어서 봅니다') + '</div>';
    (j.files || []).forEach(function (f) {
      var ps = f.pageStates || [];
      var pages = ps.length > COMPACT ? grid(ps) : ps.map(function (p, i) {
        return '<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:10px;border:1px solid rgba(157,183,245,' + (p.ok ? '0.7' : '0.3') + ');background:rgba(157,183,245,' + (p.ok ? '0.18' : p.ok === false ? '0.04' : '0.08') + ')">' +
          (i + 1) + '쪽 ' + esc(p.step) + (p.opus ? ' · Opus' : '') + (p.masked ? ' · 가림 ' + p.masked : '') + '</span>';
      }).join('');
      var res = f.orderNumber ? '주문 <strong class="lt-order">' + esc(f.orderNumber) + '</strong> · 틀 점검 통과 · 블록 ' + f.blocks + '개'
        : f.hold ? '<strong>' + esc(f.hold) + '</strong> — 번역 주문을 만들지 않았습니다'
        : f.error ? '실패 — ' + esc(f.error) : esc(f.status || '대기');
      h += '<div style="' + BLUE + '"><div>' + esc(f.name) + ' · ' + f.pages + '쪽 · ' + usd(f.usd) + (f.resumed ? ' · 앞 작업에서 ' + f.resumed + '쪽 이어 받음' : '') + '</div><div style="margin-top:4px">' + pages + '</div><div class="lt-file-result" style="margin-top:4px">' + res + '</div></div>';
    });
    $('lt-progress').innerHTML = h;
  }

  /** 쪽이 많을 때(13쪽~100쪽) — 세는 줄 + 번호 칸 격자(칸에 마우스를 올리면 단계) + 보류 쪽 사유 */
  function grid(ps) {
    var n = { pass: 0, hold: 0, run: 0, wait: 0, opus: 0, masked: 0 }, cur = -1;
    ps.forEach(function (p, i) {
      if (p.ok) n.pass++; else if (p.ok === false) n.hold++; else if (p.step === '대기') n.wait++; else { n.run++; if (cur < 0) cur = i; }
      if (p.opus) n.opus++; if (p.masked) n.masked++;
    });
    var cells = ps.map(function (p, i) {
      var bg = p.ok ? '0.30' : p.ok === false ? '0.02' : p.step === '대기' ? '0.06' : '0.16';
      var bd = p.ok ? '0.75' : p.ok === false ? '0.9' : i === cur ? '0.9' : '0.25';
      return '<span class="lt-cell" title="' + esc((i + 1) + '쪽 ' + p.step + (p.opus ? ' · Opus' : '') + (p.masked ? ' · 가림 ' + p.masked : '')) + '" style="display:inline-block;width:30px;margin:0 3px 3px 0;padding:1px 0;text-align:center;font-size:10.5px;border-radius:3px;' +
        'border:1px ' + (p.ok === false ? 'dashed' : 'solid') + ' rgba(157,183,245,' + bd + ');background:rgba(157,183,245,' + bg + ');' + (p.ok === false ? 'text-decoration:line-through;' : '') + '">' + (i + 1) + '</span>';
    }).join('');
    var held = ps.map(function (p, i) { return p.ok === false ? (i + 1) + '쪽: ' + esc((p.problems || []).join(', ') || p.step) : null; }).filter(Boolean);
    return '<div class="lt-count">통과 ' + n.pass + ' · 보류 ' + n.hold + ' · 대기 ' + n.wait + (n.opus ? ' · Opus 다시 읽기 ' + n.opus : '') + (n.masked ? ' · 가린 쪽 ' + n.masked : '') +
      (cur >= 0 ? ' · 지금 ' + (cur + 1) + '쪽 ' + esc(ps[cur].step) : '') + '</div><div style="margin-top:4px;line-height:1">' + cells + '</div>' +
      (held.length ? '<div style="margin-top:4px">' + held.slice(0, 20).join('<br>') + (held.length > 20 ? '<br>… 외 ' + (held.length - 20) + '쪽' : '') + '</div>' : '');
  }

  /** 주문 상세 버튼 — order.layout = { pages, blocks, mask, approved } (본문 없음) */
  window.ltShowOrder = function (order) {
    var L = order && order.layout, a = $('btn-dl-layout-src'), b = $('btn-dl-layout-tr');
    if (!a || !b) return;
    a.style.display = L ? '' : 'none';
    b.style.display = L && L.approved ? '' : 'none';
    a.title = L ? '읽은 원본 틀 — ' + L.pages + '쪽 · 블록 ' + L.blocks + '개' : '';
  };
  window.ltDownload = function (kind) {
    if (!window.selectedOrder) return;
    var num = selectedOrder.orderNumber || selectedOrder.orderId;
    downloadWithAuth('/api/admin/orders/' + selectedOrder.orderId + '/layout-docx?kind=' + kind, num + '_' + (kind === 'translation' ? '번역틀' : '원문틀') + '.docx');
  };
  window.ltRender = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
