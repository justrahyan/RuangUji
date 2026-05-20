import type { ResearchProfile, AnswerEvaluation, DefenseSession } from '../types';

// Helpers
function hasQuantitativeSignals(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  const keywords = ['akurasi', 'evaluasi', 'dataset', 'kuantitatif', 'statistik', 'validasi', 'uji', 'eksperimen', 'data', 'model', 'metrik', 'pengukuran', 'signifikansi'];
  return keywords.some(kw => text.includes(kw));
}

function hasSystemSignals(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  const keywords = ['sistem', 'aplikasi', 'pakar', 'rule', 'inferensi', 'algoritma', 'basis pengetahuan', 'arsitektur', 'platform', 'pengembangan', 'prototype'];
  return keywords.some(kw => text.includes(kw));
}

function hasQualitativeSignals(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  const keywords = ['kualitatif', 'wawancara', 'informan', 'triangulasi', 'etnografi', 'studi kasus', 'observasi', 'sosial', 'persepsi', 'fenomena'];
  return keywords.some(kw => text.includes(kw));
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function isSimilarQuestion(a: string, b: string): boolean {
  const wordsA = new Set(normalizeText(a).split(' '));
  const wordsB = new Set(normalizeText(b).split(' '));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size > 0.6;
}

function isSystemPakar(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  return text.includes('pakar') || text.includes('certainty') || text.includes('chaining') || text.includes('forward') || text.includes('backward') || text.includes('expert') || text.includes('rule') || text.includes('gejala') || text.includes('diagnosa');
}

function isMachineLearning(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  return text.includes('learning') || text.includes('machine') || text.includes('deep') || text.includes('classification') || text.includes('regresi') || text.includes('regression') || text.includes('cnn') || text.includes('svm') || text.includes('random forest') || text.includes('klasifikasi') || text.includes('akurasi') || text.includes('f1') || text.includes('lasso');
}

function isSocialEducationHealth(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  const keywords = ['sosial', 'pendidikan', 'kesehatan', 'belajar', 'siswa', 'guru', 'pasien', 'medis', 'perilaku', 'masyarakat', 'hukum', 'bisnis', 'ekonomi', 'kualitatif', 'kuisioner', 'angket', 'responden', 'wawancara'];
  return keywords.some(kw => text.includes(kw));
}

function mentionsMetric(research: ResearchProfile): boolean {
  const text = (research.title + ' ' + research.method + ' ' + (research.abstract || '')).toLowerCase();
  const metrics = ['akurasi', 'accuracy', 'f1', 'precision', 'recall', 'confusion matrix', 'error', 'mse', 'rmse', 'mae', 'mape', 'r2', 'auc', 'roc'];
  return metrics.some(m => text.includes(m));
}

export function generateQuestion(
  research: ResearchProfile,
  examinerMode: string,
  questionIndex: number,
  previousQuestions: string[] = []
): string {
  const { title, method, field, concern } = research;

  const isQuant = hasQuantitativeSignals(research);
  const isQual = hasQualitativeSignals(research);
  const isSys = hasSystemSignals(research);

  // Dynamic contextual questions based on keywords
  const specificQuestions: { category: string; q: string }[] = [];
  
  if (isSystemPakar(research)) {
    specificQuestions.push(
      { category: 'metode', q: `Bagaimana Anda menyusun basis pengetahuan (knowledge base) untuk sistem pakar Anda? Siapa pakar yang memvalidasi rule tersebut?` },
      { category: 'metode', q: `Mengapa Anda memilih menggunakan metode ${method} dibandingkan logika fuzzy atau pohon keputusan biasa?` },
      { category: 'validitas', q: `Bagaimana Anda menangani konflik nilai atau ambiguitas ketika beberapa aturan (rule) dalam sistem pakar Anda aktif secara bersamaan?` },
      { category: 'implementasi', q: `Apa batasan utama dari sistem pakar Anda ini jika diterapkan langsung oleh pengguna awam tanpa didampingi pakar aslinya?` },
      { category: 'latar_belakang', q: `Mengapa masalah pendeteksian ini memerlukan solusi berbasis sistem pakar, bukan sekadar panduan manual?` }
    );
  } else if (isMachineLearning(research)) {
    specificQuestions.push(
      { category: 'validitas', q: `Bagaimana Anda membagi dataset (train, validation, test split) untuk memastikan model ${method} Anda terhindar dari overfitting?` },
      ...(mentionsMetric(research) ? [
        { category: 'validitas', q: `Mengapa Anda memilih metrik evaluasi tersebut (seperti akurasi, F1-score, atau precision) untuk mengukur performa model Anda?` }
      ] : []),
      { category: 'metode', q: `Apa alasan ilmiah Anda memilih algoritma ${method} dibandingkan arsitektur atau pendekatan alternatif lainnya?` },
      { category: 'implementasi', q: `Bagaimana performa model Anda jika dihadapkan pada data baru di dunia nyata yang memiliki distribusi berbeda dari dataset training Anda?` }
    );
  } else if (isSocialEducationHealth(research)) {
    specificQuestions.push(
      { category: 'validitas', q: `Bagaimana Anda menentukan jumlah dan karakteristik responden/partisipan untuk memastikan hasil penelitian ini valid dan representatif?` },
      { category: 'validitas', q: `Bagaimana Anda menguji validitas dan reliabilitas instrumen (angket/wawancara) yang Anda gunakan dalam pengumpulan data?` },
      { category: 'metode', q: `Mengapa pendekatan penelitian kualitatif/kuantitatif dengan ${method} dirasa paling tepat untuk mengeksplorasi fenomena ini?` },
      { category: 'implementasi', q: `Bagaimana hasil temuan Anda ini dapat memberikan rekomendasi praktis atau implikasi kebijakan nyata bagi subjek penelitian?` }
    );
  }

  const bank: { category: string, q: string }[] = [
    ...specificQuestions,
    // Latar Belakang & Urgensi
    { category: 'latar_belakang', q: `Mengapa topik mengenai ${field || 'bidang ini'} menjadi prioritas untuk diteliti saat ini?` },
    { category: 'latar_belakang', q: `Apa fenomena utama yang memicu Anda melakukan penelitian dengan judul "${title}" ini?` },
    { category: 'latar_belakang', q: `Jelaskan secara singkat namun meyakinkan, mengapa masalah ini mendesak untuk diselesaikan?` },
    { category: 'latar_belakang', q: `Banyak penelitian serupa, apa yang membuat kasus Anda spesifik dan layak diangkat menjadi skripsi?` },
    { category: 'latar_belakang', q: `Bagaimana Anda mendefinisikan ruang lingkup masalah agar penelitian ini tidak terlalu meluas?` },
    
    // Novelty / Kontribusi
    { category: 'novelty', q: `Apa perbedaan paling mendasar antara penelitian Anda dengan penelitian sebelumnya di bidang ini?` },
    { category: 'novelty', q: `Apa nilai tambah (novelty) yang benar-benar baru dari solusi yang Anda tawarkan?` },
    { category: 'novelty', q: `Apakah metode ${method} yang Anda gunakan memberikan keuntungan khusus dibandingkan metode konvensional?` },
    { category: 'novelty', q: `Siapa yang akan paling diuntungkan dari hasil penelitian Anda ini secara praktis?` },
    { category: 'novelty', q: `Bagaimana penelitian ini dapat berkontribusi pada pengembangan teori di bidang ${field || 'keilmuan Anda'}?` },

    // Metode
    { category: 'metode', q: `Mengapa Anda secara spesifik memilih pendekatan ${method} untuk memecahkan masalah ini?` },
    { category: 'metode', q: `Apakah Anda sempat mempertimbangkan alternatif selain ${method}? Mengapa akhirnya ditolak?` },
    { category: 'metode', q: `Bagaimana tahapan operasional dari ${method} ini dilakukan dalam konteks penelitian Anda?` },
    { category: 'metode', q: `Apa kelemahan terbesar dari penggunaan ${method} yang Anda sadari sejak awal?` },
    { category: 'metode', q: `Jelaskan bagaimana Anda merancang prosedur pengumpulan data agar terhindar dari bias.` },

    // Validitas & Bukti
    ...(isQuant ? [
      ...(mentionsMetric(research) ? [
        { category: 'validitas', q: `Metrik evaluasi apa saja yang Anda gunakan untuk mengukur keberhasilan, dan mengapa memilih metrik tersebut?` }
      ] : []),
      { category: 'validitas', q: `Bagaimana Anda memastikan dataset yang digunakan representatif dan bebas dari noise?` },
      { category: 'validitas', q: `Apakah hasil yang Anda peroleh signifikan secara statistik? Bagaimana Anda mengujinya?` },
      { category: 'validitas', q: `Bagaimana Anda menangani outlier atau anomali data selama proses eksperimen?` }
    ] : isQual ? [
      { category: 'validitas', q: `Bagaimana cara Anda memvalidasi data kualitatif ini? Apakah menggunakan triangulasi?` },
      { category: 'validitas', q: `Bagaimana Anda memastikan bahwa interpretasi Anda terhadap informan bersifat objektif?` },
      { category: 'validitas', q: `Apa teknik pengumpulan data utama Anda dan mengapa itu yang paling tepat untuk masalah ini?` }
    ] : [
      { category: 'validitas', q: `Bagaimana Anda memastikan data atau bukti yang digunakan cukup kuat untuk mendukung kesimpulan?` },
      { category: 'validitas', q: `Apa dasar pembuktian yang Anda gunakan untuk menunjukkan bahwa solusi ini memang dibutuhkan?` },
      { category: 'validitas', q: `Bagaimana Anda memvalidasi hasil penelitian tanpa bergantung hanya pada klaim pribadi?` }
    ]),

    // Implementasi & Sistem (jika sistem/produk)
    ...(isSys ? [
      { category: 'implementasi', q: `Bagaimana arsitektur sistem ini dibangun agar dapat berjalan secara optimal?` },
      { category: 'implementasi', q: `Bagaimana Anda memastikan sistem ini ramah pengguna dan sesuai dengan kebutuhan target user?` },
      { category: 'implementasi', q: `Jika sistem ini diimplementasikan di dunia nyata, kendala teknis apa yang paling mungkin terjadi?` },
      { category: 'implementasi', q: `Bagaimana aturan (rule) atau basis pengetahuan dalam sistem ini disusun dan divalidasi oleh pakar?` }
    ] : [
      { category: 'implementasi', q: `Bagaimana rekomendasi praktis dari penelitian ini dapat diterapkan oleh pemangku kepentingan?` },
      { category: 'implementasi', q: `Tantangan apa yang mungkin dihadapi saat pihak lain mencoba menerapkan hasil penelitian Anda?` }
    ]),

    // Batasan
    { category: 'batasan', q: `Secara jujur, apa kelemahan atau batasan paling krusial dari penelitian Anda saat ini?` },
    { category: 'batasan', q: `Kondisi atau asumsi apa yang harus dipenuhi agar hasil penelitian ini tetap relevan?` },
    { category: 'batasan', q: `Jika Anda diberi waktu 3 bulan lagi, apa satu hal yang ingin Anda perbaiki dari penelitian ini?` },

    // Jebakan Sidang
    { category: 'jebakan', q: `Apakah Anda yakin judul penelitian Anda sudah merepresentasikan isi keseluruhan skripsi?` },
    { category: 'jebakan', q: `Jika penguji menilai metode ${method} Anda usang, argumen logis apa yang Anda siapkan?` },
    { category: 'jebakan', q: `Apakah masalah yang Anda teliti ini sebenarnya bukan masalah yang nyata (pseudo-problem)?` },
    
    // Concern / Kekhawatiran
    ...(concern ? [
      { category: 'concern', q: `Mengenai "${concern}" yang menjadi kekhawatiran Anda, bagaimana Anda berencana memitigasinya saat implementasi nyata?` },
      { category: 'concern', q: `Jika masalah "${concern}" benar-benar terjadi, apakah itu akan menggugurkan kesimpulan penelitian Anda?` }
    ] : [])
  ];

  // Pick question based on examiner mode priority
  let preferredCategories: string[] = [];
  if (examinerMode === 'metodologi') preferredCategories = ['metode', 'latar_belakang'];
  else if (examinerMode === 'statistik') preferredCategories = ['validitas'];
  else if (examinerMode === 'novelty') preferredCategories = ['novelty', 'latar_belakang'];
  else if (examinerMode === 'implementasi') preferredCategories = ['implementasi', 'metode'];
  else if (examinerMode === 'kritis' || examinerMode === 'killer') preferredCategories = ['validitas', 'jebakan', 'batasan'];
  else preferredCategories = ['latar_belakang', 'novelty', 'metode', 'validitas', 'implementasi', 'batasan']; // santai / umum

  // Filter available questions
  let available = bank.filter(q => !previousQuestions.some(pq => isSimilarQuestion(pq, q.q)));
  if (available.length === 0) available = bank; // fallback if all exhausted

  // Prioritize category
  let candidates = available.filter(q => preferredCategories.includes(q.category));
  if (candidates.length === 0) candidates = available;

  // Pick one randomly or by index logic
  const selected = candidates[questionIndex % candidates.length].q;

  // Formatting based on mode
  let finalQuestion = selected;
  if (examinerMode === 'kritis') {
    finalQuestion = `Secara objektif, ${finalQuestion}`;
  } else if (examinerMode === 'killer') {
    finalQuestion = `Jawab dengan singkat dan padat: ${finalQuestion}`;
  } else if (examinerMode === 'santai') {
    finalQuestion = `Bisa Anda ceritakan sedikit, ${finalQuestion.charAt(0).toLowerCase() + finalQuestion.slice(1)}`;
  }

  return finalQuestion;
}

// Evaluation Helpers
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['yang', 'dan', 'di', 'dari', 'ke', 'ini', 'itu', 'untuk', 'dengan', 'pada', 'adalah', 'sebagai']);
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return new Set(words.filter(w => w.length > 3 && !stopWords.has(w)));
}

