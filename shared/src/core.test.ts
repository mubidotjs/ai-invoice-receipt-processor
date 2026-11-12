import { describe, expect, it } from 'vitest';
import {
  blankDocument,
  blankLine,
  documentSchema,
  requestSchema,
  normalizeText,
  aiJsonSchema,
} from './schema';
import { validateDocument, scaled } from './validation';
import { validateAIOutput } from './evidence';
import {
  csvCell,
  csvExport,
  editValue,
  exportRecord,
  initialProvenance,
  jsonExport,
  removeRow,
  type ReviewMeta,
} from './review';
import expected from '../../fixtures/expected/documents.json';
const meta: ReviewMeta = {
  mode: 'manual',
  synthetic: false,
  textMethods: ['OCR'],
  sourceTextEdited: false,
};
const simple = () => ({
  data: { ...blankDocument(), vendorName: 'ACME', currency: 'USD' as const, total: '10.00' },
  evidence: [
    { path: '/vendorName', page: 1, quote: 'ACME' },
    { path: '/currency', page: 1, quote: 'USD' },
    { path: '/total', page: 1, quote: 'Total 10.00' },
  ],
});
const pages = [{ page: 1, text: 'ACME\nUSD\nTotal 10.00' }];
describe('strict contracts', () => {
  it('all six authored expected records satisfy the schema', () => {
    expect(expected).toHaveLength(6);
    for (const f of expected) expect(documentSchema.safeParse(f.data).success, f.id).toBe(true);
  });
  it.each(['-1.00', '1e3', 'NaN', '1,000.00', '0.001', '01.00', '1000000000.00', '1', ''])(
    'rejects malformed money %s',
    (total) => expect(documentSchema.safeParse({ ...blankDocument(), total }).success).toBe(false),
  );
  it.each(['2026-02-29', '2026-13-01', '01/02/2026', '2026-04-31'])(
    'rejects invalid or ambiguous date %s',
    (issueDate) =>
      expect(documentSchema.safeParse({ ...blankDocument(), issueDate }).success).toBe(false),
  );
  it('accepts leap day and nullable fields', () =>
    expect(
      documentSchema.parse({ ...blankDocument(), issueDate: '2024-02-29' }).currency,
    ).toBeNull());
  it('rejects extra keys, unsupported currency and too many rows', () => {
    expect(documentSchema.safeParse({ ...blankDocument(), rawDocument: 'no' }).success).toBe(false);
    expect(documentSchema.safeParse({ ...blankDocument(), currency: 'JPY' }).success).toBe(false);
    expect(
      documentSchema.safeParse({
        ...blankDocument(),
        lineItems: Array.from({ length: 21 }, blankLine),
      }).success,
    ).toBe(false);
  });
  it('rejects excess decimal precision and tax rates', () => {
    expect(
      documentSchema.safeParse({
        ...blankDocument(),
        lineItems: [{ ...blankLine(), quantity: '1.0001' }],
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...blankDocument(),
        taxes: [{ label: null, ratePercent: '101', amount: null }],
      }).success,
    ).toBe(false);
  });
  it('requires true consent, bounded text, sequential pages and exact request keys', () => {
    const req = { schemaVersion: '1', consent: true, pages, turnstileToken: 'mock' };
    expect(requestSchema.safeParse(req).success).toBe(true);
    for (const patch of [
      { consent: false },
      { pages: [{ page: 2, text: 'x' }] },
      { pages: [{ page: 1, text: 'x'.repeat(12001) }] },
      { pages: [{ page: 1, text: '  ' }] },
      { model: 'other' },
    ])
      expect(requestSchema.safeParse({ ...req, ...patch }).success).toBe(false);
  });
  it('normalizes line endings and strips direction/control characters', () =>
    expect(normalizeText('A\r\nB\u0000\u202e')).toBe('A\nB'));
  it('provider schema remains a strict structural schema', () => {
    expect(aiJsonSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(aiJsonSchema)).toContain('lineItems');
  });
});
describe('source evidence applies to AI values', () => {
  it('accepts supported claims', () =>
    expect(validateAIOutput(simple(), pages).data.total).toBe('10.00'));
  it('rejects fabricated quote, wrong page and unknown path', () => {
    for (const patch of [{ quote: 'fabricated' }, { page: 2 }, { path: '/__proto__' }]) {
      const x = simple();
      x.evidence[0] = { ...x.evidence[0]!, ...patch };
      expect(() => validateAIOutput(x, pages)).toThrow();
    }
  });
  it('rejects unsupported values even with a source quote', () => {
    const x = simple();
    x.data.total = '99.00';
    expect(() => validateAIOutput(x, pages)).toThrow('Unsupported');
  });
  it('rejects missing evidence and ambiguous dollar currency', () => {
    const x = simple();
    x.evidence.pop();
    expect(() => validateAIOutput(x, pages)).toThrow();
    const y = simple();
    y.evidence[1]!.quote = '$';
    expect(() => validateAIOutput(y, [{ page: 1, text: 'ACME $ Total 10.00' }])).toThrow();
  });
  it('supports row evidence and explicit named dates', () => {
    const data = {
      ...blankDocument(),
      issueDate: '2026-10-28',
      lineItems: [
        {
          ...blankLine(),
          description: 'Paper',
          quantity: '2',
          unitPrice: '5.00',
          lineTotal: '10.00',
        },
      ],
    };
    const evidence = [
      { path: '/issueDate', page: 1, quote: '28 October 2026' },
      { path: '/lineItems/0', page: 1, quote: 'Paper 2 5.00 10.00' },
    ];
    expect(
      validateAIOutput({ data, evidence }, [
        { page: 1, text: evidence.map((e) => e.quote).join('\n') },
      ]).data.issueDate,
    ).toBe('2026-10-28');
  });
  it('does not accept numeric substrings or ISO-normalize ambiguous dates', () => {
    const x = simple();
    x.evidence[2]!.quote = 'Total 110.00';
    expect(() => validateAIOutput(x, [{ page: 1, text: 'ACME USD Total 110.00' }])).toThrow();
    const data = { ...blankDocument(), issueDate: '2026-01-02' };
    expect(() =>
      validateAIOutput({ data, evidence: [{ path: '/issueDate', page: 1, quote: '01/02/2026' }] }, [
        { page: 1, text: '01/02/2026' },
      ]),
    ).toThrow();
  });
});
describe('decimal-safe financial diagnostics', () => {
  const harbor = () => documentSchema.parse(expected[0]!.data);
  it('reconciles fractional quantities, exclusive tax and subtotal', () => {
    const checks = validateDocument(harbor());
    expect(
      checks
        .filter((c) => ['LINE_TOTAL', 'SUBTOTAL', 'TAX_TOTAL', 'GRAND_TOTAL'].includes(c.code))
        .every((c) => c.status === 'pass'),
    ).toBe(true);
  });
  it('detects the intentional inclusive-tax mismatch without adding tax twice', () => {
    const d = documentSchema.parse(expected[4]!.data);
    const c = validateDocument(d).find((c) => c.code === 'GRAND_TOTAL');
    expect(c).toMatchObject({
      expected: '36.40',
      observed: '37.40',
      difference: '1.00',
      status: 'warning',
    });
  });
  it('uses a one-cent tolerance', () => {
    const d = harbor();
    d.total = '165.01';
    expect(validateDocument(d).find((c) => c.code === 'GRAND_TOTAL')?.status).toBe('pass');
    d.total = '165.02';
    expect(validateDocument(d).find((c) => c.code === 'GRAND_TOTAL')?.status).toBe('warning');
  });
  it('documents conditional zero assumptions without populating nulls', () => {
    const d = harbor();
    d.tip = null;
    expect(
      validateDocument(d)
        .find((c) => c.code === 'GRAND_TOTAL')
        ?.assumptions?.join(),
    ).toContain('Unreported tip');
    expect(d.tip).toBeNull();
  });
  it('skips checks with unknown tax/currency or incomplete lines', () => {
    const d = harbor();
    d.taxMode = 'unknown';
    d.currency = null;
    d.lineItemsComplete = false;
    expect(
      validateDocument(d)
        .filter((c) => ['LINE_TOTAL', 'SUBTOTAL', 'GRAND_TOTAL'].includes(c.code))
        .every((c) => c.status === 'not_checkable'),
    ).toBe(true);
  });
  it('subtracts line discounts separately from document discounts', () => {
    const d = harbor();
    d.lineItems[0]!.discountAmount = '20.00';
    d.lineItems[0]!.lineTotal = '100.00';
    d.subtotal = '130.00';
    d.taxTotal = '13.00';
    d.taxes[0]!.amount = '13.00';
    d.discountTotal = '5.00';
    d.total = '138.00';
    expect(validateDocument(d).find((c) => c.code === 'GRAND_TOTAL')?.status).toBe('pass');
  });
  it('flags date order and missing fields', () => {
    const d = harbor();
    d.dueDate = '2025-01-01';
    expect(validateDocument(d).some((c) => c.code === 'DATE_ORDER')).toBe(true);
    expect(validateDocument(blankDocument()).some((c) => c.code === 'MISSING_FIELD')).toBe(true);
  });
  it('rounds half-up with large exact decimals', () => {
    const d = harbor();
    d.lineItems = [{ ...blankLine(), quantity: '0.1', unitPrice: '0.05', lineTotal: '0.01' }];
    expect(validateDocument(d).find((c) => c.code === 'LINE_TOTAL')?.expected).toBe('0.01');
    expect(scaled('999999999.99', 2)).toBe(99999999999n);
  });
});
describe('manual provenance and reviewed export', () => {
  it('exports manual-only incomplete data after review and acknowledgment', () => {
    const d = editValue(blankDocument(), {}, '/vendorName', 'Manual shop');
    const record = exportRecord(d.data, d.provenance, meta, true, true);
    expect(record.provenance['/vendorName']).toEqual({
      origin: 'manual-entry',
      originalValue: null,
    });
    expect(jsonExport(record)).not.toContain('turnstile');
    expect(csvExport(record)).toContain('Manual shop');
  });
  it('blocks unreviewed, unacknowledged and invalid records', () => {
    expect(() => exportRecord(blankDocument(), {}, meta, false, true)).toThrow('review');
    expect(() => exportRecord(blankDocument(), {}, meta, true, false)).toThrow('warnings');
    expect(() =>
      exportRecord({ ...blankDocument(), total: 'bad' }, {}, meta, true, true),
    ).toThrow();
  });
  it('separates corrected values from original AI evidence', () => {
    const x = simple();
    const p = initialProvenance(x.data, 'ai', x.evidence);
    const edited = editValue(x.data, p, '/total', '12.00');
    expect(edited.provenance['/total']).toEqual({
      origin: 'manual-correction',
      originalValue: '10.00',
    });
    expect(p['/total']!.evidence).toHaveLength(1);
    expect(
      exportRecord(edited.data, edited.provenance, { ...meta, mode: 'live-ai' }, true, true).data
        .total,
    ).toBe('12.00');
  });
  it('retains AI evidence for untouched fields and rejects missing AI provenance', () => {
    const x = simple();
    const p = initialProvenance(x.data, 'ai', x.evidence);
    p['/total']!.evidence = [];
    expect(() => exportRecord(x.data, p, meta, true, true)).toThrow('evidence');
  });
  it('moves current row provenance without rewriting its original evidence path', () => {
    const d = documentSchema.parse(expected[0]!.data);
    const p = initialProvenance(d, 'ai', [
      { path: '/lineItems/1', page: 1, quote: 'Project materials' },
    ]);
    const next = removeRow(d, p, 'lineItems', 0);
    expect(next.data.lineItems[0]!.description).toBe('Project materials');
    expect(next.provenance['/lineItems/0/description']!.evidence?.[0]?.path).toBe('/lineItems/1');
  });
  it.each(['=SUM(A1)', '  +cmd', '\t@formula', '-1+2', '\n=IMPORTXML()'])(
    'neutralizes CSV formula %s',
    (value) => expect(csvCell(value).startsWith('"\'')).toBe(true),
  );
  it('quotes commas, quotes and newlines and includes provenance/warnings in CSV', () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    const record = exportRecord(blankDocument(), {}, meta, true, true);
    const csv = csvExport(record);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('field_provenance_json');
    expect(csv).toContain('MISSING_FIELD');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
