import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomUUID, createHash } from 'crypto';
import {
  generateDefenseQuestionAI,
  generateDefenseQuestionsBatchAI,
  evaluateDefenseAnswerAI,
  generateFinalEvaluationAI,
  documentCache
} from './server/aiProvider.js';
import { evaluateAnswer, generateFinalEvaluation, generateContextualQuestionBatch } from './src/lib/localEngine.js';

const app = express();

app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Training Session Usage Limit
type UsageRecord = {
  windowKey: number;
  used: number;
  lastUsedAt?: string;
};

type UsageStore = Record<string, UsageRecord>;

const usageStorePath = path.join(__dirname, '.ruanguji-usage.json');

const SESSION_LIMIT = Math.max(1, Number(process.env.TRAINING_SESSION_LIMIT || 5));
const WINDOW_HOURS = Math.max(1, Number(process.env.TRAINING_SESSION_WINDOW_HOURS || 6));
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

const ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK =
  process.env.ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK !== 'false';

const AI_EVALUATE_EACH_ANSWER =
  process.env.AI_EVALUATE_EACH_ANSWER === 'true';

const AI_FINAL_EVALUATION =
  process.env.AI_FINAL_EVALUATION !== 'false';

function getResearchWithFullDocument(research: any) {
  if (!research) return {};
  if (research.documentText) return research;

  if (research.docId) {
    const cachedText = documentCache.get(research.docId);
    if (cachedText) {
      return {
        ...research,
        documentText: cachedText,
      };
    }
  }

  return research;
}

