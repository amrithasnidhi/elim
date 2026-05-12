import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ChatThread({ historyId, topic }) {
  const [messages, setMessages] = useState([])
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

  return (
    <div className="flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ask a follow-up</span>
        {messages.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{Math.ceil(messages.length / 2)}/5 turns</span>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {mutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask anything about ${topic}…`}
          disabled={mutation.isPending || Math.ceil(messages.length / 2) >= 5}
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || mutation.isPending || Math.ceil(messages.length / 2) >= 5}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </form>
      {Math.ceil(messages.length / 2) >= 5 && (
        <p className="text-xs text-center text-gray-400 pb-2">Conversation limit reached (5 turns)</p>
      )}
    </div>
  )
}
