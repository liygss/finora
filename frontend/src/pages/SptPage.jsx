import { useState, useEffect, useMemo, useRef } from 'react'
import client from '../api/client'
import { formatRupiah, formatDate } from '../utils/formatters'
import { buildSptPrintHtml } from '../utils/sptPdfBuilder'
import { contohData } from '../data/sptTutorial'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import {
  User, Wallet, Receipt, Home, Users, FileCheck, Calculator,
  Save, Printer, Trash2, Plus, FileSpreadsheet, History, Landmark, Info,
  Sparkles, X, MessageCircle,
} from 'lucide-react'
import { openTaxConsultation } from '../utils/chatbotEvents'

const STATUS_KAWIN = [
  { value: 'KK', label: 'Kawin — Kewajiban Pajak Gabung (KK)' },
  { value: 'HB', label: 'Kawin — Hidup Berpisah (HB)' },
  { value: 'PH', label: 'Kawin — Pisah Harta & Penghasilan (PH)' },
  { value: 'MT', label: 'Kawin — Istri Pilih Kewajiban Terpisah (MT)' },
]

const JENIS_POTONG = ['21', '22', '23', '24', '26', 'DTP']

const RESTITUSI = [
  { value: '', label: 'Tidak ada' },
  { value: 'KOMPENSASI', label: 'Kompenasasi (diperhitungkan dgn utang pajak)' },
  { value: 'SKPPKP_17C', label: 'Restitusi — SKPPKP Pasal 17C' },
  { value: 'SKPPKP_17D', label: 'Restitusi — SKPPKP Pasal 17D' },
]

const clone = (v) => JSON.parse(JSON.stringify(v))

function emptyData(formType = '1770') {
  return {
    identitas: {
      npwp: '', nama: '', jenis_usaha: '', pekerjaan_utama: '', klu: '',
      no_telepon: '', no_faks: '', status_kawin: 'KK', npwp_pasangan: '',
      alamat: '', kelurahan_kecamatan: '', pembetulan_ke: 0,
      tahun_pajak: new Date().getFullYear() - 1, jenis_form: formType,
    },
    penghasilan: {
      metode: 'pembukuan',
      usaha: {
        peredaran_usaha: 0, hpp: 0, laba_rugi_bruto: 0, biaya_usaha: 0,
        penghasilan_neto_komersial: 0, penyesuaian_positif: {},
        jumlah_penyesuaian_positif: 0, penyesuaian_negatif: {},
        jumlah_penyesuaian_negatif: 0,
      },
      usaha_pencatatan: { jenis_usaha: '', norma_persen: 0, peredaran_usaha: 0 },
      pekerjaan: [],
      dalam_negeri_lainnya: [],
      bukan_objek: [],
      luar_negeri: 0,
      zakat: 0,
      kompensasi_kerugian: 0,
      pengembalian_pph_24: 0,
      final: [],
    },
    kredit_pajak: { dalam_negeri: 0, pemotongan: [], pph_dibayar_sendiri_25: 0, stp_pph_25: 0 },
    harta: [],
    utang: [],
    tanggungan: [],
    permohonan: { restitusi: '', angsuran_25: '1_12' },
  }
}

function mergeDefaults(d) {
  const base = emptyData(d?.identitas?.jenis_form || '1770')
  const merged = {
    ...base,
    ...clone(d || {}),
    identitas: { ...base.identitas, ...(d?.identitas || {}) },
    penghasilan: {
      ...base.penghasilan,
      ...(d?.penghasilan || {}),
      usaha: { ...base.penghasilan.usaha, ...(d?.penghasilan?.usaha || {}) },
      usaha_pencatatan: { ...base.penghasilan.usaha_pencatatan, ...(d?.penghasilan?.usaha_pencatatan || {}) },
    },
    kredit_pajak: { ...base.kredit_pajak, ...(d?.kredit_pajak || {}) },
    permohonan: { ...base.permohonan, ...(d?.permohonan || {}) },
  }
  return merged
}

function sumDict(dict) {
  return Object.values(dict || {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

// Format pesan error dari axios: detail 422 berupa array -> dirangkai jadi
// teks terbaca supaya user tahu field mana yang bermasalah.
function fmtErr(err, fallback) {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) {
    return `${fallback}: ${detail.map((d) => d?.msg || JSON.stringify(d)).join('; ')}`
  }
  return (typeof detail === 'string' && detail) || fallback
}

function setPath(data, path, value) {
  if (path.length === 1) return { ...data, [path[0]]: value }
  const [head, ...rest] = path
  return { ...data, [head]: setPath(data[head] ?? {}, rest, value) }
}

function buildPayload(data, formType) {
  const p = clone(data)
  const usaha = p.penghasilan.usaha
  usaha.laba_rugi_bruto = (usaha.peredaran_usaha || 0) - (usaha.hpp || 0)
  usaha.penghasilan_neto_komersial = usaha.laba_rugi_bruto - (usaha.biaya_usaha || 0)
  usaha.jumlah_penyesuaian_positif = sumDict(usaha.penyesuaian_positif)
  usaha.jumlah_penyesuaian_negatif = sumDict(usaha.penyesuaian_negatif)
  p.identitas.jenis_form = formType
  return p
}

function Field({ label, children, className, contoh }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {contoh && (
        <p className="mt-1 text-[11px] flex items-center gap-1.5">
          <Sparkles size={11} style={{ color: 'var(--color-accent-blue)' }} />
          <span style={{ color: 'var(--color-slate-muted)' }}>Contoh:</span>
          <code className="font-mono rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-accent-blue)' }}>{contoh}</code>
        </p>
      )}
    </div>
  )
}

function NumField({ value, onChange, placeholder, className }) {
  // Sanitasi value dari state: NaN/Infinity/undefined/null/string -> 0.
  // Ini penting karena tipe `number` di browser bisa menghasilkan transient
  // seperti "5e" atau "-" saat user mengetik parsial, yang Number(...) = NaN
  // dan JSON.stringify(NaN) = null -> backend Pydantic tolak (422).
  // Number(value) juga menangani string-numerik dari draft lama ("50000" -> 50000).
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0
  return (
    <input
      type="number" min="0" step="any"
      value={safe === 0 ? '' : safe}
      onChange={(e) => {
        const v = e.target.value === '' ? 0 : Number(e.target.value)
        onChange(Number.isFinite(v) ? v : 0)
      }}
      className={className || 'input-field'}
      placeholder={placeholder || '0'}
    />
  )
}

function SelectField({ value, onChange, options }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input-field">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function ItemEditor({ title, items, fields, onChange, addDefault }) {
  const set = (i, key, val) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div className="mt-3 space-y-3">
      {items.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>Belum ada data. Klik <span className="font-semibold" style={{ color: 'var(--color-accent-blue)' }}>+ Tambah</span> untuk menambah.</p>
      )}
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                className={f.className}
                contoh={f.contoh && (it[f.key] == null || it[f.key] === '' || it[f.key] === 0) ? f.contoh : undefined}
              >
                {f.type === 'number'
                  ? <NumField value={it[f.key]} onChange={(v) => set(i, f.key, v)} placeholder={f.placeholder} />
                  : f.type === 'select'
                    ? <SelectField value={it[f.key]} onChange={(v) => set(i, f.key, v)} options={f.options} />
                    : <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        value={it[f.key] ?? ''}
                        onChange={(e) => set(i, f.key, e.target.value)}
                        className="input-field"
                        placeholder={f.placeholder}
                      />}
              </Field>
            ))}
          </div>
          <button type="button" onClick={() => remove(i)} className="btn-ghost text-xs mt-2" style={{ color: '#F87171' }}>
            <Trash2 size={12} className="inline mr-1" />Hapus
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...addDefault }])} className="btn-secondary text-xs">
        <Plus size={14} /> Tambah {title}
      </button>
    </div>
  )
}

