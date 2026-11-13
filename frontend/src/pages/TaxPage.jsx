import { useState } from 'react'
import { motion } from 'motion/react'
import client from '../api/client'
import { formatRupiah } from '../utils/formatters'
import { fadeUp, staggerContainer, itemStagger, EASE_GENTLE } from '../utils/motionPresets'
import MotionNumber from '../components/MotionNumber'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Calculator, Receipt, Percent, Info, CheckCircle2, Building2, CircleUser, LoaderCircle, ListChecks, PiggyBank, MessageCircle } from 'lucide-react'
import TaxDisclaimerPopup from '../components/TaxDisclaimerPopup'
import { openTaxConsultation } from '../utils/chatbotEvents'

const PPH_COLORS = {
  gradient: 'linear-gradient(135deg, #D97706 0%, #D97706 100%)',
  shadow: '0 8px 24px rgba(217, 119, 6, 0.3)',
  accent: '#D97706',
  soft: '#F59E0B',
  deep: '#D97706',
  bg: 'rgba(217, 119, 6, 0.07)',
  border: 'rgba(217, 119, 6, 0.22)',
  chipBg: 'rgba(217, 119, 6, 0.14)',
}

const PPN_COLORS = {
  gradient: 'linear-gradient(135deg, #2563EB 0%, #2563EB 100%)',
  shadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
  accent: '#2563EB',
  soft: '#60A5FA',
  deep: '#2563EB',
  bg: 'rgba(37, 99, 235, 0.07)',
  border: 'rgba(37, 99, 235, 0.22)',
  chipBg: 'rgba(37, 99, 235, 0.14)',
}

export default function TaxPage() {
  return (
    <div className="space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <h1 className="text-3xl font-extrabold">
          <span className="gradient-text">Kalkulator Pajak</span>
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <p className="text-sm" style={{ color: 'var(--color-slate-body)' }}>Hitung PPh Final UMKM dan PPN secara cepat untuk usaha Anda</p>
          <button type="button" onClick={openTaxConsultation} className="btn-ghost !py-2 !px-3 text-xs">
            <MessageCircle size={14} /> Tanya Asisten Pajak
          </button>
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainer(0.12, 0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <PPhFinalCard />
        <PPNCard />
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

function FactChips({ items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span
          key={c}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.14)', color: 'var(--color-slate-body)' }}
        >
          {c}
        </span>
      ))}
    </div>
  )
}

function InfoTooltip({ text }) {
  return (
    <div className="group relative shrink-0">
      <Info size={13} style={{ color: 'var(--color-slate-muted)' }} className="cursor-help" />
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl p-3 text-[11px] leading-relaxed text-white opacity-0 group-hover:opacity-100 transition pointer-events-none z-10"
        style={{ background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-tooltip-border)', boxShadow: '0 10px 28px var(--color-shadow)' }}
      >
        {text}
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-slate-muted)' }}>
      <Icon size={12} />
      {text}
    </div>
  )
}

function MoneyInput({ label, hint, value, onChange }) {
  const numeric = parseFloat(value)
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} className="input-field" placeholder="0" />
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span style={{ color: 'var(--color-slate-muted)' }}>{hint}</span>
        {numeric > 0 && (
          <span className="font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-brand-soft)' }}>
            ≈ {formatRupiah(numeric)}
          </span>
        )}
      </div>
    </div>
  )
}

