// 모션그래픽 시안(약 20초) → 무음 원본 · 효과음 조합 A/B/C · 장면별 정지 화면 · 움직임 비율 (2026-10-31)
//   node scripts/record_motion.mjs                 정지 화면 + 무음 원본(가로·세로) + 효과음 묶기 + 움직임 비율
//   node scripts/record_motion.mjs --stills-only   정지 화면만
//   node scripts/record_motion.mjs --mix-only      이미 만든 무음 원본에 효과음만 다시 묶기(효과음 파일을 새로 받았을 때)
//   node scripts/record_motion.mjs --measure=<mp4> 움직임 비율만 재기
// 그림 = scripts/motion20.js 의 render(t) 를 Playwright(무료)로 한 장씩 찍고 ffmpeg(무료, ffmpeg-static)로 묶는다.
// 효과음 = Pixabay(상업 사용 가능·출처 표기 불필요) — MOTION_OUT/sfx_raw 에 받은 파일, 출처는 sfx_sources.txt.
// 결과: MOTION_OUT (기본 C:/Users/nanpa/iumm_internal/ads/motion_draft) — 기존 iumm_25s_* 영상은 건드리지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TOOLS = process.env.AD_TOOLS || 'C:/Users/nanpa/iumm_internal/ads/_tools';
const OUT = process.env.MOTION_OUT || 'C:/Users/nanpa/iumm_internal/ads/motion_draft';
const SFX = path.join(OUT, 'sfx_raw');
const req = createRequire(path.join(TOOLS, 'package.json'));
const FFMPEG = req('ffmpeg-static');
const FPS = 30, DUR = 20.5;
const SIZE = { '16x9': [1920, 1080], '9x16': [1080, 1920] };
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const has = (k) => process.argv.includes(`--${k}`);
// 장면별 대표 정지 화면 (① 도입 ② 가림 ③ 용어 카드 ④ 점수 ⑤ 여덟 분야 ⑥ 로고)
const STILL_AT = [1.9, 5.7, 10.2, 14.0, 16.5, 20.4];
// 효과음 자리: 도입 = 큰 문구가 다 올라온 순간에 '한 방', 마무리 = 로고가 나타나는 순간
const T_HIT = 1.4, T_LOGO = 18.75, LUFS = -16;
// 조합 — 파일 이름 안의 Pixabay 번호로 찾는다
const COMBO = {
  A: { intro: '242635', outro: '147350' },
  B: { intro: '289802', outro: '153279' },
  C: { intro: '578002', outro: '152476' },
};
fs.mkdirSync(OUT, { recursive: true });

const ff = (args) => execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
const silentOf = (o) => path.join(OUT, `_silent_${o}.mp4`);

async function render(orients, stillsOnly) {
  const { chromium } = req('playwright-core');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };
  const server = http.createServer((q, s) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const o of orients) {
      const [W, H] = SIZE[o];
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.goto(BASE, { waitUntil: 'load' });
      await page.addScriptTag({ url: 'scripts/motion20.js' });
      await page.evaluate(async (o) => {
        window.__mm = IUMMMotion.record(o);
        // 글꼴(MaruBuri·Pretendard)을 먼저 다 불러온 뒤 찍는다
        await Promise.all([document.fonts.load('700 100px MaruBuri'), document.fonts.load('600 40px "Pretendard Variable"')]);
        await document.fonts.ready; window.__mm.seek(0);
      }, o);
      await page.waitForTimeout(600);
      if (o === '16x9' || stillsOnly) {
        for (let i = 0; i < STILL_AT.length; i++) {
          await page.evaluate((t) => window.__mm.seek(t), STILL_AT[i]);
          await page.screenshot({ path: path.join(OUT, `motion_scene${i + 1}_${o}.png`) });
        }
        console.log(`[${o}] 정지 화면 ${STILL_AT.length}장`);
      }
      if (stillsOnly) { await page.close(); continue; }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `iumm-motion-${o}-`));
      const N = Math.round(FPS * DUR);
      for (let f = 0; f < N; f++) {
        await page.evaluate((t) => window.__mm.seek(t), f / FPS);
        await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
        if (f % 150 === 0) console.log(`[${o}] ${f}/${N}`);
      }
      await page.close();
      ff(['-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'), '-frames:v', String(N), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', silentOf(o)]);
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`[${o}] 무음 원본 ${silentOf(o)} (${(fs.statSync(silentOf(o)).size / 1e6).toFixed(1)}MB)`);
    }
  } finally { await browser.close(); server.close(); }
}

// ── 효과음 ─────────────────────────────────────────
const findSfx = (id) => (fs.existsSync(SFX) ? fs.readdirSync(SFX) : []).find((f) => f.includes(id) && /\.(mp3|wav|ogg)$/i.test(f));
function pcm(file) {   // 모노 48kHz float
  const b = execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}
