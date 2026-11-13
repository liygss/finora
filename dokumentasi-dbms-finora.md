# Dokumentasi DBMS Finora

## 1. Pendahuluan

Finora adalah aplikasi pembukuan dan konsultasi perpajakan untuk UMKM Indonesia. Sistem ini menggunakan basis data untuk menyimpan data pengguna, akun akuntansi, transaksi, jurnal, laporan pendukung, SPT Tahunan, dokumen, percakapan chatbot, notifikasi, dan feedback.

Dokumentasi ini menjelaskan perancangan serta implementasi Database Management System (DBMS) pada aplikasi Finora untuk keperluan laporan Praktik Kerja Lapangan (PKL).

## 2. Tujuan Dokumentasi

Dokumentasi DBMS ini bertujuan untuk:

1. Menjelaskan DBMS dan teknologi penyimpanan data yang digunakan Finora.
2. Menjelaskan struktur tabel dan hubungan antartabel.
3. Menyediakan kamus data sebagai referensi pengembang dan administrator.
4. Menjelaskan penerapan primary key, foreign key, constraint, dan index.
5. Menjelaskan proses normalisasi database.
6. Mendokumentasikan alur penyimpanan data pembukuan dan chatbot.
7. Menyediakan struktur SQL PostgreSQL untuk kebutuhan deployment atau visualisasi ERD.

## 3. DBMS yang Digunakan

### 3.1 Database Relasional

Finora menggunakan SQLAlchemy sebagai Object Relational Mapper (ORM). Database default yang digunakan pada lingkungan lokal adalah SQLite. Untuk deployment atau kebutuhan produksi, sistem dapat menggunakan PostgreSQL melalui konfigurasi `DATABASE_URL_OVERRIDE`.

| Komponen | Keterangan |
|---|---|
| ORM | SQLAlchemy |
| Database lokal | SQLite |
| Database deployment | PostgreSQL |
| Format ID | UUID yang disimpan sebagai `VARCHAR(36)` |
| Migration aktual | `create_all` dan migrasi penambahan kolom |
| Migration versioned | Alembic belum digunakan |
| Vector database | Qdrant, terpisah dari database relasional |

### 3.2 Penyimpanan Data Desktop

Pada aplikasi desktop berbasis Electron, database dan file pendukung disimpan di direktori `userData` aplikasi. Data tersebut dapat meliputi database SQLite, file upload, log, embedding, konfigurasi, dan storage Qdrant lokal.

### 3.3 Vector Database

Qdrant digunakan untuk menyimpan embedding dokumen yang mendukung fitur chatbot berbasis Retrieval-Augmented Generation (RAG). Metadata dokumen tetap disimpan pada tabel `document_chunks`, sedangkan vector embedding disimpan di Qdrant.

Qdrant bukan bagian dari ERD relasional karena memiliki struktur penyimpanan dan mekanisme pencarian yang berbeda dari database SQL.

## 4. Arsitektur Database

Secara konseptual, database Finora dibagi menjadi beberapa domain:

```text
Database Finora
├── Autentikasi dan pengguna
│   └── users
├── Akuntansi dan pembukuan
│   ├── akun
│   ├── jurnal_umum
│   ├── jurnal_detail
│   └── tutup_buku
├── Upload dan knowledge base
│   ├── uploaded_files
│   └── document_chunks
├── Chatbot
│   ├── chat_sessions
│   └── chat_messages
├── Perpajakan
│   └── spt_tahunan
└── Layanan pendukung
    ├── notifications
    ├── feedback
    └── exit_feedback
```

Database terdiri dari **13 tabel**, **10 tipe enum PostgreSQL**, **17 foreign key**, berbagai unique constraint, dan index untuk mempercepat pencarian data.

## 5. Entity Relationship Diagram

Diagram ERD database Finora tersedia pada file:

```text
finora-erd.svg
```

Diagram tersebut menggambarkan tabel, primary key, foreign key, serta relasi antartabel. Warna biru pada diagram menunjukkan primary key, warna kuning menunjukkan foreign key, dan garis putus-putus menunjukkan relasi tambahan atau relasi dengan lebih dari satu foreign key ke tabel yang sama.

### 5.1 Relasi Utama

