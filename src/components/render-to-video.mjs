// render-to-video.mjs
// 로켓 2.3x 스케일, 2초 안에 '지구→우주' 급상승 타임라인.
// Usage 예시(2초·30fps·1080): 
//   node render-to-video.mjs --out=./public/videos/rocket-1080.mp4 --fps=30 --seconds=2 --size=1080 --crf=18 --ladder=320,480,720
//
// 필요: Node 18+, ffmpeg, npm i puppeteer

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 공백(--out foo) & 등호(--out=foo) 모두 지원 */
function parseArgsFlexible() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      let [k, v] = t.slice(2).split("=");
      if (v === undefined) {
        const n = argv[i + 1];
        if (n && !n.startsWith("--")) {
          v = n; i++;
        } else v = "true";
      }
      out[k] = v;
    }
  }
  return out;
}
const _a = parseArgsFlexible();
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v, d = true) => {
  if (typeof v === "boolean") return v;
  if (v == null) return d;
  const s = String(v).toLowerCase();
  if (["false","0","no","off"].includes(s)) return false;
  if (["true","1","yes","on"].includes(s)) return true;
  return d;
};

const outPath = typeof _a.out === "string" && _a.out.trim() ? _a.out : "./public/videos/rocket-1080.mp4";
const fps     = num(_a.fps, 30);      // 기본 30fps
const seconds = num(_a.seconds, 2);   // 기본 2초
const size    = num(_a.size, 1080);
const crf     = num(_a.crf, 18);
const cleanup = bool(_a.cleanup, true);
const preset  = String(_a.preset ?? "slower");
const ladder  = typeof _a.ladder === "string"
  ? _a.ladder.split(",").map(s => Number(s.trim())).filter(Boolean)
  : []; // ex) 320,480,720

