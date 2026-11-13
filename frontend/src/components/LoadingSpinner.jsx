export default function LoadingSpinner({ size = 'md', className = '' }) {
  const px = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size]
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`${px} animate-spin rounded-full border-2`} style={{ borderColor: 'rgba(148, 163, 184, 0.18)', borderTopColor: '#2563EB' }} />
        <div className={`absolute inset-0 ${px} animate-spin rounded-full border-2 border-transparent`} style={{ borderTopColor: 'var(--color-brand-soft)', opacity: 0.5, animationDuration: '1.5s' }} />
      </div>
    </div>
  )
}

export function Skeleton({ className = '', count = 1 }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-4 w-full" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card space-y-4 ${className}`}>
      <div className="skeleton h-5 w-1/3 rounded-xl" />
      <div className="skeleton h-8 w-1/2 rounded-xl" />
      <div className="skeleton h-3 w-2/3 rounded-xl" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card overflow-hidden">
      <div className="space-y-0">
        <div className="flex gap-4 p-4" style={{ background: 'var(--color-surface-faint)' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton h-4 flex-1 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex gap-4 p-4" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            {Array.from({ length: cols }).map((_, ci) => (
              <div key={ci} className="skeleton h-4 flex-1 rounded-lg" style={{ animationDelay: `${(ri * cols + ci) * 50}ms`, width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