| Relasi | Kardinalitas | Keterangan |
|---|---:|---|
| `users` → `jurnal_umum` | 1:N | Satu pengguna dapat membuat banyak jurnal |
| `users` → `uploaded_files` | 1:N | Satu pengguna dapat mengunggah banyak file |
| `users` → `chat_sessions` | 1:N | Satu pengguna dapat memiliki banyak sesi chat |
| `users` → `spt_tahunan` | 1:N | Satu pengguna dapat memiliki banyak data SPT |
| `users` → `notifications` | 1:N | Satu pengguna dapat menerima banyak notifikasi |
| `users` → `feedback` | 1:N | Satu pengguna dapat mengirim banyak feedback |
| `users` → `exit_feedback` | 1:N | Satu pengguna dapat mengirim penilaian keluar |
| `akun` → `jurnal_detail` | 1:N | Satu akun dapat digunakan pada banyak detail jurnal |
| `jurnal_umum` → `jurnal_detail` | 1:N | Satu jurnal memiliki banyak baris debit/kredit |
| `uploaded_files` → `jurnal_umum` | 1:N | Satu file dapat menjadi sumber banyak jurnal |
| `uploaded_files` → `document_chunks` | 1:N | Satu file dapat dibagi menjadi banyak chunk |
| `chat_sessions` → `chat_messages` | 1:N | Satu sesi memiliki banyak pesan |
| `jurnal_umum` → `tutup_buku` | 1:N | Jurnal dapat dirujuk sebagai jurnal penutup atau prive |

## 6. Kamus Data

### 6.1 Tabel `users`

Menyimpan identitas, autentikasi, status, dan paket pengguna aplikasi.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key pengguna |
| `email` | `VARCHAR(255)` | Tidak | Email unik pengguna |
| `hashed_password` | `VARCHAR(255)` | Tidak | Password yang telah di-hash |
| `full_name` | `VARCHAR(255)` | Tidak | Nama lengkap |
| `role` | `role_user` | Ya | `ADMIN`, `OWNER`, atau `STAFF` |
| `company_name` | `VARCHAR(255)` | Ya | Nama perusahaan atau usaha |
| `is_active` | `BOOLEAN` | Ya | Status aktif pengguna |
| `email_verified` | `BOOLEAN` | Ya | Status verifikasi email |
| `setup_completed` | `BOOLEAN` | Ya | Status setup awal |
| `plan` | `plan_user` | Ya | Paket `FREE` atau `MAINTENANCE` |
| `maintenance_joined_at` | `TIMESTAMP` | Ya | Waktu bergabung maintenance |
| `last_seen_at` | `TIMESTAMP` | Ya | Waktu terakhir aktif |
| `verification_token` | `VARCHAR(255)` | Ya | Token verifikasi email |
| `reset_password_token` | `VARCHAR(255)` | Ya | Token reset password |
| `reset_password_expires` | `TIMESTAMP` | Ya | Masa berlaku token reset |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan data |
| `updated_at` | `TIMESTAMP` | Ya | Waktu perubahan data |

### 6.2 Tabel `akun`

Menyimpan daftar akun atau Chart of Accounts sesuai kebutuhan pembukuan SAK EMKM.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key akun |
| `kode_akun` | `VARCHAR(20)` | Tidak | Kode akun unik |
| `nama_akun` | `VARCHAR(150)` | Tidak | Nama akun |
| `kategori` | `kategori_akun` | Tidak | ASET, LIABILITAS, MODAL, PENDAPATAN, BEBAN |
| `sub_kategori` | `VARCHAR(100)` | Ya | Subkategori akun |
| `saldo_normal` | `saldo_normal` | Tidak | DEBIT atau KREDIT |
| `is_active` | `BOOLEAN` | Ya | Status akun |
| `deskripsi` | `TEXT` | Ya | Penjelasan akun |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan data |

### 6.3 Tabel `jurnal_umum`

Menyimpan header jurnal pembukuan. Detail debit dan kredit disimpan pada `jurnal_detail`.

