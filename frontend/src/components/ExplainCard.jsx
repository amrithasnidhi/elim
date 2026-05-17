import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// One-time prose typography for explanation bodies — eye-strain fix only,
// doesn't touch the cyberpunk theme. ::first-letter and p+p margin can't be
// expressed as inline styles, so they live in this injected stylesheet.
function injectProseCSS() {
  if (typeof document === 'undefined' || document.getElementById('elim-prose-css')) return
  const s = document.createElement('style')
  s.id = 'elim-prose-css'
  s.textContent = `
    .elim-prose {
      color: #C8D8E8;
      font-family: 'Rajdhani', sans-serif;
      font-size: 16.5px;
      font-weight: 500;
      line-height: 1.85;
      letter-spacing: 0.01em;
    }
    .elim-prose p { margin: 0; }
    .elim-prose p + p { margin-top: 20px; }
    .elim-prose p:first-child::first-letter {
      font-size: 1.45em;
      font-weight: 600;
      color: #5DCAA5;
      float: left;
      margin-right: 4px;
      margin-top: 4px;
      line-height: 1;
    }
    .elim-followup-text {
      color: #A8C4C8;
      font-family: 'Rajdhani', sans-serif;
      font-size: 15px;
      font-weight: 500;
      line-height: 1.65;
      letter-spacing: 0.01em;
    }
  `
  document.head.appendChild(s)
}
import ThumbsRating from './ThumbsRating'
import AudioPlayer from './AudioPlayer'
import DiagramView from './DiagramView'
import ChatThread from './ChatThread'
import ImageGrid from './ImageGrid'
import GhostModal from './GhostModal'
import ExportMenu from './ExportMenu'
import QuizPanel from './QuizPanel'
import ReexplainPanel from './ReexplainPanel'
import SocraticLauncher from './SocraticLauncher'
import useAuthStore from '../store/useAuthStore'

const STYLE_META = {
  analogy:       { label: 'ANALOGY',    color: 'var(--purple)' },
  'step-by-step':{ label: 'STEP-BY-STEP', color: 'var(--cyan)' },
  'code-based':  { label: 'CODE-FIRST', color: 'var(--green)' },
}

