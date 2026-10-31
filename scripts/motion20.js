/* 아이움 모션그래픽 시안 (2026-10-31, 약 20초) — 이야기 하나: 아이움 AI 엔진이 계약서 한 장을 완성해 가는 과정
   ★그림은 시간 t(초)의 함수 하나(render) — 같은 t 면 같은 화면. scripts/record_motion.mjs 가 seek(t) 로 한 장씩 찍어 묶는다.
   ★슬라이드(페이드) 대신: 카메라가 계속 움직이고(천천히 확대·이동), 전환은 덮기·밀기·확대·뒤로 빠지기.
   ★문구는 사이트와 같게(아이움 AI 엔진 · 최종 휴먼터치 · 가림 문구). 계약서는 지어낸 문장·이름·번호.
   쓰는 법: IUMMMotion.record('16x9'|'9x16') → { seek(t) } , IUMMMotion.DUR */
(function(){
  if (window.IUMMMotion) return;
  var DUR = 20.5;
  var SIZE = { '16x9': [1920, 1080], '9x16': [1080, 1920] };

  function c01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function out3(x){ x = c01(x); return 1 - Math.pow(1 - x, 3); }
  function io3(x){ x = c01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function back(x){ x = c01(x); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function seg(t, a, b, f){ return (f || out3)((t - a) / (b - a)); }
  function lin(t, a, b){ return c01((t - a) / (b - a)); }
  function mix(a, b, k){ return a + (b - a) * k; }
  function el(tag, cls, html, parent){ var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function on(e, vis){ e.style.visibility = vis ? 'visible' : 'hidden'; }

  var CSS = [
    '.mm-st{position:absolute;left:0;top:0;overflow:hidden;background:#0F2540;color:#fff;font-family:"Pretendard Variable",Pretendard,sans-serif}',
    '.mm-l{position:absolute;inset:0;overflow:hidden;visibility:hidden}',
    '.mm-cam{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}',
    '.mm-navy{background:#0F2540}.mm-paper{background:#FAFAF7}',
    /* 은은한 점 무늬(남색 화면) — 카메라와 함께 천천히 흐른다 */
    '.mm-dots{position:absolute;left:-20%;top:-20%;width:140%;height:140%;background-image:radial-gradient(rgba(157,183,245,0.10) 1.6px,transparent 1.8px);background-size:44px 44px}',
    '.mm-paper .mm-dots{background-image:radial-gradient(rgba(15,37,64,0.07) 1.6px,transparent 1.8px)}',
    /* ① 도입 */
    '.mm-line{position:absolute;height:4px;background:#B08D57;transform-origin:50% 50%}',
    '.mm-hl{position:absolute;left:0;right:0;text-align:center;font-weight:700;letter-spacing:-2px;line-height:1.22;color:#fff}',
    '.mm-hl .r{display:block;overflow:hidden;padding:0 0 .06em}.mm-hl .r>span{display:inline-block;will-change:transform}',
    /* ② 계약서 */
    '.mm-doc{position:absolute;background:#fff;border:1.5px solid rgba(15,37,64,0.16);color:#1B2433;box-shadow:0 30px 80px rgba(15,37,64,0.12)}',
    '.mm-doc .ttl{text-align:center;font-weight:700;color:#0F2540;letter-spacing:6px}',
    '.mm-doc .pt{display:flex;gap:18px;color:#4A5568}.mm-doc .pt b{color:#0F2540;font-weight:700}',
    '.mm-doc .cl{color:#1B2433;word-break:keep-all}.mm-doc .cl b{color:#0F2540}',
    '.mm-doc .w{transition:none}',
    '.mm-pii{position:relative;display:inline-block}',
    '.mm-pii i{position:absolute;left:-6px;right:-6px;top:4%;bottom:4%;background:#0F2540;transform-origin:0 50%}',
    '.mm-scan{position:absolute;left:-40px;right:-40px;height:110px;margin-top:-108px;background:linear-gradient(rgba(31,79,209,0),rgba(31,79,209,0.16));border-bottom:3px solid #1F4FD1}',
    '.mm-en{color:#1F4FD1;font-weight:600;word-break:keep-all}',
    '.mm-en .k{background:linear-gradient(#B08D57,#B08D57) no-repeat 0 100%/0% 5px;padding-bottom:2px}',
    '.mm-cur{display:inline-block;width:3px;margin-left:2px;background:#1F4FD1;vertical-align:-0.15em;height:1.05em}',
    '.mm-cap{position:absolute;left:0;right:0;text-align:center;font-weight:700;color:#0F2540;word-break:keep-all;line-height:1.4}',
    '.mm-cap .bar{display:inline-block;padding:16px 34px;background:#0F2540;color:#fff}',
    '.mm-term{position:absolute;background:#0F2540;color:#fff;border-top:6px solid #B08D57;text-align:left;transform-origin:50% 60%}',
    '.mm-term .ko{font-weight:700;color:#C9D7FB}.mm-term .ar{color:#B08D57;font-weight:700}.mm-term .en{font-weight:700;color:#fff;letter-spacing:-1px;white-space:nowrap}',
    /* ④ 검수·점수 */
    '.mm-rows{position:absolute}',
    '.mm-row{display:flex;align-items:center;justify-content:space-between;gap:24px;white-space:nowrap;border-bottom:1.5px solid rgba(157,183,245,0.22);color:#EEF3FB;font-weight:600}',
    '.mm-ck{flex:none;border-radius:50%;background:#1F4FD1;position:relative}',
    '.mm-ck:after{content:"";position:absolute;left:36%;top:18%;width:22%;height:44%;border:solid #fff;border-width:0 5px 5px 0;transform:rotate(45deg)}',
    '.mm-score{position:absolute;text-align:center}',
    '.mm-score .lb{font-weight:700;color:#C9D7FB;letter-spacing:2px}',
    '.mm-score .num{font-weight:700;color:#fff;letter-spacing:-3px;line-height:1.1;white-space:nowrap}',
    '.mm-score .num .rg{display:inline-block;overflow:hidden;vertical-align:bottom;white-space:nowrap}',
    '.mm-score .gl{height:4px;background:#B08D57;transform-origin:0 50%;margin:18px auto 0}',
    '.mm-human{position:absolute;left:0;right:0;text-align:center;font-weight:700;color:#fff;letter-spacing:-1px;word-break:keep-all}',
    '.mm-human .r{display:block;overflow:hidden}.mm-human .r>span{display:inline-block}',
    /* ⑤ 여덟 분야 */
    '.mm-grid{position:absolute;inset:0}',
    '.mm-tile{position:absolute;display:flex;align-items:center;justify-content:center;border:2px solid rgba(157,183,245,0.5);background:rgba(255,255,255,0.03);font-weight:700;color:#fff;letter-spacing:-1px}',
    '.mm-tile.c{border-color:#B08D57;background:transparent}',
    /* 덮기 블록 */
    '.mm-wipe{position:absolute;top:0;bottom:0;width:100%;background:#B08D57}',
    /* ⑥ 끝 */
    '.mm-end{position:absolute;left:0;right:0;text-align:center}',
    '.mm-end .p{font-weight:700;color:#fff;letter-spacing:-2px;line-height:1.2}',
    '.mm-end .fr{font-weight:700;color:#C9D7FB;margin-top:22px}',
    '.mm-logo{position:absolute;left:0;right:0;text-align:center}',
    '.mm-logo .lg{letter-spacing:14px;line-height:1;font-weight:700}.mm-logo .lg .a{color:#9DB7F5}.mm-logo .lg .b{color:#fff}',
    '.mm-logo .ul{height:4px;background:#B08D57;margin:34px auto 0;transform-origin:50% 50%}',
    '.mm-logo .sl{margin-top:30px;font-weight:500;letter-spacing:2px;color:#C9D7FB}',
    '.mm-logo .url{margin-top:26px;font-weight:700;letter-spacing:3px;color:#C9A877}'
  ].join('\n');

  // 지어낸 계약서(실제 문서·이름·번호 아님)
  var DOC = {
    ttl: '용역 계약서',
    parties: [['갑', '<span class="mm-pii">홍길동<i></i></span>', '주민등록번호 <span class="mm-pii">800101-1234567<i></i></span>'],
              ['을', '주식회사 한빛', '연락처 <span class="mm-pii">010-1234-5678<i></i></span>']],
    c1: '<b>제1조(계약금)</b> 갑은 본 계약 체결일로부터 30일 이내에 계약금 5,000,000원을 을에게 지급한다.',
    c2: ['<b>제2조(지체상금)</b>', '을이', '납기를', '지키지', '못한', '경우', '지체일수', '1일당', '계약금액의', '0.1%를', '지체상금으로', '갑에게', '지급한다.'],
    en: ['Article 2 (Liquidated Damages) If Party B fails to meet the delivery date, Party B shall pay Party A ', 'liquidated damages', ' of 0.1% of the contract amount for each day of delay.']
  };
  var ROWS = ['Party A shall pay a deposit of KRW 5,000,000', 'within 30 days', 'liquidated damages of 0.1%', 'for each day of delay'];
  var FIELDS = ['게임', '법률', '의료', '회계', '특허', '학술', 'ESG', '매뉴얼'];

  function build(st, orient){
    var v = orient === '9x16', W = SIZE[orient][0], H = SIZE[orient][1];
    function layer(cls){ var l = el('div', 'mm-l ' + cls, null, st); var c = el('div', 'mm-cam', null, l); el('div', 'mm-dots', null, c); return { l: l, c: c }; }
    function px(e, o){ for (var k in o) e.style[k] = typeof o[k] === 'number' ? o[k] + 'px' : o[k]; return e; }
    function cam(c, s, x, y){ c.style.transform = 'translate(' + (x || 0).toFixed(1) + 'px,' + (y || 0).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')'; }
    function rise(r, k, dy){ r.style.transform = 'translateY(' + ((1 - k) * (dy == null ? 105 : dy)).toFixed(1) + '%)'; }

    // ── ① 0~3초 도입: 금색 선 + 큰 문구 ──
    var L1 = layer('mm-navy');
    var lineY = v ? 1180 : 690;
    var line = px(el('div', 'mm-line', null, L1.c), { left: W * 0.15, width: W * 0.7, top: lineY });
    var hlFs = v ? 158 : 116;
    var hlRows = v ? ['한 단어도', '허투루', '옮기지', '않습니다.'] : ['한 단어도', '허투루 옮기지 않습니다.'];
    var hl = px(el('p', 'mm-hl mb', hlRows.map(function(r){ return '<span class="r"><span>' + r + '</span></span>'; }).join(''), L1.c), { fontSize: hlFs });
    hl.style.top = (lineY - 40 - hlRows.length * hlFs * 1.22 - 8) + 'px';
    var hlIn = [].slice.call(hl.querySelectorAll('.r>span'));

    // ── ②③ 3~11초 계약서: 들어옴 → 스캔·가림 → 확대 → 영어로 바뀜 → 용어 카드 ──
    var L2 = layer('mm-paper');
    var dW = v ? 960 : 1180, dFs = v ? 36 : 30;
    var doc = px(el('div', 'mm-doc', null, L2.c), { width: dW, left: (W - dW) / 2, top: v ? 240 : 120, padding: v ? '56px 58px 64px' : '52px 72px 60px', fontSize: dFs, lineHeight: '1.75' });
    px(el('div', 'ttl mb', DOC.ttl, doc), { fontSize: dFs * 1.7, marginBottom: 34 });
    DOC.parties.forEach(function(p){ var r = el('div', 'pt', '<b>' + p[0] + '</b><span>' + p[1] + '</span><span>' + p[2] + '</span>', doc); px(r, { marginBottom: 8, flexWrap: 'wrap' }); });
    px(el('div', 'cl', DOC.c1, doc), { marginTop: 30 });
    var c2 = px(el('div', 'cl', DOC.c2.map(function(w){ return '<span class="w">' + w + '</span>'; }).join(' '), doc), { marginTop: 22 });
    var c2w = [].slice.call(c2.querySelectorAll('.w'));
    var en = px(el('div', 'mm-en', '<span class="a"></span><span class="k"></span><span class="z"></span><span class="mm-cur"></span>', doc), { marginTop: 16, minHeight: dFs * 1.75 * (v ? 4 : 3) });
    var enA = en.querySelector('.a'), enK = en.querySelector('.k'), enZ = en.querySelector('.z'), cur = en.querySelector('.mm-cur');
    var scan = el('div', 'mm-scan', null, doc);
    var piis = [].slice.call(doc.querySelectorAll('.mm-pii'));
    var cap = px(el('p', 'mm-cap', '<span class="bar">유출·노출되지 않도록 자동으로 가려진 상태로 번역이 시작됩니다</span>', L2.l), { fontSize: v ? 34 : 38, top: v ? 1560 : 930 });
    if (v) cap.querySelector('.bar').style.cssText = 'padding:18px 30px;max-width:900px';
    var term = px(el('div', 'mm-term', '<div class="ko mb">지체상금</div><div class="ar">↓</div><div class="en mb" lang="en">liquidated damages</div>', L2.l),
      v ? { left: 70, right: 70, top: 150, padding: '36px 50px 44px' } : { right: 90, top: 70, padding: '30px 52px 38px' });
    px(term.querySelector('.ko'), { fontSize: v ? 84 : 72 }); px(term.querySelector('.ar'), { fontSize: v ? 44 : 36, margin: '2px 0' }); px(term.querySelector('.en'), { fontSize: v ? 92 : 96, lineHeight: '1.15' });

    // ── ④ 11~14.5초 줄마다 검수 체크 → 점수 ──
    var L3 = layer('mm-navy');
    var inner = el('div', 'mm-cam', null, L3.c);   // ⑤ 에서 가운데 칸으로 줄어드는 판
    var rows = px(el('div', 'mm-rows', ROWS.map(function(r){ return '<div class="mm-row" lang="en"><span>' + r + '</span><span class="mm-ck"></span></div>'; }).join(''), inner),
      v ? { left: 80, right: 80, top: 200 } : { left: 120, width: 960, top: 150 });
    [].forEach.call(rows.children, function(r){ px(r, { fontSize: v ? 38 : 38, padding: v ? '26px 0' : '22px 0' }); px(r.lastChild, { width: 54, height: 54 }); });
    var rowEls = [].slice.call(rows.children), cks = rowEls.map(function(r){ return r.lastChild; });
    var score = px(el('div', 'mm-score', '<div class="lb">품질 점수</div><div class="num mb"><span class="n">0</span><span class="rg">~99</span>점</div><div class="gl"></div>', inner),
      v ? { left: 0, right: 0, top: 860 } : { left: 1120, width: 700, top: 170 });
    px(score.querySelector('.lb'), { fontSize: v ? 44 : 40 }); px(score.querySelector('.num'), { fontSize: v ? 190 : 150, marginTop: 18 });
    px(score.querySelector('.gl'), { width: v ? 520 : 460 });
    var sN = score.querySelector('.n'), sR = score.querySelector('.rg'), sG = score.querySelector('.gl');
    var human = px(el('p', 'mm-human mb', (v ? ['남은 점수는', '최종 휴먼터치로', '채웁니다'] : ['남은 점수는 최종 휴먼터치로 채웁니다']).map(function(r){ return '<span class="r"><span>' + r + '</span></span>'; }).join(''), inner),
      { fontSize: v ? 104 : 96, lineHeight: '1.25', top: v ? 1340 : 760 });
    var humIn = [].slice.call(human.querySelectorAll('.r>span'));

    // ── ⑤ 14.5~17초 뒤로 빠지며 여덟 분야 ──
    var grid = el('div', 'mm-grid', null, L3.c);
    var tw = v ? 300 : 520, th = v ? 520 : 300, gx = v ? 30 : 40, gy = v ? 40 : 40;
    var cx = W / 2, cy = H / 2, tiles = [];
    var slots = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    slots.forEach(function(s, i){
      var t = px(el('div', 'mm-tile mb', FIELDS[i], grid), { width: tw, height: th, left: cx + s[0] * (tw + gx) - tw / 2, top: cy + s[1] * (th + gy) - th / 2, fontSize: FIELDS[i] === 'ESG' ? (v ? 88 : 92) : (v ? 92 : 96) });
      t.setAttribute('lang', FIELDS[i] === 'ESG' ? 'en' : 'ko'); tiles.push({ e: t, s: s, d: Math.abs(s[0]) + Math.abs(s[1]) });
    });
    var cTile = px(el('div', 'mm-tile c', null, grid), { width: tw, height: th, left: cx - tw / 2, top: cy - th / 2 });
    var shrink = Math.min(tw / W, th / H) * 0.92;

    // ── 덮기 블록(⑤→⑥) ──
    var wipe = el('div', 'mm-wipe', null, st);

    // ── ⑥ 17~20.5초 가격 → 로고 ──
    var L4 = layer('mm-navy');
    var end = px(el('div', 'mm-end', '<div class="p mb">' + (v ? '글자당<br>25원부터' : '글자당 25원부터') + '</div><div class="fr">1,000자 무료 테스트</div>', L4.c), { top: v ? 640 : 330 });
    px(end.querySelector('.p'), { fontSize: v ? 170 : 128 }); px(end.querySelector('.fr'), { fontSize: v ? 76 : 68 });
    var logo = px(el('div', 'mm-logo', '<div class="lg mb" aria-label="IUMM"><span class="a">IU</span><span class="b">MM</span></div><div class="ul"></div><div class="sl" lang="en">Faithful to every word.</div><div class="url" lang="en">iumm.kr</div>', L4.c), { top: v ? 700 : 300 });
    px(logo.querySelector('.lg'), { fontSize: v ? 190 : 150 }); px(logo.querySelector('.ul'), { width: v ? 560 : 520 });
    px(logo.querySelector('.sl'), { fontSize: v ? 50 : 44 }); px(logo.querySelector('.url'), { fontSize: v ? 60 : 54 });
    var lg = logo.querySelector('.lg'), lul = logo.querySelector('.ul'), lsl = logo.querySelector('.sl'), lurl = logo.querySelector('.url');

    function dotDrift(layerObj, t, sx, sy){ layerObj.c.firstChild.style.transform = 'translate(' + (t * sx).toFixed(1) + 'px,' + (t * sy).toFixed(1) + 'px)'; }
    function relTop(e, root){ var y = 0; while (e && e !== root) { y += e.offsetTop; e = e.offsetParent; } return y; }

    // ★t(초) → 화면
    return function render(t){
      // ① ─────────────────────────────
      on(L1.l, t < 3.25);
      if (t < 3.25) {
        cam(L1.c, mix(1.14, 1.0, seg(t, 0, 3.2, io3)), 0, mix(30, -10, seg(t, 0, 3.2, io3)));
        dotDrift(L1, t, -14, -8);
        line.style.transform = 'scaleX(' + seg(t, 0.12, 0.95, io3).toFixed(4) + ')';
        hlIn.forEach(function(r, i){ rise(r, seg(t, 0.55 + i * 0.16, 1.25 + i * 0.16)); });
      }
      // ②③ ───────────────────────────
      var k2 = seg(t, 2.55, 3.2, io3);   // 종이 화면이 아래에서 덮으며 올라옴
      on(L2.l, t >= 2.55 && t < 11.3);
      if (t >= 2.55 && t < 11.3) {
        var push = seg(t, 10.6, 11.25, io3);  // ④ 로 밀기
        L2.l.style.transform = 'translate(' + (-push * W).toFixed(1) + 'px,' + ((1 - k2) * H).toFixed(1) + 'px)';
        dotDrift(L2, t, 10, -12);
        // 계약서 들어오기(오른쪽에서, 살짝 기운 채)
        var kIn = seg(t, 2.9, 3.8);
        doc.style.transform = 'translateX(' + ((1 - kIn) * W * 0.55).toFixed(1) + 'px) rotate(' + ((1 - kIn) * 5).toFixed(2) + 'deg)';
        // 카메라: 천천히 다가감 → 6.7~7.6 제2조로 확대 → 계속 천천히 흐름
        var docTop = parseFloat(doc.style.top), dh = doc.offsetHeight;
        var Py = docTop + relTop(c2, doc) + c2.offsetHeight * 0.5 + (v ? 120 : 70), Px = W / 2;
        var zk = seg(t, 6.6, 7.7, io3), s0 = mix(1.0, 1.07, lin(t, 3, 6.6)), s1 = (v ? 1.06 : 1.42) + (v ? 0.04 : 0.07) * lin(t, 7.7, 11);
        var s = mix(s0, s1, zk);
        var tx = mix(mix(0, -24, lin(t, 3, 6.6)), -s * (Px - W / 2) - (v ? 0 : 30) * lin(t, 7.7, 11), zk);
        var ty = mix(mix(H * 0.5 - (docTop + dh / 2), -20 + H * 0.5 - (docTop + dh / 2), lin(t, 3, 6.6)) * (v ? 0.0 : 1), -s * (Py - H / 2), zk);
        cam(L2.c, s, tx, ty);
        // 스캔 선 · 가림 블록
        var sk = lin(t, 3.95, 5.35);
        scan.style.top = (sk * (dh + 110)).toFixed(1) + 'px'; scan.style.opacity = sk > 0 && sk < 1 ? 1 : 0;
        piis.forEach(function(p){ var py = relTop(p, doc) + p.offsetHeight; var tp = 3.95 + 1.4 * (py / (dh + 110)); p.firstElementChild.style.transform = 'scaleX(' + seg(t, tp, tp + 0.28).toFixed(3) + ')'; });
        var kc = seg(t, 5.0, 5.5) * (1 - seg(t, 6.4, 6.8));
        cap.style.opacity = kc.toFixed(3); cap.style.transform = 'translateY(' + ((1 - seg(t, 5.0, 5.5)) * 24).toFixed(1) + 'px)';
        // 한국어 → 영어(한 단어씩)
        var ty0 = 7.7, ty1 = 9.45, full = DOC.en.join(''), n = Math.round(lin(t, ty0, ty1) * full.length);
        var a = DOC.en[0].length, b = a + DOC.en[1].length;
        enA.textContent = full.slice(0, Math.min(n, a)); enK.textContent = n > a ? full.slice(a, Math.min(n, b)) : ''; enZ.textContent = n > b ? full.slice(b, n) : '';
        cur.style.opacity = t > ty0 - 0.2 && t < ty1 + 0.4 && (Math.floor(t * 4) % 2 === 0 || t < ty1) ? 1 : 0;
        c2w.forEach(function(w, i){ var wt = ty0 + (ty1 - ty0) * (i / c2w.length); w.style.opacity = (1 - 0.72 * seg(t, wt, wt + 0.3)).toFixed(3); });
        enK.style.backgroundSize = (seg(t, 9.2, 9.6) * 100).toFixed(1) + '% 5px';
        // 용어 카드 튀어나옴
        var kt = seg(t, 9.35, 9.95, back);
        term.style.opacity = c01(lin(t, 9.35, 9.55)).toFixed(3);
        term.style.transform = 'translateY(' + ((1 - c01(kt)) * 40 + lin(t, 9.95, 11) * -10).toFixed(1) + 'px) scale(' + mix(0.55, 1, kt).toFixed(4) + ')';
      }
      // ④⑤ ───────────────────────────
      on(L3.l, t >= 10.6 && t < 17.45);
      if (t >= 10.6 && t < 17.45) {
        var pin = seg(t, 10.6, 11.25, io3);
        L3.l.style.transform = 'translateX(' + ((1 - pin) * W).toFixed(1) + 'px)';
        dotDrift(L3, t, -12, 9);
        cam(L3.c, mix(1.0, 1.05, lin(t, 10.6, 14.4)) * mix(1, 0.93, seg(t, 14.4, 17.4, io3)), mix(0, -20, lin(t, 10.6, 17.4)), 0);
        rowEls.forEach(function(r, i){ var a = 11.0 + i * 0.12; r.style.opacity = seg(t, a, a + 0.35).toFixed(3); r.style.transform = 'translateX(' + ((1 - seg(t, a, a + 0.45)) * -60).toFixed(1) + 'px)'; });
        cks.forEach(function(c, i){ var a = 11.45 + i * 0.3; c.style.transform = 'scale(' + seg(t, a, a + 0.35, back).toFixed(3) + ')'; });
        score.style.opacity = seg(t, 11.5, 11.9).toFixed(3);
        sN.textContent = String(Math.round(95 * seg(t, 11.6, 12.85)));
        var kr = seg(t, 12.85, 13.25, io3); sR.style.maxWidth = (kr * 3.2).toFixed(3) + 'em'; sR.style.opacity = kr.toFixed(3);
        sG.style.transform = 'scaleX(' + seg(t, 12.95, 13.45).toFixed(3) + ')';
        humIn.forEach(function(r, i){ rise(r, seg(t, 13.25 + i * 0.14, 13.85 + i * 0.14)); });
        // 판이 가운데 칸으로 줄어들고, 여덟 분야가 펼쳐짐
        var kz = seg(t, 14.4, 15.3, io3);
        inner.style.transform = 'scale(' + mix(1, shrink, kz).toFixed(4) + ')';
        cTile.style.opacity = seg(t, 14.9, 15.3).toFixed(3);
        tiles.forEach(function(o, i){ var a = 14.95 + i * 0.09 + o.d * 0.05, k = seg(t, a, a + 0.5, back);
          o.e.style.opacity = c01(lin(t, a, a + 0.25)).toFixed(3);
          o.e.style.transform = 'translate(' + (-(1 - c01(k)) * o.s[0] * (tw + gx)).toFixed(1) + 'px,' + (-(1 - c01(k)) * o.s[1] * (th + gy)).toFixed(1) + 'px) scale(' + mix(0.4, 1, k).toFixed(4) + ')'; });
      }
      // 덮기 블록 ─────────────────────
      var w1 = seg(t, 16.95, 17.45, io3), w2 = seg(t, 17.45, 17.95, io3);
      on(wipe, t > 16.95 && t < 17.95);
      wipe.style.transform = 'translateX(' + ((t < 17.45 ? (w1 - 1) : w2) * W).toFixed(1) + 'px)';
      // ⑥ ─────────────────────────────
      on(L4.l, t >= 17.45);
      if (t >= 17.45) {
        dotDrift(L4, t, 9, -10);
        cam(L4.c, mix(1.0, 1.08, lin(t, 17.45, DUR)), 0, mix(10, -10, lin(t, 17.45, DUR)));
        var ke = seg(t, 17.6, 18.2), kx = seg(t, 18.45, 19.0, io3);
        end.style.opacity = (c01(lin(t, 17.6, 17.9)) * (1 - kx)).toFixed(3);
        end.style.transform = 'translateY(' + ((1 - ke) * 70 - kx * (v ? 320 : 240)).toFixed(1) + 'px) scale(' + mix(1, 0.85, kx).toFixed(4) + ')';
        var kl = seg(t, 18.65, 19.3, back);
        lg.style.opacity = c01(lin(t, 18.65, 18.9)).toFixed(3); lg.style.transform = 'scale(' + mix(0.8, 1, kl).toFixed(4) + ')'; lg.style.letterSpacing = mix(60, 14, seg(t, 18.65, 19.4)).toFixed(1) + 'px';
        lul.style.transform = 'scaleX(' + seg(t, 18.9, 19.5, io3).toFixed(3) + ')';
        lsl.style.opacity = seg(t, 19.25, 19.65).toFixed(3); lsl.style.transform = 'translateY(' + ((1 - seg(t, 19.25, 19.75)) * 20).toFixed(1) + 'px)';
        lurl.style.opacity = seg(t, 19.5, 19.9).toFixed(3); lurl.style.transform = 'translateY(' + ((1 - seg(t, 19.5, 20.0)) * 20).toFixed(1) + 'px)';
      }
    };
  }

  // 녹화용 — 화면 전체를 덮는 상자
  function record(orient){
    orient = SIZE[orient] ? orient : '16x9';
    if (!document.getElementById('mm-css')) { var s = el('style'); s.id = 'mm-css'; s.textContent = CSS; document.head.appendChild(s); }
    var W = SIZE[orient][0], H = SIZE[orient][1];
    var st = el('div', 'mm-st'); st.id = 'mm-rec';
    st.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;width:' + W + 'px;height:' + H + 'px';
    document.body.appendChild(st);
    var render = build(st, orient);
    return { seek: function(t){ render(Math.max(0, Math.min(DUR, t))); return t; } };
  }
  window.IUMMMotion = { record: record, DUR: DUR };
})();
