import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessToken } from './careerDb'

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
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)
  const speakIdRef = useRef(0)
  const abortRef = useRef(null)
  const cacheRef = useRef(new Map())
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const supported = true // always — browser fallback or ElevenLabs

  const stopPlayback = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      const audio = audioRef.current
      audio.onerror = null
      audio.onended = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    // Invalidate any in-flight speak() so stale onerror/onended cannot start browser TTS
    speakIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    stopPlayback()
    setLoading(false)
    setSpeaking(false)
  }, [stopPlayback])

  const playBlob = useCallback(
    async (blob, speakId) => {
      if (speakId !== speakIdRef.current) return false
      stopPlayback()
      if (speakId !== speakIdRef.current) return false

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        if (speakId !== speakIdRef.current) return
        setSpeaking(false)
        setLoading(false)
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
      }

      // Do NOT fall back to browser on element errors after a successful
      // ElevenLabs response — that races with stop()/re-speak and doubles audio.
      audio.onerror = () => {
        if (speakId !== speakIdRef.current) return
        setSpeaking(false)
        setLoading(false)
      }

      setLoading(false)
      setSpeaking(true)
      try {
        await audio.play()
        return true
      } catch {
        return false
      }
    },
    [stopPlayback]
  )

  const speak = useCallback(
    async (text, options = {}) => {
      if (!text?.trim()) return

      abortRef.current?.abort()
      speakIdRef.current += 1
      const speakId = speakIdRef.current
      stopPlayback()

      const isStale = () => speakId !== speakIdRef.current

      const playBrowser = async () => {
        if (isStale()) return
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }
        setLoading(false)
        setSpeaking(true)
        await speakWithBrowser(text)
        if (!isStale()) setSpeaking(false)
      }

      const key = audioCacheKey(text, options.voiceId)
      const cached = cacheRef.current.get(key)
      if (cached) {
        const played = await playBlob(cached, speakId)
        if (played || isStale()) return
        await playBrowser()
        return
      }

      setSpeaking(true)
      setLoading(true)

      try {
        const token = await getAccessToken()
        if (isStale()) return

        const payload = { text }
        if (options.voiceId) payload.voiceId = options.voiceId

        const controller = new AbortController()
        abortRef.current = controller

        const res = await fetch('/api/career/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (isStale()) return

        const contentType = res.headers.get('content-type') || ''
        if (res.ok && contentType.includes('audio')) {
          const blob = await res.blob()
          if (isStale()) return
          rememberBlob(cacheRef.current, key, blob)
          const played = await playBlob(blob, speakId)
          if (played || isStale()) return
          await playBrowser()
          return
        }

        // API missing key, 5xx, or non-audio JSON → intentional browser fallback
        await playBrowser()
      } catch (error) {
        if (error?.name === 'AbortError' || isStale()) return
        await playBrowser()
      }
    },
    [playBlob, stopPlayback]
  )

  useEffect(() => () => stop(), [stop])

  return { speaking, loading, supported, speak, stop }
}
