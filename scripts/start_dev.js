const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

try {
  let child;
  if (isWin) {
    // Use cmd to spawn a detached windowless process on Windows
    child = spawn('cmd.exe', ['/c', 'start', '""', 'npm.cmd', 'run', 'dev'], {
      cwd,
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    child = spawn('npm', ['run', 'dev'], {
      cwd,
      detached: true,
      stdio: 'ignore',
    });
  }
  child.unref();
  console.log(`DEV SERVER STARTED pid=${child.pid} cwd=${cwd}`);
} catch (e) {
  console.error('Failed to start dev server:', e);
  process.exit(1);
}
