import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

const STAR_LABELS = ['', 'Not helpful', 'Slightly helpful', 'Helpful', 'Very helpful', 'Perfect!']

export default function ThumbsRating({ historyId, displayTimeUtc, onRated, multiStyle = false }) {
  const [voted, setVoted] = useState(null)          // -1 | 0 | 1
  const [showStars, setShowStars] = useState(false)
  const [starValue, setStarValue] = useState(0)
  const [starHover, setStarHover] = useState(0)

  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => api.post('/feedback/rate', data).then((r) => r.data),
    onSuccess: (data) => {
      // Invalidate profile so style_weights bar chart refreshes live
      qc.invalidateQueries({ queryKey: ['profile'] })
      if (onRated) onRated(data.updated_weights)
    },
    onError: () => toast.error('Could not save rating'),
  })

  if (!user || !historyId) return null

  const submitRating = (score, star = null) => {
    setVoted(score)
    mutation.mutate({
      history_id: historyId,
      score,
      star_rating: star,
      display_time_utc: displayTimeUtc,
      multi_style: multiStyle,
    })
    if (score === 1 && !showStars) setShowStars(true)
    if (score !== 1) setShowStars(false)
  }

  const handleStarClick = (val) => {
    setStarValue(val)
    mutation.mutate({
      history_id: historyId,
      score: voted ?? 1,
      star_rating: val,
      display_time_utc: displayTimeUtc,
      multi_style: multiStyle,
    })
    toast.success('Rating saved!')
    setShowStars(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium">Was this helpful?</span>

        <button
          onClick={() => submitRating(1)}
          disabled={mutation.isPending}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
            voted === 1
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill={voted === 1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          Yes
        </button>

        <button
          onClick={() => submitRating(-1)}
          disabled={mutation.isPending}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
            voted === -1
              ? 'bg-red-100 text-red-700 border border-red-200'
              : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill={voted === -1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
          No
        </button>

        {voted !== null && (
          <button
            onClick={() => setShowStars((s) => !s)}
            className="text-xs text-indigo-500 hover:underline ml-1"
          >
            {showStars ? 'Hide' : 'Rate with stars'}
          </button>
        )}
      </div>

      {/* Collapsible star rating */}
      {showStars && (
        <div className="flex items-center gap-1.5 pl-1">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleStarClick(val)}
              onMouseEnter={() => setStarHover(val)}
              onMouseLeave={() => setStarHover(0)}
              className="transition-transform hover:scale-125"
            >
              <svg
                className={`w-5 h-5 ${(starHover || starValue) >= val ? 'text-amber-400' : 'text-gray-200'}`}
                fill="currentColor" viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
          {(starHover || starValue) > 0 && (
            <span className="text-xs text-gray-400 ml-1">{STAR_LABELS[starHover || starValue]}</span>
          )}
        </div>
      )}
    </div>
  )
}
