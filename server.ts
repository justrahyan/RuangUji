import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { generateDefenseQuestionAI, evaluateDefenseAnswerAI, generateFinalEvaluationAI } from './server/aiProvider.js';
import { generateQuestion, evaluateAnswer, generateFinalEvaluation } from './src/lib/localEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Document Extraction ─────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

function sanitizeExtractedText(raw: string): string {
  // Normalize whitespace
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Try to extract the Abstract section if present
  const abstractPatterns = [/abstrak/i, /abstract/i];
  const stopPatterns = [/kata\s*kunci/i, /keywords/i, /pendahuluan/i, /bab\s*1/i, /bab\s*i\b/i, /chapter\s*1/i, /introduction/i];

  let abstractStart = -1;
  for (const pat of abstractPatterns) {
    const m = pat.exec(text);
    if (m && m.index !== undefined) {
      abstractStart = m.index;
      break;
    }
  }

  if (abstractStart !== -1) {
    let abstractEnd = text.length;
    for (const pat of stopPatterns) {
      const subText = text.substring(abstractStart + 10); // skip past the "abstrak" heading itself
      const m = pat.exec(subText);
      if (m && m.index !== undefined) {
        const candidate = abstractStart + 10 + m.index;
        if (candidate < abstractEnd) abstractEnd = candidate;
      }
    }
    // Extract from heading line to stop point
    const extracted = text.substring(abstractStart, abstractEnd).trim();
    if (extracted.length > 100) {
      text = extracted;
    }
  }

  // Cap at 8000 characters
  if (text.length > 8000) {
    text = text.substring(0, 8000).trim();
    // Avoid cutting in the middle of a sentence
    const lastPeriod = text.lastIndexOf('.');
    if (lastPeriod > 6000) {
      text = text.substring(0, lastPeriod + 1);
    }
  }

  return text;
}

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
        // Dynamic import to avoid ESM/CJS issues at startup
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text || '';
      } catch (pdfErr: any) {
        console.warn('[extract-document] pdf-parse failed:', pdfErr.message);
        return res.json({ ok: false, error: 'Gagal membaca berkas PDF. Pastikan PDF tidak terenkripsi atau berbasis gambar.' });
      }
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      try {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value || '';
      } catch (docxErr: any) {
        console.warn('[extract-document] mammoth failed:', docxErr.message);
        return res.json({ ok: false, error: 'Gagal membaca berkas DOCX. Pastikan format berkas tidak rusak.' });
      }
    }

    if (!rawText || rawText.trim().length < 20) {
      return res.json({ ok: false, error: 'Tidak dapat membaca isi dokumen. Dokumen mungkin berupa gambar atau terlindungi sandi.' });
    }

    const text = sanitizeExtractedText(rawText);
    const preview = text.substring(0, 500);

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

// ── AI Endpoints ────────────────────────────────────────────────────────────
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
