/** Minimal silent WAV — unlocks HTMLAudioElement on iOS/Android during a user gesture. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='

let sharedAudio = null
let unlocked = false
let activeObjectUrl = null
let listenersAttached = false

/** Unlock on the first tap/click anywhere — helps mobile autoplay after async TTS fetch. */
export function attachAudioUnlockListeners() {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true

  const onGesture = () => {
    unlockAudioFromUserGesture()
  }

  window.addEventListener('touchstart', onGesture, { passive: true, capture: true })
  window.addEventListener('touchend', onGesture, { passive: true, capture: true })
  window.addEventListener('click', onGesture, { capture: true })
}

function revokeActiveUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

/** Persistent in-DOM audio element — required for reliable iOS playback after unlock. */
export function getSharedAudio() {
  if (typeof window === 'undefined') return null
  if (!sharedAudio) {
    sharedAudio = document.createElement('audio')
    sharedAudio.playsInline = true
    sharedAudio.setAttribute('playsinline', 'true')
    sharedAudio.setAttribute('webkit-playsinline', 'true')
    sharedAudio.preload = 'auto'
    sharedAudio.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none'
    document.body.appendChild(sharedAudio)
  }
  return sharedAudio
}

/** Call synchronously at the start of click/touch handlers — before any await. */
export function unlockAudioFromUserGesture() {
  const audio = getSharedAudio()
  if (!audio) return false

  try {
    if (!unlocked) {
      audio.src = SILENT_WAV
      audio.volume = 0.001
      const playAttempt = audio.play()
      if (playAttempt?.catch) playAttempt.catch(() => {})
      audio.pause()
      audio.currentTime = 0
      unlocked = true
    }
    return true
  } catch {
    return false
  }
}

export function isAudioUnlocked() {
  return unlocked
}

export function stopSharedAudio() {
  const audio = getSharedAudio()
  if (!audio) return
  audio.onended = null
  audio.onerror = null
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // ignore
  }
}

/**
 * Play an audio blob on the shared element.
 * Returns { ok, blocked } — blocked=true when autoplay policy rejected play().
 */
export function playBlobOnSharedAudio(blob) {
  const audio = getSharedAudio()
  if (!audio) return Promise.resolve({ ok: false, blocked: false })

  stopSharedAudio()
  revokeActiveUrl()

  const url = URL.createObjectURL(blob)
  activeObjectUrl = url

  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    audio.onended = () => {
      audio.onended = null
      audio.onerror = null
      revokeActiveUrl()
      finish({ ok: true, blocked: false })
    }

    audio.onerror = () => {
      audio.onended = null
      audio.onerror = null
      revokeActiveUrl()
      finish({ ok: false, blocked: false })
    }

    audio.src = url
    audio.volume = 1
    audio.load()

    const playAttempt = audio.play()
    if (!playAttempt) return

    playAttempt.catch((error) => {
        audio.onended = null
        audio.onerror = null
        revokeActiveUrl()
        const blocked =
          error?.name === 'NotAllowedError' ||
          error?.name === 'NotSupportedError' ||
          /gesture|interaction|autoplay/i.test(String(error?.message || ''))
        finish({ ok: false, blocked })
      })
  })
}
