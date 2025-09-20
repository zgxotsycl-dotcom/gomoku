// Simple geometry test for PageCurl 3D roll logic (no DOM)
// Simulates slice rotation degrees across progress for sanity-check

function simulate({ H = 600, slices = 48, R = 200, curlStrength = 1, thetaMaxDeg = 160 }) {
  const thetaMax = (thetaMaxDeg * Math.PI) / 180;
  const sliceH = H / slices;
  function snapshot(progress) {
    const frontY = progress * H;
    const out = [];
    for (let i = 0; i < slices; i++) {
      const topY = sliceH * i;
      const d = Math.max(0, frontY - topY);
      const theta = Math.min(thetaMax, (d / R) * (curlStrength || 1));
      const deg = (theta * 180) / Math.PI;
      if (i % Math.floor(slices / 6) === 0 || i === slices - 1) {
        out.push({ i, topY: +topY.toFixed(1), d: +d.toFixed(1), deg: +deg.toFixed(2) });
      }
    }
    return { frontY: +frontY.toFixed(1), summary: out };
  }
  return [0.0, 0.25, 0.5, 0.75, 1.0].map(snapshot);
}

const res = simulate({ H: 640, slices: 48, R: 200, curlStrength: 1.2 });
for (const snap of res) {
  console.log("\n=== Progress frontY:", snap.frontY, "px ===");
  console.table(snap.summary);
}