export default function ExplainCard({ explanation, followup, style, topic, historyId, displayTimeUtc, quality }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [updatedWeights, setUpdatedWeights] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [showGhost, setShowGhost] = useState(false)

  const meta = STYLE_META[style] || { label: style?.toUpperCase(), color: 'var(--cyan)' }

  useEffect(() => { injectProseCSS() }, [])

  // Split on blank-line boundaries so paragraph spacing has something to grip.
  // Treat any "blank line" (incl. lines with only whitespace) as a paragraph break.
  const paragraphs = (explanation || '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)

  const handleCopy = () => {
    navigator.clipboard.writeText(explanation)
    setCopied(true)
    toast.success('COPIED TO CLIPBOARD')
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePanel = (panel) => setActivePanel((p) => (p === panel ? null : panel))

  return (
    <div className="cyber-panel" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        background: 'rgba(0,229,255,0.02)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 13, fontWeight: 700,
            color: 'var(--text)', letterSpacing: '0.08em',
          }}>
            {topic?.toUpperCase()}
          </h3>
          <span style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.14em',
            color: meta.color,
            border: `1px solid ${meta.color}`,
            borderRadius: 2, padding: '2px 7px',
            opacity: 0.9,
          }}>
            {meta.label}
          </span>
          {quality?.avg && (
            <span
              title={`clarity ${quality.clarity}/5  accuracy ${quality.accuracy}/5  style ${quality.style_fit}/5`}
              style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: '0.12em',
                color: quality.avg >= 4 ? 'var(--green)' : quality.avg >= 3 ? 'var(--amber)' : '#ff4466',
                border: `1px solid ${quality.avg >= 4 ? 'rgba(0,255,157,0.3)' : quality.avg >= 3 ? 'rgba(245,166,35,0.3)' : 'rgba(255,68,102,0.3)'}`,
                borderRadius: 2, padding: '2px 6px',
              }}
            >
              Q {quality.avg.toFixed(1)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ExportMenu
            topic={topic}
            style={style}
            explanation={explanation}
            followup={followup}
            difficulty={user?.difficulty_level || 2}
          />
          <button
            onClick={handleCopy}
            className="cyber-btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {copied ? (
              <>
                <svg width="12" height="12" fill="none" stroke="var(--green)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                COPIED
              </>
            ) : (
              <>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                COPY
              </>
            )}
          </button>
        </div>
      </div>

      {/* Explanation */}
      <div className="elim-prose" style={{ padding: '1.5rem' }}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* Follow-up */}
      {followup && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '1rem 1.1rem',
          background: 'rgba(93,202,165,0.07)',
          borderLeft: '2px solid rgba(93,202,165,0.5)',
          borderRadius: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="14" height="14" fill="none" stroke="#5DCAA5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: '0.16em',
                color: '#5DCAA5', marginBottom: 6,
              }}>
                CHECK_YOUR_UNDERSTANDING
              </p>
              <p className="elim-followup-text" style={{ margin: 0 }}>
                {followup}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action bar — always rendered. Buttons that need historyId/login show a hint when clicked. */}
      <div style={{ padding: '0 1.5rem 0.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
          borderTop: '1px solid rgba(0,229,255,0.06)',
          paddingTop: '0.75rem',
        }}>
          {[
            // Row 1 — original
            { key: 'images',   label: 'IMAGES',     accent: 'cyan',   needs: 'topic' },
            { key: 'audio',    label: 'LISTEN',     accent: 'cyan',   needs: 'explanation' },
            { key: 'diagram',  label: 'DIAGRAM',    accent: 'cyan',   needs: 'history' },
            { key: 'chat',     label: 'FOLLOW_UP',  accent: 'cyan',   needs: 'history' },
            { key: 'ghost',    label: 'GHOST',      accent: 'purple', needs: 'history', action: () => setShowGhost(true) },
            // Row 2 — new advanced
            { key: 'quiz',     label: 'QUIZ_ME',    accent: 'green',  needs: 'history' },
            { key: 'simplify', label: 'SIMPLIFY ↓', accent: 'cyan',   needs: 'history' },
            { key: 'deepen',   label: 'DEEPEN ↑',   accent: 'purple', needs: 'history' },
            { key: 'socratic', label: 'SOCRATIC',   accent: 'amber',  needs: 'login' },
          ].map(({ key, label, accent, needs, action }) => {
            const accentVar = { cyan: 'var(--cyan)', purple: 'var(--purple)', green: 'var(--green)', amber: 'var(--amber)' }[accent]
            const accentRGB = { cyan: '0,229,255', purple: '124,110,240', green: '0,255,157', amber: '245,166,35' }[accent]
            const active = activePanel === key
            const disabled = (needs === 'history' && !historyId) || (needs === 'login' && !user)
            return (
              <button
                key={key}
                type="button"
                title={disabled ? (needs === 'history' ? 'Generate an explanation first' : 'Log in to use this') : ''}
                onClick={() => {
                  if (disabled) {
                    if (needs === 'login') { navigate('/auth/login'); return }
                    toast.error('GENERATE AN EXPLANATION FIRST')
                    return
                  }
                  if (action) { action(); return }
                  togglePanel(key)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 9, letterSpacing: '0.12em',
                  padding: '4px 10px', borderRadius: 2,
                  border: `1px solid ${active ? accentVar : disabled ? 'rgba(255,255,255,0.06)' : `rgba(${accentRGB},0.25)`}`,
                  background: active ? `rgba(${accentRGB},0.10)` : disabled ? 'transparent' : 'transparent',
                  color: active ? accentVar : disabled ? 'var(--dim)' : 'var(--sub)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = accentVar; e.currentTarget.style.borderColor = accentVar } }}
                onMouseLeave={e => { if (!disabled && !active) { e.currentTarget.style.color = 'var(--sub)'; e.currentTarget.style.borderColor = `rgba(${accentRGB},0.25)` } }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div style={{ paddingTop: '0.75rem' }}>
          {activePanel === 'images'   && <ImageGrid     topic={topic} />}
          {activePanel === 'audio'    && <AudioPlayer   text={explanation} />}
          {activePanel === 'diagram'  && historyId && <DiagramView  historyId={historyId} />}
          {activePanel === 'chat'     && historyId && <ChatThread   historyId={historyId} topic={topic} />}
          {activePanel === 'quiz'     && historyId && <QuizPanel    historyId={historyId} />}
          {activePanel === 'simplify' && historyId && <ReexplainPanel historyId={historyId} direction="simplify" />}
          {activePanel === 'deepen'   && historyId && <ReexplainPanel historyId={historyId} direction="deepen" />}
          {activePanel === 'socratic' && user && (
            <SocraticLauncher topic={topic} difficulty={user?.difficulty_level || 2} />
          )}
        </div>
      </div>

      {/* Rating footer */}
      <div style={{
        padding: '0.75rem 1.5rem',
        borderTop: '1px solid rgba(0,229,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <ThumbsRating historyId={historyId} displayTimeUtc={displayTimeUtc} onRated={setUpdatedWeights} />
        {updatedWeights && (
          <span style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.12em',
            color: 'var(--green)',
          }}>
            STYLE_WEIGHTS_UPDATED
          </span>
        )}
      </div>

      {showGhost && (
        <GhostModal
          historyId={historyId}
          topic={topic}
          onClose={() => setShowGhost(false)}
        />
      )}
    </div>
  )
}
