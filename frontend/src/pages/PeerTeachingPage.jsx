/**
 * PeerTeachingPage.jsx
 * ELIM — Peer Teaching Network
 *
 * Aesthetic: galaxy + dark academia + cyberpunk hybrid.
 *  - Twinkling star-field canvas behind every screen
 *  - Cinzel serif for screen titles + Latin mottos (dark academia)
 *  - Share Tech Mono / Orbitron labels, scan-bars (cyberpunk)
 *  - Antique-gold accents, parchment textures for Whisper Lantern + Codex
 *
 * Screens: Discovery → Matching → Chat → Reverse Feynman → Codex (results)
 *
 * Unique features inside Chat:
 *  - Concept Forge   — concepts ignite as stars during teaching
 *  - Clarity Orbit   — ring around teacher avatar pulses on AI clarity signal
 *  - Protégé Bond    — gradient meter strengthens turn-by-turn
 *  - Whisper Lantern — parchment overlay shown only to teacher
 */

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import api from '../lib/api'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS  = API.replace(/^http/, 'ws')

const tokenOf = () => {
  try {
    return JSON.parse(localStorage.getItem('elim-auth') || '{}')?.state?.accessToken || ''
  } catch { return '' }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:       '#010208',
  deep:     '#00010A',
  card:     'rgba(7,13,26,0.78)',
  card2:    'rgba(10,16,32,0.92)',
  cyan:     '#00E5FF',
  purple:   '#7C6EF0',
  green:    '#00FF9D',
  amber:    '#F5A623',
  gold:     '#C9A86B',      // antique gold (dark academia)
  parch:    '#E8DAB6',      // parchment
  oxblood:  '#7A2828',
  coral:    '#D85A30',
  text:     '#E8F4FF',
  sub:      '#5A8FAA',
  dim:      '#2A4560',
}

// ── One-time CSS inject ──────────────────────────────────────────────────────
function injectPeerCSS() {
  if (document.getElementById('elim-peer-css')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=EB+Garamond:ital@0;1&display=swap'
  document.head.appendChild(link)

  const s = document.createElement('style')
  s.id = 'elim-peer-css'
  s.textContent = `
    @keyframes peerFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes peerBlink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
    @keyframes peerScan   { 0%{left:-40%;width:40%} 100%{left:100%;width:40%} }
    @keyframes peerIgnite { 0%{opacity:0;transform:scale(0.2)} 60%{opacity:1;transform:scale(1.4)} 100%{opacity:1;transform:scale(1)} }
    @keyframes peerOrbit  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes peerPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,255,0.45)} 50%{box-shadow:0 0 0 12px rgba(0,229,255,0)} }
    @keyframes peerLantern { 0%{opacity:0;transform:translateY(20px) rotate(-2deg)} 100%{opacity:1;transform:translateY(0) rotate(-1deg)} }
    .peer-msg { animation: peerFadeIn 0.32s ease-out; }
    .peer-cinzel { font-family: 'Cinzel', 'Times New Roman', serif; }
    .peer-gar    { font-family: 'EB Garamond', Georgia, serif; }
    .peer-mono   { font-family: 'Share Tech Mono', monospace; }
    .peer-orbit  { font-family: 'Orbitron', monospace; }
    .peer-parchment {
      background:
        radial-gradient(ellipse at 30% 20%, rgba(180,140,80,0.18) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 70%, rgba(120,80,40,0.12) 0%, transparent 60%),
        linear-gradient(135deg, rgba(232,218,182,0.06) 0%, rgba(180,150,90,0.04) 100%);
    }
  `
  document.head.appendChild(s)
}

// ── Star-field canvas (low-cost twinkle) ──────────────────────────────────────
function StarField({ density = 'low' }) {
  const ref = useRef(null)
  const frameRef = useRef()
  const tickRef  = useRef(0)
  const sizeRef  = useRef({ w: 1, h: 1 })

  useEffect(() => {
    const cnv = ref.current
    if (!cnv) return
    const ctx = cnv.getContext('2d')

    const onResize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight }
      cnv.width  = sizeRef.current.w
      cnv.height = sizeRef.current.h
    }
    onResize()
    window.addEventListener('resize', onResize)

    const counts = density === 'high' ? [220, 90, 30] : [120, 50, 16]

    const draw = () => {
      const { w: W, h: H } = sizeRef.current
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#00010A'
      ctx.fillRect(0, 0, W, H)

      // nebula bands
      const nebulae = [
        { x: W*0.15, y: H*0.25, r: W*0.30, c: 'rgba(60,20,120,0.10)' },
        { x: W*0.85, y: H*0.65, r: W*0.34, c: 'rgba(0,40,100,0.10)' },
        { x: W*0.50, y: H*0.10, r: W*0.22, c: 'rgba(120,30,60,0.06)' },
      ]
      nebulae.forEach(({ x, y, r, c }) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, c); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      })

      const t = tickRef.current
      const layers = [
        { count: counts[0], r: 0.5, alpha: 0.35 },
        { count: counts[1], r: 0.9, alpha: 0.55 },
        { count: counts[2], r: 1.4, alpha: 0.80 },
      ]
      layers.forEach(({ count, r, alpha }) => {
        for (let i = 0; i < count; i++) {
          const sx = ((i*137.5 + 53.3)*(r*100 + 7)) % W
          const sy = ((i*97.3  + 19.7)*(r*100 + 13)) % H
          const tw = alpha*(0.55 + 0.45*Math.sin(t*0.012 + i*2.39))
          ctx.beginPath()
          ctx.arc(sx, sy, r*(0.4 + (i%5)*0.12), 0, Math.PI*2)
          ctx.fillStyle = `rgba(220,230,255,${tw})`
          ctx.fill()
        }
      })

      tickRef.current += 1
      frameRef.current = requestAnimationFrame(draw)
    }
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [density])

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}

// ── Generic atoms ─────────────────────────────────────────────────────────────
function Label({ children, color = T.sub, size = 9, mb = 6 }) {
  return (
    <div className="peer-mono" style={{
      fontSize: size, letterSpacing: '0.18em',
      color, textTransform: 'uppercase', marginBottom: mb,
    }}>{children}</div>
  )
}

function Motto({ children, color = T.gold }) {
  return (
    <div className="peer-gar" style={{
      fontSize: 12, fontStyle: 'italic', color, letterSpacing: '0.05em', opacity: 0.75,
    }}>— {children} —</div>
  )
}

