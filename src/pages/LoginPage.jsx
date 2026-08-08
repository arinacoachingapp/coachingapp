import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell, {
  AuthError,
  AuthField,
  AuthLink,
  AuthSubmitButton,
} from '@/components/auth/AuthShell'
import { authErrorMessage, signInWithPassword } from '@/lib/auth'
import { getAuthBranding } from '@/lib/authBranding'
import { useAuth } from '@/contexts/AuthProvider'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { supabaseConfigured } = useAuth()
  const branding = getAuthBranding()
  const next = searchParams.get('next') || branding.defaultNext
  const urlError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabaseConfigured) {
      setError('Database not configured')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signInWithPassword(email.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={branding.loginSubtitle}
      theme={branding.theme}
      backHref={branding.backHref}
      backLabel={branding.backLabel}
      appName={branding.appName}
      footer={
        <p>
          No account?{' '}
          <AuthLink to={`/register?next=${encodeURIComponent(next)}`} theme={branding.theme}>
            Create one
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
            autoComplete="current-password"
            theme={branding.theme}
          />
        </div>
        <p className="mt-4 text-right">
          <AuthLink to="/forgot-password" theme={branding.theme}>
            Forgot password?
          </AuthLink>
        </p>
        <AuthError
          theme={branding.theme}
          message={
            error ||
            (urlError === 'confirm'
              ? 'Email confirmation link expired or invalid. Try signing in or register again.'
              : urlError === 'config'
                ? 'Auth is not configured on the server.'
                : '')
          }
        />
        <AuthSubmitButton loading={loading} theme={branding.theme}>
          Sign in
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}
