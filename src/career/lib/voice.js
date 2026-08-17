import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSharedAudio,
  playBlobOnSharedAudio,
  stopSharedAudio,
  unlockAudioFromUserGesture,
} from './audioPlayback'
import { getAccessToken } from './careerDb'

export { unlockAudioFromUserGesture, isAudioUnlocked, attachAudioUnlockListeners } from './audioPlayback'

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function isMediaRecorderSupported() {
  if (typeof window === 'undefined') return false
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false
  return !!window.speechSynthesis
}

function pickRecorderMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

function formatFromMime(mime) {
  if (!mime) return 'webm'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read audio'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Record microphone audio, then transcribe via OpenRouter Whisper for punctuated text.
 * Falls back to browser SpeechRecognition if MediaRecorder is unavailable.
 */
export function useSpeechRecognition({ onResult, onError, lang = 'en-US' } = {}) {
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [supported, setSupported] = useState(false)
  const [mode, setMode] = useState('none') // whisper | browser | none

  useEffect(() => {
    if (isMediaRecorderSupported()) {
      setSupported(true)
      setMode('whisper')
    } else if (isSpeechRecognitionSupported()) {
      setSupported(true)
      setMode('browser')
    } else {
      setSupported(false)
      setMode('none')
    }
  }, [])

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const stopBrowserRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      cleanupStream()
      setListening(false)
    }
    stopBrowserRecognition()
  }, [cleanupStream, stopBrowserRecognition])

  const startBrowserFallback = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      onError?.('Voice input is not supported in this browser. Try Chrome or Safari.')
      return
    }

    stopBrowserRecognition()

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.interimResults = true
    recognition.continuous = true

    let finalTranscript = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += text
        else interim += text
      }
      onResult?.(finalTranscript + interim, finalTranscript)
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        onError?.(event.error === 'not-allowed' ? 'Microphone permission denied' : event.error)
      }
      setListening(false)
    }

    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [lang, onError, onResult, stopBrowserRecognition])

  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        onError?.('Recording failed')
        cleanupStream()
        setListening(false)
      }

      recorder.onstop = async () => {
        setListening(false)
        const usedMime = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: usedMime })
        chunksRef.current = []
        cleanupStream()
        mediaRecorderRef.current = null

        if (!blob.size) {
          onError?.('No audio captured — try again')
          return
        }

        setTranscribing(true)
        try {
          const audioBase64 = await blobToBase64(blob)
          const token = await getAccessToken()
          const res = await fetch('/api/career/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              audioBase64,
              format: formatFromMime(usedMime),
              language: lang.slice(0, 2),
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || 'Transcription failed')
          const text = (data.text || '').trim()
          if (!text) throw new Error('No speech detected — try again')
          onResult?.(text, text)
        } catch (error) {
          onError?.(error.message || 'Transcription failed')
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start(250)
      setListening(true)
    } catch (error) {
      cleanupStream()
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        onError?.('Microphone permission denied')
      } else {
        // Fall back to browser recognition
        setMode('browser')
        startBrowserFallback()
      }
    }
  }, [cleanupStream, lang, onError, onResult, startBrowserFallback])

  const start = useCallback(() => {
    if (mode === 'whisper' || (mode === 'none' && isMediaRecorderSupported())) {
      startWhisperRecording()
      return
    }
    startBrowserFallback()
  }, [mode, startBrowserFallback, startWhisperRecording])

  useEffect(
    () => () => {
      stop()
      cleanupStream()
    },
    [stop, cleanupStream]
  )

  return {
    listening,
    transcribing,
    supported,
    mode,
    start,
    stop,
  }
}

function speakWithBrowser(text, { rate = 0.95, pitch = 1 } = {}) {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.lang = 'en-US'

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
      voices.find((v) => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.onend = () => resolve(true)
    utterance.onerror = () => resolve(false)
    window.speechSynthesis.speak(utterance)
  })
}

const MAX_AUDIO_CACHE = 12

function audioCacheKey(text, voiceId) {
  return `${voiceId || ''}::${text}`
}

