import { describe, expect, it, vi } from 'vitest';
import { classifyInvocationError } from './provider-error';

const mappings = [
  [3003, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [3006, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [3007, 'timeout', 'AI_TIMEOUT'],
  [3008, 'timeout', 'AI_TIMEOUT'],
  [3023, 'request_rejected', 'AI_REQUEST_REJECTED'],
  [3036, 'quota_exhausted', 'AI_QUOTA_EXHAUSTED'],
  [3039, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [3040, 'capacity', 'AI_CAPACITY'],
  [3041, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [3042, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [5004, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [5005, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [5007, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [5016, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [5018, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [5019, 'invalid_parameters', 'AI_INVALID_PARAMETERS'],
  [5028, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
  [5035, 'model_unavailable', 'AI_MODEL_UNAVAILABLE'],
] as const;

describe('allowlisted provider invocation diagnostics; synthetic exceptions only', () => {
  it.each(mappings)(
    'classifies independent numeric/string code %s without message dependence',
    (code, category, publicCode) => {
      for (const value of [code, String(code)]) {
        const error = Object.assign(new Error('private OCR 999.00 / token / provider body'), {
          code: value,
          name: 'AiError',
        });
        const result = classifyInvocationError(error);
        expect(result.code).toBe(publicCode);
        expect(result.diagnostic).toEqual({
          stage: 'invocation',
          category,
          reason: 'provider_code',
          errorName: 'AiError',
          providerCode: code,
          codeSource: 'code',
        });
        expect(JSON.stringify(result)).not.toMatch(/private|999\.00|token|provider body/);
      }
    },
  );
  it.each(mappings)(
    'recognizes workerd anchored numeric prefix %s without copying the description',
    (code, category, publicCode) => {
      const error = Object.assign(new Error(`${code}: private provider body`), {
        name: 'InferenceUpstreamError',
      });
      expect(classifyInvocationError(error)).toMatchObject({
        code: publicCode,
        diagnostic: { category, providerCode: code, codeSource: 'message_prefix' },
      });
    },
  );
  it('prioritizes structured fields over conflicting message text and names', () => {
    expect(
      classifyInvocationError({ code: 3040, name: 'TimeoutError', message: '3036: private' }),
    ).toMatchObject({
      code: 'AI_CAPACITY',
      diagnostic: { providerCode: 3040, codeSource: 'code' },
    });
    expect(classifyInvocationError({ internalCode: '3007', message: 'private' })).toMatchObject({
      code: 'AI_TIMEOUT',
      diagnostic: { providerCode: 3007, codeSource: 'internalCode' },
    });
    expect(classifyInvocationError({ code: 3036, internalCode: 3036 })).toMatchObject({
      code: 'AI_QUOTA_EXHAUSTED',
    });
    expect(classifyInvocationError({ code: 3036, internalCode: 3007 })).toMatchObject({
      code: 'AI_UNAVAILABLE',
      diagnostic: { reason: 'conflicting_codes' },
    });
  });
  it.each([9999, '3036 private', 3036.5, true, null, { toString: () => '3036' }])(
    'does not log/coerce unknown structured codes or fall back to a misleading message',
    (code) => {
      expect(classifyInvocationError({ code, message: '3036: private' })).toMatchObject({
        code: 'AI_UNAVAILABLE',
        diagnostic: { reason: 'unknown_code' },
      });
      expect(classifyInvocationError({ code }).diagnostic).not.toHaveProperty('providerCode');
    },
  );
  it.each([
    'total 3036',
    '403',
    '429',
    'quota exhausted',
    'capacity shortage',
    'private 3007:',
    '9999: unknown',
  ])('does not infer provider categories from arbitrary message text %s', (message) => {
    expect(classifyInvocationError(new Error(message)).code).toBe('AI_UNAVAILABLE');
  });
  it.each(['TimeoutError', 'AbortError'])('recognizes allowlisted timeout name %s', (name) => {
    expect(classifyInvocationError({ name, message: 'private' })).toMatchObject({
      code: 'AI_TIMEOUT',
      diagnostic: { reason: 'error_name', errorName: name },
    });
  });
  it('recognizes a native DOMException without invoking overridden getters', () => {
    expect(classifyInvocationError(new DOMException('private', 'AbortError')).code).toBe(
      'AI_TIMEOUT',
    );
    const nameGetter = vi.fn(() => {
      throw new Error('private');
    });
    expect(
      classifyInvocationError(Object.defineProperty({}, 'name', { get: nameGetter })).diagnostic
        .errorName,
    ).toBe('unknown');
    expect(nameGetter).not.toHaveBeenCalled();
  });
  it('distinguishes only the exact documented JSON Mode marker; invents no numeric code', () => {
    expect(classifyInvocationError(new Error("JSON Mode couldn't be met"))).toMatchObject({
      code: 'AI_JSON_GENERATION_FAILED',
      diagnostic: { category: 'json_generation_failed', reason: 'json_mode_marker' },
    });
    expect(
      classifyInvocationError(new Error("JSON Mode couldn't be met: private contents")).code,
    ).toBe('AI_UNAVAILABLE');
    expect(classifyInvocationError({ code: 9999, message: "JSON Mode couldn't be met" }).code).toBe(
      'AI_UNAVAILABLE',
    );
  });
  it('records only allowlisted names and never invokes getters, toString, causes or body access', () => {
    const getter = vi.fn(() => {
      throw new Error('private');
    });
    const error = Object.defineProperties(
      { name: 'secret-name', toString: getter },
      {
        code: { get: getter },
        message: { get: getter },
        stack: { get: getter },
        cause: { get: getter },
        response: { get: getter },
      },
    );
    const result = classifyInvocationError(error);
    expect(result.diagnostic).toEqual({
      stage: 'invocation',
      category: 'unknown_invocation',
      reason: 'unknown_code',
      errorName: 'unknown',
    });
    expect(getter).not.toHaveBeenCalled();
    expect(classifyInvocationError({ cause: { code: 3036 }, body: { code: 3036 } }).code).toBe(
      'AI_UNAVAILABLE',
    );
    expect(classifyInvocationError('3036: private').code).toBe('AI_UNAVAILABLE');
  });
  it('identifies the trusted application deadline without a fabricated provider code', () => {
    expect(classifyInvocationError(new Error('private'), true)).toMatchObject({
      code: 'AI_TIMEOUT',
      diagnostic: { reason: 'application_deadline' },
    });
    expect(classifyInvocationError(new Error('private'), true).diagnostic).not.toHaveProperty(
      'providerCode',
    );
  });
});
