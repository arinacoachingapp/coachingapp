import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (!supabase) {
        navigate('/login?error=config', { replace: true })
        return
      }

      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/'

      if (!code) {
        navigate('/login', { replace: true })
        return
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError(exchangeError.message)
        navigate('/login?error=confirm', { replace: true })
        return
      }

      navigate(next, { replace: true })
    }

    run()
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F7F5F1] text-stone-500">
      {error || 'Confirming your account…'}
    </div>
  )
}
