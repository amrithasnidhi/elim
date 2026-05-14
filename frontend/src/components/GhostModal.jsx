import { useState, useEffect } from 'react'
import api from '../lib/api'

const DIFF_COLORS = {
  added: 'rgba(0,255,157,0.15)',
  removed: 'rgba(255,68,102,0.15)',
  context: 'transparent',
}

export default function GhostModal({ historyId, topic, onClose }) {
  const [timeline, setTimeline] = useState([])
  const [selected, setSelected] = useState(null)
  const [diff, setDiff] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/profile/history/topic-timeline', {
      params: { topic, current_id: historyId },
    }).then((res) => {
      setTimeline(res.data.items)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [historyId, topic])

  const loadDiff = async (pastId) => {
    setSelected(pastId)
    const res = await api.get('/profile/history/diff', {
      params: { h1: pastId, h2: historyId },
    })
    setDiff(res.data)
  }

  const parseDiffLine = (line) => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'added', text: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'removed', text: line }
    if (line.startsWith('@@')) return { type: 'header', text: line }
    return { type: 'context', text: line }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', border: '1px solid rgba(0,229,255,0.2)',
          borderRadius: 4, maxWidth: 900, width: '100%', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(0,229,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" fill="none" stroke="var(--purple)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', color: 'var(--purple)',
            }}>
              EXPLANATION_GHOST
            </span>
          </div>
          <button onClick={onClose} className="cyber-btn-ghost" style={{ padding: '4px 8px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Timeline sidebar */}
          <div style={{
            width: 220, borderRight: '1px solid rgba(0,229,255,0.1)',
            overflowY: 'auto', padding: '0.75rem',
          }}>
            <p style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, letterSpacing: '0.14em',
              color: 'var(--sub)', marginBottom: '0.75rem',
            }}>
              PAST_VERSIONS
            </p>
            {loading && (
              <p style={{ color: 'var(--sub)', fontSize: 12 }}>Loading...</p>
            )}
            {!loading && timeline.length === 0 && (
              <p style={{ color: 'var(--sub)', fontSize: 12 }}>No past versions</p>
            )}
            {timeline.map((item) => (
              <button
                key={item.id}
                onClick={() => loadDiff(item.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
                  borderRadius: 3,
                  border: selected === item.id
                    ? '1px solid var(--purple)'
                    : '1px solid rgba(0,229,255,0.1)',
                  background: selected === item.id
                    ? 'rgba(124,110,240,0.1)'
                    : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <p style={{
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 10, color: 'var(--text)',
                  marginBottom: 3,
                }}>
                  {new Date(item.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
                <p style={{
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 9, color: 'var(--sub)',
                }}>
                  {item.style_used?.toUpperCase()} · LVL {item.difficulty_used}
                </p>
              </button>
            ))}
          </div>

          {/* Diff view */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
            {!diff && (
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <p style={{
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 11, color: 'var(--sub)', textAlign: 'center',
                }}>
                  Select past version to compare
                </p>
              </div>
            )}
            {diff && (
              <>
                <div style={{
                  display: 'flex', gap: '1.5rem', marginBottom: '1rem',
                  fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
                }}>
                  <div>
                    <span style={{ color: 'var(--sub)' }}>THEN: </span>
                    <span style={{ color: '#ff6b8a' }}>
                      {new Date(diff.h1.created_at).toLocaleDateString()} · {diff.h1.style_used}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--sub)' }}>NOW: </span>
                    <span style={{ color: 'var(--green)' }}>
                      {new Date(diff.h2.created_at).toLocaleDateString()} · {diff.h2.style_used}
                    </span>
                  </div>
                </div>

                <div style={{
                  fontFamily: "'Fira Code',monospace", fontSize: 12,
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {diff.diff.slice(2).map((line, i) => {
                    const { type, text } = parseDiffLine(line)
                    if (type === 'header') return null
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '2px 8px',
                          background: DIFF_COLORS[type] || 'transparent',
                          color: type === 'added' ? 'var(--green)'
                               : type === 'removed' ? '#ff6b8a'
                               : 'var(--text)',
                          borderLeft: type === 'added' ? '3px solid var(--green)'
                                    : type === 'removed' ? '3px solid #ff6b8a'
                                    : '3px solid transparent',
                        }}
                      >
                        {text || ' '}
                      </div>
                    )
                  })}
                </div>

                <div style={{
                  marginTop: '1.5rem', padding: '1rem',
                  background: 'rgba(124,110,240,0.06)',
                  border: '1px solid rgba(124,110,240,0.2)',
                  borderRadius: 3,
                }}>
                  <p style={{
                    fontFamily: "'Share Tech Mono',monospace",
                    fontSize: 9, letterSpacing: '0.14em',
                    color: 'var(--purple)', marginBottom: 6,
                  }}>
                    GROWTH_SUMMARY
                  </p>
                  <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--green)' }}>
                      +{diff.diff.filter(l => l.startsWith('+') && !l.startsWith('+++')).length}
                    </span>
                    {' concepts added · '}
                    <span style={{ color: '#ff6b8a' }}>
                      -{diff.diff.filter(l => l.startsWith('-') && !l.startsWith('---')).length}
                    </span>
                    {' simplified'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
