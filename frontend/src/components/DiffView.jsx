import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

function DiffLine({ line }) {
  if (line.startsWith('---') || line.startsWith('+++')) {
    return (
      <div className="text-xs font-mono text-gray-400 px-3 py-0.5 bg-gray-50 border-b border-gray-100">
        {line}
      </div>
    )
  }
  if (line.startsWith('@@')) {
    return (
      <div className="text-xs font-mono text-indigo-500 px-3 py-0.5 bg-indigo-50">
        {line}
      </div>
    )
  }
  if (line.startsWith('+')) {
    return (
      <div className="text-xs font-mono text-green-800 px-3 py-0.5 bg-green-50 border-l-2 border-green-400">
        {line}
      </div>
    )
  }
  if (line.startsWith('-')) {
    return (
      <div className="text-xs font-mono text-red-800 px-3 py-0.5 bg-red-50 border-l-2 border-red-400">
        {line}
      </div>
    )
  }
  return (
    <div className="text-xs font-mono text-gray-600 px-3 py-0.5">
      {line}
    </div>
  )
}

export default function DiffView({ h1, h2 }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['diff', h1, h2],
    queryFn: () => api.get('/profile/history/diff', { params: { h1, h2 } }).then((r) => r.data),
    enabled: !!(h1 && h2 && h1 !== h2),
  })

  if (!h1 || !h2) return null
  if (h1 === h2) return <p className="text-sm text-gray-400 text-center py-4">Select two different versions to compare.</p>

  if (isLoading) {
    return (
      <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
        Computing diff…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 text-center py-4">Could not load diff.</p>
  }

  if (!data?.diff?.length) {
    return <p className="text-sm text-gray-400 text-center py-4">No differences found.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Explanation Diff</span>
        <div className="flex items-center gap-2 ml-auto text-xs text-gray-400">
          <span className="w-3 h-3 bg-red-100 border-l-2 border-red-400 inline-block" /> Removed
          <span className="w-3 h-3 bg-green-100 border-l-2 border-green-400 inline-block ml-2" /> Added
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {data.diff.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </div>
    </div>
  )
}
