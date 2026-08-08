import { useCallback, useEffect, useState } from 'react';
import { useSpeechRecognition, useSpeechSynthesis } from '../lib/voice';
import { progressPercent } from '../lib/questions';

export default function InterviewView({
  step,
  content,
  savedAnswer,
  inputMode,
  readAloud,
  saving,
  onSubmitAnswer,
  onContinue,
  isMessage,
  isAwaitingRoleCard = false,
}) {
  const [answer, setAnswer] = useState(savedAnswer || '');
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => {
    setAnswer(savedAnswer || '');
    setVoiceError('');
  }, [step, savedAnswer]);

  const { speak, stop: stopSpeaking, speaking, supported: ttsSupported } = useSpeechSynthesis();

  const handleVoiceResult = useCallback((text) => {
    setAnswer(text);
  }, []);

  const handleVoiceError = useCallback((msg) => {
    setVoiceError(msg);
  }, []);

  const { listening, supported: sttSupported, start: startListening, stop: stopListening } =
    useSpeechRecognition({
      onResult: handleVoiceResult,
      onError: handleVoiceError,
    });

  useEffect(() => {
    if (readAloud && ttsSupported && content?.text) {
      const timer = setTimeout(() => speak(content.text), 300);
      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    }
    stopSpeaking();
    return undefined;
  }, [step, content?.text, readAloud, ttsSupported, speak, stopSpeaking]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  const toggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isMessage) {
      onContinue();
      return;
    }
    if (!answer.trim()) return;
    stopListening();
    onSubmitAnswer(answer.trim());
  };

  const percent = progressPercent(step);
  const stepLabel = isMessage
    ? step === 0
      ? 'Introduction'
      : 'Finishing'
    : `Question ${content?.number ?? ''} of 22`;

  const handleContinueClick = () => {
    if (isMessage) {
      onContinue();
      return;
    }
    if (!answer.trim()) return;
    stopListening();
    onSubmitAnswer(answer.trim());
  };

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
            {content?.text}
          </p>
        </blockquote>

        {readAloud && ttsSupported && (
          <button
            type="button"
            onClick={() => (speaking ? stopSpeaking() : speak(content?.text))}
            className="mt-5 text-xs font-medium uppercase tracking-[0.15em] text-stone-400 transition-colors hover:text-stone-700"
          >
            {speaking ? 'Stop reading' : 'Read aloud'}
          </button>
        )}

        {!isMessage && (
          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
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
                disabled={saving}
              />
            </label>

            {inputMode === 'voice' && sttSupported && (
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={saving}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all disabled:opacity-50 ${
                    listening
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                  }`}
                  aria-label={listening ? 'Stop recording' : 'Start recording'}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider">
                    {listening ? 'Stop' : 'Speak'}
                  </span>
                </button>
                <p className="text-xs text-stone-400">
                  {listening ? 'Listening…' : 'Tap to use your voice'}
                </p>
              </div>
            )}

            {inputMode === 'voice' && !sttSupported && (
              <p className="text-center text-xs text-stone-500">
                Voice input isn&apos;t available in this browser — please type your answer.
              </p>
            )}

            {voiceError && (
              <p className="text-center text-xs text-red-600">{voiceError}</p>
            )}
          </form>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-stone-200/80 bg-[#F7F5F1]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={handleContinueClick}
          disabled={saving || (!isMessage && !answer.trim())}
          className="w-full rounded-sm bg-stone-900 py-4 text-sm font-medium tracking-wide text-[#F7F5F1] transition-colors hover:bg-stone-800 disabled:opacity-40"
        >
          {saving && isAwaitingRoleCard
            ? 'Generating…'
            : saving
            ? 'Saving…'
            : isMessage
              ? step === 0
                ? "I'm ready"
                : isAwaitingRoleCard
                  ? 'Generate my role card'
                  : 'Create my role card'
              : 'Continue'}
        </button>
      </div>
    </div>
  );
}
