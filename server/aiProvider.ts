export const documentCache = new Map<string, string>();

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

function safeSpeechText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function clampScoreByCategory(score: number, category: string) {
  const c = String(category || "").toLowerCase();

  if (c === "empty" || c === "copy_question" || c === "feedback_text") {
    return Math.min(score, 10);
  }

  if (c === "refusal" || c === "mocking" || c === "non_answer") {
    return Math.min(score, 15);
  }

  if (c === "off_topic") {
    return Math.min(score, 25);
  }

  if (c === "very_short_non_substantive") {
    return Math.min(score, 35);
  }

  if (c === "partial_relevant_informal") {
    return Math.max(35, Math.min(score, 55));
  }

  if (c === "partial_relevant") {
    return Math.max(45, Math.min(score, 65));
  }

  if (c === "adequate") {
    return Math.max(60, Math.min(score, 80));
  }

  if (c === "strong") {
    return Math.max(75, Math.min(score, 90));
  }

  if (c === "excellent") {
    return Math.max(85, Math.min(score, 100));
  }

  return score;
}

function buildFallbackSpeechText(text: string) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/Skor:\s*(\d+)/gi, "Skor $1.")
    .trim();
}

function truncateText(text: string | undefined, max = 28000) {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max) + "\n\n[DOKUMEN DIPOTONG KARENA TERLALU PANJANG]";
}

function extractJson(text: string) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const firstObj = cleaned.indexOf("{");
  const lastObj = cleaned.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    const sliced = cleaned.slice(firstObj, lastObj + 1);
    const parsed = tryParse(sliced);
    if (parsed) return parsed;
  }

  const firstArr = cleaned.indexOf("[");
  const lastArr = cleaned.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    const slicedArr = cleaned.slice(firstArr, lastArr + 1);
    const parsedArr = tryParse(slicedArr);
    if (parsedArr) return { questions: parsedArr };
  }

  const questionMatches = [...cleaned.matchAll(/"question"\s*:\s*"([^"]+)"/g)];
  const categoryMatches = [...cleaned.matchAll(/"category"\s*:\s*"([^"]+)"/g)];

  if (questionMatches.length > 0) {
    return {
      questions: questionMatches.map((match, index) => ({
        question: match[1],
        category: categoryMatches[index]?.[1] || "umum",
      })),
      provider: "gemini",
    };
  }

  const numbered = cleaned
    .split(/\n+/)
    .map(line => line.trim())
    .map(line => line.replace(/^\d+[\).]\s*/, ""))
    .filter(line => line.length > 20 && line.includes("?"));

  if (numbered.length > 0) {
    return {
      questions: numbered.map(question => ({
        question,
        category: "umum",
      })),
      provider: "gemini",
    };
  }

  throw new Error("Gemini response is not valid JSON");
}

async function callGemini(
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
) {

  const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);

  if (!apiKeys.length) {
    throw new Error("GEMINI_API_KEY atau GEMINI_API_KEYS belum diatur di .env");
  }

  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);

  const models = Array.from(
    new Set([
      process.env.GEMINI_MODEL || "gemini-2.5-flash",
      ...fallbackModels,
      "gemini-2.5-flash-lite",
      "gemini-3.5-flash",
    ].filter(Boolean))
  );

  const errors: string[] = [];

  for (const apiKey of apiKeys) {
    const keyIndex = apiKeys.indexOf(apiKey) + 1;

    for (const model of models) {
      try {
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
              temperature: options?.temperature ?? 0.55,
              topP: 0.9,
              topK: 40,
              maxOutputTokens: options?.maxOutputTokens ?? 1400,
              responseMimeType: "application/json",
            },
          }),
        });

        const raw = await res.text();

        if (!res.ok) {
          errors.push(`[key-${keyIndex} / ${model}] HTTP ${res.status}: ${raw}`);

          const shouldTryNext =
            res.status === 429 ||
            res.status === 404 ||
            res.status === 503 ||
            raw.toLowerCase().includes("quota") ||
            raw.toLowerCase().includes("resource_exhausted") ||
            raw.toLowerCase().includes("not found") ||
            raw.toLowerCase().includes("model");

          if (shouldTryNext) {
            console.warn(`[Gemini] Key ${keyIndex}, model ${model} gagal/limit, mencoba berikutnya...`);
            continue;
          }

          throw new Error(`Gemini HTTP Error ${res.status}: ${raw}`);
        }

        const data = JSON.parse(raw) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          errors.push(`[key-${keyIndex} / ${model}] Gemini response kosong.`);
          continue;
        }

        const parsed = extractJson(text);

        return {
          ...parsed,
          provider: "gemini",
          modelUsed: model,
          keyUsed: keyIndex,
        };
      } catch (err: any) {
        errors.push(`[key-${keyIndex} / ${model}] ${err?.message || String(err)}`);
        continue;
      }
    }
  }

  throw new Error(
    "Semua model Gemini gagal digunakan. Kemungkinan quota/rate limit sedang habis.\n\n" +
    errors.join("\n\n")
  );
}