| Kolom | Tipe | Null | Kunci/Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `no_bukti` | `VARCHAR(50)` | Tidak | Nomor bukti unik |
| `tanggal` | `DATE` | Tidak | Tanggal transaksi |
| `deskripsi` | `TEXT` | Tidak | Deskripsi transaksi |
| `jenis` | `jenis_jurnal` | Ya | UMUM, PENYESUAIAN, PENUTUP |
| `sumber_upload_id` | `VARCHAR(36)` | Ya | FK ke `uploaded_files.id` |
| `created_by_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `is_locked` | `BOOLEAN` | Ya | Penanda jurnal terkunci |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |

### 6.4 Tabel `jurnal_detail`

Menyimpan baris debit dan kredit dari suatu jurnal.

| Kolom | Tipe | Null | Kunci/Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `jurnal_id` | `VARCHAR(36)` | Tidak | FK ke `jurnal_umum.id`, cascade delete |
| `akun_id` | `VARCHAR(36)` | Tidak | FK ke `akun.id` |
| `urutan` | `INTEGER` | Ya | Urutan baris jurnal |
| `debit` | `NUMERIC(18,2)` | Ya | Nilai debit |
| `kredit` | `NUMERIC(18,2)` | Ya | Nilai kredit |
| `keterangan` | `VARCHAR(255)` | Ya | Keterangan baris |

### 6.5 Tabel `tutup_buku`

Menyimpan riwayat penutupan buku per pengguna dan tahun fiskal.

| Kolom | Tipe | Null | Kunci/Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `tahun` | `INTEGER` | Tidak | Tahun fiskal |
| `tanggal_tutup` | `DATE` | Tidak | Tanggal penutupan |
| `laba_bersih` | `NUMERIC(18,2)` | Ya | Nilai laba bersih |
| `jurnal_penutup_id` | `VARCHAR(36)` | Ya | FK ke jurnal penutup |
| `jurnal_penutup_no_bukti` | `VARCHAR(50)` | Ya | Nomor bukti jurnal penutup |
| `jurnal_prive_id` | `VARCHAR(36)` | Ya | FK ke jurnal prive |
| `jurnal_prive_no_bukti` | `VARCHAR(50)` | Ya | Nomor bukti jurnal prive |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |

Constraint unik pada `(user_id, tahun)` memastikan satu pengguna tidak melakukan tutup buku lebih dari satu kali untuk tahun yang sama.

### 6.6 Tabel `uploaded_files`

Menyimpan metadata file yang diunggah pengguna untuk transaksi atau knowledge base.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `original_filename` | `VARCHAR(255)` | Tidak | Nama file asli |
| `stored_path` | `VARCHAR(500)` | Tidak | Lokasi penyimpanan |
| `file_bytes` | `BYTEA` | Ya | Isi file pada PostgreSQL |
| `file_type` | `VARCHAR(10)` | Tidak | CSV, XLSX, XLS, atau PDF |
| `file_size_bytes` | `INTEGER` | Ya | Ukuran file |
| `status` | `status_upload` | Ya | Status pemrosesan file |
| `error_message` | `TEXT` | Ya | Pesan kesalahan |
| `uploaded_by_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `created_at` | `TIMESTAMP` | Ya | Waktu upload |
| `processed_at` | `TIMESTAMP` | Ya | Waktu selesai diproses |
| `context` | `VARCHAR(20)` | Ya | Konteks upload, misalnya setup atau chat |

### 6.7 Tabel `document_chunks`

Menyimpan potongan teks dokumen dan referensi vector point di Qdrant.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `source_file_id` | `VARCHAR(36)` | Tidak | FK ke `uploaded_files.id`, cascade delete |
| `chunk_index` | `INTEGER` | Tidak | Nomor urutan chunk |
| `content` | `TEXT` | Tidak | Isi teks chunk |
| `qdrant_point_id` | `VARCHAR(100)` | Tidak | ID vector di Qdrant |
| `token_count` | `INTEGER` | Ya | Jumlah token |
| `extra_metadata` | `TEXT` | Ya | Metadata tambahan berbentuk JSON string |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |

Constraint unik pada `(source_file_id, chunk_index)` mencegah duplikasi urutan chunk dalam satu file.

### 6.8 Tabel `chat_sessions`

Menyimpan sesi percakapan chatbot per pengguna.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `title` | `VARCHAR(255)` | Ya | Judul sesi percakapan |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |
| `updated_at` | `TIMESTAMP` | Ya | Waktu perubahan terakhir |

### 6.9 Tabel `chat_messages`

Menyimpan pesan pengguna dan jawaban chatbot.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `session_id` | `VARCHAR(36)` | Tidak | FK ke `chat_sessions.id`, cascade delete |
| `role` | `chat_role` | Tidak | USER atau ASSISTANT |
| `content` | `TEXT` | Tidak | Isi pesan |
| `retrieved_chunk_ids` | `TEXT` | Ya | Daftar ID chunk dalam format JSON |
| `created_at` | `TIMESTAMP` | Ya | Waktu pesan dibuat |

### 6.10 Tabel `spt_tahunan`