function peakTime(x) {   // 50ms 창 RMS 가 가장 큰 곳(초)
  const w = 2400; let best = 0, at = 0;
  for (let i = 0; i + w < x.length; i += 480) { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; if (s > best) { best = s; at = i; } }
  return (at + w / 2) / 48000;
}
function lufs(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...(r.stderr || '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? parseFloat(m[1]) : null;
}
// 한 소리를 자리에 맞춰 자르고(앞뒤 페이드) -16 LUFS 로 맞춘 wav
function prep(file, at, keepBefore, keepAfter, endBy, tag) {
  const x = pcm(file), len = x.length / 48000, pk = peakTime(x);
  // 최댓값이 영상의 at 초에 오도록: 앞부분이 영상 0초보다 앞서면 그만큼 소리 앞을 잘라 낸다
  const s0 = Math.max(0, pk - Math.min(keepBefore, at)), s1 = Math.min(len, pk + keepAfter, s0 + (endBy - (at - (pk - s0))));
  const start = at - (pk - s0), d = s1 - s0, fo = Math.min(0.6, d * 0.35);
  const raw = path.join(os.tmpdir(), `iumm-sfx-${tag}.wav`), out = path.join(os.tmpdir(), `iumm-sfx-${tag}-n.wav`);
  ff(['-ss', s0.toFixed(3), '-t', d.toFixed(3), '-i', file, '-ac', '2', '-ar', '48000', '-af', `afade=t=in:st=0:d=${s0 > 0 ? 0.06 : 0.01},afade=t=out:st=${(d - fo).toFixed(3)}:d=${fo.toFixed(3)}`, raw]);
  const l = lufs(raw), g = l == null ? 0 : Math.max(-20, Math.min(12, LUFS - l));
  ff(['-i', raw, '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.89:level=false`, out]);
  return { wav: out, start: Math.max(0, start), peak: pk, len, cut: [s0, s1], lufsIn: l, gain: g, lufsOut: lufs(out) };
}
function mix(o, key) {
  const c = COMBO[key], fi = findSfx(c.intro), fo = findSfx(c.outro);
  if (!fs.existsSync(silentOf(o))) return console.log(`  [${o} ${key}] 무음 원본 없음 — 먼저 녹화`);
  if (!fi && !fo) return console.log(`  [${o} ${key}] 효과음 파일 없음 (sfx_raw 에 ${c.intro} · ${c.outro})`), null;
  const parts = [];
  if (fi) parts.push(prep(path.join(SFX, fi), T_HIT, 2.2, 1.6, T_HIT + 2.2, `${key}-in`));
  if (fo) parts.push(prep(path.join(SFX, fo), T_LOGO, 0.9, 2.6, DUR - 0.05, `${key}-out`));
  const dst = path.join(OUT, `motion_${o}_${key}${fi && fo ? '' : '_partial'}.mp4`);
  const ins = parts.flatMap((p) => ['-i', p.wav]);
  const fl = parts.map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.start * 1000)}|${Math.round(p.start * 1000)}[a${i}]`).join(';') +
    ';' + parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${DUR}[aout]`;
  ff(['-i', silentOf(o), ...ins, '-filter_complex', fl, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(DUR), '-movflags', '+faststart', dst]);
  console.log(`  [${o} ${key}] ${path.basename(dst)} — ` + parts.map((p) => `${p.wav.includes('-in') ? '도입' : '마무리'} 최댓값 ${p.peak.toFixed(2)}s→영상 ${(p.start + (p.peak - p.cut[0])).toFixed(2)}s · ${p.lufsIn?.toFixed(1)}→${p.lufsOut?.toFixed(1)} LUFS`).join(' / '));
  return dst;
}

// ── 움직임 비율: 앞 프레임과 견줘 화면이 바뀐 프레임의 비율 ──
export function measure(file) {
  const w = 320, h = 180;
  const b = execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const n = Math.floor(b.length / (w * h)); let moving = 0, longest = 0, run = 0;
  for (let f = 1; f < n; f++) {
    let changed = 0; const a = (f - 1) * w * h, c = f * w * h;
    for (let i = 0; i < w * h; i++) if (Math.abs(b[a + i] - b[c + i]) > 2) changed++;
    if (changed / (w * h) > 0.002) { moving++; run = 0; } else { run++; longest = Math.max(longest, run); }
  }
  return { frames: n, moving: moving / (n - 1), longestStillSec: longest / FPS };
}

const only = arg('only'), ORIENTS = only ? [only] : ['16x9', '9x16'];
if (arg('measure')) { for (const f of arg('measure').split(',')) console.log(path.basename(f), JSON.stringify(measure(f))); process.exit(0); }
if (!has('mix-only')) await render(ORIENTS, has('stills-only'));
if (!has('stills-only')) {
  console.log('효과음 묶기');
  const made = [];
  if (ORIENTS.includes('16x9')) for (const k of ['A', 'B', 'C']) made.push(mix('16x9', k));
  if (ORIENTS.includes('9x16')) made.push(mix('9x16', 'A'));
  // 사이트 소개 영상 창용(조합 A) — 가볍게 다시 압축(crf 26) + 첫 화면 그림(1.9초, 큰 문구)
  for (const o of ORIENTS) {
    const src = [`motion_${o}_A.mp4`, `motion_${o}_A_partial.mp4`].map((f) => path.join(OUT, f)).find((f) => fs.existsSync(f));
    if (!src) continue;
    const dst = path.join(ROOT, 'assets', `motion_${o}.mp4`);
    ff(['-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dst]);
    ff(['-ss', '1.9', '-i', silentOf(o), '-frames:v', '1', '-q:v', '4', path.join(ROOT, 'assets', `motion_poster_${o}.jpg`)]);
    console.log(`  사이트용 assets/motion_${o}.mp4 (${(fs.statSync(dst).size / 1e6).toFixed(1)}MB, ${path.basename(src)})`);
  }
  console.log('움직임 비율 (앞 프레임과 0.2% 넘게 다른 프레임)');
  for (const o of ORIENTS) if (fs.existsSync(silentOf(o))) console.log(`  ${o}`, JSON.stringify(measure(silentOf(o))));
}
