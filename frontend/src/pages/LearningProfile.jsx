/**
 * LearningProfile.jsx
 *
 * "What ELIM has learned about you" — the visible proof of personalization.
 * Surfaces every active signal that reshapes your explanation prompts, with
 * evidence counts so nothing is asserted from no data.
 */

import { useEffect, useState } from 'react'
import api from '../lib/api'

const T = {
  bg: '#010208', text: '#E8F4FF', sub: '#5A8FAA', dim: '#2A4560',
  cyan: '#00E5FF', purple: '#7C6EF0', green: '#00FF9D',
  amber: '#F5A623', coral: '#D85A30', gold: '#C9A86B',
}

const KIND_META = {
  style:         { accent: T.cyan,   label: '// STYLE' },
  domain_prefer: { accent: T.green,  label: '// METAPHOR_PREFERENCE' },
  domain_avoid:  { accent: T.coral,  label: '// METAPHOR_AVOIDED' },
  length:        { accent: T.purple, label: '// OPTIMAL_LENGTH' },
  gap:           { accent: T.amber,  label: '// PERSISTENT_GAP' },
  failing:       { accent: T.coral,  label: '// RECENT_FAILURE' },
  aha:           { accent: T.gold,   label: '// AHA_PATTERN' },
  trend:         { accent: T.green,  label: '// LEARNING_TREND' },
}

function injectCSS() {
  if (document.getElementById('elim-lp-css')) return
  const s = document.createElement('style')
  s.id = 'elim-lp-css'
  s.textContent = `
    @keyframes lpFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes lpBlink  { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes lpScan   { 0%{left:-40%;width:40%} 100%{left:100%;width:40%} }
    .lp-claim { animation: lpFadeIn 0.35s ease-out; }
  `
  document.head.appendChild(s)
}

export default function LearningProfile() {
  injectCSS()
  const [data,    setData]    = useState(null)
  const [block,   setBlock]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [showRaw, setShowRaw] = useState(false)

  const load = () => {
    setLoading(true); setError(null)
    api.get('/profile/learning', { params: { include_prompt_block: true } })
      .then(r => {
        setData(r.data)
        setBlock(r.data.prompt_block || '')
        setLoading(false)
      })
      .catch(e => {
        setError(e.response?.data?.detail || 'Failed to load profile')
        setLoading(false)
      })
  }
  useEffect(load, [])

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, padding: '1.5rem 1.75rem' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 10, letterSpacing: '0.2em', color: T.cyan, marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: T.cyan, boxShadow: `0 0 8px ${T.cyan}`,
              display: 'inline-block', animation: 'lpBlink 2s ease-in-out infinite',
            }} />
            // PERSONAL_PEDAGOGY_PROFILE
          </div>
          <h1 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 28, fontWeight: 900, margin: '0 0 8px',
            letterSpacing: '0.04em', color: T.text,
          }}>WHAT ELIM HAS LEARNED ABOUT YOU</h1>
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 15, color: T.sub,
            lineHeight: 1.65, maxWidth: 660,
          }}>
            Every signal below — your ratings, Feynman tests, aha moments — reshapes the
            prompt for your next explanation. The same Claude call produces a different
            shape because of this profile. No claim here exists without evidence.
          </p>
        </div>

        {/* Summary strip */}
        {data && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8, marginBottom: '1.25rem',
          }}>
            <Stat label="ACTIVE SIGNALS"   value={data.claims?.length || 0}     color={T.cyan} />
            <Stat label="RATED SAMPLES"    value={data.history_samples || 0}    color={T.purple} />
            <Stat label="DIFFICULTY"       value={`${data.difficulty || '—'}/5`} color={T.amber} />
            <Stat label="TOP STYLE"        value={(data.style_ranked?.[0]?.style || '—').toUpperCase()} color={T.green} small />
          </div>
        )}

        {loading && <Loader />}
        {error   && <ErrorBox message={error} />}

        {/* Claims */}
        {data && !loading && (
          <>
            {(!data.claims || data.claims.length === 0) ? (
              <EmptyProfile summary={data.summary} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.claims.map((c, i) => <Claim key={i} claim={c} index={i} />)}
              </div>
            )}

            <SummaryFooter
              summary={data.summary}
              styleRanked={data.style_ranked}
              computedAt={data.computed_at}
              onRefresh={load}
              onToggleRaw={() => setShowRaw(s => !s)}
              showRaw={showRaw}
              block={block}
            />

            {showRaw && (
              <pre style={{
                marginTop: 14, padding: '1rem 1.1rem',
                background: 'rgba(7,13,26,0.85)',
                border: `1px solid ${T.cyan}33`,
                borderLeft: `3px solid ${T.cyan}`, borderRadius: 4,
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 12, color: T.text, whiteSpace: 'pre-wrap',
                lineHeight: 1.55, overflowX: 'auto',
              }}>{block || '(no profile block — profile is still warming up)'}</pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color, small }) {
  return (
    <div style={{
      background: 'rgba(7,13,26,0.85)',
      border: '1px solid rgba(0,229,255,0.12)',
      borderRadius: 4, padding: '0.75rem 1rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 1, background: color, opacity: 0.45,
      }} />
      <div style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.16em',
        color: T.dim, textTransform: 'uppercase', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Orbitron',monospace",
        fontSize: small ? 14 : 22, fontWeight: 700, color,
        textShadow: `0 0 12px ${color}55`,
        letterSpacing: small ? '0.08em' : '0.02em',
      }}>{value}</div>
    </div>
  )
}

