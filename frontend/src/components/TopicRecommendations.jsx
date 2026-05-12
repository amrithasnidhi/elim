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

  const handleLearn = (topic) => {
    navigate('/', { state: { prefillTopic: topic } })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 text-base mb-1">What to Learn Next</h2>
      <p className="text-gray-400 text-sm mb-5">
        Personalised picks based on your learning path and style.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.recommendations.map(({ topic, score }) => (
          <button
            key={topic}
            type="button"
            onClick={() => handleLearn(topic)}
            className="group text-left p-3.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
          >
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-700 leading-tight">
                {topic}
              </span>
              <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 mt-0.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(score, 5) }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-300 group-hover:bg-indigo-400" />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
