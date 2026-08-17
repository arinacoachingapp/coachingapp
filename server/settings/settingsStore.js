import {
  DEFAULT_SETTINGS,
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  isAllowedSettingValue,
} from './catalog.js'

const CACHE_TTL_MS = 15_000
let cache = { at: 0, values: null }

function invalidateCache() {
  cache = { at: 0, values: null }
}

export async function listSettings(userSupabase) {
  const { data, error } = await userSupabase.from('app_settings').select('*').order('key')
  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
        key,
        value,
        updated_at: null,
        updated_by_email: null,
        from_defaults: true,
      }))
    }
    throw error
  }

  const byKey = Object.fromEntries((data || []).map((row) => [row.key, row]))
  return SETTING_DEFINITIONS.map((def) => {
    const row = byKey[def.key]
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      options: def.options,
      value: row?.value ?? DEFAULT_SETTINGS[def.key],
      updated_at: row?.updated_at ?? null,
      updated_by_email: row?.updated_by_email ?? null,
      from_defaults: !row,
    }
  })
}

export async function getSettingsMap(userSupabase) {
  const now = Date.now()
  if (cache.values && now - cache.at < CACHE_TTL_MS) {
    return cache.values
  }

  const values = { ...DEFAULT_SETTINGS }
  try {
    const { data, error } = await userSupabase.from('app_settings').select('key, value')
    if (!error && data) {
      for (const row of data) {
        if (isAllowedSettingValue(row.key, row.value)) {
          values[row.key] = row.value
        }
      }
    }
  } catch (error) {
    console.warn('Settings load failed, using defaults:', error.message)
  }

  cache = { at: now, values }
  return values
}

/**
 * Resolve runtime config: DB settings override env, then catalog defaults.
 */
export async function resolveRuntimeConfig(userSupabase, env = {}) {
  const settings = await getSettingsMap(userSupabase)
  return {
    openrouterModel:
      settings[SETTING_KEYS.OPENROUTER_MODEL] ||
      env.OPENROUTER_MODEL ||
      DEFAULT_SETTINGS[SETTING_KEYS.OPENROUTER_MODEL],
    elevenlabsModelId:
      settings[SETTING_KEYS.ELEVENLABS_MODEL_ID] ||
      env.ELEVENLABS_MODEL_ID ||
      DEFAULT_SETTINGS[SETTING_KEYS.ELEVENLABS_MODEL_ID],
    defaultVoiceId:
      settings[SETTING_KEYS.DEFAULT_VOICE_ID] ||
      env.ELEVENLABS_VOICE_ID ||
      DEFAULT_SETTINGS[SETTING_KEYS.DEFAULT_VOICE_ID],
  }
}

export async function saveSettings(userSupabase, { settings, email }) {
  if (!settings || typeof settings !== 'object') {
    const err = new Error('settings object required')
    err.status = 400
    throw err
  }

  const updates = []
  for (const def of SETTING_DEFINITIONS) {
    if (!(def.key in settings)) continue
    const value = String(settings[def.key] || '').trim()
    if (!isAllowedSettingValue(def.key, value)) {
      const err = new Error(`Invalid value for ${def.key}`)
      err.status = 400
      throw err
    }
    updates.push({
      key: def.key,
      value,
      updated_at: new Date().toISOString(),
      updated_by_email: email,
    })
  }

  if (!updates.length) {
    const err = new Error('No valid settings to save')
    err.status = 400
    throw err
  }

  const { error } = await userSupabase.from('app_settings').upsert(updates, { onConflict: 'key' })
  if (error) throw error

  invalidateCache()
  return listSettings(userSupabase)
}
