import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Upload handler for non-image files.
 *  - PDF  → OpenAI Files API (purpose: user_data) → returns a file_id the chat
 *           route references as a {type:'file'} content part (gpt-5.5 reads PDFs natively).
 *  - DOCX → extracted to plain text server-side (mammoth) → returned inline.
 * Images and plain-text files are handled client-side (vision / inline) and never hit this route.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 500 });
  }

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
      const raw = (value || '').trim();
      if (!raw) return NextResponse.json({ error: 'Could not extract any text from this document.' }, { status: 422 });
      const text = raw.length > 12000 ? raw.slice(0, 12000) + '\n\n[document truncated]' : raw;
      return NextResponse.json({ kind: 'text', filename: name, text });
    }

    if (isPdf) {
      // Verify the %PDF- magic before tagging it application/pdf for the model.
      if (!head.startsWith('%PDF-')) {
        return NextResponse.json({ error: 'That does not look like a valid PDF file.' }, { status: 415 });
      }
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const uploaded = await client.files.create({
        file: await toFile(buf, name, { type: 'application/pdf' }),
        purpose: 'user_data',
      });
      return NextResponse.json({ kind: 'file', filename: name, fileId: uploaded.id });
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
