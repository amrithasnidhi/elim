import { useState } from 'react'
import toast from 'react-hot-toast'
import ThumbsRating from './ThumbsRating'
import AudioPlayer from './AudioPlayer'
import DiagramView from './DiagramView'
import ChatThread from './ChatThread'
import useAuthStore from '../store/useAuthStore'

const STYLE_LABELS = {
  analogy: 'Analogy',
  'step-by-step': 'Step-by-Step',
  'code-based': 'Code-First',
}

const STYLE_COLORS = {
  analogy: 'bg-purple-100 text-purple-700',
  'step-by-step': 'bg-blue-100 text-blue-700',
  'code-based': 'bg-green-100 text-green-700',
}

export default function ExplainCard({ explanation, followup, style, topic, historyId, displayTimeUtc, quality }) {
  const user = useAuthStore((s) => s.user)
  const [copied, setCopied] = useState(false)
  const [updatedWeights, setUpdatedWeights] = useState(null)
  const [activePanel, setActivePanel] = useState(null) // 'audio' | 'diagram' | 'chat'

  const handleCopy = () => {
    navigator.clipboard.writeText(explanation)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePanel = (panel) => setActivePanel((p) => (p === panel ? null : panel))

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-900 text-lg">{topic}</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STYLE_COLORS[style]}`}>
            {STYLE_LABELS[style]}
          </span>
        </div>
        {quality?.avg && (
          <span
            title={`Quality: clarity ${quality.clarity}/5, accuracy ${quality.accuracy}/5, style ${quality.style_fit}/5`}
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              quality.avg >= 4 ? 'bg-green-100 text-green-700' :
              quality.avg >= 3 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}
          >
            Q {quality.avg.toFixed(1)}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Explanation */}
      <div className="px-6 py-5">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">{explanation}</p>
      </div>

      {/* Follow-up question */}
      {followup && (
        <div className="mx-6 mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Check your understanding</p>
              <p className="text-indigo-800 text-sm">{followup}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action panels (audio / diagram / chat) */}
      {historyId && user && (
        <div className="px-6 pb-2 space-y-3">
          {/* Action bar */}
          <div className="flex items-center gap-1 border-t border-gray-50 pt-3">
            {[
              {
                key: 'audio',
                label: 'Listen',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
                  </svg>
                ),
              },
              {
                key: 'diagram',
                label: 'Diagram',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                ),
              },
              {
                key: 'chat',
                label: 'Chat',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePanel(key)}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all ${
                  activePanel === key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Active panel */}
          {activePanel === 'audio' && <AudioPlayer historyId={historyId} />}
          {activePanel === 'diagram' && <DiagramView historyId={historyId} />}
          {activePanel === 'chat' && <ChatThread historyId={historyId} topic={topic} />}
        </div>
      )}

      {/* Rating footer */}
      <div className="px-6 pb-5 pt-3 flex items-center justify-between gap-4 flex-wrap border-t border-gray-50">
        <ThumbsRating
          historyId={historyId}
          displayTimeUtc={displayTimeUtc}
          onRated={setUpdatedWeights}
        />
        {updatedWeights && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full">
            Style weights updated
          </span>
        )}
      </div>
    </div>
  )
}
