import { useState, useEffect } from 'react'
import api from '../lib/api'

const DOMAIN_COLORS = {
  cooking:      '#F5A623',
  sports:       '#00E5FF',
  music:        '#B44FE8',
  gaming:       '#00FF9D',
  geography:    '#7C6EF0',
  biology:      '#3ECFB0',
  engineering:  '#85B7EB',
  finance:      '#EF9F27',
  nature:       '#639922',
  cinema:       '#D4537E',
  military:     '#D85A30',
  architecture: '#888780',
}

const DOMAIN_ICONS = {
  cooking:      '🍳',
  sports:       '⚽',
  music:        '🎵',
  gaming:       '🎮',
  geography:    '🗺️',
  biology:      '🧬',
  engineering:  '⚙️',
  finance:      '📈',
  nature:       '🌿',
  cinema:       '🎬',
  military:     '⚔️',
  architecture: '🏛️',
}

function DomainBar({ domain, pct, color, rank, animate }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!animate) return
    const t = setTimeout(() => setWidth(pct), rank * 80 + 200)
    return () => clearTimeout(t)
  }, [pct, animate, rank])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 9, letterSpacing: '0.06em',
        color: '#5A8FAA', minWidth: 92, textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ fontSize: 12 }}>{DOMAIN_ICONS[domain] || '◆'}</span>
        {domain}
      </span>
      <div style={{ flex: 1, height: 4, background: 'rgba(0,229,255,0.06)', borderRadius: 0 }}>
        <div style={{
          height: '100%', width: `${width}%`,
          background: color,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
        }}>
          {width > 0 && (
            <span style={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 6, height: 6, borderRadius: '50%',
              background: color, boxShadow: `0 0 6px ${color}`,
              display: 'block',
            }} />
          )}
        </div>
      </div>
      <span style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: 11, fontWeight: 700, color,
        minWidth: 34, textAlign: 'right',
      }}>
        {pct}%
      </span>
    </div>
  )
}

function RadarChart({ weights }) {
  const domains = Object.keys(weights)
  const n = domains.length
  const CX = 90, CY = 90, R = 70

  const pts = domains.map((d, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    const r = (weights[d] / 100) * R
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), domain: d, pct: weights[d] }
  })

  const polygon = pts.map(p => `${p.x},${p.y}`).join(' ')
  const rings = [25, 50, 75, 100]

  return (
    <svg width={180} height={180} style={{ overflow: 'visible' }}>
      {rings.map(r => {
        const ringPts = domains.map((_, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2
          const rr = (r / 100) * R
          return `${CX + rr * Math.cos(angle)},${CY + rr * Math.sin(angle)}`
        }).join(' ')
        return <polygon key={r} points={ringPts} fill="none" stroke="rgba(0,229,255,0.08)" strokeWidth="0.5" />
      })}
      {pts.map((_, i) => (
        <line
          key={i}
          x1={CX} y1={CY}
          x2={CX + R * Math.cos((i / n) * 2 * Math.PI - Math.PI / 2)}
          y2={CY + R * Math.sin((i / n) * 2 * Math.PI - Math.PI / 2)}
          stroke="rgba(0,229,255,0.06)" strokeWidth="0.5"
        />
      ))}
      <polygon points={polygon} fill="rgba(124,110,240,0.15)" stroke="rgba(124,110,240,0.5)" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.pct > 12 ? 4 : 2} fill={DOMAIN_COLORS[p.domain] || '#7C6EF0'} />
      ))}
    </svg>
  )
}

