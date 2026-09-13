'use client'

import { useState } from 'react'
import { Chrome } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setErrorMessage(null)
    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setErrorMessage(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Chrome className="w-4 h-4" />
        {isLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </button>
      {errorMessage && (
        <p className="mt-2 text-center text-xs text-rose-400">{errorMessage}</p>
      )}
    </div>
  )
}
