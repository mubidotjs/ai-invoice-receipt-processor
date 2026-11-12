// Test-only Vite server. It does not start a Worker or configure remote bindings.
import { createServer } from 'vite';
const server = await createServer({
  configFile: 'web/vite.config.ts',
  root: 'web',
  server: { host: '127.0.0.1', port: 5402, strictPort: true },
  define: {
    'import.meta.env.VITE_LIVE_AI_ENABLED': '"true"',
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': '"local-mocked-widget"',
    'import.meta.env.VITE_WORKER_URL': '"http://127.0.0.1:8788"',
  },
});
await server.listen();
server.printUrls();
