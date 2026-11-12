// Author-controlled synthetic text and independently specified expected structured values.
// No extractor/model is used to produce expected data. Poppler is setup tooling only.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const poppler =
  process.env.PDFTOPPM ||
  'C:/Users/Tech Mehal/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe';
const root = 'fixtures/documents';
await mkdir(root, { recursive: true });
await mkdir('fixtures/demo', { recursive: true });
await mkdir('fixtures/expected', { recursive: true });
await mkdir('tmp/fixtures', { recursive: true });
const blank = {
  documentType: 'invoice',
  vendorName: null,
  invoiceNumber: null,
  receiptNumber: null,
  issueDate: '2026-10-28',
  dueDate: null,
  currency: null,
  lineItems: [],
  taxes: [],
  subtotal: null,
  taxTotal: null,
  discountTotal: '0.00',
  shipping: '0.00',
  tip: '0.00',
  total: null,
  taxMode: 'exclusive',
  lineItemsComplete: true,
};
const line = (description, quantity, unitPrice, lineTotal) => ({
  description,
  quantity,
  unitPrice,
  discountAmount: '0.00',
  lineTotal,
});
const fixtures = [
  {
    id: 'harbor',
    title: 'Harbor Studio · USD invoice',
    description: 'Digital PDF · fractional quantity · exclusive tax',
    ext: 'pdf',
    mode: 'native',
    text: [
      [
        'HARBOR STUDIO',
        'INVOICE HBR-1042',
        'Issue date: 2026-10-28',
        'Due date: 2026-11-27',
        'Currency: USD',
        'Tax treatment: exclusive',
        '',
        'Description / Quantity / Unit price / Line total',
        'Design consultation    1.5    80.00    120.00',
        'Project materials      1     30.00     30.00',
        'Line discounts: 0.00',
        '',
        'Subtotal: 150.00',
        'Sales tax 10%: 15.00',
        'Tax total: 15.00',
        'Document discount: 0.00',
        'Shipping: 0.00',
        'Tip: 0.00',
        'TOTAL USD 165.00',
      ],
    ],
    data: {
      ...blank,
      vendorName: 'HARBOR STUDIO',
      invoiceNumber: 'HBR-1042',
      dueDate: '2026-11-27',
      currency: 'USD',
      lineItems: [
        line('Design consultation', '1.5', '80.00', '120.00'),
        line('Project materials', '1', '30.00', '30.00'),
      ],
      taxes: [{ label: 'Sales tax', ratePercent: '10', amount: '15.00' }],
      subtotal: '150.00',
      taxTotal: '15.00',
      total: '165.00',
    },
  },
  {
    id: 'saffron',
    title: 'Saffron Cafe · PKR receipt',
    description: 'PNG image · actual browser OCR',
    ext: 'png',
    mode: 'image',
    text: [
      [
        'SAFFRON CAFE',
        'RECEIPT SC-0088',
        'Issue date: 2026-10-28',
        'Currency: PKR',
        'Tax treatment: exclusive',
        '',
        'Description / Quantity / Unit price / Line total',
        'Masala chai     2    250.00    500.00',
        'Fresh bun       1    180.00    180.00',
        'Line discounts: 0.00',
        '',
        'Subtotal: 680.00',
        'Tax total: 0.00',
        'Document discount: 0.00',
        'Shipping: 0.00',
        'Tip: 0.00',
        'TOTAL PKR 680.00',
      ],
    ],
    data: {
      ...blank,
      documentType: 'receipt',
      vendorName: 'SAFFRON CAFE',
      receiptNumber: 'SC-0088',
      currency: 'PKR',
      lineItems: [
        line('Masala chai', '2', '250.00', '500.00'),
        line('Fresh bun', '1', '180.00', '180.00'),
      ],
      subtotal: '680.00',
      taxTotal: '0.00',
      total: '680.00',
    },
  },
  {
    id: 'northstar',
    title: 'Northstar Supply · GBP scanned PDF',
    description: 'Two scanned pages · OCR on both pages',
    ext: 'pdf',
    mode: 'scan',
    text: [
      [
        'NORTHSTAR SUPPLY',
        'INVOICE NS-208',
        'Issue date: 2026-10-28',
        'Currency: GBP',
        'Tax treatment: exclusive',
        '',
        'Description / Quantity / Unit price / Line total',
        'Archive folders     2    8.50    17.00',
        'Line discounts: 0.00',
        '',
        'Continued on page 2',
      ],
      [
        'NORTHSTAR SUPPLY',
        'INVOICE NS-208 - TOTALS',
        'Currency: GBP',
        '',
        'Subtotal: 17.00',
        'VAT 20%: 3.40',
        'Tax total: 3.40',
        'Document discount: 0.00',
        'Shipping: 0.00',
        'Tip: 0.00',
        'TOTAL GBP 20.40',
      ],
    ],
    data: {
      ...blank,
      vendorName: 'NORTHSTAR SUPPLY',
      invoiceNumber: 'NS-208',
      currency: 'GBP',
      lineItems: [line('Archive folders', '2', '8.50', '17.00')],
      taxes: [{ label: 'VAT', ratePercent: '20', amount: '3.40' }],
      subtotal: '17.00',
      taxTotal: '3.40',
      total: '20.40',
    },
  },
  {
    id: 'alder',
    title: 'Alder Workshop · EUR mixed PDF',
    description: 'Native first page + scanned totals page',
    ext: 'pdf',
    mode: 'mixed',
    text: [
      [
        'ALDER WORKSHOP',
        'INVOICE AW-305',
        'Issue date: 2026-10-28',
        'Currency: EUR',
        'Tax treatment: exclusive',
        '',
        'Description / Quantity / Unit price / Line total',
        'Workshop session     1    85.00    85.00',
        'Line discounts: 0.00',
        '',
        'Totals on the next page',
      ],
      [
        'ALDER WORKSHOP',
        'INVOICE AW-305 - TOTALS',
        'Currency: EUR',
        '',
        'Subtotal: 85.00',
        'VAT 20%: 17.00',
        'Tax total: 17.00',
        'Document discount: 0.00',
        'Shipping: 0.00',
        'Tip: 0.00',
        'TOTAL EUR 102.00',
      ],
    ],
    data: {
      ...blank,
      vendorName: 'ALDER WORKSHOP',
      invoiceNumber: 'AW-305',
      currency: 'EUR',
      lineItems: [line('Workshop session', '1', '85.00', '85.00')],
      taxes: [{ label: 'VAT', ratePercent: '20', amount: '17.00' }],
      subtotal: '85.00',
      taxTotal: '17.00',
      total: '102.00',
    },
  },
  {
    id: 'juniper',
    title: 'Juniper Kitchen · USD receipt',
    description: 'JPEG image · inclusive tax · intentional total mismatch',
    ext: 'jpg',
    mode: 'image',
    text: [
      [
        'JUNIPER KITCHEN',
        'RECEIPT JK-0042',
        'Issue date: 2026-10-28',
        'Currency: USD',
        'Tax treatment: inclusive',
        '',
        'Description / Quantity / Unit price / Line total',
        'Lunch set     1    32.40    32.40',
        'Line discounts: 0.00',
        '',
        'Subtotal (tax included): 32.40',
        'Included tax: 2.40',
        'Tax total: 2.40',
        'Document discount: 0.00',
        'Shipping: 0.00',
        'Tip: 4.00',
        'TOTAL USD 37.40',
        '',
        'Training example: totals require verification',
      ],
    ],
    data: {
      ...blank,
      documentType: 'receipt',
      vendorName: 'JUNIPER KITCHEN',
      receiptNumber: 'JK-0042',
      currency: 'USD',
      taxMode: 'inclusive',
      lineItems: [line('Lunch set', '1', '32.40', '32.40')],
      taxes: [{ label: 'Included tax', ratePercent: null, amount: '2.40' }],
      subtotal: '32.40',
      taxTotal: '2.40',
      tip: '4.00',
      total: '37.40',
    },
  },
  {
    id: 'cedar',
    title: 'Cedar Market · incomplete receipt',
    description: 'PNG image · ambiguous date and missing currency',
    ext: 'png',
    mode: 'image',
    text: [
      [
        'CEDAR MARKET',
        'RECEIPT CM-0015',
        'Date: 01/02/2026',
        'Currency: not stated',
        '',
        'Description / Quantity / Unit price / Line total',
        'Notebook     2    20.00    40.00',
        '',
        'Subtotal: 40.00',
        'TOTAL 40.00',
        '',
        'Training example: confirm date and currency',
      ],
    ],
    data: {
      ...blank,
      documentType: 'receipt',
      vendorName: 'CEDAR MARKET',
      receiptNumber: 'CM-0015',
      issueDate: null,
      taxMode: 'unknown',
      discountTotal: null,
      shipping: null,
      tip: null,
      lineItems: [{ ...line('Notebook', '2', '20.00', '40.00'), discountAmount: null }],
      subtotal: '40.00',
      total: '40.00',
    },
  },
];
async function sourcePdf(lines, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([600, 840]);
  page.drawRectangle({ x: 0, y: 785, width: 600, height: 55, color: rgb(0.12, 0.25, 0.2) });
  page.drawText('SYNTHETIC DOCUMENT / NOT A REAL TRANSACTION', {
    x: 35,
    y: 809,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });
  let y = 748;
  lines.forEach((text, i) => {
    page.drawText(text, {
      x: 35,
      y,
      size: i === 0 ? 24 : i === 1 || text.startsWith('TOTAL') ? 17 : 13,
      font: i < 2 || text.startsWith('TOTAL') ? bold : font,
      color: rgb(0.12, 0.18, 0.16),
    });
    y -= i === 0 ? 39 : 28;
  });
  page.drawText(`Portfolio fixture | ${label} | English | synthetic data only`, {
    x: 35,
    y: 28,
    size: 9,
    font,
    color: rgb(0.35, 0.4, 0.35),
  });
  return doc.save();
}
function raster(pdf, prefix, jpeg = false) {
  const result = spawnSync(
    poppler,
    ['-singlefile', '-scale-to', '1800', jpeg ? '-jpeg' : '-png', pdf, prefix],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
}
const manifest = [];
for (const f of fixtures) {
  const sources = [];
  for (let i = 0; i < f.text.length; i++) {
    const native = `tmp/fixtures/${f.id}-${i}.pdf`;
    await writeFile(native, await sourcePdf(f.text[i], `page ${i + 1}/${f.text.length}`));
    sources.push(native);
    raster(native, `${root}/${f.id}-p${i + 1}`);
  }
  const file = `${f.id}.${f.ext}`;
  if (f.mode === 'image') {
    if (f.ext === 'jpg') raster(sources[0], `${root}/${f.id}`, true);
    else await copyFile(`${root}/${f.id}-p1.png`, `${root}/${file}`);
  } else {
    const out = await PDFDocument.create();
    for (let i = 0; i < sources.length; i++) {
      if (f.mode === 'native' || (f.mode === 'mixed' && i === 0)) {
        const src = await PDFDocument.load(await readFile(sources[i]));
        const [page] = await out.copyPages(src, [0]);
        out.addPage(page);
      } else {
        const image = await out.embedPng(await readFile(`${root}/${f.id}-p${i + 1}.png`));
        const page = out.addPage([600, 840]);
        page.drawImage(image, { x: 0, y: 0, width: 600, height: 840 });
      }
    }
    await writeFile(`${root}/${file}`, await out.save());
  }
  manifest.push({
    id: f.id,
    title: f.title,
    description: f.description,
    file,
    mime: f.ext === 'pdf' ? 'application/pdf' : f.ext === 'jpg' ? 'image/jpeg' : 'image/png',
    pages: f.text.map((lines, i) => ({
      text: 'SYNTHETIC DOCUMENT / NOT A REAL TRANSACTION\n' + lines.join('\n'),
      preview: `${f.id}-p${i + 1}.png`,
    })),
    data: f.data,
  });
}
await writeFile(
  'fixtures/expected/documents.json',
  JSON.stringify(
    fixtures.map((f) => ({ id: f.id, data: f.data, text: f.text })),
    null,
    2,
  ) + '\n',
);
await writeFile('fixtures/demo/samples.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Created ${manifest.length} synthetic example documents and page previews in ${resolve(root)}.`,
);
