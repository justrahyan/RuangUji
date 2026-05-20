import { generateQuestion, evaluateAnswer, generateFinalEvaluation } from '../src/lib/localEngine.js';

function safeJsonParse(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(`Invalid JSON format: JSON object boundaries not found. Content: "${cleaned.substring(0, 100)}..."`);
  }
  
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    throw new Error(`Failed to parse JSON: ${error.message}. Cleaned content: "${cleaned.substring(0, 200)}..."`);
  }
}

function isProviderUnavailableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const keywords = [
    '429',
    '500',
    '502',
    '503',
    '504',
    'quota',
    'high demand',
    'unavailable',
    'resource_exhausted',
    'rate limit',
    'invalid json',
    'empty text',
    'aborted',
    'timeout'
  ];
  return keywords.some(kw => msg.includes(kw));
}

// Helper to wrap fetch with a 20-second timeout
async function fetchWithTimeout(url: string, options: any, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export async function generateDefenseQuestionAI(payload: any) {
  const provider = process.env.AI_PROVIDER || 'gemini';
  console.log(`[AI] question request started (provider=${provider})`);
  
  if (provider === 'local' || provider !== 'gemini') {
    if (provider !== 'local') {
      console.warn(`[AI Provider] Provider "${provider}" is not recognized. Falling back to local.`);
    }
    const localQuestion = generateQuestion(
      payload.research,
      payload.examinerMode,
      payload.questionIndex,
      payload.previousQuestions
    );
    console.log(`[AI] question success provider=local-fallback`);
    return {
      question: localQuestion,
      category: "fallback",
      reason: "Menggunakan mesin tanya-jawab lokal.",
      provider: "local-fallback"
    };
  }

  try {
    const researchApproach = payload.research.researchApproach || '';
    const keywords = payload.research.keywords || '';
    const documentPreview = payload.research.documentPreview || '';

    // Determine question-type guidance based on researchApproach
    let approachGuidance = '';
    const approachLower = researchApproach.toLowerCase();
    if (approachLower.includes('kualitatif')) {
      approachGuidance = `PENDEKATAN KUALITATIF: Fokuskan pertanyaan pada validitas data, pemilihan informan/narasumber, teknik triangulasi, proses analisis tematik, kredibilitas temuan, dan kontribusi penelitian terhadap pemahaman fenomena. JANGAN menanyakan metrik statistik, akurasi, atau dataset ML.`;
    } else if (approachLower.includes('kuantitatif')) {
      approachGuidance = `PENDEKATAN KUANTITATIF: Pertanyaan dapat mencakup variabel penelitian, instrumen pengumpulan data, validitas dan reliabilitas, teknik sampling, uji statistik, atau interpretasi hasil. Jika tidak ada ML atau model komputasi, JANGAN menanyakan akurasi model, overfitting, atau confusion matrix.`;
    } else if (approachLower.includes('r&d') || approachLower.includes('pengembangan')) {
      approachGuidance = `PENDEKATAN R&D/PENGEMBANGAN: Fokuskan pertanyaan pada analisis kebutuhan pengguna, desain produk/sistem, proses validasi ahli, uji coba lapangan, revisi produk, evaluasi kelayakan, dan kebermanfaatan produk bagi pengguna sasaran.`;
    } else if (approachLower.includes('eksperimen')) {
      approachGuidance = `PENDEKATAN EKSPERIMEN: Pertanyaan dapat mencakup desain eksperimen, kelompok kontrol/perlakuan, prosedur perlakuan, validitas internal, pengendalian variabel, dan interpretasi hasil uji hipotesis.`;
    } else if (approachLower.includes('mixed') || approachLower.includes('campuran')) {
      approachGuidance = `PENDEKATAN MIXED METHODS: Pertanyaan dapat mencakup integrasi data kuantitatif dan kualitatif, alasan pemilihan mixed methods, bagaimana kedua jenis data saling melengkapi, dan keandalan triangulasi.`;
    } else if (approachLower.includes('literatur') || approachLower.includes('studi literatur')) {
      approachGuidance = `PENDEKATAN STUDI LITERATUR: Pertanyaan dapat mencakup strategi pencarian literatur, kriteria inklusi/eksklusi sumber, sintesis temuan, celah penelitian yang ditemukan, dan kontribusi kajian literatur ini terhadap bidang ilmu.`;
    }

    const prompt = `Anda berperan sebagai dosen penguji profesional, cerdas, dan kritis dalam sidang akademik di Indonesia.
Tugas Anda adalah membuat 1 (satu) pertanyaan sidang yang spesifik, mendalam, dan relevan dengan penelitian mahasiswa berikut:

Profil Lengkap Penelitian Mahasiswa:
- Jenis Sidang: ${payload.research.sessionType || 'Sidang Akhir'}
- Judul Penelitian: ${payload.research.title}
- Bidang / Topik: ${payload.research.field || 'Umum'}
- Kata Kunci / Fokus Kajian: ${keywords || 'Tidak disediakan'}
- Pendekatan Penelitian: ${researchApproach || 'Tidak disebutkan'}
- Metode / Teknik Utama: ${payload.research.method}
- Abstrak / Ringkasan: ${payload.research.abstract || 'Tidak disediakan'}
- Kekhawatiran / Fokus Latihan Mahasiswa: ${payload.research.concern || 'Tidak ada'}
${documentPreview ? `- Cuplikan Dokumen Penelitian: ${documentPreview.substring(0, 1000)}` : ''}
- Pertanyaan Sebelumnya (JANGAN DIULANG): ${payload.previousQuestions?.join(' | ') || 'Belum ada'}

Panduan Pendekatan Penelitian:
${approachGuidance || 'Sesuaikan pertanyaan dengan bidang dan metode penelitian yang disebutkan di atas.'}

Karakter & Mode Penguji:
Mode saat ini adalah: "${payload.examinerMode}"
Panduan gaya bertanya berdasarkan Mode Penguji:
- "santai": Tanyakan dengan nada mendukung, ramah, bersahabat, namun tetap akademis. Pertanyaan lebih mudah dipahami dan dijawab.
- "kritis": Pertanyaan tajam, mendalam, objektif, menanyakan landasan logis di balik keputusan desain/penelitian.
- "killer": Tekankan celah penelitian, tanyakan hal-hal menekan secara konfrontatif untuk menguji ketahanan mental dan keyakinan argumen mahasiswa.
- "metodologi": Fokus sepenuhnya pada keselarasan masalah, tujuan, instrumen, validitas proses, dan kesahihan langkah-langkah penelitian.
- "statistik": Tanyakan signifikansi data, uji statistik, validasi angka, atau metrik evaluasi. Jika riset bukan penelitian kuantitatif/statistik, arahkan pertanyaan ke validasi data/bukti/hasil, bukan metrik machine learning.
- "novelty": Fokus pada kebaruan penelitian, kontribusi ilmiah, pembeda nyata dibanding penelitian terdahulu, dan orisinalitas ide.
- "implementasi": Fokus pada penerapan praktis di lapangan, kegunaan hasil penelitian, dampak nyata bagi pengguna atau pemangku kepentingan, dan potensi hambatan operasional saat diterapkan.

Aturan Penting Pertanyaan:
1. LINTAS JURUSAN — JANGAN berasumsi penelitian ini dari Teknik Informatika/Komputer jika tidak disebutkan. Sesuaikan sepenuhnya dengan bidang yang tertulis.
2. SPESIFIK & RELEVAN: Pertanyaan harus dikaitkan langsung dengan judul, metode, bidang, atau abstrak. Jangan memberikan pertanyaan template umum.
3. BAHASA: Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia.
4. JANGAN REPETISI: Jangan membuat pertanyaan yang semakna atau mengulang topik pertanyaan sebelumnya.
5. JANGAN MENANYAKAN METRIK ML (akurasi, F1, dataset, overfitting, confusion matrix, dll.) jika penelitian tidak menyebut machine learning, deep learning, atau pemodelan komputasi.
6. KHUSUS SISTEM PAKAR: Fokus pada knowledge base, validasi pakar, alur inferensi, Certainty Factor, dan batasan sistem — bukan metrik ML.
7. FORMAT: Pertanyaan singkat dan padat (maksimal 1–2 kalimat).

Return ONLY JSON format (tanpa markdown, pastikan JSON valid):
{
  "question": "Kalimat pertanyaan penguji...",
  "category": "Kategori pertanyaan (misal: metode, novelty, batasan, implementasi, latar_belakang)",
  "reason": "Alasan singkat mengapa Anda mengajukan pertanyaan ini"
}`;

    const result = await callAIProvider(provider, prompt, 'question');
    if (!result || typeof result.question !== 'string' || !result.question.trim()) {
      throw new Error('Invalid AI response structure: question is missing or empty.');
    }
    console.log(`[AI] question success provider=${provider}`);
    return result;
  } catch (error: any) {
    console.warn(`[AI] question failed, using fallback:`, error.message);
    const localQuestion = generateQuestion(
      payload.research,
      payload.examinerMode,
      payload.questionIndex,
      payload.previousQuestions
    );
    return {
      question: localQuestion,
      category: "fallback",
      reason: "Provider AI sedang tidak tersedia, menggunakan fallback lokal.",
      provider: "local-fallback"
    };
  }
}

export async function evaluateDefenseAnswerAI(payload: any) {
  const provider = process.env.AI_PROVIDER || 'gemini';
  console.log(`[AI] evaluate request started (provider=${provider})`);

  if (provider === 'local' || provider !== 'gemini') {
    if (provider !== 'local') {
      console.warn(`[AI Provider] Provider "${provider}" is not recognized. Falling back to local.`);
    }
    const localEval = evaluateAnswer(
      payload.question,
      payload.answer,
      payload.research,
      payload.examinerMode
    );
    console.log(`[AI] evaluate success provider=local-fallback`);
    return {
      ...localEval,
      provider: "local-fallback"
    };
  }

  try {
    const prompt = `Anda adalah dosen penguji sidang akademik yang bertugas mengevaluasi jawaban mahasiswa secara kritis, objektif, dan bervariasi.

Konteks Penelitian Mahasiswa:
- Judul Penelitian: ${payload.research.title}
- Pendekatan Penelitian: ${payload.research.researchApproach || 'Tidak disebutkan'}
- Metode / Teknik: ${payload.research.method}
- Bidang / Topik: ${payload.research.field || 'Umum'}
- Kata Kunci: ${payload.research.keywords || 'Tidak disediakan'}

Konteks Tanya-Jawab yang Sedang Aktif:
- Pertanyaan Penguji yang Aktif: "${payload.question}"
- Jawaban Mahasiswa untuk Pertanyaan Tersebut: "${payload.answer}"
- Mode Penguji saat ini: "${payload.examinerMode}"

CATATAN PENTING: Evaluasi jawaban sesuai dengan bidang dan pendekatan penelitian mahasiswa. Jangan menilai berdasarkan standar Teknik Informatika/ML jika penelitian mahasiswa bukan dari bidang tersebut.

Tugas Anda adalah menilai kualitas jawaban mahasiswa secara dinamis terhadap pertanyaan penguji yang sedang aktif. JANGAN mengevaluasi berdasarkan pertanyaan lama. Berikan feedback konstruktif.

Kriteria Bobot Penilaian (Skala 0 - 100):
1. Relevansi terhadap pertanyaan aktif: 35%
2. Ketepatan konsep/metodologi: 25%
3. Kelengkapan argumen: 20%
4. Kejelasan dan struktur jawaban: 10%
5. Kemampuan mempertahankan penelitian: 10%

Aturan Penting Penilaian:
- Evaluasi harus dinamis, objektif, dan bernilai variatif antara 0 hingga 100 berdasarkan kualitas jawaban nyata. JANGAN gunakan nilai default atau selalu 70.
- Jika jawaban tidak relevan dengan pertanyaan aktif, skor harus turun signifikan (maksimal 50) meskipun jawaban ditulis sangat panjang lebar.
- Jika jawaban kosong, sangat pendek (kurang dari 1-2 kalimat pendek), atau hanya noise/tidak bermakna, berikan skor maksimal 40.
- Jika jawaban panjang tetapi berputar-putar, melantur, atau repetitif tanpa substansi baru, berikan pengurangan nilai yang signifikan (maksimal 55).
- Panduan Skor Akhir:
  * 0–30: tidak menjawab / sangat tidak relevan (tidak nyambung total) / hanya berisi noise.
  * 31–50: menjawab sebagian tapi meleset dari inti pertanyaan atau argumen sangat lemah.
  * 51–70: cukup relevan tapi kurang detail, kurang bukti ilmiah, atau berputar-putar.
  * 71–85: baik, relevan, terstruktur cukup kuat, dan menyangkut metodologi/konteks penelitian.
  * 86–100: sangat kuat, spesifik, argumentatif, didukung logika ilmiah solid, dan sesuai konteks penelitian.

Panduan Penulisan Feedback & Bahasa:
- Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia. Jangan gunakan Bahasa Inggris kecuali istilah teknis yang memang umum.
- Sediakan followUpQuestion (pertanyaan lanjutan) jika dirasa ada poin penting dari jawaban mahasiswa yang perlu digali lagi (opsional, jika tidak ada kosongkan "").
- Format feedback strengths (kekuatan), weaknesses (kelemahan), dan suggestion (saran perbaikan) sebagai list yang rapi: gunakan format bullet-point sederhana atau daftar bernomor jika ada banyak poin.

Return ONLY JSON format (tanpa markdown format, pastikan JSON valid):
{
  "score": [skor dinamis 0-100 berupa angka],
  "strengths": ["kekuatan 1", "kekuatan 2", ...],
  "weaknesses": ["kelemahan 1", "kelemahan 2", ...],
  "suggestion": "Saran perbaikan praktis..."
}`;

    const result = await callAIProvider(provider, prompt, 'evaluate');
    if (!result) {
      throw new Error('Empty result from AI provider during evaluation.');
    }

    let score = Number(result.score);
    if (isNaN(score)) {
      score = 50; 
    }
    score = Math.max(0, Math.min(100, score));
    result.score = score;
    
    // Normalisasi strengths agar selalu array of strings
    if (!Array.isArray(result.strengths)) {
      if (typeof result.strengths === 'string') {
        const splitText = result.strengths.split('\n').map((s: string) => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
        result.strengths = splitText.length > 0 ? splitText : [result.strengths];
      } else {
        result.strengths = [];
      }
    }
    
    // Normalisasi weaknesses agar selalu array of strings
    if (!Array.isArray(result.weaknesses)) {
      if (typeof result.weaknesses === 'string') {
        const splitText = result.weaknesses.split('\n').map((s: string) => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
        result.weaknesses = splitText.length > 0 ? splitText : [result.weaknesses];
      } else {
        result.weaknesses = [];
      }
    }
    if (typeof result.suggestion !== 'string') {
      result.suggestion = '';
    }
    
    console.log(`[AI] evaluate success provider=${provider} score=${score}`);
    return result;
  } catch (error: any) {
    console.warn(`[AI] evaluate failed, using fallback:`, error.message);
    const localEval = evaluateAnswer(
      payload.question,
      payload.answer,
      payload.research,
      payload.examinerMode
    );
    return {
      ...localEval,
      provider: "local-fallback"
    };
  }
}

export async function generateFinalEvaluationAI(payload: any) {
  const provider = process.env.AI_PROVIDER || 'gemini';
  console.log(`[AI] final evaluation request started (provider=${provider})`);
  
  if (provider === 'local' || provider !== 'gemini') {
    if (provider !== 'local') {
      console.warn(`[AI Provider] Provider "${provider}" is not recognized. Falling back to local.`);
    }
    const sessionObj = {
      research: payload.research,
      transcript: payload.transcript
    } as any;
    const localFinal = generateFinalEvaluation(sessionObj);
    console.log(`[AI] final evaluation success provider=local-fallback`);
    return {
      ...localFinal,
      provider: "local-fallback"
    };
  }

  try {
    const transcriptText = payload.transcript.map((t: any) => {
      let sender = 'Penguji';
      if (t.type === 'answer') sender = 'Mahasiswa';
      else if (t.type === 'feedback') sender = 'Umpan Balik Penguji';
      return `${sender}: ${t.content}`;
    }).join('\n');

    const prompt = `Buat ringkasan evaluasi akhir sidang akademik berdasarkan transkrip tanya-jawab berikut.

Data Sesi Penelitian:
- Judul: ${payload.research.title}
- Bidang / Topik: ${payload.research.field || 'Umum'}
- Pendekatan Penelitian: ${payload.research.researchApproach || 'Tidak disebutkan'}
- Metode / Teknik: ${payload.research.method || 'Tidak disebutkan'}
- Mode Penguji: ${payload.research.examinerMode || payload.examinerMode}

Transkrip Tanya-Jawab:
${transcriptText}

Tugas Anda adalah merangkum jalannya sidang dan menilai performa mahasiswa.
Aturan Skor Akhir & Bahasa:
- Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia. Jangan gunakan Bahasa Inggris kecuali istilah teknis yang memang umum.
- Berikan skor akhir (0 - 100) berdasarkan pemahaman jawaban mahasiswa yang tertera di transkrip. JANGAN memberikan skor 0 jika mahasiswa sudah menjawab (nilai baseline minimal 50).
- Saran latihan (nextPractice) harus relevan dengan bidang/topik penelitian mahasiswa, BUKAN template Teknik Informatika jika bidangnya berbeda.

Return ONLY JSON format (tanpa markdown format, pastikan JSON valid):
{
  "score": 80,
  "summary": "Ringkasan penilaian akhir keseluruhan sidang dalam Bahasa Indonesia...",
  "strengths": ["Poin kelebihan umum mahasiswa...", "..."],
  "weaknesses": ["Poin kekurangan umum mahasiswa...", "..."],
  "nextPractice": ["Saran latihan selanjutnya yang relevan dengan bidang penelitian mahasiswa..."]
}`;

    const result = await callAIProvider(provider, prompt, 'final-evaluation');
    if (!result) {
      throw new Error('Empty result from AI provider during final evaluation.');
    }

    let score = Number(result.score);
    if (isNaN(score)) {
      score = 50;
    }
    score = Math.max(0, Math.min(100, score));
    result.score = score;
    
    if (typeof result.summary !== 'string') {
      result.summary = '';
    }
    if (!Array.isArray(result.strengths)) {
      result.strengths = [];
    }
    if (!Array.isArray(result.weaknesses)) {
      result.weaknesses = [];
    }
    if (!Array.isArray(result.nextPractice)) {
      result.nextPractice = [];
    }
    
    console.log(`[AI] final evaluation success provider=${provider}`);
    return result;
  } catch (error: any) {
    console.warn(`[AI] final evaluation failed, using fallback:`, error.message);
    const sessionObj = {
      research: payload.research,
      transcript: payload.transcript
    } as any;
    const localFinal = generateFinalEvaluation(sessionObj);
    return {
      ...localFinal,
      provider: "local-fallback"
    };
  }
}

async function callAIProvider(provider: string, prompt: string, type: string): Promise<any> {
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'isi_api_key_gemini_di_sini' || apiKey.trim() === '') {
      throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.');
    }
    return await callGemini(prompt, type);
  }
  throw new Error(`Unknown AI Provider configured: "${provider}"`);
}

async function callGemini(prompt: string, type: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash';
  if (!apiKey) throw new Error('Missing Gemini API Key');

  console.log(`[AI Provider] provider=gemini type=${type} model=${primaryModel}`);

  try {
    return await executeGeminiRequest(apiKey, primaryModel, prompt);
  } catch (error: any) {
    if (fallbackModel) {
      console.warn(`[AI Provider] Gemini primary model ${primaryModel} failed (${error.message}). Retrying with fallback model ${fallbackModel}...`);
      console.log(`[AI Provider] provider=gemini type=${type} model=${fallbackModel}`);
      try {
        return await executeGeminiRequest(apiKey, fallbackModel, prompt);
      } catch (fallbackError: any) {
        console.error(`[AI Provider] Gemini fallback model failed, using local fallback: ${fallbackError.message}`);
        throw fallbackError;
      }
    } else {
      console.error(`[AI Provider] Gemini failed, using local fallback: ${error.message}`);
      throw error;
    }
  }
}

async function executeGeminiRequest(apiKey: string, model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.75,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini HTTP Error ${res.status}: ${errorText}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response content from Gemini API');
  
  const parsed = safeJsonParse(text);
  parsed.provider = 'gemini';
  return parsed;
}