function repetitionRatio(text: string): number {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  if (words.length < 10) return 0;
  
  const uniqueWords = new Set(words);
  return 1 - (uniqueWords.size / words.length);
}

function removeRepeatedPhrases(text: string): string {
  let clean = text;
  clean = clean.replace(/\b(\w+(?:\s+\w+){1,3})\s+\1\b/gi, '$1');
  return clean;
}

export function evaluateAnswer(
  question: string, 
  answer: string, 
  research: ResearchProfile, 
  examinerMode: string
): AnswerEvaluation {
  const trimmed = answer.trim();
  if (!trimmed) {
    return {
      score: 0,
      strengths: [],
      weaknesses: ['Jawaban kosong. Anda harus memberikan jawaban tertulis.'],
      suggestion: 'Silakan ketik atau diktekan jawaban Anda sebelum mengirim.'
    };
  }

  const cleanAnswer = removeRepeatedPhrases(trimmed);
  const answerLower = cleanAnswer.toLowerCase();
  const wordCount = cleanAnswer.split(/\s+/).length;
  const repRatio = repetitionRatio(cleanAnswer);
  
  let score = 60; // baseline
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Short answers
  if (wordCount < 10) {
    score = 40 + Math.min(15, wordCount);
    weaknesses.push('Jawaban terlalu singkat. Berikan penjelasan yang lebih mendalam dan spesifik.');
  } else {
    // Length is decent
    if (repRatio > 0.4) {
      score = 50 + Math.floor(Math.random() * 10);
      weaknesses.push('Jawaban terdeteksi repetitif atau berputar-putar. Cobalah lebih to-the-point.');
    } else {
      score = 70;
      strengths.push('Panjang jawaban cukup memadai untuk menjelaskan argumen Anda.');
    }
  }

  // Concept checks (method, field, etc.)
  const methodTerms = research.method.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const hasMethodTerm = methodTerms.some(term => answerLower.includes(term));
  
  if (hasMethodTerm) {
    score += 8;
    strengths.push(`Anda mengaitkan jawaban dengan metode penelitian Anda (${research.method}).`);
  }

  // Reasoning checks
  const reasoningKeywords = ['karena', 'alasan', 'sebab', 'sehingga', 'maka', 'oleh karena itu', 'dikarenakan'];
  const hasReasoning = reasoningKeywords.some(kw => answerLower.includes(kw));
  if (hasReasoning) {
    score += 7;
    strengths.push('Anda menggunakan argumentasi sebab-akibat atau alasan logis.');
  }

  // Specificity / Relevance similarity with question
  const qKeywords = extractKeywords(question);
  const aKeywords = extractKeywords(cleanAnswer);
  let matchCount = 0;
  qKeywords.forEach(kw => { if (aKeywords.has(kw)) matchCount++; });
  
  if (qKeywords.size > 0 && matchCount === 0) {
    score -= 15;
    weaknesses.push('Jawaban kurang relevan dengan konteks pertanyaan penguji.');
  } else if (matchCount > 1) {
    score += 5;
    strengths.push('Menjawab kata kunci yang ditanyakan oleh penguji.');
  }

  // Mode styling adjustments
  if (examinerMode === 'kritis' || examinerMode === 'killer') {
    score -= 5;
  }

  // Set score bounds based on user requirement:
  if (wordCount < 10) {
    score = Math.max(40, Math.min(55, score));
  } else if (repRatio > 0.4) {
    score = Math.max(50, Math.min(65, score));
  } else if (hasMethodTerm && hasReasoning && matchCount > 0) {
    score = Math.max(75, Math.min(90, score));
  } else {
    score = Math.max(60, Math.min(75, score));
  }

  // Guard: Jika answerText panjang > 30 kata, jangan pernah beri 0
  if (wordCount > 30 && score < 40) {
    score = 65;
  }

  score = Math.min(Math.max(Math.round(score), 0), 100);

  const suggestion = score >= 75 
    ? 'Pertahankan ketenangan dan struktur argumen Anda, sudah sangat baik.'
    : 'Cobalah menjawab dengan menyertakan alasan pemilihan metode secara langsung dan to-the-point.';

  return {
    score,
    strengths,
    weaknesses,
    suggestion
  };
}

