// /reviewer/job/<주문번호> 를 reviewer/job.html 로 '리다이렉트 없이' 서빙한다.
//
// ★왜 Function 이어야 하나
//   job.html:289 는 orderId 를 URL 마지막 조각에서 읽는다. 그래서 주소가
//   그대로 유지돼야 한다. _redirects 의 `200` rewrite 로는 안 된다 —
//   Cloudflare Pages 가 이걸 rewrite 가 아니라 308 리다이렉트로 처리해서
//   /reviewer/job 으로 잘라버리고, 그러면 orderId 가 'job' 이 된다(실측).
export const onRequest = ({ request, env }) => serveAsset(env, request, '/reviewer/job');

async function serveAsset(env, request, path) {
  let res = await env.ASSETS.fetch(new URL(path, request.url));
  // ASSETS 가 경로 정규화로 308 을 주면 한 번 따라간다 (본문이 비어 오는 걸 막는다)
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc) res = await env.ASSETS.fetch(new URL(loc, request.url));
  }
  return new Response(res.body, { status: 200, headers: res.headers });
}
