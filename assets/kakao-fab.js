/* 상담하기 버튼 — 고객 화면 공통 조각 (2026-10-15, 2026-10-30 하나로 합침)
 *
 * ★이 파일 하나만 고친다. 페이지마다 버튼 마크업·CSS 를 복사하지 말 것.
 *   쓰는 곳: 메인(index.html), 관리자 공증 도구 화면(notary/edit.html),
 *            비공개 견적 화면(/q/… — 백엔드 notary/quotePage.js). 어드민에는 넣지 않는다.
 *   불러오기: <script src="/assets/kakao-fab.js" defer></script>
 *     data-pad="1"    본문 끝에 버튼 높이만큼 여백을 둔다(마지막 버튼이 가려지지 않게)
 *     data-raise=".x" 모바일에서 이 요소(하단 고정 버튼 줄)가 보이는 동안 그 높이만큼 버튼을 올린다
 *
 * ★z-index 650 — 주문(300)·검수자(400)·결제(500)·계좌입금(600) 모달 위, 알림창(9999↑) 아래.
 *   전체화면 서브페이지(로그인·약관·마이페이지, 200)가 열려도 보인다.
 * ★2026-10-30 네이버 톡톡(초록)·카카오톡(노랑) 두 버튼을 남색 '상담하기' 하나로 합쳤다.
 *   누르면 위로 두 경로가 펼쳐진다(각 서비스 색 그대로). 바깥을 누르거나 Esc 로 닫힌다.
 *   주소는 고객용 talk.naver.com · pf.kakao.com 만 쓴다. 장식 그림자 없이 테두리로 바탕과 구분한다.
 */
(function () {
  if (document.getElementById('iumm-kakao-fab')) return;
  var KAKAO_URL = 'https://pf.kakao.com/_BlpKX/chat';
  var NTALK_URL = 'https://talk.naver.com/ct/w3r4x3p';
  var me = document.currentScript || {};
  var opt = (me.dataset) || {};

  var css =
    '#iumm-kakao-fab{position:fixed;right:22px;bottom:26px;z-index:650;display:flex;flex-direction:column;align-items:flex-end;gap:8px}' +
    '#iumm-kakao-fab .fab-main,#iumm-kakao-fab .fab-go a{display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;' +
      'height:48px;padding:0 20px;border-radius:6px;font-family:inherit;font-size:16px;font-weight:700;line-height:1;letter-spacing:-0.02em;' +
      'white-space:nowrap;text-decoration:none;cursor:pointer}' +
    '#iumm-kakao-fab .fab-main{border:1px solid rgba(255,255,255,0.45);background:#0F2540;color:#fff;transition:background .15s}' +
    '#iumm-kakao-fab .fab-main:hover{background:#1F4FD1}' +
    '#iumm-kakao-fab .fab-main:focus-visible,#iumm-kakao-fab .fab-go a:focus-visible{outline:3px solid #9DB7F5;outline-offset:3px}' +
    '#iumm-kakao-fab .fab-go{display:none;flex-direction:column;align-items:stretch;gap:8px}' +
    '#iumm-kakao-fab.open .fab-go{display:flex}' +
    '#iumm-kakao-fab .fab-go a{justify-content:flex-start;border:1px solid rgba(0,0,0,0.12)}' +
    '#iumm-kakao-fab .fab-go a.ntalk{background:#03C75A;color:#fff}' +
    '#iumm-kakao-fab .fab-go a.kakao{background:#FEE500;color:rgba(0,0,0,0.85)}' +
    '#iumm-kakao-fab svg{width:19px;height:19px;flex:0 0 auto;display:block}' +
    '.iumm-kfab-pad{height:90px}' +
    '@media(max-width:640px){' +
      '#iumm-kakao-fab{right:12px;bottom:14px}' +
      '#iumm-kakao-fab .fab-main,#iumm-kakao-fab .fab-go a{height:46px;padding:0 16px;font-size:15px}' +
    '}';

  var BUBBLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.98 3 2.9 6.24 2.9 10.24c0 2.55 1.68 4.79 4.21 6.06-.19.68-.67 2.43-.77 2.81-.12.47.17.47.36.34.15-.1 2.42-1.64 3.4-2.31.61.09 1.24.14 1.9.14 5.02 0 9.1-3.24 9.1-7.04S17.02 3 12 3z"/></svg>';
  var NBOX = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3.5h14A2.5 2.5 0 0 1 21.5 6v9a2.5 2.5 0 0 1-2.5 2.5h-6.3l-4.6 3.6c-.4.3-.9 0-.9-.5v-3.1H5A2.5 2.5 0 0 1 2.5 15V6A2.5 2.5 0 0 1 5 3.5z"/></svg>';

  function mount() {
    if (document.getElementById('iumm-kakao-fab')) return;
    var st = document.createElement('style');
    st.id = 'iumm-kakao-fab-css';
    st.textContent = css;
    document.head.appendChild(st);

    var box = document.createElement('div');
    box.id = 'iumm-kakao-fab';
    box.innerHTML =
      '<div class="fab-go" id="iumm-fab-go">' +
      '<a class="ntalk" href="' + NTALK_URL + '" target="_blank" rel="noopener noreferrer" title="네이버 톡톡 상담 (새 창)">' + NBOX + '<span>네이버 톡톡</span></a>' +
      '<a class="kakao" href="' + KAKAO_URL + '" target="_blank" rel="noopener noreferrer" title="카카오톡 상담 (새 창)">' + BUBBLE + '<span>카카오톡</span></a>' +
      '</div>' +
      '<button type="button" class="fab-main" aria-expanded="false" aria-controls="iumm-fab-go">' + BUBBLE + '<span>상담하기</span></button>';
    document.body.appendChild(box);

    var main = box.querySelector('.fab-main');
    function setOpen(on) {
      box.classList.toggle('open', on);
      main.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    main.addEventListener('click', function () { setOpen(!box.classList.contains('open')); });
    box.querySelector('.fab-go').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) { setOpen(false); main.focus(); }
    });

    if (opt.pad === '1') {
      var pad = document.createElement('div');
      pad.className = 'iumm-kfab-pad';
      pad.setAttribute('aria-hidden', 'true');
      document.body.appendChild(pad);
    }

    // 하단 버튼 줄과 겹치지 않게 그 위로 올린다.
    // ★모바일은 줄이 화면 하단에 붙어 있고(sticky), 데스크톱은 본문 끝에 있다 —
    //   어느 쪽이든 줄이 버튼 자리(화면 오른쪽 아래)에 걸쳐 있으면 올린다.
    if (opt.raise) {
      var place = function () {
        var bar = document.querySelector(opt.raise);
        var base = window.innerWidth <= 640 ? 14 : 26;
        var lift = 0;
        if (bar && bar.offsetParent !== null) {
          var r = bar.getBoundingClientRect();
          var a = main.getBoundingClientRect();  // 펼친 경로가 아니라 '상담하기' 버튼 자리 기준
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