function ResultEmpty({ text, icon: Icon }) {
  return (
    <div
      className="mt-5 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2 py-7 px-4 text-center"
      style={{ borderColor: 'rgba(148, 163, 184, 0.22)', color: 'var(--color-slate-muted)' }}
    >
      <div className="rounded-xl p-2.5" style={{ background: 'rgba(148, 163, 184, 0.08)' }}>
        <Icon size={16} />
      </div>
      <p className="text-xs max-w-[220px] leading-relaxed">{text}</p>
    </div>
  )
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: 'var(--color-slate-body)' }}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? 'font-extrabold' : 'font-semibold'}`} style={{ color: 'var(--color-slate-heading)' }}>
        {value}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PPh Final UMKM                                                     */
/* ------------------------------------------------------------------ */
function PPhFinalCard() {
  const [omzet, setOmzet] = useState('')
  const [kumulatif, setKumulatif] = useState('')
  const [isOrangPribadi, setIsOrangPribadi] = useState(true)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const hitung = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await client.post('/accounting/pajak/pph-final-umkm', {
        omzet_bulan_ini: parseFloat(omzet) || 0,
        omzet_kumulatif_sebelum_bulan_ini: parseFloat(kumulatif) || 0,
        wp_orang_pribadi: isOrangPribadi,
      })
      setResult(data)
    } catch (err) {
      toast.error(extractError(err, 'Gagal menghitung'))
    } finally {
      setLoading(false)
    }
  }

  const handleOmzet = (v) => { setOmzet(v); setResult(null) }
  const handleKumulatif = (v) => { setKumulatif(v); setResult(null) }
  const handleWP = (v) => { setIsOrangPribadi(v); setResult(null) }
  const bebasPajak = result && result.pph_final_terutang <= 0

  return (
    <>
    <motion.div
      variants={itemStagger}
      whileHover={{ y: -4, transition: EASE_GENTLE }}
      className="card relative overflow-hidden"
    >
      {/* Wash gradient tipis khas kartu */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ background: PPH_COLORS.gradient }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 4 }}
            transition={EASE_GENTLE}
            className="rounded-2xl p-3 text-white shrink-0"
            style={{ background: PPH_COLORS.gradient, boxShadow: PPH_COLORS.shadow }}
          >
            <Receipt size={20} />
          </motion.div>
          <div className="min-w-0">
<div className="flex items-center gap-1.5">
               <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>PPh Final UMKM</h3>
               <InfoTooltip text={
                 <>
                   <strong>WP Orang Pribadi:</strong> bebas PPh sampai Rp500 juta/tahun; bagian di atasnya kena tarif 0,5%.<br /><br />
                   <strong>WP Badan (PT/CV):</strong> kena 0,5% sejak omzet pertama.<br /><br />
                   Berlaku untuk omzet s/d Rp4,8 miliar/tahun.
                 </>
               } />
               <button
                 onClick={() => setShowDisclaimer(true)}
                 className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition ml-1"
                 style={{ color: PPH_COLORS.accent, background: PPH_COLORS.chipBg }}
               >
                 <Info size={11} />
                 Peringatan
               </button>
             </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-body)' }}>Omzet bruto × 0,5%</p>
          </div>
        </div>

        <FactChips items={['Tarif 0,5%', 'Bebas ≤ Rp500jt (OP)', 'Maks 4,8 M/tahun']} />

        {/* Form */}
        <form onSubmit={hitung} className="mt-5 space-y-4">
          <SectionLabel icon={ListChecks} text="Input Nilai" />

          <div>
            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)' }}>
              {[
                { key: true, label: 'Orang Pribadi', icon: CircleUser },
                { key: false, label: 'Badan / PT / CV', icon: Building2 },
              ].map((opt) => {
                const active = isOrangPribadi === opt.key
                const Icon = opt.icon
                return (
                  <button
                    key={String(opt.key)}
                    type="button"
                    onClick={() => handleWP(opt.key)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold transition-all duration-200"
                    style={{
                      background: active ? PPH_COLORS.gradient : 'transparent',
                      color: active ? '#fff' : 'var(--color-slate-body)',
                      boxShadow: active ? '0 2px 10px rgba(217, 119, 6, 0.4)' : 'none',
                      border: `1px solid ${active ? 'transparent' : 'transparent'}`,
                    }}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <MoneyInput
            label="Omzet Bulan Ini"
            hint="Total penjualan pada bulan yang dihitung"
            value={omzet}
            onChange={handleOmzet}
          />
          <MoneyInput
            label="Omzet Kumulatif Sebelumnya"
            hint="Awal tahun s/d bulan lalu (opsional)"
            value={kumulatif}
            onChange={handleKumulatif}
          />

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Calculator size={16} />}
            {loading ? 'Menghitung...' : 'Hitung PPh Final'}
          </button>
        </form>

        {/* Hasil */}
        <div className="mt-6">
          <SectionLabel icon={PiggyBank} text="Hasil Perhitungan" />
          {!result ? (
            <ResultEmpty text="Isi nilai di atas lalu tekan tombol Hitung untuk melihat rincian PPh terutang." icon={Receipt} />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={EASE_GENTLE}
              className="mt-3 rounded-2xl p-4 space-y-2.5 text-sm"
              style={{ background: PPH_COLORS.bg, border: `1px solid ${PPH_COLORS.border}` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--color-slate-body)' }}>Jenis Wajib Pajak</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: PPH_COLORS.chipBg, color: PPH_COLORS.accent }}>
                  {isOrangPribadi ? 'Orang Pribadi' : 'Badan / PT / CV'}
                </span>
              </div>
              <Row label="Omzet Bulan Ini" value={formatRupiah(result.omzet_bulan_ini)} />
              <Row label="Omzet Kumulatif Tahun Berjalan" value={formatRupiah(result.omzet_kumulatif_tahun_berjalan)} />
              <Row label="Omzet Kena Pajak" value={formatRupiah(result.omzet_kena_pajak)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--color-slate-body)' }}>Tarif</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: PPH_COLORS.chipBg, color: PPH_COLORS.accent }}>0,5%</span>
              </div>

              {/* Total banner */}
              <div
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mt-1"
                style={{ background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(217, 119, 6, 0.1))', border: '1px solid rgba(217, 119, 6, 0.3)' }}
              >
                <span className="flex items-center gap-1.5 font-bold text-sm" style={{ color: 'var(--color-slate-heading)' }}>
                  <CheckCircle2 size={15} style={{ color: PPH_COLORS.soft }} />
                  PPh Final Terutang
                </span>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: PPH_COLORS.soft }}>
                  <MotionNumber value={result.pph_final_terutang} format={formatRupiah} />
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <span className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>Status</span>
                {bebasPajak ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(52, 211, 153, 0.14)', color: '#10B981', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                    Bebas Pajak
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: PPH_COLORS.chipBg, color: PPH_COLORS.accent, border: `1px solid ${PPH_COLORS.border}` }}>
                    Terutang
                  </span>
                )}
              </div>

              {result.catatan && (
                <p className="text-[11px] italic rounded-xl p-2.5 leading-relaxed" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-2)' }}>
                  {result.catatan}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>

    <TaxDisclaimerPopup
      isOpen={showDisclaimer}
      onClose={() => setShowDisclaimer(false)}
      title="Disclaimer PPh Final UMKM"
      accentColor={PPH_COLORS.accent}
    >
      <p>
        <strong style={{ color: 'var(--color-slate-text)' }}>Perhatian:</strong> hasil ini adalah alat bantu berdasarkan ketentuan yang berlaku saat ini.
        Tarif &amp; aturan pajak dapat berubah sewaktu-waktu.
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2">
        <li>Tarif PPh Final UMKM: <strong>0,5%</strong> untuk omzet hingga Rp4,8 miliar/tahun</li>
        <li><strong>WP Orang Pribadi:</strong> bebas PPh sampai Rp500 juta/tahun, bagian di atasnya kena 0,5%</li>
        <li><strong>WP Badan (PT/CV):</strong> kena 0,5% sejak omzet pertama</li>
      </ul>
      <p className="mt-2">
        Silakan verifikasi ke{' '}
        <a href="https://pajak.go.id" target="_blank" rel="noreferrer" style={{ color: PPH_COLORS.soft, fontWeight: 600 }}>
          pajak.go.id
        </a>{' '}
        atau konsultan pajak bersertifikat sebelum digunakan untuk pelaporan resmi.
      </p>
    </TaxDisclaimerPopup>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  PPN (VAT)                                                          */
/* ------------------------------------------------------------------ */
function PPNCard() {
  const [nilai, setNilai] = useState('')
  const [termasuk, setTermasuk] = useState(false)
  const [mewah, setMewah] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const hitung = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await client.post('/accounting/pajak/ppn', {
        nilai: parseFloat(nilai) || 0,
        sudah_termasuk_ppn: termasuk,
        barang_mewah: mewah,
      })
      setResult(data)
    } catch (err) {
      toast.error(extractError(err, 'Gagal menghitung'))
    } finally {
      setLoading(false)
    }
  }

  const handleNilai = (v) => { setNilai(v); setResult(null) }
  const handleTermasuk = (v) => { setTermasuk(v); setResult(null) }
  const handleMewah = (v) => { setMewah(v); setResult(null) }

  return (
    <>
    <motion.div
      variants={itemStagger}
      whileHover={{ y: -4, transition: EASE_GENTLE }}
      className="card relative overflow-hidden"
    >
      {/* Wash gradient tipis khas kartu */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ background: PPN_COLORS.gradient }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 4 }}
            transition={EASE_GENTLE}
            className="rounded-2xl p-3 text-white shrink-0"
            style={{ background: PPN_COLORS.gradient, boxShadow: PPN_COLORS.shadow }}
          >
            <Percent size={20} />
          </motion.div>
          <div className="min-w-0">
<div className="flex items-center gap-1.5">
               <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>PPN (VAT)</h3>
               <InfoTooltip text={
                 <>
                   PPN umum 11% (mekanisme DPP nilai lain 11/12 × tarif 12%).<br />
                   Barang mewah (PPnBM) kena 12% penuh (PMK 131/2024).
                 </>
               } />
               <button
                 onClick={() => setShowDisclaimer(true)}
                 className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition ml-1"
                 style={{ color: PPN_COLORS.deep, background: PPN_COLORS.chipBg }}
               >
                 <Info size={11} />
                 Peringatan
               </button>
             </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-body)' }}>PPN atas transaksi barang/jasa</p>
          </div>
        </div>

        <FactChips items={['PPN umum 11%', 'Barang mewah 12%']} />

        {/* Form */}
        <form onSubmit={hitung} className="mt-5 space-y-4">
          <SectionLabel icon={ListChecks} text="Input Nilai" />

          <MoneyInput
            label={termasuk ? 'Harga Termasuk PPN' : 'Nilai Transaksi (sebelum PPN)'}
            hint={termasuk ? 'Harga yang sudah dibayar pelanggan' : 'Nilai jual sebelum dikenakan PPN'}
            value={nilai}
            onChange={handleNilai}
          />

          {/* Opsi PPN */}
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-1 items-center gap-2.5 text-sm cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-200" style={{ color: 'var(--color-slate-text)', background: termasuk ? PPN_COLORS.chipBg : 'var(--color-surface-2)', border: `1px solid ${termasuk ? PPN_COLORS.border : 'var(--color-border-subtle)'}` }}>
              <div className="w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition" style={{ background: termasuk ? PPN_COLORS.deep : 'transparent', borderColor: termasuk ? PPN_COLORS.deep : 'var(--color-slate-muted)' }}>
                {termasuk && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <input type="checkbox" checked={termasuk} onChange={e => handleTermasuk(e.target.checked)} className="sr-only" />
              Sudah termasuk PPN
            </label>
            <label className="flex flex-1 items-center gap-2.5 text-sm cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-200" style={{ color: 'var(--color-slate-text)', background: mewah ? PPN_COLORS.chipBg : 'var(--color-surface-2)', border: `1px solid ${mewah ? PPN_COLORS.border : 'var(--color-border-subtle)'}` }}>
              <div className="w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition" style={{ background: mewah ? PPN_COLORS.deep : 'transparent', borderColor: mewah ? PPN_COLORS.deep : 'var(--color-slate-muted)' }}>
                {mewah && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <input type="checkbox" checked={mewah} onChange={e => handleMewah(e.target.checked)} className="sr-only" />
              Barang mewah (12%)
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Calculator size={16} />}
            {loading ? 'Menghitung...' : 'Hitung PPN'}
          </button>
        </form>

        {/* Hasil */}
        <div className="mt-6">
          <SectionLabel icon={PiggyBank} text="Hasil Perhitungan" />
          {!result ? (
            <ResultEmpty text="Isi nilai transaksi lalu tekan tombol Hitung untuk melihat rincian PPN terutang." icon={Percent} />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={EASE_GENTLE}
              className="mt-3 rounded-2xl p-4 space-y-2.5 text-sm"
              style={{ background: PPN_COLORS.bg, border: `1px solid ${PPN_COLORS.border}` }}
            >
              <Row label="Dasar Pengenaan Pajak (DPP)" value={formatRupiah(result.dasar_pengenaan_pajak)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--color-slate-body)' }}>Tarif</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: mewah ? 'rgba(220, 38, 38, 0.14)' : PPN_COLORS.chipBg, color: mewah ? '#DC2626' : PPN_COLORS.deep }}>
                  {(result.tarif_digunakan * 100).toFixed(0)}%{mewah ? ' (PPnBM)' : ''}
                </span>
              </div>

              {/* Total banner */}
              <div
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mt-1"
                style={{ background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(37, 99, 235, 0.1))', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >
                <span className="flex items-center gap-1.5 font-bold text-sm" style={{ color: 'var(--color-slate-heading)' }}>
                  <CheckCircle2 size={15} style={{ color: PPN_COLORS.soft }} />
                  PPN Terutang
                </span>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: PPN_COLORS.soft }}>
                  <MotionNumber value={result.ppn} format={formatRupiah} />
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--color-surface-2)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-slate-body)' }}>Harga Termasuk PPN</span>
                <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(result.harga_termasuk_ppn)}</span>
              </div>

              {result.catatan && (
                <p className="text-[11px] italic rounded-xl p-2.5 leading-relaxed" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-2)' }}>
                  {result.catatan}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>

    <TaxDisclaimerPopup
      isOpen={showDisclaimer}
      onClose={() => setShowDisclaimer(false)}
      title="Disclaimer PPN (VAT)"
      accentColor={PPN_COLORS.accent}
    >
      <p>
        <strong style={{ color: 'var(--color-slate-text)' }}>Perhatian:</strong> hasil ini adalah alat bantu berdasarkan ketentuan yang berlaku saat ini.
        Tarif &amp; aturan pajak dapat berubah sewaktu-waktu.
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2">
        <li><strong>PPN umum:</strong> 11% (mekanisme DPP nilai lain 11/12 × tarif 12%)</li>
        <li><strong>Barang mewah (PPnBM):</strong> kena 12% penuh (PMK 131/2024)</li>
      </ul>
      <p className="mt-2">
        Silakan verifikasi ke{' '}
        <a href="https://pajak.go.id" target="_blank" rel="noreferrer" style={{ color: PPN_COLORS.soft, fontWeight: 600 }}>
          pajak.go.id
        </a>{' '}
        atau konsultan pajak bersertifikat sebelum digunakan untuk pelaporan resmi.
      </p>
    </TaxDisclaimerPopup>
    </>
  )
}