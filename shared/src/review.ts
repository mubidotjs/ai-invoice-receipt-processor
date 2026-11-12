import { documentSchema, type DocumentData, type Evidence, type ValidationCheck } from './schema';
import { leafValues, validateDocument } from './validation';
export type Origin = 'ai' | 'sample' | 'manual-entry' | 'manual-correction';
export type Provenance = Record<
  string,
  { origin: Origin; evidence?: Evidence[]; originalValue?: string | boolean | null }
>;
export type ReviewMeta = {
  mode: 'manual' | 'sample' | 'live-ai';
  synthetic: boolean;
  textMethods: string[];
  sourceTextEdited: boolean;
  model?: string;
  promptVersion?: string;
};
export function initialProvenance(
  data: DocumentData,
  origin: 'ai' | 'sample',
  evidence: Evidence[] = [],
): Provenance {
  return Object.fromEntries(
    leafValues(data).map(([path]) => [
      path,
      {
        origin,
        evidence: evidence.filter(
          (e) =>
            e.path === path ||
            (/^\/(lineItems|taxes)\/\d+\//.test(path) &&
              e.path === path.slice(0, path.lastIndexOf('/'))),
        ),
      },
    ]),
  );
}
export function editValue(
  data: DocumentData,
  provenance: Provenance,
  path: string,
  value: string | boolean | null,
): { data: DocumentData; provenance: Provenance } {
  const copy = structuredClone(data);
  const keys = path.slice(1).split('/');
  let row: Record<string, unknown> = copy as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) row = row[key] as Record<string, unknown>;
  const last = keys.at(-1)!;
  const old = row[last] as string | boolean | null;
  row[last] = value;
  const previous = provenance[path];
  return {
    data: copy,
    provenance: {
      ...provenance,
      [path]: {
        origin: !previous || old === null ? 'manual-entry' : 'manual-correction',
        originalValue: previous?.originalValue !== undefined ? previous.originalValue : old,
      },
    },
  };
}
export function removeRow(
  data: DocumentData,
  provenance: Provenance,
  group: 'lineItems' | 'taxes',
  index: number,
) {
  const copy = structuredClone(data);
  copy[group].splice(index, 1);
  const next: Provenance = {};
  for (const [path, value] of Object.entries(provenance)) {
    const match = path.match(new RegExp(`^/${group}/(\\d+)(/.*)$`));
    if (!match) next[path] = value;
    else if (Number(match[1]) !== index)
      next[`/${group}/${Number(match[1]) > index ? Number(match[1]) - 1 : match[1]}${match[2]}`] =
        value;
  }
  return { data: copy, provenance: next };
}
export function exportRecord(
  data: DocumentData,
  provenance: Provenance,
  meta: ReviewMeta,
  reviewed: boolean,
  acknowledged: boolean,
  additional: ValidationCheck[] = [],
) {
  const validated = documentSchema.parse(data);
  const checks = [...validateDocument(validated), ...additional];
  if (!reviewed) throw new Error('Confirm review of the current revision before export.');
  if (checks.some((c) => c.status !== 'pass') && !acknowledged)
    throw new Error('Acknowledge unresolved warnings before export.');
  const safeProvenance: Provenance = {};
  for (const [path, value] of leafValues(validated)) {
    const p = provenance[path] ?? { origin: 'manual-entry' as const };
    if (
      p.origin === 'ai' &&
      value !== null &&
      typeof value !== 'boolean' &&
      value !== 'unknown' &&
      !p.evidence?.length
    )
      throw new Error('AI-populated fields require their original evidence.');
    safeProvenance[path] = p;
  }
  return {
    schemaVersion: '1' as const,
    data: validated,
    provenance: safeProvenance,
    processing: meta,
    checks,
    review: {
      confirmed: true,
      acknowledgedWarningCodes: acknowledged
        ? checks.filter((c) => c.status !== 'pass').map((c) => c.code)
        : [],
      reviewedAt: new Date().toISOString(),
    },
  };
}
export type ExportRecord = ReturnType<typeof exportRecord>;
export const jsonExport = (record: ExportRecord) => JSON.stringify(record, null, 2) + '\n';
export function csvCell(value: unknown): string {
  let s =
    typeof value === 'string'
      ? value
      : value == null
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
  if (/^[\s\uFEFF]*[=+@-]/u.test(s) || /^[\t\r\n]/u.test(s)) s = "'" + s;
  return `"${s.replaceAll('"', '""')}"`;
}
export function csvExport(record: ExportRecord): string {
  const { lineItems, taxes, ...doc } = record.data;
  const common = {
    schema_version: record.schemaVersion,
    ...doc,
    taxes_json: taxes,
    extraction_mode: record.processing.mode,
    synthetic: record.processing.synthetic,
    text_methods: record.processing.textMethods.join(';'),
    source_text_edited: record.processing.sourceTextEdited,
    model: record.processing.model ?? '',
    prompt_version: record.processing.promptVersion ?? '',
    reviewed_at: record.review.reviewedAt,
    unresolved_warning_codes: record.review.acknowledgedWarningCodes.join(';'),
    checks_json: record.checks,
    field_provenance_json: record.provenance,
  };
  const rows = (lineItems.length ? lineItems : [null]).map((line, i) => ({
    ...common,
    line_index: line ? i + 1 : '',
    line_description: line?.description,
    line_quantity: line?.quantity,
    line_unit_price: line?.unitPrice,
    line_discount: line?.discountAmount,
    line_total: line?.lineTotal,
  }));
  return (
    '\uFEFF' +
    [
      Object.keys(rows[0]!).map(csvCell).join(','),
      ...rows.map((row) => Object.values(row).map(csvCell).join(',')),
    ].join('\r\n') +
    '\r\n'
  );
}
