/* 아이움 25초 소개 영상 (2026-10-30) — 첫 화면 [25초 소개 영상] 창을 열 때만 불러온다(openAd → assets/ad25.js).
   ★그림은 시간 t(초)의 함수 하나(render) — 같은 t 면 같은 화면. 창에선 requestAnimationFrame 으로 돌리고,
     광고 파일은 Playwright 가 seek(t) 로 한 장씩 찍어 30fps MP4 로 묶는다(scripts/record_ad.mjs). 소리 없음.
   ★재료는 지금 사이트 그대로: 지도 인트로의 #land·#korea 점 지도, 첫 화면 대조 패널(계약서), 번역 과정의 흐름 그림, 여덟 분야 칸.
     화면에서 못 찾으면(따로 열었을 때) 같은 문구의 기본값을 쓴다.
   ★움직임 줄이기 = 장면마다 완성된 정지 화면 + 이전·다음 버튼(자동 진행 없음).
   쓰는 법: IUMMAd.mount(상자, { orient:'16x9'|'9x16', still:bool, rec:bool, onFreeTest:fn }) → { play, replay, seek, stop, go, destroy } */
(function(){
  if (window.IUMMAd) return;
  var DUR = 25, FADE = 0.35;
  var SCENES = [[0, 3], [3, 6], [6, 10], [10, 14], [14, 18], [18, 21], [21, 25]];
  var SIZE = { '16x9': [1920, 1080], '9x16': [1080, 1920] };
  var NS = 'http://www.w3.org/2000/svg';

  function c01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x){ x = c01(x); return 1 - Math.pow(1 - x, 3); }
  function seg(t, a, b){ return ease((t - a) / (b - a)); }
  function q(sel, root){ return (root || document).querySelector(sel); }
  function txt(sel, dflt){ var e = q(sel); return e ? e.textContent.trim() : dflt; }
  function el(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CSS = [
    '.ad-box{position:relative;overflow:hidden;background:#0F2540}',
    '.ad-st{position:absolute;left:0;top:0;transform-origin:0 0;background:#0F2540;color:#fff;overflow:hidden}',
    '.ad-sc{position:absolute;inset:0;opacity:0;will-change:opacity,transform}',
    '.ad-cap{position:absolute;left:0;right:0;text-align:center;color:#fff;font-weight:700;letter-spacing:-1px;line-height:1.3;word-break:keep-all}',
    '.ad-h .ad-cap{font-size:76px}.ad-v .ad-cap{font-size:84px;padding:0 70px}',
    '.ad-sub{position:absolute;left:0;right:0;text-align:center;color:#C9D7FB;font-weight:500;line-height:1.6;word-break:keep-all}',
    '.ad-h .ad-sub{font-size:34px}.ad-v .ad-sub{font-size:40px;padding:0 80px}',
    /* ① 지도 */
    '.ad-map{position:absolute;left:0;width:100%}',
    '.ad-map .land{fill:none;stroke:rgba(255,255,255,0.42);stroke-width:.34;stroke-linecap:round}',
    '.ad-map .korea{fill:rgba(176,141,87,0.16);stroke:#C9A877;stroke-width:.16;stroke-linejoin:round}',
    '.ad-map .rt{fill:none;stroke:rgba(201,168,119,0.85);stroke-width:.26;stroke-linecap:round;stroke-dasharray:1 1}',
    '.ad-map .dst{fill:#9DB7F5}.ad-map .home{fill:#9DB7F5}',
    /* ② 두 전문가 */
    '.ad-two{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center}',
    '.ad-v .ad-two{flex-direction:column}',
    '.ad-node{width:440px;padding:40px 24px;border:2px solid rgba(157,183,245,0.55);text-align:center}',
    '.ad-node .k{font-size:52px;font-weight:700;color:#fff}.ad-node .d{margin-top:12px;font-size:32px;font-weight:500;color:#C9D7FB}',
    '.ad-link{position:relative;flex:none}.ad-h .ad-link{width:260px;height:4px}.ad-v .ad-link{width:4px;height:200px}',
    '.ad-link i{position:absolute;left:0;top:0;width:100%;height:100%;background:#C9A877;transform-origin:0 0}',
    /* ③ 대조 패널 */
    '.ad-cmp{position:absolute;background:#FAFAF7;color:#1B2433;padding:56px 64px}',
    '.ad-h .ad-cmp{left:160px;right:160px}.ad-v .ad-cmp{left:70px;right:70px;padding:56px 56px}',
    '.ad-cmp .tag{display:inline-block;padding:4px 14px;border:1.5px solid #1F4FD1;color:#1F4FD1;font-size:24px;font-weight:700}',
    '.ad-cmp .row{display:grid;gap:56px;margin-top:32px}.ad-h .ad-cmp .row{grid-template-columns:1fr 1fr}.ad-v .ad-cmp .row{grid-template-columns:1fr;gap:44px}',
    '.ad-cmp .lang{display:block;margin-bottom:14px;font-size:24px;font-weight:700;color:#4A5568;letter-spacing:.5px}',
    '.ad-cmp .s{margin:0;font-size:44px;line-height:1.7;word-break:keep-all}.ad-v .ad-cmp .s{font-size:46px}',
    '.ad-cmp .t{padding-bottom:2px;background:linear-gradient(#B08D57,#B08D57) no-repeat 0 100%/0% 4px}',
    '.ad-cmp .n{margin:0 2px;padding:0 6px;border:2px solid transparent}',
    '.ad-cmp ul{display:flex;flex-wrap:wrap;gap:16px 40px;margin:44px 0 0;padding:28px 0 0;list-style:none;border-top:1.5px solid rgba(15,37,64,0.14)}',
    '.ad-cmp li{display:flex;align-items:center;gap:14px;font-size:32px;font-weight:700;color:#0F2540}',
    '.ad-cmp li i{width:34px;height:34px;border-radius:50%;background:#1F4FD1;position:relative}',
    '.ad-cmp li i:after{content:"";position:absolute;left:12px;top:6px;width:8px;height:16px;border:solid #fff;border-width:0 4px 4px 0;transform:rotate(45deg)}',
    /* ④ 흐름 */
    '.ad-relay{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:22px}',
    '.ad-v .ad-relay{flex-direction:column;gap:18px}',
    '.ad-v .ad-relay svg{margin:36px 0}',   /* 세로 = 90° 돌린 화살표(112px)가 칸에 겹치지 않게 */
    '.ad-relay .n{padding:26px 34px;border:2px solid rgba(157,183,245,0.6);font-size:44px;font-weight:700;color:#fff;white-space:nowrap}',
    '.ad-relay .n.me{border-color:#C9A877;color:#fff;background:rgba(176,141,87,0.14)}',
    '.ad-relay svg{width:112px;height:40px;flex:none;fill:none;stroke:#C9A877;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    /* ⑤ 분야 용어 */
    '.ad-terms{position:absolute;left:0;right:0;display:grid;gap:44px;justify-content:center}',
    '.ad-h .ad-terms{grid-template-columns:repeat(2,640px);gap:56px 80px}',
    '.ad-term .f{font-size:26px;font-weight:700;color:#C9A877;letter-spacing:1px}',
    '.ad-term .src{margin-top:6px;font-size:28px;font-weight:500;color:#C9D7FB}',
    '.ad-term .x{display:inline-block;margin-top:8px;font-size:48px;font-weight:700;line-height:1.3;color:#fff;padding-bottom:6px;background:linear-gradient(#B08D57,#B08D57) no-repeat 0 100%/0% 4px}',
    '.ad-v .ad-term{padding:0 80px}.ad-v .ad-term .x{font-size:52px}',
    /* ⑥ 보안 */
    '.ad-sec{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:56px}',
    '.ad-v .ad-sec{flex-direction:column;align-items:center;gap:48px}',
    '.ad-card{width:700px;padding:52px 48px;border-top:4px solid #C9A877;background:rgba(255,255,255,0.05)}',
    '.ad-v .ad-card{width:900px}',
    '.ad-card .k{font-size:54px;font-weight:700;line-height:1.3;color:#fff;word-break:keep-all}',
    '.ad-card .d{margin-top:20px;font-size:30px;font-weight:500;line-height:1.6;color:#C9D7FB;word-break:keep-all}',
    /* ⑦ 끝 화면 */
    '.ad-end{position:absolute;left:0;right:0;text-align:center}',
    '.ad-end .p{font-size:96px;font-weight:700;letter-spacing:-1px;color:#fff}',
    '.ad-end .fr{margin-top:18px;font-size:52px;font-weight:700;color:#C9D7FB}',
    '.ad-end .logo{margin-top:84px;font-size:120px;letter-spacing:10px;line-height:1}',
    '.ad-end .logo .a{color:#9DB7F5}.ad-end .logo .b{color:#fff}',
    '.ad-end .sl{margin-top:22px;font-size:34px;font-weight:500;letter-spacing:2px;color:#C9D7FB}',
    '.ad-end .url{margin-top:40px;font-size:44px;font-weight:700;letter-spacing:2px;color:#C9A877}',
    '.ad-end .go{margin-top:44px;display:inline-flex;align-items:center;justify-content:center;min-height:96px;padding:0 56px;border-radius:10px;border:0;background:#1F4FD1;color:#fff;font-size:40px;font-weight:800;cursor:pointer}',
    '.ad-end .go:hover{background:#1A43B3}.ad-end .go:focus-visible{outline:5px solid #9DB7F5;outline-offset:5px}',
    '.ad-v .ad-end .p{font-size:104px}.ad-v .ad-end .logo{font-size:140px}'
  ].join('\n');

  // ── 재료(사이트 화면에서 읽기, 없으면 같은 문구) ──
  function source(){
    var ko = q('#cmp-p-contract .cmp-col[lang="ko"] .cmp-s'), en = q('#cmp-p-contract .cmp-col[lang="en"] .cmp-s');
    var fields = [['legal', '법률', '손해배상액의 예정', 'liquidated damages'], ['medical', '의료', '중대한 이상사례', 'serious adverse event'],
      ['accounting', '회계', '계속기업 관련 중요한 불확실성', 'Material Uncertainty Related to Going Concern'], ['patent', '특허', '진보성', 'inventive step']];
    return {
      land: (q('#intro #land') || {}).getAttribute ? q('#intro #land').getAttribute('d') : '',
      korea: q('#intro #korea') ? q('#intro #korea').getAttribute('d') : '',
      ko: ko ? ko.innerHTML : '<span class="t" data-k="a">갑</span>은 <span class="t" data-k="b">본 계약</span> 체결일로부터 <span class="n" data-k="m">30일</span> 이내에 <span class="t" data-k="c">계약금</span> <span class="n" data-k="p">5,000,000원</span>을 <span class="t" data-k="d">을</span>에게 지급한다.',
      en: en ? en.innerHTML : '<span class="t" data-k="a">Party A</span> shall pay <span class="t" data-k="d">Party B</span> a <span class="t" data-k="c">deposit</span> of <span class="n" data-k="p">KRW 5,000,000</span> within <span class="n" data-k="m">thirty (30) days</span> from the date of execution of <span class="t" data-k="b">this Agreement</span>.',
      fields: fields.map(function(f){
        return { f: txt('#ft-' + f[0] + ' .f', f[1]), src: txt('#ft-' + f[0] + ' .src', f[2]), x: txt('#ft-' + f[0] + ' .x', f[3]) };
      })
    };
  }

  // 지도 좌표 — 지도 인트로(build_intro_map.mjs)와 같은 격자: 경도 127° 가운데, 1.8° 한 칸, 위도 75° 맨 위, 200칸
  var LON0 = 127, STEP = 1.8, LAT_TOP = 75, SEOUL = [126.98, 37.57];
  var CITIES = [[-0.1, 51.5], [2.35, 48.86], [13.4, 52.5], [55.27, 25.2], [72.88, 19.08], [69.2, 41.3], [103.8, 1.35], [106.8, -6.2], [106.7, 10.8],
    [139.7, 35.7], [116.4, 39.9], [106.9, 47.9], [151.2, -33.9], [-118.2, 34.05], [-74, 40.7], [-46.6, -23.5], [37.6, 55.75], [-123.1, 49.3]];
  function gx(lon){ return ((((lon - LON0 + 540) % 360) - 180) + 180) / STEP - 0.5; }
  function gy(lat){ return (LAT_TOP - lat) / STEP - 0.5; }

  function build(stage, o, S){
    var v = o.orient === '9x16', W = SIZE[o.orient][0], H = SIZE[o.orient][1], sc = [];
    function scene(){ var s = el('div', 'ad-sc'); stage.appendChild(s); sc.push(s); return s; }
    function cap(s, text, top, cls){ var c = el('p', (cls || 'ad-cap') + ' mb', esc(text)); c.style.top = top + 'px'; s.appendChild(c); return c; }

    // ① 0~3초 지도
    var s1 = scene(), vb = v ? [52, 0, 100, 72] : [0, 0, 200, 72];
    var mw = W, mh = mw * vb[3] / vb[2];
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'ad-map'); svg.setAttribute('viewBox', vb.join(' '));
    svg.style.top = (v ? 640 : 300) + 'px'; svg.style.height = mh + 'px'; svg.setAttribute('aria-hidden', 'true');
    function sv(tag, cls, d){ var e = document.createElementNS(NS, tag); e.setAttribute('class', cls); if (d) e.setAttribute('d', d); svg.appendChild(e); return e; }
    if (S.land) sv('path', 'land', S.land);
    if (S.korea) sv('path', 'korea', S.korea);
    var hx = gx(SEOUL[0]), hy = gy(SEOUL[1]), routes = [], dsts = [];
    CITIES.forEach(function(c, i){
      var x = gx(c[0]), y = gy(c[1]), mx = (hx + x) / 2, my = Math.min(hy, y) - Math.abs(x - hx) * 0.22 - 2;
      var r = sv('path', 'rt', 'M' + hx.toFixed(2) + ' ' + hy.toFixed(2) + 'Q' + mx.toFixed(2) + ' ' + my.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2));
      r.setAttribute('pathLength', '1'); routes.push(r);
      var d = sv('circle', 'dst'); d.setAttribute('cx', x.toFixed(2)); d.setAttribute('cy', y.toFixed(2)); d.setAttribute('r', '0.55'); dsts.push(d);
    });
    var home = sv('circle', 'home'); home.setAttribute('cx', hx.toFixed(2)); home.setAttribute('cy', hy.toFixed(2)); home.setAttribute('r', '0.9');
    s1.appendChild(svg);
    var c1 = cap(s1, '당신의 가능성을 세계로 연결합니다', v ? 1500 : 110);

    // ② 3~6초 두 전문가
    var s2 = scene();
    var c2 = cap(s2, '한 팀으로 함께 완성합니다', v ? 360 : 200);
    var two = el('div', 'ad-two'); two.style.top = (v ? 760 : 500) + 'px';
    var n1 = el('div', 'ad-node', '<div class="k mb">아이움 AI</div><div class="d">정확하게 기억합니다</div>');
    var lk = el('div', 'ad-link', '<i></i>');
    var n2 = el('div', 'ad-node', '<div class="k mb">전문 번역가</div><div class="d">깊이 이해합니다</div>');
    two.appendChild(n1); two.appendChild(lk); two.appendChild(n2); s2.appendChild(two);

    // ③ 6~10초 대조 패널(계약서 예시)
    var s3 = scene();
    var cmp = el('div', 'ad-cmp', '<span class="tag">예시 · 계약서</span><div class="row"><div><span class="lang">원문 · 한국어</span><p class="s mb">' + S.ko +
      '</p></div><div><span class="lang">번역 · 영어</span><p class="s mb">' + S.en + '</p></div></div><ul><li><i></i>용어 일치</li><li><i></i>숫자 대조</li><li><i></i>최종 휴먼터치</li></ul>');
    cmp.style.top = (v ? 380 : 170) + 'px'; s3.appendChild(cmp);
    var keysT = [], keysN = [];
    [].forEach.call(cmp.querySelectorAll('.row > div:first-child .t'), function(x){ keysT.push(x.getAttribute('data-k')); });
    [].forEach.call(cmp.querySelectorAll('.row > div:first-child .n'), function(x){ keysN.push(x.getAttribute('data-k')); });
    var checks = cmp.querySelectorAll('li');

    // ④ 10~14초 흐름
    var s4 = scene();
    var c4 = cap(s4, '단순 AI 번역이 아닙니다', v ? 300 : 230);
    var arrow2 = '<svg viewBox="0 0 56 20"><path d="M2 6H52M47 1.5L52 6L47 10.5M54 14H4M9 9.5L4 14L9 18.5"/></svg>';
    var arrow1 = '<svg viewBox="0 0 56 20"><path d="M2 10H52M47 5.5L52 10L47 14.5"/></svg>';
    var relay = el('div', 'ad-relay', '<span class="n mb">번역 AI</span>' + arrow2 + '<span class="n mb">검수 AI</span>' + arrow1 + '<span class="n mb">근거 확인</span>' + arrow1 + '<span class="n mb me">최종 휴먼터치</span>');
    relay.style.top = (v ? 640 : 520) + 'px'; s4.appendChild(relay);
    var rparts = [].slice.call(relay.children);
    if (v) rparts.forEach(function(x){ if (x.tagName.toLowerCase() === 'svg') x.setAttribute('data-base', 'rotate(90deg) '); });   // 세로 = 화살표를 아래로

    // ⑤ 14~18초 분야 용어
    var s5 = scene();
    var c5 = cap(s5, '분야마다 쓰는 말이 다릅니다', v ? 260 : 120);
    var terms = el('div', 'ad-terms'); terms.style.top = (v ? 600 : 360) + 'px';
    S.fields.forEach(function(f){ terms.appendChild(el('div', 'ad-term', '<div class="f">' + esc(f.f) + '</div><div class="src">' + esc(f.src) + '</div><span class="x mb" lang="en">' + esc(f.x) + '</span>')); });
    s5.appendChild(terms);
    var tparts = [].slice.call(terms.children);

    // ⑥ 18~21초 보안
    var s6 = scene();
    var secs = el('div', 'ad-sec');
    secs.style.top = (v ? 520 : 330) + 'px';
    secs.innerHTML = '<div class="ad-card"><div class="k mb">학습에 쓰이지 않는 기업용 처리</div><div class="d">학습에 쓰이지 않는 기업용 연결로만 처리합니다.</div></div>' +
      '<div class="ad-card"><div class="k mb">NDA 체결</div><div class="d">요청하시면 번역 전에 비밀유지계약을 체결합니다.</div></div>';
    s6.appendChild(secs);
    var cards = [].slice.call(secs.children);

    // ⑦ 21~25초 끝 화면
    var s7 = scene();
    var end = el('div', 'ad-end', '<div class="p mb">글자당 25원부터</div><div class="fr">1,000자 무료 테스트 번역</div>' +
      '<div class="logo mb" aria-label="IUMM"><span class="a">IU</span><span class="b">MM</span></div><div class="sl" lang="en">Faithful to every word.</div><div class="url" lang="en">iumm.kr</div>' +
      (o.rec ? '' : '<button type="button" class="go" data-ad="free">무료 테스트 번역 신청</button>'));
    end.style.top = (v ? 520 : 150) + 'px'; s7.appendChild(end);
    var eparts = [].slice.call(end.children);

    function show(e, k, dy){ e.style.opacity = k; e.style.transform = (e.getAttribute('data-base') || '') + 'translateY(' + ((1 - k) * (dy == null ? 18 : dy)).toFixed(1) + 'px)'; }

    // ★t(초) → 화면. 순수 함수(같은 t 면 같은 화면)
    return function render(t){
      SCENES.forEach(function(r, i){
        var a = r[0], b = r[1], last = i === SCENES.length - 1;
        var k = Math.min(seg(t, a, a + FADE), last ? 1 : 1 - seg(t, b - FADE, b));
        if (i === 0) k = 1 - seg(t, b - FADE, b);   // 첫 장면은 처음부터 보임(빈 화면 없이)
        sc[i].style.opacity = t >= a - 0.001 && t <= b + 0.001 ? k : 0;
        sc[i].style.visibility = t >= a - 0.001 && t <= b + 0.001 ? 'visible' : 'hidden';
        sc[i].style.transform = 'translateY(' + ((1 - k) * 10).toFixed(1) + 'px)';
      });
      // ①
      show(c1, seg(t, 0.25, 0.95));
      routes.forEach(function(r, i){ var d = 0.35 + i * 0.07, p = seg(t, d, d + 0.9); r.style.strokeDashoffset = (1 - p).toFixed(3); r.style.opacity = p > 0 ? 1 : 0; dsts[i].style.opacity = seg(t, d + 0.75, d + 0.95); });
      // ②
      show(c2, seg(t, 3.15, 3.7));
      show(n1, seg(t, 3.5, 3.95), 0); show(n2, seg(t, 3.6, 4.05), 0);
      lk.firstChild.style.transform = (v ? 'scaleY(' : 'scaleX(') + seg(t, 4.0, 4.8).toFixed(3) + ')';
      // ③
      cmp.style.opacity = seg(t, 6.05, 6.5);
      var tk = function(key){ var i = keysT.indexOf(key); return seg(t, 6.7 + i * 0.32, 7.05 + i * 0.32); };
      [].forEach.call(cmp.querySelectorAll('.t'), function(x){ x.style.backgroundSize = (tk(x.getAttribute('data-k')) * 100).toFixed(1) + '% 4px'; });
      [].forEach.call(cmp.querySelectorAll('.n'), function(x){ var i = keysN.indexOf(x.getAttribute('data-k')); x.style.borderColor = 'rgba(31,79,209,' + seg(t, 8.1 + i * 0.25, 8.4 + i * 0.25).toFixed(3) + ')'; });
      [].forEach.call(checks, function(x, i){ x.style.opacity = (0.25 + 0.75 * seg(t, 8.8 + i * 0.3, 9.1 + i * 0.3)).toFixed(3); });
      // ④
      show(c4, seg(t, 10.15, 10.7));
      rparts.forEach(function(x, i){ show(x, seg(t, 10.7 + i * 0.32, 11.05 + i * 0.32), 0); });
      // ⑤
      show(c5, seg(t, 14.15, 14.7));
      tparts.forEach(function(x, i){ var a = 14.6 + i * 0.7; show(x, seg(t, a, a + 0.35)); x.querySelector('.x').style.backgroundSize = (seg(t, a + 0.25, a + 0.75) * 100).toFixed(1) + '% 4px'; });
      // ⑥
      cards.forEach(function(x, i){ show(x, seg(t, 18.15 + i * 0.45, 18.6 + i * 0.45)); });
      // ⑦
      eparts.forEach(function(x, i){ show(x, seg(t, 21.15 + i * 0.3, 21.55 + i * 0.3)); });
    };
  }

  function mount(box, o){
    o = o || {}; o.orient = SIZE[o.orient] ? o.orient : '16x9';
    if (!document.getElementById('ad25-css')) { var st = el('style'); st.id = 'ad25-css'; st.textContent = CSS; document.head.appendChild(st); }
    var W = SIZE[o.orient][0], H = SIZE[o.orient][1];
    box.innerHTML = ''; box.classList.add('ad-box');
    var stage = el('div', 'ad-st ' + (o.orient === '9x16' ? 'ad-v' : 'ad-h'));
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    box.appendChild(stage);
    var render = build(stage, o, source());
    function fit(){ var s = box.clientWidth / W; stage.style.transform = 'scale(' + s + ')'; box.style.height = (H * s) + 'px'; }
    fit(); window.addEventListener('resize', fit);
    var raf = 0, t0 = 0, cur = 0, idx = 0, onEnd = o.onEnd || function(){};
    var free = stage.querySelector('[data-ad="free"]');
    if (free) free.addEventListener('click', function(){ if (o.onFreeTest) o.onFreeTest(); });
    function seek(t){ cur = Math.max(0, Math.min(DUR, t)); render(cur); return cur; }
    function stop(){ if (raf) cancelAnimationFrame(raf); raf = 0; }
    function loop(now){
      if (!t0) t0 = now - cur * 1000;
      seek((now - t0) / 1000);
      if (cur >= DUR) { raf = 0; onEnd(); return; }
      raf = requestAnimationFrame(loop);
    }
    function play(){ stop(); t0 = 0; raf = requestAnimationFrame(loop); }
    // 움직임 줄이기 — 장면 i 의 완성 화면(장면 끝 0.4초 전, 끝 화면은 마지막)
    function go(i){ idx = Math.max(0, Math.min(SCENES.length - 1, i)); seek(idx === SCENES.length - 1 ? DUR : SCENES[idx][1] - 0.4); return idx; }
    if (o.still) go(0); else seek(0);
    return {
      play: play, stop: stop, seek: seek, go: go, scenes: SCENES.length, duration: DUR,
      replay: function(){ stop(); if (o.still) return go(0); cur = 0; seek(0); play(); },
      time: function(){ return cur; }, index: function(){ return idx; }, playing: function(){ return !!raf; },
      destroy: function(){ stop(); window.removeEventListener('resize', fit); box.innerHTML = ''; }
    };
  }

  // 광고 파일 녹화용 — 화면 전체를 덮는 상자에 띄운다(scripts/record_ad.mjs)
  function record(orient){
    var w = el('div'); w.id = 'ad25-rec';
    w.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;background:#0F2540;width:' + SIZE[orient][0] + 'px';
    document.body.appendChild(w);
    return mount(w, { orient: orient, rec: true });
  }

  window.IUMMAd = { mount: mount, record: record, SCENES: SCENES, DUR: DUR };
})();
