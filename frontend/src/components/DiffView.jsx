import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

function DiffLine({ line }) {
  const base = {
    fontFamily: "'Share Tech Mono',monospace",
    fontSize: 10, padding: '2px 12px', display: 'block',
    borderLeft: '2px solid transparent',
  }

  if (line.startsWith('---') || line.startsWith('+++')) {
    return (
      <span style={{ ...base, color: 'var(--dim)', background: 'rgba(0,229,255,0.02)' }}>
        {line}
      </span>
    )
  }
  if (line.startsWith('@@')) {
    return (
      <span style={{ ...base, color: 'var(--purple)', background: 'rgba(124,110,240,0.06)' }}>
        {line}
      </span>
    )
  }
  if (line.startsWith('+')) {
    return (
      <span style={{ ...base, color: 'var(--green)', background: 'rgba(0,255,157,0.04)', borderLeftColor: 'rgba(0,255,157,0.4)' }}>
        {line}
      </span>
    )
  }
  if (line.startsWith('-')) {
    return (
      <span style={{ ...base, color: '#ff4466', background: 'rgba(255,68,102,0.04)', borderLeftColor: 'rgba(255,68,102,0.4)' }}>
        {line}
      </span>
    )
  }
  return (
    <span style={{ ...base, color: 'var(--sub)' }}>
      {line}
    </span>
  )
}

export default function DiffView({ h1, h2 }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['diff', h1, h2],
    queryFn: () => api.get('/profile/history/diff', { params: { h1, h2 } }).then((r) => r.data),
    enabled: !!(h1 && h2 && h1 !== h2),
  })

  if (!h1 || !h2) return null
  if (h1 === h2) return (
    <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', textAlign: 'center', padding: '0.75rem 0' }}>
      SELECT TWO DIFFERENT VERSIONS
    </p>
  )

  if (isLoading) {
    return (
      <div style={{
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)',
      }}>
        COMPUTING DIFF…
      </div>
    )
  }

  if (error) {
    return (
      <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#ff4466', textAlign: 'center', padding: '0.75rem 0' }}>
        DIFF_LOAD_ERROR
      </p>
    )
  }

  if (!data?.diff?.length) {
    return (
      <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', textAlign: 'center', padding: '0.75rem 0' }}>
        NO_DIFFERENCES_FOUND
      </p>
    )
  }

  return (
    <div style={{
      background: 'rgba(3,6,15,0.8)',
      border: '1px solid rgba(0,229,255,0.12)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.4rem 0.875rem',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: '0.14em', color: 'var(--sub)' }}>
          EXPLANATION_DIFF
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
            <span style={{ width: 10, height: 10, background: 'rgba(255,68,102,0.15)', borderLeft: '2px solid rgba(255,68,102,0.5)', display: 'inline-block' }} />
            REMOVED
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
            <span style={{ width: 10, height: 10, background: 'rgba(0,255,157,0.1)', borderLeft: '2px solid rgba(0,255,157,0.5)', display: 'inline-block' }} />
            ADDED
          </span>
        </div>
      </div>
      <div style={{ maxHeight: 384, overflowY: 'auto' }}>
        {data.diff.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </div>
    </div>
  )
}