/* ===== 비디오용 HTML =====
   - --p: 0→1 (2초 내)
   - --boost: 가속 펄스(불꽃/아이온/카메라 효과에만 반영; opacity는 고정)
   - 로켓 크기: --rocketScale=2.3 (2배 이상)
   - 이동량: --dy = -620px (1080px 기준 화면 절반 이상 상승) + 소폭 곡선
   - 지구는 약간 아래로 밀리고(translateY), 약간 축소(scale)되어 '멀어짐' 느낌
   - 스타필드/스피드라인은 transform/필터만 변경 (opacity 애니메이션 없음)
*/
const HTML = String.raw`<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Rocket — Earth to Space in 2s</title>
<style>
  @property --p { syntax: "<number>"; inherits: true; initial-value: 0; }
  @property --boost { syntax: "<number>"; inherits: true; initial-value: 0; }

  :root{
    --p: 0; --boost: 0;

    /* 진행 S-curve (연속 가속/감속) */
    --ease: calc((1 - cos(calc(var(--p) * 180deg))) / 2);

    /* 경로/스케일: 2초 안에 지구→우주 */
    --rocketScale: 2.3;           /* ★ 로켓 2배 이상 확대 */
    --dx: 90px;                   /* 약간의 기울어진 궤적 */
    --dy: -620px;                 /* 화면 절반 이상 상승(1080 기준) */
    --x:  calc(var(--dx) * var(--ease));
    --y:  calc(var(--dy) * var(--ease));
    --base-rot: calc(-4deg + 12deg * var(--ease));
    --wobble:   calc(0.6deg * sin(calc(var(--p) * 900deg)));

    /* 부스트 연동 카메라 셰이크/색감 (opacity는 고정) */
    --shakeAmp: calc(var(--boost) * 1.5px);
    --sx: calc(var(--shakeAmp) * sin(calc(var(--p) * 1440deg)));
    --sy: calc(var(--shakeAmp) * cos(calc(var(--p) * 1620deg)));
    --sat: calc(1 + 0.12 * var(--boost));
    --con: calc(1 + 0.06 * var(--boost));

    /* 지구 레이어: 멀어지는 느낌을 위해 약간 아래로 밀고 축소 */
    --earthShift: calc(140px * var(--ease));
    --earthScale: calc(1 - 0.12 * var(--ease));

    /* 스타필드: 위로 더 빨리 이동 + 미세 스케일 업 */
    --starsDrift: calc(-380px * var(--ease));
    --starsScale: calc(1 + 0.18 * var(--ease));

    /* 깊이 레이어 (translateZ는 데코, 주된 움직임은 2D transform) */
    --z-earth:-80px; --z-aurora:-120px; --z-stars1:-180px; --z-stars2:-220px; --z-rocket:32px;
  }

  html,body{margin:0;height:100%;background:#020617}
  .wrap{display:grid;place-items:center;height:100%}
  .scene{
    position:relative;width:100vmin;height:100vmin;max-width:100%;max-height:100%;
    overflow:hidden;border-radius:16px;isolation:isolate;
    transform-style:preserve-3d;perspective:900px;
    transform: translate3d(var(--sx),var(--sy),0);
    filter: saturate(var(--sat)) contrast(var(--con));
  }

  /* === 지구/오로라 (항상 보임, opacity 애니메이션 없음) === */
  .earth{
    position:absolute;bottom:-35%;left:50%;width:150%;height:150%;border-radius:50%;
    transform: translateX(-50%) translateY(var(--earthShift)) translateZ(var(--z-earth)) scale(var(--earthScale));
    background:radial-gradient(circle at 35% 30%, rgba(80,165,255,.85), rgba(12,52,129,.95) 45%, rgba(4,16,45,1) 70%);
    box-shadow:0 -24px 100px rgba(0,120,255,.3);
  }
  .aurora{
    position:absolute;bottom:-12%;left:50%;width:118%;height:118%;border-radius:50%;
    transform:translateX(-50%) translateZ(var(--z-aurora));
    background:
      radial-gradient(circle at 50% 78%, rgba(74,222,128,.5), transparent 62%),
      conic-gradient(from 220deg, transparent 0 40deg, rgba(74,222,128,.35) 60deg, rgba(110,231,183,.25) 120deg, rgba(59,130,246,.15) 180deg, transparent 260deg 360deg);
    mix-blend-mode:screen; filter:hue-rotate(calc(-4deg * var(--boost))) blur(.6px);
  }

  /* === 스피드라인(항상 보임, opacity 고정) === */
  .speedlines{ position:absolute; inset:-10% -20%; pointer-events:none; mix-blend-mode:screen; opacity:.35 }
  .speedlines span{
    --i:0;
    position:absolute; left:calc(4% + (var(--i) * 9%)); top:-10%;
    width:2px; height:120%;
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(180,220,255,.9), rgba(80,180,255,0));
    transform: rotate(calc(-8deg - (var(--i) % 3) * 2deg));
    filter: blur(.3px);
    animation: speedline 1.6s linear infinite;
    animation-delay: calc((var(--i) % 5) * -0.18s);
  }
  @keyframes speedline{
    from{ transform: translate3d(0,0,0) rotate(var(--_rot,-10deg)); }
    to{   transform: translate3d(0,38%,0) rotate(var(--_rot,-10deg)); }
  }

  /* === 스타필드(밝기/스케일/위치만 변경; opacity 고정) === */
  .stars{ position:absolute; inset:0; backface-visibility:hidden; }
  .stars.s1{
    transform: translateZ(var(--z-stars1)) translate3d(0, var(--starsDrift), 0) scale(var(--starsScale));
    background-image: radial-gradient(circle, rgba(255,255,255,.65) 1px, transparent 2px),
                      radial-gradient(circle, rgba(255,255,255,.38) 1px, transparent 2px);
    background-size:22px 22px,36px 36px;
    filter: brightness(calc(.9 + .2 * sin(calc(var(--p) * 720deg))));
    opacity:.42;
  }
  .stars.s2{
    transform: translateZ(var(--z-stars2)) translate3d(0, var(--starsDrift), 0) scale(calc(1 + 0.24 * var(--ease)));
    background-image: radial-gradient(circle, rgba(255,255,255,.5) 1px, transparent 2px);
    background-size:28px 28px;
    filter: brightness(calc(.85 + .25 * cos(calc(var(--p) * 540deg))));
    opacity:.32;
  }

  /* === 로켓(2.3x 스케일, 상시 불꽃) === */
  .rocket{
    position:absolute; left:40%; bottom:12%; width:3.6rem; height:8.25rem; transform-origin:center;
    transform:
      translateZ(var(--z-rocket))
      translate3d(var(--x), var(--y), 0)
      rotate(calc(var(--base-rot) + var(--wobble)))
      scale(var(--rocketScale));
    filter: drop-shadow(0 4px 12px rgba(120,200,255,.5));
  }
  .body{position:absolute;inset:0;border-radius:1.8rem 1.8rem .9rem .9rem;
    background:linear-gradient(180deg,#fff,#d2e0ff);box-shadow:0 0 18px rgba(120,200,255,.5)}
  .window{position:absolute;top:28%;left:50%;width:1rem;height:1rem;border-radius:50%;transform:translateX(-50%);
    background:radial-gradient(circle at 30% 35%,#fff,#516fff);box-shadow:inset 0 0 6px rgba(255,255,255,.7)}
  .ridge{position:absolute;bottom:38%;left:50%;width:70%;height:.35rem;border-radius:999px;transform:translateX(-50%);
    background:linear-gradient(90deg, rgba(148,163,184,.9), rgba(226,232,240,.95))}
  .fin{position:absolute;bottom:.6rem;width:1.6rem;height:2.6rem;background:linear-gradient(180deg,#7dd3fc,#3b82f6);
    border-radius:0 0 1.4rem 1.4rem;box-shadow:0 6px 16px rgba(56,189,248,.35)}
  .fin.left{left:-1rem;transform:rotate(-10deg)} .fin.right{right:-1rem;transform:rotate(10deg)}

  /* 플럼/아이온: opacity는 고정, 길이/형상만 boost에 연동 */
  .ion{ position:absolute; bottom:-1.2rem; left:50%; width:1.2rem; height:3.2rem; transform:translateX(-50%) scaleY(calc(1 + .8*var(--boost)));
    background: radial-gradient(50% 120% at 50% 0%, rgba(120,200,255,.55), rgba(80,160,255,.28) 60%, transparent 70%); filter: blur(3px); opacity:.85 }
  .flame{ position:absolute; bottom:-1rem; left:50%; width:1.05rem; height:1.8rem; transform:translate3d(-50%,0,0) scaleY(calc(1 + .35*var(--boost))); }
  .flame::before{ content:""; position:absolute; inset:30% 28% -8% 28%; border-radius:999px;
    background:repeating-linear-gradient(180deg, rgba(255,210,120,.72) 0 6px, rgba(255,140,0,.55) 6px 12px);
    mix-blend-mode:screen; animation: diamonds 420ms linear infinite }
  @keyframes diamonds{ 0%{transform:scaleY(.96)} 50%{transform:scaleY(1.06)} 100%{transform:scaleY(.96)} }
  .flame .core{ position:absolute; inset:0; border-radius:999px; background:radial-gradient(circle at 50% 35%, #fff, #ffa028); animation:flick 140ms ease-in-out infinite }
  @keyframes flick{ 0%,100%{transform:scale3d(1,1,1)} 50%{transform:scale3d(1,.88,1)} }
  .flame .glow{ position:absolute; inset:-.36rem; border-radius:999px; background:radial-gradient(circle, rgba(255,184,108,.6), transparent 60%); filter:blur(6px); opacity:.9 }

  /* 접근성: Reduce Motion */
  @media (prefers-reduced-motion: reduce){
    .speedlines span, .flame::before, .flame .core { animation: none !important; }
  }
</style>
</head><body>
  <div class="wrap">
    <div class="scene" id="scene">
      <div class="stars s1"></div>
      <div class="stars s2"></div>

      <div class="earth"></div>
      <div class="aurora"></div>

      <div class="speedlines">
        ${Array.from({length:12}).map((_,i)=>`<span style="--i:${i}"></span>`).join("")}
      </div>

      <div class="rocket">
        <div class="body"></div>
        <div class="window"></div>
        <div class="ridge"></div>
        <div class="fin left"></div>
        <div class="fin right"></div>
        <div class="ion"></div>
        <div class="flame"><span class="core"></span><span class="glow"></span></div>
      </div>
    </div>
  </div>
  <script>
    // Puppeteer가 프레임마다 호출: 진행도/부스트
    window.__setPB = (p, boost) => {
      const root = document.documentElement;
      root.style.setProperty('--p', String(p));
      root.style.setProperty('--boost', String(boost));
    };
  </script>
</body></html>`;

