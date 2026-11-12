import {
  aiOutputSchema,
  normalizeText,
  type DocumentData,
  type Evidence,
  type TextPage,
} from './schema';
import { leafValues, scaled } from './validation';
import { OutputValidationError, safeOutputPath, structuralDiagnostic } from './diagnostics';

const flat = (v: string) => normalizeText(v).replace(/\s+/g, ' ').trim().toLowerCase();
function supported(value: string, path: string, quote: string): boolean {
  const q = flat(quote);
  if (/\/(issueDate|dueDate)$/.test(path)) {
    if (new RegExp(`(?<![\\d-])${value}(?![\\d-])`).test(q)) return true;
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    const matches = [
      ...q.matchAll(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/g),
      ...q.matchAll(/\b([a-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/g),
    ];
    return matches.some((match) => {
      const firstDay = /^\d+$/.test(match[1]!);
      const month = monthNames.findIndex(
        (m) => m === match[firstDay ? 2 : 1] || m.slice(0, 3) === match[firstDay ? 2 : 1],
      );
      return (
        month >= 0 &&
        value ===
          `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[firstDay ? 1 : 2]!.padStart(2, '0')}`
      );
    });
  }
  if (path === '/currency')
    return (
      new RegExp(`\\b${value.toLowerCase()}\\b`).test(q) ||
      (value === 'EUR' && q.includes('€')) ||
      (value === 'GBP' && q.includes('£'))
    );
  if (
    /(quantity|unitPrice|discountAmount|lineTotal|ratePercent|amount|subtotal|taxTotal|discountTotal|shipping|tip|total)$/.test(
      path,
    )
  ) {
    return [...q.matchAll(/(?<![\d.,-])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,4})?(?![\d.,])/g)].some(
      (m) => {
        try {
          return scaled(m[0].replaceAll(',', '')) === scaled(value);
        } catch {
          return false;
        }
      },
    );
  }
  return q.includes(flat(value));
}
export function validateAIOutput(
  input: unknown,
  pages: TextPage[],
): { data: DocumentData; evidence: Evidence[] } {
  const parsed = aiOutputSchema.safeParse(input);
  if (!parsed.success) throw new OutputValidationError(structuralDiagnostic(parsed.error.issues));
  const result = parsed.data;
  const values = leafValues(result.data);
  const validPaths = new Set(values.map(([p]) => p));
  result.data.lineItems.forEach((_, i) => validPaths.add(`/lineItems/${i}`));
  result.data.taxes.forEach((_, i) => validPaths.add(`/taxes/${i}`));
  for (const [i, e] of result.evidence.entries()) {
    if (!validPaths.has(e.path))
      throw new OutputValidationError({
        stage: 'evidence',
        code: 'invalid_evidence_path',
        path: `/evidence/${i}/path`,
      });
    const page = pages.find((p) => p.page === e.page);
    if (!page)
      throw new OutputValidationError({
        stage: 'evidence',
        code: 'invalid_evidence_page',
        path: `/evidence/${i}/page`,
      });
    if (!normalizeText(page.text).includes(e.quote))
      throw new OutputValidationError({
        stage: 'evidence',
        code: 'invalid_evidence_quote',
        path: `/evidence/${i}/quote`,
      });
  }
  for (const [path, value] of values) {
    if (
      value === null ||
      typeof value === 'boolean' ||
      (value === 'unknown' && ['/documentType', '/taxMode'].includes(path))
    )
      continue;
    const parent = /^\/(lineItems|taxes)\/\d+\//.test(path)
      ? path.slice(0, path.lastIndexOf('/'))
      : '';
    const candidates = result.evidence.filter((e) => e.path === path || e.path === parent);
    if (!candidates.some((e) => supported(value, path, e.quote)))
      throw new OutputValidationError({
        stage: candidates.length ? 'value' : 'evidence',
        code: candidates.length ? 'unsupported_value' : 'missing_evidence',
        path: safeOutputPath(['data', ...path.slice(1).split('/')]),
      });
  }
  return result;
}
