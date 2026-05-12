import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

const STAR_LABELS = ['', 'Not helpful', 'Slightly helpful', 'Helpful', 'Very helpful', 'Perfect!']

export default function ThumbsRating({ historyId, displayTimeUtc, onRated, multiStyle = false }) {
  const [voted, setVoted] = useState(null)
  const [showStars, setShowStars] = useState(false)
  const [starValue, setStarValue] = useState(0)
  const [starHover, setStarHover] = useState(0)

  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => api.post('/feedback/rate', data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      if (onRated) onRated(data.updated_weights)
    },
    onError: () => toast.error('Could not save rating'),
  })

  if (!user || !historyId) return null

  const submitRating = (score, star = null) => {
    setVoted(score)
    mutation.mutate({
      history_id: historyId, score, star_rating: star,
      display_time_utc: displayTimeUtc, multi_style: multiStyle,
    })
    if (score === 1 && !showStars) setShowStars(true)
    if (score !== 1) setShowStars(false)
  }

  const handleStarClick = (val) => {
    setStarValue(val)
    mutation.mutate({
      history_id: historyId, score: voted ?? 1, star_rating: val,
      display_time_utc: displayTimeUtc, multi_style: multiStyle,
    })
    toast.success('RATING SAVED')
    setShowStars(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.14em', color: 'var(--dim)',
        }}>
          HELPFUL?
        </span>

        <button
          onClick={() => submitRating(1)}
          disabled={mutation.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 2,
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.1em',
            cursor: 'pointer', transition: 'all 0.2s',
            border: voted === 1
              ? '1px solid rgba(0,255,157,0.5)'
              : '1px solid rgba(0,229,255,0.12)',
            background: voted === 1 ? 'rgba(0,255,157,0.08)' : 'transparent',
            color: voted === 1 ? 'var(--green)' : 'var(--sub)',
          }}
        >
          <svg width="11" height="11" fill={voted === 1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          YES
        </button>

        <button
          onClick={() => submitRating(-1)}
          disabled={mutation.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 2,
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.1em',
            cursor: 'pointer', transition: 'all 0.2s',
            border: voted === -1
              ? '1px solid rgba(255,68,102,0.5)'
              : '1px solid rgba(0,229,255,0.12)',
            background: voted === -1 ? 'rgba(255,68,102,0.08)' : 'transparent',
            color: voted === -1 ? '#ff4466' : 'var(--sub)',
          }}
        >
          <svg width="11" height="11" fill={voted === -1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
          NO
        </button>

        {voted !== null && (
          <button
            onClick={() => setShowStars((s) => !s)}
            style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, letterSpacing: '0.1em',
              color: 'var(--purple)', background: 'transparent',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {showStars ? 'HIDE' : 'RATE_STARS'}
          </button>
        )}
      </div>

      {showStars && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleStarClick(val)}
              onMouseEnter={() => setStarHover(val)}
              onMouseLeave={() => setStarHover(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'transform 0.1s',
                transform: (starHover || starValue) >= val ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"
                style={{ color: (starHover || starValue) >= val ? 'var(--amber)' : 'var(--dim)' }}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
          {(starHover || starValue) > 0 && (
            <span style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, color: 'var(--sub)',
            }}>
              {STAR_LABELS[starHover || starValue]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
