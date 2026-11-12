import { LIMITS, OutputValidationError } from '@invoice/shared';

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));

function reject(
  code:
    | 'unsupported_envelope'
    | 'missing_content'
    | 'incomplete_completion'
    | 'unexpected_tools'
    | 'refusal',
): never {
  throw new OutputValidationError({ stage: 'envelope', code });
}

export function modelContent(output: unknown): unknown {
  if (!record(output)) reject('unsupported_envelope');
  // Bound the entire returned envelope, including metadata, not only its content string.
  let serialized: string;
  try {
    serialized = JSON.stringify(output);
  } catch {
    reject('unsupported_envelope');
  }
  if (new TextEncoder().encode(serialized).byteLength > LIMITS.outputBytes)
    throw new OutputValidationError({ stage: 'limits', code: 'output_limit' });
  if (output.tool_calls != null || output.function_call != null) reject('unexpected_tools');
  let content: unknown;
  if ('choices' in output) {
    if ('response' in output || !Array.isArray(output.choices) || output.choices.length !== 1)
      reject('unsupported_envelope');
    const choice: unknown = output.choices[0];
    if (!record(choice) || !record(choice.message)) reject('unsupported_envelope');
    if (choice.finish_reason !== 'stop') reject('incomplete_completion');
    const message = choice.message;
    if (message.role !== 'assistant') reject('unsupported_envelope');
    if (
      message.tool_calls !== undefined &&
      (!Array.isArray(message.tool_calls) || message.tool_calls.length !== 0)
    )
      reject('unexpected_tools');
    if (message.function_call != null) reject('unexpected_tools');
    if (message.refusal != null) reject('refusal');
    content = message.content;
    // This exact model's Chat Completions contract documents string | null, not object content.
    if (content != null && typeof content !== 'string') reject('unsupported_envelope');
  } else {
    // Workers AI JSON Mode documents { response: object }; ordinary text uses a string.
    // Never treat a bare draft, REST { result: ... }, or arbitrary top-level object as content.
    if (
      !('response' in output) ||
      Object.keys(output).some((key) => !['response', 'usage'].includes(key))
    )
      reject('unsupported_envelope');
    content = output.response;
    if (record(content)) return content; // Authoritative strict Zod/evidence validation follows.
  }
  if (content == null || content === '') reject('missing_content');
  if (typeof content !== 'string') reject('unsupported_envelope');
  try {
    return JSON.parse(content);
  } catch {
    throw new OutputValidationError({ stage: 'json', code: 'invalid_json' });
  }
}
