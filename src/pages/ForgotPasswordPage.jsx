import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthShell, {
  AuthError,
  AuthField,
  AuthLink,
  AuthSubmitButton,
  AuthSuccess,
} from '@/components/auth/AuthShell'
import { authErrorMessage, sendPasswordResetEmail } from '@/lib/auth'
import { getAuthBranding } from '@/lib/authBranding'
import { useAuth } from '@/contexts/AuthProvider'

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const { supabaseConfigured } = useAuth()
  const branding = getAuthBranding()
  const next = searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabaseConfigured) {
      setError('Database not configured')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await sendPasswordResetEmail(email.trim())
      setSuccess('If an account exists for that email, a reset link is on its way.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We will email you a link to reset your password."
      theme={branding.theme}
      backHref={branding.backHref}
      backLabel={branding.backLabel}
      appName={branding.appName}
      footer={
        <AuthLink to={`/login?next=${encodeURIComponent(next)}`} theme={branding.theme}>
          Back to sign in
        </AuthLink>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          theme={branding.theme}
        />
        <AuthError message={error} theme={branding.theme} />
        <AuthSuccess message={success} />
        <AuthSubmitButton loading={loading} theme={branding.theme}>
          Send reset link
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}
