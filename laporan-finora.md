# Laporan Pengenalan Aplikasi Finora

## 1. Pengertian Finora

Finora adalah aplikasi pembukuan, akuntansi, dan konsultasi perpajakan yang dirancang untuk membantu Usaha Mikro, Kecil, dan Menengah (UMKM) di Indonesia. Aplikasi ini dibuat dengan mengacu pada Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah (SAK EMKM).

Finora membantu pengguna mencatat transaksi keuangan, mengelola akun, membuat jurnal, menghasilkan laporan keuangan, menghitung pajak, serta menyiapkan data SPT Tahunan. Selain itu, Finora memiliki chatbot berbasis kecerdasan buatan yang dapat memberikan informasi mengenai akuntansi dan perpajakan.

Secara umum, Finora dikembangkan untuk mempermudah UMKM yang belum memiliki sistem pembukuan terkomputerisasi. Dengan adanya aplikasi ini, pencatatan keuangan dapat dilakukan secara lebih terstruktur, cepat, dan mudah dipahami.

## 2. Tujuan Pengembangan Finora

Tujuan utama pengembangan Finora adalah sebagai berikut:

1. Membantu UMKM melakukan pencatatan transaksi secara digital.
2. Mempermudah pengelolaan akun dan jurnal keuangan.
3. Menghasilkan laporan keuangan sesuai kebutuhan usaha.
4. Membantu pengguna memahami kewajiban perpajakan.
5. Menyediakan perhitungan pajak dan SPT Tahunan.
6. Memberikan layanan konsultasi akuntansi dan pajak melalui chatbot.
7. Mengurangi kesalahan pencatatan keuangan secara manual.
8. Menyediakan sistem yang dapat digunakan melalui web maupun aplikasi desktop.

## 3. Fitur-Fitur Utama Finora

### 3.1 Manajemen Akun

Finora menyediakan fitur untuk mengelola daftar akun atau *chart of accounts*. Akun-akun tersebut dapat digunakan untuk mengelompokkan transaksi berdasarkan jenisnya, seperti kas, bank, pendapatan, beban, aset, kewajiban, dan modal.

### 3.2 Pencatatan Transaksi dan Jurnal

Pengguna dapat mencatat transaksi usaha ke dalam sistem. Transaksi tersebut kemudian dapat digunakan untuk membuat jurnal umum dan jurnal penyesuaian. Pencatatan jurnal membantu memastikan setiap transaksi memiliki sisi debit dan kredit yang seimbang.

### 3.3 Buku Besar dan Neraca Saldo

Finora menyediakan buku besar yang berisi ringkasan transaksi berdasarkan masing-masing akun. Sistem juga dapat menghasilkan neraca saldo untuk memeriksa keseimbangan antara total debit dan total kredit.

### 3.4 Laporan Keuangan

Aplikasi dapat menghasilkan beberapa laporan keuangan, antara lain:

- Laporan laba rugi.
- Laporan posisi keuangan atau neraca.
- Catatan atas laporan keuangan (CALK).
- Neraca saldo.
- Buku besar.

Laporan tersebut dapat digunakan oleh pemilik usaha untuk mengetahui kondisi keuangan dan membantu proses pengambilan keputusan.

### 3.5 Perpajakan UMKM

Finora memiliki fitur yang berkaitan dengan perpajakan UMKM. Fitur ini dapat membantu dalam perhitungan pajak tertentu, seperti PPh Final UMKM dan PPN sesuai konfigurasi serta data transaksi yang dimasukkan oleh pengguna.

### 3.6 SPT Tahunan

Finora mendukung pembuatan dan pengelolaan draft SPT Tahunan, termasuk formulir 1770 dan 1770S. Pengguna dapat mengisi data, menyimpan draft, melihat perhitungan pajak, serta membuat preview dokumen sebelum dicetak atau digunakan lebih lanjut.

### 3.7 Chatbot Akuntansi dan Pajak

Finora menyediakan chatbot yang dapat digunakan untuk berkonsultasi mengenai akuntansi dan pajak. Chatbot menggunakan pendekatan *Retrieval-Augmented Generation* (RAG), yaitu menggabungkan model bahasa dengan basis pengetahuan yang berisi materi akuntansi, perpajakan, regulasi, dan SAK EMKM.

Chatbot dapat menggunakan konteks data keuangan pengguna serta menampilkan sumber informasi yang digunakan dalam penyusunan jawaban.

### 3.8 Import Data

Pengguna dapat mengimpor data dari beberapa jenis file, yaitu:

- CSV.
- Excel dengan ekstensi `.xlsx` atau `.xls`.
- PDF.

