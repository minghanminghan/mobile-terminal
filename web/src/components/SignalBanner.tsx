import { useState, useEffect, useRef } from 'react'

interface Signal {
  type: 'stop' | 'notify' | string
  tool?: string
  message?: string
}

export default function SignalBanner() {
  const [signal, setSignal] = useState<Signal | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent<Signal>).detail
      if (timerRef.current) clearTimeout(timerRef.current)
      setSignal(detail)
      timerRef.current = setTimeout(() => setSignal(null), 5000)
    }

    window.addEventListener('CC_SIGNAL', handle)
    return () => {
      window.removeEventListener('CC_SIGNAL', handle)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!signal) return null

  const isStop = signal.type === 'stop'
  const toolLabel = signal.tool ? ` · ${signal.tool}` : ''

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-sm font-medium z-40 shrink-0 ${
        isStop
          ? 'bg-emerald-900/80 text-emerald-200 border-b border-emerald-800'
          : 'bg-blue-900/80 text-blue-200 border-b border-blue-800'
      }`}
    >
      {/* Icon */}
      {isStop ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )}

      {/* Message */}
      <span className="flex-1">
        {isStop
          ? `Task complete${toolLabel}`
          : signal.message ?? `Notification${toolLabel}`}
      </span>

      {/* Dismiss */}
      <button
        onClick={() => setSignal(null)}
        className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
