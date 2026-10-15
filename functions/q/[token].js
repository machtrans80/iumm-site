// /q/<토큰> — 비공개 견적 요청 페이지 중계 (2026-10-15)
//
// ★이 레포는 공개(GitHub)라 토큰·페이지 내용을 여기 두지 않는다.
//   토큰 확인과 페이지 HTML 은 백엔드(비공개 레포)가 맡고, 여기서는 그대로 전달만 한다.
//   어디에서도 링크하지 않는다. 검색엔진 차단: noindex 헤더 + 페이지 메타 + robots.txt(/q/).
const API = 'https://iumm-pipeline-production.up.railway.app';

export async function onRequestGet({ params }) {
  const token = String(params.token || '');
  const headers = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  let res;
  try {
    res = await fetch(API + '/api/notary/quote-page/' + encodeURIComponent(token), { cf: { cacheTtl: 0 } });
  } catch (e) {
    return new Response('잠시 후 다시 시도해 주세요', { status: 502, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  if (res.status !== 200) {
    return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(await res.text(), { status: 200, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}