Data yang diimpor dapat diproses untuk membantu pembuatan transaksi, jurnal, atau bahan pengetahuan bagi chatbot.

### 3.9 Dashboard

Dashboard menampilkan ringkasan informasi keuangan dan aktivitas aplikasi. Halaman ini membantu pengguna memperoleh gambaran umum mengenai kondisi usaha tanpa harus membuka setiap laporan secara terpisah.

## 4. Teknologi yang Digunakan

### 4.1 Frontend

Bagian frontend Finora digunakan untuk membangun tampilan antarmuka yang berinteraksi langsung dengan pengguna. Teknologi yang digunakan antara lain:

- React.
- Vite.
- React Router.
- Axios.
- Tailwind CSS.
- Recharts.
- Lucide React.

Frontend memiliki halaman dashboard, accounting, jurnal, upload, knowledge base, pajak, SPT, pengaturan perusahaan, notifikasi, dan chatbot.

### 4.2 Backend

Backend berfungsi untuk menjalankan logika bisnis, mengelola data, menyediakan API, dan menghubungkan aplikasi dengan layanan lainnya. Teknologi yang digunakan antara lain:

- Python.
- FastAPI.
- Uvicorn.
- Pydantic.
- SQLAlchemy.
- Alembic.
- SQLite.
- PostgreSQL sebagai alternatif database.
- JSON Web Token untuk autentikasi.
- Pandas dan OpenPyXL untuk pengolahan data.
- PyPDF untuk pemrosesan file PDF.

### 4.3 Artificial Intelligence dan Knowledge Base

Fitur chatbot menggunakan beberapa komponen pendukung, yaitu:

- Qdrant sebagai penyimpanan vector database.
- FastEmbed sebagai penyedia embedding lokal.
- Ollama sebagai layanan model bahasa.
- RAG untuk mengambil informasi yang relevan dari knowledge base.

Knowledge base Finora berisi materi akuntansi, perpajakan, regulasi, FAQ aplikasi, dan SAK EMKM.

### 4.4 Aplikasi Desktop

Finora juga dapat dijalankan sebagai aplikasi desktop menggunakan Electron. Electron memungkinkan frontend dan backend Finora dikemas menjadi aplikasi yang dapat diinstal pada beberapa sistem operasi, seperti Windows, macOS, dan Linux.

## 5. Struktur Sistem Finora

Struktur utama repository Finora terdiri dari beberapa bagian berikut:

```text
finora/
├── backend/          Backend FastAPI dan logika bisnis
├── frontend/         Tampilan aplikasi React dan Vite
├── electron/         Konfigurasi aplikasi desktop
├── knowledge/        Basis pengetahuan akuntansi dan pajak
├── data/              Database dan penyimpanan data lokal
├── downloads/        File installer aplikasi
├── scripts/           Script pendukung aplikasi
├── paper/             Materi dan evaluasi penelitian
├── docker-compose.yml Konfigurasi Docker
└── README.md          Dokumentasi proyek
```

### 5.1 Backend

Direktori backend berisi kode utama untuk API dan proses bisnis aplikasi. Beberapa bagian pentingnya adalah:

- `app/main.py` sebagai entry point aplikasi FastAPI.
- `app/routers/` untuk endpoint autentikasi, accounting, chatbot, upload, SPT, dashboard, dan fitur lainnya.
- `app/database/` untuk konfigurasi database dan model data.
- `app/accounting/` untuk proses pembukuan, laporan keuangan, pajak, dan SPT.
- `app/rag/` untuk proses pencarian informasi dan penyusunan konteks chatbot.
- `app/llm/` untuk integrasi model bahasa dan embedding.
- `app/services/ingestion/` untuk memproses file yang diunggah pengguna.

### 5.2 Frontend

Direktori frontend berisi tampilan aplikasi dan komponen antarmuka. Struktur utamanya terdiri dari:

- `src/pages/` untuk halaman aplikasi.
- `src/components/` untuk komponen antarmuka.
- `src/context/` untuk pengelolaan state autentikasi, tema, dan chatbot.
- `src/api/` untuk komunikasi dengan backend.
- `src/hooks/` untuk custom React hooks.
- `src/utils/` untuk fungsi bantuan, formatter, dan pembuatan dokumen.

## 6. Alur Kerja Finora

Secara umum, alur penggunaan Finora adalah sebagai berikut:

1. Pengguna melakukan registrasi atau login ke dalam aplikasi.
2. Pengguna mengatur data awal perusahaan dan akun yang digunakan.
3. Pengguna memasukkan transaksi secara manual atau mengimpor data dari file.
4. Sistem memproses transaksi menjadi jurnal.
5. Data jurnal digunakan untuk membentuk buku besar dan neraca saldo.
6. Sistem menghasilkan laporan keuangan berdasarkan periode tertentu.
7. Pengguna dapat melihat informasi pajak dan mengisi data SPT Tahunan.
8. Pengguna dapat berkonsultasi melalui chatbot mengenai akuntansi atau perpajakan.
9. Data dan laporan dapat digunakan sebagai bahan evaluasi kondisi usaha.