Menyimpan draft dan data SPT Tahunan pengguna.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `form_type` | `VARCHAR(10)` | Tidak | Jenis formulir, misalnya 1770 atau 1770S |
| `tahun_pajak` | `INTEGER` | Tidak | Tahun pajak |
| `status` | `VARCHAR(20)` | Ya | Status draft atau final |
| `data` | `JSON` | Tidak | Data formulir SPT |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |
| `updated_at` | `TIMESTAMP` | Ya | Waktu perubahan |

### 6.11 Tabel `notifications`

Menyimpan notifikasi yang diterima pengguna.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK penerima ke `users.id` |
| `sender_id` | `VARCHAR(36)` | Ya | FK pengirim ke `users.id` |
| `type` | `notification_type` | Ya | ADMIN, MONTHLY, SYSTEM |
| `title` | `VARCHAR(150)` | Tidak | Judul notifikasi |
| `message` | `TEXT` | Tidak | Isi notifikasi |
| `link` | `VARCHAR(200)` | Ya | Tujuan navigasi frontend |
| `is_read` | `BOOLEAN` | Ya | Status sudah dibaca |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |

Tabel ini memiliki dua relasi menuju `users`, yaitu pengguna penerima dan pengguna pengirim.

### 6.12 Tabel `feedback`

Menyimpan komplain, pertanyaan, atau saran dari pengguna.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK pengirim ke `users.id` |
| `category` | `feedback_category` | Ya | Kategori feedback |
| `subject` | `VARCHAR(200)` | Tidak | Subjek feedback |
| `message` | `TEXT` | Tidak | Isi feedback |
| `status` | `feedback_status` | Ya | OPEN, REPLIED, CLOSED |
| `admin_reply` | `TEXT` | Ya | Balasan admin |
| `replied_at` | `TIMESTAMP` | Ya | Waktu balasan |
| `replied_by_id` | `VARCHAR(36)` | Ya | FK admin pembalas ke `users.id` |
| `created_at` | `TIMESTAMP` | Ya | Waktu pembuatan |
| `updated_at` | `TIMESTAMP` | Ya | Waktu perubahan |

### 6.13 Tabel `exit_feedback`

Menyimpan rating singkat dari pengguna saat keluar dari aplikasi.

| Kolom | Tipe | Null | Keterangan |
|---|---|---:|---|
| `id` | `VARCHAR(36)` | Tidak | Primary key |
| `user_id` | `VARCHAR(36)` | Tidak | FK ke `users.id` |
| `rating` | `INTEGER` | Tidak | Nilai penilaian pengguna |
| `comment` | `TEXT` | Ya | Komentar tambahan |
| `created_at` | `TIMESTAMP` | Ya | Waktu penilaian |

## 7. Tipe Enum

PostgreSQL menggunakan tipe enum untuk membatasi nilai pada kolom tertentu.

| Nama enum | Nilai |
|---|---|
| `kategori_akun` | ASET, LIABILITAS, MODAL, PENDAPATAN, BEBAN |
| `saldo_normal` | DEBIT, KREDIT |
| `jenis_jurnal` | UMUM, PENYESUAIAN, PENUTUP |
| `status_upload` | UPLOADED, STAGED, PROCESSING, NORMALIZED, INGESTED, POSTED, FAILED |
| `role_user` | ADMIN, OWNER, STAFF |
| `plan_user` | FREE, MAINTENANCE |
| `chat_role` | USER, ASSISTANT |
| `feedback_category` | COMPLAINT, QUESTION, SUGGESTION, OTHER |
| `feedback_status` | OPEN, REPLIED, CLOSED |
| `notification_type` | ADMIN, MONTHLY, SYSTEM |

## 8. Normalisasi Database

### 8.1 First Normal Form (1NF)

Database memenuhi prinsip 1NF karena setiap kolom menyimpan nilai atomik dan setiap tabel memiliki primary key. Contohnya, data debit dan kredit disimpan sebagai kolom terpisah pada `jurnal_detail`, bukan sebagai daftar nilai dalam satu kolom.

Kolom JSON seperti `spt_tahunan.data` dan teks JSON pada `retrieved_chunk_ids` merupakan pengecualian yang disengaja untuk data formulir dinamis dan metadata chatbot.

### 8.2 Second Normal Form (2NF)

Database memenuhi 2NF karena setiap atribut non-key bergantung pada keseluruhan primary key. Sebagian besar tabel menggunakan primary key tunggal berupa `id`. Constraint komposit pada `tutup_buku` dan `document_chunks` digunakan untuk mencegah duplikasi data, bukan sebagai primary key utama.

### 8.3 Third Normal Form (3NF)

