import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthProvider'
import { fetchAdminMe } from '@/lib/adminApi'

export default function RequireAdmin({ children }) {
  const { isAuthenticated, loading, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!supabaseConfigured || !isAuthenticated) {
      navigate('/login?next=/admin', { replace: true })
      return
    }

    let cancelled = false
    ;(async () => {
      setChecking(true)
      try {
        const me = await fetchAdminMe()
        if (!cancelled) {
          setIsAdmin(!!me.isAdmin)
          if (!me.isAdmin) setError('Your account is not on the admin list.')
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, isAuthenticated, supabaseConfigured, navigate])

  if (loading || checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F5F1] text-stone-400">
        Checking admin access…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F7F5F1] px-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Admin</p>
        <p className="max-w-sm text-sm text-stone-600">{error || 'Access denied'}</p>
        <p className="max-w-sm text-xs text-stone-400">
          Add your email to <code className="text-stone-600">app_admins</code> in Supabase (see
          migration), then refresh.
        </p>
        <Link to="/" className="text-sm text-stone-800 underline underline-offset-4">
          Back to Companion
        </Link>
      </div>
    )
  }

  return children
}
