// 인트로 점 세계지도 · 한반도 윤곽 — Natural Earth(퍼블릭 도메인) → index.html 의 path d 를 한 번 변환
//   원본은 저장소에 넣지 않는다. 내려받아 경로만 넘긴다:
//   curl -sSL -o ne_110m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
//   curl -sSL -o ne_50m_admin_0_countries.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//   node scripts/build_intro_map.mjs <ne_110m_land.geojson> <ne_50m_admin_0_countries.geojson> [--write]
//
// 투영: 등장방형, 중심 경도 동경 127도(서울이 가로 정가운데), 위도 75°N ~ -54.6°
// 격자: 1.8° 간격, 칸 가운데 점이 육지면 찍는다 → 200열 × 72행
// 좌표 단위 = 격자 1칸 (점은 열 c, 행 r 정수). 화면 배치·배율은 인트로 스크립트(size())가 정한다.
// 점 하나 = "h0" (둥근 선끝) — 같은 줄의 다음 점은 상대 이동 "m<칸> 0h0" 로 이어 붙여 용량을 줄인다.
// 한반도 = 50m 남(KOR)·북(PRK) 폴리곤에서 둘이 맞닿은 경계(휴전선)만 지우고 이은 윤곽 — 같은 격자 단위, 소수 둘째 자리.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const STEP = 1.8, LON0 = 127, LAT_TOP = 75, COLS = 200, ROWS = 72;
const [src110, src50] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!src110 || !src50) { console.error('사용법: node scripts/build_intro_map.mjs <ne_110m_land.geojson> <ne_50m_admin_0_countries.geojson> [--write]'); process.exit(1); }
const polysOf = (f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];

// ── 1. 점 세계지도 (110m land)
const polys = JSON.parse(fs.readFileSync(src110, 'utf8')).features.flatMap(polysOf);   // [[outer, ...holes], ...] (경도·위도)
const bbox = polys.map(p => p[0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]));
function inRing(ring, x, y) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function isLand(lon, lat) {
  for (let k = 0; k < polys.length; k++) {
    const b = bbox[k];
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (inRing(polys[k][0], lon, lat) && !polys[k].slice(1).some(h => inRing(h, lon, lat))) return true;
  }
  return false;
}
let d = '', dots = 0, minR = ROWS, maxR = 0;
for (let r = 0; r < ROWS; r++) {
  const lat = LAT_TOP - STEP * (r + 0.5);
  let last = null;
  for (let c = 0; c < COLS; c++) {
    let lon = LON0 - 180 + STEP * (c + 0.5);
    if (lon > 180) lon -= 360;
    if (!isLand(lon, lat)) continue;
    d += last === null ? `M${c} ${r}h0` : `m${c - last} 0h0`;
    last = c; dots++; minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }
}
console.log(`점 ${dots}개 · 행 ${minR}~${maxR} · 점 지도 ${(d.length / 1024).toFixed(1)}KB`);

// ── 2. 한반도 윤곽 (50m 남·북) — 맞닿은 경계를 지우고 나머지 변을 이어 닫힌 고리로
const kr = JSON.parse(fs.readFileSync(src50, 'utf8')).features.filter(f => ['KOR', 'PRK'].includes(f.properties.ADM0_A3)).flatMap(polysOf);
const key = (p) => p[0].toFixed(6) + ',' + p[1].toFixed(6);
const edges = [], seen = new Map();
for (const poly of kr) for (const ring of poly) for (let i = 0; i < ring.length - 1; i++) {
  const a = ring[i], b = ring[i + 1], ka = key(a), kb = key(b);
  if (ka === kb) continue;
  const und = ka < kb ? ka + '|' + kb : kb + '|' + ka;
  seen.set(und, (seen.get(und) || 0) + 1);
  edges.push({ a, b, ka, kb, und });
}
const keep = edges.filter(e => seen.get(e.und) === 1);
const from = new Map(); for (const e of keep) { if (!from.has(e.ka)) from.set(e.ka, []); from.get(e.ka).push(e); }
const used = new Set(), rings = [];
for (const e0 of keep) {
  if (used.has(e0)) continue;
  const ring = [e0.a]; let e = e0;
  while (e && !used.has(e)) { used.add(e); ring.push(e.b); e = (from.get(e.kb) || []).find(x => !used.has(x)); }
  rings.push(ring);
}
const U = ([lon, lat]) => [(((lon - LON0 + 540) % 360) - 180 + 180) / STEP - 0.5, (LAT_TOP - lat) / STEP - 0.5];   // 점 격자와 같은 단위
const n2 = (x) => { const s = (Math.round(x * 100) / 100).toString(); return s.replace(/^(-?)0\./, '$1.'); };
let k = '', pts = 0;
for (const ring of rings) {
  const P = ring.map(U); let [px, py] = P[0];
  k += `M${n2(px)} ${n2(py)}`;
  for (let i = 1; i < P.length - 1; i++) {
    const dx = Math.round((P[i][0] - px) * 100) / 100, dy = Math.round((P[i][1] - py) * 100) / 100;
    if (!dx && !dy) continue;
    k += `l${n2(dx)}${dy < 0 ? '' : ' '}${n2(dy)}`; px += dx; py += dy; pts++;
  }
  k += 'z';
}
console.log(`한반도 고리 ${rings.length}개 · 점 ${pts}개 · 지운 맞닿은 변 ${edges.length - keep.length} · 윤곽 ${(k.length / 1024).toFixed(1)}KB`);

if (process.argv.includes('--write')) {
  const file = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../index.html');
  let html = fs.readFileSync(file, 'utf8');
  for (const [id, val] of [['land', d], ['korea', k]]) {
    const re = new RegExp(`(<path id="${id}"[^>]*? d=")[^"]*(")`);
    if (!re.test(html)) { console.error(`index.html 에 <path id="${id}" … d=""> 가 없습니다`); process.exit(1); }
    html = html.replace(re, `$1${val}$2`);
  }
  fs.writeFileSync(file, html);
  console.log('index.html 갱신');
}
