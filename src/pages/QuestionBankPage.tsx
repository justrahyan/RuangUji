import { useState } from 'react';
import PageShell from '../components/PageShell';
import SectionHeader from '../components/SectionHeader';
import { Search, ArrowRight, Lightbulb, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

const bankQuestions = [
  // Latar Belakang
  { q: "Apa alasan utama Anda memilih topik penelitian ini?", cat: "Latar Belakang", desc: "Menguji argumentasi Anda terhadap latar belakang pemilihan topik skripsi." },
  { q: "Masalah apa yang paling penting diselesaikan melalui penelitian ini?", cat: "Latar Belakang", desc: "Menggali tingkat kedalaman urgensi serta rumusan masalah utama Anda." },
  { q: "Mengapa judul skripsi Anda penting? Apa dampak negatif jika penelitian ini tidak dilakukan?", cat: "Latar Belakang", desc: "Menguji argumentasi kritis Anda terhadap konsekuensi riil dari penanganan masalah." },
  { q: "Bagaimana Anda membatasi ruang lingkup penelitian agar tidak meluas ke luar fokus utama?", cat: "Latar Belakang", desc: "Memastikan batas-batas riset didefinisikan dengan jelas sejak awal." },
  
  // Novelty
  { q: "Apa kontribusi utama penelitian Anda?", cat: "Novelty", desc: "Menakar nilai akademis atau kontribusi praktis yang diberikan." },
  { q: "Apa perbedaan penelitian Anda dengan penelitian sebelumnya?", cat: "Novelty", desc: "Membuktikan pembeda nyata dari draf literatur pembanding." },
  { q: "Sebutkan minimal 3 rujukan utama/paper benchmark yang menjadi acuan kebaruan riset Anda.", cat: "Novelty", desc: "Menguji tingkat pemahaman Anda terhadap studi literatur pembanding." },
  
  // Metodologi
  { q: "Mengapa metode ini paling sesuai digunakan?", cat: "Metodologi", desc: "Mempertahankan alasan teoritis pemilihan metode dibanding alternatif lain." },
  { q: "Bagaimana tahapan penelitian dilakukan dari awal hingga akhir?", cat: "Metodologi", desc: "Membuktikan penguasaan terhadap langkah alur/tahapan penyelesaian skripsi." },
  { q: "Apa kelemahan metode yang Anda gunakan?", cat: "Metodologi", desc: "Menakar pemahaman Anda seputar limitasi matematis/algoritma metode." },
  { q: "Bagaimana Anda menentukan parameter-parameter yang digunakan dalam algoritma/metode ini?", cat: "Metodologi", desc: "Memastikan tuning parameter didasarkan pada rujukan ilmiah atau eksperimen." },
  { q: "Bagaimana Anda menjawab kritik terhadap pendekatan yang digunakan?", cat: "Metodologi", desc: "Menguji keteguhan argumentasi terhadap serangan akademis eksternal." },
  
  // Data
  { q: "Bagaimana Anda memastikan data atau informasi yang digunakan valid?", cat: "Data", desc: "Menguji validitas instrumen pengukuran atau data sampling Anda." },
  { q: "Bagaimana Anda mengukur keberhasilan penelitian ini?", cat: "Data", desc: "Memastikan KPI atau parameter evaluasi diukur secara objektif." },
  { q: "Bagaimana Anda menangani ketidakseimbangan data (data imbalance) atau pencilan (outliers)?", cat: "Data", desc: "Menguji pemahaman Anda dalam tahap pembersihan dan perbaikan distribusi data." },
  { q: "Mengapa ukuran sampel atau jumlah data pengujian Anda dinilai representatif?", cat: "Data", desc: "Menguji basis data statistik yang Anda gunakan untuk menarik kesimpulan." },
  
  // Implementasi
  { q: "Bagaimana hasil penelitian ini dapat diterapkan?", cat: "Implementasi", desc: "Mengukur aspek kegunaan praktis produk atau rekomendasi hasil." },
  { q: "Siapa pihak yang paling terbantu oleh penelitian ini?", cat: "Implementasi", desc: "Menguji relevansi pemangku kepentingan yang menjadi target riset." },
  { q: "Apa risiko jika penelitian ini diterapkan di kondisi nyata?", cat: "Implementasi", desc: "Menganalisis mitigasi serta kelemahan eksternal sistem." },
  { q: "Bagaimana Anda merancang antarmuka (UI/UX) atau alur operasional agar mudah digunakan oleh pengguna akhir?", cat: "Implementasi", desc: "Mengukur aspek fungsionalitas dan keramahan penggunaan dari produk akhir." },
  
  // Penutup
  { q: "Apa kesimpulan paling kuat yang dapat diambil dari penelitian Anda?", cat: "Penutup", desc: "Menyaring esensi jawaban utama dari tujuan penelitian awal." },
  { q: "Apa batasan utama penelitian Anda?", cat: "Penutup", desc: "Menguji kejujuran akademis mengenai keterbatasan ruang lingkup." },
  { q: "Apa temuan paling penting dari penelitian Anda?", cat: "Penutup", desc: "Merangkum kontribusi terbesar dari hasil pengujian hipotesis." },
  { q: "Jika penelitian ini dilanjutkan, bagian mana yang paling perlu dikembangkan?", cat: "Penutup", desc: "Mengarahkan saran riset lanjutan untuk peneliti berikutnya." },
  { q: "Apa keterbatasan terbesar dari penelitian ini yang belum sempat Anda selesaikan?", cat: "Penutup", desc: "Mengukur objektivitas Anda dalam menyusun rekomendasi riset lanjutan." }
];

const categoryTips: Record<string, { strategy: string; focus: string; commonMistake: string }> = {
  "Latar Belakang": {
    strategy: "Fokus pada problem statement riil. Jelaskan urgensi dan dampak negatif jika masalah tersebut dibiarkan tanpa solusi.",
    focus: "Urgensi penelitian, batasan masalah, dan perumusan masalah.",
    commonMistake: "Menjelaskan teori yang terlalu luas alih-alih fokus pada masalah spesifik yang diteliti."
  },
  "Metodologi": {
    strategy: "Kuasai flowchart, arsitektur sistem, dan alasan matematis/teoritis dibalik pemilihan metode tersebut.",
    focus: "Langkah-langkah penelitian, keselarasan metode dengan tujuan riset, dan kelemahan metode.",
    commonMistake: "Mengatakan memilih metode hanya karena 'mudah dibuat' atau 'ditugaskan oleh dosen pembimbing'."
  },
  "Data": {
    strategy: "Kuasai asal-usul data, teknik preprocessing (pembersihan data), serta metrik evaluasi hasil (Akurasi, Presisi, F1-Score).",
    focus: "Validasi data, pembagian training/testing set, serta metrik performa.",
    commonMistake: "Tidak tahu jumlah data training/testing yang digunakan atau tidak bisa menjelaskan arti dari grafik hasil."
  },
  "Novelty": {
    strategy: "Jelaskan dengan jujur perbedaan riset Anda dibanding penelitian terdahulu. Tunjukkan kebaruan fitur, metode, atau studi kasus.",
    focus: "State-of-the-art pembanding, kelebihan solusi Anda, dan kontribusi ilmiah.",
    commonMistake: "Mengklaim sebagai 'yang pertama di dunia' tanpa melakukan studi literatur komparatif yang memadai."
  },
  "Implementasi": {
    strategy: "Hubungkan hasil Anda dengan penerapan nyata di lapangan. Pahami kendala performa (kecepatan, memori, kompatibilitas).",
    focus: "Integrasi sistem, skenario pengujian pengguna, dan analisis batasan operasional.",
    commonMistake: "Hanya menjelaskan program di laptop lokal tanpa memikirkan bagaimana cara orang lain memakainya di dunia nyata."
  },
  "Penutup": {
    strategy: "Pastikan Kesimpulan menjawab Tujuan Penelitian. Berikan saran riset lanjutan yang aplikatif dan realistis.",
    focus: "Jawaban tujuan penelitian, keterbatasan riset, dan rekomendasi arah riset ke depan.",
    commonMistake: "Menulis kesimpulan yang terlalu umum atau menambahkan kesimpulan baru yang tidak dibahas di bab hasil."
  }
};

const categories = ["Semua", "Latar Belakang", "Metodologi", "Data", "Novelty", "Implementasi", "Penutup"];
const ITEMS_PER_PAGE = 6;

export default function QuestionBankPage() {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredQuestions = bankQuestions.filter(q => {
    const matchesSearch = q.q.toLowerCase().includes(search.toLowerCase()) || 
                          q.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === "Semua" || q.cat === selectedCat;
    return matchesSearch && matchesCat;
  });

  // Calculate pagination values
  const totalQuestions = filteredQuestions.length;
  const totalPages = Math.ceil(totalQuestions / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalQuestions);
  const currentQuestions = filteredQuestions.slice(startIndex, endIndex);

  return (
    <PageShell>
      {/* Header & Filter */}
      <section className="section" style={{ backgroundColor: 'var(--white)', borderBottom: '1px solid var(--border-color)', padding: '2.5rem 0 1.5rem 0' }}>
        <div className="container">
          <SectionHeader 
            label="Pusat Pemanasan & Strategi"
            title="Eksplorasi kiat & contoh pertanyaan sidang."
            subtitle="Gunakan contoh pertanyaan, strategi, dan kesalahan umum sebagai pemanasan sebelum masuk ke ruang sidang AI."
          />

          {/* Search Box */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            <div className="search-wrapper">
              <input 
                type="text" 
                className="input search-input" 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari pertanyaan, kategori, atau topik..." 
              />
              <Search size={18} className="search-icon" />
            </div>
          </div>

          {/* Categories Filter Pills */}
          <div className="custom-scrollbar category-pills-container">
            {categories.map((cat, idx) => (
              <button 
                key={cat} 
                onClick={() => {
                  setSelectedCat(cat);
                  setCurrentPage(1);
                }}
                className={`category-pill ${selectedCat === cat ? 'active' : ''}`}
                style={{ 
                  animationDelay: `${idx * 40}ms`
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid Pertanyaan */}
      <section className="section-soft" style={{ backgroundColor: '#f8fafc', padding: '3.5rem 0' }}>
        <div className="container">
          
          {/* Dynamic Search & Filter State Header (Minimalist) */}
          {(search || selectedCat !== "Semua") && (
            <div className="fade-up" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.5rem', 
              flexWrap: 'wrap',
              gap: '0.75rem',
              animationDelay: '100ms'
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {selectedCat !== "Semua" && (
                  <span>Kategori: <strong style={{ color: 'var(--primary-blue)' }}>{selectedCat}</strong></span>
                )}
                {selectedCat !== "Semua" && search && <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>•</span>}
                {search && (
                  <span>Menampilkan <strong>{filteredQuestions.length}</strong> pertanyaan untuk <strong style={{ color: 'var(--primary-blue)' }}>"{search}"</strong></span>
                )}
              </span>
              <button 
                onClick={() => { 
                  setSearch(''); 
                  setSelectedCat('Semua'); 
                  setCurrentPage(1);
                }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.8125rem', 
                  cursor: 'pointer', 
                  textDecoration: 'underline',
                  padding: 0,
                  fontWeight: 600,
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-blue)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Reset Filter
              </button>
            </div>
          )}

          {/* General Tips & Guide Banner */}
          {selectedCat === "Semua" && (
            <div className="guide-banner fade-up" style={{ animationDelay: '150ms' }}>
              <div className="guide-banner-header">
                <div className="guide-banner-icon">
                  <BookOpen size={24} />
                </div>
                <h4 className="guide-banner-title">
                  Panduan Sukses Sidang Akademik
                </h4>
              </div>
              <div className="guide-banner-content">
                <p className="guide-banner-desc">
                  Klik kategori di atas untuk mempelajari strategi menjawab pertanyaan spesifik, atau klik <strong>"Latih Pertanyaan Ini"</strong> pada pertanyaan manapun untuk memanaskan kemampuan presentasi Anda di simulator.
                </p>
              </div>
            </div>
          )}

          {/* Dynamic Tips & Strategy Banner */}
          {selectedCat !== "Semua" && categoryTips[selectedCat] && (
            <div className="guide-banner yellow fade-up" style={{ animationDelay: '150ms' }}>
              <div className="guide-banner-header">
                <div className="guide-banner-icon">
                  <Lightbulb size={24} />
                </div>
                <h4 className="guide-banner-title">
                  Panduan Menjawab: {selectedCat}
                </h4>
              </div>
              <div className="guide-banner-content">
                <p className="guide-banner-desc">
                  <strong>Strategi:</strong> {categoryTips[selectedCat].strategy}
                </p>
                <div className="guide-banner-meta">
                  <span style={{ color: '#78350f' }}>
                    🎯 <strong>Fokus Utama:</strong> {categoryTips[selectedCat].focus}
                  </span>
                  <span style={{ color: '#b91c1c' }}>
                    ⚠️ <strong>Hindari Kesalahan:</strong> {categoryTips[selectedCat].commonMistake}
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentQuestions.length > 0 ? (
            <div>
              <div 
                key={currentPage}
                className="questions-grid"
              >
                {currentQuestions.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="question-card" 
                    style={{ 
                      animationDelay: `${idx * 30 + 100}ms` 
                    }}
                  >
                    <div>
                      <div style={{ marginBottom: '1rem' }}>
                        <span className="badge" style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', border: '1px solid var(--blue-border)', textTransform: 'capitalize', fontSize: '0.75rem' }}>
                          {item.cat}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                        {item.q}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        {item.desc}
                      </p>
                    </div>
                    <Link 
                      to={`/setup?q=${encodeURIComponent(item.q)}`} 
                      state={{ q: item.q }}
                      className="btn btn-secondary practice-btn" 
                    >
                      Latih Pertanyaan Ini
                    </Link>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalQuestions > 0 && (
                <div className="pagination-container fade-up" style={{ animationDelay: '100ms' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Menampilkan <strong>{startIndex + 1}–{endIndex}</strong> dari <strong>{totalQuestions}</strong> pertanyaan
                  </span>
                  {totalPages > 1 && (
                    <div className="pagination-controls">
                      <button 
                        className="pagination-btn" 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                        <button
                          key={pageNum}
                          className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button 
                        className="pagination-btn" 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Berikutnya
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card fade-up" style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '22px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontWeight: 600 }}>Pertanyaan tidak ditemukan.</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginTop: '0.5rem' }}>Coba ubah kata kunci pencarian atau ganti filter kategori.</p>
            </div>
          )}

          {/* CTA Simulasi Penuh */}
          <div className="cta-card fade-up delay-2 soft-shadow">
            <h2>Siap untuk simulasi penuh?</h2>
            <p>Latih pemahaman jawaban atas draf skripsi Anda dengan watak penguji virtual AI kami.</p>
            <Link to="/setup" className="btn btn-primary" style={{ padding: '0.875rem 2rem' }}>
              Mulai Simulasi <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
