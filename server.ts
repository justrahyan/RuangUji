import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { generateDefenseQuestionAI, evaluateDefenseAnswerAI, generateFinalEvaluationAI } from './server/aiProvider.js';
import { generateQuestion, evaluateAnswer, generateFinalEvaluation } from './src/lib/localEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

// Document Extraction Helpers

/** Normalize line endings and collapse excessive whitespace */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove common document noise: metadata lines, journal headers,
 * dates, copyright notices, page numbers, etc.
 */
function removeDocumentNoise(text: string): string {
  const noisePatterns = [
    // Journal / article metadata
    /^.{0,80}(diserahkan|diterima|direvisi|diterbitkan|submitted|received|revised|accepted|published).{0,80}$/gim,
    /^.{0,60}(informasi artikel|article info(rmation)?|article history).{0,60}$/gim,
    /^.{0,60}(kata kunci|keywords?).{0,120}$/gim,
    // Open-access / copyright
    /^.{0,120}(open access|©|copyright|hak cipta|all rights reserved|creative commons|cc by).{0,120}$/gim,
    // Volume/issue/page references like "Vol. 10 No. 2 (2023)" or "p. 123–134"
    /^.{0,60}(vol\.?|volume|no\.?|issue|hal\.?|pp?\.?|hlm\.?)\s*[\d\-–,.]+.{0,60}$/gim,
    // DOI lines
    /^.{0,20}doi\s*[:：].{0,120}$/gim,
    // ISSN / e-ISSN
    /^.{0,20}(issn|e-issn|p-issn).{0,60}$/gim,
    // Standalone date lines like "15 Januari 2024" or "January 15, 2024"
    /^\s*\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*$/gim,
    // Standalone year-only lines
    /^\s*\d{4}\s*$/gm,
    // Pure page-number lines
    /^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$/gm,
    // Email lines
    /^\s*[\w.+-]+@[\w.-]+\.[a-z]{2,}\s*$/gim,
    // Lines that only contain symbols / repeated dashes
    /^\s*[-=_*~]{3,}\s*$/gm,
  ];

  let cleaned = text;
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Collapse again after removals
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Try to extract only the ABSTRAK/ABSTRACT section.
 * Returns the extracted block, or '' if not found.
 */
function extractAbstractSection(text: string): string {
  // Headings that signal start of abstract (case-insensitive)
  const abstractStartPattern = /\b(ABSTRAK|ABSTRACT|RINGKASAN|SUMMARY)\b/i;
  // Headings that signal end of abstract
  const abstractEndPatterns = [
    /\b(KATA\s*KUNCI|KEYWORDS?)\b/i,
    /\b(PENDAHULUAN|INTRODUCTION|BAB\s*[I1]|CHAPTER\s*[I1]|1\.\s*PENDAHULUAN|1\.\s*INTRODUCTION)\b/i,
    /\b(LATAR\s*BELAKANG)\b/i,
  ];

  const startMatch = abstractStartPattern.exec(text);
  if (!startMatch) return '';

  const startIdx = startMatch.index + startMatch[0].length;

  // Find the earliest stop marker after startIdx
  let endIdx = text.length;
  for (const pat of abstractEndPatterns) {
    pat.lastIndex = 0;
    const subText = text.substring(startIdx + 5); // skip a few chars past heading
    const m = pat.exec(subText);
    if (m) {
      const candidate = startIdx + 5 + m.index;
      if (candidate < endIdx) endIdx = candidate;
    }
  }

  const block = text.substring(startIdx, endIdx).trim();

  // Remove the noise (metadata) that often sits between heading and actual prose
  const cleaned = removeDocumentNoise(block);
  return cleaned;
}

/**
 * Build a longer document preview (for AI context).
 * Caps at 8000 characters, preferring complete sentences.
 */
function buildDocumentPreview(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  let preview = text.substring(0, maxChars);
  const lastPeriod = preview.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.8) {
    preview = preview.substring(0, lastPeriod + 1);
  }
  return preview.trim();
}

/**
 * Build a short abstract text (for textarea auto-fill).
 * Caps at 3000 characters.
 */
