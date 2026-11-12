import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { randomBytes } from 'node:crypto';
// @ts-expect-error Shared plain-JS header helper is also used by the build/deployment tooling.
import { securityHeaders } from './security.mjs';
export default defineConfig(({ command, isPreview }) => {
  const nonce = command === 'serve' && !isPreview ? randomBytes(16).toString('base64') : undefined;
  return {
    plugins: [react()],
    html: { cspNonce: nonce },
    server: { port: 5401, strictPort: true, headers: securityHeaders(undefined, nonce) },
    preview: { port: 5401, strictPort: true, headers: securityHeaders() },
    build: { target: 'es2023' },
  };
});
