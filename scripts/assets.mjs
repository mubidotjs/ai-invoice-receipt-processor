import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const target = 'web/public/assets';
await mkdir(`${target}/ocr/core`, { recursive: true });
await mkdir(`${target}/ocr/lang`, { recursive: true });
await mkdir(`${target}/pdf`, { recursive: true });
await cp('node_modules/tesseract.js/dist/worker.min.js', `${target}/ocr/worker.min.js`);
for (const file of await readdir('node_modules/tesseract.js-core'))
  if (/\.(js|wasm)$/.test(file))
    await cp(join('node_modules/tesseract.js-core', file), `${target}/ocr/core/${file}`);
await cp(
  'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  `${target}/ocr/lang/eng.traineddata.gz`,
);
await cp('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${target}/pdf/pdf.worker.min.mjs`);
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs'])
  await cp(`node_modules/pdfjs-dist/${dir}`, `${target}/pdf/${dir}`, { recursive: true });
await mkdir(`${target}/licenses`, { recursive: true });
for (const pkg of ['tesseract.js', 'tesseract.js-core', '@tesseract.js-data/eng', 'pdfjs-dist']) {
  const files = await readdir(`node_modules/${pkg}`);
  const license = files.find((f) => /^license/i.test(f));
  if (!license && pkg !== '@tesseract.js-data/eng') throw new Error(`Missing license for ${pkg}`);
  await cp(
    license ? `node_modules/${pkg}/${license}` : 'fixtures/licenses/tessdata.txt',
    `${target}/licenses/${pkg.replaceAll('/', '-')}.txt`,
  );
}
await cp('fixtures/documents', 'web/public/samples/documents', { recursive: true });
const manifest = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'manifest.json') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const bytes = await readFile(path);
      manifest.push({
        file: path.replaceAll('\\', '/').replace('web/public/', '/'),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await walk(target);
await writeFile(`${target}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Bundled ${manifest.length} runtime assets and licenses; no CDN fallback.`);