function readUsageStore(): UsageStore {
  try {
    if (!fs.existsSync(usageStorePath)) return {};
    const raw = fs.readFileSync(usageStorePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[usage] gagal membaca usage store:', error);
    return {};
  }
}

function writeUsageStore(store: UsageStore) {
  try {
    fs.writeFileSync(usageStorePath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[usage] gagal menyimpan usage store:', error);
  }
}

function getClientIp(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : '';

  return (
    forwardedIp ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  ).trim();
}

function getUsageIdentity(req: express.Request) {
  // Tidak pakai browser/localStorage/user-agent.
  // Basis limit utama adalah IP agar tidak mudah di-bypass dengan pindah browser.
  const ip = getClientIp(req);

  return createHash('sha256')
    .update(ip)
    .digest('hex')
    .slice(0, 32);
}

function getWindowKey(now = Date.now()) {
  return Math.floor(now / WINDOW_MS);
}

function getResetAt(windowKey = getWindowKey()) {
  return new Date((windowKey + 1) * WINDOW_MS).toISOString();
}

function cleanupOldUsage(store: UsageStore, activeWindowKey: number) {
  for (const key of Object.keys(store)) {
    if (store[key].windowKey < activeWindowKey - 1) {
      delete store[key];
    }
  }
}

function getUsageStatus(req: express.Request) {
  const store = readUsageStore();
  const identity = getUsageIdentity(req);
  const currentWindow = getWindowKey();

  cleanupOldUsage(store, currentWindow);

  let record = store[identity];

  if (!record || record.windowKey !== currentWindow) {
    record = {
      windowKey: currentWindow,
      used: 0,
    };
    store[identity] = record;
    writeUsageStore(store);
  }

  const used = Math.max(0, Number(record.used || 0));
  const remaining = Math.max(0, SESSION_LIMIT - used);

  return {
    store,
    identity,
    record,
    status: {
      ok: true,
      limit: SESSION_LIMIT,
      used,
      remaining,
      resetAt: getResetAt(currentWindow),
      windowHours: WINDOW_HOURS,
      blocked: remaining <= 0,
    },
  };
}

function consumeUsage(req: express.Request) {
  const { store, identity, record, status } = getUsageStatus(req);

  if (status.remaining <= 0) {
    return {
      allowed: false,
      status,
    };
  }

  record.used = Math.max(0, Number(record.used || 0)) + 1;
  record.lastUsedAt = new Date().toISOString();
  store[identity] = record;

  writeUsageStore(store);

  const used = record.used;
  const remaining = Math.max(0, SESSION_LIMIT - used);

  return {
    allowed: true,
    status: {
      ...status,
      used,
      remaining,
      blocked: remaining <= 0,
    },
  };
}

/** Normalize line endings, collapse whitespace, strip noise */
function cleanExtractedText(raw: string): string {
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const noisePatterns = [
    /^.{0,80}(diserahkan|diterima|direvisi|diterbitkan|submitted|received|revised|accepted|published).{0,80}$/gim,
    /^.{0,60}(informasi artikel|article info(rmation)?|article history).{0,60}$/gim,
    /^.{0,120}(open access|©|copyright|hak cipta|all rights reserved|creative commons|cc by).{0,120}$/gim,
    /^.{0,60}(vol\.?|volume|no\.?|issue|hal\.?|pp?\.?|hlm\.?)\s*[\d\-–,.]+.{0,60}$/gim,
    /^.{0,20}doi\s*[:：].{0,120}$/gim,
    /^.{0,20}(issn|e-issn|p-issn).{0,60}$/gim,
    /^\s*\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*$/gim,
    /^\s*\d{4}\s*$/gm,
    /^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$/gm,
    /^\s*[\w.+-]+@[\w.-]+\.[a-z]{2,}\s*$/gim,
    /^\s*[-=_*~]{3,}\s*$/gm,
  ];

  for (const p of noisePatterns) text = text.replace(p, '');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract a section between heading patterns and stop patterns */
function extractSection(text: string, headingPatterns: RegExp[], stopPatterns: RegExp[]): string {
  let startIdx = -1;
  for (const pat of headingPatterns) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m) { startIdx = m.index + m[0].length; break; }
  }
  if (startIdx === -1) return '';

  let endIdx = text.length;
  for (const pat of stopPatterns) {
    pat.lastIndex = 0;
    const sub = text.substring(startIdx + 5);
    const m = pat.exec(sub);
    if (m) {
      const candidate = startIdx + 5 + m.index;
      if (candidate < endIdx && candidate > startIdx) endIdx = candidate;
    }
  }
  return text.substring(startIdx, endIdx).trim();
}

/**
 * Build full document context for AI (up to 15000 chars).
 * Extracts key sections: abstract, intro, methods, results, conclusion.
 * Falls back to beginning+middle+end sampling for unstructured docs.
 */
function buildDocumentContext(cleanText: string, maxChars = 15000): string {
  const sectionDefs: { key: string; heads: RegExp[] }[] = [
    { key: 'ABSTRAK', heads: [/\b(ABSTRAK|ABSTRACT|RINGKASAN)\b/i] },
    { key: 'PENDAHULUAN', heads: [/\b(PENDAHULUAN|INTRODUCTION|LATAR\s*BELAKANG|BAB\s*[I1])\b/i, /\b1\.\s*(PENDAHULUAN|INTRODUCTION)\b/i] },
    { key: 'METODE', heads: [/\b(METODE|METODOLOGI|METHODOLOGY|METHODS?|BAB\s*III|BAB\s*3)\b/i, /\b[23]\.\s*(METODE|METODOLOGI)\b/i] },
    { key: 'HASIL', heads: [/\b(HASIL|RESULTS?|PEMBAHASAN|DISCUSSION|FINDINGS|BAB\s*IV|BAB\s*4)\b/i, /\b[34]\.\s*(HASIL|PEMBAHASAN)\b/i] },
    { key: 'KESIMPULAN', heads: [/\b(KESIMPULAN|CONCLUSION|SIMPULAN|PENUTUP|BAB\s*V|BAB\s*5)\b/i, /\b[45]\.\s*(KESIMPULAN|PENUTUP)\b/i] },
  ];

  const allHeadings = /\b(ABSTRAK|ABSTRACT|PENDAHULUAN|INTRODUCTION|LATAR\s*BELAKANG|TINJAUAN\s*PUSTAKA|METODE|METODOLOGI|METHODOLOGY|METHODS?|HASIL|RESULTS?|PEMBAHASAN|DISCUSSION|KESIMPULAN|CONCLUSION|PENUTUP|DAFTAR\s*PUSTAKA|REFERENSI|REFERENCES|LAMPIRAN|KATA\s*KUNCI|KEYWORDS?|BAB\s*[IV]+|BAB\s*[1-5])\b/gi;

  const sections: { label: string; content: string }[] = [];
  for (const def of sectionDefs) {
    const content = extractSection(cleanText, def.heads, [allHeadings]);
    if (content.length > 50) {
      sections.push({ label: def.key, content });
    }
  }

  if (sections.length >= 2) {
    let result = '';
    const budget = Math.floor(maxChars / sections.length);
    for (const sec of sections) {
      const trimmed = sec.content.length > budget ? sec.content.substring(0, budget).trim() : sec.content;
      result += `[${sec.label}]\n${trimmed}\n\n`;
    }
    return result.substring(0, maxChars).trim();
  }

  // Fallback: sample beginning + middle + end
  if (cleanText.length <= maxChars) return cleanText;
  const chunk = Math.floor(maxChars / 3);
  const beginning = cleanText.substring(0, chunk);
  const midStart = Math.floor(cleanText.length / 2 - chunk / 2);
  const middle = cleanText.substring(midStart, midStart + chunk);
  const ending = cleanText.substring(cleanText.length - chunk);
  return `[AWAL DOKUMEN]\n${beginning}\n\n[BAGIAN TENGAH]\n${middle}\n\n[BAGIAN AKHIR]\n${ending}`.substring(0, maxChars).trim();
}

/**
 * Build short preview for user (up to 2000 chars).
 * Prefers abstract section if found.
 */
function buildDocumentPreview(cleanText: string, maxChars = 2000): string {
  const abstractContent = extractSection(
    cleanText,
    [/\b(ABSTRAK|ABSTRACT|RINGKASAN)\b/i],
    [/\b(KATA\s*KUNCI|KEYWORDS?|PENDAHULUAN|INTRODUCTION|BAB\s*[I1])\b/i]
  );
  const source = abstractContent.length > 80 ? abstractContent : cleanText;
  if (source.length <= maxChars) return source;
  let result = source.substring(0, maxChars);
  const lastPeriod = result.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.7) result = result.substring(0, lastPeriod + 1);
  return result.trim();
}

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.get('/api/usage/status', (req, res) => {
  if (process.env.DEV_BYPASS_USAGE_LIMIT === 'true') {
    return res.json({
      ok: true,
      limit: 999,
      used: 0,
      remaining: 999,
      resetAt: new Date(Date.now() + WINDOW_MS).toISOString(),
      windowHours: WINDOW_HOURS,
      blocked: false,
      message: 'Developer bypass aktif.',
    });
  }

  const { status } = getUsageStatus(req);
  return res.json(status);
});