/* ===== 부스트 타임라인(2초에 맞춘 3펄스) =====
   raised-cosine pulse: center, width, amp
*/
function rcPulse(p, c, w, a) {
  const d = Math.abs(p - c) / w;
  if (d > 1) return 0;
  return a * 0.5 * (1 + Math.cos(Math.PI * d));
}
function computeBoost(p) {
  // 2초 안에서 0.12 / 0.45 / 0.78 지점에 펀치
  const b = rcPulse(p, 0.12, 0.10, 1.00)
          + rcPulse(p, 0.45, 0.12, 0.85)
          + rcPulse(p, 0.78, 0.08, 1.00);
  return Math.min(1, b);
}

async function spawnFF(args) {
  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg failed: "+code))));
  });
}

async function run() {
  const total   = Math.max(1, Math.round(fps * seconds));
  const outAbs  = path.resolve(String(outPath));
  const framesDir = path.join(__dirname, ".rocket_frames");

  console.log("▶ rendering frames", { out: outAbs, fps, seconds, size, crf, preset, ladder });

  // 출력 폴더 자동 생성
  await fs.mkdir(path.dirname(outAbs), { recursive: true });

  // 프레임 폴더 준비
  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });

  // 브라우저 렌더
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: size, height: size, deviceScaleFactor: 1 },
    args: ["--disable-gpu-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(HTML, { waitUntil: "load" });
  await page.waitForSelector(".scene");

  for (let i = 0; i < total; i++) {
    const p = i / (total - 1 || 1);
    const boost = computeBoost(p);
    await page.evaluate((pVal, bVal) => window.__setPB && window.__setPB(pVal, bVal), p, boost);
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => res(true))));
    const file = path.join(framesDir, `frame_${String(i).padStart(5, "0")}.png`);
    await page.screenshot({ path: file, type: "png" });
    if (i % Math.max(1, Math.round(total / 10)) === 0) {
      process.stdout.write(`\r   progress: ${String(Math.round((i/(total-1))*100)).padStart(3)}%`);
    }
  }
  console.log("\n✔ frames rendered");
  await browser.close();

  // 마스터 인코딩 (MP4/H.264)
  const inputPattern = path.join(framesDir, "frame_%05d.png");
  const masterArgs = [
    "-y", "-framerate", String(fps), "-i", inputPattern,
    "-c:v", "libx264", "-preset", preset, "-pix_fmt", "yuv420p",
    "-crf", String(crf), "-movflags", "+faststart", "-an",
    outAbs,
  ];
  await spawnFF(masterArgs);

  // 해상도 래더(선택)
  for (const w of ladder) {
    const outScaled = outAbs.replace(/(\.\w+)$/, `-${w}$1`);
    await fs.mkdir(path.dirname(outScaled), { recursive: true });
    const scaleArgs = [
      "-y", "-i", outAbs,
      "-vf", `scale=${w}:-2`, "-r", String(fps),
      "-c:v", "libx264", "-preset", preset, "-pix_fmt", "yuv420p",
      "-crf", String(Math.max(18, crf + (w <= 480 ? 4 : w <= 720 ? 2 : 0))), "-movflags", "+faststart", "-an",
      outScaled,
    ];
    await spawnFF(scaleArgs);
  }

  if (cleanup) await fs.rm(framesDir, { recursive: true, force: true });
  console.log("✅ Done:", outAbs, ladder.length ? "(ladder generated)" : "");
}

run().catch((e) => { console.error(e); process.exit(1); });
