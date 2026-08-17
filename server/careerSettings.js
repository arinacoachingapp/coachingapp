import { requireAuthUser } from './auth.js'
import { resolveRuntimeConfig } from './settings/settingsStore.js'

/** Authenticated users: public-facing defaults (e.g. default narrator voice). */
export async function handleCareerSettings({ authorization, env }) {
  try {
    const { supabase } = await requireAuthUser(authorization, env)
    const config = await resolveRuntimeConfig(supabase, env)
    return {
      status: 200,
      body: {
        defaultVoiceId: config.defaultVoiceId,
      },
    }
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message } }
  }
}
