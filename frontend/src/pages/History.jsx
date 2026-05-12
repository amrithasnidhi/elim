import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

const STYLE_COLORS = {
  'analogy': 'bg-purple-100 text-purple-700',
  'step-by-step': 'bg-blue-100 text-blue-700',
  'code-based': 'bg-green-100 text-green-700',
}

const STYLE_ICONS = { analogy: '🧩', 'step-by-step': '📋', 'code-based': '💻' }

function ScoreBadge({ score }) {
  if (score === 1) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
      </svg>
      Helpful
    </span>
  )
  if (score === -1) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
      </svg>
      Not helpful
    </span>
  )
  return <span className="text-xs text-gray-300">—</span>
}

export default function History() {
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [topicFilter, setTopicFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['history', page, topicFilter],
    queryFn: () =>
      api.get('/profile/history', { params: { page, limit: 20, topic: topicFilter || undefined } })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">History</h1>
            <p className="text-gray-500 mt-1">All your past explanations</p>
          </div>
          <input
            type="text"
            placeholder="Filter by topic..."
            value={topicFilter}
            onChange={(e) => { setTopicFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-gray-700 w-56"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium">No explanations yet</p>
            <p className="text-sm mt-1">Generate your first explanation on the home page</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data.items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xl flex-shrink-0">{STYLE_ICONS[item.style_used] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.topic}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                        {' · '}
                        Difficulty {item.difficulty_used}/5
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STYLE_COLORS[item.style_used] || 'bg-gray-100 text-gray-600'}`}>
                        {item.style_used}
                      </span>
                      <ScoreBadge score={item.feedback_score} />
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded explanation */}
                  {expanded === item.id && (
                    <div className="px-5 pb-5 border-t border-gray-50">
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap pt-4">
                        {item.explanation}
                      </p>
                      {item.star_rating && (
                        <div className="mt-3 flex items-center gap-1">
                          {[1,2,3,4,5].map((s) => (
                            <svg key={s} className={`w-4 h-4 ${s <= item.star_rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="text-xs text-gray-400 ml-1">{item.star_rating}/5</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                {data.total} explanation{data.total !== 1 ? 's' : ''} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500 px-2">Page {page}</span>
                <button
                  disabled={!data.has_more}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
