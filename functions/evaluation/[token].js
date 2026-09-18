// /evaluation/<토큰> 를 evaluation/index.html 로 '리다이렉트 없이' 서빙한다.
//
// ★왜 Function 이어야 하나
//   evaluation/index.html:81 은 token 을 URL 마지막 조각에서 읽는다. 그래서 주소가
//   그대로 유지돼야 한다. _redirects 의 `200` rewrite 로는 안 된다 —
//   Cloudflare Pages 가 이걸 rewrite 가 아니라 308 리다이렉트로 처리해서
//   /evaluation 으로 잘라버리고, 그러면 token 이 'evaluation' 이 된다(실측).
export const onRequest = ({ request, env }) => serveAsset(env, request, '/evaluation/');

async function serveAsset(env, request, path) {
  let res = await env.ASSETS.fetch(new URL(path, request.url));
  // ASSETS 가 경로 정규화로 308 을 주면 한 번 따라간다 (본문이 비어 오는 걸 막는다)
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc) res = await env.ASSETS.fetch(new URL(loc, request.url));
  }
  return new Response(res.body, { status: 200, headers: res.headers });
}
