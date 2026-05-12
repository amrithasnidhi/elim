import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function SocraticChat({ openingQuestion, historyId, topic }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: openingQuestion },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const mutation = useMutation({
    mutationFn: (question) =>
      api.post('/explain/followup', { history_id: historyId, question }).then((r) => r.data),
    onSuccess: ({ reply }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Could not get a reply')
      setMessages((prev) => prev.slice(0, -1))
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    mutation.mutate(q)
  }

  const turns = Math.floor(messages.filter((m) => m.role === 'user').length)
  const atLimit = turns >= 10

  return (
    <div className="flex flex-col bg-amber-50 rounded-xl border border-amber-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2 bg-amber-50">
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          Socratic Mode — {topic}
        </span>
        <span className="ml-auto text-xs text-amber-500">{turns}/10 turns</span>
      </div>

      {/* Messages */}
      <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
                S
              </span>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-amber-100 text-gray-700 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <span className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">S</span>
            <div className="bg-white border border-amber-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2.5 border-t border-amber-100 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer or question…"
          disabled={mutation.isPending || atLimit}
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100 outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || mutation.isPending || atLimit}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </form>
      {atLimit && (
        <p className="text-xs text-center text-amber-600 pb-2">Session limit reached (10 turns)</p>
      )}
    </div>
  )
}
