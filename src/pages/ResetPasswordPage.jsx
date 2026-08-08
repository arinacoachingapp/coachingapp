import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell, {
  AuthError,
  AuthField,
  AuthSubmitButton,
  AuthSuccess,
} from '@/components/auth/AuthShell'
import { authErrorMessage, updatePassword } from '@/lib/auth'
import { getAuthBranding } from '@/lib/authBranding'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const branding = getAuthBranding()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!cancelled && session) {
        setReady(true)
        return
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || session) {
          setReady(true)
        }
      })

      return () => subscription.unsubscribe()
    }

    const cleanupPromise = init()
    return () => {
      cancelled = true
      cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await updatePassword(password)
      setSuccess('Password updated. Redirecting to sign in…')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F7F5F1] px-4 text-center text-stone-800">
        <p className="text-stone-500">Verifying reset link…</p>
        <p className="mt-4 text-sm text-stone-400">
          Link expired?{' '}
          <Link to="/forgot-password" className="text-stone-800 underline underline-offset-2">
            Request a new one
          </Link>
        </p>
      </div>
    )
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Choose a new password for your account"
      theme={branding.theme}
      backHref="/login"
      backLabel="Sign in"
      appName={branding.appName}
      footer={
        <Link
          to="/login"
          className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-4"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AuthField
            id="password"
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            theme={branding.theme}
          />
          <AuthField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            theme={branding.theme}
          />
        </div>
        <AuthError message={error} theme={branding.theme} />
        <AuthSuccess message={success} />
        <AuthSubmitButton loading={loading} theme={branding.theme}>
          Update password
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}
