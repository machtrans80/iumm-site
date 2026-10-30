// 용어 추출 탭 (2026-10-31) — 원문+번역 파일에서 용어 후보를 뽑아 용어집에 쌓는다.
// 서버(iumm-pipeline): GET  /api/admin/term-extract/options
//                      POST /api/admin/term-extract/estimate   (multipart: files·pair·field·scope·bizNo·company)
//                      POST /api/admin/term-extract/start      (같은 양식)
//                      GET  /api/admin/term-extract/jobs/:id
// 흐름: [예상 비용 보기] → 예산 안(allowed)이면 [추출 시작]이 켜짐 → 시작 후 10초마다 진행 상황을 불러온다.
// index.html 의 API_BASE · adminToken() · showToast() 를 쓴다.
(function () {
  var TX_OPTS = null;      // options 응답 캐시
  var TX_TIMER = null;     // 진행 상황 폴링
  var TX_JOB = null;       // 지금 보는 작업 id
  var TX_POLL_MS = 10000;

  var STAT_LABEL = { '뽑음': '뽑은 용어', '대조탈락': '대조에서 빠짐', '새후보': '새 후보', '기존가산': '기존 용어에 더함', '제외': '제외', '조각실패': '조각 실패' };
  var RESULT_LABEL = {
    '묶음': '묶음', '사람결정묶음_제외': '사람이 정한 묶음(제외)', '확정': '확정', '범위옮김': '범위 옮김', '대체됨': '대체됨',
    '거절': '거절', 'AI가_버림': 'AI가 버림', '개인정보점검_제외': '개인정보 점검에서 제외', '자동점검_제외': '자동 점검에서 제외',
    '같은원어_확정2개': '같은 원어 확정 2개', '같은원어_3개이상': '같은 원어 3개 이상', '응답누락': '응답 누락'
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function usd(n) { return '$' + (Number(n) || 0).toFixed(2); }
  function usdCap(n) { n = Number(n) || 0; return '$' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)); }
  function label(map, k) { return map[k] || String(k).replace(/_/g, ' '); }
  function authHeaders() { return { 'Authorization': 'Bearer ' + adminToken() }; }
  function msg(text, warn) { var m = $('tx-msg'); m.textContent = text || ''; m.className = 'tx-msg' + (warn ? ' warn' : ''); }
  function statusBadge(st) {
    var cls = st === '완료' ? 'st-done' : (st === '진행 중' ? 'st-progress' : 'st-check');
    return '<span class="st ' + cls + '">' + esc(st || '-') + '</span>';
  }
  function budgetLine(b) {
    if (!b) return '';
    return '남은 예산 <strong>' + usd(b.remaining) + '</strong> / ' + usdCap(b.cap != null ? b.cap : 50)
      + ' · 사용 ' + usd(b.spent) + (b.expires ? ' · 크레딧 만료 ' + esc(b.expires) : '');
  }

  // 언어쌍 — 우회 번역 폼의 '번역 방향' 목록을 그대로 쓴다. 보낼 값은 "한국어→영어" (공백 없이)
  function fillPairs() {
    var sel = $('tx-pair');
    if (sel.options.length) return;
    var src = $('bp-direction');
    var html = '';
    [].forEach.call(src ? src.children : [], function (g) {
      var opts = g.tagName === 'OPTGROUP' ? g.children : [g];
      var inner = [].map.call(opts, function (o) {
        var t = o.textContent.trim();
        return '<option value="' + esc(t.replace(/\s+/g, '')) + '">' + esc(t) + '</option>';
      }).join('');
      html += g.tagName === 'OPTGROUP' ? '<optgroup label="' + esc(g.label) + '">' + inner + '</optgroup>' : inner;
    });
    sel.innerHTML = html;
    sel.value = '한국어→영어';
  }

  window.txInit = async function () {
    fillPairs();
    txScopeChanged(true);
    if (TX_OPTS) return;
    try {
      var r = await fetch(API_BASE + '/api/admin/term-extract/options', { headers: authHeaders() });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || '불러오기 실패');
      TX_OPTS = j;
      $('tx-field').innerHTML = (j.fields || []).map(function (f) {
        return '<option value="' + esc(f.code) + '">' + esc(f.name) + '</option>';
      }).join('');
      if (j.scopes && j.scopes.length) {
        var cur = $('tx-scope').value;
        $('tx-scope').innerHTML = j.scopes.map(function (s) { return '<option value="' + esc(s.code) + '">' + esc(s.name) + '</option>'; }).join('');
        if (cur) $('tx-scope').value = cur;
      }
      if (j.exts && j.exts.length) {
        $('tx-exts').textContent = j.exts.join(' · ');
        $('tx-files').setAttribute('accept', j.exts.map(function (e) { return '.' + e; }).join(','));
      }
      if (j.onlySourceMessage) $('tx-onlysrc').textContent = j.onlySourceMessage;
      $('tx-budget').innerHTML = budgetLine(j.budget);
      if (j.running) { txWatch(j.running); msg('진행 중인 추출 작업이 있습니다. 끝난 뒤 새로 시작할 수 있습니다.', true); }
    } catch (e) {
      msg('설정을 불러오지 못했습니다: ' + e.message, true);
    }
  };

  window.txScopeChanged = function (silent) {
    $('tx-corp-row').style.display = $('tx-scope').value === 'corp' ? '' : 'none';
    if (silent !== true) txReset();
  };

  /** 입력이 바뀌면 예상 비용을 다시 봐야 시작할 수 있다 */
  window.txReset = function () {
    $('tx-start-btn').disabled = true;
    $('tx-estimate').style.display = 'none';
    $('tx-estimate').innerHTML = '';
    msg('');
  };

  window.txFilesChanged = function () {
    var fs = [].slice.call($('tx-files').files || []);
    $('tx-filelist').innerHTML = fs.length
      ? fs.map(function (f) { return '<span class="tx-file">' + esc(f.name) + '</span>'; }).join('')
      : '';
    txReset();
  };

  function buildForm() {
    var files = [].slice.call($('tx-files').files || []);
    if (!files.length) throw new Error('파일을 골라 주세요.');
    var scope = $('tx-scope').value;
    var fd = new FormData();
    files.forEach(function (f) { fd.append('files', f, f.name); });
    fd.append('pair', $('tx-pair').value);
    fd.append('field', $('tx-field').value);
    fd.append('scope', scope);
    if (scope === 'corp') {
      var company = $('tx-company').value.trim(), bizNo = $('tx-bizno').value.trim();
      if (!company || !bizNo) throw new Error('기업전용은 회사명과 사업자등록번호를 넣어 주세요.');
      fd.append('company', company);
      fd.append('bizNo', bizNo);
    }
    return fd;
  }
  async function post(path, fd) {
    var r = await fetch(API_BASE + path, { method: 'POST', headers: authHeaders(), body: fd });
    var j = null;
    try { j = await r.json(); } catch (e) { j = { ok: false, error: '응답을 읽지 못했습니다' }; }
    return { status: r.status, data: j || {} };
  }
  function rejectedHtml(list) {
    if (!list || !list.length) return '';
    return '<div class="tx-sub">받지 않은 파일 ' + list.length + '개</div><ul class="tx-list tx-rejected">'
      + list.map(function (x) { return '<li><strong>' + esc(x.name) + '</strong> — ' + esc(x.why) + '</li>'; }).join('') + '</ul>';
  }

  window.txEstimate = async function () {
    var fd;
    try { fd = buildForm(); } catch (e) { msg(e.message, true); return; }
    var btn = $('tx-estimate-btn');
    btn.disabled = true; $('tx-start-btn').disabled = true;
    msg('예상 비용을 계산하는 중…');
    try {
      var r = await post('/api/admin/term-extract/estimate', fd);
      var d = r.data;
      if (r.status !== 200 || !d.ok) {
        msg(d.message || d.error || '예상 비용을 계산하지 못했습니다.', true);
        if (d.rejected) { $('tx-estimate').innerHTML = rejectedHtml(d.rejected); $('tx-estimate').style.display = 'block'; }
        return;
      }
      var e = d.estimate || {}, b = d.budget || {};
      var docs = (d.docs || []).map(function (x) {
        return '<li><strong>' + esc(x.name) + '</strong> · ' + (x.kind === 'bilingual' ? '대조 문서' : '원문+번역 한 쌍') + ' · 조각 ' + (x.chunks || 0) + '개</li>';
      }).join('');
      $('tx-estimate').innerHTML =
        '<div class="tx-sub">처리할 문서 ' + (d.docs || []).length + '개</div>'
        + (docs ? '<ul class="tx-list">' + docs + '</ul>' : '<p class="tx-note">처리할 문서가 없습니다.</p>')
        + rejectedHtml(d.rejected)
        + '<div class="tx-cost">'
        +   '<div><span>조각</span><strong>' + (e.chunks || 0) + '개</strong></div>'
        +   '<div><span>글자 수</span><strong>' + (Number(d.chars) || 0).toLocaleString() + '자</strong></div>'
        +   '<div><span>예상 비용</span><strong id="tx-est-usd">' + usd(e.usd) + '</strong></div>'
        +   '<div><span>남은 예산 / 상한</span><strong id="tx-est-remaining">' + usd(b.remaining) + ' / ' + usdCap(b.cap != null ? b.cap : 50) + '</strong></div>'
        + '</div>'
        + '<p class="tx-note">' + esc(e.model || '') + (e.batch ? ' · 배치 처리' : '') + (b.expires ? ' · 크레딧 만료 ' + esc(b.expires) : '') + '</p>';
      $('tx-estimate').style.display = 'block';
      $('tx-budget').innerHTML = budgetLine(b);
      if (d.allowed && (d.docs || []).length) {
        $('tx-start-btn').disabled = false;
        msg(d.message || '예산 안입니다. [추출 시작]을 누르면 시작합니다.');
      } else {
        $('tx-start-btn').disabled = true;
        msg(d.message || (!(d.docs || []).length ? '처리할 문서가 없습니다.' : '남은 예산을 넘어 시작할 수 없습니다.'), true);
      }
    } catch (e2) {
      msg('서버 연결 실패: ' + e2.message, true);
    } finally {
      btn.disabled = false;
    }
  };

  window.txStart = async function () {
    var fd;
    try { fd = buildForm(); } catch (e) { msg(e.message, true); return; }
    var btn = $('tx-start-btn');
    btn.disabled = true;
    msg('시작하는 중…');
    try {
      var r = await post('/api/admin/term-extract/start', fd);
      var d = r.data;
      if (r.status === 402) { msg(d.message || '남은 예산을 넘어 시작하지 않았습니다.', true); return; }
      if (r.status === 409) {
        msg('이미 진행 중인 추출 작업이 있습니다. 끝난 뒤 다시 시작해 주세요.', true);
        if (d.jobId) txWatch(d.jobId);
        return;
      }
      if (r.status !== 200 || !d.ok) {
        msg(d.message || d.error || '시작하지 못했습니다.', true);
        if (d.rejected) { $('tx-estimate').innerHTML = rejectedHtml(d.rejected); $('tx-estimate').style.display = 'block'; }
        return;
      }
      msg('추출을 시작했습니다. 10초마다 진행 상황을 불러옵니다.');
      showToast('용어 추출을 시작했습니다', 'success');
      txWatch(d.jobId);
    } catch (e2) {
      msg('서버 연결 실패: ' + e2.message, true);
      btn.disabled = false;
    }
  };

  function txWatch(jobId) {
    TX_JOB = jobId;
    if (TX_TIMER) clearInterval(TX_TIMER);
    $('tx-job').style.display = 'block';
    txPoll();
    TX_TIMER = setInterval(txPoll, TX_POLL_MS);
  }
  window.txWatch = txWatch;

  async function txPoll() {
    var id = TX_JOB;
    if (!id) return;
    try {
      var r = await fetch(API_BASE + '/api/admin/term-extract/jobs/' + encodeURIComponent(id), { headers: authHeaders() });
      var j = await r.json();
      if (id !== TX_JOB) return;
      if (!j.ok) { $('tx-job-meta').textContent = '진행 상황을 불러오지 못했습니다: ' + (j.error || r.status); return; }
      renderJob(j);
      if (j.status !== '진행 중') { clearInterval(TX_TIMER); TX_TIMER = null; }
    } catch (e) {
      $('tx-job-meta').textContent = '진행 상황을 불러오지 못했습니다(다음 차례에 다시 시도): ' + e.message;
    }
  }
  window.txPoll = txPoll;

  function fmtTime(s) { if (!s) return ''; var d = new Date(s); return isNaN(d) ? esc(s) : d.toLocaleString('ko-KR'); }

  function renderJob(j) {
    $('tx-job-status').innerHTML = statusBadge(j.status);
    $('tx-job-meta').innerHTML = '작업 ' + esc(j.jobId) + ' · 시작 ' + fmtTime(j.startedAt)
      + (j.finishedAt ? ' · 끝남 ' + fmtTime(j.finishedAt) : '')
      + (j.estimate && j.estimate.usd != null ? ' · 예상 비용 ' + usd(j.estimate.usd) : '');
    $('tx-job-progress').textContent = (j.progress || []).join('\n');
    var out = '';
    if (j.error) out += '<p class="tx-msg warn">' + esc(j.error) + '</p>';
    var res = j.result;
    if (res) {
      if (res.message) out += '<p class="tx-note">' + esc(res.message) + '</p>';
      var grid = function (title, obj, map) {
        var ks = Object.keys(obj || {});
        if (!ks.length) return '';
        return '<div class="tx-sub">' + title + '</div><div class="tx-sum">'
          + ks.map(function (k) { return '<div><span>' + esc(label(map, k)) + '</span><strong>' + esc(obj[k]) + '</strong></div>'; }).join('')
          + '</div>';
      };
      out += grid('뽑기', res.stat, STAT_LABEL);
      out += grid('확정 결과', res.result, RESULT_LABEL);
      var ex = res.excludedReasons || {};
      var exk = Object.keys(ex);
      if (exk.length) out += '<div class="tx-sub">제외 사유</div><ul class="tx-list">' + exk.map(function (k) { return '<li>' + esc(k) + ' — ' + esc(ex[k]) + '건</li>'; }).join('') + '</ul>';
      if (res.costUsd != null) out += '<div class="tx-cost"><div><span>실제 비용</span><strong id="tx-job-cost">' + usd(res.costUsd) + '</strong></div></div>';
    }
    if (j.rejected && j.rejected.length) out += rejectedHtml(j.rejected);
    $('tx-job-result').innerHTML = out;
  }
})();
