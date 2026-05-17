import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function ReexplainPanel({ historyId, direction }) {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [data,    setData]    = useState(null)

  useEffect(() => {
    setLoading(true); setError(null); setData(null)
    api.post('/explain/reexplain', { history_id: historyId, direction })
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.detail || 'Re-explain failed'); setLoading(false) })
  }, [historyId, direction])

  const accent = direction === 'simplify' ? 'var(--cyan)' : 'var(--purple)'
  const accentRGB = direction === 'simplify' ? '0,229,255' : '124,110,240'
  const label = direction === 'simplify' ? 'SIMPLIFIED · ↓' : 'DEEPENED · ↑'

  if (loading) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, letterSpacing: '0.14em', color: 'var(--sub)',
    }}>RE-EXPLAINING ({direction.toUpperCase()})...</div>
  )
  if (error) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, color: '#D85A30',
    }}>ERROR — {error}</div>
  )
  if (!data) return null

  return (
    <div style={{
      background: `rgba(${accentRGB},0.04)`,
      border: `1px solid rgba(${accentRGB},0.25)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: '0 4px 4px 0',
      padding: '0.85rem 1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.16em', color: accent,
        }}>// {label}</span>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)',
        }}>
          DIFFICULTY {data.from_difficulty} → {data.to_difficulty}
        </span>
      </div>
      <div className="elim-prose">
        {(data.explanation || '').split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  )
}
