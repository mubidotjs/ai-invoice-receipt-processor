import type { Ai } from '@cloudflare/workers-types';
import { z } from 'zod';
import {
  MODEL,
  PROMPT_VERSION,
  LIMITS,
  normalizeText,
  requestSchema,
  validateAIOutput,
  validateDocument,
  OutputValidationError,
} from '@invoice/shared';
import { modelContent } from './model-output';
import { buildAiInput } from './ai-input';
import { classifyInvocationError } from './provider-error';
export { SYSTEM_PROMPT } from './ai-input';
export { modelContent } from './model-output';

type Limiter = { limit(input: { key: string }): Promise<{ success: boolean }> };
export interface Env {
  LIVE_AI_ENABLED?: string;
  ABUSE_CONTROLS_VERIFIED?: string;
  ALLOWED_ORIGINS?: string;
  TURNSTILE_HOSTNAMES?: string;
  TURNSTILE_SECRET?: string;
  AI?: Ai;
  VISITOR_LIMITER?: Limiter;
  AGGREGATE_LIMITER?: Limiter;
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retry?: number,
  ) {
    super(message);
  }
}
function json(value: unknown, status: number, origin?: string, retry?: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      ...(retry ? { 'Retry-After': String(retry) } : {}),
    },
  });
}
export async function readBounded(request: Request | Response, max: number): Promise<string> {
  if (Number(request.headers.get('content-length')) > max)
    throw new ApiError('BODY_TOO_LARGE', 'Payload exceeds the allowed size.', 413);
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let value = '';
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > max)
        throw new ApiError('BODY_TOO_LARGE', 'Payload exceeds the allowed size.', 413);
      value += decoder.decode(item.value, { stream: true });
    }
    return value + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
