import type { z } from 'zod';

export type OutputDiagnostic = {
  stage: 'envelope' | 'json' | 'schema' | 'evidence' | 'value' | 'limits';
  code:
    | 'unsupported_envelope'
    | 'missing_content'
    | 'incomplete_completion'
    | 'unexpected_tools'
    | 'refusal'
    | 'invalid_json'
    | 'invalid_structure'
    | 'invalid_evidence_path'
    | 'invalid_evidence_page'
    | 'invalid_evidence_quote'
    | 'missing_evidence'
    | 'unsupported_value'
    | 'output_limit';
  path?: string;
};

// Never interpolate provider content, Zod messages/keys or financial values into diagnostics.
export class OutputValidationError extends Error {
  constructor(public readonly diagnostic: OutputDiagnostic) {
    super('Model output was rejected.');
    this.name = 'OutputValidationError';
  }
}

export function safeOutputPath(path: PropertyKey[]): string | undefined {
  const value = '/' + path.map(String).join('/');
  if (
    /^\/data(?:\/(?:documentType|vendorName|invoiceNumber|receiptNumber|issueDate|dueDate|currency|subtotal|taxTotal|discountTotal|shipping|tip|total|taxMode|lineItemsComplete))?$/.test(
      value,
    ) ||
    /^\/data\/(?:lineItems|taxes)$/.test(value) ||
    /^\/data\/lineItems\/(?:[0-9]|1[0-9])(?:\/(?:description|quantity|unitPrice|discountAmount|lineTotal))?$/.test(
      value,
    ) ||
    /^\/data\/taxes\/[0-4](?:\/(?:label|ratePercent|amount))?$/.test(value) ||
    /^\/evidence(?:\/(?:[0-9]|[1-9][0-9])(?:\/(?:path|page|quote))?)?$/.test(value)
  )
    return value;
  return undefined;
}

export function structuralDiagnostic(issues: z.core.$ZodIssue[]): OutputDiagnostic {
  const issue = issues[0];
  const path = safeOutputPath(issue?.path ?? []);
  const suffix = String(issue?.path.at(-1) ?? '');
  const location = path ? { path } : {};
  if (issue?.code === 'too_big') return { stage: 'limits', code: 'output_limit', ...location };
  if (path?.startsWith('/evidence/')) {
    const code =
      suffix === 'page'
        ? 'invalid_evidence_page'
        : suffix === 'path'
          ? 'invalid_evidence_path'
          : suffix === 'quote'
            ? 'invalid_evidence_quote'
            : 'invalid_structure';
    return { stage: 'evidence', code, ...location };
  }
  if (
    path?.startsWith('/data/') &&
    /^(issueDate|dueDate|currency|quantity|unitPrice|discountAmount|lineTotal|ratePercent|amount|subtotal|taxTotal|discountTotal|shipping|tip|total)$/.test(
      suffix,
    )
  )
    return { stage: 'value', code: 'unsupported_value', ...location };
  return { stage: 'schema', code: 'invalid_structure', ...location };
}