app.post('/api/usage/start-session', (req, res) => {
  if (process.env.DEV_BYPASS_USAGE_LIMIT === 'true') {
    return res.json({
      ok: true,
      limit: 999,
      used: 0,
      remaining: 999,
      resetAt: new Date(Date.now() + WINDOW_MS).toISOString(),
      windowHours: WINDOW_HOURS,
      blocked: false,
      message: 'Developer bypass aktif. Limit latihan tidak dihitung.',
    });
  }

  const result = consumeUsage(req);

  if (!result.allowed) {
    return res.status(429).json({
      ...result.status,
      ok: false,
      error: `Batas latihan sudah habis. Maksimal ${SESSION_LIMIT} sesi setiap ${WINDOW_HOURS} jam.`,
    });
  }

  return res.json({
    ...result.status,
    ok: true,
    message: 'Sesi latihan berhasil dimulai.',
  });
});

// POST /api/extract-document
app.post('/api/extract-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'File tidak ditemukan. Harap unggah berkas PDF atau DOCX.' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const ext = originalname.split('.').pop()?.toLowerCase();
    const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimes.includes(mimetype) && !['pdf', 'docx'].includes(ext || '')) {
      return res.status(400).json({ ok: false, error: 'Format berkas tidak didukung. Hanya PDF dan DOCX yang diizinkan.' });
    }

    let rawText = '';

    if (mimetype === 'application/pdf' || ext === 'pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule;
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text || '';
      } catch (pdfErr: any) {
        console.warn('[extract-document] pdf-parse failed:', pdfErr.message);
        return res.json({ ok: false, error: 'Gagal membaca berkas PDF. Pastikan PDF tidak terenkripsi atau berbasis gambar (scan).' });
      }
    } else {
      try {
        const mammothModule = await import('mammoth');
        const mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> } = (mammothModule as any).default ?? mammothModule;
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

    const cleaned = cleanExtractedText(rawText);

    // Ini teks penuh dari awal sampai akhir dokumen.
    // Jangan pakai buildDocumentContext untuk AI, karena itu hanya sampling/section tertentu.
    const text = cleaned;

    // Preview hanya untuk tampilan user, bukan sumber utama AI.
    const preview = buildDocumentPreview(cleaned, 2000);

    const docId = randomUUID();

    // Simpan teks penuh ke cache server.
    // DefenseRoom cukup mengirim docId, lalu aiProvider ambil dokumen penuh dari documentCache.
    documentCache.set(docId, text);

    if (documentCache.size > 100) {
      const firstKey = documentCache.keys().next().value;
      if (firstKey !== undefined) {
        documentCache.delete(firstKey);
      }
    }

    return res.json({
      ok: true,
      docId,
      text,
      preview,
      fileName: originalname,
      size,
      extractedChars: text.length,
    });
  } catch (err: any) {
    console.error('[extract-document] Unexpected error:', err.message);
    return res.status(500).json({ ok: false, error: 'Terjadi kesalahan saat memproses dokumen. Coba lagi.' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    voiceDefault: process.env.VOICE_DEFAULT || 'calm-female',
    aiEvaluateEachAnswer: AI_EVALUATE_EACH_ANSWER,
    aiFinalEvaluation: AI_FINAL_EVALUATION,
    contextualTemplateFallback: ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK,
    trainingSessionLimit: SESSION_LIMIT,
    trainingSessionWindowHours: WINDOW_HOURS,
    devBypassUsageLimit: process.env.DEV_BYPASS_USAGE_LIMIT === 'true',
  });
});

