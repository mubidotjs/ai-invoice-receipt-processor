/* eslint-disable no-control-regex -- Deliberately remove untrusted control characters. */
import { z } from 'zod';

export const LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024,
  imagePixels: 20_000_000,
  imageEdge: 8192,
  canvasPixels: 4_000_000,
  canvasEdge: 3000,
  pages: 3,
  localChars: 50_000,
  aiChars: 12_000,
  bodyBytes: 65536,
  promptBytes: 32768,
  outputBytes: 65536,
  lineItems: 20,
  taxes: 5,
  evidence: 100,
  decodeMs: 10000,
  pdfMs: 15000,
  ocrMs: 60000,
  localMs: 180000,
  aiMs: 90000,
  browserMs: 105000,
});
export const MODEL = '@cf/google/gemma-4-26b-a4b-it' as const;
export const PROMPT_VERSION = 'invoice-v1' as const;
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine(
      (v) =>
        v.trim() === v &&
        !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(v),
      'Use plain trimmed text without control characters',
    )
    .nullable();
export const moneySchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,8})\.\d{2}$/,
    'Use a nonnegative amount such as 12.50 (up to nine integer digits)',
  )
  .nullable();
const decimal = (digits: number) =>
  z
    .string()
    .regex(
      new RegExp(`^(0|[1-9]\\d{0,8})(\\.\\d{1,${digits}})?$`),
      `Use a nonnegative decimal with at most ${digits} decimal places`,
    )
    .nullable();
const date = z.iso.date().nullable();
export const lineSchema = z.strictObject({
  description: text(240),
  quantity: decimal(3),
  unitPrice: decimal(4),
  discountAmount: moneySchema,
  lineTotal: moneySchema,
});
export const taxSchema = z.strictObject({
  label: text(80),
  ratePercent: decimal(4).refine((v) => v === null || Number(v) <= 100, 'Rate must not exceed 100'),
  amount: moneySchema,
});
export const documentSchema = z.strictObject({
  documentType: z.enum(['invoice', 'receipt', 'unknown']),
  vendorName: text(160),
  invoiceNumber: text(80),
  receiptNumber: text(80),
  issueDate: date,
  dueDate: date,
  currency: z.enum(['USD', 'EUR', 'GBP', 'PKR']).nullable(),
  lineItems: z.array(lineSchema).max(20),
  taxes: z.array(taxSchema).max(5),
  subtotal: moneySchema,
  taxTotal: moneySchema,
  discountTotal: moneySchema,
  shipping: moneySchema,
  tip: moneySchema,
  total: moneySchema,
  taxMode: z.enum(['exclusive', 'inclusive', 'unknown']),
  lineItemsComplete: z.boolean(),
});
export type DocumentData = z.infer<typeof documentSchema>;
export const evidenceSchema = z.strictObject({
  path: z.string().min(1).max(100),
  page: z.number().int().min(1).max(3),
  quote: z.string().min(1).max(160),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const aiOutputSchema = z.strictObject({
  data: documentSchema,
  evidence: z.array(evidenceSchema).max(100),
});
export const aiJsonSchema = z.toJSONSchema(aiOutputSchema);
export const pageSchema = z.strictObject({
  page: z.number().int().min(1).max(3),
  text: z.string().max(50000),
});
export type TextPage = z.infer<typeof pageSchema>;
export const requestSchema = z
  .strictObject({
    schemaVersion: z.literal('1'),
    consent: z.literal(true),
    pages: z.array(pageSchema).min(1).max(3),
    turnstileToken: z.string().min(1).max(2048),
  })
  .superRefine((v, ctx) => {
    if (v.pages.some((p, i) => p.page !== i + 1))
      ctx.addIssue({
        code: 'custom',
        path: ['pages'],
        message: 'Pages must be sequential and unique',
      });
    const length = v.pages.reduce((n, p) => n + p.text.length, 0);
    if (length > LIMITS.aiChars || !v.pages.some((p) => normalizeText(p.text).trim()))
      ctx.addIssue({
        code: 'custom',
        path: ['pages'],
        message: 'Supply 1–12,000 characters of document text',
      });
  });
export const checkSchema = z.strictObject({
  code: z.string(),
  path: z.string(),
  status: z.enum(['pass', 'warning', 'not_checkable']),
  message: z.string(),
  expected: z.string().optional(),
  observed: z.string().optional(),
  difference: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
});
export type ValidationCheck = z.infer<typeof checkSchema>;
export const responseSchema = z.strictObject({
  schemaVersion: z.literal('1'),
  mode: z.literal('live-ai'),
  model: z.literal(MODEL),
  promptVersion: z.literal(PROMPT_VERSION),
  data: documentSchema,
  evidence: z.array(evidenceSchema).max(100),
  checks: z.array(checkSchema).max(100),
});
export const blankLine = (): DocumentData['lineItems'][number] => ({
  description: null,
  quantity: null,
  unitPrice: null,
  discountAmount: null,
  lineTotal: null,
});
export const blankTax = (): DocumentData['taxes'][number] => ({
  label: null,
  ratePercent: null,
  amount: null,
});
export const blankDocument = (): DocumentData => ({
  documentType: 'unknown',
  vendorName: null,
  invoiceNumber: null,
  receiptNumber: null,
  issueDate: null,
  dueDate: null,
  currency: null,
  lineItems: [],
  taxes: [],
  subtotal: null,
  taxTotal: null,
  discountTotal: null,
  shipping: null,
  tip: null,
  total: null,
  taxMode: 'unknown',
  lineItemsComplete: false,
});
export function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, '')
    .normalize('NFC');
}