function buildAbstractText(abstractBlock: string, fallbackText: string, maxChars = 3000): string {
  const source = abstractBlock.trim().length > 80 ? abstractBlock : fallbackText;
  if (source.length <= maxChars) return source;
  let result = source.substring(0, maxChars);
  const lastPeriod = result.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.75) {
    result = result.substring(0, lastPeriod + 1);
  }
  return result.trim();
}

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

// POST /api/extract-document
app.post('/api/extract-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'File tidak ditemukan. Harap unggah berkas PDF atau DOCX.' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const ext = originalname.split('.').pop()?.toLowerCase();

    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExts = ['pdf', 'docx'];

    if (!allowedMimes.includes(mimetype) && !allowedExts.includes(ext || '')) {
      return res.status(400).json({ ok: false, error: 'Format berkas tidak didukung. Hanya PDF dan DOCX yang diizinkan.' });
    }

    let rawText = '';

    if (mimetype === 'application/pdf' || ext === 'pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        // pdf-parse v2+ ships ESM: the callable is the module itself (no .default).
        // Fall back to .default for CJS interop environments.
        const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
          (pdfParseModule as any).default ?? pdfParseModule;
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text || '';
      } catch (pdfErr: any) {
        console.warn('[extract-document] pdf-parse failed:', pdfErr.message);
        return res.json({ ok: false, error: 'Gagal membaca berkas PDF. Pastikan PDF tidak terenkripsi atau berbasis gambar (scan).' });
      }
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      try {
        const mammothModule = await import('mammoth');
        const mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> } =
          (mammothModule as any).default ?? mammothModule;
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value || '';
      } catch (docxErr: any) {
        console.warn('[extract-document] mammoth failed:', docxErr.message);
        return res.json({ ok: false, error: 'Gagal membaca berkas DOCX. Pastikan format berkas tidak rusak.' });
      }
    }

    if (!rawText || rawText.trim().length < 30) {
      return res.json({ ok: false, error: 'Tidak dapat membaca isi dokumen. Dokumen mungkin berupa gambar atau terlindungi sandi.' });
    }

    // 1. Normalize whitespace
    const normalized = normalizeWhitespace(rawText);

    // 2. Try to extract the abstract section
    const abstractBlock = extractAbstractSection(normalized);

    // 3. Build "preview" — long context for AI (up to 8000 chars), cleaned of noise
    const fullCleaned = removeDocumentNoise(normalized);
    const preview = buildDocumentPreview(fullCleaned, 8000);

    // 4. Build "text" — short, for the textarea (abstract or cleaned intro, up to 3000 chars)
    const text = buildAbstractText(abstractBlock, fullCleaned, 3000);

    return res.json({
      ok: true,
      text,
      preview,
      fileName: originalname,
      size
    });

  } catch (err: any) {
    console.error('[extract-document] Unexpected error:', err.message);
    return res.status(500).json({ ok: false, error: 'Terjadi kesalahan saat memproses dokumen. Coba lagi.' });
  }
});

// AI Endpoints
app.post('/api/ai/question', async (req, res) => {
  try {
    const data = await generateDefenseQuestionAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Question Error:', error.message);
    const localQuestion = generateQuestion(
      req.body.research,
      req.body.examinerMode,
      req.body.questionIndex,
      req.body.previousQuestions
    );
    res.json({
      question: localQuestion,
      category: "fallback",
      reason: `AI Provider Error: ${error.message}`,
      provider: "local-fallback"
    });
  }
});

app.post('/api/ai/evaluate', async (req, res) => {
  try {
    const data = await evaluateDefenseAnswerAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Evaluate Error:', error.message);
    const localEval = evaluateAnswer(
      req.body.question,
      req.body.answer,
      req.body.research,
      req.body.examinerMode
    );
    res.json({
      ...localEval,
      provider: "local-fallback",
      reason: `AI Provider Error: ${error.message}`
    });
  }
});

app.post('/api/ai/final-evaluation', async (req, res) => {
  try {
    const data = await generateFinalEvaluationAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Final Eval Error:', error.message);
    const localFinal = generateFinalEvaluation({
      research: req.body.research,
      transcript: req.body.transcript
    } as any);
    res.json({
      ...localFinal,
      provider: "local-fallback",
      reason: `AI Provider Error: ${error.message}`
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