app.post('/api/ai/questions-batch', async (req, res) => {
  const research = getResearchWithFullDocument(req.body?.research);

  try {
    const data = await generateDefenseQuestionsBatchAI({
      ...req.body,
      research,
    });

    return res.json({
      ...data,
      provider: 'gemini',
      quotaMode: false,
    });
  } catch (error: any) {
    console.error('AI Questions Batch Error:', error?.message || error);

    if (ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK) {
      const fallback = generateContextualQuestionBatch({
        research,
        examinerMode: req.body?.examinerMode || research.examinerMode || 'kritis',
        questionIndex: Number(req.body?.questionIndex || 0),
        batchSize: Math.max(1, Number(req.body?.batchSize || 5)),
        previousQuestions: Array.isArray(req.body?.previousQuestions) ? req.body.previousQuestions : [],
        fallbackReason:
          error?.message ||
          'Semua model Gemini gagal digunakan atau kuota AI sedang penuh.',
      });

      return res.json(fallback);
    }

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        'Gagal membuat batch pertanyaan dari AI. Periksa GEMINI_API_KEY, GEMINI_MODEL, quota, atau koneksi server.',
      provider: 'gemini-error',
    });
  }
});

// AI Endpoints
app.post('/api/ai/question', async (req, res) => {
  try {
    const data = await generateDefenseQuestionAI(req.body);
    return res.json({
      ...data,
      provider: 'gemini',
    });
  } catch (error: any) {
    console.error('AI Question Error:', error?.message || error);

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        'Gagal membuat pertanyaan dari AI. Periksa GEMINI_API_KEY, GEMINI_MODEL, quota, atau koneksi server.',
      provider: 'gemini-error',
    });
  }
});

app.post('/api/ai/evaluate', async (req, res) => {
  const research = getResearchWithFullDocument(req.body?.research);

  if (!AI_EVALUATE_EACH_ANSWER) {
    const localEval = evaluateAnswer(
      req.body.question,
      req.body.answer,
      research,
      req.body.examinerMode
    );

    return res.json({
      ...localEval,
      provider: 'local-fast-evaluation',
      quotaMode: false,
      apiSavingMode: true,
      reason: 'Evaluasi cepat aktif untuk menghemat pemakaian Gemini.',
    });
  }

  try {
    const aiEval = await evaluateDefenseAnswerAI({
      question: req.body.question,
      answer: req.body.answer,
      research,
      examinerMode: req.body.examinerMode,
    });

    return res.json({
      ...aiEval,
      provider: aiEval.provider || 'gemini',
      quotaMode: false,
      apiSavingMode: false,
      reason: '',
    });
  } catch (error) {
    console.error('[evaluate] Gemini evaluation failed, using local fallback:', error);

    const localEval = evaluateAnswer(
      req.body.question,
      req.body.answer,
      research,
      req.body.examinerMode
    );

    return res.json({
      ...localEval,
      provider: 'local-fallback-evaluation',
      quotaMode: true,
      apiSavingMode: true,
      reason: 'Gemini sedang terbatas, evaluasi sementara dibuat dengan mode hemat API.',
    });
  }
});

app.post('/api/ai/final-evaluation', async (req, res) => {
  const research = getResearchWithFullDocument(req.body?.research);

  if (!AI_FINAL_EVALUATION) {
    const localFinal = generateFinalEvaluation({
      research,
      transcript: req.body.transcript,
    } as any);

    return res.json({
      ...localFinal,
      provider: 'local-final-evaluation',
      quotaMode: true,
      reason: 'Evaluasi akhir Gemini dimatikan melalui konfigurasi server.',
    });
  }

  try {
    const data = await generateFinalEvaluationAI({
      ...req.body,
      research,
    });

    res.json(data);
  } catch (error: any) {
    console.error('AI Final Eval Error:', error.message);

    const localFinal = generateFinalEvaluation({
      research,
      transcript: req.body.transcript,
    } as any);

    res.json({
      ...localFinal,
      provider: 'local-fallback',
      quotaMode: true,
      reason: `AI Provider Error: ${error.message}`,
    });
  }
});

// Serve Vite production build
const distPath = path.resolve(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

console.log('[Static] distPath:', distPath);
console.log('[Static] index exists:', fs.existsSync(indexPath));

app.use(express.static(distPath));

const sendIndex = (req: express.Request, res: express.Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      ok: false,
      error: 'API route not found',
    });
  }

  if (!fs.existsSync(indexPath)) {
    return res
      .status(500)
      .send('Production build tidak ditemukan. Jalankan npm run build terlebih dahulu.');
  }

  return res.sendFile(indexPath);
};

// Root route wajib, supaya http://localhost:3000 tidak jatuh ke 404
app.get('/', sendIndex);

// Fallback untuk React Router: /setup, /history, /defense, dll.
// Ini format wildcard yang aman untuk Express versi baru.
app.get('/*splat', sendIndex);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});