function ScanBar({ color = T.cyan, height = 2 }) {
  return (
    <div style={{ width: '100%', height, background: 'rgba(0,229,255,0.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', height: '100%',
        background: `linear-gradient(90deg,transparent,${color},transparent)`,
        animation: 'peerScan 1.4s ease-in-out infinite',
      }} />
    </div>
  )
}

function CBtn({ children, onClick, color = T.cyan, disabled, full, size = 12, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="peer-orbit"
      style={{
        width: full ? '100%' : 'auto',
        background: 'transparent',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `${color}66`}`,
        borderRadius: 2, padding: '0.65rem 1.25rem',
        color: disabled ? T.dim : color,
        fontSize: size, fontWeight: 700, letterSpacing: '0.14em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textTransform: 'uppercase', transition: 'all 0.18s',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.boxShadow = `0 0 20px ${color}22`; e.currentTarget.style.borderColor = color } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${color}66` }}
    >{children}</button>
  )
}

function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: T.card, border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 4, position: 'relative', backdropFilter: 'blur(20px)', ...style,
    }}>
      {['nw','ne','sw','se'].map(p => (
        <span key={p} style={{
          position: 'absolute', width: 12, height: 12,
          [p[0] === 'n' ? 'top' : 'bottom']: -1,
          [p[1] === 'w' ? 'left' : 'right']: -1,
          [`border${p[0] === 'n' ? 'Top' : 'Bottom'}`]: `2px solid ${T.cyan}99`,
          [`border${p[1] === 'w' ? 'Left' : 'Right'}`]: `2px solid ${T.cyan}99`,
        }} />
      ))}
      {children}
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — DISCOVERY
// ═════════════════════════════════════════════════════════════════════════════
function DiscoveryScreen({ onRequest, onResume }) {
  const [eligible, setEligible] = useState({ can_teach: [], can_learn: [] })
  const [waiting,  setWaiting]  = useState({})
  const [history,  setHistory]  = useState([])
  const [tab,      setTab]      = useState('teach')
  const [loading,  setLoading]  = useState(true)
  const [errors,   setErrors]   = useState([])

  useEffect(() => {
    const calls = [
      ['eligible-topics', () => api.get('/peer/eligible-topics')],
      ['waiting-count',   () => api.get('/peer/waiting-count')],
      ['sessions',        () => api.get('/peer/sessions')],
    ]
    Promise.allSettled(calls.map(([, fn]) => fn()))
      .then(results => {
        const errs = []
        results.forEach((r, i) => {
          const [name] = calls[i]
          if (r.status === 'fulfilled') {
            const d = r.value.data
            if (name === 'eligible-topics') setEligible(d)
            if (name === 'waiting-count')   setWaiting(d)
            if (name === 'sessions')        setHistory(d)
          } else {
            const status = r.reason?.response?.status || 'NETWORK'
            const detail = r.reason?.response?.data?.detail || r.reason?.message || 'unknown'
            errs.push(`${name}: ${status} — ${detail}`)
            // eslint-disable-next-line no-console
            console.error(`[peer] ${name} failed`, r.reason)
          }
        })
        setErrors(errs)
        setLoading(false)
      })
  }, [])

  const tabs = [
    { id: 'teach',   label: `TEACH · ${eligible.can_teach.length}` },
    { id: 'learn',   label: `LEARN · ${eligible.can_learn.length}` },
    { id: 'history', label: 'CODEX' },
  ]

  return (
    <div style={{ padding: '1.5rem 1.75rem', animation: 'peerFadeIn 0.4s ease-out', maxWidth: 1100, margin: '0 auto' }}>
      <Label color={T.cyan} size={10}>// PEER_TEACHING_NETWORK</Label>
      <h1 className="peer-cinzel" style={{
        fontSize: 30, fontWeight: 900, color: T.text,
        letterSpacing: '0.04em', margin: '0 0 0.25rem',
      }}>TEACH · LEARN · GROW</h1>
      <Motto>docendo discimus &nbsp;·&nbsp; we learn by teaching</Motto>

      <p className="peer-gar" style={{
        fontSize: 15, color: T.sub, lineHeight: 1.7, maxWidth: 620, marginTop: '1rem',
      }}>
        Where you have mastered a subject, become its tutor. Where you struggle, find one
        already through. ELIM matches, sits silently in the margin, and grades nothing of
        either of you save what you actually exchange.
      </p>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginTop: '1.5rem', marginBottom: '1rem',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
      }}>
        {tabs.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className="peer-mono"
            style={{
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? T.cyan : 'transparent'}`,
              padding: '0.6rem 1rem', marginBottom: -1, cursor: 'pointer',
              fontSize: 10, letterSpacing: '0.16em',
              color: tab === t.id ? T.cyan : T.sub, textTransform: 'uppercase',
            }}>{t.label}</button>
        ))}
      </div>

      {errors.length > 0 && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem',
          background: 'rgba(216,90,48,0.08)',
          border: '1px solid rgba(216,90,48,0.4)',
          borderLeft: `3px solid ${T.coral}`, borderRadius: 2,
        }}>
          <Label color={T.coral} size={9}>// API_ERRORS — check backend logs</Label>
          {errors.map((e, i) => (
            <div key={i} className="peer-mono" style={{ fontSize: 11, color: T.coral, letterSpacing: '0.04em', marginTop: 2 }}>
              {e}
            </div>
          ))}
        </div>
      )}

      {loading ? <ScanBar /> : tab === 'teach' ? (
        eligible.can_teach.length === 0 ? (
          <EmptyState
            label="NO TEACHABLE TOPICS — FEYNMAN SCORE ≥ 85 REQUIRED"
            sub="Master a topic via the Feynman test to unlock teaching mode."
          />
        ) : (
          <CardList list={eligible.can_teach} role="teacher" waiting={waiting} onRequest={onRequest} />
        )
      ) : tab === 'learn' ? (
        eligible.can_learn.length === 0 ? (
          <EmptyState
            label="NO TOPICS IN LEARNING RANGE — SCORE ≤ 40 REQUIRED"
            sub="Failing topics will appear here so you can request a tutor."
          />
        ) : (
          <CardList list={eligible.can_learn} role="learner" waiting={waiting} onRequest={onRequest} />
        )
      ) : (
        <Codex history={history} onResume={onResume} />
      )}
    </div>
  )
}

function EmptyState({ label, sub }) {
  return (
    <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
      <div className="peer-mono" style={{ fontSize: 11, color: T.dim, letterSpacing: '0.14em' }}>{label}</div>
      <div className="peer-gar" style={{ fontSize: 14, color: T.sub, marginTop: 10, fontStyle: 'italic' }}>{sub}</div>
    </div>
  )
}

function CardList({ list, role, waiting, onRequest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map(item => (
        <TopicCard
          key={item.topic}
          item={item} role={role}
          waiting={waiting[item.topic.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0,50)]
            ?.[role === 'teacher' ? 'learner' : 'teacher'] || 0}
          onRequest={onRequest}
        />
      ))}
    </div>
  )
}

function TopicCard({ item, role, waiting, onRequest }) {
  const isTeach = role === 'teacher'
  const color = isTeach ? T.green : T.purple
  const scoreColor = item.score >= 85 ? T.green : item.score >= 60 ? T.cyan : item.score >= 40 ? T.amber : T.coral
  return (
    <div style={{
      background: 'rgba(7,13,26,0.7)', border: `1px solid ${color}22`,
      borderLeft: `3px solid ${color}`, borderRadius: '0 4px 4px 0',
      padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
      animation: 'peerFadeIn 0.3s ease-out',
    }}>
      <div style={{ flex: 1 }}>
        <div className="peer-cinzel" style={{
          fontSize: 17, fontWeight: 700, color: T.text,
          textTransform: 'capitalize', marginBottom: 4, letterSpacing: '0.02em',
        }}>{item.topic}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="peer-mono" style={{ fontSize: 9, color: scoreColor }}>FEYNMAN · {item.score}</span>
          {item.teaching_sessions > 0 && (
            <span className="peer-mono" style={{ fontSize: 9, color: T.gold }}>
              ★ {item.teaching_sessions} TAUGHT
            </span>
          )}
          {waiting > 0 && (
            <span className="peer-mono" style={{
              fontSize: 9, padding: '2px 8px',
              background: `${color}15`, border: `1px solid ${color}44`,
              borderRadius: 2, color, animation: 'peerPulse 2s ease-in-out infinite',
            }}>{waiting} WAITING</span>
          )}
        </div>
      </div>
      <CBtn color={color} onClick={() => onRequest(item.topic, role)} size={11}>
        {isTeach ? 'TEACH →' : 'LEARN →'}
      </CBtn>
    </div>
  )
}

function Codex({ history, onResume }) {
  if (!history.length) return (
    <EmptyState label="THE CODEX IS BLANK" sub="No prior sessions recorded yet." />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map(s => {
        const col = s.role === 'teacher' ? T.green : T.purple
        const g = s.teacher_grade
        const resumable = s.status === 'waiting' || s.status === 'active'
        return (
          <div key={s.session_id} style={{
            background: 'rgba(7,13,26,0.7)',
            border: '1px solid rgba(0,229,255,0.08)',
            borderLeft: `3px solid ${col}`, borderRadius: '0 4px 4px 0',
            padding: '0.85rem 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            cursor: resumable ? 'pointer' : 'default',
          }}
            onClick={() => resumable && onResume(s.session_id, s.role)}
          >
            <div>
              <div className="peer-cinzel" style={{
                fontSize: 15, color: T.text, textTransform: 'capitalize', marginBottom: 3,
              }}>{s.topic}</div>
              <div className="peer-mono" style={{ fontSize: 9, color: T.sub, letterSpacing: '0.1em' }}>
                {s.role.toUpperCase()} · {new Date(s.created_at).toLocaleDateString()} · {s.status?.toUpperCase()}
                {s.duration_min ? ` · ${s.duration_min}m` : ''}
                {(s.concepts_forged?.length) ? ` · ${s.concepts_forged.length} CONCEPTS` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {g && (
                <div className="peer-orbit" style={{ fontSize: 22, fontWeight: 900, color: col }}>
                  {g.overall_score}
                </div>
              )}
              {(s.rewards || []).map((r, i) => (
                <div key={i} className="peer-mono" style={{
                  fontSize: 8, padding: '2px 6px', marginTop: 3,
                  background: `${T.gold}15`, border: `1px solid ${T.gold}55`,
                  borderRadius: 2, color: T.gold,
                }}>
                  {r.type === 'teaching_badge' ? '★ TEACHING SEAL' :
                   r.type === 'protege_effect' ? `↑ ${r.boost} PROTÉGÉ` : r.type.toUpperCase()}
                </div>
              ))}
              {resumable && (
                <div className="peer-mono" style={{ fontSize: 8, color: T.cyan, marginTop: 4 }}>
                  RESUME →
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — MATCHING
// ═════════════════════════════════════════════════════════════════════════════
function MatchingScreen({ topic, role, onMatched, onCancel }) {
  const [status,  setStatus]  = useState('requesting')
  const [message, setMessage] = useState('')
  const pollRef = useRef(null)
  const color = role === 'teacher' ? T.green : T.purple

  useEffect(() => {
    request()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const request = async () => {
    setStatus('requesting')
    try {
      const res = await api.post('/peer/match', { topic, role, max_wait_min: 60 })
      const d = res.data
      if (d.status === 'matched' || d.status === 'already_in_session') {
        setStatus('matched')
        setTimeout(() => onMatched(d.session_id, role), 900)
      } else if (d.status === 'waiting') {
        setStatus('waiting')
        setMessage(`Awaiting a ${role === 'teacher' ? 'learner' : 'tutor'}...`)
        pollRef.current = setInterval(checkActive, 15000)
      }
    } catch (e) {
      setStatus('error')
      setMessage(e.response?.data?.detail || 'Failed to request match')
    }
  }

  const checkActive = async () => {
    try {
      const res = await api.get('/peer/sessions')
      const active = res.data.find(s => s.status === 'waiting' || s.status === 'active')
      if (active) {
        clearInterval(pollRef.current)
        setStatus('matched')
        setTimeout(() => onMatched(active.session_id, role), 900)
      }
    } catch { /* silent */ }
  }

  const cancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    try { await api.delete('/peer/match', { params: { topic, role } }) } catch {/**/}
    onCancel()
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 1.5rem' }}>
      <Panel style={{ width: '100%', maxWidth: 520, padding: '2.25rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Label color={color} size={10}>// {role.toUpperCase()}_MODE</Label>
          <h2 className="peer-cinzel" style={{
            fontSize: 22, fontWeight: 700, color: T.text, margin: '0 0 6px',
            textTransform: 'capitalize', letterSpacing: '0.02em',
          }}>{topic}</h2>
          <Motto>festina lente · make haste, slowly</Motto>
        </div>

        {status === 'requesting' && <><ScanBar color={color} /><p className="peer-mono" style={{ fontSize: 10, color: T.sub, textAlign: 'center', marginTop: '1.25rem', letterSpacing: '0.14em' }}>REQUESTING MATCH...</p></>}

        {status === 'waiting' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: '1.5rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, boxShadow: `0 0 10px ${color}`,
                  animation: `peerBlink 1.4s ${i*0.3}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <p className="peer-mono" style={{ fontSize: 11, color: T.sub, textAlign: 'center', letterSpacing: '0.12em', marginBottom: '1.25rem' }}>{message}</p>
            <p className="peer-gar" style={{ fontSize: 14, color: T.dim, textAlign: 'center', fontStyle: 'italic', marginBottom: '1.5rem' }}>
              Leave this page if you wish — your request remains active for 60 minutes,
              and you will be notified when a counterpart arrives.
            </p>
            <CBtn onClick={cancel} color={T.coral} full>WITHDRAW REQUEST</CBtn>
          </>
        )}

        {status === 'matched' && (
          <div style={{ textAlign: 'center' }}>
            <div className="peer-cinzel" style={{ fontSize: 28, color, marginBottom: 10, animation: 'peerIgnite 0.7s cubic-bezier(0.34,1.56,0.64,1)' }}>⚡</div>
            <Label color={color} size={11}>COUNTERPART FOUND</Label>
            <ScanBar color={color} />
          </div>
        )}

        {status === 'error' && (
          <>
            <p className="peer-gar" style={{ fontSize: 14, color: T.coral, textAlign: 'center', marginBottom: '1.5rem', fontStyle: 'italic' }}>{message}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <CBtn onClick={request} color={T.cyan} full>RETRY</CBtn>
              <CBtn onClick={onCancel} color={T.coral} full>CANCEL</CBtn>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — CHAT (with Concept Forge, Clarity Orbit, Protégé Bond, Whisper Lantern)
// ═════════════════════════════════════════════════════════════════════════════
function ChatScreen({ sessionId, role: initialRole, onEnd }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [wsState,  setWsState]  = useState('connecting')
  const [myRole,   setMyRole]   = useState(initialRole || null)
  const [myAlias,  setMyAlias]  = useState(null)
  const [teacherAlias, setTeacherAlias] = useState('')
  const [learnerAlias, setLearnerAlias] = useState('')
  const [topic,    setTopic]    = useState('')
  const [turn,     setTurn]     = useState(0)
  const [concepts, setConcepts] = useState([])
  const [clarity,  setClarity]  = useState(80)
  const [bond,     setBond]     = useState(0)
  const [lantern,  setLantern]  = useState(null)
  const [hoveredConcept, setHoveredConcept] = useState(null)

  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const color = myRole === 'teacher' ? T.green : T.purple

  useEffect(() => {
    const t = tokenOf()
    const ws = new WebSocket(`${WS}/ws/peer/${sessionId}?token=${t}`)
    wsRef.current = ws

    ws.onopen  = () => setWsState('connected')
    ws.onclose = () => setWsState('closed')
    ws.onerror = () => setWsState('error')

    ws.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'role_reveal':
          setMyRole(msg.role); setMyAlias(msg.alias); setTopic(msg.topic)
          setTeacherAlias(msg.teacher_alias || '')
          setLearnerAlias(msg.learner_alias || '')
          break
        case 'message':
        case 'system':
          setMessages(prev => [...prev, msg])
          if (typeof msg.turn === 'number') setTurn(msg.turn)
          break
        case 'concept_forged':
          setConcepts(prev => prev.find(c => c.concept === msg.concept) ? prev : [...prev, msg])
          break
        case 'clarity_pulse':
          setClarity(msg.score)
          break
        case 'bond_update':
          setBond(msg.score)
          break
        case 'facilitator_whisper':
          break  // also followed by lantern_hint with motto
        case 'lantern_hint':
          setLantern({ motto: msg.motto, content: msg.content, ts: msg.ts })
          setTimeout(() => setLantern(null), 9000)
          break
        case 'error':
          // surface silently
          break
        default: break
      }
    }
    return () => ws.close()
  }, [sessionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, concepts])

  const send = useCallback(() => {
    const content = input.trim()
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', content }))
    setInput('')
    inputRef.current?.focus()
  }, [input])

  const onKey = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }, [send])

  const endSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }))
      wsRef.current.close()
    }
    onEnd()
  }, [onEnd])

  const turnsLeft = Math.max(0, 40 - turn)
  // orbital ring speed: clarity 100 = 4s rev, clarity 0 = 16s rev
  const orbitDur = (4 + (1 - clarity/100) * 12).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', position: 'relative' }}>
      <SessionHeader
        topic={topic} myAlias={myAlias} myRole={myRole}
        teacherAlias={teacherAlias} learnerAlias={learnerAlias}
        wsState={wsState} turnsLeft={turnsLeft}
        clarity={clarity} bond={bond} orbitDur={orbitDur}
        onEnd={endSession}
      />

      {concepts.length > 0 && (
        <ConceptForgeBar
          concepts={concepts} onHover={setHoveredConcept} hovered={hoveredConcept}
        />
      )}

      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'transparent',
      }}>
        {wsState === 'connecting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: 12 }}>
            <ScanBar />
            <span className="peer-mono" style={{ fontSize: 10, color: T.sub, letterSpacing: '0.14em' }}>
              ESTABLISHING NEURAL LINK...
            </span>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} msg={m} myRole={myRole} />
        ))}
        <div ref={bottomRef} />
      </div>

      {lantern && myRole === 'teacher' && <WhisperLantern data={lantern} />}

      <div style={{
        padding: '0.9rem 1.5rem',
        borderTop: '1px solid rgba(0,229,255,0.08)',
        background: 'rgba(1,2,8,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={myRole === 'teacher'
            ? "Explain. Begin with the most fundamental idea... (Enter to send)"
            : "Ask. \"I don't understand\" is sacred here... (Enter to send)"}
          disabled={wsState !== 'connected'}
          rows={2}
          className="peer-gar"
          style={{
            flex: 1,
            background: 'rgba(0,229,255,0.03)',
            border: '1px solid rgba(0,229,255,0.15)',
            borderRadius: 2, padding: '0.75rem 0.95rem',
            color: T.text, fontSize: 15, resize: 'none', outline: 'none',
            lineHeight: 1.55,
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(0,229,255,0.45)' }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(0,229,255,0.15)' }}
        />
        <CBtn onClick={send} color={color} disabled={!input.trim() || wsState !== 'connected'} size={11}>SEND</CBtn>
      </div>
    </div>
  )
}

