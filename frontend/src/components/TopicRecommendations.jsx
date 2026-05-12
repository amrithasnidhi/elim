import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function TopicRecommendations() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/profile/recommendations').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !data?.recommendations?.length) return null

  return (
    <div className="cyber-panel" style={{ padding: '1.25rem 1.5rem' }}>
      <p style={{
        fontFamily: "'Orbitron',monospace",
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--cyan)', marginBottom: 4,
      }}>
        WHAT_TO_LEARN_NEXT
      </p>
      <p style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em', marginBottom: '1rem',
      }}>
        PERSONALISED PICKS BASED ON YOUR LEARNING PATH
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
        {data.recommendations.map(({ topic, score }) => (
          <button
            key={topic}
            type="button"
            onClick={() => navigate('/', { state: { prefillTopic: topic } })}
            style={{
              textAlign: 'left', padding: '0.75rem',
              background: 'rgba(0,229,255,0.02)',
              border: '1px solid rgba(0,229,255,0.1)',
              borderRadius: 2, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'
              e.currentTarget.style.background = 'rgba(0,229,255,0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(0,229,255,0.1)'
              e.currentTarget.style.background = 'rgba(0,229,255,0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 6 }}>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                lineHeight: 1.3,
              }}>
                {topic}
              </span>
              <svg width="10" height="10" fill="none" stroke="var(--dim)" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: Math.min(score, 5) }).map((_, i) => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--cyan)', opacity: 0.6,
                  display: 'inline-block',
                }} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
