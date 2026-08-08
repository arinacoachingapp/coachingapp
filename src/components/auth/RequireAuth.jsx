import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthProvider'

export default function RequireAuth({
  children,
  message = 'Sign in to use Career Companion and save your reflections.',
}) {
  const { isAuthenticated, loading, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!supabaseConfigured) return
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true })
    }
  }, [isAuthenticated, loading, supabaseConfigured, location.pathname, navigate])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F5F1] text-stone-400">
        Loading…
      </div>
    )
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F5F1] px-4 text-center text-red-600">
        Database not configured
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#F7F5F1] px-6 text-center text-stone-800">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
          Career Companion
        </p>
        <p className="max-w-sm text-base leading-relaxed text-stone-600">{message}</p>
        <Link
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
          className="text-sm font-medium text-stone-900 underline decoration-stone-300 underline-offset-4"
        >
          Sign in →
        </Link>
      </div>
    )
  }

  return children
}