function SessionHeader({
  topic, myAlias, myRole, teacherAlias, learnerAlias,
  wsState, turnsLeft, clarity, bond, orbitDur, onEnd,
}) {
  const color = myRole === 'teacher' ? T.green : T.purple
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.7rem 1.5rem', gap: 12, flexWrap: 'wrap',
      borderBottom: '1px solid rgba(0,229,255,0.1)',
      background: 'rgba(1,2,8,0.85)', backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <ClarityOrbit alias={teacherAlias} clarity={clarity} dur={orbitDur} highlight={myRole === 'teacher'} />
        <BondMeter bond={bond} teacherAlias={teacherAlias} learnerAlias={learnerAlias} />
        <span className="peer-mono" style={{
          width: 7, height: 7, borderRadius: '50%',
          background: wsState === 'connected' ? color : T.coral,
          boxShadow: `0 0 8px ${wsState === 'connected' ? color : T.coral}`,
          display: 'inline-block', animation: wsState === 'connected' ? 'peerBlink 2s ease-in-out infinite' : 'none',
        }} />
        <span className="peer-cinzel" style={{ fontSize: 14, color: T.text, textTransform: 'capitalize' }}>{topic || '...'}</span>
        {myRole && myAlias && (
          <span className="peer-mono" style={{
            fontSize: 9, padding: '2px 8px',
            background: `${color}15`, border: `1px solid ${color}44`,
            borderRadius: 2, color, letterSpacing: '0.1em',
          }}>YOU · {myAlias} · {myRole.toUpperCase()}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="peer-mono" style={{ fontSize: 9, color: turnsLeft < 10 ? T.coral : T.dim, letterSpacing: '0.1em' }}>
          {turnsLeft} TURNS LEFT
        </span>
        <button onClick={onEnd} className="peer-mono" style={{
          background: 'transparent', border: '1px solid rgba(216,90,48,0.3)',
          borderRadius: 2, padding: '3px 10px',
          fontSize: 9, letterSpacing: '0.12em', color: T.coral, cursor: 'pointer',
        }}>END SESSION</button>
      </div>
    </div>
  )
}

function ClarityOrbit({ alias, clarity, dur, highlight }) {
  const r = 24
  return (
    <div style={{
      position: 'relative', width: r*2, height: r*2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} title={`Teacher clarity ${clarity}/100`}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `1px dashed ${T.gold}77`,
        animation: `peerOrbit ${dur}s linear infinite`,
      }}>
        <span style={{
          position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%',
          background: clarity > 70 ? T.green : clarity > 40 ? T.amber : T.coral,
          boxShadow: `0 0 8px ${clarity > 70 ? T.green : clarity > 40 ? T.amber : T.coral}`,
        }} />
      </div>
      <div className="peer-orbit" style={{
        fontSize: 10, fontWeight: 700,
        color: highlight ? T.gold : T.sub, textAlign: 'center',
      }}>
        {(alias || 'TEACH').slice(0,4).toUpperCase()}
      </div>
    </div>
  )
}

