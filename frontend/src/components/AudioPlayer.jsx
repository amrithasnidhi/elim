import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

const SPEEDS = [0.75, 1, 1.5, 2]

export default function AudioPlayer({ historyId }) {
  const [jobId, setJobId] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  const requestMutation = useMutation({
    mutationFn: () => api.post('/explain/audio', { history_id: historyId }).then((r) => r.data),
    onSuccess: (data) => {
      if (data.audio_url) {
        setAudioUrl(data.audio_url)
      } else if (data.job_id) {
        setJobId(data.job_id)
      }
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Audio generation failed'),
  })

  useQuery({
    queryKey: ['audio-status', jobId],
    queryFn: () => api.get(`/explain/audio/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'done' || data.status === 'failed') return false
      return 2000
    },
    onSuccess: (data) => {
      if (data.status === 'done' && data.audio_url) {
        setAudioUrl(data.audio_url)
        setJobId(null)
        toast.success('Audio ready!')
      }
      if (data.status === 'failed') {
        toast.error(data.error || 'Audio generation failed')
        setJobId(null)
      }
    },
  })

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0)
  }

  const handleScrub = (e) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
    setProgress(pct * 100)
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  const isLoading = requestMutation.isPending || !!jobId

  if (!audioUrl) {
    return (
      <button
        type="button"
        onClick={() => requestMutation.mutate()}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-700 font-medium px-3 py-2 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
          </svg>
        )}
        {isLoading ? 'Generating audio…' : 'Listen'}
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3">
        {/* Play/pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 transition-colors"
        >
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div className="flex-1 flex flex-col gap-0.5">
          <div
            className="h-1.5 bg-gray-200 rounded-full cursor-pointer"
            onClick={handleScrub}
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>{fmt(audioRef.current?.currentTime || 0)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                speed === s ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Download */}
        <a
          href={audioUrl}
          download={`elim-audio.mp3`}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
