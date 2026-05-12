import { useState } from 'react'
import ThumbsRating from './ThumbsRating'

const TABS = [
  { key: 'analogy',      label: 'Analogy',       icon: '🧩', color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-200', activeTab: 'border-purple-500 text-purple-700' },
  { key: 'step-by-step', label: 'Step-by-Step',  icon: '📋', color: 'text-blue-600',   activeBg: 'bg-blue-50 border-blue-200',     activeTab: 'border-blue-500 text-blue-700' },
  { key: 'code-based',   label: 'Code-First',    icon: '💻', color: 'text-green-600',  activeBg: 'bg-green-50 border-green-200',   activeTab: 'border-green-500 text-green-700' },
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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {TABS.map((tab) => {
          const res = data[RESULT_KEYS[tab.key]]
          const hasError = res?.error
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? `${tab.activeTab} bg-white`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {hasError && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
              {updatedWeights[tab.key] && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {result?.error ? (
          <div className="text-red-500 text-sm py-4 text-center">
            Failed to generate this style. Please try again.
          </div>
        ) : (
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
            {result?.explanation}
          </p>
        )}
      </div>

      {/* Follow-up */}
      {result?.followup && !result?.error && (
        <div className="mx-6 mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Check your understanding</p>
              <p className="text-indigo-800 text-sm">{result.followup}</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-tab rating */}
      <div className="px-6 pb-5 flex items-center justify-between gap-4 flex-wrap border-t border-gray-50 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">Rating <span className={`font-semibold ${current.color}`}>{current.label}</span> style</p>
          <ThumbsRating
            historyId={result?.history_id}
            displayTimeUtc={displayTimeUtc}
            multiStyle
            onRated={(w) => setUpdatedWeights((prev) => ({ ...prev, [activeTab]: w }))}
          />
        </div>
        {Object.keys(updatedWeights).length > 0 && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full">
            {Object.keys(updatedWeights).length}/3 styles rated
          </span>
        )}
      </div>
    </div>
  )
}
