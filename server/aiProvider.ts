type GeminiPart = {
  text: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function safeText(value: unknown, fallback = "-") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned || fallback;
}

function truncateText(text: string | undefined, max = 28000) {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max) + "\n\n[DOKUMEN DIPOTONG KARENA TERLALU PANJANG]";
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const sliced = cleaned.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Gemini response is not valid JSON");
  }
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di .env");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.95,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`Gemini HTTP Error ${res.status}: ${raw}`);
  }

  const data = JSON.parse(raw) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini response kosong.");
  }

  return extractJson(text);
}

function buildResearchContext(research: any) {
  const documentContext = truncateText(research?.documentText, 28000);
  const documentPreview = truncateText(research?.documentPreview, 3500);

  return `
[KONTEKS PENELITIAN]

Judul Penelitian:
${safeText(research?.title)}

Jenis Sidang / Presentasi:
${safeText(research?.sessionType)}

Bidang / Topik:
${safeText(research?.field)}

Kata Kunci / Fokus Kajian:
${safeText(research?.keywords)}

Pendekatan Penelitian:
${safeText(research?.researchApproach)}

Metode / Teknik Utama:
${safeText(research?.method)}

Ringkasan / Abstrak Manual:
${safeText(research?.abstract)}

Hal yang Ingin Dilatih / Dikhawatirkan:
${safeText(research?.concern)}

Dokumen Diunggah:
${safeText(research?.documentName)}

Cuplikan Dokumen:
${documentPreview || "-"}

Isi Dokumen Lengkap yang Berhasil Diekstrak:
${documentContext || "Tidak ada dokumen tambahan."}

[CATATAN PENTING]
Jika ada isi dokumen lengkap, gunakan bagian itu sebagai konteks utama tambahan. Jangan hanya membaca abstrak manual.
`.trim();
}

