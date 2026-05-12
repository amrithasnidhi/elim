import { useState } from 'react'
import ThumbsRating from './ThumbsRating'

const TABS = [
  { key: 'analogy',      label: 'ANALOGY',      color: 'var(--purple)', border: 'rgba(124,110,240,0.4)' },
  { key: 'step-by-step', label: 'STEP-BY-STEP', color: 'var(--cyan)',   border: 'rgba(0,229,255,0.4)' },
  { key: 'code-based',   label: 'CODE-FIRST',   color: 'var(--green)',  border: 'rgba(0,255,157,0.4)' },
]

const RESULT_KEYS = { analogy: 'analogy', 'step-by-step': 'step_by_step', 'code-based': 'code_based' }

export default function StyleTabs({ data, displayTimeUtc, topic }) {
  const [activeTab, setActiveTab] = useState('analogy')
  const [updatedWeights, setUpdatedWeights] = useState({})

  const current = TABS.find((t) => t.key === activeTab)
  const resultKey = RESULT_KEYS[activeTab]
  const result = data?.[resultKey]

  if (!data) return null

  return (
    <div className="cyber-panel" style={{ overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        {TABS.map((tab) => {
          const res = data[RESULT_KEYS[tab.key]]
          const hasError = res?.error
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '0.75rem 0.5rem',
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: '0.14em',
                color: isActive ? tab.color : 'var(--dim)',
                background: isActive ? 'rgba(0,229,255,0.04)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {tab.label}
              {hasError && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff4466', display: 'inline-block' }} />
              )}
              {updatedWeights[tab.key] && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        {result?.error ? (
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 11, color: '#ff4466', textAlign: 'center', padding: '1rem 0',
          }}>
            GENERATION_FAILED — retry or select another style
          </p>
        ) : (
          <p style={{
            color: 'var(--text)', lineHeight: 1.75,
            whiteSpace: 'pre-wrap', fontSize: 15,
            fontFamily: "'Rajdhani',sans-serif",
          }}>
            {result?.explanation}
          </p>
        )}
      </div>

      {/* Follow-up */}
      {result?.followup && !result?.error && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '0.875rem 1rem',
          background: 'rgba(124,110,240,0.06)',
          border: '1px solid rgba(124,110,240,0.2)',
          borderRadius: 2,
        }}>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.16em',
            color: 'var(--purple)', marginBottom: 5,
          }}>
            CHECK_YOUR_UNDERSTANDING
          </p>
          <p style={{ color: 'rgba(232,244,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>
            {result.followup}
          </p>
        </div>
      )}

      {/* Per-tab rating */}
      <div style={{
        padding: '0.75rem 1.5rem',
        borderTop: '1px solid rgba(0,229,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.12em',
            color: 'var(--dim)', marginBottom: 6,
          }}>
            RATING <span style={{ color: current.color }}>{current.label}</span>
          </p>
          <ThumbsRating
            historyId={result?.history_id}
            displayTimeUtc={displayTimeUtc}
            multiStyle
            onRated={(w) => setUpdatedWeights((prev) => ({ ...prev, [activeTab]: w }))}
          />
        </div>
        {Object.keys(updatedWeights).length > 0 && (
          <span style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.12em',
            color: 'var(--green)',
          }}>
            {Object.keys(updatedWeights).length}/3 RATED
          </span>
        )}
      </div>
    </div>
  )
}
