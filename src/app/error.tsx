'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="border border-white/[0.1] bg-white/[0.08] backdrop-blur-md p-8">
          <h2 className="font-mono text-sm text-white/80 uppercase tracking-wider mb-4">
            Something went wrong
          </h2>
          <p className="text-white/50 text-sm mb-6">
            {error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={reset}
            className="w-full bg-white/[0.12] text-white font-mono text-sm py-3 px-4 hover:bg-white/[0.2] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
