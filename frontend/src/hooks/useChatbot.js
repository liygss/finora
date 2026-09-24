import { useState, useCallback, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import client from '../api/client'
import { notifyDataChanged } from '../utils/dashboardStore'
import { useAuth } from '../context/AuthContext'

const PAGE_LABELS = {
  '/dashboard': 'Dashboard',
  '/akun': 'Akun (COA)',
  '/jurnal': 'Jurnal Umum',
  '/laporan': 'Laporan Keuangan',
  '/tutup-buku': 'Tutup Buku',
  '/upload': 'Upload File',
  '/pajak': 'Kalkulator Pajak',
  '/spt': 'SPT Tahunan',
  '/knowledge': 'Knowledge Base',
  '/notif-admin': 'Kirim Notifikasi',
  '/admin': 'Dashboard Admin',
  '/demo': 'Demo',
}

// Keywords yang menandakan user ingin mencatat transaksi
const TRANSACTION_KEYWORDS = [
  'jual', 'beli', 'bayar', 'terima', 'hutang', 'piutang',
  'gaji', 'sewa', 'listrik', 'air', 'telepon', 'internet',
  'transport', 'bensin', 'perlengkapan', 'barang dagang',
  'modal', 'tarik', 'setor', ' THR', 'bonus', 'komisi',
  'kas masuk', 'kas keluar', 'transfer', 'tunai', 'cash',
  'tagihan', 'invoice', 'bon', 'kwitansi', 'retur',
]

// Pattern untuk mendeteksi nominal uang
const AMOUNT_PATTERNS = [
  /rp[\s.]*[\d.,]+/i,
  /rupiah[\s.]*[\d.,]+/i,
  /[\d.,]+\s*(rb|ribu|jt|juta|m|milliar|milyar)/i,
  /[\d.,]+(?:,\d{3})+/,
  /\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/,
]

function looksLikeTransaction(text) {
  const lower = text.toLowerCase()
  const hasKeyword = TRANSACTION_KEYWORDS.some(kw => lower.includes(kw))
  const hasAmount = AMOUNT_PATTERNS.some(p => p.test(text))
  return hasKeyword && hasAmount
}

function formatTime() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const HISTORY_KEY_PREFIX = 'ask_finora_history_'
const ACTIVE_KEY_PREFIX = 'ask_finora_active_'
const HISTORY_LIMIT = 30

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

function readHistory(key) {
  const list = readJSON(key, [])
  return Array.isArray(list) ? list : []
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cleanText(raw) {
  return (raw || '').replace(/\s+/g, ' ').trim()
}

function titleFor(messages) {
  const firstUser = messages.find(m => m.role === 'user' && m.content && m.content.trim())
  const raw = cleanText(firstUser?.content) || 'Percakapan baru'
  return raw.length > 44 ? `${raw.slice(0, 44)}…` : raw
}

function previewFor(messages) {
  const last = [...messages].reverse().find(m => m.content && m.content.trim())
  const raw = cleanText(last?.content)
  return raw.length > 64 ? `${raw.slice(0, 64)}…` : raw
}

export default function useChatbot() {
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastUploadId, setLastUploadId] = useState(null)
  const [followUpSuggestions, setFollowUpSuggestions] = useState([])
  const [pendingFile, setPendingFile] = useState(null)
  const sessionRef = useRef(null)
  const lastUploadIdRef = useRef(null)
  const pendingFileRef = useRef(null)
  const { user } = useAuth()
  const userId = user?.id || 'guest'
  const ACTIVE_KEY = `${ACTIVE_KEY_PREFIX}${userId}`
  const HISTORY_KEY = `${HISTORY_KEY_PREFIX}${userId}`
  const [conversations, setConversations] = useState(() => readHistory(HISTORY_KEY))
  const messagesRef = useRef(null)
  const conversationsRef = useRef([])
  const activeConversationRef = useRef(null)

  // Keep pendingFileRef in sync
  useEffect(() => {
    pendingFileRef.current = pendingFile
  }, [pendingFile])

  // Keep latest conversations list in sync for stable callbacks.
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  // Keep latest messages in sync for stable callbacks.
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Restore active conversation for this user + refresh history list.
  useEffect(() => {
    activeConversationRef.current = null
    setConversations(readHistory(HISTORY_KEY))
    const active = readJSON(ACTIVE_KEY, null)
    if (active && Array.isArray(active.messages) && active.messages.length > 0) {
      setMessages(active.messages)
      if (active.sessionId) {
        setSessionId(active.sessionId)
        sessionRef.current = active.sessionId
      }
      activeConversationRef.current = active.conversationId || null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ACTIVE_KEY, HISTORY_KEY])

  // Autosave current conversation (debounced) so reload picks it up again.
  useEffect(() => {
    if (messages.length === 0) return
    const t = setTimeout(() => {
      writeJSON(ACTIVE_KEY, {
        messages,
        sessionId: sessionRef.current,
        conversationId: activeConversationRef.current,
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [messages, ACTIVE_KEY])

  // --- Send text message (with smart transaction detection + pending file) ---
  const send = useCallback(async (text = input, overrideUploadId = null) => {
    const message = (text ?? '').trim()
    const file = pendingFileRef.current
    if ((!message && !file) || loading) return false

    // Upload pending file first if exists
    let activeUploadId = overrideUploadId || lastUploadIdRef.current
    let uploadedFileInfo = null

    if (file) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const { data: uploaded } = await client.post('/upload/file', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        activeUploadId = uploaded.id
        setLastUploadId(uploaded.id)
        lastUploadIdRef.current = uploaded.id
        uploadedFileInfo = { filename: file.name, status: 'staged', uploadId: uploaded.id }
      } catch (err) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Gagal upload file: ${err?.response?.data?.detail || err.message}`,
          time: formatTime(),
        }])
        setPendingFile(null)
        pendingFileRef.current = null
        return false
      }
      setPendingFile(null)
      pendingFileRef.current = null
    }

    // Deteksi "simpan" → commit staged upload
    const commitKeywords = ['simpan', 'masukkan ke jurnal', 'masuk jurnal', 'commit', 'konfirmasi simpan', 'sudah cukup']
    const isCommit = commitKeywords.some(kw => message.toLowerCase().includes(kw))
    if (isCommit && lastUploadIdRef.current) {
      const commitMsg = {
        role: 'user',
        content: message,
        time: formatTime(),
        ...(uploadedFileInfo && { files: [uploadedFileInfo] }),
      }
      setMessages(prev => [...prev, commitMsg])
      setInput('')
      setFollowUpSuggestions([])
      await commitUpload(lastUploadIdRef.current)
      return true
    }

    // Deteksi "update/ubah/ganti jurnal" → edit pending transaction
    const updateKeywords = ['update jurnal', 'ubah jurnal', 'ganti jurnal', 'edit jurnal', 'ubah nominal', 'ubah deskripsi', 'ubah tanggal', 'ganti akun', 'ubah jumlah', 'ubah keterangan']
    const isUpdate = updateKeywords.some(kw => message.toLowerCase().includes(kw))
    if (isUpdate) {
      // Cari transaction message terakhir dengan status 'ready'
      const lastTxIdx = messages.findLastIndex(m => m.transaction?.status === 'ready')
      if (lastTxIdx !== -1) {
        const lastTxMsg = messages[lastTxIdx]
        setMessages(prev => [...prev, { role: 'user', content: message, time: formatTime() }])
        setInput('')
        setFollowUpSuggestions([])
        setLoading(true)

        try {
          const { data } = await client.post('/chatbot/update-transaction', {
            current_transaction: {
              deskripsi: lastTxMsg.transaction.deskripsi,
              tanggal: lastTxMsg.transaction.tanggal,
              detail: lastTxMsg.transaction.detail,
            },
            update_command: message,
          })

          // Update transaction message dengan data baru
          setMessages(prev => prev.map(m =>
            m === lastTxMsg ? { ...m, transaction: { ...data, status: 'ready' } } : m
          ))
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Jurnal sudah diperbarui! Silakan review dan klik **Simpan Jurnal**.',
            time: formatTime(),
          }])
        } catch (err) {
          const detail = err?.response?.data?.detail
          let msg = 'Gagal memperbarui jurnal.'
          if (detail) msg += '\n\nDetail: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))
          setMessages(prev => [...prev, { role: 'assistant', content: msg, time: formatTime() }])
        } finally {
          setLoading(false)
        }
        return true
      }
    }

    // Smart detection: jika terlihat seperti transaksi, coba parse dulu
    if (looksLikeTransaction(message)) {
      setLoading(true)
      const txMsg = {
        role: 'user',
        content: message,
        time: formatTime(),
        ...(uploadedFileInfo && { files: [uploadedFileInfo] }),
      }
      setMessages(prev => [...prev, txMsg])
      setInput('')
      setFollowUpSuggestions([])

      try {
        const { data } = await client.post('/chatbot/parse-transaction', { message })
        if (data.detail && data.detail.length > 0) {
          // Berhasil diparsing — tampilkan UI konfirmasi
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Saya sudah menganalisis transaksi ini. Berikut jurnal yang akan dibuat:`,
            time: formatTime(),
            transaction: {
              deskripsi: data.deskripsi,
              tanggal: data.tanggal,
              detail: data.detail,
              status: 'ready',
            },
          }])
          setLoading(false)
          return true
        }
        // Parse gagal (detail kosong) — lanjut ke chat biasa
        setMessages(prev => prev.slice(0, -1)) // hapus user message sementara
      } catch {
        // Error — lanjut ke chat biasa
        setMessages(prev => prev.slice(0, -1))
      }
      setLoading(false)
    }

    // Normal chat flow
    const userMsg = {
      role: 'user',
      content: message,
      time: formatTime(),
      ...(uploadedFileInfo && { files: [uploadedFileInfo] }),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setFollowUpSuggestions([])
    setLoading(true)

    try {
      const page = PAGE_LABELS[location.pathname] || 'Aplikasi Finora'
      const { data } = await client.post('/chatbot/ask', {
        message,
        session_id: sessionRef.current,
        page,
        upload_id: activeUploadId || undefined,
      })
      sessionRef.current = data.session_id
      setSessionId(data.session_id)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        has_financial_data: data.has_financial_data,
        time: formatTime(),
      }])
    } catch (err) {
      const detail = err?.response?.data?.detail
      let msg = 'Maaf, terjadi kesalahan saat memproses pesan.'
      if (err.response?.status === 413) {
        msg = '📦 Data terlalu besar untuk diproses sekaligus. Coba pertanyaan yang lebih spesifik, misalnya:\n- "Berapa total penjualan dari data ini?"\n- "Ringkasan 10 transaksi teratas"\n- "Breakdown per kategori"'
      } else if (detail) {
        msg += '\n\nDetail: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = '⏱️ Permintaan terlalu lama merespons (timeout). Coba pertanyaan yang lebih singkat.'
      } else if (!err.response) {
        msg = '🔌 Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
      }
      setMessages(prev => [...prev, { role: 'assistant', content: msg, time: formatTime() }])
    } finally {
      setLoading(false)
    }
    return true
  }, [input, loading, location.pathname])

  // --- Confirm and save a parsed transaction as journal ---
  const confirmTransaction = useCallback(async (transaction) => {
    if (!transaction || loading) return
    setLoading(true)

    try {
      const { data } = await client.post('/chatbot/create-journal', {
        deskripsi: transaction.deskripsi,
        tanggal: transaction.tanggal,
        detail: transaction.detail.map(d => ({
          kode_akun: d.kode_akun,
          debit: d.debit || 0,
          kredit: d.kredit || 0,
          keterangan: d.keterangan || null,
        })),
      })

      // Update transaction message status
      setMessages(prev => prev.map(m =>
        m.transaction && m.transaction.deskripsi === transaction.deskripsi
          ? { ...m, transaction: { ...m.transaction, status: 'saved' } }
          : m
      ))

      // Add success message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Jurnal berhasil disimpan!**\n\n` +
          `📄 No. Bukti: *${data.no_bukti}*\n` +
          `📝 ${transaction.deskripsi}\n` +
          `📅 ${transaction.tanggal}\n\n` +
          `Data sudah masuk ke pembukuan dan dashboard.`,
        time: formatTime(),
      }])

      // Tambah follow-up suggestions
      setFollowUpSuggestions([
        { text: 'Catat transaksi lain', icon: 'ReceiptText' },
        { text: 'Tampilkan neraca saldo', icon: 'Landmark' },
        { text: 'Ringkasan keuangan saya', icon: 'TrendingUp' },
      ])
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Gagal menyimpan jurnal'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Gagal menyimpan jurnal: ${msg}`,
        time: formatTime(),
      }])
    } finally {
      setLoading(false)
    }
  }, [loading])

  // --- Reject/cancel a parsed transaction ---
  const rejectTransaction = useCallback((transaction) => {
    setMessages(prev => prev.map(m =>
      m.transaction && m.transaction.deskripsi === transaction.deskripsi
        ? { ...m, transaction: { ...m.transaction, status: 'rejected' } }
        : m
    ))
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Baik, transaksi tidak disimpan. Silakan ketik transaksi baru atau pertanyaan lainnya.',
      time: formatTime(),
    }])
  }, [])

  // --- Explicitly parse as transaction (from "Catat transaksi" button) ---
  const parseTransaction = useCallback(async (text = input) => {
    const message = (text ?? '').trim()
    if (!message || loading) return false
    setMessages(prev => [...prev, { role: 'user', content: message, time: formatTime() }])
    setInput('')
    setFollowUpSuggestions([])
    setLoading(true)

    try {
      const { data } = await client.post('/chatbot/parse-transaction', { message })
      if (data.detail && data.detail.length > 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Saya sudah menganalisis transaksi ini. Berikut jurnal yang akan dibuat:`,
          time: formatTime(),
          transaction: {
            deskripsi: data.deskripsi,
            tanggal: data.tanggal,
            detail: data.detail,
            status: 'ready',
          },
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.raw_response
            ? `Maaf, saya belum bisa memahami transaksi tersebut.\n\n${data.raw_response}`
            : 'Maaf, saya belum bisa memahami transaksi tersebut. Coba jelaskan lebih detail, misal: "Jual kopi Rp 30.000 tunai"',
          time: formatTime(),
        }])
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      let msg = 'Terjadi kesalahan saat memproses transaksi.'
      if (detail) {
        msg += '\n\nDetail: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = '⏱️ Permintaan terlalu lama merespons (timeout). Coba lagi.'
      } else if (!err.response) {
        msg = '🔌 Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
      }
      setMessages(prev => [...prev, { role: 'assistant', content: msg, time: formatTime() }])
    } finally {
      setLoading(false)
    }
    return true
  }, [input, loading])

  // --- Send follow-up suggestion ---
  const sendFollowUp = useCallback((text) => {
    send(text)
  }, [send])

  // --- Upload file (GPT-style) ---
  const uploadAndParse = useCallback(async (file) => {
    if (!file || loading) return
    const userMsg = {
      role: 'user',
      content: '',
      time: formatTime(),
      files: [{ filename: file.name, status: 'uploading', uploadId: null }],
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data: uploaded } = await client.post('/upload/file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Store upload_id for follow-up questions
      setLastUploadId(uploaded.id)
      lastUploadIdRef.current = uploaded.id

      // Update user message with upload id
      setMessages(prev => prev.map(m =>
        m === userMsg ? { ...m, files: [{ filename: file.name, status: 'staged', uploadId: uploaded.id }] } : m
      ))

      // File is now STAGED — user can chat about it
      let content = `✅ File **${file.name}** berhasil diupload!\n\n` +
        `📊 Data sudah siap dianalisis. Kamu bisa bertanya tentang isi data ini sebelum disimpan ke jurnal.\n\n` +
        `💡 Coba tanya:\n` +
        `- "Jelaskan isi data ini"\n` +
        `- "Berapa total transaksi?"\n` +
        `- "Akun mana yang paling banyak?"\n\n` +
        `Ketik **"simpan"** atau **"masukkan ke jurnal"** jika sudah selesai menganalisis.`

      // Fetch follow-up suggestions
      try {
        const { data: followUps } = await client.get(`/chatbot/upload/${uploaded.id}/follow-ups`)
        setFollowUpSuggestions(followUps || [])
      } catch { /* ignore */ }

      setMessages(prev => [...prev, { role: 'assistant', content, time: formatTime() }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Gagal upload file: ${err?.response?.data?.detail || err.message}`,
        time: formatTime(),
      }])
    } finally {
      setLoading(false)
    }
  }, [loading])

  // --- Parse multi-transaction dataset from chat text ---
  const parseDataset = useCallback(async (text = input) => {
    const message = (text ?? '').trim()
    if (!message || loading) return false
    setMessages(prev => [...prev, { role: 'user', content: message, time: formatTime() }])
    setInput('')
    setLoading(true)

    try {
      const { data } = await client.post('/chatbot/parse-dataset', { message })
      if (data.items && data.items.length > 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          time: formatTime(),
          dataset: { items: data.items, status: 'ready' },
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.raw_response
            ? `Maaf, saya belum bisa memahami transaksi tersebut.\n\n${data.raw_response}`
            : 'Maaf, saya belum bisa memahami transaksi tersebut. Coba jelaskan lebih detail.',
          time: formatTime(),
        }])
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      let msg = 'Terjadi kesalahan saat memproses dataset.'
      if (detail) {
        msg += '\n\nDetail: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = '⏱️ Permintaan terlalu lama merespons (timeout). Dataset mungkin terlalu besar.'
      } else if (!err.response) {
        msg = '🔌 Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
      }
      setMessages(prev => [...prev, { role: 'assistant', content: msg, time: formatTime() }])
    } finally {
      setLoading(false)
    }
    return true
  }, [input, loading])

  // --- Confirm and save dataset as journals ---
  const createDataset = useCallback(async (items) => {
    if (!items || items.length === 0) return
    setLoading(true)

    try {
      const { data } = await client.post('/chatbot/create-dataset', { items })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **${data.total} jurnal** berhasil disimpan!\n\n` +
          data.journals.map(j => `- ${j.no_bukti}`).join('\n') +
          '\n\nData sudah masuk ke pembukuan dan dashboard.',
        time: formatTime(),
      }])
      // Update the dataset message status
      setMessages(prev => prev.map(m =>
        m.dataset && m.dataset.items === items
          ? { ...m, dataset: { ...m.dataset, status: 'saved' } }
          : m
      ))
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Gagal menyimpan dataset'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Gagal menyimpan: ${msg}`,
        time: formatTime(),
      }])
    } finally {
      setLoading(false)
    }
  }, [])

  // Move the current conversation into the saved history list.
  const saveCurrentToHistory = useCallback(() => {
    const current = messagesRef.current
    if (!current || current.length === 0) return
    const conversationId = activeConversationRef.current
    const updatedAt = Date.now()
    const entry = {
      id: conversationId || makeId(),
      title: titleFor(current),
      preview: previewFor(current),
      createdAt: updatedAt,
      updatedAt,
      messages: current,
      sessionId: sessionRef.current,
    }
    setConversations(prev => {
      const exists = conversationId ? prev.some(c => c.id === conversationId) : false
      const next = exists
        ? prev.map(c => (c.id === conversationId ? entry : c))
        : [entry, ...prev]
      const trimmed = next.slice(0, HISTORY_LIMIT)
      writeJSON(HISTORY_KEY, trimmed)
      return trimmed
    })
    activeConversationRef.current = entry.id
  }, [HISTORY_KEY])

  const reset = useCallback(() => {
    saveCurrentToHistory()
    activeConversationRef.current = null
    setMessages([])
    setSessionId(null)
    setLastUploadId(null)
    setFollowUpSuggestions([])
    setPendingFile(null)
    sessionRef.current = null
    lastUploadIdRef.current = null
    pendingFileRef.current = null
    try { localStorage.removeItem(ACTIVE_KEY) } catch { /* ignore */ }
  }, [saveCurrentToHistory, ACTIVE_KEY])

  // --- Load a saved conversation into the active chat ---
  const loadConversation = useCallback((id) => {
    const target = conversationsRef.current.find(c => c.id === id)
    if (!target) return
    activeConversationRef.current = id
    setMessages(target.messages)
    setSessionId(target.sessionId || null)
    sessionRef.current = target.sessionId || null
    setFollowUpSuggestions([])
    setInput('')
    writeJSON(ACTIVE_KEY, {
      messages: target.messages,
      sessionId: target.sessionId || null,
      conversationId: id,
    })
  }, [ACTIVE_KEY])

  // --- Delete a saved conversation from history ---
  const deleteConversation = useCallback((id) => {
    if (activeConversationRef.current === id) activeConversationRef.current = null
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      writeJSON(HISTORY_KEY, next)
      return next
    })
  }, [HISTORY_KEY])

  // --- Commit staged upload → jurnal ---
  const commitUpload = useCallback(async (uploadId) => {
    if (!uploadId) return
    setLoading(true)

    try {
      const { data } = await client.post(`/upload/${uploadId}/commit`)
      setLastUploadId(null)
      lastUploadIdRef.current = null

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Data berhasil disimpan ke jurnal!**\n\n` +
          `📊 ${data.journal_count} jurnal dibuat.\n\n` +
          `Data sudah masuk ke pembukuan dan dashboard.`,
        time: formatTime(),
      }])
      notifyDataChanged()
      setFollowUpSuggestions([])
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Gagal menyimpan data ke jurnal'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Gagal menyimpan: ${msg}`,
        time: formatTime(),
      }])
    } finally {
      setLoading(false)
    }
  }, [])

  const setSuggestion = useCallback((text) => {
    setInput(text)
  }, [])

  const removePendingFile = useCallback(() => {
    setPendingFile(null)
    pendingFileRef.current = null
  }, [])

  return {
    messages,
    setMessages,
    input,
    setInput,
    sessionId,
    loading,
    lastUploadId,
    setLastUploadId,
    followUpSuggestions,
    pendingFile,
    setPendingFile,
    removePendingFile,
    send,
    sendFollowUp,
    uploadAndParse,
    parseTransaction,
    confirmTransaction,
    rejectTransaction,
    parseDataset,
    createDataset,
    commitUpload,
    conversations,
    loadConversation,
    deleteConversation,
    reset,
    setSuggestion,
  }
}
