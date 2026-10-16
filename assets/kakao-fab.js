/* 카카오톡 문의 버튼 — 고객 화면 공통 조각 (2026-10-15)
 *
 * ★이 파일 하나만 고친다. 페이지마다 버튼 마크업·CSS 를 복사하지 말 것.
 *   쓰는 곳: 메인(index.html), 공증 위저드(notary/index.html), 번역본 화면(notary/edit.html),
 *            비공개 견적 화면(/q/… — 백엔드 notary/quotePage.js). 어드민에는 넣지 않는다.
 *   불러오기: <script src="/assets/kakao-fab.js" defer></script>
 *     data-pad="1"    본문 끝에 버튼 높이만큼 여백을 둔다(마지막 버튼이 가려지지 않게)
 *     data-raise=".x" 모바일에서 이 요소(하단 고정 버튼 줄)가 보이는 동안 그 높이만큼 버튼을 올린다
 *
 * ★z-index 650 — 주문(300)·검수자(400)·결제(500)·계좌입금(600) 모달 위, 알림창(9999↑) 아래.
 *   전체화면 서브페이지(로그인·약관·마이페이지, 200)가 열려도 보인다.
 * ★모양은 기존 메인 버튼 그대로 — 카카오 브랜드 색(#FEE500, 라벨 검정).
 * ★2026-10-17 네이버 톡톡 문의 버튼을 같은 상자에 넣었다 — 카카오 바로 위, 간격 10px, 크기·모양·그림자 동일,
 *   네이버 그린 #03C75A · 흰 글자. 주소는 고객용 talk.naver.com 만 쓴다.
 */
(function () {
  if (document.getElementById('iumm-kakao-fab')) return;
  var KAKAO_URL = 'https://pf.kakao.com/_BlpKX/chat';
  var NTALK_URL = 'https://talk.naver.com/ct/w3r4x3p';
  var me = document.currentScript || {};
  var opt = (me.dataset) || {};

  var css =
    '#iumm-kakao-fab{position:fixed;right:22px;bottom:26px;z-index:650;display:flex;flex-direction:column;align-items:stretch;gap:10px}' +
    '#iumm-kakao-fab a{display:inline-flex;align-items:center;justify-content:center;gap:9px;box-sizing:border-box;' +
      'height:48px;padding:0 18px;border-radius:12px;background:#FEE500;color:rgba(0,0,0,0.85);' +
      'border:1px solid rgba(0,0,0,0.05);box-shadow:0 5px 16px rgba(0,0,0,0.30);' +
      'font-family:inherit;font-size:16.5px;font-weight:700;line-height:1;letter-spacing:-0.03em;' +
      'white-space:nowrap;text-decoration:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}' +
    '#iumm-kakao-fab a.ntalk{background:#03C75A;color:#fff}' +
    '#iumm-kakao-fab a:hover{transform:translateY(-2px);box-shadow:0 9px 24px rgba(0,0,0,0.40)}' +
    '#iumm-kakao-fab svg{width:19px;height:19px;flex:0 0 auto;display:block}' +
    '.iumm-kfab-pad{height:142px}' +
    '@media(max-width:640px){' +
      '#iumm-kakao-fab{right:12px;bottom:14px}' +
      // ★모바일은 글자를 숨기고 노란 원형 아이콘(지름 52px, 말풍선만) — 본문을 덜 가린다
      '#iumm-kakao-fab a{width:52px;height:52px;padding:0;border-radius:50%;gap:0}' +
      '#iumm-kakao-fab a span{display:none}' +
      '#iumm-kakao-fab svg{width:24px;height:24px}' +
    '}';

  function mount() {
    if (document.getElementById('iumm-kakao-fab')) return;
    var st = document.createElement('style');
    st.id = 'iumm-kakao-fab-css';
    st.textContent = css;
    document.head.appendChild(st);

    var box = document.createElement('div');
    box.id = 'iumm-kakao-fab';
    box.innerHTML =
      '<a class="ntalk" href="' + NTALK_URL + '" target="_blank" rel="noopener noreferrer" aria-label="네이버 톡톡 문의" title="네이버 톡톡 문의 (새 창)">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3.5h14A2.5 2.5 0 0 1 21.5 6v9a2.5 2.5 0 0 1-2.5 2.5h-6.3l-4.6 3.6c-.4.3-.9 0-.9-.5v-3.1H5A2.5 2.5 0 0 1 2.5 15V6A2.5 2.5 0 0 1 5 3.5z"/></svg>' +
      '<span>네이버 톡톡 문의</span></a>' +
      '<a href="' + KAKAO_URL + '" target="_blank" rel="noopener noreferrer" aria-label="카카오톡 문의" title="카카오톡 문의 (새 창)">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.98 3 2.9 6.24 2.9 10.24c0 2.55 1.68 4.79 4.21 6.06-.19.68-.67 2.43-.77 2.81-.12.47.17.47.36.34.15-.1 2.42-1.64 3.4-2.31.61.09 1.24.14 1.9.14 5.02 0 9.1-3.24 9.1-7.04S17.02 3 12 3z"/></svg>' +
      '<span>카카오톡 문의</span></a>';
    document.body.appendChild(box);

    if (opt.pad === '1') {
      var pad = document.createElement('div');
      pad.className = 'iumm-kfab-pad';
      pad.setAttribute('aria-hidden', 'true');
      document.body.appendChild(pad);
    }

    // 하단 버튼 줄(위저드 이전/다음·결제)과 겹치지 않게 그 위로 올린다.
    // ★모바일은 줄이 화면 하단에 붙어 있고(sticky), 데스크톱은 본문 끝에 있다 —
    //   어느 쪽이든 줄이 버튼 자리(화면 오른쪽 아래)에 걸쳐 있으면 올린다.
    if (opt.raise) {
      var place = function () {
        var bar = document.querySelector(opt.raise);
        var base = window.innerWidth <= 640 ? 14 : 26;
        var lift = 0;
        if (bar && bar.offsetParent !== null) {
          var r = bar.getBoundingClientRect();
          var a = box.getBoundingClientRect();  // 톡톡 + 카카오 두 버튼을 합친 상자
          var zoneTop = window.innerHeight - base - a.height - 8;
          var zoneLeft = window.innerWidth - (window.innerWidth <= 640 ? 12 : 22) - a.width - 8;
          if (r.top < window.innerHeight && r.bottom > zoneTop && r.right > zoneLeft) lift = Math.ceil(window.innerHeight - r.top) + 8;
        }
        box.style.bottom = (lift ? lift : base) + 'px';
      };
      place();
      window.addEventListener('scroll', place, { passive: true });
      window.addEventListener('resize', place);
      // 단계가 바뀌면 막대 위치·표시가 바뀐다 — 가볍게 주기 확인
      setInterval(place, 400);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
