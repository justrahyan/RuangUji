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
    const prompt = `Anda berperan sebagai dosen penguji profesional, cerdas, dan kritis dalam sidang akademik di Indonesia.
Tugas Anda adalah membuat 1 (satu) pertanyaan sidang yang spesifik, mendalam, dan relevan dengan penelitian mahasiswa berikut:

Detail Penelitian Mahasiswa:
- Jenis Sidang: ${payload.research.sessionType || 'Sidang Akhir'}
- Judul Penelitian: ${payload.research.title}
- Topik/Bidang: ${payload.research.field || 'Umum'}
- Metode yang Digunakan: ${payload.research.method}
- Abstrak: ${payload.research.abstract || 'Tidak disediakan'}
- Kekhawatiran Utama Mahasiswa: ${payload.research.concern || 'Tidak ada'}
- Pertanyaan Sebelumnya (JANGAN DIULANG): ${payload.previousQuestions?.join(' | ') || 'Belum ada'}

Karakter & Mode Penguji:
Mode saat ini adalah: "${payload.examinerMode}"
Panduan gaya bertanya berdasarkan Mode Penguji:
- "santai": Tanyakan dengan nada mendukung, ramah, bersahabat, namun tetap akademis. Pertanyaan lebih mudah dipahami dan dijawab.
- "kritis": Pertanyaan tajam, mendalam, objektif, menanyakan landasan logis di balik keputusan desain/penelitian.
- "killer": Tekankan celah penelitian, tanyakan hal-hal menekan secara konfrontatif untuk menguji ketahanan mental dan keyakinan argumen mahasiswa.
- "metodologi": Fokus sepenuhnya pada keselarasan masalah, tujuan, instrumen, validitas proses, dan kesahihan langkah-langkah penelitian.
- "statistik": Tanyakan signifikansi data, uji statistik, validasi angka, atau metrik evaluasi. Jika riset bukan penelitian kuantitatif/statistik, arahkan pertanyaan ke validasi data/bukti/hasil, bukan metrik machine learning.
- "novelty": Fokus pada kebaruan penelitian, kontribusi ilmiah, pembeda nyata dibanding penelitian terdahulu, dan orisinalitas ide.
- "implementasi": Fokus pada penerapan praktis di lapangan, kegunaan sistem, dampak nyata bagi pengguna, dan potensi hambatan operasional saat diterapkan.

Aturan Penting Pertanyaan:
1. SPESIFIK & RELEVAN: Jangan memberikan pertanyaan template umum. Pertanyaan harus dikaitkan langsung dengan judul, metode, atau abstrak penelitian mahasiswa tersebut.
2. BAHASA: Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia. Jangan gunakan Bahasa Inggris kecuali istilah teknis yang memang umum.
3. JANGAN REPETISI: Jangan membuat pertanyaan yang semakna atau mengulang topik pertanyaan sebelumnya (${payload.previousQuestions?.join(', ') || 'tidak ada'}). Jika sebelumnya sudah membahas alasan pemilihan metode, ganti ke aspek lain seperti batasan, validasi, implementasi, atau latar belakang masalah.
4. KHUSUS METODE SISTEM PAKAR (Expert System, Certainty Factor, Forward Chaining, Decision Tree, dll.): Fokuskan pertanyaan pada basis pengetahuan (knowledge base), keterlibatan dan validasi pakar, representasi rule/aturan, penentuan gejala/penyakit, alur inferensi, penyelesaian konflik nilai keyakinan (Certainty Factor), pembobotan MB/MD, validitas hasil diagnosis, keterbatasan/batasan sistem, atau skenario implementasi di lapangan. JANGAN menanyakan metrik evaluasi machine learning, akurasi model, split data train/test, confusion matrix, atau overfitting kecuali jika sistem pakar tersebut dikombinasikan dengan machine learning.
5. KHUSUS PENELITIAN NON-TEKNIK (Sosial, Pendidikan, Kesehatan non-ML, Bisnis, Hukum, dll.): Sesuaikan konteks pertanyaan sepenuhnya dengan bidang tersebut (responden, validitas instrumen angket, kode etik, studi kasus, dampak kebijakan, observasi kualitatif). JANGAN menanyakan istilah-istilah informatika/komputer (seperti dataset, akurasi model, sistem, arsitektur database, overfitting) kecuali jika memang relevan.
6. JANGAN MENANYAKAN METRIK ML JIKA NON-ML: Jangan menanyakan metrik evaluasi, akurasi, dataset size, split data, confusion matrix, overfitting, atau machine learning jika penelitian tidak memakai machine learning.
7. FORMAT JAWABAN: Berikan pertanyaan singkat dan padat (maksimal 1-2 kalimat).

Return ONLY JSON format (tanpa markdown format, pastikan JSON valid):
{
  "question": "Kalimat pertanyaan penguji...",
  "category": "Kategori pertanyaan (misal: metode, novelty, batasan, implementasi, latar_belakang)",
  "reason": "Alasan singkat mengapa Anda mengajukan pertanyaan ini berdasarkan profil penelitian mahasiswa"
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
    const prompt = `Anda adalah dosen penguji sidang akademik yang bertugas mengevaluasi jawaban mahasiswa.

