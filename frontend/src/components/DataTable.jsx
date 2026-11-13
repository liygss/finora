import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function DataTable({ columns, data, emptyMessage = 'Tidak ada data', pageSize = 10, showPagination = true }) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [data])
  const totalPages = Math.ceil((data?.length || 0) / pageSize)
  const paginatedData = showPagination && data
    ? data.slice(page * pageSize, (page + 1) * pageSize)
    : data || []

  if (!data || data.length === 0) {
    return (
      <div className="card text-center py-16">
        <div className="inline-flex rounded-2xl p-4 mb-4" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--color-slate-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-slate-body)' }}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
              {columns.map((col, i) => (
                <th key={i} className="tbl-header">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, ri) => (
              <tr
                key={ri}
                className="tbl-row group"
                style={{ animationDelay: `${ri * 40}ms` }}
              >
                {columns.map((col, ci) => (
                  <td key={ci} className="tbl-cell">
                    {col.render ? col.render(row, ri) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.14)', background: 'var(--color-surface-faint)' }}>
          <p className="text-xs" style={{ color: 'var(--color-slate-body)' }}>
            Menampilkan {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} dari {data.length} data
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-xl transition hover:bg-blue-500/15 disabled:hover:bg-transparent"
              style={{ color: page === 0 ? '#475569' : 'var(--color-brand-soft)' }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum = i
              if (totalPages > 5) {
                if (page < 3) pageNum = i
                else if (page > totalPages - 4) pageNum = totalPages - 5 + i
                else pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className="h-7 w-7 rounded-xl text-xs font-semibold transition-all duration-200"
                  style={page === pageNum ? {
                    background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
                  } : {
                    color: 'var(--color-slate-body)',
                  }}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-xl transition hover:bg-blue-500/15 disabled:hover:bg-transparent"
              style={{ color: page >= totalPages - 1 ? '#475569' : 'var(--color-brand-soft)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
