import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell, {
  AuthError,
  AuthField,
  AuthLink,
  AuthSubmitButton,
  AuthSuccess,
} from '@/components/auth/AuthShell'
import { authErrorMessage, signUpWithPassword } from '@/lib/auth'
import { getAuthBranding } from '@/lib/authBranding'
import { useAuth } from '@/contexts/AuthProvider'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { supabaseConfigured } = useAuth()
  const branding = getAuthBranding()
  const next = searchParams.get('next') || branding.defaultNext

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabaseConfigured) {
      setError('Database not configured')
      return
    }
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
      const { session, user } = await signUpWithPassword(email.trim(), password)

      if (session) {
        navigate(next, { replace: true })
        return
      }

      if (user && !user.confirmed_at) {
        setSuccess('Account created. Check your email for a confirmation link, then sign in.')
        return
      }

      setSuccess('Account created. You can sign in now.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle={branding.registerSubtitle}
      theme={branding.theme}
      backHref={branding.backHref}
      backLabel={branding.backLabel}
      appName={branding.appName}
      footer={
        <p>
          Already have an account?{' '}
          <AuthLink to={`/login?next=${encodeURIComponent(next)}`} theme={branding.theme}>
            Sign in
          </AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          <AuthField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            theme={branding.theme}
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            theme={branding.theme}
          />
          <AuthField
            id="confirmPassword"
            label="Confirm password"
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
          Create account
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}
