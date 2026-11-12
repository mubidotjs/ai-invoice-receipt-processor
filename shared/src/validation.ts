import { documentSchema, type DocumentData, type ValidationCheck } from './schema';

export function scaled(value: string, places = 4): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) throw new Error('Invalid decimal');
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.length > places) throw new Error('Decimal precision exceeded');
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
}
export const money = (n: bigint) =>
  `${n < 0n ? '-' : ''}${(n < 0n ? -n : n) / 100n}.${((n < 0n ? -n : n) % 100n).toString().padStart(2, '0')}`;
const cents = (v: string) => scaled(v, 2);
const round = (n: bigint, divisor: bigint) => (n + divisor / 2n) / divisor;
export function validateDocument(input: unknown): ValidationCheck[] {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({
      code: 'INVALID_FORMAT',
      path: '/' + i.path.join('/'),
      status: 'warning',
      message: i.message,
    }));
  const d = parsed.data;
  const checks: ValidationCheck[] = [];
  const warn = (
    code: string,
    path: string,
    message: string,
    status: ValidationCheck['status'] = 'warning',
  ) => checks.push({ code, path, message, status });
  const compare = (
    code: string,
    path: string,
    expected: bigint,
    value: string,
    assumptions: string[] = [],
  ) => {
    const diff = cents(value) - expected;
    checks.push({
      code,
      path,
      status: diff >= -1n && diff <= 1n ? 'pass' : 'warning',
      message:
        diff >= -1n && diff <= 1n
          ? 'Arithmetically consistent under the displayed assumptions.'
          : 'Amounts differ. Verify against the document; discounts or tax basis may explain the difference.',
      expected: money(expected),
      observed: value,
      difference: money(diff),
      ...(assumptions.length ? { assumptions } : {}),
    });
  };
  for (const key of ['vendorName', 'issueDate', 'currency', 'total'] as const)
    if (d[key] === null) warn('MISSING_FIELD', '/' + key, `${key} is missing or ambiguous.`);
  if (d.documentType === 'invoice' && !d.invoiceNumber)
    warn('MISSING_INVOICE_NUMBER', '/invoiceNumber', 'Invoice number is missing.');
  if (d.documentType === 'unknown')
    warn('UNKNOWN_DOCUMENT_TYPE', '/documentType', 'Document type needs review.');
  if (d.dueDate && d.issueDate && d.dueDate < d.issueDate)
    warn('DATE_ORDER', '/dueDate', 'Due date precedes issue date.');
  if (!d.lineItemsComplete || !d.lineItems.length)
    warn('INCOMPLETE_LINES', '/lineItems', 'Line item coverage has not been confirmed.');
  if (!d.currency)
    warn(
      'CURRENCY_UNKNOWN',
      '/currency',
      'Choose the currency; symbols alone may be ambiguous.',
      'not_checkable',
    );
  d.lineItems.forEach((line, i) => {
    if (line.quantity !== null && scaled(line.quantity) === 0n)
      warn('ZERO_QUANTITY', `/lineItems/${i}/quantity`, 'Zero quantity needs review.');
    if ([line.description, line.quantity, line.unitPrice, line.lineTotal].some((v) => v === null))
      warn('INCOMPLETE_LINE', `/lineItems/${i}`, 'Line item has missing values.');
    if (
      line.quantity === null ||
      line.unitPrice === null ||
      line.lineTotal === null ||
      d.taxMode === 'unknown' ||
      !d.currency
    ) {
      warn(
        'LINE_TOTAL',
        `/lineItems/${i}/lineTotal`,
        'Cannot check this line without quantity, unit price, total, currency and a confirmed consistent tax basis.',
        'not_checkable',
      );
      return;
    }
    const expected =
      round(scaled(line.quantity) * scaled(line.unitPrice), 1_000_000n) -
      (line.discountAmount === null ? 0n : cents(line.discountAmount));
    compare('LINE_TOTAL', `/lineItems/${i}/lineTotal`, expected, line.lineTotal, [
      'Unit price and line total use the same tax basis.',
      ...(line.discountAmount === null
        ? ['Unreported line discount treated as zero for this diagnostic only.']
        : []),
    ]);
  });
  if (
    d.currency &&
    d.taxMode !== 'unknown' &&
    d.lineItemsComplete &&
    d.lineItems.length &&
    d.subtotal !== null &&
    d.lineItems.every((l) => l.lineTotal !== null)
  )
    compare(
      'SUBTOTAL',
      '/subtotal',
      d.lineItems.reduce((n, l) => n + cents(l.lineTotal!), 0n),
      d.subtotal,
      ['Line totals and subtotal use the same tax basis.'],
    );
  else
    warn(
      'SUBTOTAL',
      '/subtotal',
      'Cannot check subtotal without complete lines, currency and consistent tax basis.',
      'not_checkable',
    );
  if (
    d.currency &&
    d.taxes.length &&
    d.taxTotal !== null &&
    d.taxes.every((t) => t.amount !== null)
  )
    compare(
      'TAX_TOTAL',
      '/taxTotal',
      d.taxes.reduce((n, t) => n + cents(t.amount!), 0n),
      d.taxTotal,
      ['The listed taxes cover all taxes.'],
    );
  else
    warn('TAX_TOTAL', '/taxTotal', 'Itemized tax reconciliation is unavailable.', 'not_checkable');
  if (
    d.currency &&
    d.subtotal !== null &&
    d.total !== null &&
    d.taxMode !== 'unknown' &&
    (d.taxMode === 'inclusive' || d.taxTotal !== null)
  ) {
    const optional = ['discountTotal', 'shipping', 'tip'] as const;
    const assumptions = optional
      .filter((k) => d[k] === null)
      .map((k) => `Unreported ${k} treated as zero for this diagnostic only.`);
    assumptions.push(
      'Subtotal and total use the selected tax treatment; line discounts are already included in subtotal.',
    );
    compare(
      'GRAND_TOTAL',
      '/total',
      cents(d.subtotal) -
        cents(d.discountTotal ?? '0.00') +
        cents(d.shipping ?? '0.00') +
        cents(d.tip ?? '0.00') +
        (d.taxMode === 'exclusive' ? cents(d.taxTotal!) : 0n),
      d.total,
      assumptions,
    );
  } else
    warn(
      'GRAND_TOTAL',
      '/total',
      'Cannot reconcile total without subtotal, currency, tax treatment and applicable tax total.',
      'not_checkable',
    );
  return checks;
}
export function leafValues(data: DocumentData): [string, string | boolean | null][] {
  return Object.entries(data).flatMap(([key, value]) =>
    Array.isArray(value)
      ? value.flatMap((row: Record<string, string | null>, i: number) =>
          Object.entries(row).map(([k, v]): [string, string | null] => [`/${key}/${i}/${k}`, v]),
        )
      : [[`/${key}`, value as string | boolean | null]],
  );
}
