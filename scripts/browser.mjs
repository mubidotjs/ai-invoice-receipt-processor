import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const child = spawn(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: resolve('.cache/browsers') },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
