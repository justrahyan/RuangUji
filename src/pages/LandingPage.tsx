import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import SectionHeader from '../components/SectionHeader';
import {
  Bot, FileText, Mic, MessageSquare, LineChart,
  History, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import LandingSimulatorPreview from '../components/LandingSimulatorPreview';

export default function LandingPage() {
  // Mode Penguji State
  const [activeMode, setActiveMode] = useState('Santai');

  const examinerModes = [
    { name: 'Santai', title: 'Mode Santai (Friendly)', desc: 'Cocok untuk pemanasan awal. Pertanyaan seputar konsep dasar penelitian dengan nada yang bersahabat dan membangun.', target: 'Mahasiswa tahap awal persiapan.' },
    { name: 'Kritis', title: 'Mode Kritis (Analytical)', desc: 'Menanyakan dasar teori secara tajam dan objektif. Dosen akan mencari kelemahan penalaran atau inkonsistensi dari penjelasan Anda.', target: 'Mahasiswa yang ingin menguji kekuatan argumen skripsi.' },
    { name: 'Killer', title: 'Mode Killer (Defensive)', desc: 'Menguji ketahanan mental. Pertanyaan menekan, konfrontatif, dan dirancang untuk menguji seberapa jauh Anda mempertahankan argumen.', target: 'Mahasiswa yang ingin simulasi kondisi sidang terburuk.' },
    { name: 'Metodologi', title: 'Mode Metodologi (Procedural)', desc: 'Fokus penuh pada proses penelitian: teknik sampling, operasionalisasi variabel, desain penelitian, dan validitas metode.', target: 'Mahasiswa dengan metode penelitian eksperimental atau kompleks.' },
    { name: 'Statistik/Data', title: 'Mode Statistik & Data', desc: 'Hanya bertanya tentang analisis data, metrik performa, dan validasi data secara statistik jika penelitian Anda bertipe kuantitatif.', target: 'Mahasiswa dengan penelitian kuantitatif, ML, atau data-heavy.' },
    { name: 'Novelty', title: 'Mode Novelty (Kebaruan)', desc: 'Dosen akan memojokkan Anda seputar kontribusi orisinal. Apa beda nyata karya Anda dari puluhan referensi terdahulu?', target: 'Mahasiswa yang skripsinya berfokus pada inovasi baru.' },
    { name: 'Implementasi', title: 'Mode Implementasi (Praktikal)', desc: 'Bertanya tentang aplikasi nyata, batasan sistem, alur software, skalabilitas, dan dampak praktis temuan penelitian.', target: 'Mahasiswa dengan penelitian berupa produk, aplikasi, atau sistem.' }
  ];

  const activeModeData = examinerModes.find(m => m.name === activeMode) || examinerModes[0];

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    { q: 'Apakah perlu login?', a: 'Tidak sama sekali. Semua data simulasi, transkrip, dan profil penelitian Anda disimpan secara lokal di perangkat Anda melalui localStorage.' },
    { q: 'Apakah bisa upload dokumen?', a: 'Bisa. RuangUji mendukung ekstraksi file dokumen (seperti PDF/DOCX) untuk digunakan sebagai ringkasan dan basis pertanyaan penguji virtual Anda.' },
    { q: 'Apakah bisa latihan dengan suara?', a: 'Tentu. Anda dapat mengaktifkan fitur mikrofon (Speech-to-Text) untuk menjawab secara lisan. AI juga dilengkapi Text-to-Speech untuk membaca pertanyaan secara langsung.' },
    { q: 'Apakah riwayat latihan tersimpan?', a: 'Ya, seluruh sesi latihan Anda sebelumnya akan tersimpan rapi di tab Riwayat pada browser Anda.' },
    { q: 'Apakah ada batas latihan?', a: 'Ada. Untuk menjaga ketersediaan layanan AI, setiap pengguna dibatasi 5 sesi latihan per 8 jam. Batas ini akan otomatis reset pada periode berikutnya.' }
  ];

  return (
    <PageShell>
      {/* Hero Section */}
      <section
        className="fade-up"
        style={{
          minHeight: 'calc(100vh - 72px)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#f8fafc',
          padding: '4rem 0'
        }}
      >
        {/* Subtle Blue Gradient Glow */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '800px',
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.02) 50%, rgba(248,250,252,0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}></div>

        {/* Pattern Grid Halus */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(15,23,42,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
          zIndex: 0
        }}></div>

        {/* Floating Badges */}
        {/* Left 1: Tanpa Login */}
        <div className="hero-floating-badge animate-pop-in" style={{ left: '6%', top: '28%', animationDelay: '400ms' }}>
          <div style={{ transform: 'rotate(-8deg)' }}>
            <div className="animate-float-1">
              <div className="floating-pill" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1), 0 15px 20px -20px rgba(0,0,0,0.05)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'default',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>✓</span> Tanpa Login
              </div>
            </div>
          </div>
        </div>

        {/* Left 2: Feedback Instan */}
        <div className="hero-floating-badge animate-pop-in" style={{ left: '10%', top: '52%', animationDelay: '600ms' }}>
          <div style={{ transform: 'rotate(5deg)' }}>
            <div className="animate-float-3">
              <div className="floating-pill" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1), 0 15px 20px -20px rgba(0,0,0,0.05)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'default',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>✓</span> Feedback Instan
              </div>
            </div>
          </div>
        </div>

        {/* Right 1: Tersimpan di Perangkat */}
        <div className="hero-floating-badge animate-pop-in" style={{ right: '6%', top: '25%', animationDelay: '500ms' }}>
          <div style={{ transform: 'rotate(6deg)' }}>
            <div className="animate-float-2">
              <div className="floating-pill" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1), 0 15px 20px -20px rgba(0,0,0,0.05)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'default',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>✓</span> Tersimpan di Perangkat
              </div>
            </div>
          </div>
        </div>

        {/* Right 2: Bisa Pakai Dokumen */}
        <div className="hero-floating-badge animate-pop-in" style={{ right: '10%', top: '48%', animationDelay: '700ms' }}>
          <div style={{ transform: 'rotate(-5deg)' }}>
            <div className="animate-float-1">
              <div className="floating-pill" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1), 0 15px 20px -20px rgba(0,0,0,0.05)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'default',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>✓</span> Bisa Pakai Dokumen
              </div>
            </div>
          </div>
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>

            {/* Hero Left Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="badge fade-up delay-1" style={{ marginBottom: '1.25rem', backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', border: '1px solid var(--blue-border)', textTransform: 'uppercase' }}>
                Simulator Latihan Sidang
              </span>
              <h1 className="fade-up delay-2" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                Kuasai Sidang Akademik<br />Anda Bersama Penguji AI
              </h1>
              <p className="fade-up delay-3" style={{ fontSize: '1.1875rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.6, maxWidth: '640px' }}>
                Simulasikan tanya jawab skripsi atau tesis secara interaktif. Dapatkan pertanyaan kritis berbasis topik penelitian Anda lengkap dengan penilaian & masukan langsung.
              </p>

              <div className="fade-up delay-4" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem', width: '100%' }}>
                <Link to="/setup" className="btn btn-primary" style={{ padding: '0.875rem 2rem', fontSize: '1.0625rem' }}>
                  Mulai Latihan <ChevronRight size={18} />
                </Link>
                <Link to="/question-bank" className="btn btn-secondary" style={{ padding: '0.875rem 2rem', fontSize: '1.0625rem' }}>
                  Lihat Bank Pertanyaan
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Simulator Preview Section */}
      <LandingSimulatorPreview />

      {/* Fitur Utama Section */}
      <section className="section-soft" style={{ backgroundColor: '#f6f8fb', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container">
          <SectionHeader
            label="Fitur Utama"
            title="Semua yang dibutuhkan untuk latihan sidang."
            subtitle="Didesain dengan pendekatan praktis agar Anda siap mental dan materi sebelum menghadapi dosen penguji."
            centered
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <FeatureCard icon={<Bot size={24} />} title="Simulasi Penguji" desc="Interaksi tanya jawab real-time dengan penguji AI yang dapat disesuaikan berdasarkan gaya dan fokus pengujian." />
            <FeatureCard icon={<FileText size={24} />} title="Upload Dokumen" desc="Analisis otomatis draf skripsi atau tesis Anda untuk pemetaan pertanyaan yang kontekstual." />
            <FeatureCard icon={<Mic size={24} />} title="Jawaban Teks & Suara" desc="Berlatih merangkai argumentasi lewat penulisan cepat atau perekaman suara layaknya presentasi asli." />
            <FeatureCard icon={<MessageSquare size={24} />} title="Feedback Jawaban" desc="Dapatkan analisis kekuatan dan kelemahan di setiap jawaban beserta saran perbaikan terstruktur." />
            <FeatureCard icon={<LineChart size={24} />} title="Skor Kesiapan" desc="Pantau kalkulasi skor kelayakan jawaban akademik untuk mengetahui topik mana yang perlu diperdalam." />
            <FeatureCard icon={<History size={24} />} title="Riwayat Latihan" desc="Simpan otomatis performa latihan ke browser lokal agar Anda bisa memantau tren perkembangan belajar." />
          </div>
        </div>
      </section>

      {/* Cara Kerja Section */}
      <section className="section" style={{ backgroundColor: 'var(--white)' }}>
        <div className="container">
          <SectionHeader
            label="Alur Simulasi"
            title="Mulai dalam tiga langkah."
            subtitle="Hanya butuh 1-2 menit untuk menyiapkan sesi simulasi terfokus sesuai draf penelitian Anda."
            centered
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <StepCard number="01" title="Masukkan Penelitian" desc="Isi form judul penelitian, pilih topik/bidang ilmu, atau cukup unggah draf skripsi Anda." />
            <StepCard number="02" title="Pilih Mode Penguji" desc="Sesuaikan karakter dosen penguji virtual, dari yang ramah metodologi hingga killer." />
            <StepCard number="03" title="Jawab dan Evaluasi" desc="Simulasikan sidang, jawab pertanyaan, dan dapatkan rapor analisis evaluasi menyeluruh." />
          </div>
        </div>
      </section>

      {/* Mode Penguji Section */}
      <section className="section-soft" style={{ backgroundColor: '#f6f8fb', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container">
          <SectionHeader
            label="Mode Penguji"
            title="Gaya penguji yang fleksibel."
            subtitle="Latih diri Anda menghadapi berbagai dinamika pertanyaan dengan memilih fokus dan gaya penguji yang sesuai."
            centered
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
            {/* Pill Tabs Selector */}
            <div
              className="custom-scrollbar examiner-tabs"
              style={{
                display: 'flex',
                gap: '0.625rem',
                overflowX: 'auto',
                paddingBottom: '0.75rem',
                width: '100%',
                maxWidth: '900px',
                justifyContent: 'center',
                scrollSnapType: 'x proximity'
              }}
            >
              {examinerModes.map((mode) => (
                <button
                  key={mode.name}
                  onClick={() => setActiveMode(mode.name)}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: activeMode === mode.name ? 'var(--primary-blue)' : 'var(--white)',
                    color: activeMode === mode.name ? 'var(--white)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {mode.name}
                </button>
              ))}
            </div>

            {/* Explanation Card */}
            <div
              className="card soft-shadow fade-up examiner-mode-card"
              key={activeMode}
              style={{
                maxWidth: '720px',
                width: '100%',
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px'
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '0.75rem' }}>{activeModeData.title}</h3>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>{activeModeData.desc}</p>
              <div className="examiner-target-row">
                <span>Paling cocok untuk:</span>
                <p>{activeModeData.target}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Accordion FAQ */}
      <section className="section" style={{ backgroundColor: 'var(--white)' }}>
        <div className="container" style={{ maxWidth: '780px' }}>
          <SectionHeader
            label="FAQ"
            title="Pertanyaan yang sering ditanyakan."
            centered
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '1.25rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--white)',
                    border: isOpen ? '1px solid var(--blue-border)' : '1px solid var(--border-color)',
                    boxShadow: isOpen ? '0 4px 15px rgba(37,99,235,0.03)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {faq.q}
                    </h3>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="fade-up" style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section" style={{ backgroundColor: 'var(--white)', paddingTop: 0 }}>
        <div className="container">
          <div className="cta-card fade-up soft-shadow" style={{ marginTop: 0 }}>
            <h2>Siap latihan sebelum sidang?</h2>
            <p>
              Mulai dari data penelitianmu, lalu biarkan penguji virtual menguji kesiapan jawabanmu.
            </p>
            <Link to="/setup" className="btn btn-primary" style={{ padding: '0.875rem 2rem' }}>
              Mulai Latihan Sekarang
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'flex-start', borderRadius: '22px' }}>
      <div style={{ padding: '0.875rem', backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', borderRadius: '0.75rem' }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>{desc}</p>
      </div>
    </div>
  );
}

function StepCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="card card-hover" style={{ position: 'relative', overflow: 'hidden', padding: '2rem', borderRadius: '22px', backgroundColor: 'var(--white)' }}>
      <div style={{ position: 'absolute', right: '10px', top: '-10px', fontSize: '6rem', fontWeight: 800, color: 'rgba(241,245,249,0.85)', zIndex: 0, lineHeight: 1, userSelect: 'none' }}>
        {number}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>{desc}</p>
      </div>
    </div>
  );
}
