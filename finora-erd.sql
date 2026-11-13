CREATE TYPE kategori_akun AS ENUM ('ASET', 'LIABILITAS', 'MODAL', 'PENDAPATAN', 'BEBAN');
CREATE TYPE saldo_normal AS ENUM ('DEBIT', 'KREDIT');
CREATE TYPE jenis_jurnal AS ENUM ('UMUM', 'PENYESUAIAN', 'PENUTUP');
CREATE TYPE status_upload AS ENUM ('UPLOADED', 'STAGED', 'PROCESSING', 'NORMALIZED', 'INGESTED', 'POSTED', 'FAILED');
CREATE TYPE role_user AS ENUM ('ADMIN', 'OWNER', 'STAFF');
CREATE TYPE plan_user AS ENUM ('FREE', 'MAINTENANCE');
CREATE TYPE chat_role AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE feedback_category AS ENUM ('COMPLAINT', 'QUESTION', 'SUGGESTION', 'OTHER');
CREATE TYPE feedback_status AS ENUM ('OPEN', 'REPLIED', 'CLOSED');
CREATE TYPE notification_type AS ENUM ('ADMIN', 'MONTHLY', 'SYSTEM');

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role role_user DEFAULT 'OWNER',
    company_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    setup_completed BOOLEAN DEFAULT FALSE,
    plan plan_user DEFAULT 'FREE',
    maintenance_joined_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE akun (
    id VARCHAR(36) PRIMARY KEY,
    kode_akun VARCHAR(20) NOT NULL UNIQUE,
    nama_akun VARCHAR(150) NOT NULL,
    kategori kategori_akun NOT NULL,
    sub_kategori VARCHAR(100),
    saldo_normal saldo_normal NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    deskripsi TEXT,
    created_at TIMESTAMP
);

CREATE TABLE uploaded_files (
    id VARCHAR(36) PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_path VARCHAR(500) NOT NULL,
    file_bytes BYTEA,
    file_type VARCHAR(10) NOT NULL,
    file_size_bytes INTEGER DEFAULT 0,
    status status_upload DEFAULT 'UPLOADED',
    error_message TEXT,
    uploaded_by_id VARCHAR(36) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP,
    processed_at TIMESTAMP,
    context VARCHAR(20)
);

CREATE TABLE jurnal_umum (
    id VARCHAR(36) PRIMARY KEY,
    no_bukti VARCHAR(50) NOT NULL UNIQUE,
    tanggal DATE NOT NULL,
    deskripsi TEXT NOT NULL,
    jenis jenis_jurnal DEFAULT 'UMUM',
    sumber_upload_id VARCHAR(36) REFERENCES uploaded_files(id),
    created_by_id VARCHAR(36) NOT NULL REFERENCES users(id),
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
);

CREATE TABLE jurnal_detail (
    id VARCHAR(36) PRIMARY KEY,
    jurnal_id VARCHAR(36) NOT NULL REFERENCES jurnal_umum(id) ON DELETE CASCADE,
    akun_id VARCHAR(36) NOT NULL REFERENCES akun(id),
    urutan INTEGER DEFAULT 0,
    debit NUMERIC(18, 2) DEFAULT 0,
    kredit NUMERIC(18, 2) DEFAULT 0,
    keterangan VARCHAR(255)
);

CREATE TABLE tutup_buku (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    tahun INTEGER NOT NULL,
    tanggal_tutup DATE NOT NULL,
    laba_bersih NUMERIC(18, 2) DEFAULT 0,
    jurnal_penutup_id VARCHAR(36) REFERENCES jurnal_umum(id),
    jurnal_penutup_no_bukti VARCHAR(50),
    jurnal_prive_id VARCHAR(36) REFERENCES jurnal_umum(id),
    jurnal_prive_no_bukti VARCHAR(50),
    created_at TIMESTAMP,
    CONSTRAINT uq_tutup_buku_user_tahun UNIQUE (user_id, tahun)
);

CREATE TABLE document_chunks (
    id VARCHAR(36) PRIMARY KEY,
    source_file_id VARCHAR(36) NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    qdrant_point_id VARCHAR(100) NOT NULL,
    token_count INTEGER,
    extra_metadata TEXT,
    created_at TIMESTAMP,
    CONSTRAINT uq_chunk_per_file UNIQUE (source_file_id, chunk_index)
);