function rememberBlob(cache, key, blob) {
  cache.delete(key)
  cache.set(key, blob)
  while (cache.size > MAX_AUDIO_CACHE) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

/**
 * Prefer ElevenLabs neural TTS; fall back to browser speechSynthesis
 * only when ElevenLabs is unavailable or the API request fails.
 */
export function useSpeechSynthesis() {
  const speakIdRef = useRef(0)
  const abortRef = useRef(null)
  const cacheRef = useRef(new Map())
  const pendingRef = useRef(null)
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const supported = true // always — browser fallback or ElevenLabs

  const clearPending = useCallback(() => {
    pendingRef.current = null
    setPlaybackBlocked(false)
  }, [])

  const markBlocked = useCallback((text, voiceId) => {
    pendingRef.current = { text, voiceId }
    setPlaybackBlocked(true)
    setSpeaking(false)
    setLoading(false)
  }, [])

  const stopPlayback = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    stopSharedAudio()
  }, [])

  const stop = useCallback(() => {
    speakIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    stopPlayback()
    setLoading(false)
    setSpeaking(false)
    clearPending()
  }, [clearPending, stopPlayback])

  const playBlob = useCallback(
    async (blob, speakId) => {
      if (speakId !== speakIdRef.current) return { ok: false, blocked: false }

      setLoading(false)
      setSpeaking(true)

      const result = await playBlobOnSharedAudio(blob)
      if (speakId !== speakIdRef.current) return result

      if (result.ok) {
        clearPending()
        setSpeaking(false)
        return result
      }

      if (result.blocked) {
        return result
      }

      setSpeaking(false)
      return result
    },
    [clearPending]
  )

  const fetchAndCacheBlob = useCallback(async (text, voiceId, speakId, signal) => {
    const key = audioCacheKey(text, voiceId)
    const cached = cacheRef.current.get(key)
    if (cached) return cached

    const token = await getAccessToken()
    if (speakId !== speakIdRef.current) return null

    const payload = { text }
    if (voiceId) payload.voiceId = voiceId

    const res = await fetch('/api/career/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal,
    })
    if (speakId !== speakIdRef.current) return null

    const contentType = res.headers.get('content-type') || ''
    if (res.ok && contentType.includes('audio')) {
      const blob = await res.blob()
      if (speakId !== speakIdRef.current) return null
      rememberBlob(cacheRef.current, key, blob)
      return blob
    }
    return null
  }, [])

  /** Warm the TTS cache without playing — useful while the user reads the prompt. */
  const prefetch = useCallback(
    (text, options = {}) => {
      if (!text?.trim()) return
      const key = audioCacheKey(text, options.voiceId)
      if (cacheRef.current.has(key)) return

      const speakId = speakIdRef.current
      const controller = new AbortController()
      fetchAndCacheBlob(text, options.voiceId, speakId, controller.signal).catch(() => {})
    },
    [fetchAndCacheBlob]
  )

  const speak = useCallback(
    async (text, options = {}) => {
      if (!text?.trim()) return false

      abortRef.current?.abort()
      speakIdRef.current += 1
      const speakId = speakIdRef.current
      stopPlayback()
      clearPending()

      const isStale = () => speakId !== speakIdRef.current
      const voiceId = options.voiceId

      const playBrowser = async () => {
        if (isStale()) return false
        unlockAudioFromUserGesture()
        getSharedAudio()
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }
        setLoading(false)
        setSpeaking(true)
        await speakWithBrowser(text)
        if (!isStale()) {
          setSpeaking(false)
          clearPending()
        }
        return true
      }

      const key = audioCacheKey(text, voiceId)
      let blob = cacheRef.current.get(key)

      if (!blob) {
        setSpeaking(true)
        setLoading(true)
        try {
          const controller = new AbortController()
          abortRef.current = controller
          blob = await fetchAndCacheBlob(text, voiceId, speakId, controller.signal)
        } catch (error) {
          if (error?.name === 'AbortError' || isStale()) return false
          return playBrowser()
        }
      }

      if (isStale()) return false

      if (blob) {
        const result = await playBlob(blob, speakId)
        if (isStale()) return false
        if (result.ok) return true
        if (result.blocked) {
          markBlocked(text, voiceId)
          return false
        }
        return playBrowser()
      }

      return playBrowser()
    },
    [clearPending, fetchAndCacheBlob, markBlocked, playBlob, stopPlayback]
  )

  const retryPlayback = useCallback(async () => {
    unlockAudioFromUserGesture()
    const pending = pendingRef.current
    if (!pending) return false
    setPlaybackBlocked(false)
    pendingRef.current = null
    return speak(pending.text, { voiceId: pending.voiceId })
  }, [speak])

  useEffect(() => {
    getSharedAudio()
    return () => stop()
  }, [stop])

  return {
    speaking,
    loading,
    playbackBlocked,
    supported,
    speak,
    prefetch,
    retryPlayback,
    stop,
  }
}