function StyleBadge({ style, topDomain, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '1rem',
      background: `${color}0A`,
      border: `1px solid ${color}30`,
      borderRadius: 4,
      position: 'relative', overflow: 'hidden',
      marginBottom: '1rem',
    }}>
      <div style={{
        position: 'absolute', width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}20, transparent 70%)`,
        top: -20, right: -20, pointerEvents: 'none',
      }} />
      <span style={{ fontSize: 28, marginBottom: 6 }}>{DOMAIN_ICONS[topDomain] || '◆'}</span>
      <div style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: 14, fontWeight: 700, color,
        textShadow: `0 0 12px ${color}66`,
        letterSpacing: '0.06em', textAlign: 'center', marginBottom: 4,
      }}>
        {style}
      </div>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 9, letterSpacing: '0.12em',
        color: '#5A8FAA', textTransform: 'uppercase',
      }}>
        PRIMARY METAPHOR DOMAIN
      </div>
    </div>
  )
}

function NotReady({ sessionsUntilReady }) {
  const filled = Math.max(0, 3 - sessionsUntilReady)
  return (
    <div style={{
      padding: '1.5rem',
      background: 'rgba(7,13,26,0.6)',
      border: '1px dashed rgba(0,229,255,0.15)',
      borderRadius: 4, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 10, letterSpacing: '0.15em',
        color: '#2A4560', textTransform: 'uppercase', marginBottom: '0.6rem',
      }}>
        FINGERPRINT_CALIBRATING
      </div>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 14, color: '#5A8FAA', lineHeight: 1.6, marginBottom: '0.75rem',
      }}>
        Generate and rate {sessionsUntilReady} more explanation{sessionsUntilReady !== 1 ? 's' : ''} to unlock your thinking style fingerprint.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < filled ? '#00E5FF' : 'rgba(0,229,255,0.15)',
            boxShadow: i < filled ? '0 0 8px rgba(0,229,255,0.5)' : 'none',
            transition: 'all 0.4s',
          }} />
        ))}
      </div>
    </div>
  )
}

export default function ThinkingStyleCard() {
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    api.get('/metaphor/profile')
      .then(res => {
        setProfile(res.data)
        setLoading(false)
        setTimeout(() => setAnimated(true), 100)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{
        background: 'rgba(7,13,26,0.8)',
        border: '1px solid rgba(0,229,255,0.1)',
        borderRadius: 4, padding: '1rem 1.25rem',
      }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 10, letterSpacing: '0.15em',
          color: '#2A4560', textTransform: 'uppercase',
        }}>
          LOADING FINGERPRINT...
        </div>
      </div>
    )
  }

  const topDomain = profile?.top_domains?.[0]?.[0]
  const topColor  = DOMAIN_COLORS[topDomain] || '#7C6EF0'

  return (
    <div style={{
      background: 'rgba(7,13,26,0.9)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 4, overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          borderBottom: expanded ? '1px solid rgba(0,229,255,0.1)' : 'none',
          background: 'rgba(0,229,255,0.02)',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, letterSpacing: '0.2em',
          color: '#00E5FF', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: profile?.ready ? '#00FF9D' : '#2A4560',
            boxShadow: profile?.ready ? '0 0 8px rgba(0,255,157,0.5)' : 'none',
            display: 'inline-block',
          }} />
          METAPHOR_FINGERPRINT
          {profile?.ready && profile.thinking_style && (
            <span style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 13, color: '#5A8FAA',
              fontWeight: 400, letterSpacing: 0,
            }}>
              — {profile.thinking_style}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, color: '#2A4560',
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: expanded ? 'rotate(90deg)' : 'none',
        }}>
          ▶
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '1.25rem' }}>
          {!profile?.ready ? (
            <NotReady sessionsUntilReady={profile?.sessions_until_ready ?? 3} />
          ) : (
            <>
              {topDomain && (
                <StyleBadge style={profile.thinking_style} topDomain={topDomain} color={topColor} />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.25rem', alignItems: 'start' }}>
                <div>
                  <div style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 9, letterSpacing: '0.15em',
                    color: '#2A4560', textTransform: 'uppercase', marginBottom: '0.75rem',
                  }}>
                    // TOP DOMAINS
                  </div>
                  {profile.top_domains?.map(([domain, pct], i) => (
                    <DomainBar
                      key={domain} domain={domain} pct={pct}
                      color={DOMAIN_COLORS[domain] || '#7C6EF0'}
                      rank={i} animate={animated}
                    />
                  ))}
                  {profile.novelty_skip && (
                    <div style={{
                      marginTop: '0.75rem', padding: '0.5rem 0.75rem',
                      background: 'rgba(245,166,35,0.06)',
                      border: '1px solid rgba(245,166,35,0.2)',
                      borderRadius: 2,
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9, letterSpacing: '0.08em', color: '#F5A623',
                    }}>
                      ⟳ VARIETY MODE — rotating to secondary domain this session
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 9, letterSpacing: '0.12em',
                    color: '#2A4560', textTransform: 'uppercase', marginBottom: '0.5rem',
                  }}>
                    // FULL MAP
                  </div>
                  {profile.all_weights && <RadarChart weights={profile.all_weights} />}
                </div>
              </div>

              <div style={{
                marginTop: '1rem',
                borderTop: '1px solid rgba(0,229,255,0.06)',
                paddingTop: '1rem',
              }}>
                <div style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9, letterSpacing: '0.15em',
                  color: '#2A4560', textTransform: 'uppercase', marginBottom: '0.75rem',
                }}>
                  // ALL DOMAINS — {profile.session_count} SESSIONS
                </div>
                {profile.all_weights &&
                  Object.entries(profile.all_weights)
                    .sort((a, b) => b[1] - a[1])
                    .map(([domain, pct], i) => (
                      <DomainBar
                        key={domain} domain={domain} pct={pct}
                        color={DOMAIN_COLORS[domain] || '#5A8FAA'}
                        rank={i} animate={animated}
                      />
                    ))
                }
              </div>

              <div style={{
                marginTop: '0.75rem',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9, color: '#2A4560',
                letterSpacing: '0.08em', lineHeight: 1.6,
              }}>
                // INVISIBLE TO YOUR LEARNING FLOW — ELIM ADAPTS METAPHORS AUTOMATICALLY
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
