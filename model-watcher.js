// Model watcher: periodically fetch manifest and download latest model files
// Public GCS or HTTP(S) endpoints are supported without credentials.
// Env:
//   MODEL_MANIFEST_URL: https URL to manifest.json
//   MODEL_BASE_URL: base URL to prepend for file paths in manifest (optional if file is absolute URL)
//   MODEL_DIR: local directory to store models (default ./models)
//   POLL_INTERVAL_MS: default 60000

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_URL = process.env.MODEL_MANIFEST_URL || '';
const BASE_URL = process.env.MODEL_BASE_URL || '';
const MODEL_DIR = process.env.MODEL_DIR || path.resolve(__dirname, 'models');
const POLL = Number(process.env.POLL_INTERVAL_MS || 60_000);

if (!MANIFEST_URL) {
  console.error('[watcher] MODEL_MANIFEST_URL is not set. Exiting.');
  process.exit(1);
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', (d) => hash.update(d));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }

async function httpGet(url, dest) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const file = await fsp.open(dest, 'w');
  const writer = file.createWriteStream();
  await new Promise((resolve, reject) => {
    res.body.pipe(writer);
    res.body.on('error', reject);
    writer.on('finish', resolve);
  });
}

async function currentVersion() {
  const link = path.join(MODEL_DIR, 'current');
  const vPath = path.join(link, 'version.txt');
  try { return (await fsp.readFile(vPath, 'utf8')).trim(); } catch { return null; }
}

async function switchCurrent(version) {
  const target = path.join(MODEL_DIR, version);
  const link = path.join(MODEL_DIR, 'current');
  try { await fsp.unlink(link); } catch {}
  await fsp.symlink(target, link, 'junction');
  await fsp.writeFile(path.join(link, 'version.txt'), version, 'utf8');
}

async function tick() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const manifest = await res.json();
    const version = manifest?.version;
    let file = manifest?.file;
    const expectedSha = manifest?.sha256 || '';
    if (!version || !file) { console.warn('[watcher] Invalid manifest'); return; }

    const cur = await currentVersion();
    if (cur === version) return; // up-to-date

    if (!/^https?:\/\//.test(file)) file = `${BASE_URL.replace(/\/$/, '')}/${file.replace(/^\//, '')}`;

    const targetDir = path.join(MODEL_DIR, version);
    await ensureDir(targetDir);
    const targetFile = path.join(targetDir, path.basename(new URL(file).pathname));

    console.log('[watcher] downloading', file);
    await httpGet(file, targetFile);

    if (expectedSha) {
      const got = await sha256(targetFile);
      if (got.toLowerCase() !== expectedSha.toLowerCase()) {
        console.error('[watcher] sha256 mismatch. expected', expectedSha, 'got', got);
        return;
      }
    }

    await switchCurrent(version);
    console.log('[watcher] switched to version', version);
  } catch (e) {
    console.warn('[watcher] tick failed:', e?.message || e);
  }
}

(async () => {
  await ensureDir(MODEL_DIR);
  await tick();
  setInterval(tick, POLL);
})();

