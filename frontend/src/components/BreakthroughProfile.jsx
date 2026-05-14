import { useState, useEffect } from 'react'
import api from '../lib/api'

const STYLE_ICONS = {
  analogy: '🔗',
  'step-by-step': '📋',
  'code-based': '💻',
}

export default function BreakthroughProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/profile/breakthrough-profile')
      .then((res) => {
        setProfile(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="cyber-panel" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--sub)', fontFamily: "'Share Tech Mono',monospace", fontSize: 11 }}>
          ANALYZING_BREAKTHROUGHS...
        </p>
      </div>
    )
  }

  if (!profile?.has_profile) {
    return (
      <div className="cyber-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <svg width="18" height="18" fill="none" stroke="var(--purple)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', color: 'var(--purple)',
          }}>
            BREAKTHROUGH_PROFILE
          </span>
        </div>
        <p style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.6 }}>
          {profile?.message || 'Keep learning! Profile builds after detecting aha moments in your conversations.'}
        </p>
        <p style={{
          color: 'var(--text)', fontSize: 12, marginTop: '0.75rem',
          fontFamily: "'Share Tech Mono',monospace",
        }}>
          {profile?.total_moments || 0} / 3 moments detected
        </p>
      </div>
    )
  }

  return (
    <div className="cyber-panel" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <svg width="18" height="18" fill="none" stroke="var(--purple)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span style={{
          fontFamily: "'Orbitron',monospace",
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--purple)',
        }}>
          BREAKTHROUGH_PROFILE
        </span>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, color: 'var(--green)',
          marginLeft: 'auto',
        }}>
          {profile.total_moments} AHA_MOMENTS
        </span>
      </div>

      {/* Insights */}
      <div style={{ marginBottom: '1.25rem' }}>
        {profile.insights?.map((insight, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '0.6rem 0',
              borderBottom: i < profile.insights.length - 1 ? '1px solid rgba(0,229,255,0.06)' : 'none',
            }}
          >
            <span style={{ color: 'var(--green)', fontSize: 12 }}>▸</span>
            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>
              {insight}
            </p>
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          padding: '0.75rem',
          background: 'rgba(124,110,240,0.06)',
          border: '1px solid rgba(124,110,240,0.15)',
          borderRadius: 3, textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, color: 'var(--purple)',
          }}>
            {profile.avg_turn}
          </p>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 8, letterSpacing: '0.12em', color: 'var(--sub)',
          }}>
            AVG_TURNS
          </p>
        </div>
        <div style={{
          padding: '0.75rem',
          background: 'rgba(0,255,157,0.06)',
          border: '1px solid rgba(0,255,157,0.15)',
          borderRadius: 3, textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, color: 'var(--green)',
          }}>
            {Math.round(profile.avg_confidence * 100)}%
          </p>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 8, letterSpacing: '0.12em', color: 'var(--sub)',
          }}>
            CONFIDENCE
          </p>
        </div>
        <div style={{
          padding: '0.75rem',
          background: 'rgba(0,229,255,0.06)',
          border: '1px solid rgba(0,229,255,0.15)',
          borderRadius: 3, textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, color: 'var(--cyan)',
          }}>
            {profile.best_style_pct}%
          </p>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 8, letterSpacing: '0.12em', color: 'var(--sub)',
          }}>
            {profile.best_style?.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Optimal Sequence */}
      <div>
        <p style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.14em',
          color: 'var(--sub)', marginBottom: '0.5rem',
        }}>
          OPTIMAL_SEQUENCE
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {profile.optimal_sequence?.map((style, i) => (
            <div
              key={style}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0.4rem 0.75rem',
                background: i === 0 ? 'rgba(124,110,240,0.1)' : 'transparent',
                border: `1px solid ${i === 0 ? 'var(--purple)' : 'rgba(0,229,255,0.12)'}`,
                borderRadius: 3,
              }}
            >
              <span style={{ fontSize: 12 }}>{STYLE_ICONS[style] || '📚'}</span>
              <span style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: '0.1em',
                color: i === 0 ? 'var(--purple)' : 'var(--sub)',
              }}>
                {i + 1}. {style?.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