function buildResearchContext(research: any) {
  const documentContext = truncateText(research?.documentText, 240000);
  const documentPreview = truncateText(research?.documentPreview, 2500);

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
1. PRIORITAS UTAMA KONTEKS: Jika isi dokumen lengkap (Isi Dokumen Lengkap yang Berhasil Diekstrak) tersedia, jadikan dokumen tersebut sebagai konteks utama dan sumber kebenaran (source of truth) untuk seluruh detail metodologi, instrumen, subjek, objek, variabel, dan hasil riset mahasiswa. Gunakan form manual hanya sebagai metadata pembantu.
2. Dilarang hanya berfokus pada abstrak manual. Mahasiswa mengunggah dokumen penuh agar Anda dapat bertanya tentang hal spesifik di dalam isi bab-bab penelitian mereka.
3. Jika isi form manual dan isi dokumen berbeda, prioritaskan isi dokumen pendukung untuk memahami detail penelitian.
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

function normalizeSessionType(sessionType: string) {
  const value = String(sessionType || '').toLowerCase();

  if (value.includes('proposal')) return 'proposal';
  if (value.includes('seminar hasil') || value.includes('hasil')) return 'seminar_hasil';
  if (value.includes('skripsi')) return 'sidang_skripsi';
  if (value.includes('paper')) return 'presentasi_paper';
  if (value.includes('tugas akhir') || value.includes('ta')) return 'presentasi_tugas_akhir';

  return 'lainnya';
}

function getSessionTypeGuidance(sessionType: string) {
  const normalized = normalizeSessionType(sessionType);

  const map: Record<string, string> = {
    proposal: `
Jenis sidang: Ujian Proposal.
Arah pertanyaan harus berfokus pada kelayakan rencana penelitian, bukan hasil akhir.
Prioritaskan pertanyaan tentang:
- latar belakang dan urgensi masalah,
- gap penelitian,
- rumusan masalah dan tujuan,
- batasan penelitian,
- alasan memilih pendekatan/metode,
- rencana pengumpulan data,
- rencana validasi atau teknik analisis,
- risiko metodologis sebelum penelitian dilakukan.

Hindari terlalu banyak bertanya tentang hasil akhir, pembahasan hasil, kesimpulan final, atau kontribusi final yang belum tersedia.
`.trim(),

    seminar_hasil: `
Jenis sidang: Seminar Hasil.
Arah pertanyaan harus berfokus pada temuan, pembahasan, dan validitas hasil.
Prioritaskan pertanyaan tentang:
- hasil utama penelitian,
- interpretasi temuan,
- hubungan hasil dengan rumusan masalah,
- pembahasan dibanding teori atau penelitian terdahulu,
- validitas hasil,
- keterbatasan data atau analisis,
- implikasi hasil penelitian.

Boleh menyinggung metode, tetapi jangan terlalu dominan seperti ujian proposal.
`.trim(),

    sidang_skripsi: `
Jenis sidang: Sidang Skripsi.
Arah pertanyaan harus menyeluruh karena penelitian dianggap sudah final.
Prioritaskan pertanyaan tentang:
- latar belakang dan urgensi,
- kesesuaian rumusan masalah, tujuan, metode, dan hasil,
- alasan metodologis,
- validitas data atau temuan,
- kontribusi penelitian,
- keterbatasan,
- pengembangan lanjutan,
- kesiapan mahasiswa mempertahankan keseluruhan isi penelitian.

Pertanyaan boleh menguji bagian mana pun dari penelitian secara seimbang.
`.trim(),

    presentasi_paper: `
Jenis sidang: Presentasi Paper.
Arah pertanyaan harus berfokus pada kualitas ilmiah paper.
Prioritaskan pertanyaan tentang:
- novelty atau kebaruan,
- gap penelitian,
- kontribusi ilmiah,
- posisi penelitian dibanding studi terdahulu,
- kekuatan metode atau eksperimen,
- validitas klaim,
- keterbatasan paper,
- potensi publikasi atau pengembangan riset.

Gunakan gaya pertanyaan yang menguji kontribusi, bukan sekadar isi laporan.
`.trim(),

    presentasi_tugas_akhir: `
Jenis sidang: Presentasi Tugas Akhir.
Arah pertanyaan harus berfokus pada masalah, solusi, implementasi, dan pengujian.
Prioritaskan pertanyaan tentang:
- masalah utama yang diselesaikan,
- alasan memilih solusi/metode,
- alur kerja atau tahapan pengerjaan,
- implementasi atau penerapan,
- hasil pengujian,
- manfaat praktis,
- kendala pengerjaan,
- pengembangan lanjutan.

Jangan otomatis menganggap tugas akhir selalu aplikasi/software jika konteks dokumen tidak menyebutnya.
`.trim(),

    lainnya: `
Jenis sidang: Lainnya.
Arah pertanyaan harus fleksibel mengikuti dokumen, bidang/topik, metode, abstrak, dan hal yang ingin dilatih.
Jangan memaksakan pola sidang skripsi, proposal, paper, atau seminar hasil jika konteks tidak mendukung.
`.trim(),
  };

  return map[normalized] || map.lainnya;
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

function getForbiddenRepeatedFocus(previousQuestions: string[]) {
  const forbidden: string[] = [];
  const joined = previousQuestions.join(" ").toLowerCase();

  if (joined.includes("overfitting") || joined.includes("underfitting")) {
    forbidden.push("overfitting / underfitting");
  }
  if (joined.includes("split") || joined.includes("pembagian data") || joined.includes("validation")) {
    forbidden.push("pembagian dataset (train/val/test split)");
  }
  if (joined.includes("metrik") || joined.includes("akurasi") || joined.includes("f1") || joined.includes("precision") || joined.includes("recall")) {
    forbidden.push("metrik evaluasi kuantitatif");
  }
  if (joined.includes("novelty") || joined.includes("kebaruan") || joined.includes("perbedaan")) {
    forbidden.push("novelty atau gap riset");
  }
  if (joined.includes("urgensi") || joined.includes("fenomena") || joined.includes("pemicu")) {
    forbidden.push("latar belakang / urgensi penelitian");
  }

  if (forbidden.length === 0) return "Tidak ada fokus terlarang khusus saat ini.";
  return `Dilarang membahas atau menanyakan kembali topik-topik berikut karena sudah ditanyakan sebelumnya: ${forbidden.join(", ")}.`;
}

function normalizeBatchSize(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

export async function generateDefenseQuestionsBatchAI(payload: any) {
  const research = payload?.research || {};

  let docText = research?.documentText;
  if (!docText && research?.docId) {
    docText = documentCache.get(research.docId);
  }

  const updatedResearch = { ...research, documentText: docText };

  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const startIndex = Number(payload?.questionIndex || 0);
  const batchSize = Math.max(1, Math.min(12, Number(payload?.batchSize || 5)));
  const previousQuestions = Array.isArray(payload?.previousQuestions)
    ? payload.previousQuestions
    : [];

  const researchContext = buildResearchContext(updatedResearch);
  const sessionTypeGuidance = getSessionTypeGuidance(updatedResearch?.sessionType);
  const previousContext = getAntiRepeatInstruction(previousQuestions);
  const forbiddenFocus = getForbiddenRepeatedFocus(previousQuestions);
  const randomSeed = buildRandomSeed();

  const focusPlans = Array.from({ length: batchSize }).map((_, idx) => {
    const index = startIndex + idx;
    return `${index + 1}. ${getQuestionFocusPlan(examinerMode, index)}`;
  }).join("\n");

  const prompt = `
Anda adalah dosen penguji akademik berbahasa Indonesia.

Tugas:
Buat ${batchSize} pertanyaan sidang yang relevan, natural, tidak template, dan saling berbeda berdasarkan seluruh konteks penelitian mahasiswa.

${researchContext}

Mode penguji:
${examinerMode} — ${normalizeQuestionMode(examinerMode)}

Arahan berdasarkan jenis sidang:
${sessionTypeGuidance}

Nomor pertanyaan yang perlu dibuat:
Mulai dari nomor ${startIndex + 1} sebanyak ${batchSize} pertanyaan.

Panduan variasi fokus:
${focusPlans}

Fokus terlarang untuk diulang:
${forbiddenFocus}

Variasi seed:
${randomSeed}

${previousContext}

ATURAN WAJIB:
1. Gunakan isi dokumen lengkap jika tersedia sebagai sumber utama. Ambil detail dari pendahuluan, metode, hasil, kesimpulan, tabel/uraian, bukan hanya abstrak.
2. Jika form manual berbeda dengan dokumen, ikuti dokumen.
3. Jangan mengulang pertanyaan sebelumnya, baik secara kalimat maupun maksud.
4. Jangan membuat pertanyaan yang tidak relevan dengan bidang/topik/metode/dokumen.
5. Gunakan panduan variasi fokus sebagai arah umum, tetapi tetap prioritaskan isi dokumen. Jangan memaksakan fokus jika tidak sesuai dengan dokumen.
6. Jenis sidang/presentasi wajib memengaruhi arah pertanyaan. Ujian Proposal fokus pada rencana penelitian; Seminar Hasil fokus pada temuan dan pembahasan; Sidang Skripsi fokus menyeluruh; Presentasi Paper fokus novelty dan kontribusi ilmiah; Presentasi Tugas Akhir fokus solusi, implementasi, dan pengujian.
7. Untuk mode santai, buat pertanyaan yang mudah dijawab secara bertahap dan bersahabat. Jangan menanyakan konsep teoretis yang rumit, overfitting, atau metrik evaluasi mendalam.
8. Jangan selalu memulai dengan frasa "Bisa Anda ceritakan..." atau "Mengapa Anda memilih...".
9. Jangan mengasumsikan penelitian ini adalah sistem/software jika dokumen tidak menyebut pengembangan sistem.
10. Mode implementasi berarti penerapan hasil atau pelaksanaan penelitian, bukan selalu implementasi aplikasi.
11. Jangan menanyakan metrik evaluasi, akurasi, precision, recall, F1-score, confusion matrix, atau machine learning jika penelitian tidak membahas model/performa/eksperimen kuantitatif.
12. DILARANG KERAS menanyakan "overfitting" atau "underfitting" kecuali penelitian ini secara spesifik melatih model machine learning/deep learning/prediktif kuantitatif. Bahkan jika bertopik ML, tanyakan overfitting maksimal satu kali dalam seluruh sesi latihan.
13. Hubungkan pertanyaan secara spesifik dengan data, objek, lokasi, variabel, informan, atau temuan konkret yang tertulis di dokumen mahasiswa.
14. Jika dokumen membahas YOLO/Computer Vision, gunakan istilah sesuai dokumen seperti YOLOv8n, CBAM, Coordinate Attention, backbone, neck, attention mechanism, mAP, inference time, fine-grained gesture, preprocessing, augmentasi, dan labeling.
15. Jangan memaksakan istilah machine learning umum apabila dokumen lebih spesifik membahas computer vision, deteksi objek, YOLO, attention mechanism, atau pengolahan citra.
16. Jangan gunakan frasa umum seperti "adil dan kredibel", "train-validation-test split", "overfitting", atau "metrik evaluasi" kecuali bagian itu memang tertulis jelas dan relevan di dokumen.
17. Pertanyaan harus mengambil konteks dari bagian spesifik dokumen, misalnya latar belakang, metode, rancangan model, dataset, preprocessing, arsitektur, hasil, pembahasan, kesimpulan, atau keterbatasan.
18. Pertanyaan harus terdengar seperti dosen penguji asli, bukan chatbot template.
19. Setiap pertanyaan cukup 1 kalimat atau maksimal 2 kalimat pendek.
20. Jangan buat pertanyaan terlalu mirip dengan daftar pertanyaan bank lokal.
21. Semua pertanyaan dalam batch harus berbeda fokus.

Output wajib JSON valid tanpa markdown, tanpa penjelasan tambahan:
{
  "questions": [
    {
      "question": "pertanyaan sidang nomor ${startIndex + 1} untuk ditampilkan di chat, gunakan istilah akademik asli",
      "speechText": "versi pertanyaan yang enak dibacakan suara dalam bahasa Indonesia natural",
      "category": "kategori singkat sesuai fokus"
    }
  ],
  "provider": "gemini"
}

Aturan speechText:
- speechText harus mempertahankan makna question, tetapi boleh menulis ulang istilah teknis agar mudah dibaca text-to-speech.
- Jangan mengubah isi akademik.
- Jangan menambahkan informasi baru.
- Untuk singkatan atau model, tulis versi pelafalan natural sesuai konteks dokumen.
- Contoh: "YOLOv8n" boleh jadi "yolo versi delapan nano"; "CBAM" boleh jadi "si bam"; "mAP@0.5:0.95" boleh jadi "em ei pi pada IoU nol koma lima sampai nol koma sembilan lima".
- Jika tidak yakin, tulis istilah apa adanya.

Jumlah item di array "questions" wajib tepat ${batchSize}.
Jangan menulis teks di luar JSON.
Jangan memakai trailing comma.
`.trim();

  const result = await callGemini(prompt, {
    temperature: 0.65,
    maxOutputTokens: 2600,
  });

  const rawQuestions = Array.isArray(result.questions) ? result.questions : [];

  const questions = rawQuestions
    .map((item: any, idx: number) => {
      const question = safeText(item?.question, "");
      return {
        index: startIndex + idx,
        question,
        speechText: safeSpeechText(item?.speechText, question),
        category: safeText(item?.category, getQuestionFocusPlan(examinerMode, startIndex + idx)),
        provider: "gemini",
        modelUsed: safeText(result.modelUsed, ""),
        quotaMode: false,
        fallbackReason: "",
      };
    })
    .filter((item: any) => item.question.length > 10)
    .slice(0, batchSize);

  if (!questions.length) {
    throw new Error("Gemini tidak mengembalikan daftar pertanyaan yang valid.");
  }

  return {
    questions,
    provider: "gemini",
    modelUsed: safeText(result.modelUsed, ""),
  };
}

export async function generateDefenseQuestionAI(payload: any) {
  const result = await generateDefenseQuestionsBatchAI({
    ...payload,
    batchSize: 1,
  });

  const first = result.questions?.[0];

  if (!first) {
    throw new Error("Gemini tidak menghasilkan pertanyaan.");
  }

  return {
    question: first.question,
    speechText: first.speechText || first.question,
    category: first.category,
    provider: "gemini",
    modelUsed: result.modelUsed,
  };
}

function normalizeForCompare(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalizeForCompare(text)
    .split(" ")
    .filter(token => token.length > 2);
}

function jaccardSimilarity(a: string, b: string) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
} function isDirectActionQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const directKeywords = [
    "perbaiki", "3 bulan", "perbaikan", "koreksi", "evaluasi", "lanjutan",
    "mendatang", "revisi", "tambahkan", "ubah", "tambah"
  ];
  return directKeywords.some(kw => q.includes(kw));
}

function hasRelevantResearchKeyword(answer: string, research: any): boolean {
  const a = answer.toLowerCase();
  const rawKeywords = [
    ...(research?.title || "").toLowerCase().split(/\s+/),
    ...(research?.method || "").toLowerCase().split(/\s+/),
    ...(research?.field || "").toLowerCase().split(/\s+/),
    ...(research?.keywords || "").toLowerCase().split(/\s+/),
    ...(research?.documentPreview || "").toLowerCase().split(/\s+/).slice(0, 400),
    ...(research?.documentText || "").toLowerCase().split(/\s+/).slice(0, 800),
    "dataset", "data", "model", "akurasi", "fitur", "metode", "algoritma", "preprocessing", "uji", "sampel", "uji coba"
  ];
  const cleanKeywords = Array.from(new Set(rawKeywords.filter(k => k.length > 3)));
  return cleanKeywords.some(kw => a.includes(kw));
}

function isShortButRelevantAnswer(question: string, answer: string, research: any): boolean {
  const answerTokenCount = tokenize(answer).length;
  if (answerTokenCount >= 1 && answerTokenCount <= 5) {
    return isDirectActionQuestion(question) && hasRelevantResearchKeyword(answer, research);
  }
  return false;
}

const COMMON_STOPWORDS = new Set([
  'yang', 'dan', 'atau', 'dengan', 'untuk', 'dari', 'pada', 'dalam', 'ini', 'itu',
  'anda', 'saya', 'kami', 'penelitian', 'bagaimana', 'mengapa', 'apa', 'apakah',
  'jika', 'secara', 'jelaskan', 'ceritakan', 'sedikit', 'bisa', 'dapat', 'akan',
  'adalah', 'karena', 'sebagai', 'terhadap', 'hasil', 'metode', 'topik'
]);

function contentTokens(text: string) {
  return tokenize(text).filter(token => !COMMON_STOPWORDS.has(token));
}

function hasQuestionContentOverlap(question: string, answer: string) {
  const qTokens = new Set(contentTokens(question));
  const aTokens = new Set(contentTokens(answer));
  if (qTokens.size === 0 || aTokens.size === 0) return false;
  for (const token of aTokens) {
    if (qTokens.has(token)) return true;
  }
  return false;
}

function isLikelyOffTopicAnswer(question: string, answer: string, research: any) {
  const answerTokenCount = tokenize(answer).length;
  if (answerTokenCount < 3) return false;
  if (isShortButRelevantAnswer(question, answer, research)) return false;
  const hasOverlap = hasQuestionContentOverlap(question, answer);
  const hasResearchSignal = hasRelevantResearchKeyword(answer, research);
  return !hasOverlap && !hasResearchSignal;
}

function looksLikeFeedbackText(answer: string) {
  const a = String(answer || "").toLowerCase();

  const signals = [
    "skor:",
    "kekuatan:",
    "perlu diperbaiki:",
    "saran:",
    "umpan balik",
    "belum ada jawaban yang dapat dinilai",
    "jawaban hanya mengulang",
  ];

  const hitCount = signals.filter(signal => a.includes(signal)).length;
  return hitCount >= 2;
}

function isMostlyCopyingQuestion(question: string, answer: string) {
  const q = normalizeForCompare(question);
  const a = normalizeForCompare(answer);

  if (!q || !a) return false;

  if (a.includes(q) || q.includes(a)) return true;

  const similarity = jaccardSimilarity(question, answer);
  return similarity >= 0.72;
}

function preEvaluateAnswerGuard(question: string, answer: string, research: any) {
  const q = normalizeForCompare(question);
  const a = normalizeForCompare(answer);
  const rawAnswer = String(answer || "").trim();
  const answerTokenCount = tokenize(a).length;
  const questionSimilarity = jaccardSimilarity(q, a);

  if (!rawAnswer || answerTokenCount === 0) {
    return {
      blocked: true,
      score: 0,
      strengths: ["Belum ada jawaban yang dapat dinilai."],
      weaknesses: ["Jawaban kosong sehingga tidak menjawab pertanyaan penguji."],
      suggestion: "Berikan jawaban singkat yang langsung menjawab inti pertanyaan, lalu tambahkan alasan atau contoh dari penelitian Anda.",
      answerCategory: "empty",
      speechText: "Skor nol. Belum ada jawaban yang dapat dinilai. Berikan jawaban singkat yang langsung menjawab inti pertanyaan."
    };
  }

  if (looksLikeFeedbackText(rawAnswer)) {
    return {
      blocked: true,
      score: 5,
      strengths: ["Jawaban tidak dapat dinilai sebagai respons akademik."],
      weaknesses: [
        "Isi yang dikirim terlihat seperti umpan balik atau evaluasi AI, bukan jawaban mahasiswa terhadap pertanyaan penguji."
      ],
      suggestion: "Jawab pertanyaan dengan kalimat Anda sendiri. Jangan mengirim ulang feedback atau hasil evaluasi sebagai jawaban.",
      answerCategory: "feedback_text",
      speechText: "Skor lima. Isi yang dikirim terlihat seperti umpan balik AI, bukan jawaban mahasiswa. Jawab pertanyaan dengan kalimat Anda sendiri."
    };
  }

  if (isMostlyCopyingQuestion(question, rawAnswer) || questionSimilarity >= 0.72 || a.includes(q) || (q.includes(a) && answerTokenCount > 6)) {
    return {
      blocked: true,
      score: 10,
      strengths: ["Jawaban masih memuat konteks pertanyaan."],
      weaknesses: [
        "Jawaban terlalu mirip dengan pertanyaan penguji sehingga belum menunjukkan pemahaman atau argumen pribadi."
      ],
      suggestion: "Jangan menyalin pertanyaan. Berikan jawaban langsung, lalu tambahkan alasan, data, atau contoh dari penelitian Anda.",
      answerCategory: "copy_question",
      speechText: "Skor sepuluh. Jawaban terlalu mirip dengan pertanyaan penguji. Berikan jawaban langsung dengan kalimat Anda sendiri."
    };
  }

  if (answerTokenCount <= 2) {
    return {
      blocked: true,
      score: 10,
      strengths: ["Belum terlihat pemahaman yang cukup dari jawaban."],
      weaknesses: ["Jawaban terlalu pendek dan belum menjelaskan inti pertanyaan."],
      suggestion: "Jawab minimal dengan satu argumen utama, alasan pendukung, dan kaitannya dengan penelitian Anda.",
      answerCategory: "very_short_non_substantive",
      speechText: "Skor sepuluh. Jawaban terlalu pendek dan belum menjelaskan inti pertanyaan."
    };
  }

  if (isShortButRelevantAnswer(question, answer, research)) {
    return {
      blocked: true,
      score: 60,
      strengths: ["Jawaban langsung menjawab sasaran pertanyaan secara spesifik."],
      weaknesses: ["Penjelasan masih terlalu singkat dan belum memuat alasan logis atau dampak dari jawaban tersebut."],
      suggestion: "Tambahkan alasan mengapa jawaban itu penting, dampaknya terhadap hasil riset, dan bagaimana penerapannya secara operasional.",
      answerCategory: "partial_relevant",
      speechText: "Skor enam puluh. Jawaban sudah relevan, tetapi masih terlalu singkat. Tambahkan alasan, dampak, dan contoh dari penelitian Anda."
    };
  }

  return {
    blocked: false,
    score: 0,
    strengths: [],
    weaknesses: [],
    suggestion: "",
    answerCategory: "",
    speechText: ""
  };
}

export async function evaluateDefenseAnswerAI(payload: any) {
  const research = payload?.research || {};
  let docText = research?.documentText;
  if (!docText && research?.docId) {
    docText = documentCache.get(research.docId);
  }
  const updatedResearch = { ...research, documentText: docText };

  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const question = safeText(payload?.question);
  const answer = safeText(payload?.answer);

  const guarded = preEvaluateAnswerGuard(question, answer, updatedResearch);
  if (guarded.blocked) {
    return {
      score: guarded.score,
      strengths: guarded.strengths,
      weaknesses: guarded.weaknesses,
      suggestion: guarded.suggestion,
      answerCategory: guarded.answerCategory,
      speechText: guarded.speechText,
      normalizedAnswer: answer,
      provider: "rule-guard"
    };
  }

  const researchContext = buildResearchContext(updatedResearch);

  const prompt = `
Anda adalah dosen penguji akademik berbahasa Indonesia.

Tugas:
Nilai jawaban mahasiswa terhadap pertanyaan sidang yang sedang aktif secara jujur dan objektif.

${researchContext}

Mode penguji:
${examinerMode} — ${normalizeQuestionMode(examinerMode)}

Pertanyaan yang sedang dinilai:
${question}

Jawaban mahasiswa:
${answer}

CATATAN PENTING TENTANG JAWABAN VOICE / SPEECH-TO-TEXT:
Jawaban mahasiswa dapat berasal dari speech-to-text dan mungkin mengandung salah transkripsi, terutama pada istilah akademik, singkatan, nama model, angka, atau istilah campuran Indonesia-Inggris.

Sebelum memberi skor, rekonstruksi dulu maksud jawaban mahasiswa berdasarkan:
1. pertanyaan penguji,
2. konteks dokumen/penelitian,
3. isi jawaban hasil transkripsi.

Jangan langsung menghukum kesalahan kata jika makna akademiknya masih dapat dipahami dari konteks.
Contoh: jika pertanyaan membahas "fine-grained" dan transkrip menulis "point green", pahami sebagai kemungkinan salah transkripsi dari "fine-grained".
Contoh: jika jawaban memuat frasa "seseorang tidak bisa meminta bantuan secara verbal", itu BUKAN penolakan menjawab, melainkan konteks masalah penelitian.
Kategori "refusal" hanya boleh dipakai jika mahasiswa benar-benar menolak menjawab, bercanda tanpa substansi, atau mengatakan tidak tahu tanpa penjelasan akademik.

RUBRIK KATEGORI JAWABAN:
Klasifikasikan jawaban mahasiswa ke salah satu answerCategory berikut:
- "empty": kosong atau tidak ada jawaban.
- "copy_question": jawaban hanya menyalin/mengulang pertanyaan.
- "feedback_text": jawaban berisi feedback/evaluasi AI, bukan jawaban mahasiswa.
- "refusal": mahasiswa menolak menjawab, menyerah, mengatakan tidak tahu, atau bercanda tanpa substansi.
- "off_topic": jawaban tidak berhubungan dengan pertanyaan.
- "very_short_non_substantive": sangat pendek dan tidak memiliki alasan.
- "partial_relevant_informal": ada bagian yang relevan, tetapi alasan terlalu informal/personal dan belum akademik.
- "partial_relevant": relevan sebagian, tetapi masih umum atau belum berbukti.
- "adequate": menjawab inti dengan cukup baik, tetapi belum sangat spesifik.
- "strong": baik, jelas, relevan, dan memakai detail penelitian.
- "excellent": sangat kuat, spesifik, kritis, dan memakai data/metode/hasil secara tepat.

ATURAN PENILAIAN:
1. Nilai fungsi jawaban, bukan sekadar kata kunci.
2. Jangan menghukum 0 jika jawaban masih menjawab sebagian inti pertanyaan.
3. Jawaban bercanda/menyerah/tidak tahu masuk "refusal" dengan skor 0-15.
4. Jawaban yang relevan sebagian tetapi memakai alasan informal seperti alasan deadline, belum sempat, atau alasan personal masuk "partial_relevant_informal" dengan skor 35-55.
5. Jawaban yang menyebut alasan akademik tetapi masih umum masuk "partial_relevant" dengan skor 45-65.
6. Skor 70 ke atas hanya jika jawaban benar-benar menjawab inti, punya alasan, dan relevan dengan konteks penelitian.
7. Skor 80 ke atas hanya jika jawaban spesifik, runtut, menyebut detail penelitian, dan tidak sekadar kata kunci umum.
8. strengths tidak boleh memuji hal yang tidak ada pada jawaban.
9. weaknesses harus menjelaskan masalah spesifik dari jawaban terakhir.
10. suggestion harus memberi arahan konkret bagaimana memperbaiki jawaban itu.
11. Buat speechText sebagai versi ringkas feedback yang enak dibacakan suara. Jangan terlalu panjang. Jangan mengubah skor.

Output wajib JSON valid:
{
  "normalizedAnswer": "rekonstruksi maksud jawaban mahasiswa dalam bahasa Indonesia yang rapi, tanpa mengubah substansi",
  "answerCategory": "partial_relevant_informal",
  "score": 45,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestion": "...",
  "speechText": "Skor empat puluh lima. Jawaban sudah menyentuh sebagian inti pertanyaan, tetapi alasannya belum akademik...",
  "provider": "gemini"
}
`.trim();

  const result = await callGemini(prompt);

  const answerCategory = safeText(result.answerCategory, "partial_relevant");
  let score = Math.max(0, Math.min(100, Number(result.score) || 0));
  score = clampScoreByCategory(score, answerCategory);

  const strengths = Array.isArray(result.strengths)
    ? result.strengths.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  const weaknesses = Array.isArray(result.weaknesses)
    ? result.weaknesses.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  const suggestion = safeText(result.suggestion, "Pertahankan struktur jawaban dan sesuaikan dengan inti pertanyaan.");
  const normalizedAnswer = safeSpeechText(result.normalizedAnswer, answer);

  const defaultSpeech = buildFallbackSpeechText(
    `Skor ${score}. ${suggestion}`
  );

  return {
    score,
    answerCategory,
    normalizedAnswer,
    strengths: strengths.length ? strengths : ["Belum terlihat kekuatan yang signifikan dari jawaban ini."],
    weaknesses: weaknesses.length ? weaknesses : ["Tidak ada."],
    suggestion,
    speechText: safeSpeechText(result.speechText, defaultSpeech),
    provider: "gemini",
  };
}

export async function generateFinalEvaluationAI(payload: any) {
  const research = payload?.research || {};
  let docText = research?.documentText;
  if (!docText && research?.docId) {
    docText = documentCache.get(research.docId);
  }
  const updatedResearch = { ...research, documentText: docText };

  const examinerMode = payload?.examinerMode || research.examinerMode || "kritis";
  const transcript = Array.isArray(payload?.transcript) ? payload.transcript : [];

  const researchContext = buildResearchContext(updatedResearch);

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