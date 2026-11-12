import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  OutputValidationError,
  blankDocument,
  validateAIOutput,
  aiJsonSchema,
} from '@invoice/shared';
import type { AiModels } from '@cloudflare/workers-types';
import { modelContent } from './model-output';

const draft = () => ({
  data: { ...blankDocument(), vendorName: 'LOCAL SYNTHETIC' },
  evidence: [{ path: '/vendorName', page: 1, quote: 'LOCAL SYNTHETIC' }],
});
const chat = (content: unknown = JSON.stringify(draft()), finish: unknown = 'stop') => ({
  choices: [{ finish_reason: finish, message: { role: 'assistant', content, refusal: null } }],
});
function diagnostic(output: unknown) {
  try {
    modelContent(output);
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(OutputValidationError);
    return (error as OutputValidationError).diagnostic;
  }
}

describe('documented model envelopes (constructed locally; no inference)', () => {
  it('accepts exact-model typed Chat Completions content', () => {
    type Output = AiModels['@cf/google/gemma-4-26b-a4b-it']['postProcessedOutputs'];
    // The installed model type uses ChatCompletionsOutput; keep all required fields here.
    const output = {
      id: 'synthetic',
      object: 'chat.completion',
      created: 0,
      model: '@cf/google/gemma-4-26b-a4b-it',
      choices: [
        {
          index: 0,
          finish_reason: 'stop' as const,
          logprobs: null,
          message: { role: 'assistant' as const, content: JSON.stringify(draft()), refusal: null },
        },
      ],
    } satisfies Output;
    expect(validateAIOutput(modelContent(output), [{ page: 1, text: 'LOCAL SYNTHETIC' }])).toEqual(
      draft(),
    );
  });
  it.each([() => ({ response: JSON.stringify(draft()) }), () => ({ response: draft() })])(
    'accepts documented Workers string/object wrapper through authoritative validation',
    (make) => {
      expect(
        validateAIOutput(modelContent(make()), [{ page: 1, text: 'LOCAL SYNTHETIC' }]),
      ).toEqual(draft());
    },
  );
  it.each([
    null,
    [],
    {},
    { result: draft() },
    draft(),
    { response: [] },
    { response: 1 },
    { choices: {} },
    { choices: [] },
    { choices: [{}, {}] },
    { ...chat(), response: '{}' },
  ])('rejects unsupported envelopes', (output) =>
    expect(diagnostic(output).stage).toBe('envelope'),
  );
  it.each([undefined, null, ''])('rejects absent content', (content) => {
    const output = chat();
    output.choices[0]!.message.content = content as unknown as string;
    expect(diagnostic(output).code).toBe('missing_content');
  });
  it.each([undefined, null, '', 'length', 'content_filter', 'tool_calls', 'function_call'])(
    'requires explicit stop, not %s',
    (finish) => {
      const output = chat();
      output.choices[0]!.finish_reason = finish as unknown as string;
      expect(diagnostic(output).code).toBe('incomplete_completion');
    },
  );
  it.each([
    { tool_calls: [{ function: { name: 'private', arguments: 'secret' } }] },
    { function_call: { name: 'private', arguments: 'secret' } },
    { tool_calls: {} },
    { tool_calls: null },
  ])('rejects tool requests and malformed tool lists', (patch) => {
    const output = chat();
    Object.assign(output.choices[0]!.message, patch);
    expect(diagnostic(output).code).toBe('unexpected_tools');
  });
  it('rejects refusal or object/array chat content; does not invent undocumented parsed/content-part support', () => {
    const output = chat();
    output.choices[0]!.message.refusal = 'private' as unknown as null;
    expect(diagnostic(output).code).toBe('refusal');
    expect(diagnostic(chat(draft())).code).toBe('unsupported_envelope');
    expect(diagnostic(chat([{ type: 'text', text: JSON.stringify(draft()) }])).code).toBe(
      'unsupported_envelope',
    );
  });
  it.each(['{', '```json\n{}\n```', '{"data":'])(
    'does not repair malformed/incomplete JSON',
    (content) => expect(diagnostic(chat(content))).toEqual({ stage: 'json', code: 'invalid_json' }),
  );
  it.each([
    () => ({ response: 'x'.repeat(LIMITS.outputBytes + 1) }),
    () => ({ response: { data: 'x'.repeat(LIMITS.outputBytes + 1) } }),
    () => ({ ...chat(), usage: { private: 'x'.repeat(LIMITS.outputBytes + 1) } }),
  ])('bounds complete response bytes including metadata/structured content', (make) =>
    expect(diagnostic(make())).toEqual({ stage: 'limits', code: 'output_limit' }),
  );
  it('never accepts wrapper unwrapping as proof of valid data/evidence', () => {
    expect(() =>
      validateAIOutput(modelContent({ response: { arbitrary: 'private' } }), []),
    ).toThrow(OutputValidationError);
  });
  it('retains strict required nullable fields, array bounds and closed objects in provider schema', () => {
    const schema = aiJsonSchema as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(['data', 'evidence']);
    expect(schema.additionalProperties).toBe(false);
    const data = schema.properties.data as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, Record<string, unknown>>;
    };
    expect(data.required).toEqual(Object.keys(blankDocument()));
    expect(data.additionalProperties).toBe(false);
    expect(data.properties.lineItems!.maxItems).toBe(20);
    expect(data.properties.taxes!.maxItems).toBe(5);
    expect(JSON.stringify(schema)).toContain('null');
  });
});