function Claim({ claim, index }) {
  const meta = KIND_META[claim.kind] || { accent: T.cyan, label: '// SIGNAL' }
  return (
    <div className="lp-claim" style={{
      background: 'rgba(7,13,26,0.75)',
      border: `1px solid ${meta.accent}22`,
      borderLeft: `3px solid ${meta.accent}`,
      borderRadius: '0 4px 4px 0',
      padding: '0.85rem 1.1rem',
      animationDelay: `${index * 0.04}s`,
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{
        flex: '0 0 auto',
        fontFamily: "'Orbitron',monospace", fontSize: 14, fontWeight: 700,
        color: meta.accent, minWidth: 22, marginTop: 4,
      }}>{String(index + 1).padStart(2, '0')}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.16em',
          color: meta.accent, marginBottom: 5,
        }}>{meta.label}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: 16, fontWeight: 500, color: T.text,
          lineHeight: 1.45, marginBottom: 5,
        }}>{claim.title}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: 14, color: T.sub, lineHeight: 1.55,
        }}>{claim.detail}</div>
      </div>
      <div style={{
        flex: '0 0 auto', textAlign: 'right',
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.1em',
        color: T.dim, padding: '4px 8px',
        background: 'rgba(0,229,255,0.04)',
        border: '1px solid rgba(0,229,255,0.1)',
        borderRadius: 2, minWidth: 70,
      }}>
        EVIDENCE<br />
        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, color: meta.accent }}>
          {claim.evidence}
        </span>
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ padding: '2rem 0', textAlign: 'center' }}>
      <div style={{
        width: 240, height: 2, margin: '0 auto',
        background: 'rgba(0,229,255,0.08)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', height: '100%',
          background: `linear-gradient(90deg,transparent,${T.cyan},transparent)`,
          animation: 'lpScan 1.4s ease-in-out infinite',
        }} />
      </div>
      <div style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 10, letterSpacing: '0.16em',
        color: T.sub, marginTop: 14,
      }}>COMPUTING YOUR PEDAGOGY PROFILE...</div>
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div style={{
      padding: '0.85rem 1rem', borderRadius: 2,
      background: 'rgba(216,90,48,0.08)',
      border: `1px solid ${T.coral}44`, borderLeft: `3px solid ${T.coral}`,
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 11, color: T.coral, letterSpacing: '0.08em',
    }}>ERROR — {message}</div>
  )
}

function EmptyProfile({ summary }) {
  return (
    <div style={{
      padding: '2rem 1.5rem', textAlign: 'center',
      background: 'rgba(7,13,26,0.65)',
      border: '1px dashed rgba(0,229,255,0.18)', borderRadius: 4,
    }}>
      <div style={{
        fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 700,
        color: T.dim, letterSpacing: '0.08em', marginBottom: 10,
      }}>PROFILE WARMING UP</div>
      <p style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 14,
        color: T.sub, lineHeight: 1.6, maxWidth: 460, margin: '0 auto',
      }}>
        {summary || 'Rate a few explanations and run a Feynman test to seed your profile.'}
      </p>
    </div>
  )
}

function SummaryFooter({ summary, styleRanked, computedAt, onRefresh, onToggleRaw, showRaw, block }) {
  return (
    <div style={{
      marginTop: 18, paddingTop: 14,
      borderTop: '1px solid rgba(0,229,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 10, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 10, letterSpacing: '0.12em', color: T.sub, marginBottom: 6,
        }}>{summary}</div>
        {styleRanked?.length > 0 && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          }}>
            {styleRanked.map(s => (
              <span key={s.style} style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, padding: '2px 8px',
                background: 'rgba(0,229,255,0.05)',
                border: '1px solid rgba(0,229,255,0.18)',
                borderRadius: 2, color: T.sub, letterSpacing: '0.1em',
              }}>
                {s.style.toUpperCase()} · {Math.round(s.weight * 100)}%
              </span>
            ))}
          </div>
        )}
        {computedAt && (
          <div style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: T.dim, marginTop: 8, letterSpacing: '0.08em',
          }}>COMPUTED {new Date(computedAt).toLocaleString().toUpperCase()}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRefresh} style={btnStyle()}>↺ REFRESH</button>
        <button
          onClick={onToggleRaw}
          disabled={!block}
          style={btnStyle(showRaw ? T.purple : T.cyan, !block)}
        >
          {showRaw ? '× HIDE PROMPT' : '🔍 VIEW INJECTED PROMPT'}
        </button>
      </div>
    </div>
  )
}

function btnStyle(color = T.cyan, disabled = false) {
  return {
    background: 'transparent',
    border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `${color}55`}`,
    borderRadius: 2, padding: '5px 12px',
    color: disabled ? T.dim : color,
    fontFamily: "'Share Tech Mono',monospace",
    fontSize: 10, letterSpacing: '0.12em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textTransform: 'uppercase', transition: 'all 0.15s',
  }
}
