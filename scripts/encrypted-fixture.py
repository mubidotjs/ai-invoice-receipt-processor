"""Optional fixture authoring only; pypdf is not an application/CI dependency."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent.parent
writer = PdfWriter()
writer.append(PdfReader(root / 'fixtures/documents/harbor.pdf'))
writer.encrypt('synthetic-test-password')
target = root / 'tests/fixtures/encrypted.pdf'
target.parent.mkdir(parents=True, exist_ok=True)
with target.open('wb') as output:
    writer.write(output)
