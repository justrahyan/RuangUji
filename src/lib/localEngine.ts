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

function cleanKeyword(value = '') {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getContextText(research: ResearchProfile) {
  return [
    research.title,
    research.field,
    research.keywords,
    research.researchApproach,
    research.method,
    research.abstract,
    research.concern,
    research.documentPreview,
    research.documentText,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContextKeywords(research: ResearchProfile, limit = 8) {
  const text = cleanKeyword(getContextText(research)).toLowerCase();

  const stopWords = new Set([
    'yang', 'dan', 'atau', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'adalah',
    'sebagai', 'oleh', 'ini', 'itu', 'ke', 'di', 'the', 'and', 'of', 'to', 'in',
    'penelitian', 'metode', 'hasil', 'data', 'analisis', 'menggunakan',
  ]);

  const words = text.match(/\b[\p{L}\p{N}-]{4,}\b/gu) || [];
  const freq = new Map<string, number>();

  words.forEach((word) => {
    if (stopWords.has(word)) return;
    freq.set(word, (freq.get(word) || 0) + 1);
  });

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, limit);
}

function hasExplicitMLContext(research: ResearchProfile) {
  const text = getContextText(research).toLowerCase();
  return [
    'machine learning', 'deep learning', 'cnn', 'svm', 'random forest',
    'akurasi', 'accuracy', 'precision', 'recall', 'f1-score', 'f1 score',
    'confusion matrix', 'overfitting', 'underfitting', 'training', 'validation',
    'dataset', 'klasifikasi', 'regresi', 'yolo', 'model prediksi',
  ].some((term) => text.includes(term));
}

function hasExplicitStatisticsContext(research: ResearchProfile) {
  const text = getContextText(research).toLowerCase();
  return [
    'kuantitatif', 'statistik', 'uji t', 'anova', 'regresi', 'korelasi',
    'validitas', 'reliabilitas', 'sampel', 'responden', 'signifikansi',
    'p-value', 'instrumen', 'angket', 'kuesioner',
  ].some((term) => text.includes(term));
}

function modeLead(examinerMode: string) {
  const mode = String(examinerMode || '').toLowerCase();

  if (mode === 'santai') return 'Secara sederhana,';
  if (mode === 'killer') return 'Jika diuji secara ketat,';
  if (mode === 'metodologi') return 'Dari sisi metodologi,';
  if (mode === 'statistik') return 'Dari sisi pembuktian data,';
  if (mode === 'novelty') return 'Dari sisi kebaruan,';
  if (mode === 'implementasi') return 'Dari sisi penerapan,';
  return 'Secara kritis,';
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

function getSessionTypeTemplateQuestions(
  research: ResearchProfile,
  lead: string,
  field: string,
  method: string,
  title: string,
  mainKeyword: string,
  secondKeyword: string
) {
  const sessionType = normalizeSessionType(research.sessionType);

  const templates: Record<string, { category: string; question: string }[]> = {
    proposal: [
      {
        category: 'proposal_latar_belakang',
        question: `${lead} mengapa topik "${title}" layak diajukan sebagai proposal penelitian pada konteks ${field}?`,
      },
      {
        category: 'proposal_gap',
        question: `${lead} gap atau celah penelitian apa yang ingin Anda isi melalui penelitian ini?`,
      },
      {
        category: 'proposal_rumusan_masalah',
        question: `${lead} bagaimana rumusan masalah dan tujuan penelitian Anda saling terhubung secara logis?`,
      },
      {
        category: 'proposal_metode',
        question: `${lead} mengapa ${method} sudah tepat untuk rencana penelitian ini, dan apa risiko metodologis yang perlu Anda antisipasi?`,
      },
      {
        category: 'proposal_validasi',
        question: `${lead} bagaimana rencana Anda memastikan data atau temuan yang nanti diperoleh dapat dipercaya?`,
      },
    ],

    seminar_hasil: [
      {
        category: 'hasil_temuan',
        question: `${lead} apa temuan utama dari penelitian "${title}" dan bagaimana temuan itu menjawab rumusan masalah?`,
      },
      {
        category: 'hasil_pembahasan',
        question: `${lead} bagaimana Anda menghubungkan hasil penelitian dengan teori atau penelitian terdahulu yang relevan?`,
      },
      {
        category: 'hasil_validitas',
        question: `${lead} bukti apa yang paling kuat untuk menunjukkan bahwa hasil penelitian Anda dapat dipertanggungjawabkan?`,
      },
      {
        category: 'hasil_keterbatasan',
        question: `${lead} apa keterbatasan paling penting dari hasil penelitian ini, dan bagaimana dampaknya terhadap kesimpulan?`,
      },
      {
        category: 'hasil_implikasi',
        question: `${lead} apa implikasi utama dari hasil penelitian Anda bagi konteks ${field}?`,
      },
    ],

    sidang_skripsi: [
      {
        category: 'skripsi_konsistensi',
        question: `${lead} bagaimana Anda memastikan latar belakang, rumusan masalah, metode, dan hasil penelitian ini sudah saling konsisten?`,
      },
      {
        category: 'skripsi_metode',
        question: `${lead} mengapa ${method} menjadi pilihan yang paling dapat dipertanggungjawabkan dibanding alternatif lain?`,
      },
      {
        category: 'skripsi_validitas',
        question: `${lead} bagian mana dari data atau hasil penelitian yang paling kuat mendukung kesimpulan Anda?`,
      },
      {
        category: 'skripsi_kontribusi',
        question: `${lead} apa kontribusi utama penelitian "${title}" bagi bidang ${field}?`,
      },
      {
        category: 'skripsi_pengembangan',
        question: `${lead} jika penelitian ini dikembangkan lagi, bagian mana yang paling perlu diperbaiki atau diperluas?`,
      },
    ],

    presentasi_paper: [
      {
        category: 'paper_novelty',
        question: `${lead} apa novelty atau kebaruan utama dari paper Anda dibanding penelitian sebelumnya?`,
      },
      {
        category: 'paper_gap',
        question: `${lead} gap penelitian apa yang paling jelas dijawab oleh paper ini?`,
      },
      {
        category: 'paper_kontribusi',
        question: `${lead} apa kontribusi ilmiah paling kuat dari penelitian ini, bukan hanya kontribusi praktisnya?`,
      },
      {
        category: 'paper_pembanding',
        question: `${lead} bagaimana posisi pendekatan Anda dibanding metode atau studi terdahulu yang relevan?`,
      },
      {
        category: 'paper_klaim',
        question: `${lead} bukti apa yang paling kuat untuk mendukung klaim utama dalam paper Anda?`,
      },
    ],

    presentasi_tugas_akhir: [
      {
        category: 'ta_masalah',
        question: `${lead} masalah utama apa yang diselesaikan dalam tugas akhir ini, dan mengapa solusi tersebut dibutuhkan?`,
      },
      {
        category: 'ta_solusi',
        question: `${lead} bagaimana ${method} membantu membentuk solusi atau alur pengerjaan tugas akhir Anda?`,
      },
      {
        category: 'ta_implementasi',
        question: `${lead} bagaimana tahapan implementasi atau pelaksanaan penelitian ini dilakukan dari awal sampai akhir?`,
      },
      {
        category: 'ta_pengujian',
        question: `${lead} bagaimana Anda menguji bahwa solusi atau hasil tugas akhir ini benar-benar bekerja sesuai tujuan?`,
      },
      {
        category: 'ta_manfaat',
        question: `${lead} siapa pihak yang paling merasakan manfaat dari tugas akhir ini, dan dalam bentuk apa manfaatnya?`,
      },
    ],

    lainnya: [
      {
        category: 'umum_konteks',
        question: `${lead} bagaimana fokus "${mainKeyword}" berperan penting dalam penelitian Anda?`,
      },
      {
        category: 'umum_metode',
        question: `${lead} bagaimana hubungan antara "${mainKeyword}" dan "${secondKeyword}" dalam membentuk arah penelitian Anda?`,
      },
    ],
  };

  return templates[sessionType] || templates.lainnya;
}

function contextualTemplateBank(research: ResearchProfile, examinerMode: string) {
  const field = research.field?.trim() || 'bidang penelitian Anda';
  const method = research.method?.trim() || 'metode yang digunakan';
  const title = research.title?.trim() || 'penelitian Anda';
  const keywords = extractContextKeywords(research, 5);
  const mainKeyword = keywords[0] || field;
  const secondKeyword = keywords[1] || method;
  const lead = modeLead(examinerMode);

  const sessionTemplates = getSessionTypeTemplateQuestions(
    research,
    lead,
    field,
    method,
    title,
    mainKeyword,
    secondKeyword
  );

  const general = [
    ...sessionTemplates,
    {
      category: 'latar_belakang',
      question: `${lead} apa masalah utama yang ingin diselesaikan dalam penelitian "${title}", dan mengapa masalah tersebut penting pada konteks ${field}?`,
    },
    {
      category: 'metode',
      question: `${lead} bagaimana ${method} membantu menjawab tujuan penelitian Anda, bukan hanya menjadi pilihan teknis semata?`,
    },
    {
      category: 'validitas',
      question: `${lead} bukti apa yang paling kuat dari penelitian Anda untuk menunjukkan bahwa kesimpulan yang diambil memang dapat dipertanggungjawabkan?`,
    },
    {
      category: 'hasil',
      question: `${lead} bagian mana dari hasil atau temuan penelitian yang paling mendukung argumen utama Anda?`,
    },
    {
      category: 'batasan',
      question: `${lead} apa keterbatasan utama penelitian ini jika diterapkan pada kondisi, subjek, atau konteks yang berbeda?`,
    },
    {
      category: 'kontribusi',
      question: `${lead} apa kontribusi utama penelitian Anda dibandingkan penelitian, pendekatan, atau praktik yang sudah ada sebelumnya?`,
    },
    {
      category: 'konteks_dokumen',
      question: `${lead} dalam dokumen Anda terdapat fokus pada "${mainKeyword}". Mengapa bagian itu penting untuk menjawab rumusan masalah atau tujuan penelitian?`,
    },
    {
      category: 'hubungan_konsep',
      question: `${lead} bagaimana hubungan antara "${mainKeyword}" dan "${secondKeyword}" dalam membentuk arah penelitian Anda?`,
    },
  ];

  if (examinerMode === 'statistik' && hasExplicitStatisticsContext(research)) {
    general.push({
      category: 'statistik',
      question: `Bagaimana Anda memastikan data, sampel, instrumen, atau hasil analisis yang digunakan sudah cukup kuat untuk mendukung kesimpulan penelitian?`,
    });
  }

  if (examinerMode === 'statistik' && !hasExplicitStatisticsContext(research)) {
    general.push({
      category: 'validitas',
      question: `Karena penelitian ini tidak tampak berfokus pada statistik formal, bagaimana Anda menjelaskan kekuatan bukti atau temuan yang digunakan untuk mendukung kesimpulan?`,
    });
  }

  if (hasExplicitMLContext(research)) {
    general.push({
      category: 'model',
      question: `Dalam konteks model atau eksperimen yang Anda gunakan, bagaimana Anda memastikan hasil penelitian tidak hanya baik pada data yang digunakan, tetapi juga masuk akal untuk data atau kondisi baru?`,
    });
  }

  return general;
}

export function generateContextualQuestionBatch(params: {
  research: ResearchProfile;
  examinerMode: string;
  questionIndex: number;
  batchSize: number;
  previousQuestions?: string[];
  fallbackReason?: string;
}) {
  const {
    research,
    examinerMode,
    questionIndex,
    batchSize,
    previousQuestions = [],
    fallbackReason = 'Kuota AI sedang penuh atau model Gemini gagal digunakan.',
  } = params;

  const bank = contextualTemplateBank(research, examinerMode);
  const previous = previousQuestions.map((q) => normalizeText(q));

  const selected: {
    index: number;
    question: string;
    speechText: string;
    category: string;
    provider: string;
    quotaMode: boolean;
    fallbackReason: string;
  }[] = [];

  let cursor = questionIndex;

  while (selected.length < batchSize && cursor < questionIndex + bank.length + batchSize) {
    const candidate = bank[cursor % bank.length];
    const normalizedCandidate = normalizeText(candidate.question);
    const duplicated =
      previous.some((old) => isSimilarQuestion(old, normalizedCandidate)) ||
      selected.some((item) => isSimilarQuestion(item.question, candidate.question));

    if (!duplicated) {
      selected.push({
        index: questionIndex + selected.length,
        question: candidate.question,
        speechText: candidate.question,
        category: candidate.category,
        provider: 'contextual-template',
        quotaMode: true,
        fallbackReason,
      });
    }

    cursor += 1;
  }

  return {
    ok: true,
    provider: 'contextual-template',
    quotaMode: true,
    fallbackReason,
    questions: selected,
  };
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

  const keywords = extractContextKeywords(research, 5);
  const mainKeyword = keywords[0] || field || 'penelitian Anda';
  const secondKeyword = keywords[1] || method || 'metode yang digunakan';
  const lead = modeLead(examinerMode);

  specificQuestions.push(
    ...getSessionTypeTemplateQuestions(
      research,
      lead,
      field || 'bidang penelitian Anda',
      method || 'metode yang digunakan',
      title || 'penelitian Anda',
      mainKeyword,
      secondKeyword
    ).map((item) => ({
      category: item.category,
      q: item.question,
    }))
  );

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
      { category: 'validitas', q: `Bagaimana Anda membagi dataset (train, validation, test split) untuk memastikan model ${method} Anda dapat dievaluasi secara adil dan kredibel?` },
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
  else if (examinerMode === 'santai') preferredCategories = ['latar_belakang', 'novelty', 'implementasi'];
  else preferredCategories = ['latar_belakang', 'novelty', 'metode', 'validitas', 'implementasi', 'batasan']; // umum

  // Filter available questions (anti-repetition & keyword filtering)
  let available = bank.filter(q => {
    const isSimilar = previousQuestions.some(pq => isSimilarQuestion(pq, q.q));
    if (isSimilar) return false;

    const lowerQ = q.q.toLowerCase();
    if (lowerQ.includes('overfitting') && previousQuestions.some(pq => pq.toLowerCase().includes('overfitting'))) {
      return false;
    }
    if ((lowerQ.includes('split') || lowerQ.includes('pembagian dataset')) && previousQuestions.some(pq => pq.toLowerCase().includes('split') || pq.toLowerCase().includes('pembagian dataset'))) {
      return false;
    }
    return true;
  });

  if (available.length === 0) available = bank; // fallback if all exhausted

  // Prioritize category
  let candidates = available.filter(q => preferredCategories.includes(q.category));
  if (candidates.length === 0) candidates = available;

  const selected = candidates[questionIndex % candidates.length].q;

  // Formatting based on mode
  let finalQuestion = selected;
  if (examinerMode === 'kritis') {
    finalQuestion = `Secara objektif, ${finalQuestion}`;
  } else if (examinerMode === 'killer') {
    finalQuestion = `Jawab dengan singkat dan padat: ${finalQuestion}`;
  } else if (examinerMode === 'santai') {
    finalQuestion = selected;
  }

  return finalQuestion;
}

// Evaluation Helpers

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

function normalizeForCompare(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForCompare(text)
    .split(" ")
    .filter(token => token.length > 2);
}

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function isDirectActionQuestion(question: string): boolean {
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

function contentTokens(text: string): string[] {
  return tokenize(text).filter(token => !COMMON_STOPWORDS.has(token));
}

function hasQuestionContentOverlap(question: string, answer: string): boolean {
  const qTokens = new Set(contentTokens(question));
  const aTokens = new Set(contentTokens(answer));
  if (qTokens.size === 0 || aTokens.size === 0) return false;
  for (const token of aTokens) {
    if (qTokens.has(token)) return true;
  }
  return false;
}

function isLikelyOffTopicAnswer(question: string, answer: string, research: any): boolean {
  const answerTokenCount = tokenize(answer).length;
  if (answerTokenCount < 3) return false;
  if (isShortButRelevantAnswer(question, answer, research)) return false;
  return !hasQuestionContentOverlap(question, answer) && !hasRelevantResearchKeyword(answer, research);
}

export function evaluateAnswer(
  question: string,
  answer: string,
  research: ResearchProfile,
  examinerMode: string
): AnswerEvaluation {
  const q = normalizeForCompare(question);
  const a = normalizeForCompare(answer);
  const rawAnswer = String(answer || "").trim();

  const directRefusalPatterns = [
    /\b(gatau|ga tau|gak tau|nggak tau|tidak tahu|tdk tahu|ndak tau|ndak tahu)\b/i,
    /\b(saya tidak tahu|saya kurang tahu|saya belum tahu|belum paham|kurang paham)\b/i,
    /\b(skip|pass|lewati|entahlah)\b/i,
    /\b(males|malas|gamau|ga mau|tidak mau)\b/i,
    /\b(kok tanya saya|tanya saya|mana saya tahu)\b/i,
  ];

  const questionSimilarity = jaccardSimilarity(q, a);
  const answerTokenCount = tokenize(a).length;

  const isDirectRefusal =
    answerTokenCount <= 18 &&
    directRefusalPatterns.some((pattern) => pattern.test(rawAnswer));

  if (!rawAnswer || answerTokenCount === 0) {
    return {
      score: 0,
      strengths: ["Belum ada jawaban yang dapat dinilai."],
      weaknesses: ["Jawaban kosong sehingga tidak menjawab pertanyaan penguji."],
      suggestion: "Berikan jawaban singkat yang langsung menjawab inti pertanyaan, lalu tambahkan alasan atau contoh dari penelitian Anda."
    };
  }

  if (isDirectRefusal) {
    return {
      score: 10,
      strengths: ["Belum terlihat kekuatan akademik dari jawaban ini."],
      weaknesses: ["Jawaban menunjukkan ketidaksiapan atau penolakan menjawab, sehingga inti pertanyaan belum dijawab."],
      suggestion: "Jika belum tahu, tetap jawab secara akademik: sebutkan dugaan yang paling masuk akal, lalu akui batasannya dengan sopan."
    };
  }

  if (questionSimilarity >= 0.72 || a.includes(q) || (q.includes(a) && answerTokenCount > 6)) {
    return {
      score: 10,
      strengths: ["Jawaban masih memuat konteks pertanyaan, tetapi belum memberikan penjelasan dari pihak mahasiswa."],
      weaknesses: ["Jawaban hanya mengulang atau menyalin pertanyaan penguji, bukan menjawab inti yang diminta."],
      suggestion: "Jangan mengulang pertanyaan penguji. Tulis jawaban Anda sendiri dengan menjelaskan alasan, metode, data, atau hasil riset Anda secara konkret."
    };
  }

  const partialRelevantSignals = [
    'karena',
    'alasan',
    'berbeda',
    'metode',
    'model',
    'mekanisme',
    'attention',
    'cbam',
    'coordinate',
    'dataset',
    'hasil',
    'akurasi',
    'efisiensi'
  ];

  const hasPartialRelevantSignal = partialRelevantSignals.some(signal => rawAnswer.toLowerCase().includes(signal));

  if (answerTokenCount >= 8 && questionSimilarity < 0.72 && hasPartialRelevantSignal) {
    const isInformal = /\b(cuy|wkwk|hehe|mepet|deadline|belum sempat|tidak sempat)\b/i.test(rawAnswer);

    if (isInformal) {
      return {
        score: 45,
        strengths: ["Jawaban sudah menyentuh sebagian inti pertanyaan."],
        weaknesses: ["Alasan masih terlalu informal atau personal, sehingga belum kuat sebagai argumen akademik."],
        suggestion: "Ubah alasan personal menjadi alasan metodologis, misalnya dengan menjelaskan perbedaan mekanisme, ruang lingkup eksperimen, atau dasar pembandingan model."
      };
    }

    return {
      score: 55,
      strengths: ["Jawaban sudah relevan dengan inti pertanyaan."],
      weaknesses: ["Jawaban masih umum dan belum cukup didukung data, metode, atau hasil penelitian."],
      suggestion: "Tambahkan alasan ilmiah dan kaitkan dengan detail penelitian agar jawaban lebih kuat."
    };
  }

  if (isShortButRelevantAnswer(question, answer, research)) {
    return {
      score: 60,
      strengths: ["Jawaban langsung menjawab sasaran perbaikan yang ditanyakan secara spesifik."],
      weaknesses: ["Penjelasan masih terlalu singkat dan belum memuat alasan logis atau dampak perbaikan tersebut."],
      suggestion: "Tambahkan penjelasan mengapa tindakan tersebut penting, dampaknya bagi model/hasil riset, dan bagaimana Anda menerapkannya secara operasional."
    };
  }

  if (isLikelyOffTopicAnswer(question, answer, research)) {
    return {
      score: 30,
      strengths: ["Jawaban sudah mencoba merespons, tetapi belum terhubung dengan inti pertanyaan."],
      weaknesses: ["Jawaban tidak memuat kata kunci substansial dari pertanyaan maupun konteks penelitian."],
      suggestion: "Jawab inti pertanyaan terlebih dahulu, lalu kaitkan dengan data, metode, variabel, atau temuan spesifik dari penelitian Anda."
    };
  }

  if (answerTokenCount <= 2) {
    return {
      score: 10,
      strengths: ["Belum terlihat pemahaman yang cukup dari jawaban."],
      weaknesses: ["Jawaban terlalu pendek dan belum menjelaskan inti pertanyaan."],
      suggestion: "Jawab minimal dengan satu argumen utama, alasan pendukung, dan kaitannya dengan penelitian Anda."
    };
  }

  if (answerTokenCount < 8) {
    return {
      score: 25,
      strengths: ["Jawaban sudah mencoba merespons, tetapi masih sangat terbatas."],
      weaknesses: ["Jawaban belum cukup menjelaskan alasan, bukti, atau hubungan dengan konteks penelitian."],
      suggestion: "Perpanjang jawaban dengan minimal dua kalimat: satu kalimat inti jawaban dan satu kalimat alasan/dukungan."
    };
  }

  const cleanAnswer = removeRepeatedPhrases(rawAnswer);
  const lowerAnswer = cleanAnswer.toLowerCase();

  const looksLikeFeedback =
    lowerAnswer.includes('skor:') &&
    (
      lowerAnswer.includes('kekuatan:') ||
      lowerAnswer.includes('perlu diperbaiki:') ||
      lowerAnswer.includes('saran:')
    );

  if (looksLikeFeedback) {
    return {
      score: 5,
      strengths: ['Jawaban tidak dapat dinilai sebagai respons akademik.'],
      weaknesses: ['Yang dikirim terlihat seperti feedback/evaluasi AI, bukan jawaban mahasiswa.'],
      suggestion: 'Jawab pertanyaan dengan kalimat sendiri, bukan menyalin feedback.'
    };
  }

  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
  const repRatio = repetitionRatio(cleanAnswer);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 40;

  if (repRatio > 0.35) {
    weaknesses.push('Jawaban terdeteksi repetitif atau berputar-putar, sehingga substansinya kurang kuat.');
    score = Math.min(10, score);
  }

  const methodTerms = research.method.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const hasMethodTerm = methodTerms.some(term => lowerAnswer.includes(term));
  const hasResearchSignal = hasRelevantResearchKeyword(cleanAnswer, research);
  const hasQuestionOverlap = hasQuestionContentOverlap(question, cleanAnswer);

  if (hasQuestionOverlap) {
    score += 15;
    strengths.push('Jawaban sudah menyentuh inti kata kunci pertanyaan penguji.');
  } else {
    weaknesses.push('Jawaban belum cukup langsung menjawab inti pertanyaan penguji.');
  }

  if (hasResearchSignal) {
    score += 10;
    strengths.push('Jawaban mulai dikaitkan dengan konteks penelitian.');
  }

  if (hasMethodTerm) {
    score += 8;
    strengths.push(`Jawaban mengaitkan pembahasan dengan metode penelitian (${research.method}).`);
  }

  const reasoningKeywords = ['karena', 'alasan', 'sebab', 'sehingga', 'maka', 'oleh karena itu', 'dikarenakan'];
  const hasReasoning = reasoningKeywords.some(kw => lowerAnswer.includes(kw));
  if (hasReasoning) {
    score += 10;
    strengths.push('Jawaban memiliki alasan atau hubungan sebab-akibat.');
  } else {
    weaknesses.push('Jawaban belum menjelaskan alasan logis di balik pernyataan utama.');
  }

  const evidenceKeywords = ['data', 'hasil', 'jumlah', 'sampel', 'responden', 'akurasi', 'nilai', 'validasi', 'uji', 'temuan', 'berdasarkan'];
  const hasEvidence = evidenceKeywords.some(kw => lowerAnswer.includes(kw));
  if (hasEvidence) {
    score += 8;
    strengths.push('Jawaban memuat unsur bukti, data, atau hasil penelitian.');
  }

  if (wordCount >= 35) score += 7;
  else if (wordCount < 18) {
    weaknesses.push('Jawaban masih terlalu pendek untuk menunjukkan pemahaman yang utuh.');
    score = Math.min(score, 55);
  }

  if (examinerMode === 'kritis' || examinerMode === 'killer') score -= 5;

  if (!hasQuestionOverlap && !hasResearchSignal) score = Math.min(score, 35);
  if (!hasQuestionOverlap) score = Math.min(score, 55);
  if (!hasReasoning) score = Math.min(score, 70);
  if (!hasEvidence && score > 82) score = 82;
  if (wordCount < 25 && score > 65) score = 65;

  score = Math.min(Math.max(Math.round(score), 0), 100);

  if (strengths.length === 0) {
    strengths.push('Belum terlihat kekuatan yang signifikan dari jawaban ini.');
  }
  if (weaknesses.length === 0) {
    weaknesses.push('Jawaban sudah cukup relevan, tetapi masih bisa dibuat lebih spesifik dan berbasis bukti.');
  }

  const suggestion = score >= 75
    ? 'Pertahankan struktur jawaban, lalu tambahkan detail angka, tahapan, atau bukti dari penelitian agar lebih meyakinkan.'
    : 'Gunakan struktur singkat: jawab inti pertanyaan, beri alasan, lalu hubungkan dengan data/metode/hasil penelitian Anda.';

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
