// 인트로 점 세계지도 — Natural Earth 110m land(퍼블릭 도메인) → index.html <path id="land" d="…"> 한 번 변환
//   원본은 저장소에 넣지 않는다. 내려받아 경로만 넘긴다:
//   curl -sSL -o ne_110m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
//   node scripts/build_intro_map.mjs <ne_110m_land.geojson 경로> [--write]
//
// 투영: 등장방형, 중심 경도 동경 127도(서울이 가로 정가운데), 위도 75°N ~ -54.6°
// 격자: 1.8° 간격, 칸 가운데 점이 육지면 찍는다 → 200열 × 72행
// 좌표 단위 = 격자 1칸 (열 c, 행 r 정수). 화면 배치·배율은 인트로 스크립트(size())가 정한다.
// 점 하나 = "h0" (둥근 선끝) — 같은 줄의 다음 점은 상대 이동 "m<칸> 0h0" 로 이어 붙여 용량을 줄인다.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const STEP = 1.8, LON0 = 127, LAT_TOP = 75, COLS = 200, ROWS = 72;
const src = process.argv[2];
if (!src) { console.error('사용법: node scripts/build_intro_map.mjs <ne_110m_land.geojson> [--write]'); process.exit(1); }
const geo = JSON.parse(fs.readFileSync(src, 'utf8'));

const polys = [];   // [[outer, ...holes], ...] (경도·위도)
for (const f of geo.features) {
  const g = f.geometry;
  if (g.type === 'Polygon') polys.push(g.coordinates);
  else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
}
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
console.log(`점 ${dots}개 · 행 ${minR}~${maxR} · path d ${(d.length / 1024).toFixed(1)}KB`);

if (process.argv.includes('--write')) {
  const file = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../index.html');
  const html = fs.readFileSync(file, 'utf8');
  const re = /(<path id="land"[^>]*? d=")[^"]*(")/;
  if (!re.test(html)) { console.error('index.html 에 <path id="land" … d=""> 가 없습니다'); process.exit(1); }
  fs.writeFileSync(file, html.replace(re, `$1${d}$2`));
  console.log('index.html 갱신');
}
