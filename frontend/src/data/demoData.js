export const DEMO_DASHBOARD = {
  saldoKas: 18450000,
  saldoBank: 86500000,
  pendapatan: 125000000,
  beban: 76800000,
  labaBersih: 48200000,
  jumlahTransaksi: 342,
  barData: [
    { name: 'Feb', Pendapatan: 62, Beban: 41 },
    { name: 'Mar', Pendapatan: 74, Beban: 47 },
    { name: 'Apr', Pendapatan: 68, Beban: 52 },
    { name: 'Mei', Pendapatan: 91, Beban: 60 },
    { name: 'Jun', Pendapatan: 85, Beban: 55 },
    { name: 'Jul', Pendapatan: 108, Beban: 63 },
  ],
  pieData: [
    { name: 'Saldo Kas', value: 18450000, color: '#2563EB' },
    { name: 'Saldo Bank', value: 86500000, color: '#059669' },
  ],
}

export const DEMO_CHAT = [
  { role: 'user', text: 'Bagaimana mencatat penjualan tunai sesuai SAK EMKM?' },
  {
    role: 'assistant',
    text: 'Pada SAK EMKM, penjualan tunai dicatat ke akun Kas di sisi debit dan akun Pendapatan Penjualan di sisi kredit. Entri jurnalnya:\nDebit  Kas — Rp 1.500.000\nKredit  Pendapatan Penjualan — Rp 1.500.000',
    source: 'Standar Akuntansi Keuangan EMKM — Bab 3, ayat 1.2',
  },
]

export const DEMO_JURNAL = [
  { no: 'JV-001', tanggal: '02 Mar', deskripsi: 'Penjualan tunai - Toko Andika', debit: '', kredit: 2175000 },
  { no: 'JV-002', tanggal: '05 Mar', deskripsi: 'Pembelian persediaan dagang', debit: 875000, kredit: '' },
  { no: 'JV-003', tanggal: '09 Mar', deskripsi: 'Pembayaran gaji karyawan', debit: 2400000, kredit: '' },
  { no: 'JV-004', tanggal: '12 Mar', deskripsi: 'Penerimaan pembayaran piutang', debit: '', kredit: 1100000 },
]

export const DEMO_LAPORAN = {
  totalAset: 262500000,
  totalLiabilitas: 87500000,
  totalModal: 175000000,
  labaTahun: 48200000,
}

export const DEMO_PAJAK = {
  omzet: 85000000,
  pphFinal: 425000,
  tarif: '0,5%',
  omzetKumulatif: 600000000,
  catatan: 'Wajib pajak UMKM dengan peredaran bruto di bawah Rp 4,8 miliar dikenakan PPh Final 0,5% dari omzet.',
}

export const DEMO_UPLOAD = {
  filename: 'transaksi-maret-2026.csv',
  size: '2,4 MB',
  tipe: 'CSV',
}
