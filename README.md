# RuangUji - Simulator Sidang Akademik Berbasis AI

**RuangUji** adalah simulator sidang akademik berbasis AI yang membantu mahasiswa berlatih menjawab pertanyaan penguji sebelum menghadapi sidang, seminar proposal, seminar hasil, atau presentasi tugas akhir yang sesungguhnya.

Project ini dibuat untuk program **#JuaraVibeCoding** dengan mengambil tema **Edukasi: Sang Teman Belajar**. RuangUji memungkinkan pengguna mengunggah dokumen penelitian, memilih mode penguji, menjalani simulasi tanya-jawab melalui mode chat atau voice, lalu mendapatkan evaluasi jawaban secara langsung.

**Live Demo:** [https://ruanguji-727794265175.asia-southeast2.run.app/](https://ruanguji-727794265175.asia-southeast2.run.app/)

> Catatan: AI dapat membuat kesalahan atau kurang sesuai konteks. Hasil simulasi digunakan sebagai bahan latihan, bukan penilaian final.

---

## Deskripsi Project

RuangUji dirancang untuk membantu mahasiswa mempersiapkan diri menghadapi sesi tanya-jawab akademik. Aplikasi ini membaca konteks penelitian dari input manual dan dokumen yang diunggah, kemudian menghasilkan pertanyaan yang relevan dengan isi penelitian.

Setelah pengguna menjawab, sistem memberikan skor, kekuatan jawaban, area yang perlu diperbaiki, serta saran latihan. Hasil latihan juga disimpan sebagai riwayat agar pengguna dapat memantau perkembangan dari sesi ke sesi.

---

## #JuaraVibeCoding

RuangUji dibuat sebagai karya untuk **#JuaraVibeCoding**, program dari Google for Developers yang mendorong peserta membangun aplikasi nyata dengan bantuan AI, mulai dari ide, prototipe, hingga deployment ke Google Cloud Run.

Tema yang diambil dalam project ini adalah:

```txt
🎓 Edukasi: Sang Teman Belajar
````

RuangUji relevan dengan tema edukasi karena membantu mahasiswa belajar secara mandiri dalam mempersiapkan sidang akademik. Aplikasi ini berperan sebagai teman latihan yang dapat memberikan pertanyaan, mendengarkan jawaban, memberi evaluasi, dan membantu pengguna memperbaiki cara menjawab secara bertahap.

Dalam konteks #JuaraVibeCoding, RuangUji berfokus pada tiga aspek utama:

### 1. Problem

Banyak mahasiswa memahami isi penelitiannya, tetapi belum terbiasa menjawab pertanyaan penguji secara runtut, percaya diri, dan akademik. Latihan sidang juga sering terbatas karena bergantung pada waktu dosen pembimbing, teman, atau mentor.

### 2. Solution

RuangUji menyediakan simulasi sidang berbasis AI yang dapat membaca dokumen penelitian, menghasilkan pertanyaan kontekstual, menerima jawaban melalui chat atau voice, lalu memberikan evaluasi berupa skor, kekuatan, kelemahan, dan saran latihan.

### 3. Uniqueness

RuangUji tidak hanya menjadi chatbot tanya-jawab biasa. Aplikasi ini menghadirkan pengalaman ruang sidang interaktif dengan mode penguji berbeda, maskot AI animatif, evaluasi jawaban berbasis rubrik, riwayat latihan, dan transkrip PDF yang dapat diunduh.

---

## Tujuan Project

RuangUji dibuat untuk:

* Membantu mahasiswa berlatih menjawab pertanyaan sidang secara lebih terarah.
* Memberikan simulasi penguji akademik dengan berbagai mode pertanyaan.
* Membantu pengguna memahami kelemahan dan kekuatan jawaban.
* Menyediakan pengalaman latihan yang interaktif melalui chat dan voice.
* Mengurangi rasa gugup sebelum menghadapi sidang atau presentasi akademik.

---

## Fitur Utama

### 1. Setup Simulasi Sidang

Pengguna dapat mengisi informasi penelitian seperti:

* Judul penelitian
* Jenis sidang atau presentasi
* Bidang/topik penelitian
* Pendekatan penelitian
* Metode utama
* Abstrak/ringkasan
* Hal yang ingin dilatih
* Upload dokumen penelitian

Dokumen yang diunggah digunakan sebagai konteks utama agar pertanyaan lebih sesuai dengan isi penelitian.

#### Draft Setup Sementara

RuangUji menyediakan fitur penyimpanan draft setup sementara di perangkat pengguna. Fitur ini membantu menjaga isian form agar tidak langsung hilang ketika halaman tidak sengaja refresh atau tertutup.

Fitur ini hanya aktif jika pengguna memberikan izin melalui modal persetujuan. File asli yang diunggah tidak disimpan di browser.

#### Penyesuaian Pertanyaan Berdasarkan Jenis Sidang

Jenis sidang yang dipilih pengguna akan memengaruhi arah pertanyaan yang diberikan oleh RuangUji. Dengan begitu, pertanyaan tidak hanya mengikuti topik penelitian, tetapi juga menyesuaikan konteks presentasi akademik yang sedang dilatih.

| Jenis Sidang | Fokus Pertanyaan |
| --- | --- |
| Ujian Proposal | Gap penelitian, rumusan masalah, tujuan, metode, dan rencana validasi |
| Seminar Hasil | Hasil, pembahasan, interpretasi, validitas, dan keterbatasan |
| Sidang Skripsi | Pembahasan menyeluruh dari latar belakang, metode, hasil, kontribusi, sampai pengembangan |
| Presentasi Paper | Novelty, kontribusi ilmiah, gap penelitian, eksperimen, dan perbandingan dengan studi terdahulu |
| Presentasi Tugas Akhir | Masalah, solusi/sistem/metode, implementasi, pengujian, dan manfaat praktis |
| Lainnya | Fleksibel mengikuti dokumen, bidang, metode, dan concern pengguna |

---

### 2. Mode Penguji

RuangUji menyediakan beberapa mode penguji, seperti:

* Santai
* Kritis
* Killer
* Metodologi
* Statistik
* Novelty
* Implementasi

Setiap mode memiliki karakter pertanyaan yang berbeda agar pengguna dapat berlatih dari berbagai sudut pandang penguji.

---

### 3. Simulasi Ruang Sidang

Pada halaman ruang sidang, pengguna dapat menjalani sesi tanya-jawab dengan AI penguji.

Fitur yang tersedia:

* Pertanyaan berbasis konteks dokumen
* Mode chat
* Mode voice
* Suara AI penguji
* Tombol mute/unmute
* Transkrip percakapan

---

### 4. Evaluasi Jawaban

Setiap jawaban pengguna dianalisis oleh AI dan menghasilkan:

* Skor jawaban
* Kekuatan jawaban
* Area yang perlu diperbaiki
* Saran perbaikan
* Rekonstruksi maksud jawaban jika input berasal dari speech-to-text yang kurang akurat

---

### 5. Evaluasi Akhir

Setelah sesi selesai, pengguna akan mendapatkan evaluasi akhir berupa:

* Skor akhir
* Ringkasan performa
* Kekuatan utama
* Area perbaikan
* Saran latihan berikutnya

---

### 6. Riwayat Simulasi

Setiap sesi latihan dapat disimpan ke riwayat. Pada halaman riwayat, pengguna dapat:

* Melihat daftar sesi sebelumnya
* Melihat detail evaluasi
* Membuka rekaman tanya-jawab
* Menghapus riwayat
* Mengunduh transkrip simulasi dalam bentuk PDF

---

### 7. Limit Sesi Latihan

Untuk menjaga penggunaan API AI tetap terkendali, RuangUji mendukung pembatasan sesi latihan.

Secara default:

```txt
5 sesi latihan setiap 6 jam
```

Limit ini berjalan di sisi server, bukan hanya localStorage browser.

---

### 8. Mode Hemat API

RuangUji mendukung mode hemat API untuk mengurangi risiko limit Gemini API. Jika API sedang penuh atau gagal digunakan, sistem dapat tetap menjalankan sebagian alur simulasi menggunakan pertanyaan template yang disusun berdasarkan konteks input dan dokumen pengguna.

Mode ini membantu aplikasi tetap bisa digunakan meskipun layanan AI sedang terbatas. Namun, jika evaluasi AI tidak tersedia, hasil yang diberikan akan bersifat fallback dan tetap ditampilkan sebagai bahan latihan, bukan penilaian final.

Konfigurasi utama:

```env
ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK=true
AI_EVALUATE_EACH_ANSWER=false
AI_FINAL_EVALUATION=true
````

Dengan konfigurasi tersebut, RuangUji akan:

* Menghemat pemakaian API pada evaluasi per jawaban.
* Tetap membuat pertanyaan berbasis konteks ketika API utama terbatas.
* Memprioritaskan AI untuk evaluasi akhir agar hasil sesi tetap lebih bermakna.

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* React Router
* Framer Motion
* Lucide React
* jsPDF
* CSS custom styling

### Backend

* Node.js
* Express
* TypeScript
* tsx

### AI

* Gemini API
* Multi API key support
* Fallback model support
* AI-based question generation
* AI-based answer evaluation
* AI-based final evaluation

### Document Processing

* File upload
* Document text extraction
* Server-side document cache
* Context-aware prompt generation

### Deployment

* Docker
* Google Cloud Run
* Cloud Build
* Artifact Registry

---

## Struktur Project

```txt
RuangUji/
├── server/
│   └── aiProvider.ts
│
├── src/
│   ├── components/
│   │   ├── EvaluationResultLayout.tsx
│   │   ├── Footer.tsx
│   │   ├── Navbar.tsx
│   │   ├── RuangUjiBot.tsx
│   │   ├── VoiceAnswer.tsx
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── localEngine.ts
│   │   ├── speech.ts
│   │   └── storage.ts
│   │
│   ├── pages/
│   │   ├── DefenseRoomPage.tsx
│   │   ├── EvaluationPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── LandingPage.tsx
│   │   └── SetupPage.tsx
│   │
│   ├── types.ts
│   └── main.tsx
│
├── Dockerfile
├── index.html
├── package.json
├── package-lock.json
├── server.ts
└── README.md
```

---

## Environment Variables

Buat file `.env` berdasarkan `.env.example`.

```env
AI_PROVIDER=gemini

GEMINI_API_KEY=api_key_1,api_key_2,api_key_3
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-3.5-flash

VOICE_DEFAULT=calm-female

TRAINING_SESSION_LIMIT=5
TRAINING_SESSION_WINDOW_HOURS=6
DEV_BYPASS_USAGE_LIMIT=false

ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK=true
AI_EVALUATE_EACH_ANSWER=false
AI_FINAL_EVALUATION=true
````

Keterangan:

| Variable                              | Fungsi                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `AI_PROVIDER`                         | Menentukan provider AI yang digunakan                                         |
| `GEMINI_API_KEY`                      | API key Gemini, bisa satu atau banyak key dipisahkan koma                     |
| `GEMINI_MODEL`                        | Model utama Gemini                                                            |
| `GEMINI_FALLBACK_MODELS`              | Daftar model fallback jika model utama gagal/limit                            |
| `VOICE_DEFAULT`                       | Konfigurasi default suara                                                     |
| `TRAINING_SESSION_LIMIT`              | Jumlah maksimal sesi latihan                                                  |
| `TRAINING_SESSION_WINDOW_HOURS`       | Rentang waktu reset limit sesi                                                |
| `DEV_BYPASS_USAGE_LIMIT`              | Mode bypass limit untuk development lokal                                     |
| `ENABLE_CONTEXTUAL_TEMPLATE_FALLBACK` | Mengaktifkan fallback pertanyaan berbasis template kontekstual saat API penuh |
| `AI_EVALUATE_EACH_ANSWER`             | Mengatur apakah setiap jawaban dinilai langsung oleh AI                       |
| `AI_FINAL_EVALUATION`                 | Mengatur apakah evaluasi akhir menggunakan AI                                 |

---

## Cara Menjalankan Project

### 1. Clone Repository

```bash
git clone https://github.com/justrahyan/RuangUji.git
cd RuangUji
```

### 2. Install Dependency

```bash
npm install
```

Atau untuk clean install:

```bash
npm ci
```

### 3. Setup Environment

Buat file `.env`:

```bash
cp .env.example .env
```

Lalu isi API key Gemini pada bagian:

```env
GEMINI_API_KEY=your_api_key
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Untuk menjalankan server backend:

```bash
npm run start
```

Buka aplikasi di browser sesuai port yang tersedia.

---

## Build Production

```bash
npm run build
```

Jika ingin mengetes hasil build:

```bash
npm run start
```

---

## Deployment ke Cloud Run

Project ini dapat dideploy menggunakan Docker dan Google Cloud Run.

Pastikan environment variables sudah diatur di Cloud Run, terutama:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=api_key_1,api_key_2,api_key_3
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-3.5-flash
TRAINING_SESSION_LIMIT=5
TRAINING_SESSION_WINDOW_HOURS=8
DEV_BYPASS_USAGE_LIMIT=false
```

Untuk production, pastikan:

```env
DEV_BYPASS_USAGE_LIMIT=false
```

---

## Troubleshooting

### Jika `npm ci` error karena package-lock tidak sinkron

Jalankan:

```bash
rm -rf node_modules package-lock.json
npm install
npm ci
npm run build
```

Lalu commit ulang `package-lock.json`.

### Jika Cloud Run gagal karena environment variable

Pastikan semua variable yang dibutuhkan sudah ditambahkan di menu:

```txt
Cloud Run → Service → Edit & deploy new revision → Variables & Secrets
```

### Jika API Gemini terkena limit

Gunakan beberapa API key:

```env
GEMINI_API_KEY=api_key_1,api_key_2,api_key_3
```

Dan pastikan fallback model tersedia:

```env
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-3.5-flash
```

---

## Made by

**Muhammad Rahyan Noorfauzan**