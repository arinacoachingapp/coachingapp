import { createClient } from '@supabase/supabase-js'

export function getUserSupabase(accessToken, env) {
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export async function requireAuthUser(authorization, env) {
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')
  if (!accessToken) {
    const err = new Error('Authentication required')
    err.status = 401
    throw err
  }
  const supabase = getUserSupabase(accessToken, env)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    const err = new Error('Invalid session')
    err.status = 401
    throw err
  }
  return { user, supabase, accessToken }
}
