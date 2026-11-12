export function securityHeaders(worker = 'http://127.0.0.1:8788', nonce) {
  const origin = new URL(worker).origin;
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${nonce ? `'nonce-${nonce}' ` : ''}https://challenges.cloudflare.com; worker-src 'self'; connect-src 'self' ${origin} https://challenges.cloudflare.com; img-src 'self' blob: data:; font-src 'self' blob:; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
