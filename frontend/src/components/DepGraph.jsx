import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

function TopicPill({ topic, explored, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(topic)}
      className={`block w-full text-left text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
        explored
          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
      }`}
    >
      {explored && <span className="mr-1.5">✓</span>}
      {topic}
    </button>
  )
}

export default function DepGraph({ topic, onTopicSelect }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dependencies', topic],
    queryFn: () => api.get('/profile/dependencies', { params: { topic } }).then((r) => r.data),
    enabled: !!topic,
  })

  if (!topic) return null

  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        Loading dependency graph…
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-red-500 py-4 text-center">
        Could not load dependency graph
      </p>
    )
  }

  const hasAny =
    data.prerequisites.length > 0 || data.next_topics.length > 0 || data.related.length > 0

  if (!hasAny) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        No dependency data available for "{topic}"
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 items-start">
        {/* Prerequisites */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            Prerequisites
          </p>
          <div className="space-y-1.5">
            {data.prerequisites.length === 0 ? (
              <span className="text-xs text-gray-300 italic">None</span>
            ) : (
              data.prerequisites.map((item) => (
                <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
              ))
            )}
          </div>
        </div>

        {/* Current topic */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-full rounded-xl border-2 border-indigo-500 bg-indigo-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-0.5">Current</p>
            <p className="text-sm font-bold text-indigo-900 leading-tight">{topic}</p>
          </div>
          {data.related.length > 0 && (
            <div className="w-full">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 text-center">Related</p>
              <div className="space-y-1.5">
                {data.related.map((item) => (
                  <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next topics */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1 justify-end">
            Up next
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </p>
          <div className="space-y-1.5">
            {data.next_topics.length === 0 ? (
              <span className="text-xs text-gray-300 italic">You're at the frontier!</span>
            ) : (
              data.next_topics.map((item) => (
                <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
              ))
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Green = already explored · Click any topic to learn it next
      </p>
    </div>
  )
}