export function generateFinalEvaluation(session: DefenseSession): any {
  const totalScore = session.transcript
    .filter(t => t.type === 'feedback' && typeof t.score === 'number')
    .reduce((acc, t) => acc + (t.score || 0), 0);
  
  const feedbackCount = session.transcript.filter(t => t.type === 'feedback' && typeof t.score === 'number').length;
  let averageScore = feedbackCount > 0 ? Math.round(totalScore / feedbackCount) : 0;
  
  const answerCount = session.transcript.filter(t => t.type === 'answer').length;
  if (averageScore === 0 && answerCount > 0) {
    averageScore = 50;
  }
  averageScore = Math.max(0, Math.min(100, averageScore));

  const strengths = averageScore >= 70 ? ['Mampu merespons pertanyaan dengan percaya diri', 'Memahami konteks umum penelitian'] : ['Mampu bertahan hingga akhir sesi'];
  const weaknesses = averageScore < 70 ? ['Sering memberikan jawaban yang berputar-putar atau terlalu singkat', 'Argumen metodologi kurang kuat'] : ['Beberapa detail teknis masih bisa diperdalam'];
  const nextPractice = ['Latih menjawab pertanyaan yang tidak terduga', 'Perbanyak simulasi dengan mode Killer atau Kritis'];

  let summary = 'Kesiapan Anda masih kurang. Perbanyak latihan dan baca kembali landasan teori.';
  if (averageScore >= 80) summary = 'Kesiapan Anda sangat baik! Anda sudah menguasai alur penelitian Anda.';
  else if (averageScore >= 60) summary = 'Kesiapan Anda cukup baik, namun masih ada ruang untuk perbaikan dalam menyusun argumen.';

  return {
    score: averageScore,
    summary,
    strengths,
    weaknesses,
    nextPractice
  };
}