Database dirancang mendekati 3NF karena data yang berbeda dipisahkan ke dalam tabel masing-masing. Contohnya:

- Data pengguna disimpan di `users`.
- Daftar akun disimpan di `akun`.
- Header jurnal disimpan di `jurnal_umum`.
- Detail debit dan kredit disimpan di `jurnal_detail`.
- Data file disimpan di `uploaded_files`.
- Data percakapan dipisah menjadi `chat_sessions` dan `chat_messages`.

Dengan pemisahan ini, perubahan data pengguna atau akun tidak perlu dilakukan berulang pada tabel transaksi.

### 8.4 Data Turunan

`Buku Besar`, `Neraca Saldo`, dan laporan keuangan tidak disimpan sebagai tabel khusus. Data tersebut dihitung dari `jurnal_detail` dan tabel terkait pada saat dibutuhkan. Pendekatan ini mengurangi duplikasi dan mencegah perbedaan antara data jurnal dengan laporan turunannya.

## 9. Integritas Data

### 9.1 Primary Key

Semua tabel memiliki primary key `id` dengan format `VARCHAR(36)`. Primary key berfungsi sebagai identitas unik setiap record.

### 9.2 Foreign Key

Foreign key menjaga hubungan antarentitas, misalnya:

- `jurnal_umum.created_by_id` mengarah ke `users.id`.
- `jurnal_detail.jurnal_id` mengarah ke `jurnal_umum.id`.
- `jurnal_detail.akun_id` mengarah ke `akun.id`.
- `chat_messages.session_id` mengarah ke `chat_sessions.id`.
- `document_chunks.source_file_id` mengarah ke `uploaded_files.id`.

### 9.3 Cascade Delete

Cascade delete digunakan pada hubungan berikut:

- Menghapus `jurnal_umum` akan menghapus `jurnal_detail` terkait.
- Menghapus `uploaded_files` akan menghapus `document_chunks` terkait.
- Menghapus `chat_sessions` akan menghapus `chat_messages` terkait.

### 9.4 Unique Constraint

Unique constraint diterapkan pada:

- `users.email`
- `akun.kode_akun`
- `jurnal_umum.no_bukti`
- `tutup_buku(user_id, tahun)`
- `document_chunks(source_file_id, chunk_index)`

### 9.5 Index

Index dibuat pada kolom yang sering digunakan untuk pencarian atau filter, seperti email, kode akun, tanggal jurnal, pengguna, status feedback, tahun pajak, dan status notifikasi. Index komposit juga digunakan pada:

- `jurnal_umum(created_by_id, tanggal)`
- `tutup_buku(user_id, tahun)`
- `feedback(user_id, status)`

## 10. Alur Data Database

### 10.1 Alur Pembukuan

```text
Pengguna memasukkan transaksi
        ↓
Input manual atau import file
        ↓
Jurnal Umum
        ↓
Jurnal Detail
        ↓
Buku Besar dan Neraca Saldo
        ↓
Jurnal Penyesuaian
        ↓
Laporan Keuangan
        ↓
Tutup Buku dan periode berikutnya
```

Data `Buku Besar` dan `Neraca Saldo` merupakan hasil agregasi dari jurnal, sehingga tidak memiliki tabel khusus.

### 10.2 Alur Upload Transaksi

```text
File CSV/Excel diunggah
        ↓
uploaded_files
        ↓
Validasi dan normalisasi
        ↓
Jurnal Umum
        ↓
Jurnal Detail
        ↓
Laporan keuangan
```

### 10.3 Alur Knowledge Base dan Chatbot

```text
File PDF atau dokumen
        ↓
uploaded_files
        ↓
Ekstraksi dan pemotongan teks
        ↓
document_chunks
        ↓
Embedding
        ↓
Qdrant
        ↓
Retrieval-Augmented Generation
        ↓
chat_sessions dan chat_messages
```

### 10.4 Alur SPT Tahunan

```text
Data keuangan dan pajak
        ↓
Perhitungan pajak
        ↓
Formulir SPT 1770 / 1770S
        ↓
spt_tahunan
        ↓
Preview atau export dokumen
```

## 11. Keamanan Database

Finora menerapkan beberapa mekanisme keamanan:

