import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudioFromUserGesture, useSpeechRecognition, useSpeechSynthesis } from '../lib/voice'
import { PHASES, sectionLabel } from '../lib/questions'

export default function InterviewView({
  phase,
  utterance,
  progress,
  names = [],
  inputMode,
  readAloud,
  voiceId,
  saving,
  onSubmitAnswer,
  onContinueOpening,
  onConfirmNames,
  onGenerateCard,
  isAwaitingRoleCard = false,
}) {
  const [answer, setAnswer] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [editableNames, setEditableNames] = useState(names)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    setAnswer('')
    setVoiceError('')
  }, [utterance, phase])

  useEffect(() => {
    setEditableNames(names || [])
  }, [names])

  const {
    speak,
    prefetch,
    retryPlayback,
    stop: stopSpeaking,
    speaking,
    loading: voiceLoading,
    playbackBlocked,
    error: ttsError,
    supported: ttsSupported,
  } = useSpeechSynthesis()
  const speakRef = useRef(speak)
  const prefetchRef = useRef(prefetch)
  const stopSpeakingRef = useRef(stopSpeaking)
  const voiceIdRef = useRef(voiceId)
  const spokenUtteranceRef = useRef(null)
  speakRef.current = speak
  prefetchRef.current = prefetch
  stopSpeakingRef.current = stopSpeaking
  voiceIdRef.current = voiceId

  const speakUtterance = useCallback(
    async (text) => {
      if (!text?.trim()) return false
      spokenUtteranceRef.current = text
      unlockAudioFromUserGesture()
      return speak(text, { voiceId: voiceIdRef.current })
    },
    [speak]
  )

  const maybeSpeakAfterTurn = useCallback(
    async (data) => {
      if (!readAloud || !data?.utterance) return
      await speakUtterance(data.utterance)
    },
    [readAloud, speakUtterance]
  )

  const handleVoiceResult = useCallback((text) => {
    setAnswer(text)
  }, [])

  const handleVoiceError = useCallback((msg) => {
    setVoiceError(msg)
  }, [])

  const { listening, transcribing, supported: sttSupported, start: startListening, stop: stopListening } =
    useSpeechRecognition({
      onResult: handleVoiceResult,
      onError: handleVoiceError,
    })

  useEffect(() => {
    if (readAloud && utterance) {
      prefetchRef.current(utterance, { voiceId: voiceIdRef.current })
    }
  }, [utterance, readAloud, voiceId])

  useEffect(() => {
    if (!readAloud || !ttsSupported || !utterance) {
      stopSpeakingRef.current()
      return undefined
    }
    if (spokenUtteranceRef.current === utterance) {
      spokenUtteranceRef.current = null
      return undefined
    }

    const timer = setTimeout(() => {
      if (spokenUtteranceRef.current === utterance) return
      speakRef.current(utterance, { voiceId: voiceIdRef.current }).then((played) => {
        if (played) spokenUtteranceRef.current = utterance
      })
    }, 200)

    return () => {
      clearTimeout(timer)
    }
  }, [utterance, phase, readAloud, ttsSupported])

  useEffect(() => {
    return () => {
      stopListening()
      stopSpeakingRef.current()
    }
  }, [stopListening])

  const toggleMic = () => {
    unlockAudioFromUserGesture()
    if (listening || transcribing) stopListening()
    else {
      stopSpeaking()
      startListening()
    }
  }

  const handleTapToHear = () => {
    unlockAudioFromUserGesture()
    if (playbackBlocked) {
      retryPlayback()
      return
    }
    speakUtterance(utterance)
  }

  const percent = progress?.percent ?? 0
  const stepLabel =
    phase === PHASES.OPENING
      ? 'Introduction'
      : phase === PHASES.NAME_CONFIRM
        ? 'Names'
        : isAwaitingRoleCard || phase === PHASES.READY_FOR_CARD
          ? 'Finishing'
          : progress?.section_label || sectionLabel(progress?.section) || 'Interview'

  const handlePrimary = async () => {
    unlockAudioFromUserGesture()

    if (phase === PHASES.OPENING) {
      const data = await onContinueOpening()
      await maybeSpeakAfterTurn(data)
      return
    }
    if (phase === PHASES.NAME_CONFIRM) {
      const data = await onConfirmNames(editableNames)
      await maybeSpeakAfterTurn(data)
      return
    }
    if (isAwaitingRoleCard || phase === PHASES.READY_FOR_CARD) {
      onGenerateCard()
      return
    }
    if (!answer.trim()) return
    stopListening()
    const data = await onSubmitAnswer(answer.trim())
    await maybeSpeakAfterTurn(data)
  }

  const removeName = (idx) => {
    setEditableNames((prev) => prev.filter((_, i) => i !== idx))
  }

  const addName = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setEditableNames((prev) => [...prev, trimmed])
    setNewName('')
  }

  const showAnswerBox = phase === PHASES.INTERVIEWING

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span className="uppercase tracking-[0.15em]">{stepLabel}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div className="mt-3 h-px bg-stone-200">
          <div
            className="h-px bg-stone-800 transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <blockquote className="border-l-2 border-stone-300 pl-5 sm:pl-6">
          <p className="font-serif text-xl leading-relaxed text-stone-800 sm:text-2xl sm:leading-relaxed">
            {utterance}
          </p>
        </blockquote>

        {readAloud && ttsSupported && playbackBlocked && (
          <button
            type="button"
            onClick={handleTapToHear}
            className="mt-4 w-full rounded-sm border border-stone-300 bg-white px-4 py-3 text-left text-sm text-stone-700 shadow-sm transition-colors hover:border-stone-400 active:bg-stone-50"
          >
            <span className="font-medium">Tap to hear this question</span>
            <span className="mt-0.5 block text-xs text-stone-400">
              Your browser needs a tap to start audio
            </span>
          </button>
        )}

        {readAloud && ttsSupported && (
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={handleTapToHear}
              className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400 transition-colors hover:text-stone-700"
            >
              {voiceLoading ? 'Loading voice…' : speaking ? 'Playing…' : 'Read aloud'}
            </button>
            {(speaking || voiceLoading) && (
              <button
                type="button"
                onClick={() => stopSpeaking()}
                className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400 transition-colors hover:text-stone-700"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {readAloud && ttsError && (
          <p className="mt-3 text-xs text-red-600">{ttsError}</p>
        )}

        {showAnswerBox && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePrimary()
            }}
            className="mt-10 space-y-6"
          >
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400">
                Your answer
              </span>
                <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="Take your time…"
                className="mt-3 w-full resize-none rounded-sm border border-stone-200 bg-white px-4 py-4 font-serif text-base leading-relaxed text-stone-800 placeholder:text-stone-300 outline-none transition-colors focus:border-stone-400"
                disabled={saving || transcribing}
              />
            </label>

            {inputMode === 'voice' && sttSupported && (
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={saving || transcribing}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all disabled:opacity-50 ${
                    listening
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : transcribing
                        ? 'border-stone-300 bg-stone-100 text-stone-500'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                  }`}
                  aria-label={
                    listening ? 'Stop recording' : transcribing ? 'Transcribing' : 'Start recording'
                  }
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider">
                    {listening ? 'Stop' : transcribing ? '…' : 'Speak'}
                  </span>
                </button>
                <p className="text-xs text-stone-400">
                  {listening
                    ? 'Listening… tap stop when finished'
                    : transcribing
                      ? 'Transcribing with punctuation…'
                      : 'Tap to use your voice'}
                </p>
              </div>
            )}

            {inputMode === 'voice' && !sttSupported && (
              <p className="text-center text-xs text-stone-500">
                Voice input isn&apos;t available in this browser — please type your answer.
              </p>
            )}

            {voiceError && <p className="text-center text-xs text-red-600">{voiceError}</p>}
          </form>
        )}

        {phase === PHASES.NAME_CONFIRM && (
          <div className="mt-10 space-y-5">
            <p className="text-sm leading-relaxed text-stone-500">
              Correct spellings if you like — or leave a name as it is. Blank is fine.
            </p>
            <ul className="space-y-2">
              {editableNames.length === 0 && (
                <li className="text-sm text-stone-400">No names were captured — you can add any below.</li>
              )}
              {editableNames.map((name, idx) => (
                <li key={`${name}-${idx}`} className="flex items-center gap-2">
                  <input
                    value={name}
                    onChange={(e) => {
                      const value = e.target.value
                      setEditableNames((prev) => prev.map((n, i) => (i === idx ? value : n)))
                    }}
                    className="min-w-0 flex-1 rounded-sm border border-stone-200 bg-white px-3 py-2 font-serif text-base text-stone-800 outline-none focus:border-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeName(idx)}
                    className="text-xs text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addName()
                  }
                }}
                placeholder="Add a name"
                className="min-w-0 flex-1 rounded-sm border border-stone-200 bg-white px-3 py-2 font-serif text-base text-stone-800 outline-none focus:border-stone-400"
              />
              <button
                type="button"
                onClick={addName}
                className="rounded-sm border border-stone-300 px-3 py-2 text-xs font-medium uppercase tracking-wider text-stone-600 hover:border-stone-400"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-stone-200/80 bg-[#F7F5F1]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={handlePrimary}
          disabled={saving || transcribing || (showAnswerBox && !answer.trim())}
          className="w-full rounded-sm bg-stone-900 py-4 text-sm font-medium tracking-wide text-[#F7F5F1] transition-colors hover:bg-stone-800 disabled:opacity-40"
        >
          {saving && isAwaitingRoleCard
            ? 'Generating…'
            : saving
              ? 'Thinking…'
              : phase === PHASES.OPENING
                ? "I'm ready"
                : phase === PHASES.NAME_CONFIRM
                  ? 'Looks good — continue'
                  : isAwaitingRoleCard || phase === PHASES.READY_FOR_CARD
                    ? 'Generate my role card'
                    : 'Continue'}
        </button>
      </div>
    </div>
  )
}
