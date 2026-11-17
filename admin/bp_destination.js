// 우회 주문 '제출 국가 · 영어 표기' (2026-11-02) — 제출 국가는 모든 도착어, 영어 표기는 도착어가 영어일 때만
// 저장은 Airtable 새 칸 없이 번역지시사항(bp-reference-notes) 맨 앞 한 줄: "제출 국가: 캄보디아 · 영어 표기: 미국식" / 영어 밖: "제출 국가: 멕시코"
//   영어 표기 '자동'이면 "영어 표기: 자동(미국식)" — 서버(v2_rules.js detectDestination)는 '미국식/영국식'으로 시작할 때만 직접 지정으로 보고,
//   자동이면 제출 국가로 판단한다(같은 규칙: 영국·영연방 → 영국식, 그 밖·비움 → 미국식).
// 주문 상세 번역문 위 한 줄(destShowOrder)도 여기 — V3/V2 처리 기록의 destination 값.
(function () {
  var UK_RE = /영국|英國|英国|United Kingdom|\bU\.?K\.?\b|Great Britain|\bBritish\b|\bBritain\b|England|잉글랜드|스코틀랜드|Scotland|웨일스|Wales|런던|London/i;
  var COMMONWEALTH_RE = /호주|오스트레일리아|Australia|뉴질랜드|New Zealand|캐나다|Canada|싱가포르|Singapore|인도(?![가-힣])|India|홍콩|Hong Kong|말레이시아|Malaysia|아일랜드|Ireland|남아공|남아프리카|South Africa/i;
  var LINE_RE = /^\s*(제출\s*국가\s*[:：]|영어\s*표기\s*[:：])/;
  var LABEL = { US: '미국식', UK: '영국식' };
  // 포르투갈어 도착(2026-11-17) — 서버 v2_rules.js ptVariantForNation 과 같은 규칙: 포르투갈어권 8곳 = 유럽(pt-PT), 그 밖·없음 = 브라질(pt-BR)
  var PT_PT_RE = /포르투갈|Portugal|앙골라|Angola|모잠비크|Mo[çc]ambique|Mozambique|카보\s*베르데|Cabo\s*Verde|Cape\s*Verde|기니\s*비사우|Guin[ée]\s*-?\s*Bissau|Guinea\s*-?\s*Bissau|상투메|S[ãa]o\s*Tom[ée]|Sao\s*Tome|동\s*티모르|Timor|마카오|마카우|Macau|Macao|澳門|澳门/i;
  var PT_BR_RE = /브라질|Brasil|Brazil/i;
  var PT_LABEL = { PT: '유럽 포르투갈어(pt-PT)', BR: '브라질 포르투갈어(pt-BR)' };
  function ptJudge(nation) { return PT_BR_RE.test(nation) ? 'BR' : PT_PT_RE.test(nation) ? 'PT' : 'BR'; }
  function isPortugueseTarget() { var d = ($('bp-direction') || {}).value || ''; return /→\s*포르투갈어/.test(d); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** 제출 국가 → 'UK' | 'US' (서버 variantForNation 과 같은 규칙) */
  function judge(nation) { return UK_RE.test(nation) || COMMONWEALTH_RE.test(nation) ? 'UK' : 'US'; }
  function isEnglishTarget() { var d = ($('bp-direction') || {}).value || ''; return /→\s*영어/.test(d); }

  window.bpDestRefresh = function () {
    var row = $('bp-dest-row'); if (!row) return;
    row.style.display = '';
    var vc = $('bp-dest-variant-col'); if (vc) vc.style.display = isEnglishTarget() ? '' : 'none';
    var n = ($('bp-dest-nation').value || '').trim(), v = $('bp-dest-variant').value;
    var out = $('bp-dest-judge');
    out.style.color = '#7fb4ff';
    if (isPortugueseTarget()) {
      if (n) out.textContent = '→ ' + PT_LABEL[ptJudge(n)];
      else { out.textContent = '→ 제출 국가 없음 — 브라질식으로 번역'; out.style.color = '#ffcf6b'; }   // 관리자 화면 경고색(destShowOrder 와 같음)
      return;
    }
    if (isEnglishTarget() && v === 'auto') out.textContent = '→ ' + LABEL[judge(n)] + (n ? '' : ' (제출 국가 없음 — 기본값)');
    else out.textContent = '';   // 영어 직접 지정 · 그 밖 언어 = 비움
  };
  /** 지금 칸 값으로 만든 한 줄('' = 안 씀). 도착어가 영어가 아니면 제출 국가만 */
  window.bpDestLine = function () {
    if (!$('bp-dest-row')) return '';
    var n = ($('bp-dest-nation').value || '').replace(/[·|\n]/g, ' ').trim(), v = $('bp-dest-variant').value;
    if (!isEnglishTarget()) return n ? '제출 국가: ' + n : '';
    if (!n && v === 'auto') return '';
    var parts = [];
    if (n) parts.push('제출 국가: ' + n);
    parts.push('영어 표기: ' + (v === 'auto' ? '자동(' + LABEL[judge(n)] + ')' : LABEL[v]));
    return parts.join(' · ');
  };
  /** 지시사항에서 예전 줄을 빼고 새 줄을 맨 앞에(중복 금지, 나머지 내용 그대로) */
  window.bpDestMerge = function (notes) {
    var rest = String(notes || '').split('\n').filter(function (l) { return !LINE_RE.test(l); }).join('\n').replace(/^\s*\n/, '');
    var line = window.bpDestLine();
    return line ? (rest.trim() ? line + '\n' + rest : line) : rest;
  };
  /** [폼에 불러오기]: 지시사항의 그 줄을 읽어 두 칸을 채우고, 나머지만 돌려준다 */
  window.bpDestLoad = function (notes) {
    var lines = String(notes || '').split('\n'), nation = '', variant = 'auto';
    var rest = lines.filter(function (l) {
      if (!LINE_RE.test(l)) return true;
      var n = l.match(/제출\s*국가\s*[:：]\s*([^\n·|]*)/); if (n) nation = n[1].trim();
      var v = l.match(/영어\s*표기\s*[:：]\s*(미국식|영국식)/); if (v) variant = v[1] === '미국식' ? 'US' : 'UK';
      return false;
    }).join('\n').replace(/^\s*\n/, '');
    if ($('bp-dest-nation')) { $('bp-dest-nation').value = nation; $('bp-dest-variant').value = variant; window.bpDestRefresh(); }
    return rest;
  };
  window.bpDestClear = function () { if ($('bp-dest-nation')) { $('bp-dest-nation').value = ''; $('bp-dest-variant').value = 'auto'; window.bpDestRefresh(); } };

  /** 주문 상세 번역문 위: "제출 국가: 캄보디아 · 영어 표기: 미국식 (근거: 관리자 지정)" — 영어 주문(처리 기록에 destination 이 있을 때)만 */
  window.destShowOrder = function (order) {
    var el = $('dest-line'); if (!el) return;
    var q = (order && order.aiQualityDetail) || {};
    var d = (q.v3 && q.v3.destination) || (q.v2 && q.v2.destination) || null;
    var pv = (q.v3 && q.v3.ptVariant) || (q.v2 && q.v2.ptVariant) || null;
    if (!d && pv) {   // 포르투갈어 도착 — 변형 한 줄. 제출 국가가 없어 브라질식이면 그 사실을 눈에 띄게(2026-11-17)
      el.innerHTML = '<i class="ti ti-world" style="font-size:12px;vertical-align:-1px;margin-right:4px"></i>' + (pv.nation
        ? '제출 국가: <strong>' + esc(pv.nation) + '</strong> · 포르투갈어: <strong>' + PT_LABEL[pv.variant === 'PT' ? 'PT' : 'BR'] + '</strong>'
        : '<strong style="color:#ffcf6b">제출 국가 없음 — 브라질식으로 번역</strong> <span style="color:rgba(255,255,255,0.45)">(유럽 포르투갈어가 필요하면 제출 국가를 넣고 재실행)</span>');
      el.style.display = ''; return;
    }
    if (!d) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var basis = /^관리자/.test(d.basis || '') ? '관리자 지정' : /첫머리/.test(d.basis || '') ? '문서 첫머리' : /지시사항/.test(d.basis || '') ? '번역지시사항' : '기본값';
    var label = d.country === 'UK' || d.country === 'OTHER' ? '영국식' : '미국식';
    el.innerHTML = '<i class="ti ti-world" style="font-size:12px;vertical-align:-1px;margin-right:4px"></i>제출 국가: <strong>' + esc(d.nation || '지정 없음') + '</strong> · 영어 표기: <strong>' + label + '</strong> <span style="color:rgba(255,255,255,0.45)">(근거: ' + basis + ')</span>';
    el.style.display = '';
  };

  document.addEventListener('DOMContentLoaded', function () {
    var d = $('bp-direction'); if (d) d.addEventListener('change', window.bpDestRefresh);
    window.bpDestRefresh();
  });
})();
