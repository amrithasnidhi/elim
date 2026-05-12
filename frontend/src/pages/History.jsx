import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Background from '../components/Background'
import api from '../lib/api'

const STYLE_COLORS = {
  analogy:       { color: 'var(--purple)', border: 'rgba(124,110,240,0.3)', bg: 'rgba(124,110,240,0.06)' },
  'step-by-step':{ color: 'var(--cyan)',   border: 'rgba(0,229,255,0.3)',   bg: 'rgba(0,229,255,0.06)' },
  'code-based':  { color: 'var(--green)',  border: 'rgba(0,255,157,0.3)',   bg: 'rgba(0,255,157,0.06)' },
}

function ScoreBadge({ score }) {
  if (score === 1) return (
    <span style={{
      fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
      color: 'var(--green)', border: '1px solid rgba(0,255,157,0.3)',
      background: 'rgba(0,255,157,0.06)', padding: '2px 6px', borderRadius: 2,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <svg width="8" height="8" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
      </svg>
      HELPFUL
    </span>
  )
  if (score === -1) return (
    <span style={{
      fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
      color: '#ff4466', border: '1px solid rgba(255,68,102,0.3)',
      background: 'rgba(255,68,102,0.06)', padding: '2px 6px', borderRadius: 2,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <svg width="8" height="8" fill="currentColor" viewBox="0 0 20 20">
        <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
      </svg>
      NOT_HELPFUL
    </span>
  )
  return <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>—</span>
}

export default function History() {
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [topicFilter, setTopicFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['history', page, topicFilter],
    queryFn: () =>
      api.get('/profile/history', { params: { page, limit: 20, topic: topicFilter || undefined } })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div>
            <h1 style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 18, fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--cyan)',
              textShadow: '0 0 20px rgba(0,229,255,0.3)',
              marginBottom: 4,
            }}>
              EXPLANATION_HISTORY
            </h1>
            <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)' }}>
              ALL PAST SESSIONS
            </p>
          </div>
          <input
            type="text"
            placeholder="FILTER BY TOPIC…"
            value={topicFilter}
            onChange={(e) => { setTopicFilter(e.target.value); setPage(1) }}
            className="cyber-input"
            style={{ width: 220, padding: '0.45rem 0.875rem', fontSize: 11 }}
          />
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid rgba(0,229,255,0.1)',
              borderTop: '2px solid var(--cyan)',
              animation: 'spinCW 0.8s linear infinite',
            }} />
          </div>
        ) : !data?.items?.length ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <p style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, color: 'var(--dim)', letterSpacing: '0.1em', marginBottom: 8 }}>
              NO_RECORDS_FOUND
            </p>
            <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em' }}>
              GENERATE YOUR FIRST EXPLANATION ON THE INTERFACE
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.items.map((item) => {
                const styleMeta = STYLE_COLORS[item.style_used] || { color: 'var(--sub)', border: 'rgba(0,229,255,0.15)', bg: 'rgba(0,229,255,0.03)' }
                const isOpen = expanded === item.id
                return (
                  <div key={item.id} style={{
                    background: 'rgba(7,13,26,0.9)',
                    border: '1px solid rgba(0,229,255,0.12)',
                    borderRadius: 2, overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      style={{
                        width: '100%', padding: '0.875rem 1.25rem',
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontFamily: "'Rajdhani',sans-serif",
                          fontSize: 14, fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>
                          {item.topic}
                        </p>
                        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString() : ''} · D{item.difficulty_used}/5
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
                          color: styleMeta.color,
                          border: `1px solid ${styleMeta.border}`,
                          background: styleMeta.bg,
                          padding: '2px 6px', borderRadius: 2,
                        }}>
                          {item.style_used?.toUpperCase()}
                        </span>
                        <ScoreBadge score={item.feedback_score} />
                        <svg
                          width="12" height="12" fill="none" stroke="var(--dim)" viewBox="0 0 24 24"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: '0 1.25rem 1.25rem',
                        borderTop: '1px solid rgba(0,229,255,0.06)',
                      }}>
                        <p style={{
                          color: 'var(--text)', fontSize: 14, lineHeight: 1.7,
                          whiteSpace: 'pre-wrap', paddingTop: '1rem',
                          fontFamily: "'Rajdhani',sans-serif",
                        }}>
                          {item.explanation}
                        </p>
                        {item.star_rating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8 }}>
                            {[1,2,3,4,5].map((s) => (
                              <svg key={s} width="12" height="12" fill="currentColor" viewBox="0 0 20 20"
                                style={{ color: s <= item.star_rating ? 'var(--amber)' : 'var(--dim)' }}
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', marginLeft: 4 }}>
                              {item.star_rating}/5
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)' }}>
                {data.total} RECORD{data.total !== 1 ? 'S' : ''}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="cyber-btn-ghost"
                  style={{ opacity: page === 1 ? 0.3 : 1 }}
                >
                  ◀ PREV
                </button>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--sub)', padding: '0 4px' }}>
                  P.{page}
                </span>
                <button
                  disabled={!data.has_more}
                  onClick={() => setPage((p) => p + 1)}
                  className="cyber-btn-ghost"
                  style={{ opacity: !data.has_more ? 0.3 : 1 }}
                >
                  NEXT ▶
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