## 7. Penyimpanan Data

Finora menggunakan database relasional untuk menyimpan data aplikasi. Pada konfigurasi standar, database yang digunakan adalah SQLite. Data yang dapat disimpan meliputi:

- Data pengguna.
- Daftar akun.
- Transaksi.
- Jurnal.
- Data SPT.
- Pengaturan aplikasi.

Untuk kebutuhan tertentu, database dapat dikonfigurasi menggunakan PostgreSQL. Finora juga menggunakan Qdrant untuk menyimpan data berbentuk vektor yang diperlukan dalam proses pencarian informasi pada chatbot.

Pada aplikasi desktop, data disimpan di folder data aplikasi pengguna. Penyimpanan tersebut dapat mencakup database, file upload, hasil pemrosesan, embedding, konfigurasi, dan log aplikasi.

## 8. Keamanan dan Autentikasi

Finora menerapkan autentikasi pengguna agar data keuangan dapat diakses oleh pengguna yang memiliki hak akses. Backend menggunakan token autentikasi berbasis JWT. Beberapa endpoint juga dilindungi agar hanya pengguna yang sudah login atau administrator yang dapat mengaksesnya.

Selain autentikasi, aplikasi memiliki konfigurasi untuk secret key, pembatasan permintaan, serta pemeriksaan kesehatan layanan backend dan database.

## 9. Manfaat Finora bagi UMKM

Finora memberikan beberapa manfaat bagi pelaku UMKM, yaitu:

1. Membantu melakukan pembukuan tanpa harus menggunakan pencatatan manual.
2. Menyajikan laporan keuangan secara lebih cepat.
3. Membantu pemilik usaha mengetahui pendapatan, beban, aset, kewajiban, dan modal.
4. Mempermudah persiapan data perpajakan.
5. Menyediakan konsultasi awal mengenai akuntansi dan pajak.
6. Mengurangi risiko kehilangan data akibat pencatatan yang tidak teratur.
7. Membantu pemilik usaha mengambil keputusan berdasarkan data keuangan.
8. Dapat digunakan melalui web maupun aplikasi desktop.

## 10. Kelebihan dan Hal yang Perlu Diperhatikan

### Kelebihan

- Memiliki fitur pembukuan yang cukup lengkap.
- Mendukung laporan keuangan berdasarkan data transaksi.
- Memiliki fitur perpajakan dan SPT Tahunan.
- Menyediakan chatbot berbasis knowledge base.
- Mendukung import data dari beberapa format file.
- Dapat dijalankan sebagai aplikasi web maupun desktop.
- Menggunakan struktur aplikasi yang terpisah antara frontend dan backend.

### Hal yang Perlu Diperhatikan

- Hasil laporan sangat bergantung pada ketepatan data yang dimasukkan pengguna.
- Perhitungan pajak perlu disesuaikan dengan ketentuan perpajakan yang berlaku.
- Fitur chatbot memerlukan konfigurasi model bahasa dan knowledge base.
- Penggunaan layanan eksternal seperti Qdrant Cloud atau Ollama Cloud memerlukan konfigurasi tambahan.
- Data keuangan harus dikelola dengan baik dan tidak dibagikan kepada pihak yang tidak berwenang.

## 11. Kesimpulan

Finora merupakan aplikasi pembukuan dan konsultasi perpajakan yang ditujukan untuk membantu UMKM Indonesia mengelola keuangan secara digital. Aplikasi ini menyediakan fitur pencatatan transaksi, jurnal, buku besar, laporan keuangan, perhitungan pajak, pengisian SPT Tahunan, import dokumen, serta chatbot akuntansi dan pajak.

Dengan menggunakan teknologi React, FastAPI, database relasional, Qdrant, dan model bahasa, Finora menggabungkan fungsi akuntansi konvensional dengan teknologi kecerdasan buatan. Finora diharapkan dapat membantu UMKM meningkatkan kerapian administrasi, memahami kondisi keuangan, serta memenuhi kebutuhan dasar pembukuan dan perpajakan.

Dalam kegiatan PKL, Finora dapat dipahami sebagai sebuah sistem informasi keuangan yang terdiri dari frontend sebagai tampilan pengguna, backend sebagai pengolah proses bisnis, database sebagai penyimpan data, serta layanan kecerdasan buatan sebagai pendukung konsultasi akuntansi dan pajak.
