import { useState } from 'react'
import toast from 'react-hot-toast'
import ThumbsRating from './ThumbsRating'
import AudioPlayer from './AudioPlayer'
import DiagramView from './DiagramView'
import ChatThread from './ChatThread'
import useAuthStore from '../store/useAuthStore'

const STYLE_META = {
  analogy:       { label: 'ANALOGY',    color: 'var(--purple)' },
  'step-by-step':{ label: 'STEP-BY-STEP', color: 'var(--cyan)' },
  'code-based':  { label: 'CODE-FIRST', color: 'var(--green)' },
}

export default function ExplainCard({ explanation, followup, style, topic, historyId, displayTimeUtc, quality }) {
  const user = useAuthStore((s) => s.user)
  const [copied, setCopied] = useState(false)
  const [updatedWeights, setUpdatedWeights] = useState(null)
  const [activePanel, setActivePanel] = useState(null)

  const meta = STYLE_META[style] || { label: style?.toUpperCase(), color: 'var(--cyan)' }

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

      {/* Explanation */}
      <div style={{ padding: '1.5rem' }}>
        <p style={{
          color: 'var(--text)', lineHeight: 1.75,
          whiteSpace: 'pre-wrap', fontSize: 15,
          fontFamily: "'Rajdhani',sans-serif",
        }}>
          {explanation}
        </p>
      </div>

      {/* Follow-up */}
      {followup && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '1rem',
          background: 'rgba(124,110,240,0.06)',
          border: '1px solid rgba(124,110,240,0.2)',
          borderRadius: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="14" height="14" fill="none" stroke="var(--purple)" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: '0.16em',
                color: 'var(--purple)', marginBottom: 6,
              }}>
                CHECK_YOUR_UNDERSTANDING
              </p>
              <p style={{ color: 'rgba(232,244,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>
                {followup}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      {historyId && user && (
        <div style={{ padding: '0 1.5rem 0.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            borderTop: '1px solid rgba(0,229,255,0.06)',
            paddingTop: '0.75rem',
          }}>
            {[
              { key: 'audio', label: 'LISTEN', icon: (
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
                </svg>
              )},
              { key: 'diagram', label: 'DIAGRAM', icon: (
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              )},
              { key: 'chat', label: 'FOLLOW_UP', icon: (
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )},
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePanel(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 9, letterSpacing: '0.12em',
                  padding: '4px 10px', borderRadius: 2,
                  border: `1px solid ${activePanel === key ? 'rgba(0,229,255,0.4)' : 'rgba(0,229,255,0.12)'}`,
                  background: activePanel === key ? 'rgba(0,229,255,0.08)' : 'transparent',
                  color: activePanel === key ? 'var(--cyan)' : 'var(--sub)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <div style={{ paddingTop: '0.75rem' }}>
            {activePanel === 'audio'   && <AudioPlayer text={explanation} />}
            {activePanel === 'diagram' && <DiagramView historyId={historyId} />}
            {activePanel === 'chat'    && <ChatThread  historyId={historyId} topic={topic} />}
          </div>
        </div>
      )}

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
    </div>
  )
}
