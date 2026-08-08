import { getSiteUrl, supabase } from '@/lib/supabase'

export function requireSupabase() {
  if (!supabase) throw new Error('Database not configured')
  return supabase
}

export async function signInWithPassword(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithPassword(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  })
  if (error) throw error
  return data
}

export async function sendPasswordResetEmail(email) {
  const client = requireSupabase()
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/reset-password`,
  })
  if (error) throw error
  return data
}

export async function updatePassword(newPassword) {
  const client = requireSupabase()
  const { data, error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getCurrentSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

/** True for email/password users; false for anonymous or missing session. */
export function isRegisteredUser(user) {
  if (!user) return false
  if (user.is_anonymous) return false
  return !!user.email
}

export function authErrorMessage(error) {
  if (!error?.message) return 'Something went wrong'
  const msg = error.message
  if (msg.includes('Invalid login credentials')) {
    return 'Incorrect email or password'
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email already exists'
  }
  if (msg.includes('Password should be at least')) {
    return 'Password must be at least 6 characters'
  }
  return msg
}
