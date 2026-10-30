// 25초 소개 영상 → 광고 파일(무음 30fps MP4 가로·세로) + 장면별 정지 화면 7장 (2026-10-30)
//   node scripts/record_ad.mjs [--only=16x9|9x16] [--stills-only]
// 브라우저 녹화 = Playwright(무료) 로 assets/ad25.js 를 seek(t) 해 한 장씩 찍고, ffmpeg(무료, ffmpeg-static) 로 묶는다.
// 도구 위치(저장소 밖): AD_TOOLS (기본 C:/Users/nanpa/iumm_internal/ads/_tools — npm i playwright-core ffmpeg-static)
// 결과: AD_OUT (기본 C:/Users/nanpa/iumm_internal/ads) — iumm_25s_16x9.mp4 · iumm_25s_9x16.mp4 · iumm_scene{1..7}_{16x9|9x16}.png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TOOLS = process.env.AD_TOOLS || 'C:/Users/nanpa/iumm_internal/ads/_tools';
const OUT = process.env.AD_OUT || 'C:/Users/nanpa/iumm_internal/ads';
const req = createRequire(path.join(TOOLS, 'package.json'));
const { chromium } = req('playwright-core');
const FFMPEG = req('ffmpeg-static');
const FPS = 30, DUR = 25;
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const ORIENTS = (arg('only') ? [arg('only')] : ['16x9', '9x16']);
const STILLS_ONLY = process.argv.includes('--stills-only');
const SIZE = { '16x9': [1920, 1080], '9x16': [1080, 1920] };
// 장면별 대표 정지 화면 시각(장면이 다 그려진 뒤)
const STILL_AT = [2.6, 5.6, 9.6, 13.6, 17.6, 20.6, 24.9];

// 사이트 폴더를 그대로 내보내는 작은 정적 서버(글꼴 CORS 때문에 file:// 대신)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((q, s) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const o of ORIENTS) {
    const [W, H] = SIZE[o];
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.addScriptTag({ url: 'assets/ad25.js' });
    await page.evaluate(async (o) => { window.__ad = IUMMAd.record(o); await document.fonts.ready; window.__ad.seek(0); }, o);
    await page.waitForTimeout(500);
    for (let i = 0; i < STILL_AT.length; i++) {
      await page.evaluate((t) => window.__ad.seek(t), STILL_AT[i]);
      await page.screenshot({ path: path.join(OUT, `iumm_scene${i + 1}_${o}.png`) });
    }
    console.log(`[${o}] 정지 화면 ${STILL_AT.length}장`);
    if (STILLS_ONLY) { await page.close(); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `iumm-ad-${o}-`));
    const N = FPS * DUR;
    for (let f = 0; f <= N; f++) {
      await page.evaluate((t) => window.__ad.seek(t), f / FPS);
      await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (f % 150 === 0) console.log(`[${o}] ${f}/${N}`);
    }
    await page.close();
    const mp4 = path.join(OUT, `iumm_25s_${o}.mp4`);
    // 무음(오디오 트랙 없음) · H.264 · yuv420p(어디서나 재생) · faststart(웹 업로드용)
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'), '-frames:v', String(N),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', mp4]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`[${o}] ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)}MB)`);
  }
} finally {
  await browser.close();
  server.close();
}
