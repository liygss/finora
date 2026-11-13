import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import client from '../../api/client'
import toast from 'react-hot-toast'
import { extractError } from '../../api/extractError'
import { Building2, Store, Briefcase, ChevronRight, Check, FileText, ShoppingCart, Factory, Plus, X } from 'lucide-react'

const BUSINESS_TYPES = [
  { value: 'UMKM', label: 'UMKM', desc: 'Usaha Mikro, Kecil & Menengah' },
  { value: 'CV', label: 'CV', desc: 'Commanditaire Vennootschap' },
  { value: 'PT', label: 'PT', desc: 'Perseroan Terbatas' },
  { value: 'PERORANGAN', label: 'Perorangan', desc: 'Usaha Pribadi' },
]

const TEMPLATE_ICONS = {
  perdagangan: ShoppingCart,
  jasa: Briefcase,
  manufaktur: Factory,
}

export default function SetupStepCompany({ onNext }) {
  const [company, setCompany] = useState({ company_name: '', business_type: 'UMKM', business_field: '', address: '' })
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [customMode, setCustomMode] = useState(false)
  const [customAccounts, setCustomAccounts] = useState([])
  const [showPreview, setShowPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  useEffect(() => {
    client.get('/setup/coa-templates')
      .then(r => setTemplates(r.data))
      .catch(() => toast.error('Gagal memuat template COA'))
      .finally(() => setLoadingTemplates(false))
  }, [])

  const saveCompany = async () => {
    if (!company.company_name.trim()) {
      toast.error('Nama usaha wajib diisi')
      return false
    }
    try {
      await client.post('/setup/company', company)
      return true
    } catch (err) {
      toast.error(extractError(err, 'Gagal menyimpan data usaha'))
      return false
    }
  }

  const applyTemplate = async (templateId) => {
    try {
      await client.post('/setup/coa/apply-template', { template_id: templateId })
      toast.success('COA berhasil diterapkan')
      return true
    } catch (err) {
      toast.error(extractError(err, 'Gagal menerapkan template'))
      return false
    }
  }

  const applyCustomCOA = async () => {
    if (customAccounts.length < 2) {
      toast.error('Minimal 2 akun untuk COA manual')
      return false
    }
    try {
      await client.post('/setup/coa/custom', { accounts: customAccounts })
      toast.success('COA custom berhasil disimpan')
      return true
    } catch (err) {
      toast.error(extractError(err, 'Gagal menyimpan COA custom'))
      return false
    }
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      const ok = await saveCompany()
      if (!ok) return

      if (customMode) {
        const ok2 = await applyCustomCOA()
        if (!ok2) return
      } else if (selectedTemplate) {
        const ok2 = await applyTemplate(selectedTemplate)
        if (!ok2) return
      }

      onNext()
    } finally {
      setLoading(false)
    }
  }

  const addCustomAccount = () => {
    setCustomAccounts([...customAccounts, { kode_akun: '', nama_akun: '', kategori: 'ASET', saldo_normal: 'DEBIT', sub_kategori: '' }])
  }

  const updateCustomAccount = (idx, field, value) => {
    const updated = [...customAccounts]
    updated[idx] = { ...updated[idx], [field]: value }
    setCustomAccounts(updated)
  }

  const removeCustomAccount = (idx) => {
    setCustomAccounts(customAccounts.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #059669 100%)' }} />
        <div className="relative">
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>
            Selamat Datang di <span className="gradient-text">Finora</span>!
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>
            Mari mulai atur pembukuan bisnismu. Isi data usaha dan pilih bagan akun yang sesuai.
          </p>
        </div>
      </div>

      {/* Company Info Form */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-slate-heading)' }}>
          <Building2 size={16} style={{ color: 'var(--color-brand-soft)' }} />
          Data Usaha
        </h2>

        <div>
          <label className="label">Nama Usaha <span style={{ color: '#DC2626' }}>*</span></label>
          <input
            required
            data-hint="company-name"
            value={company.company_name}
            onChange={e => setCompany({ ...company, company_name: e.target.value })}
            className="input-field"
            placeholder="Toko Berkah Jaya"
          />
        </div>

        <div data-hint="business-type">
          <label className="label">Jenis Badan Usaha</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUSINESS_TYPES.map(bt => (
              <button
                key={bt.value}
                onClick={() => setCompany({ ...company, business_type: bt.value })}
                className="rounded-xl px-3 py-2.5 text-left transition-all duration-200"
                style={{
                  background: company.business_type === bt.value
                    ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.08))'
                    : 'var(--color-surface-card)',
                  border: company.business_type === bt.value
                    ? '2px solid var(--color-brand-soft)'
                    : '1px solid var(--color-border-subtle)',
                }}
              >
                <p className="text-sm font-bold" style={{ color: company.business_type === bt.value ? 'var(--color-brand-soft)' : 'var(--color-slate-heading)' }}>{bt.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>{bt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Bidang Usaha</label>
          <input
            data-hint="business-field"
            value={company.business_field}
            onChange={e => setCompany({ ...company, business_field: e.target.value })}
            className="input-field"
            placeholder="Contoh: Perdagangan retail, Jasa konsultasi, dll"
          />
        </div>

        <div>
          <label className="label">Alamat Usaha <span className="font-normal" style={{ color: 'var(--color-slate-muted)' }}>(opsional)</span></label>
          <input
            value={company.address}
            onChange={e => setCompany({ ...company, address: e.target.value })}
            className="input-field"
            placeholder="Jl. Merdeka No. 123, Jakarta"
          />
        </div>
      </div>

      {/* COA Selection */}
      <div data-hint="coa-section" className="card space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-slate-heading)' }}>
          <FileText size={16} style={{ color: 'var(--color-brand-soft)' }} />
          Chart of Accounts (COA)
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
          Pilih template COA yang sesuai dengan jenis usahamu, atau buat sendiri secara manual.
        </p>

        {loadingTemplates ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(tmpl => {
              const Icon = TEMPLATE_ICONS[tmpl.id] || Store
              const isSelected = selectedTemplate === tmpl.id && !customMode
              return (
                <div key={tmpl.id}>
                  <button
                    onClick={() => { setSelectedTemplate(tmpl.id); setCustomMode(false); setShowPreview(showPreview === tmpl.id ? null : tmpl.id) }}
                    className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.08))'
                        : 'var(--color-surface-card)',
                      border: isSelected
                        ? '2px solid var(--color-brand-soft)'
                        : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      color: isSelected ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)',
                    }}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: isSelected ? 'var(--color-brand-soft)' : 'var(--color-slate-heading)' }}>{tmpl.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>{tmpl.description}</p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      color: isSelected ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)',
                    }}>{tmpl.account_count} akun</span>
                    {isSelected && <Check size={16} style={{ color: 'var(--color-brand-soft)' }} />}
                  </button>

                  {/* Preview panel */}
                  {showPreview === tmpl.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-faint)' }}
                    >
                      <div className="max-h-48 overflow-y-auto p-3">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr style={{ color: 'var(--color-slate-muted)' }}>
                              <th className="text-left py-1 font-medium">Kode</th>
                              <th className="text-left py-1 font-medium">Nama Akun</th>
                              <th className="text-left py-1 font-medium">Kategori</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tmpl.accounts.map((a, i) => (
                              <tr key={i} style={{ color: 'var(--color-slate-text)' }}>
                                <td className="py-0.5 font-mono" style={{ color: 'var(--color-brand-soft)' }}>{a.kode_akun}</td>
                                <td className="py-0.5">{a.nama_akun}</td>
                                <td className="py-0.5" style={{ color: 'var(--color-slate-muted)' }}>{a.kategori}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </div>
              )
            })}

            {/* Custom COA option */}
            <button
              onClick={() => { setCustomMode(true); setSelectedTemplate(null); setShowPreview(null) }}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200"
              style={{
                background: customMode
                  ? 'linear-gradient(135deg, rgba(5, 150, 105, 0.12), rgba(5, 150, 105, 0.08))'
                  : 'var(--color-surface-card)',
                border: customMode
                  ? '2px solid #059669'
                  : '1px solid var(--color-border-subtle)',
              }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{
                background: customMode ? 'rgba(5, 150, 105, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                color: customMode ? '#059669' : 'var(--color-slate-muted)',
              }}>
                <Plus size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: customMode ? '#059669' : 'var(--color-slate-heading)' }}>Buat COA Manual</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>Buat daftar akun sendiri sesuai kebutuhan bisnismu</p>
              </div>
              {customMode && <Check size={16} style={{ color: '#059669' }} />}
            </button>

            {/* Custom COA form */}
            {customMode && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 space-y-3"
                style={{ background: 'var(--color-surface-faint)', border: '1px solid rgba(5, 150, 105, 0.2)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Daftar Akun Custom</p>
                  <button onClick={addCustomAccount} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition" style={{ color: '#059669', background: 'rgba(5, 150, 105, 0.1)' }}>
                    <Plus size={12} /> Tambah Akun
                  </button>
                </div>

                {customAccounts.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--color-slate-muted)' }}>
                    Klik "Tambah Akun" untuk mulai membuat COA manual
                  </p>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {customAccounts.map((acc, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)' }}>
                      <div className="flex-1 grid grid-cols-2 gap-1.5">
                        <input value={acc.kode_akun} onChange={e => updateCustomAccount(idx, 'kode_akun', e.target.value)} placeholder="Kode" className="input-field !text-[11px] !py-1.5" />
                        <input value={acc.nama_akun} onChange={e => updateCustomAccount(idx, 'nama_akun', e.target.value)} placeholder="Nama Akun" className="input-field !text-[11px] !py-1.5" />
                        <select value={acc.kategori} onChange={e => updateCustomAccount(idx, 'kategori', e.target.value)} className="input-field !text-[11px] !py-1.5">
                          <option>ASET</option><option>LIABILITAS</option><option>MODAL</option><option>PENDAPATAN</option><option>BEBAN</option>
                        </select>
                        <select value={acc.saldo_normal} onChange={e => updateCustomAccount(idx, 'saldo_normal', e.target.value)} className="input-field !text-[11px] !py-1.5">
                          <option>DEBIT</option><option>KREDIT</option>
                        </select>
                      </div>
                      <button onClick={() => removeCustomAccount(idx)} className="mt-1 p-1 rounded-lg transition hover:bg-red-500/10" style={{ color: '#DC2626' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Next button */}
      <div className="flex justify-end">
        <button
          data-hint="btn-next-1"
          onClick={handleNext}
          disabled={loading || !company.company_name.trim()}
          className="btn-primary !px-6 !py-3 disabled:opacity-40"
        >
          {loading ? 'Menyimpan...' : 'Lanjutkan'}
          {!loading && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  )
}
