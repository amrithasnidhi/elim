import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

const GRADE_META = {
  MASTERED: { color: '#00FF9D', bar: 'rgba(0,255,157,0.75)' },
  SOLID:    { color: '#7C6EF0', bar: 'rgba(124,110,240,0.75)' },
  PARTIAL:  { color: '#F5A623', bar: 'rgba(245,166,35,0.75)' },
  FUZZY:    { color: '#D85A30', bar: 'rgba(216,90,48,0.75)' },
  MISSING:  { color: '#E24B4A', bar: 'rgba(226,75,74,0.75)' },
}

function gradeFromScore(s) {
  if (s >= 90) return 'MASTERED'
  if (s >= 75) return 'SOLID'
  if (s >= 50) return 'PARTIAL'
  if (s >= 25) return 'FUZZY'
  return 'MISSING'
}

// Tiny inline sparkline — no dependencies
function Sparkline({ points, color }) {
  if (!points || points.length < 2) return null
  const W = 80, H = 28
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys = points.map((v) => H - ((v - min) / range) * (H - 4) - 2)
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.5} fill={color} />
    </svg>
  )
}

export default function FeynmanDashboard() {
  const { data: mastery, isLoading: masteryLoading } = useQuery({
    queryKey: ['feynman-mastery'],
    queryFn: () => api.get('/feynman/mastery').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: gaps, isLoading: gapsLoading } = useQuery({
    queryKey: ['feynman-gaps'],
    queryFn: () => api.get('/feynman/persistent-gaps').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: history } = useQuery({
    queryKey: ['feynman-history'],
    queryFn: () => api.get('/feynman/history', { params: { limit: 10 } }).then((r) => r.data),
    staleTime: 60_000,
  })

  const hasMastery = mastery && mastery.length > 0
  const hasGaps    = gaps && gaps.length > 0
  const hasHistory = history && history.length > 0

  if (!hasMastery && !hasGaps && !hasHistory && !masteryLoading && !gapsLoading) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Mastery panel */}
      <div className="cyber-panel">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--cyan)',
          }}>
            FEYNMAN_MASTERY
          </p>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            WEIGHTED SCORE ACROSS ALL SESSIONS
          </p>
        </div>

        {masteryLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 36, background: 'rgba(0,229,255,0.04)', borderRadius: 2, animation: 'blink 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : hasMastery ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mastery.map((item) => {
              const grade = gradeFromScore(item.current_score)
              const meta = GRADE_META[grade]
              const sparkPts = item.sessions.map((s) => s.score)
              return (
                <div key={item.topic} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.55rem 0.75rem',
                  background: 'rgba(0,229,255,0.02)',
                  border: '1px solid rgba(0,229,255,0.08)',
                  borderRadius: 2,
                }}>
                  {/* Bar + label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 14, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.topic}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {item.improvement !== 0 && (
                          <span style={{
                            fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                            color: item.improvement > 0 ? '#00FF9D' : '#E24B4A',
                          }}>
                            {item.improvement > 0 ? '+' : ''}{item.improvement}
                          </span>
                        )}
                        <span style={{
                          fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700,
                          color: meta.color,
                        }}>
                          {item.current_score}
                        </span>
                        <span style={{
                          fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
                          color: meta.color, padding: '2px 6px',
                          border: `1px solid ${meta.color}44`, borderRadius: 1,
                        }}>
                          {grade}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 2, background: 'rgba(0,229,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${item.current_score}%`,
                        background: meta.bar,
                        boxShadow: `0 0 6px ${meta.bar}`,
                        borderRadius: 1,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>

                  {/* Sparkline */}
                  <Sparkline points={sparkPts} color={meta.color} />
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            NO FEYNMAN SESSIONS YET — GENERATE AN EXPLANATION TO START
          </p>
        )}
      </div>

      {/* Persistent gaps */}
      {(hasGaps || gapsLoading) && (
        <div className="cyber-panel" style={{
          background: 'rgba(226,75,74,0.03)',
          borderColor: 'rgba(226,75,74,0.15)',
        }}>
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            color: '#E24B4A', marginBottom: '0.875rem',
          }}>
            PERSISTENT_GAPS
          </p>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            CONCEPTS MISSED 2+ TIMES — NEEDS FOCUSED REVIEW
          </p>

          {gapsLoading ? (
            <div style={{ height: 40, background: 'rgba(226,75,74,0.06)', borderRadius: 2, animation: 'blink 1.5s ease-in-out infinite' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gaps.map((g) => (
                <div key={g.concept} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(226,75,74,0.05)',
                  borderLeft: '3px solid rgba(226,75,74,0.5)',
                  borderRadius: '0 2px 2px 0',
                }}>
                  <div>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, color: 'var(--text)' }}>
                      {g.concept}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', marginLeft: 8 }}>
                      via {g.topic}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700,
                    color: '#E24B4A',
                    padding: '2px 8px', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 2,
                  }}>
                    ×{g.missed}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent sessions */}
      {hasHistory && (
        <div className="cyber-panel">
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--cyan)', marginBottom: '1rem',
          }}>
            RECENT_FEYNMAN_SESSIONS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {history.map((h) => {
              const meta = GRADE_META[h.grade] || GRADE_META.PARTIAL
              return (
                <div key={h.feynman_session_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.45rem 0.75rem',
                  background: 'rgba(0,229,255,0.02)',
                  border: '1px solid rgba(0,229,255,0.07)',
                  borderRadius: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: meta.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {h.topic}
                    </span>
                    {h.gaps_count > 0 && (
                      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: '#E24B4A' }}>
                        {h.gaps_count} gap{h.gaps_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700, color: meta.color }}>
                      {h.score}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
                      {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