function buildPreviousQuestionContext(previousQuestions: string[] = []) {
  if (!previousQuestions.length) return "Belum ada pertanyaan sebelumnya.";
  return previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function normalizeQuestionMode(mode: string) {
  const map: Record<string, string> = {
    santai: "pertanyaan ramah dan tidak terlalu menekan, tetapi tetap bervariasi serta mengikuti fokus pertanyaan ke-n; jangan hanya bertanya alasan memilih topik",
    kritis: "pertanyaan tajam, objektif, dan menguji konsistensi argumen",
    killer: "pertanyaan sulit, menekan, dan menguji kelemahan penelitian",
    metodologi: "pertanyaan tentang desain penelitian, tahapan, validitas, dan alasan metode",
    statistik: "pertanyaan tentang data, analisis, instrumen, hasil, atau pembuktian; hanya bahas metrik statistik jika memang relevan dengan penelitian",
    novelty: "pertanyaan tentang kebaruan, kontribusi, gap penelitian, dan pembeda dari penelitian sebelumnya",
    implementasi: "pertanyaan tentang penerapan hasil, alur pelaksanaan, dampak praktis, dan realisasi penelitian; jangan otomatis menganggap ini sistem/software",
  };

  return map[mode] || map.kritis;
}

function getQuestionFocusPlan(mode: string, questionIndex: number) {
  const plans: Record<string, string[]> = {
    santai: [
      "pemahaman umum terhadap topik dan alasan memilih penelitian",
      "masalah utama, urgensi, dan latar belakang penelitian",
      "alasan memilih metode atau pendekatan penelitian",
      "alur penelitian dari data/proses awal sampai hasil",
      "hasil utama, kontribusi, dan manfaat praktis penelitian",
      "batasan penelitian dan bagian yang masih bisa dikembangkan",
      "kesiapan menjelaskan penelitian kepada orang non-ahli",
      "refleksi pribadi terhadap kekuatan dan kelemahan penelitian",
    ],
    kritis: [
      "konsistensi antara masalah, tujuan, metode, dan hasil",
      "alasan ilmiah di balik keputusan penelitian",
      "validitas data, asumsi, dan potensi bias",
      "ketepatan metode dibanding alternatif lain",
      "kekuatan bukti yang mendukung kesimpulan",
      "kelemahan penelitian dan cara mengantisipasinya",
      "kontribusi nyata dibanding penelitian sebelumnya",
      "implikasi hasil jika diterapkan pada kondisi berbeda",
    ],
    killer: [
      "titik paling lemah dari penelitian",
      "kemungkinan kesalahan asumsi utama",
      "kenapa metode yang dipilih tidak keliru",
      "bagaimana jika hasil penelitian dipertanyakan",
      "apakah kontribusi penelitian benar-benar baru",
      "bagaimana membela hasil jika ada data yang tidak ideal",
      "keterbatasan paling serius dan dampaknya",
      "pertanyaan jebakan yang menguji pemahaman mendalam",
    ],
    metodologi: [
      "desain penelitian dan alasan pemilihannya",
      "tahapan penelitian dari awal sampai akhir",
      "proses pengumpulan data atau sumber informasi",
      "validitas, reliabilitas, triangulasi, atau kredibilitas data",
      "alasan memilih metode dibanding metode alternatif",
      "cara memastikan hasil tidak bias",
      "keterbatasan metodologi",
      "replikasi atau pengembangan metodologi",
    ],
    statistik: [
      "jenis data dan alasan teknik analisis yang digunakan",
      "validitas instrumen, kualitas data, atau kelayakan analisis",
      "cara membaca hasil atau temuan secara objektif",
      "pembuktian hasil sesuai pendekatan penelitian",
      "risiko bias, outlier, atau ketidakseimbangan data jika relevan",
      "interpretasi hasil dan hubungannya dengan tujuan penelitian",
      "batasan data dan dampaknya pada kesimpulan",
      "alasan hasil dapat dipercaya",
    ],
    novelty: [
      "gap penelitian yang ingin dijawab",
      "perbedaan penelitian dengan studi sebelumnya",
      "kontribusi utama secara teori atau praktik",
      "bagian paling baru dari penelitian",
      "alasan kontribusi tersebut penting",
      "potensi pengembangan penelitian berikutnya",
      "keunikan konteks, data, metode, atau objek penelitian",
      "nilai tambah penelitian bagi bidang terkait",
    ],
    implementasi: [
      "bagaimana hasil penelitian dapat diterapkan",
      "siapa pengguna/penerima manfaat dari hasil penelitian",
      "alur penerapan hasil di lapangan atau konteks nyata",
      "kendala penerapan dan cara mengatasinya",
      "dampak praktis penelitian",
      "batasan implementasi hasil",
      "kebutuhan sumber daya atau kondisi pendukung",
      "kelayakan hasil jika diterapkan di lingkungan berbeda",
    ],
  };

  const list = plans[mode] || plans.kritis;
  return list[questionIndex % list.length];
}

function getAntiRepeatInstruction(previousQuestions: string[] = []) {
  if (!previousQuestions.length) {
    return "Belum ada pertanyaan sebelumnya. Buat pertanyaan pertama yang relevan, tetapi jangan terlalu generik.";
  }

  return `
Pertanyaan sebelumnya:
${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Jangan mengulang pola, topik, atau maksud pertanyaan di atas.
Jika pertanyaan sebelumnya sudah membahas pembagian data, jangan bertanya lagi tentang train/validation/test split.
Jika pertanyaan sebelumnya sudah membahas metode evaluasi, jangan bertanya lagi tentang metrik evaluasi.
Jika pertanyaan sebelumnya sudah membahas alasan memilih metode, lanjutkan ke aspek lain seperti validitas, batasan, kontribusi, atau implementasi.
`.trim();
}

function buildRandomSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function generateDefenseQuestionAI(payload: any) {
  const research = payload?.research || {};
  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const questionIndex = Number(payload?.questionIndex || 0);
  const previousQuestions = payload?.previousQuestions || [];

  const researchContext = buildResearchContext(research);
  const previousContext = getAntiRepeatInstruction(previousQuestions);
  const focusPlan = getQuestionFocusPlan(examinerMode, questionIndex);
  const randomSeed = buildRandomSeed();

  const prompt = `
Anda adalah dosen penguji akademik berbahasa Indonesia.

Tugas:
Buat SATU pertanyaan sidang yang relevan, natural, dan tidak template berdasarkan seluruh konteks penelitian mahasiswa.

${researchContext}

Mode penguji:
${examinerMode} — ${normalizeQuestionMode(examinerMode)}

Nomor pertanyaan saat ini:
${questionIndex + 1}

Fokus wajib untuk pertanyaan nomor ini:
${focusPlan}

Variasi seed:
${randomSeed}

${previousContext}

ATURAN WAJIB:
1. Gunakan seluruh konteks penelitian, termasuk isi dokumen lengkap jika tersedia.
2. Jangan hanya memakai abstrak.
3. Jangan mengulang pertanyaan sebelumnya, baik secara kalimat maupun maksud.
4. Jangan membuat pertanyaan yang tidak relevan dengan bidang/topik/metode/dokumen.
5. Pertanyaan harus mengikuti "Fokus wajib untuk pertanyaan nomor ini".
6. Untuk mode santai, tetap buat pertanyaan yang mudah dijawab, tetapi topiknya harus berbeda-beda setiap nomor.
7. Jangan selalu memulai dengan frasa "Bisa Anda ceritakan..." atau "Mengapa Anda memilih...".
8. Variasikan bentuk pertanyaan, misalnya:
   - "Bagaimana Anda memastikan..."
   - "Apa dasar Anda..."
   - "Di bagian mana penelitian ini..."
   - "Apa yang akan Anda jawab jika penguji menanyakan..."
   - "Bagaimana hubungan antara..."
   - "Sejauh mana..."
9. Jangan mengasumsikan penelitian ini adalah sistem/software jika dokumen tidak menyebut pengembangan sistem.
10. Mode implementasi berarti penerapan hasil atau pelaksanaan penelitian, bukan selalu implementasi aplikasi.
11. Jangan menanyakan metrik evaluasi, akurasi, precision, recall, F1-score, confusion matrix, atau machine learning jika penelitian tidak membahas model/performa/eksperimen kuantitatif.
12. Jika penelitian memang membahas Machine Learning atau evaluasi model, pertanyaan boleh membahas data, validasi, overfitting, seleksi fitur, hasil, atau interpretasi, tetapi jangan selalu bertanya metrik.
13. Untuk penelitian kualitatif, arahkan ke informan, triangulasi, validitas data, proses analisis, dan kontribusi.
14. Untuk penelitian kuantitatif, arahkan ke variabel, sampel, instrumen, validitas, reliabilitas, uji statistik, dan interpretasi hasil.
15. Untuk R&D/pengembangan, arahkan ke kebutuhan pengguna, desain produk, validasi ahli, uji coba, revisi, dan kebermanfaatan.
16. Untuk studi literatur, arahkan ke sumber literatur, kriteria inklusi-eksklusi, proses seleksi, dan sintesis temuan.
17. Pertanyaan harus terdengar seperti dosen penguji, bukan chatbot template.
18. Pertanyaan cukup 1 kalimat atau maksimal 2 kalimat pendek.
19. Jangan buat pertanyaan terlalu mirip dengan daftar pertanyaan bank lokal.

Output wajib JSON valid:
{
  "question": "pertanyaan di sini",
  "category": "kategori singkat sesuai fokus",
  "provider": "gemini"
}
`.trim();

  const result = await callGemini(prompt);

  return {
    question: safeText(result.question, "Apa bagian paling penting dari penelitian Anda yang perlu dipahami penguji?"),
    category: safeText(result.category, focusPlan),
    provider: "gemini",
  };
}

export async function evaluateDefenseAnswerAI(payload: any) {
  const research = payload?.research || {};
  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const question = safeText(payload?.question);
  const answer = safeText(payload?.answer);

  const researchContext = buildResearchContext(research);

  const prompt = `
Anda adalah dosen penguji akademik berbahasa Indonesia.

Tugas:
Nilai jawaban mahasiswa terhadap pertanyaan sidang yang sedang aktif.

${researchContext}

Mode penguji:
${examinerMode} — ${normalizeQuestionMode(examinerMode)}

Pertanyaan yang sedang dinilai:
${question}

Jawaban mahasiswa:
${answer}

ATURAN PENILAIAN:
1. Nilai jawaban berdasarkan pertanyaan yang sedang aktif, jangan mengganti pertanyaan.
2. Cocokkan jawaban dengan konteks penelitian dan isi dokumen jika tersedia.
3. Skor harus realistis 0-100, jangan selalu 70.
4. Skor rendah jika jawaban tidak relevan, terlalu umum, atau tidak menjawab inti pertanyaan.
5. Skor tinggi jika jawaban relevan, spesifik, runtut, dan sesuai konteks penelitian.
6. Pertimbangkan:
   - relevansi terhadap pertanyaan
   - ketepatan konsep/metode
   - kedalaman argumen
   - kejelasan struktur
   - kesesuaian dengan dokumen penelitian
7. Jika tidak ada kelemahan besar, isi weaknesses dengan ["Tidak ada."].
8. Gunakan bahasa Indonesia yang jelas, singkat, dan akademik.
9. strengths dan weaknesses harus berupa array, bukan paragraf panjang.

Output wajib JSON valid:
{
  "score": 0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestion": "...",
  "provider": "gemini"
}
`.trim();

  const result = await callGemini(prompt);

  const score = Math.max(0, Math.min(100, Number(result.score) || 0));

  const strengths = Array.isArray(result.strengths)
    ? result.strengths.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  const weaknesses = Array.isArray(result.weaknesses)
    ? result.weaknesses.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  return {
    score,
    strengths: strengths.length ? strengths : ["Belum terdeteksi secara jelas."],
    weaknesses: weaknesses.length ? weaknesses : ["Tidak ada."],
    suggestion: safeText(result.suggestion, "Pertahankan struktur jawaban dan sesuaikan dengan inti pertanyaan."),
    provider: "gemini",
  };
}

export async function generateFinalEvaluationAI(payload: any) {
  const research = payload?.research || {};
  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const transcript = Array.isArray(payload?.transcript) ? payload.transcript : [];

  const researchContext = buildResearchContext(research);

  const transcriptText = transcript
    .map((item: any, index: number) => {
      const label =
        item.type === "question"
          ? "PENGUJI"
          : item.type === "answer"
            ? "MAHASISWA"
            : item.type === "feedback"
              ? "UMPAN BALIK"
              : "SISTEM";

      return `${index + 1}. [${label}] ${item.content || ""}${typeof item.score === "number" ? `\nSkor: ${item.score}` : ""}`;
    })
    .join("\n\n")
    .slice(0, 30000);

  const prompt = `
Anda adalah dosen penguji akademik berbahasa Indonesia.

Tugas:
Buat evaluasi akhir sesi simulasi sidang.

${researchContext}

Mode penguji:
${examinerMode} — ${normalizeQuestionMode(examinerMode)}

Transkrip sesi:
${transcriptText}

ATURAN:
1. Gunakan seluruh transkrip sesi.
2. Jika ada skor pada umpan balik, jadikan itu dasar skor akhir.
3. Jangan memberi skor 0 jika mahasiswa sudah menjawab.
4. Ringkas performa mahasiswa secara jujur dan akademik.
5. strengths, weaknesses, dan nextPractice harus berupa array.
6. Jika kelemahan tidak terlalu besar, tetap berikan area latihan yang realistis.

Output wajib JSON valid:
{
  "score": 0,
  "summary": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "nextPractice": ["..."],
  "provider": "gemini"
}
`.trim();

  const result = await callGemini(prompt);

  const score = Math.max(0, Math.min(100, Number(result.score) || 0));

  return {
    score,
    summary: safeText(result.summary, "Sesi latihan selesai. Evaluasi dibuat berdasarkan jawaban selama simulasi."),
    strengths: Array.isArray(result.strengths) && result.strengths.length
      ? result.strengths.map((x: any) => String(x).trim()).filter(Boolean)
      : ["Mampu menyelesaikan sesi latihan."],
    weaknesses: Array.isArray(result.weaknesses) && result.weaknesses.length
      ? result.weaknesses.map((x: any) => String(x).trim()).filter(Boolean)
      : ["Perlu memperjelas struktur dan kedalaman jawaban."],
    nextPractice: Array.isArray(result.nextPractice) && result.nextPractice.length
      ? result.nextPractice.map((x: any) => String(x).trim()).filter(Boolean)
      : ["Latih jawaban dengan struktur: alasan, bukti, dan relevansi dengan penelitian."],
    provider: "gemini",
  };
}