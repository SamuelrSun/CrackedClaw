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
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="border border-[rgba(58,58,56,0.2)] bg-white p-8">
          <h2 className="font-mono text-sm text-[#1A3C2B] uppercase tracking-wider mb-4">
            Something went wrong
          </h2>
          <p className="text-[#3A3A38] text-sm mb-6">
            {error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={reset}
            className="w-full bg-[#1A3C2B] text-white font-mono text-sm py-3 px-4 hover:bg-[#2A4C3B] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