1. Password tidak disimpan dalam bentuk teks biasa, tetapi menggunakan hash bcrypt.
2. Autentikasi menggunakan JWT yang disimpan pada cookie akses.
3. Endpoint tertentu dilindungi oleh dependency `get_current_user`.
4. Endpoint administrator dilindungi oleh `require_admin`.
5. Foreign key membatasi hubungan data agar tetap valid.
6. Secret key dan konfigurasi database disimpan melalui environment variable.
7. File dan data pengguna dipisahkan berdasarkan pengguna yang mengunggah atau memiliki data.

Credential database tidak boleh disimpan di dalam dokumentasi, source code, atau repository publik.

## 12. Backup dan Pemeliharaan

Untuk database SQLite lokal, backup dapat dilakukan dengan menyalin file database ketika aplikasi tidak sedang melakukan transaksi. Untuk deployment PostgreSQL, backup dapat dilakukan menggunakan mekanisme dump PostgreSQL dan penyimpanan cadangan terjadwal.

Repository Finora saat ini menggunakan pembuatan tabel otomatis dan migrasi forward-only. Mekanisme tersebut dapat menambahkan tabel atau kolom yang belum tersedia, tetapi belum menyediakan riwayat revision dan rollback seperti Alembic.

Untuk pengembangan lebih lanjut, disarankan:

1. Menggunakan Alembic untuk migration versioning.
2. Menyimpan riwayat perubahan skema.
3. Menambahkan prosedur rollback.
4. Melakukan backup sebelum migration production.
5. Menambahkan constraint validasi debit dan kredit.
6. Menambahkan validasi nilai `rating`, `form_type`, dan `status`.
7. Menggunakan PostgreSQL untuk deployment multi-user berskala lebih besar.

## 13. DDL PostgreSQL

DDL lengkap tersedia pada file berikut:

```text
finora-erd.sql
```

File tersebut dapat digunakan untuk:

- Membuat struktur database PostgreSQL.
- Diimpor ke aplikasi visualisasi ERD.
- Menjadi referensi implementasi skema database.
- Dibaca menggunakan DBeaver, DataGrip, dbdiagram.io, atau tool sejenis.

Contoh pembuatan tipe enum:

```sql
CREATE TYPE role_user AS ENUM ('ADMIN', 'OWNER', 'STAFF');
CREATE TYPE jenis_jurnal AS ENUM ('UMUM', 'PENYESUAIAN', 'PENUTUP');
```

Contoh pembuatan tabel dengan foreign key:

```sql
CREATE TABLE jurnal_detail (
    id VARCHAR(36) PRIMARY KEY,
    jurnal_id VARCHAR(36) NOT NULL
        REFERENCES jurnal_umum(id) ON DELETE CASCADE,
    akun_id VARCHAR(36) NOT NULL
        REFERENCES akun(id),
    urutan INTEGER DEFAULT 0,
    debit NUMERIC(18, 2) DEFAULT 0,
    kredit NUMERIC(18, 2) DEFAULT 0,
    keterangan VARCHAR(255)
);
```

## 14. Keterbatasan Implementasi

Beberapa aturan bisnis masih dijalankan pada lapisan aplikasi dan belum seluruhnya dipaksakan oleh database, antara lain:

- Validasi bahwa debit atau kredit harus bernilai sesuai aturan jurnal.
- Validasi keseimbangan total debit dan total kredit dalam satu jurnal.
- Validasi nilai rating feedback.
- Validasi pilihan `form_type` SPT.
- Validasi status SPT.

Pemisahan aturan pada lapisan aplikasi memberi fleksibilitas, tetapi constraint database tambahan dapat meningkatkan perlindungan terhadap data yang tidak valid.

## 15. Kesimpulan

DBMS Finora dirancang menggunakan model relasional yang memisahkan data berdasarkan domain pengguna, akuntansi, upload, chatbot, perpajakan, dan layanan pendukung. Struktur tersebut membantu menjaga konsistensi data dan mendukung proses pembukuan berbasis SAK EMKM.

Tabel inti akuntansi terdiri dari `akun`, `jurnal_umum`, dan `jurnal_detail`. Dari data tersebut, sistem menghasilkan buku besar, neraca saldo, dan laporan keuangan secara dinamis. Data pengguna, file, SPT, percakapan, notifikasi, dan feedback disimpan pada tabel terpisah dengan hubungan melalui foreign key.

Dengan adanya primary key, foreign key, unique constraint, index, serta pemisahan data berdasarkan entitas, database Finora dapat mendukung proses pembukuan secara terstruktur. Untuk pengembangan berikutnya, penerapan Alembic, constraint validasi bisnis, backup berkala, serta PostgreSQL pada lingkungan produksi dapat meningkatkan keandalan sistem.