function BondMeter({ bond, teacherAlias, learnerAlias }) {
  return (
    <div title={`Protégé bond: ${bond}/100`} style={{
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span className="peer-mono" style={{ fontSize: 9, color: T.gold, letterSpacing: '0.1em' }}>
        BOND
      </span>
      <div style={{
        width: 80, height: 4, borderRadius: 2,
        background: 'rgba(201,168,107,0.12)', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${bond}%`, height: '100%',
          background: `linear-gradient(90deg, ${T.green}, ${T.gold}, ${T.purple})`,
          boxShadow: `0 0 8px ${T.gold}77`, transition: 'width 0.4s ease-out',
        }} />
      </div>
      <span className="peer-mono" style={{ fontSize: 9, color: T.sub }}>{bond}</span>
    </div>
  )
}

function ConceptForgeBar({ concepts, onHover, hovered }) {
  return (
    <div style={{
      padding: '0.6rem 1.5rem',
      borderBottom: '1px solid rgba(201,168,107,0.18)',
      background: 'rgba(7,13,26,0.55)',
      position: 'relative',
    }}>
      <Label color={T.gold} size={9} mb={6}>// CONCEPT_FORGE — concepts ignited this session</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {concepts.map((c, i) => (
          <div key={c.concept + i}
            onMouseEnter={() => onHover(c)}
            onMouseLeave={() => onHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'help' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: T.gold,
              boxShadow: `0 0 ${4 + c.importance*0.08}px ${T.gold}`,
              animation: 'peerIgnite 0.6s ease-out',
            }} />
            <span className="peer-cinzel" style={{ fontSize: 12, color: T.parch, letterSpacing: '0.02em' }}>
              {c.concept}
            </span>
          </div>
        ))}
      </div>
      {hovered && (
        <div className="peer-gar peer-parchment" style={{
          position: 'absolute', top: '100%', left: '1.5rem',
          marginTop: 6, padding: '0.6rem 0.9rem', maxWidth: 360,
          background: 'rgba(40,28,16,0.95)',
          border: `1px solid ${T.gold}66`, borderRadius: 3, zIndex: 50,
          fontSize: 13, color: T.parch, fontStyle: 'italic', lineHeight: 1.5,
          boxShadow: `0 6px 20px rgba(0,0,0,0.4)`,
        }}>
          <div className="peer-cinzel" style={{ fontSize: 13, color: T.gold, marginBottom: 4, fontStyle: 'normal', letterSpacing: '0.04em' }}>
            {hovered.concept}
          </div>
          {hovered.summary || 'A concept extracted from the teacher’s words.'}
        </div>
      )}
    </div>
  )
}

function ChatMessage({ msg, myRole }) {
  if (msg.role === 'system') {
    return (
      <div className="peer-msg" style={{ textAlign: 'center', margin: '6px 0' }}>
        <span className="peer-gar" style={{ fontSize: 12, color: T.dim, fontStyle: 'italic', letterSpacing: '0.05em' }}>
          ✦ {msg.content} ✦
        </span>
      </div>
    )
  }
  if (msg.role === 'elim') {
    return (
      <div className="peer-msg" style={{
        background: 'rgba(124,110,240,0.07)',
        border: '1px solid rgba(124,110,240,0.25)',
        borderRadius: '0 4px 4px 0',
        borderLeft: `3px solid ${T.purple}`,
        padding: '0.7rem 0.95rem', maxWidth: '85%',
      }}>
        <div className="peer-mono" style={{ fontSize: 9, color: T.purple, letterSpacing: '0.12em', marginBottom: 4 }}>
          ELIM · FACILITATOR
        </div>
        <div className="peer-gar" style={{ fontSize: 15, color: T.sub, lineHeight: 1.6 }}>
          {msg.content}
        </div>
      </div>
    )
  }
  const isMe = msg.role === myRole
  const bc = msg.role === 'teacher' ? T.green : T.purple
  return (
    <div className="peer-msg" style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '78%',
        background: isMe ? `${bc}10` : 'rgba(7,13,26,0.85)',
        border: `1px solid ${bc}${isMe ? '55' : '22'}`,
        borderRadius: isMe ? '4px 4px 0 4px' : '4px 4px 4px 0',
        padding: '0.65rem 0.9rem',
      }}>
        <div className="peer-mono" style={{ fontSize: 8, color: bc, letterSpacing: '0.1em', marginBottom: 4 }}>
          {msg.alias} · {msg.role?.toUpperCase()}
        </div>
        <div className="peer-gar" style={{ fontSize: 15, color: T.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </div>
      </div>
    </div>
  )
}

function WhisperLantern({ data }) {
  return (
    <div className="peer-parchment" style={{
      position: 'absolute', bottom: 100, right: 24, zIndex: 60,
      width: 280, padding: '0.85rem 1rem',
      background: 'linear-gradient(135deg, rgba(40,28,16,0.97) 0%, rgba(60,40,20,0.97) 100%)',
      border: `1px solid ${T.gold}88`,
      borderRadius: 3,
      boxShadow: `0 10px 30px rgba(0,0,0,0.6), 0 0 30px ${T.gold}22`,
      animation: 'peerLantern 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      transform: 'rotate(-1deg)',
    }}>
      <div className="peer-mono" style={{ fontSize: 8, color: T.gold, letterSpacing: '0.2em', marginBottom: 5 }}>
        // WHISPER_LANTERN · ONLY YOU SEE THIS
      </div>
      <div className="peer-cinzel" style={{
        fontSize: 11, color: T.parch, fontStyle: 'italic', marginBottom: 6,
        letterSpacing: '0.05em', opacity: 0.85,
      }}>
        — {data.motto} —
      </div>
      <div className="peer-gar" style={{ fontSize: 13, color: T.parch, lineHeight: 1.55 }}>
        {data.content}
      </div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — REVERSE FEYNMAN (60-second teach-back to ELIM)
// ═════════════════════════════════════════════════════════════════════════════
function ReverseFeynmanScreen({ sessionId, topic, role, onDone, onSkip }) {
  const [text,    setText]    = useState('')
  const [phase,   setPhase]   = useState('explain')   // explain | grading | result
  const [result,  setResult]  = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (phase !== 'explain') return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  const submit = async () => {
    if (text.trim().length < 10) { setError('Write at least one full thought.'); return }
    setPhase('grading')
    try {
      const res = await api.post('/peer/reverse-feynman', { session_id: sessionId, explanation: text.trim() })
      setResult(res.data)
      setPhase('result')
    } catch (e) {
      setError(e.response?.data?.detail || 'Grading failed.')
      setPhase('explain')
    }
  }

  if (role !== 'learner') {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
        <Label color={T.gold} size={11}>// PROTÉGÉ RECORD</Label>
        <h2 className="peer-cinzel" style={{ fontSize: 22, color: T.text, margin: '0.5rem 0' }}>
          The learner is being measured...
        </h2>
        <Motto>docendo discimus</Motto>
        <p className="peer-gar" style={{ fontSize: 14, color: T.sub, marginTop: 16, fontStyle: 'italic' }}>
          When they complete their reverse Feynman, your protégé bonus will reflect the
          real delta — not an estimate.
        </p>
        <div style={{ marginTop: 20 }}>
          <CBtn onClick={onDone} color={T.cyan}>VIEW CODEX →</CBtn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 640, margin: '0 auto', animation: 'peerFadeIn 0.4s ease-out' }}>
      <Label color={T.gold} size={11}>// REVERSE_FEYNMAN</Label>
      <h2 className="peer-cinzel" style={{ fontSize: 26, color: T.text, margin: '0 0 4px', letterSpacing: '0.03em' }}>
        Teach it back to ELIM
      </h2>
      <Motto>qui docet discit · who teaches, learns</Motto>

      <p className="peer-gar" style={{ fontSize: 15, color: T.sub, lineHeight: 1.65, marginTop: 14, fontStyle: 'italic' }}>
        Explain <span style={{ color: T.parch, textTransform: 'capitalize' }}>{topic}</span> in your own words.
        This measures the actual delta in your understanding and replaces the proxy estimate
        for your tutor's protégé bonus.
      </p>

      {phase === 'explain' && (
        <>
          <div style={{
            marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="peer-mono" style={{ fontSize: 10, color: T.sub, letterSpacing: '0.14em' }}>
              {String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')} ELAPSED
            </span>
            <span className="peer-mono" style={{ fontSize: 9, color: T.dim }}>
              {text.length} / 4000
            </span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 4000))}
            placeholder="In your own words, with no help open..."
            className="peer-gar"
            style={{
              width: '100%', minHeight: 180, marginTop: 8,
              background: 'rgba(0,229,255,0.03)',
              border: '1px solid rgba(0,229,255,0.18)',
              borderRadius: 2, padding: '1rem 1.1rem',
              color: T.text, fontSize: 16, lineHeight: 1.65,
              resize: 'vertical', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = `${T.gold}99` }}
            onBlur={e  => { e.target.style.borderColor = 'rgba(0,229,255,0.18)' }}
          />
          {error && <p className="peer-mono" style={{ fontSize: 10, color: T.coral, marginTop: 8, letterSpacing: '0.1em' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <CBtn onClick={submit} color={T.gold} full disabled={text.trim().length < 10}>
              SUBMIT FOR GRADING
            </CBtn>
            <CBtn onClick={onSkip} color={T.dim}>SKIP</CBtn>
          </div>
        </>
      )}

      {phase === 'grading' && (
        <div style={{ marginTop: 30 }}>
          <ScanBar color={T.gold} />
          <p className="peer-mono" style={{ fontSize: 11, color: T.sub, textAlign: 'center', marginTop: 14, letterSpacing: '0.16em' }}>
            ELIM IS MEASURING THE DELTA...
          </p>
        </div>
      )}

      {phase === 'result' && result && (
        <ReverseFeynmanResult result={result} onContinue={onDone} />
      )}
    </div>
  )
}

function ReverseFeynmanResult({ result, onContinue }) {
  const { pre_score, post_score, delta, grade, rewards } = result
  const deltaColor = delta >= 15 ? T.green : delta >= 5 ? T.gold : delta >= 0 ? T.amber : T.coral

  return (
    <div style={{ marginTop: 24, animation: 'peerFadeIn 0.4s ease-out' }}>
      <Panel style={{ padding: '1.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16, flexWrap: 'wrap' }}>
          <ScorePill label="BEFORE" value={pre_score} color={T.sub} />
          <div className="peer-orbit" style={{ fontSize: 28, fontWeight: 900, color: deltaColor }}>
            {delta >= 0 ? '+' : ''}{delta}
          </div>
          <ScorePill label="AFTER" value={post_score} color={deltaColor} />
        </div>

        {grade?.feedback && (
          <p className="peer-gar" style={{ fontSize: 15, color: T.parch, fontStyle: 'italic', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
            "{grade.feedback}"
          </p>
        )}

        {grade?.what_stuck?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Label color={T.green} size={9}>// WHAT STUCK</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {grade.what_stuck.map((c, i) => (
                <span key={i} className="peer-mono" style={{
                  fontSize: 11, padding: '3px 9px',
                  background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)',
                  borderRadius: 2, color: T.green, letterSpacing: '0.05em',
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {grade?.still_fuzzy?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Label color={T.amber} size={9}>// STILL FUZZY</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {grade.still_fuzzy.map((c, i) => (
                <span key={i} className="peer-mono" style={{
                  fontSize: 11, padding: '3px 9px',
                  background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
                  borderRadius: 2, color: T.amber, letterSpacing: '0.05em',
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {(rewards?.length > 0) && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.gold}33` }}>
            <Label color={T.gold} size={9}>// MEASURED PROTÉGÉ BONUS DELIVERED</Label>
            {rewards.map((r, i) => (
              <div key={i} className="peer-gar" style={{ fontSize: 14, color: T.parch, fontStyle: 'italic' }}>
                Your tutor received +{r.boost} mastery — confirmed by your real {r.delta}-point delta.
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 18 }}>
        <CBtn onClick={onContinue} color={T.cyan} full>CONTINUE TO CODEX →</CBtn>
      </div>
    </div>
  )
}

function ScorePill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Label color={color} size={9}>{label}</Label>
      <div className="peer-orbit" style={{ fontSize: 26, fontWeight: 700, color, textShadow: `0 0 12px ${color}55` }}>{value}</div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN 5 — CODEX (results, dark-academia scroll)
// ═════════════════════════════════════════════════════════════════════════════
function CodexScreen({ sessionId, role, onDone }) {
  const [data, setData] = useState(null)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get('/peer/sessions')
        const sess = res.data.find(s => s.session_id === sessionId)
        if (sess?.teacher_grade || sess?.status === 'completed' || sess?.status === 'abandoned') {
          setData(sess); return
        }
      } catch {/**/}
      setTries(t => t + 1)
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [sessionId])

  if (!data) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <Label color={T.gold} size={11}>// SCRIBING THE CODEX</Label>
        <h2 className="peer-cinzel" style={{ fontSize: 24, color: T.text, margin: '0.5rem 0' }}>
          Recording session...
        </h2>
        <Motto>verba volant, scripta manent</Motto>
        <div style={{ marginTop: 24 }}><ScanBar color={T.gold} /></div>
        {tries > 5 && (
          <p className="peer-mono" style={{ fontSize: 10, color: T.dim, marginTop: 18, letterSpacing: '0.1em' }}>
            ELIM IS STILL GRADING. THIS CAN TAKE A FEW MOMENTS.
          </p>
        )}
      </div>
    )
  }

  const grade   = data.teacher_grade
  const rewards = data.rewards || []
  const concepts = data.concepts_forged || []
  const isTeach = role === 'teacher'
  const rf = data.reverse_feynman

  return (
    <div style={{ padding: '1.75rem 1.5rem', maxWidth: 760, margin: '0 auto', animation: 'peerFadeIn 0.5s ease-out' }}>
      <Label color={T.gold} size={11}>// CODEX_OF_SESSION</Label>
      <h1 className="peer-cinzel" style={{
        fontSize: 30, fontWeight: 900, color: T.text, margin: '0.25rem 0',
        letterSpacing: '0.04em',
      }}>{isTeach ? 'The Teaching Score' : 'The Session Concludes'}</h1>
      <Motto>docendo discimus &nbsp;·&nbsp; non scholae sed vitae discimus</Motto>

      {isTeach && grade && (
        <Panel style={{ marginTop: 22, padding: '1.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              border: `2px solid ${grade.overall_score >= 75 ? T.green : T.amber}88`,
              background: `${grade.overall_score >= 75 ? T.green : T.amber}10`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 30px ${grade.overall_score >= 75 ? T.green : T.amber}33`,
              flexShrink: 0,
            }}>
              <span className="peer-orbit" style={{
                fontSize: 32, fontWeight: 900,
                color: grade.overall_score >= 75 ? T.green : T.amber,
              }}>{grade.overall_score}</span>
              <span className="peer-mono" style={{ fontSize: 8, color: T.sub, letterSpacing: '0.16em' }}>/ 100</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="peer-cinzel" style={{ fontSize: 17, color: T.text, marginBottom: 6, fontWeight: 700 }}>
                {grade.biggest_strength}
              </div>
              <div className="peer-gar" style={{ fontSize: 14, color: T.sub, fontStyle: 'italic', lineHeight: 1.55 }}>
                Next time — {grade.biggest_improvement?.toLowerCase()}
              </div>
            </div>
          </div>

          <div>
            <Label color={T.gold} size={9}>// SCORE BREAKDOWN</Label>
            {[
              ['Clarity',         grade.clarity_score],
              ['Accuracy',        grade.accuracy_score],
              ['Analogy quality', grade.analogy_quality],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="peer-mono" style={{ fontSize: 10, color: T.sub, minWidth: 130, letterSpacing: '0.1em' }}>{k.toUpperCase()}</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(0,229,255,0.06)' }}>
                  <div style={{
                    height: '100%', width: `${v}%`,
                    background: v >= 75 ? T.green : v >= 50 ? T.amber : T.coral,
                    transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: `0 0 8px ${v >= 75 ? T.green : v >= 50 ? T.amber : T.coral}55`,
                  }} />
                </div>
                <span className="peer-orbit" style={{ fontSize: 13, color: v >= 75 ? T.green : T.amber, minWidth: 32, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {concepts.length > 0 && (
        <Panel style={{ marginTop: 14, padding: '1.1rem' }}>
          <Label color={T.gold} size={9}>// CONCEPTS FORGED · {concepts.length}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {concepts.map((c, i) => (
              <div key={i} className="peer-parchment" style={{
                padding: '6px 10px', borderRadius: 2,
                background: 'rgba(40,28,16,0.5)', border: `1px solid ${T.gold}44`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.gold, boxShadow: `0 0 6px ${T.gold}` }} />
                <span className="peer-cinzel" style={{ fontSize: 12, color: T.parch }}>{c.concept}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {rf && (
        <Panel style={{ marginTop: 14, padding: '1.1rem' }}>
          <Label color={T.gold} size={9}>// REVERSE FEYNMAN — measured delta</Label>
          <div className="peer-gar" style={{ fontSize: 15, color: T.parch, fontStyle: 'italic', marginTop: 6, lineHeight: 1.55 }}>
            {rf.feedback || 'Learner submitted a reverse Feynman.'}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span className="peer-mono" style={{ fontSize: 11, color: T.sub }}>POST SCORE · {rf.post_score}</span>
            <span className="peer-mono" style={{ fontSize: 11, color: rf.delta >= 15 ? T.green : T.gold }}>
              DELTA · {rf.delta >= 0 ? '+' : ''}{rf.delta}
            </span>
          </div>
        </Panel>
      )}

      {rewards.length > 0 && (
        <Panel style={{ marginTop: 14, padding: '1.1rem' }}>
          <Label color={T.gold} size={9}>// SEALS GRANTED</Label>
          {rewards.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0.5rem 0',
              borderBottom: i < rewards.length - 1 ? '1px solid rgba(201,168,107,0.18)' : 'none',
            }}>
              <span className="peer-cinzel" style={{ fontSize: 22, color: T.gold }}>
                {r.type === 'teaching_badge' ? '✦' : r.type === 'protege_effect' ? '↑' : '◆'}
              </span>
              <div>
                <div className="peer-mono" style={{ fontSize: 10, color: T.gold, letterSpacing: '0.12em' }}>
                  {r.type === 'teaching_badge' ? 'TEACHING MASTER SEAL' :
                   r.type === 'protege_effect' ? `+${r.boost} MASTERY · PROTÉGÉ EFFECT${r.measured ? ' (MEASURED)' : ''}` :
                   r.type.toUpperCase()}
                </div>
                {r.topic && (
                  <div className="peer-cinzel" style={{ fontSize: 13, color: T.parch, textTransform: 'capitalize' }}>{r.topic}</div>
                )}
              </div>
            </div>
          ))}
        </Panel>
      )}

      <div style={{ marginTop: 20 }}>
        <CBtn onClick={onDone} color={T.cyan} full>RETURN TO NETWORK →</CBtn>
      </div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
export default function PeerTeachingPage() {
  injectPeerCSS()
  const [screen,    setScreen]    = useState('discovery')   // discovery|matching|chat|rfeynman|codex
  const [topic,     setTopic]     = useState(null)
  const [role,      setRole]      = useState(null)
  const [sessionId, setSessionId] = useState(null)

  const handleRequest  = useCallback((t, r) => { setTopic(t); setRole(r); setScreen('matching') }, [])
  const handleResume   = useCallback((sid, r) => { setSessionId(sid); setRole(r); setScreen('chat') }, [])
  const handleMatched  = useCallback((sid, r) => { setSessionId(sid); setRole(r); setScreen('chat') }, [])
  const handleEndChat  = useCallback(() => setScreen('rfeynman'), [])
  const handleDone     = useCallback(() => {
    setScreen('discovery'); setTopic(null); setRole(null); setSessionId(null)
  }, [])
  const handleSkipRF   = useCallback(() => setScreen('codex'), [])
  const handleAfterRF  = useCallback(() => setScreen('codex'), [])

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      position: 'relative', overflow: 'hidden',
      color: T.text,
    }}>
      <StarField density={screen === 'chat' ? 'low' : 'high'} />

      {/* Sub-nav strip */}
      <div style={{
        position: 'relative', zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        background: 'rgba(1,2,8,0.78)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="peer-mono" style={{
            fontSize: 10, letterSpacing: '0.2em', color: T.purple,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: T.purple, boxShadow: `0 0 8px ${T.purple}`,
              display: 'inline-block', animation: 'peerBlink 2s ease-in-out infinite',
            }} />
            PEER_NETWORK
          </span>
          <span className="peer-gar" style={{ fontSize: 12, color: T.gold, fontStyle: 'italic', opacity: 0.75 }}>
            docendo discimus
          </span>
        </div>
        {screen !== 'discovery' && (
          <button
            onClick={handleDone}
            className="peer-mono"
            style={{
              background: 'transparent', border: '1px solid rgba(0,229,255,0.18)',
              borderRadius: 2, padding: '3px 12px',
              fontSize: 10, letterSpacing: '0.12em', color: T.sub, cursor: 'pointer',
            }}
          >← BACK TO NETWORK</button>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 5 }}>
        {screen === 'discovery' && <DiscoveryScreen onRequest={handleRequest} onResume={handleResume} />}
        {screen === 'matching'  && <MatchingScreen topic={topic} role={role} onMatched={handleMatched} onCancel={handleDone} />}
        {screen === 'chat'      && <ChatScreen sessionId={sessionId} role={role} onEnd={handleEndChat} />}
        {screen === 'rfeynman'  && <ReverseFeynmanScreen sessionId={sessionId} topic={topic} role={role} onDone={handleAfterRF} onSkip={handleSkipRF} />}
        {screen === 'codex'     && <CodexScreen sessionId={sessionId} role={role} onDone={handleDone} />}
      </div>
    </div>
  )
}
