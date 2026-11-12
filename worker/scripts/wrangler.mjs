import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const child = spawn(
  process.execPath,
  [resolve('../node_modules/wrangler/bin/wrangler.js'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: resolve('.cache/config'),
      WRANGLER_LOG_PATH: resolve('.cache/logs'),
      WRANGLER_SEND_METRICS: 'false',
      CLOUDFLARE_CF_FETCH_ENABLED: 'false',
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
