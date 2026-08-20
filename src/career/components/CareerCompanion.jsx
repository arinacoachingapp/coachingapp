import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthProvider'
import SessionHome from './SessionHome'
import InterviewView from './InterviewView'
import RoleCardDisplay from './RoleCardDisplay'
import { AnimatedToggle, AnimatedToggleGroup } from './AnimatedToggles'
import {
  createCareerSession,
  listCareerSessions,
  fetchCareerSession,
  markSessionGenerating,
  resetSessionAwaitingGeneration,
  deleteCareerSession,
  needsRoleCardGeneration,
  getAccessToken,
  startInterviewTurn,
  submitInterviewAnswer,
  confirmInterviewNames,
  updateRoleCard,
} from '../lib/careerDb'
import { OPENING, PHASES } from '../lib/questions'
import {
  DEFAULT_INTERVIEW_VOICE_ID,
  INTERVIEW_VOICES,
  VOICE_STORAGE_KEY,
  isAllowedVoiceId,
} from '../lib/voices'
import { fetchCareerSettings } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { unlockAudioFromUserGesture, attachAudioUnlockListeners } from '../lib/voice'

const VIEWS = {
  HOME: 'home',
  INTERVIEW: 'interview',
  GENERATING: 'generating',
  RESULT: 'result',
}

function loadStoredVoiceId() {
  try {
    const stored = localStorage.getItem(VOICE_STORAGE_KEY)
    if (isAllowedVoiceId(stored)) return stored
  } catch {
    // ignore
  }
  return null
}