function PenyesuaianEditor({ title, values, onChange }) {
  const entries = Object.entries(values || {})
  const total = sumDict(values)
  const setVal = (label, v) => onChange({ ...values, [label]: v })
  const setLabel = (old, next) => {
    const { [old]: v, ...rest } = values
    onChange({ ...rest, [next]: v })
  }
  const remove = (label) => {
    const { [label]: _omit, ...rest } = values
    onChange(rest)
  }
  return (
    <div className="mt-3">
      <div className="space-y-2">
        {entries.map(([label, v]) => (
          <div key={label} className="flex gap-2 items-center">
            <input
              type="text" value={label}
              onChange={(e) => setLabel(label, e.target.value)}
              className="input-field !py-2"
              placeholder="Uraian penyesuaian"
            />
            <div className="w-40 shrink-0">
              <NumField value={v} onChange={(nv) => setVal(label, nv)} />
            </div>
            <button type="button" onClick={() => remove(label)} className="p-2 rounded-xl hover:bg-red-500/10" style={{ color: '#F87171' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange({ ...values, [`${title} ${entries.length + 1}`]: 0 })} className="btn-secondary text-xs mt-2">
        <Plus size={14} /> Tambah {title}
      </button>
      <div className="mt-2 text-xs font-semibold flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
        <span style={{ color: 'var(--color-slate-body)' }}>Jumlah {title}</span>
        <span className="font-mono" style={{ color: 'var(--color-accent-blue)' }}>{formatRupiah(total)}</span>
      </div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, desc, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl p-3" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
          <Icon size={18} style={{ color: 'var(--color-accent-blue)' }} />
        </div>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>{title}</h3>
          {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

const SECTIONS = [
  { id: 'identitas', label: 'Identitas WP', icon: User },
  { id: 'penghasilan', label: 'Penghasilan', icon: Wallet },
  { id: 'kredit', label: 'Kredit Pajak', icon: Receipt },
  { id: 'harta', label: 'Harta & Utang', icon: Home },
  { id: 'tanggungan', label: 'Tanggungan', icon: Users },
  { id: 'permohonan', label: 'Permohonan', icon: FileCheck },
  { id: 'hasil', label: 'Hasil & Cetak', icon: Calculator },
]

const PREVIEW_1770 = [
  ['1', 'Penghasilan neto usaha / pekerjaan bebas', 'angka_1'],
  ['2', 'Penghasilan neto dari pekerjaan', 'angka_2'],
  ['3', 'Penghasilan neto dalam negeri lainnya', 'angka_3'],
  ['4', 'Penghasilan neto luar negeri', 'angka_4'],
  ['5', 'Jumlah penghasilan neto (1+2+3+4)', 'angka_5'],
  ['6', 'Zakat / sumbangan keagamaan wajib', 'angka_6'],
  ['7', 'Neto setelah zakat (5-6)', 'angka_7'],
  ['8', 'Kompensasi kerugian', 'angka_8'],
  ['9', 'Neto setelah kompensasi (7-8)', 'angka_9'],
  ['10', 'Penghasilan Tidak Kena Pajak (PTKP)', 'angka_10'],
  ['11', 'Penghasilan Kena Pajak (9-10)', 'angka_11'],
  ['12', 'PPh terutang (Pasal 17)', 'angka_12'],
  ['13', 'Pengembalian / pengurangan PPh 24', 'pengembalian_pph_24'],
  ['14', 'Jumlah PPh terutang (12+13)', 'jumlah_pph_terutang'],
  ['15', 'Kredit pajak (dipotong pihak lain + PPh 24)', 'angka_15'],
  ['16a', 'PPh yang harus dibayar sendiri (14-15)', 'angka_16'],
  ['16b', 'PPh yang lebih dipotong/dipungut', 'pph_lebih_dipotong'],
  ['17a', 'PPh Pasal 25 yang dibayar sendiri', 'angka_17'],
  ['17b', 'STP PPh Pasal 25', 'stp_pph_25'],
  ['18', 'Jumlah kredit PPh 25 (17a+17b)', 'jumlah_kredit_pph_25'],
  ['19a', 'PPh kurang bayar (Pasal 29)', 'angka_19a'],
  ['19b', 'PPh lebih bayar (28A)', 'angka_19b'],
  ['21', 'Angsuran PPh 25 tahun berikutnya', 'angka_21'],
]

const PREVIEW_1770S = [
  ['1', 'Penghasilan neto dari pekerjaan', 'angka_2'],
  ['2', 'Penghasilan neto dalam negeri lainnya', 'angka_3'],
  ['3', 'Penghasilan neto luar negeri', 'angka_4'],
  ['4', 'Jumlah penghasilan neto (1+2+3)', 'angka_5'],
  ['5', 'Zakat / sumbangan keagamaan wajib', 'angka_6'],
  ['6', 'Neto setelah zakat (4-5)', 'angka_7'],
  ['7', 'Penghasilan Tidak Kena Pajak (PTKP)', 'angka_10'],
  ['8', 'Penghasilan Kena Pajak (6-7)', 'angka_11'],
  ['9', 'PPh terutang (Pasal 17)', 'angka_12'],
  ['10', 'Pengembalian / pengurangan PPh 24', 'pengembalian_pph_24'],
  ['11', 'Jumlah PPh terutang (9+10)', 'jumlah_pph_terutang'],
  ['12', 'Kredit pajak (dipotong pihak lain)', 'angka_15'],
  ['13a', 'PPh yang harus dibayar sendiri (11-12)', 'angka_16'],
  ['13b', 'PPh yang lebih dipotong/dipungut', 'pph_lebih_dipotong'],
  ['14a', 'PPh Pasal 25 yang dibayar sendiri', 'angka_17'],
  ['14b', 'STP PPh Pasal 25', 'stp_pph_25'],
  ['15', 'Jumlah kredit PPh 25 (14a+14b)', 'jumlah_kredit_pph_25'],
  ['16a', 'PPh kurang bayar (Pasal 29)', 'angka_19a'],
  ['16b', 'PPh lebih bayar (28A)', 'angka_19b'],
  ['18', 'Angsuran PPh 25 tahun berikutnya', 'angka_21'],
]

export default function SptPage() {
  const [section, setSection] = useState('identitas')
  const [formType, setFormType] = useState('1770')
  const [data, setData] = useState(() => emptyData('1770'))
  const [calc, setCalc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [draftId, setDraftId] = useState(null)
  const [preview, setPreview] = useState(null)
  const iframeRef = useRef(null)

  const up = (path, value) => setData((d) => setPath(d, path, value))

  const loadDrafts = async () => {
    try {
      const { data } = await client.get('/spt')
      setDrafts(data.items || [])
    } catch {
      // abaikan
    }
  }

  useEffect(() => { loadDrafts() }, [])

  const changeFormType = (ft) => {
    setFormType(ft)
    up(['identitas', 'jenis_form'], ft)
    setCalc(null)
  }

  const hitung = async (overrideData) => {
    setLoading(true)
    try {
      const src = overrideData || data
      const ft = overrideData?.identitas?.jenis_form || formType
      const { data: res } = await client.post('/spt/hitung', {
        form_type: ft,
        data: buildPayload(src, ft),
      })
      setCalc(res)
      toast.success('Perhitungan berhasil')
      return res
    } catch (err) {
      toast.error(fmtErr(err, 'Gagal menghitung'))
      return null
    } finally {
      setLoading(false)
    }
  }

  const simpan = async () => {
    setSaving(true)
    try {
      const payload = {
        form_type: formType,
        tahun_pajak: Number(data.identitas.tahun_pajak) || new Date().getFullYear() - 1,
        status: 'DRAFT',
        data: buildPayload(data, formType),
      }
      if (draftId) {
        await client.put(`/spt/${draftId}`, payload)
        toast.success('Draft diperbarui')
      } else {
        const { data: res } = await client.post('/spt', payload)
        setDraftId(res.id)
        toast.success('Draft tersimpan')
      }
      await loadDrafts()
    } catch (err) {
      toast.error(fmtErr(err, 'Gagal menyimpan draft'))
    } finally {
      setSaving(false)
    }
  }

  const cetak = async () => {
    let currentCalc = calc
    if (!currentCalc) {
      currentCalc = await hitung()
    }
    if (!currentCalc) return
    try {
      const html = buildSptPrintHtml(buildPayload(data, formType), currentCalc, formType)
      if (!html) {
        toast.error('Gagal membuat dokumen cetak')
        return
      }
      setPreview(html)
    } catch (err) {
      console.error('Cetak error:', err)
      toast.error('Gagal mencetak: ' + (err.message || 'Unknown error'))
    }
  }

  const cetakDariPreview = () => {
    try {
      iframeRef.current?.contentWindow?.focus()
      iframeRef.current?.contentWindow?.print()
      toast.success('Dialog print siap! Pilih "Save as PDF" untuk menyimpan.')
    } catch (err) {
      console.error('Print error:', err)
      toast.error('Gagal membuka dialog print')
    }
  }

  const hapusDraft = async (id) => {
    if (!window.confirm('Hapus draft SPT ini?')) return
    try {
      await client.delete(`/spt/${id}`)
      if (id === draftId) {
        setDraftId(null)
        setData(emptyData(formType))
        setCalc(null)
      }
      setDrafts((d) => d.filter((x) => x.id !== id))
      toast.success('Draft dihapus')
    } catch (err) {
      toast.error(extractError(err, 'Gagal menghapus'))
    }
  }

  const muatDraft = (d) => {
    const merged = mergeDefaults(d.data)
    setData(merged)
    setFormType(merged.identitas.jenis_form || d.form_type || '1770')
    setDraftId(d.id)
    setCalc(null)
    setSection('hasil')
    toast.success('Draft dimuat')
  }

  const muatContoh = async (ft = formType, { hitungLangsung = false } = {}) => {
    const sample = mergeDefaults(contohData(ft))
    setData(sample)
    setFormType(ft)
    setDraftId(null)
    setCalc(null)
    if (hitungLangsung) {
      await hitung(sample)
      setSection('hasil')
    } else {
      setSection('identitas')
    }
    toast.success(`Data contoh ${ft === '1770S' ? '1770S (Karyawan)' : '1770 (Usaha)'} dimuat`)
  }

  const usaha = data.penghasilan.usaha
  const netoUsaha = useMemo(
    () => (usaha.peredaran_usaha || 0) - (usaha.hpp || 0) - (usaha.biaya_usaha || 0),
    [usaha.peredaran_usaha, usaha.hpp, usaha.biaya_usaha]
  )

  const previewRows = formType === '1770S' ? PREVIEW_1770S : PREVIEW_1770

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">
          <span className="gradient-text">SPT Tahunan PPh OP</span>
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <p className="text-sm" style={{ color: 'var(--color-slate-body)' }}>
            Isi formulir 1770 / 1770S — hitung otomatis, simpan draft, dan cetak ke PDF.
          </p>
          <button type="button" onClick={openTaxConsultation} className="btn-ghost !py-2 !px-3 text-xs">
            <MessageCircle size={14} /> Tanya Asisten Pajak
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)' }}>
        <Info size={16} style={{ color: 'var(--color-accent-amber)' }} className="shrink-0 mt-0.5" />
        <p className="text-xs" style={{ color: 'var(--color-accent-amber)' }}>
          Alat bantu isian & hitung SPT — BUKAN pengganti e-Form/e-Filing resmi DJP. Validasi ke konsultan pajak sebelum pelaporan.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ===== In-page sidebar ===== */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4 lg:sticky lg:top-0">
          <div className="card !p-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} style={{ color: 'var(--color-accent-blue)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-body)' }}>Bagian Form</span>
            </div>
            <nav className="space-y-1">
              {SECTIONS.map((s) => {
                const active = section === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${
                      active ? 'font-semibold text-[var(--color-accent-blue)]' : 'text-[var(--color-slate-body)] hover:bg-white/5 hover:text-[var(--color-slate-text)]'
                    }`}
                    style={active ? { background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' } : undefined}
                  >
                    <s.icon size={16} className={active ? 'text-[var(--color-brand-soft)]' : ''} />
                    <span className="text-left">{s.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="card !p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={14} style={{ color: 'var(--color-accent-blue)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-body)' }}>Draft Tersimpan</span>
            </div>
            <button type="button" onClick={() => muatContoh()} className="btn-ghost w-full text-xs justify-start !px-2 mb-2">
              <Plus size={12} /> Muat data contoh
            </button>
            <div className="space-y-2">
              {drafts.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>Belum ada draft.</p>
              )}
              {drafts.map((d) => (
                <div key={d.id} className="group flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5" style={{ border: '1px solid var(--color-border-subtle)' }}>
                  <button type="button" onClick={() => muatDraft(d)} className="flex-1 text-left min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-slate-heading)' }}>SPT {d.form_type} {d.tahun_pajak}</div>
                    <div className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>{formatDate(d.updated_at)}</div>
                  </button>
                  <button type="button" onClick={() => hapusDraft(d.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: '#F87171' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ===== Form content ===== */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {section === 'identitas' && (
            <IdentitasSection formType={formType} data={data} up={up} onChangeFormType={changeFormType} />
          )}
          {section === 'penghasilan' && (
            <PenghasilanSection formType={formType} data={data} up={up} netoUsaha={netoUsaha} />
          )}
          {section === 'kredit' && <KreditSection data={data} up={up} />}
          {section === 'harta' && <HartaSection data={data} up={up} />}
          {section === 'tanggungan' && <TanggunganSection data={data} up={up} />}
          {section === 'permohonan' && <PermohonanSection data={data} up={up} />}
          {section === 'hasil' && (
            <HasilSection
              formType={formType} data={data} calc={calc} previewRows={previewRows}
              loading={loading} saving={saving} hitung={hitung} simpan={simpan} cetak={cetak}
            />
          )}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
          style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="relative w-full max-w-5xl h-[90vh] card overflow-hidden flex flex-col animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <Printer size={18} style={{ color: 'var(--color-accent-blue)' }} className="shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>
                    Pratinjau SPT {formType} — Tahun Pajak {data.identitas?.tahun_pajak}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>
                    Preview tampil di sini — tidak pindah ke halaman lain
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={cetakDariPreview} className="btn-primary !py-2">
                  <Printer size={15} /> Cetak / Simpan PDF
                </button>
                <button
                  type="button" onClick={() => setPreview(null)} className="btn-ghost !py-2"
                  aria-label="Tutup pratinjau"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-slate-200 p-4" style={{ background: '#e2e8f0' }}>
              <iframe
                ref={iframeRef}
                title="Pratinjau SPT"
                srcDoc={preview + '<style>@media screen{ .sp-page,.sp-gi-page{margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,0.15)} body{padding:24px} }</style>'}
                className="w-full h-full bg-white rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   Bagian: Identitas
   ======================================================================== */

function IdentitasSection({ formType, data, up, onChangeFormType }) {
  const id = data.identitas
  return (
    <SectionCard title="Jenis Form & Identitas" icon={User} desc="Pilih formulir dan isi data Wajib Pajak">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => onChangeFormType('1770')}
          className="rounded-2xl p-5 text-left transition-all duration-300"
          style={formType === '1770'
            ? { background: 'rgba(37,99,235,0.12)', border: '2px solid #2563EB' }
            : { background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-lg" style={{ color: formType === '1770' ? 'var(--color-accent-blue)' : 'var(--color-slate-text)' }}>1770</span>
            {formType === '1770' && <span className="badge !text-[10px]">DIPILIH</span>}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-slate-body)' }}>Wiraswasta / usaha, pekerjaan bebas, lebih dari satu pemberi kerja. Lampiran I–IV.</p>
        </button>
        <button
          type="button"
          onClick={() => onChangeFormType('1770S')}
          className="rounded-2xl p-5 text-left transition-all duration-300"
          style={formType === '1770S'
            ? { background: 'rgba(37,99,235,0.12)', border: '2px solid #2563EB' }
            : { background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-lg" style={{ color: formType === '1770S' ? 'var(--color-accent-blue)' : 'var(--color-slate-text)' }}>1770S</span>
            {formType === '1770S' && <span className="badge !text-[10px]">DIPILIH</span>}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-slate-body)' }}>Karyawan — penghasilan dari satu/lebih pemberi kerja. Lampiran S-I & S-II.</p>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Tahun Pajak" contoh={id.tahun_pajak ? undefined : '2025'}>
          <NumField value={id.tahun_pajak} onChange={(v) => up(['identitas', 'tahun_pajak'], v)} placeholder="2025" />
        </Field>
        <Field label="NPWP" contoh={id.npwp ? undefined : '01.234.567.8-901.000'}>
          <input type="text" value={id.npwp} onChange={(e) => up(['identitas', 'npwp'], e.target.value)} className="input-field" placeholder="00.000.000.0-000.000" />
        </Field>
        <Field label="Nama Wajib Pajak" contoh={id.nama ? undefined : 'BUDI SANTOSO'}>
          <input type="text" value={id.nama} onChange={(e) => up(['identitas', 'nama'], e.target.value)} className="input-field" placeholder="Nama sesuai KTP/NPWP" />
        </Field>
        <Field label="Status Perkawinan" contoh={id.status_kawin ? undefined : 'KK — Kawin, kewajiban pajak digabung'}>
          <SelectField value={id.status_kawin} onChange={(v) => up(['identitas', 'status_kawin'], v)} options={STATUS_KAWIN} />
        </Field>
        <Field label="NPWP Istri/Suami" contoh={id.npwp_pasangan ? undefined : '02.345.678.9-012.345'}>
          <input type="text" value={id.npwp_pasangan} onChange={(e) => up(['identitas', 'npwp_pasangan'], e.target.value)} className="input-field" placeholder="00.000.000.0-000.000" />
        </Field>
        <Field label="Pembetulan Ke-" contoh={(id.pembetulan_ke ?? 0) ? undefined : '0 (lapor pertama kali)'}>
          <NumField value={id.pembetulan_ke} onChange={(v) => up(['identitas', 'pembetulan_ke'], v)} />
        </Field>
        <Field label="Jenis Usaha" contoh={id.jenis_usaha ? undefined : 'Toko Sembako'}>
          <input type="text" value={id.jenis_usaha} onChange={(e) => up(['identitas', 'jenis_usaha'], e.target.value)} className="input-field" placeholder="cth: Toko Kelontong" />
        </Field>
        <Field label="Pekerjaan Utama" contoh={id.pekerjaan_utama ? undefined : 'Karyawan Swasta'}>
          <input type="text" value={id.pekerjaan_utama} onChange={(e) => up(['identitas', 'pekerjaan_utama'], e.target.value)} className="input-field" placeholder="cth: Karyawan" />
        </Field>
        <Field label="Klasifikasi Lapangan Usaha (KLU)" contoh={id.klu ? undefined : '47911'}>
          <input type="text" value={id.klu} onChange={(e) => up(['identitas', 'klu'], e.target.value)} className="input-field" placeholder="cth: 47911" />
        </Field>
        <Field label="No. Telepon" contoh={id.no_telepon ? undefined : '021-5551234'}>
          <input type="text" value={id.no_telepon} onChange={(e) => up(['identitas', 'no_telepon'], e.target.value)} className="input-field" placeholder="021-0000000" />
        </Field>
        <Field label="No. Faksimili" contoh={id.no_faks ? undefined : '021-5551234'}>
          <input type="text" value={id.no_faks} onChange={(e) => up(['identitas', 'no_faks'], e.target.value)} className="input-field" placeholder="021-0000000" />
        </Field>
        <Field label="Alamat Tempat Tinggal" className="sm:col-span-2 lg:col-span-2" contoh={id.alamat ? undefined : 'Jl. Merdeka No.1 Jakarta'}>
          <input type="text" value={id.alamat} onChange={(e) => up(['identitas', 'alamat'], e.target.value)} className="input-field" placeholder="Jalan, RT/RW, Kelurahan" />
        </Field>
        <Field label="Kelurahan / Kecamatan" contoh={id.kelurahan_kecamatan ? undefined : 'Menteng / Jakarta Pusat'}>
          <input type="text" value={id.kelurahan_kecamatan} onChange={(e) => up(['identitas', 'kelurahan_kecamatan'], e.target.value)} className="input-field" placeholder="cth: Menteng / Jakarta Pusat" />
        </Field>
      </div>
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Penghasilan
   ======================================================================== */

function PenghasilanSection({ formType, data, up, netoUsaha }) {
  const ph = data.penghasilan
  const usaha = ph.usaha
  const catat = ph.usaha_pencatatan
  return (
    <SectionCard title="Penghasilan Neto" icon={Wallet} desc="Sumber penghasilan dan komponen perhitungan neto">
      <Field label="Metode Penghitungan Usaha" contoh={ph.metode ? undefined : 'Pembukuan'}>
        <SelectField
          value={ph.metode}
          onChange={(v) => up(['penghasilan', 'metode'], v)}
          options={[
            { value: 'pembukuan', label: 'Pembukuan' },
            { value: 'pencatatan', label: 'Pencatatan (Norma Penghitungan)' },
          ]}
        />
      </Field>

      {ph.metode === 'pembukuan' ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Peredaran Usaha (1a)" contoh={usaha.peredaran_usaha ? undefined : '900.000.000'}>
              <NumField value={usaha.peredaran_usaha} onChange={(v) => up(['penghasilan', 'usaha', 'peredaran_usaha'], v)} />
            </Field>
            <Field label="Harga Pokok Penjualan (1b)" contoh={usaha.hpp ? undefined : '400.000.000'}>
              <NumField value={usaha.hpp} onChange={(v) => up(['penghasilan', 'usaha', 'hpp'], v)} />
            </Field>
            <Field label="Biaya Usaha (1d)" contoh={usaha.biaya_usaha ? undefined : '150.000.000'}>
              <NumField value={usaha.biaya_usaha} onChange={(v) => up(['penghasilan', 'usaha', 'biaya_usaha'], v)} />
            </Field>
          </div>
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between text-sm" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <span style={{ color: 'var(--color-slate-body)' }}>Penghasilan neto komersial (1c − 1d)</span>
            <span className="font-mono font-bold" style={{ color: 'var(--color-accent-green)' }}>{formatRupiah(netoUsaha)}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent-blue)' }}>Penyesuaian Fiskal Positif (2a–2k)</div>
              <PenyesuaianEditor title="Penyesuaian" values={usaha.penyesuaian_positif} onChange={(v) => up(['penghasilan', 'usaha', 'penyesuaian_positif'], v)} />
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent-blue)' }}>Penyesuaian Fiskal Negatif (3a–3c)</div>
              <PenyesuaianEditor title="Penyesuaian" values={usaha.penyesuaian_negatif} onChange={(v) => up(['penghasilan', 'usaha', 'penyesuaian_negatif'], v)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Jenis Usaha" contoh={catat.jenis_usaha ? undefined : 'Toko Sembako'}>
            <input type="text" value={catat.jenis_usaha} onChange={(e) => up(['penghasilan', 'usaha_pencatatan', 'jenis_usaha'], e.target.value)} className="input-field" />
          </Field>
          <Field label="Norma Penghitungan (%)" contoh={catat.norma_persen ? undefined : '50'}>
            <NumField value={catat.norma_persen} onChange={(v) => up(['penghasilan', 'usaha_pencatatan', 'norma_persen'], v)} />
          </Field>
          <Field label="Peredaran Usaha" contoh={catat.peredaran_usaha ? undefined : '900.000.000'}>
            <NumField value={catat.peredaran_usaha} onChange={(v) => up(['penghasilan', 'usaha_pencatatan', 'peredaran_usaha'], v)} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Field label="Penghasilan Neto Luar Negeri (4)" contoh={ph.luar_negeri ? undefined : '0'}>
          <NumField value={ph.luar_negeri} onChange={(v) => up(['penghasilan', 'luar_negeri'], v)} />
        </Field>
        <Field label="Zakat / Sumbangan Keagamaan (6)" contoh={ph.zakat ? undefined : '5.000.000'}>
          <NumField value={ph.zakat} onChange={(v) => up(['penghasilan', 'zakat'], v)} />
        </Field>
        {formType === '1770' && (
          <Field label="Kompensasi Kerugian (8)" contoh={ph.kompensasi_kerugian ? undefined : '0'}>
            <NumField value={ph.kompensasi_kerugian} onChange={(v) => up(['penghasilan', 'kompensasi_kerugian'], v)} />
          </Field>
        )}
        <Field label="Pengembalian / Pengurangan PPh 24 (13)" contoh={ph.pengembalian_pph_24 ? undefined : '0'}>
          <NumField value={ph.pengembalian_pph_24} onChange={(v) => up(['penghasilan', 'pengembalian_pph_24'], v)} />
        </Field>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>Pekerjaan (Lampiran I bagian C)</h4>
          <ItemEditor
            title="pekerjaan"
            items={ph.pekerjaan}
            onChange={(v) => up(['penghasilan', 'pekerjaan'], v)}
            addDefault={{ nama_pemberi_kerja: '', npwp_pemberi_kerja: '', penghasilan_neto: 0 }}
            fields={[
              { key: 'nama_pemberi_kerja', label: 'Nama Pemberi Kerja', placeholder: 'PT Maju Jaya', contoh: 'PT Maju Jaya' },
              { key: 'npwp_pemberi_kerja', label: 'NPWP Pemberi Kerja', placeholder: '00.000.000.0-000.000', contoh: '03.456.789.0-123.000' },
              { key: 'penghasilan_neto', label: 'Penghasilan Neto (Rp)', type: 'number', contoh: '200.000.000' },
            ]}
          />
        </div>

        <div>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>Dalam Negeri Lainnya (Lampiran I bagian D)</h4>
          <ItemEditor
            title="penghasilan lainnya"
            items={ph.dalam_negeri_lainnya}
            onChange={(v) => up(['penghasilan', 'dalam_negeri_lainnya'], v)}
            addDefault={{ jenis: '', penghasilan_bruto: 0, penghasilan_neto: 0 }}
            fields={[
              { key: 'jenis', label: 'Jenis Penghasilan', placeholder: 'Sewa rumah, royalti, dll', contoh: 'Sewa rumah' },
              { key: 'penghasilan_bruto', label: 'Penghasilan Bruto (Rp)', type: 'number', contoh: '36.000.000' },
              { key: 'penghasilan_neto', label: 'Penghasilan Neto (Rp)', type: 'number', contoh: '30.000.000' },
            ]}
          />
        </div>

        <div>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>Bukan Objek Pajak (1770-III bagian B)</h4>
          <ItemEditor
            title="penghasilan bukan objek"
            items={ph.bukan_objek}
            onChange={(v) => up(['penghasilan', 'bukan_objek'], v)}
            addDefault={{ jenis: '', jumlah: 0 }}
            fields={[
              { key: 'jenis', label: 'Jenis Penghasilan', placeholder: 'Warisan, hibah, dll', contoh: 'Warisan' },
              { key: 'jumlah', label: 'Jumlah (Rp)', type: 'number', contoh: '50.000.000' },
            ]}
          />
        </div>

        <div>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>PPh Final / Bersifat Final (1770-III bagian A)</h4>
          <ItemEditor
            title="penghasilan final"
            items={ph.final}
            onChange={(v) => up(['penghasilan', 'final'], v)}
            addDefault={{ jenis: '', dasar_pengenaan: 0, pph_terutang: 0 }}
            fields={[
              { key: 'jenis', label: 'Jenis Penghasilan', placeholder: 'Bunga deposito, sewa, dll', contoh: 'Bunga deposito' },
              { key: 'dasar_pengenaan', label: 'Dasar Pengenaan (Rp)', type: 'number', contoh: '10.000.000' },
              { key: 'pph_terutang', label: 'PPh Terutang (Rp)', type: 'number', contoh: '200.000' },
            ]}
          />
        </div>
      </div>
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Kredit Pajak
   ======================================================================== */

function KreditSection({ data, up }) {
  const kp = data.kredit_pajak
  return (
    <SectionCard title="Kredit Pajak" icon={Receipt} desc="PPh yang sudah dipotong/dibayar untuk dikreditkan">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="PPh Pasal 24 (Kredit Pajak Luar Negeri)" contoh={kp.dalam_negeri ? undefined : '0'}>
          <NumField value={kp.dalam_negeri} onChange={(v) => up(['kredit_pajak', 'dalam_negeri'], v)} />
        </Field>
        <Field label="PPh Pasal 25 yang Dibayar Sendiri (17a)" contoh={kp.pph_dibayar_sendiri_25 ? undefined : '30.000.000'}>
          <NumField value={kp.pph_dibayar_sendiri_25} onChange={(v) => up(['kredit_pajak', 'pph_dibayar_sendiri_25'], v)} />
        </Field>
        <Field label="STP PPh Pasal 25 (17b)" contoh={kp.stp_pph_25 ? undefined : '0'}>
          <NumField value={kp.stp_pph_25} onChange={(v) => up(['kredit_pajak', 'stp_pph_25'], v)} />
        </Field>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>Daftar Pemotongan/Pemungutan (1770-II bagian A)</h4>
        <ItemEditor
          title="bukti potong"
          items={kp.pemotongan}
          onChange={(v) => up(['kredit_pajak', 'pemotongan'], v)}
          addDefault={{ nama: '', npwp: '', no_bukti: '', tanggal: '', jenis: '21', jumlah: 0 }}
          fields={[
            { key: 'nama', label: 'Nama Pemotong', placeholder: 'PT Maju Jaya', contoh: 'PT Maju Jaya' },
            { key: 'npwp', label: 'NPWP Pemotong', placeholder: '00.000.000.0-000.000', contoh: '03.456.789.0-123.000' },
            { key: 'no_bukti', label: 'No. Bukti Potong' },
            { key: 'tanggal', label: 'Tanggal', type: 'date' },
            { key: 'jenis', label: 'Jenis Pajak', type: 'select', options: JENIS_POTONG.map((j) => ({ value: j, label: `PPh Pasal ${j}` })) },
            { key: 'jumlah', label: 'Jumlah PPh (Rp)', type: 'number', contoh: '14.000.000' },
          ]}
        />
      </div>
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Harta & Utang
   ======================================================================== */

function HartaSection({ data, up }) {
  return (
    <SectionCard title="Harta & Utang" icon={Home} desc="Lampiran IV — kondisi harta, utang pada akhir tahun pajak">
      <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-slate-text)' }}>Harta pada Akhir Tahun</h4>
      <ItemEditor
        title="harta"
        items={data.harta}
        onChange={(v) => up(['harta'], v)}
        addDefault={{ kode: '', nama: '', tahun_perolehan: new Date().getFullYear(), harga_perolehan: 0, keterangan: '' }}
        fields={[
          { key: 'kode', label: 'Kode Harta', placeholder: '031', contoh: '031' },
          { key: 'nama', label: 'Jenis/Nama Harta', placeholder: 'Rumah', contoh: 'Rumah' },
          { key: 'tahun_perolehan', label: 'Tahun Perolehan', type: 'number', contoh: '2018' },
          { key: 'harga_perolehan', label: 'Harga Perolehan (Rp)', type: 'number', contoh: '800.000.000' },
          { key: 'keterangan', label: 'Keterangan', placeholder: 'Tempat tinggal', contoh: 'Tempat tinggal' },
        ]}
      />

      <h4 className="text-sm font-bold mb-2 mt-8" style={{ color: 'var(--color-slate-text)' }}>Utang pada Akhir Tahun</h4>
      <ItemEditor
        title="utang"
        items={data.utang}
        onChange={(v) => up(['utang'], v)}
        addDefault={{ kode: '', nama_pemberi: '', alamat_pemberi: '', tahun_peminjaman: new Date().getFullYear(), jumlah: 0 }}
        fields={[
          { key: 'kode', label: 'Kode Utang', placeholder: '211', contoh: '211' },
          { key: 'nama_pemberi', label: 'Nama Pemberi Pinjaman', placeholder: 'Bank ABC', contoh: 'Bank ABC' },
          { key: 'alamat_pemberi', label: 'Alamat Pemberi', contoh: 'Jakarta' },
          { key: 'tahun_peminjaman', label: 'Tahun Peminjaman', type: 'number', contoh: '2019' },
          { key: 'jumlah', label: 'Jumlah Utang (Rp)', type: 'number', contoh: '300.000.000' },
        ]}
      />
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Tanggungan
   ======================================================================== */

function TanggunganSection({ data, up }) {
  return (
    <SectionCard title="Susunan Anggota Keluarga" icon={Users} desc="Tanggungan untuk perhitungan PTKP & Lampiran IV bagian D">
      <ItemEditor
        title="tanggungan"
        items={data.tanggungan}
        onChange={(v) => up(['tanggungan'], v)}
        addDefault={{ nama: '', nik: '', hubungan: 'Anak', pekerjaan: '' }}
        fields={[
          { key: 'nama', label: 'Nama Anggota Keluarga', placeholder: 'Anak 1', contoh: 'Anak 1' },
          { key: 'nik', label: 'NIK', contoh: '3171010101010001' },
          { key: 'hubungan', label: 'Hubungan Keluarga', placeholder: 'Suami/Istri/Anak', contoh: 'Anak' },
          { key: 'pekerjaan', label: 'Pekerjaan', placeholder: 'Pelajar', contoh: 'Pelajar' },
        ]}
      />
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Permohonan
   ======================================================================== */

function PermohonanSection({ data, up }) {
  const pm = data.permohonan
  return (
    <SectionCard title="Permohonan" icon={FileCheck} desc="Pilihan restitusi dan cara hitung angsuran PPh 25">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Permohonan Lebih Bayar">
          <SelectField value={pm.restitusi} onChange={(v) => up(['permohonan', 'restitusi'], v)} options={RESTITUSI} />
        </Field>
        <Field label="Angsuran PPh 25 Tahun Berikutnya">
          <SelectField
            value={pm.angsuran_25}
            onChange={(v) => up(['permohonan', 'angsuran_25'], v)}
            options={[
              { value: '1_12', label: '1/12 x angka 16 (1770) / angka 13a (1770S)' },
              { value: 'separate', label: 'Perhitungan tersendiri (lampiran)' },
            ]}
          />
        </Field>
      </div>
      <p className="text-xs mt-4 rounded-xl p-3" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-card)' }}>
        Permohonan restitusi hanya relevan bila terjadi lebih bayar (angka 19.b / 16.b). Kompensasi = lebih bayar diperhitungkan dengan utang pajak tahun berikutnya.
      </p>
    </SectionCard>
  )
}

/* ========================================================================
   Bagian: Hasil & Cetak
   ======================================================================== */

function HasilSection({ formType, data, calc, previewRows, loading, saving, hitung, simpan, cetak }) {
  return (
    <SectionCard title="Hasil Perhitungan & Cetak" icon={Calculator} desc="Preview perhitungan alur Formulir Induk sesuai form terpilih">
      <div className="flex flex-wrap gap-3 mb-6">
        <button type="button" onClick={() => hitung()} disabled={loading} className="btn-primary">
          <Calculator size={16} /> {loading ? 'Menghitung...' : 'Hitung & Preview'}
        </button>
        <button type="button" onClick={() => simpan()} disabled={saving} className="btn-secondary">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Draft'}
        </button>
        <button type="button" onClick={() => cetak()} disabled={!calc} className="btn-secondary" style={!calc ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          <Printer size={16} /> Cetak / Simpan PDF
        </button>
      </div>

      {!calc ? (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px dashed var(--color-border-soft)' }}>
          <Landmark size={32} style={{ color: 'var(--color-slate-muted)' }} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--color-slate-body)' }}>
            Belum ada perhitungan. Isi form lalu klik <span className="font-semibold text-[var(--color-accent-blue)]">Hitung & Preview</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(37,99,235,0.08)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Ringkasan Formulir Induk {formType} — {data.identitas.tahun_pajak}</span>
              <span className="badge !text-[10px]">PPh {formType === '1770S' ? '1770S' : '1770'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {previewRows.map(([no, label, key]) => {
                    const val = calc[key] ?? 0
                    const isTotal = key === 'angka_5' || key === 'angka_7' || key === 'angka_9' || key === 'angka_11' || key === 'jumlah_pph_terutang' || key === 'jumlah_kredit_pph_25'
                    const isFinal = key === 'angka_19a' || key === 'angka_19b'
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--color-slate-muted)' }}>{no}</td>
                        <td className={`px-4 py-2.5 ${isTotal ? 'font-bold' : ''}`} style={{ color: isTotal ? 'var(--color-accent-blue)' : 'var(--color-slate-text)' }}>
                          {label}
                          {isFinal && val > 0 && <span className="badge !text-[9px] ml-2">{key === 'angka_19a' ? 'KURANG BAYAR' : 'LEBIH BAYAR'}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: isFinal && val > 0 ? (key === 'angka_19a' ? '#F87171' : 'var(--color-accent-emerald)') : isTotal ? 'var(--color-slate-heading)' : 'var(--color-slate-text)' }}>
                          {formatRupiah(val)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-accent-blue)' }}>PTKP</div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span style={{ color: 'var(--color-slate-body)' }}>Status</span>
                <span className="font-semibold" style={{ color: 'var(--color-slate-heading)' }}>{calc.ptkp_detail?.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span style={{ color: 'var(--color-slate-body)' }}>Tanggungan</span>
                <span className="font-semibold" style={{ color: 'var(--color-slate-heading)' }}>{calc.ptkp_detail?.jumlah_tanggungan}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--color-slate-body)' }}>Nilai PTKP</span>
                <span className="font-mono font-bold" style={{ color: 'var(--color-accent-blue)' }}>{formatRupiah(calc.ptkp_detail?.nilai_ptkp)}</span>
              </div>
              <p className="text-[10px] mt-3 italic" style={{ color: 'var(--color-slate-muted)' }}>{calc.ptkp_detail?.uraian}</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-accent-blue)' }}>PPh Pasal 17</div>
              {(calc.pph_pasal_17_detail?.rincian || []).map((r) => (
                <div key={r.lapisan} className="flex items-center justify-between text-sm mb-1.5">
                  <span style={{ color: 'var(--color-slate-body)' }}>{r.lapisan} × {Math.round(r.tarif * 100)}%</span>
                  <span className="font-mono" style={{ color: 'var(--color-slate-text)' }}>{formatRupiah(r.pph)}</span>
                </div>
              ))}
              {!calc.pph_pasal_17_detail?.rincian?.length && (
                <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>PKP ≤ 0 — tidak ada PPh terutang.</p>
              )}
            </div>
          </div>

          {(calc.catatan || []).length > 0 && (
            <div className="space-y-2">
              {(calc.catatan || []).map((c, i) => (
                <div key={i} className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', color: 'var(--color-accent-amber)' }}>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
