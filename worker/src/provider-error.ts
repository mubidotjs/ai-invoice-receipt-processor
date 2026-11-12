// Workers AI platform/errors, checked 2026-11-12. Do not infer meaning from HTTP
// 403/429 alone, scan message bodies, stringify exceptions, or follow causes.
const CATEGORIES = {
  3003: 'invalid_parameters',
  3006: 'invalid_parameters',
  3007: 'timeout',
  3008: 'timeout',
  3023: 'request_rejected',
  3036: 'quota_exhausted',
  3039: 'invalid_parameters',
  3040: 'capacity',
  3041: 'model_unavailable',
  3042: 'model_unavailable',
  5004: 'invalid_parameters',
  5005: 'invalid_parameters',
  5007: 'model_unavailable',
  5016: 'model_unavailable',
  5018: 'model_unavailable',
  5019: 'invalid_parameters',
  5028: 'model_unavailable',
  5035: 'model_unavailable',
} as const;
export type ProviderCode = keyof typeof CATEGORIES;
type Category = (typeof CATEGORIES)[ProviderCode] | 'json_generation_failed' | 'unknown_invocation';
const NAMES = [
  'Error',
  'AiError',
  'InferenceUpstreamError',
  'AiInternalError',
  'TypeError',
  'TimeoutError',
  'AbortError',
] as const;
type SafeName = (typeof NAMES)[number] | 'unknown';
export type InvocationDiagnostic = {
  stage: 'invocation';
  category: Category;
  reason:
    | 'provider_code'
    | 'error_name'
    | 'json_mode_marker'
    | 'unknown_code'
    | 'conflicting_codes'
    | 'unrecognized_error'
    | 'application_deadline';
  errorName: SafeName;
  providerCode?: ProviderCode;
  codeSource?: 'code' | 'internalCode' | 'message_prefix';
};
const PUBLIC = {
  invalid_parameters: {
    code: 'AI_INVALID_PARAMETERS',
    message:
      'Cloudflare rejected the model request parameters. No draft was applied; continue manually.',
    status: 502,
  },
  request_rejected: {
    code: 'AI_REQUEST_REJECTED',
    message:
      'Cloudflare rejected this account request. Continue manually while service access is reviewed.',
    status: 502,
  },
  model_unavailable: {
    code: 'AI_MODEL_UNAVAILABLE',
    message:
      'The configured model or plan is unavailable. No alternative model or paid fallback was selected.',
    status: 503,
  },
  quota_exhausted: {
    code: 'AI_QUOTA_EXHAUSTED',
    message:
      'The shared free AI quota is unavailable. Continue manually; no paid fallback is configured.',
    status: 503,
  },
  capacity: {
    code: 'AI_CAPACITY',
    message: 'The AI provider is busy. Continue manually or retry explicitly later.',
    status: 503,
  },
  timeout: {
    code: 'AI_TIMEOUT',
    message:
      'The model request timed out or was aborted. Continue manually; no automatic retry was made.',
    status: 504,
  },
  json_generation_failed: {
    code: 'AI_JSON_GENERATION_FAILED',
    message:
      'The provider could not generate the requested structured JSON. No draft was applied; continue manually.',
    status: 502,
  },
  unknown_invocation: {
    code: 'AI_UNAVAILABLE',
    message: 'AI extraction failed. Local text and manual entry remain available.',
    status: 502,
  },
} as const;

// Data descriptors only: arbitrary getters, toString(), causes, bodies and stacks
// are not evaluated. An unknown structured code suppresses message fallback.
function field(error: unknown, key: string): { present: boolean; value?: unknown } {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function'))
    return { present: false };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor
      ? { present: true, value: 'value' in descriptor ? descriptor.value : undefined }
      : { present: false };
  } catch {
    return { present: true };
  }
}
function safeName(error: unknown): SafeName {
  const name = field(error, 'name');
  let value = name.value;
  if (!name.present) {
    // Use only the native getter for native DOMExceptions, not an error's getter.
    try {
      if (typeof DOMException !== 'undefined' && error instanceof DOMException)
        value = Object.getOwnPropertyDescriptor(DOMException.prototype, 'name')?.get?.call(error);
      else if (error instanceof Error) value = 'Error';
    } catch {
      return 'unknown';
    }
  }
  return NAMES.some((n) => n === value) ? (value as SafeName) : 'unknown';
}
function allowedCode(value: unknown): ProviderCode | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !/^\d{4}$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && Object.hasOwn(CATEGORIES, number)
    ? (number as ProviderCode)
    : undefined;
}

export function classifyInvocationError(error: unknown, applicationDeadline = false) {
  const errorName = safeName(error);
  const make = (
    category: Category,
    reason: InvocationDiagnostic['reason'],
    extra: Pick<InvocationDiagnostic, 'providerCode' | 'codeSource'> = {},
  ) => ({
    ...PUBLIC[category],
    diagnostic: {
      stage: 'invocation',
      category,
      reason,
      errorName,
      ...extra,
    } satisfies InvocationDiagnostic,
  });
  if (applicationDeadline) return make('timeout', 'application_deadline');
  const code = field(error, 'code');
  const internal = field(error, 'internalCode');
  if (code.present || internal.present) {
    const a = allowedCode(code.value),
      b = allowedCode(internal.value);
    if ((code.present && !a) || (internal.present && !b))
      return make('unknown_invocation', 'unknown_code');
    if (a && b && a !== b) return make('unknown_invocation', 'conflicting_codes');
    const selected = a ?? b;
    if (selected)
      return make(CATEGORIES[selected], 'provider_code', {
        providerCode: selected,
        codeSource: a ? 'code' : 'internalCode',
      });
  }
  const message = field(error, 'message').value;
  // workerd _parseError emits '<internalCode>: <description>'. Inspect only the
  // anchored numeric protocol prefix; never scan or copy the description.
  if (typeof message === 'string') {
    const prefix = /^(\d{4}):(?:\s|$)/.exec(message.slice(0, 6));
    if (prefix) {
      const selected = allowedCode(prefix[1]);
      if (selected)
        return make(CATEGORIES[selected], 'provider_code', {
          providerCode: selected,
          codeSource: 'message_prefix',
        });
      return make('unknown_invocation', 'unknown_code');
    }
  }
  if (errorName === 'TimeoutError' || errorName === 'AbortError')
    return make('timeout', 'error_name');
  // JSON Mode documents this exact fixed failure marker, but no numeric code.
  // Do not invent a code or search arbitrary provider responses for this text.
  if (message === "JSON Mode couldn't be met" || message === "JSON Mode couldn't be met.")
    return make('json_generation_failed', 'json_mode_marker');
  return make('unknown_invocation', 'unrecognized_error');
}