export default function CareerCompanion() {
  const { signOut } = useAuth()
  const [view, setView] = useState(VIEWS.HOME)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const [phase, setPhase] = useState(PHASES.OPENING)
  const [utterance, setUtterance] = useState(OPENING.text)
  const [progress, setProgress] = useState({ percent: 0 })
  const [names, setNames] = useState([])
  const [roleCard, setRoleCard] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [inputMode, setInputMode] = useState('voice')
  const [readAloud, setReadAloud] = useState(true)
  const [voiceId, setVoiceId] = useState(() => loadStoredVoiceId() || DEFAULT_INTERVIEW_VOICE_ID)
  const [isAdmin, setIsAdmin] = useState(false)

  const handleVoiceChange = (nextId) => {
    if (!isAllowedVoiceId(nextId)) return
    setVoiceId(nextId)
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, nextId)
    } catch {
      // ignore
    }
  }

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const data = await listCareerSessions()
      setSessions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    attachAudioUnlockListeners()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    let cancelled = false
    // Client → Supabase directly (same path as sessions). Avoids Vercel cold start for the Admin link.
    ;(async () => {
      try {
        if (!supabase) {
          if (!cancelled) setIsAdmin(false)
          return
        }
        const { data, error } = await supabase.rpc('is_app_admin')
        if (cancelled) return
        if (error) {
          console.warn('is_app_admin failed:', error.message)
          setIsAdmin(false)
          return
        }
        setIsAdmin(!!data)
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Only apply admin default when the user has never chosen a voice
    if (loadStoredVoiceId()) return
    let cancelled = false
    fetchCareerSettings()
      .then((data) => {
        if (cancelled) return
        if (isAllowedVoiceId(data.defaultVoiceId)) {
          setVoiceId(data.defaultVoiceId)
        }
      })
      .catch(() => {
        // keep Alexandra fallback
      })
    return () => {
      cancelled = true
    }
  }, [])

  const applyTurnPayload = (data) => {
    if (data.utterance) setUtterance(data.utterance)
    if (data.phase) setPhase(data.phase)
    if (data.progress) setProgress(data.progress)
    if (data.names) setNames(data.names)
    if (data.transcript) setTranscript(data.transcript)
  }

  const resetInterviewState = () => {
    setSessionId(null)
    setPhase(PHASES.OPENING)
    setUtterance(OPENING.text)
    setProgress({ percent: 0 })
    setNames([])
    setRoleCard(null)
    setTranscript(null)
    setError('')
  }

  const goHome = async () => {
    resetInterviewState()
    setView(VIEWS.HOME)
    await loadSessions()
  }

  const startNewSession = async () => {
    unlockAudioFromUserGesture()
    setError('')
    setSaving(true)
    try {
      const session = await createCareerSession()
      setSessionId(session.id)
      setPhase(PHASES.OPENING)
      setUtterance(OPENING.text)
      setProgress({ percent: 0 })
      setNames([])
      setRoleCard(null)
      setTranscript(null)
      setView(VIEWS.INTERVIEW)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const loadSession = async (id, mode = VIEWS.INTERVIEW) => {
    unlockAudioFromUserGesture()
    setError('')
    setSaving(true)
    try {
      const { session } = await fetchCareerSession(id)
      setSessionId(session.id)

      if (session.status === 'completed' && session.role_card) {
        setRoleCard(session.role_card)
        setTranscript(session.transcript)
        setView(VIEWS.RESULT)
        return
      }

      const awaitingRoleCard = needsRoleCardGeneration(session)
      if (awaitingRoleCard) {
        if (session.status === 'generating' || session.status === 'failed') {
          await resetSessionAwaitingGeneration(id)
        }
        setPhase(PHASES.READY_FOR_CARD)
        setUtterance(
          session.interview_state?.last_utterance ||
            "Thank you. I'm putting your Role Card together now — it'll be ready in a moment."
        )
        setProgress({ percent: 100 })
        setNames(session.interview_state?.names || [])
        setTranscript(session.transcript)
        setView(VIEWS.INTERVIEW)
        return
      }

      const state = session.interview_state
      if (!state || state.phase === PHASES.OPENING) {
        setPhase(PHASES.OPENING)
        setUtterance(OPENING.text)
        setProgress({ percent: 0 })
        setNames([])
      } else {
        setPhase(state.phase || PHASES.INTERVIEWING)
        setUtterance(state.last_utterance || OPENING.text)
        setNames(state.names || [])
        const done = state.completed_question_ids?.length || 0
        setProgress({
          percent: Math.min(99, Math.round((done / 21) * 100)),
          section: null,
          section_label: 'Interview',
          question_id: state.current_question_id,
          phase: state.phase,
        })
      }
      setView(mode)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const generateRoleCard = async (id) => {
    setError('')
    setView(VIEWS.GENERATING)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/career/generate-role-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: id }),
      })
      const raw = await res.text()
      let data
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        throw new Error(
          res.ok
            ? 'Role card API returned a non-JSON response'
            : `Role card API unavailable (${res.status}). Check the Vercel function deploy and env vars.`
        )
      }
      if (!res.ok) throw new Error(data.error || 'Failed to generate role card')

      setRoleCard(data.roleCard)
      setTranscript(data.session?.transcript)
      setView(VIEWS.RESULT)
    } catch (err) {
      setError(err.message)
      setView(VIEWS.INTERVIEW)
      setPhase(PHASES.READY_FOR_CARD)
      try {
        await resetSessionAwaitingGeneration(id)
      } catch {
        // UI already shows retry
      }
    }
  }

  const handleContinueOpening = async () => {
    if (!sessionId) return null
    setSaving(true)
    setError('')
    try {
      const data = await startInterviewTurn(sessionId)
      applyTurnPayload(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitAnswer = async (text) => {
    if (!sessionId) return null
    setSaving(true)
    setError('')
    try {
      const data = await submitInterviewAnswer(sessionId, text)
      applyTurnPayload(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmNames = async (confirmedNames) => {
    if (!sessionId) return null
    setSaving(true)
    setError('')
    try {
      const data = await confirmInterviewNames(sessionId, confirmedNames)
      applyTurnPayload(data)
      setPhase(PHASES.READY_FOR_CARD)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateCard = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      await markSessionGenerating(sessionId)
      await generateRoleCard(sessionId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteCareerSession(id)
      if (sessionId === id) resetInterviewState()
      await loadSessions()
      if (view !== VIEWS.HOME) setView(VIEWS.HOME)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const isAwaitingRoleCard = phase === PHASES.READY_FOR_CARD

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F5F1] text-stone-800">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#F7F5F1]/90 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto max-w-xl px-5 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {view !== VIEWS.HOME && (
                <button
                  type="button"
                  onClick={goHome}
                  className="shrink-0 text-xs font-medium uppercase tracking-[0.15em] text-stone-400 transition-colors hover:text-stone-700"
                >
                  ← Back
                </button>
              )}
              <p className="truncate text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
                Career Companion
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="rounded-sm px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 transition-colors hover:text-stone-600 sm:px-2.5"
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                className="rounded-sm px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 transition-colors hover:text-stone-600 sm:px-2.5"
              >
                Sign out
              </button>
            </div>
          </div>

          {view === VIEWS.INTERVIEW && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-stone-200/60 pt-3 sm:justify-end">
              <AnimatedToggle
                checked={readAloud}
                onChange={(next) => {
                  unlockAudioFromUserGesture()
                  setReadAloud(next)
                }}
                labelOn="Audio"
                labelOff="Mute"
              />
              {readAloud && (
                <label className="flex min-w-0 items-center">
                  <span className="sr-only">Narrator voice</span>
                  <select
                    value={voiceId}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="max-w-[9rem] truncate rounded-sm border border-stone-200 bg-white px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-600 outline-none hover:border-stone-300 focus:border-stone-400 sm:max-w-[7.5rem]"
                    aria-label="Narrator voice"
                  >
                    {INTERVIEW_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <AnimatedToggleGroup
                value={inputMode}
                onChange={setInputMode}
                options={[
                  { value: 'voice', label: 'Voice' },
                  { value: 'keyboard', label: 'Type' },
                ]}
              />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="mb-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {view === VIEWS.HOME && (
          <SessionHome
            sessions={sessions}
            loading={loadingSessions}
            onStartNew={startNewSession}
            onResume={(id) => loadSession(id, VIEWS.INTERVIEW)}
            onView={(id) => loadSession(id, VIEWS.RESULT)}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        )}

        {view === VIEWS.INTERVIEW && (
          <InterviewView
            phase={phase}
            utterance={utterance}
            progress={progress}
            names={names}
            inputMode={inputMode}
            readAloud={readAloud}
            voiceId={voiceId}
            saving={saving}
            onSubmitAnswer={handleSubmitAnswer}
            onContinueOpening={handleContinueOpening}
            onConfirmNames={handleConfirmNames}
            onGenerateCard={handleGenerateCard}
            isAwaitingRoleCard={isAwaitingRoleCard}
          />
        )}

        {view === VIEWS.GENERATING && (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
            <div className="h-px w-16 animate-pulse bg-stone-400" />
            <p className="mt-8 font-serif text-2xl text-stone-800">Composing your role card</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-500">
              Shaping your answers into a structured summary — carefully, in your own words.
            </p>
          </div>
        )}

        {view === VIEWS.RESULT && (
          <RoleCardDisplay
            roleCard={roleCard}
            transcript={transcript}
            onStartNew={startNewSession}
            onSave={async (nextCard) => {
              if (!sessionId) return
              await updateRoleCard(sessionId, nextCard)
              setRoleCard(nextCard)
            }}
          />
        )}
      </main>
    </div>
  )
}