CREATE TABLE chat_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    title VARCHAR(255) DEFAULT 'Percakapan baru',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE spt_tahunan (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    form_type VARCHAR(10) NOT NULL,
    tahun_pajak INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    data JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role chat_role NOT NULL,
    content TEXT NOT NULL,
    retrieved_chunk_ids TEXT,
    created_at TIMESTAMP
);

CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    sender_id VARCHAR(36) REFERENCES users(id),
    type notification_type DEFAULT 'ADMIN',
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(200),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
);

CREATE TABLE feedback (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    category feedback_category DEFAULT 'COMPLAINT',
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status feedback_status DEFAULT 'OPEN',
    admin_reply TEXT,
    replied_at TIMESTAMP,
    replied_by_id VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE exit_feedback (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP
);

CREATE INDEX ix_users_email ON users(email);
CREATE INDEX ix_users_verification_token ON users(verification_token);
CREATE INDEX ix_users_reset_password_token ON users(reset_password_token);
CREATE INDEX ix_akun_kode_akun ON akun(kode_akun);
CREATE INDEX ix_jurnal_umum_no_bukti ON jurnal_umum(no_bukti);
CREATE INDEX ix_jurnal_umum_tanggal ON jurnal_umum(tanggal);
CREATE INDEX ix_jurnal_umum_sumber_upload_id ON jurnal_umum(sumber_upload_id);
CREATE INDEX ix_jurnal_umum_created_by_id ON jurnal_umum(created_by_id);
CREATE INDEX ix_jurnal_umum_created_tanggal ON jurnal_umum(created_by_id, tanggal);
CREATE INDEX ix_jurnal_detail_jurnal_id ON jurnal_detail(jurnal_id);
CREATE INDEX ix_jurnal_detail_akun_id ON jurnal_detail(akun_id);
CREATE INDEX ix_tutup_buku_user_id ON tutup_buku(user_id);
CREATE INDEX ix_tutup_buku_user_tahun ON tutup_buku(user_id, tahun);
CREATE INDEX ix_uploaded_files_uploaded_by_id ON uploaded_files(uploaded_by_id);
CREATE INDEX ix_document_chunks_qdrant_point_id ON document_chunks(qdrant_point_id);
CREATE INDEX ix_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX ix_spt_tahunan_user_id ON spt_tahunan(user_id);
CREATE INDEX ix_spt_tahunan_tahun_pajak ON spt_tahunan(tahun_pajak);
CREATE INDEX ix_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX ix_notifications_user_id ON notifications(user_id);
CREATE INDEX ix_notifications_is_read ON notifications(is_read);
CREATE INDEX ix_notifications_created_at ON notifications(created_at);
CREATE INDEX ix_feedback_user_id ON feedback(user_id);
CREATE INDEX ix_feedback_status ON feedback(status);
CREATE INDEX ix_feedback_user_status ON feedback(user_id, status);
CREATE INDEX ix_feedback_replied_by_id ON feedback(replied_by_id);
CREATE INDEX ix_exit_feedback_user_id ON exit_feedback(user_id);

COMMENT ON TABLE users IS 'Pengguna aplikasi Finora';
COMMENT ON TABLE akun IS 'Daftar akun atau chart of accounts';
COMMENT ON TABLE jurnal_umum IS 'Header jurnal umum';
COMMENT ON TABLE jurnal_detail IS 'Detail debit dan kredit jurnal';
COMMENT ON TABLE uploaded_files IS 'Metadata file yang diunggah pengguna';
COMMENT ON TABLE document_chunks IS 'Potongan dokumen untuk knowledge base dan RAG';
COMMENT ON TABLE chat_sessions IS 'Sesi percakapan chatbot';
COMMENT ON TABLE chat_messages IS 'Pesan dalam sesi chatbot';
COMMENT ON TABLE spt_tahunan IS 'Data SPT Tahunan pengguna';
COMMENT ON TABLE tutup_buku IS 'Riwayat penutupan buku tahunan';
COMMENT ON TABLE notifications IS 'Notifikasi pengguna';
COMMENT ON TABLE feedback IS 'Feedback pengguna kepada admin';
COMMENT ON TABLE exit_feedback IS 'Penilaian pengguna saat keluar aplikasi';