async function deadline<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                code,
                'The service did not respond in time. Continue manually or retry explicitly.',
                504,
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const split = (value?: string) =>
  value
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
export const isTestCredential = (value: string) => /^[123]x0+/i.test(value);
function configured(env: Env) {
  return !!(
    env.AI &&
    env.VISITOR_LIMITER &&
    env.AGGREGATE_LIMITER &&
    env.TURNSTILE_SECRET &&
    !isTestCredential(env.TURNSTILE_SECRET) &&
    split(env.TURNSTILE_HOSTNAMES).length
  );
}
const verifySchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  challenge_ts: z.iso.datetime().optional(),
  'error-codes': z.array(z.string().max(80)).max(10).optional(),
});
async function verifyTurnstile(token: string, env: Env): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400)
      throw new ApiError('PROTECTION_UNAVAILABLE', 'Bot verification redirects are refused.', 503);
    const body = JSON.parse(await readBounded(res, 8192));
    const verified = verifySchema.safeParse(body);
    if (!verified.success)
      throw new ApiError(
        'PROTECTION_UNAVAILABLE',
        'Bot verification is unavailable. Local processing remains available.',
        503,
      );
    const codes = verified.data['error-codes'] ?? [];
    if (codes.some((code) => ['invalid-input-secret', 'missing-input-secret'].includes(code)))
      throw new ApiError(
        'PROTECTION_UNAVAILABLE',
        'Bot verification configuration was rejected. Local processing remains available.',
        503,
      );
    const rejectedToken = codes.some((code) =>
      ['invalid-input-response', 'missing-input-response', 'timeout-or-duplicate'].includes(code),
    );
    if ((!res.ok && !(res.status === 400 && rejectedToken)) || codes.includes('internal-error'))
      throw new ApiError(
        'PROTECTION_UNAVAILABLE',
        'Bot verification is unavailable. Local processing remains available.',
        503,
      );
    if (
      !verified.data.success ||
      !split(env.TURNSTILE_HOSTNAMES).includes(verified.data.hostname ?? '') ||
      verified.data.action !== 'invoice-extract'
    )
      throw new ApiError(
        'TURNSTILE_REJECTED',
        'Bot verification failed or expired. Complete a fresh challenge.',
        403,
      );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'PROTECTION_UNAVAILABLE',
      'Bot verification is unavailable. Local processing remains available.',
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let allowed: string | undefined;
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        if (request.method !== 'GET') throw new ApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
        return json(
          {
            status: 'ok',
            schemaVersion: '1',
            model: MODEL,
            promptVersion: PROMPT_VERSION,
            liveEnabled:
              env.LIVE_AI_ENABLED === 'true' &&
              env.ABUSE_CONTROLS_VERIFIED === 'true' &&
              configured(env),
          },
          200,
        );
      }
      if (url.pathname !== '/api/extract') throw new ApiError('NOT_FOUND', 'Unknown route.', 404);
      const origin = request.headers.get('Origin');
      if (!origin || origin === 'null' || !split(env.ALLOWED_ORIGINS).includes(origin))
        throw new ApiError('ORIGIN_REJECTED', 'This origin is not allowed.', 403);
      allowed = origin;
      if (request.method === 'OPTIONS') {
        if (request.headers.get('Access-Control-Request-Method') !== 'POST')
          throw new ApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            Vary: 'Origin',
            'Cache-Control': 'no-store',
          },
        });
      }
      if (request.method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
      if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
        throw new ApiError('INVALID_CONTENT_TYPE', 'Only text JSON requests are accepted.', 415);
      let input: unknown;
      try {
        input = JSON.parse(await readBounded(request, LIMITS.bodyBytes));
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('INVALID_REQUEST', 'Invalid JSON text.');
      }
      const parsed = requestSchema.safeParse(input);
      if (!parsed.success)
        throw new ApiError(
          'INVALID_REQUEST',
          'Supply consent, a verification token and 1–12,000 characters across sequential document pages.',
        );
      // Bound protection work; disabled deployments can exercise native throttles without inference.
      const ip = request.headers.get('CF-Connecting-IP');
      try {
        if (env.VISITOR_LIMITER && ip && !(await env.VISITOR_LIMITER.limit({ key: ip })).success)
          throw new ApiError(
            'RATE_LIMITED',
            'Too many attempts. Wait before trying again.',
            429,
            60,
          );
        if (
          env.AGGREGATE_LIMITER &&
          !(await env.AGGREGATE_LIMITER.limit({ key: 'invoice-extraction' })).success
        )
          throw new ApiError(
            'RATE_LIMITED',
            'The demonstration is busy. Wait before trying again.',
            429,
            60,
          );
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('PROTECTION_UNAVAILABLE', 'Request protection is unavailable.', 503);
      }
      if (env.LIVE_AI_ENABLED !== 'true')
        throw new ApiError(
          'LIVE_AI_DISABLED',
          'Cloud AI is disabled. Use local processing and manual entry.',
          503,
        );
      if (env.ABUSE_CONTROLS_VERIFIED !== 'true' || !configured(env) || !ip)
        throw new ApiError(
          'PROTECTION_UNAVAILABLE',
          'Live protection is not configured and verified.',
          503,
        );
      await verifyTurnstile(parsed.data.turnstileToken, env);
      const pages = parsed.data.pages.map((p) => ({ ...p, text: normalizeText(p.text) }));
      const modelInput = buildAiInput(pages);
      if (new TextEncoder().encode(JSON.stringify(modelInput)).byteLength > LIMITS.promptBytes)
        throw new ApiError(
          'INPUT_TOO_LARGE',
          'The structured prompt is too large. Shorten the displayed text explicitly.',
          413,
        );
      let output: unknown;
      try {
        output = await deadline(env.AI!.run(MODEL, modelInput), LIMITS.aiMs, 'AI_TIMEOUT');
      } catch (e) {
        const failure = classifyInvocationError(
          e,
          e instanceof ApiError && e.code === 'AI_TIMEOUT',
        );
        console.warn('AI_INVOCATION_REJECTED', failure.diagnostic);
        throw new ApiError(failure.code, failure.message, failure.status);
      }
      try {
        const validated = validateAIOutput(modelContent(output), pages);
        return json(
          {
            schemaVersion: '1',
            mode: 'live-ai',
            model: MODEL,
            promptVersion: PROMPT_VERSION,
            ...validated,
            checks: validateDocument(validated.data),
          },
          200,
          allowed,
        );
      } catch (error) {
        // Only bounded, application-owned categories and allowlisted schema paths.
        // Observability stays disabled; never log the error object, issues or provider content.
        if (error instanceof OutputValidationError)
          console.warn('AI_OUTPUT_REJECTED', error.diagnostic);
        throw new ApiError(
          'AI_INVALID_OUTPUT',
          'AI returned invalid or unsupported data. No draft was applied; continue manually.',
          502,
        );
      }
    } catch (error) {
      const safe =
        error instanceof ApiError
          ? error
          : new ApiError(
              'INTERNAL_ERROR',
              'The request could not be processed. Continue manually.',
              500,
            );
      return json(
        {
          error: {
            code: safe.code,
            message: safe.message,
            ...(safe.retry ? { retryAfterSeconds: safe.retry } : {}),
          },
        },
        safe.status,
        allowed,
        safe.retry,
      );
    }
  },
};
