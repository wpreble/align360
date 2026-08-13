import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_CHARS = 12000;

/**
 * Upload handler for non-image files. Both supported types are extracted to
 * plain text on the server and returned inline:
 *  - PDF  → pdf-parse
 *  - DOCX → mammoth
 *
 * PDFs previously went to the OpenAI Files API and came back as a `file_id`
 * that only OpenAI could resolve. That made documents impossible to serve from
 * an open-weights model and put every uploaded file on a frontier lab, which
 * contradicts what we tell enterprise buyers. Extracting text here instead means
 * documents work on ANY text model and no document leaves for OpenAI.
 *
 * Trade-off: a scanned PDF with no text layer yields nothing, so it is rejected
 * with a clear message rather than silently producing an empty document. OCR
 * would be a separate capability.
 *
 * Images and plain-text files are handled client-side and never hit this route.
 */
/** Shared success/empty handling for both extractors. */
function textResponse(name: string, extracted: string | undefined, emptyMessage?: string) {
  const raw = (extracted || '').trim();
  if (!raw) {
    return NextResponse.json(
      { error: emptyMessage || 'Could not extract any text from this document.' },
      { status: 422 },
    );
  }
  const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + '\n\n[document truncated]' : raw;
  return NextResponse.json({ kind: 'text', filename: name, text });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 25 MB).' }, { status: 400 });
  }

  const name = file.name || 'upload';
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  const head = buf.subarray(0, 5).toString('latin1');
  const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
  const isDocx = lower.endsWith('.docx');

  try {
    if (isDocx) {
      // DOCX is a zip — verify the PK signature so a renamed binary can't sneak through.
      if (!head.startsWith('PK')) {
        return NextResponse.json({ error: 'That does not look like a valid .docx file.' }, { status: 415 });
      }
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return textResponse(name, value);
    }

    if (isPdf) {
      // Verify the %PDF- magic before handing arbitrary bytes to the parser.
      if (!head.startsWith('%PDF-')) {
        return NextResponse.json({ error: 'That does not look like a valid PDF file.' }, { status: 415 });
      }
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const { text } = await parser.getText();
        return textResponse(name, text, 'This PDF has no readable text layer, so it is probably a scan. Paste the text, or upload a text-based version.');
      } finally {
        await parser.destroy?.();
      }
    }

    return NextResponse.json(
      { error: `Unsupported file type. Upload a PDF, DOCX, image, or text file.` },
      { status: 415 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('upload error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