Konteks Penelitian Mahasiswa:
- Judul Penelitian: ${payload.research.title}
- Metode: ${payload.research.method}
- Topik/Bidang: ${payload.research.field || 'Umum'}

Konteks Tanya-Jawab yang Sedang Aktif:
- Pertanyaan Penguji yang Aktif: "${payload.question}"
- Jawaban Mahasiswa untuk Pertanyaan Tersebut: "${payload.answer}"
- Mode Penguji saat ini: "${payload.examinerMode}"

Tugas Anda adalah menilai kualitas jawaban mahasiswa terhadap pertanyaan penguji yang sedang aktif. JANGAN mengevaluasi berdasarkan pertanyaan lama. Berikan feedback konstruktif.

Panduan Penilaian Skor (Skala 0 - 100):
- JANGAN PERNAH memberikan skor 0 kecuali jika jawaban kosong, sama sekali tidak relevan dengan pertanyaan (tidak nyambung total), atau hanya berisi teks sampah/noise.
- Jika mahasiswa berusaha menjawab namun jawaban kurang kuat, tidak terstruktur, tidak rapi, atau terlalu singkat: Berikan skor minimal 40 (misal 40-54).
- Jika jawaban relevan sebagian, menjawab sebagian pertanyaan, namun penjelasan kurang mendalam: Berikan skor 55-75.
- Jika jawaban relevan, jelas, terstruktur, dan spesifik membahas konteks penelitiannya: Berikan skor 76-90.
- Jika jawaban sangat kuat, meyakinkan, didukung argumen ilmiah yang solid, dan menunjukkan penguasaan materi yang luar biasa: Berikan skor 91-100.
- Deteksi Jawaban Repetitif/Berputar-putar: Jika jawaban menggunakan frasa atau argumen yang sama berulang kali (berputar-putar), kurangi skornya. Jangan memberikan nilai tinggi hanya karena jawaban tersebut panjang jika isinya berputar-putar.

Panduan Penulisan Feedback & Bahasa:
- Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia. Jangan gunakan Bahasa Inggris kecuali istilah teknis yang memang umum.
- Berikan kekuatan (strengths) dan kelemahan (weaknesses) dalam bentuk daftar ringkas (array of strings).
- Berikan saran perbaikan (suggestion) praktis yang to-the-point agar jawaban berikutnya lebih baik.
- Sediakan followUpQuestion (pertanyaan lanjutan) jika dirasa ada poin penting dari jawaban mahasiswa yang perlu digali lagi (opsional, jika tidak ada kosongkan "").

Return ONLY JSON format (tanpa markdown format, pastikan JSON valid):
{
  "score": 70,
  "strengths": ["Poin kekuatan 1...", "Poin kekuatan 2..."],
  "weaknesses": ["Poin kelemahan 1...", "Poin kelemahan 2..."],
  "suggestion": "Saran perbaikan praktis...",
  "followUpQuestion": "Pertanyaan lanjutan (opsional, kosongkan jika tidak diperlukan)"
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
    
    if (!Array.isArray(result.strengths)) {
      result.strengths = typeof result.strengths === 'string' ? [result.strengths] : [];
    }
    if (!Array.isArray(result.weaknesses)) {
      result.weaknesses = typeof result.weaknesses === 'string' ? [result.weaknesses] : [];
    }
    if (typeof result.suggestion !== 'string') {
      result.suggestion = '';
    }
    
    console.log(`[AI] evaluate success provider=${provider}`);
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
- Mode Penguji: ${payload.examinerMode}

Transkrip Tanya-Jawab:
${transcriptText}

Tugas Anda adalah merangkum jalannya sidang dan menilai performa mahasiswa.
Aturan Skor Akhir & Bahasa:
- Gunakan Bahasa Indonesia yang natural, akademik, dan sesuai konteks sidang mahasiswa Indonesia. Jangan gunakan Bahasa Inggris kecuali istilah teknis yang memang umum.
- Berikan skor akhir (0 - 100) berdasarkan pemahaman jawaban mahasiswa yang tertera di transkrip. JANGAN memberikan skor 0 jika mahasiswa sudah menjawab (nilai baseline minimal 50).

Return ONLY JSON format (tanpa markdown format, pastikan JSON valid):
{
  "score": 80,
  "summary": "Ringkasan penilaian akhir keseluruhan sidang dalam Bahasa Indonesia...",
  "strengths": ["Poin kelebihan umum mahasiswa...", "..."],
  "weaknesses": ["Poin kekurangan umum mahasiswa...", "..."],
  "nextPractice": ["Saran latihan selanjutnya untuk memperdalam pemahaman..."]
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
