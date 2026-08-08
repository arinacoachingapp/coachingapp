import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import SessionHome from './SessionHome';
import InterviewView from './InterviewView';
import RoleCardDisplay from './RoleCardDisplay';
import { AnimatedToggle, AnimatedToggleGroup } from './AnimatedToggles';
import {
  createCareerSession,
  listCareerSessions,
  fetchCareerSession,
  saveCareerResponse,
  updateCareerSessionStep,
  markSessionGenerating,
  resetSessionAwaitingGeneration,
  deleteCareerSession,
  computeResumeStep,
  needsRoleCardGeneration,
  responsesToMap,
  getAccessToken,
} from '../lib/careerDb';
import {
  getStepContent,
  STEP_CLOSING,
  STEP_FIRST_QUESTION,
  STEP_OPENING,
  TOTAL_QUESTIONS,
} from '../lib/questions';

const VIEWS = {
  HOME: 'home',
  INTERVIEW: 'interview',
  GENERATING: 'generating',
  RESULT: 'result',
};

export default function CareerCompanion() {
  const { signOut } = useAuth();
  const [view, setView] = useState(VIEWS.HOME);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState(STEP_OPENING);
  const [answers, setAnswers] = useState({});
  const [roleCard, setRoleCard] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [inputMode, setInputMode] = useState('voice');
  const [readAloud, setReadAloud] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await listCareerSessions();
      setSessions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const resetInterviewState = () => {
    setSessionId(null);
    setStep(STEP_OPENING);
    setAnswers({});
    setRoleCard(null);
    setTranscript(null);
    setError('');
  };

  const goHome = async () => {
    resetInterviewState();
    setView(VIEWS.HOME);
    await loadSessions();
  };

  const startNewSession = async () => {
    setError('');
    setSaving(true);
    try {
      const session = await createCareerSession();
      setSessionId(session.id);
      setStep(STEP_OPENING);
      setAnswers({});
      setRoleCard(null);
      setTranscript(null);
      setView(VIEWS.INTERVIEW);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSession = async (id, mode = VIEWS.INTERVIEW) => {
    setError('');
    setSaving(true);
    try {
      const { session, responses } = await fetchCareerSession(id);
      setSessionId(session.id);
      setAnswers(responsesToMap(responses));

      if (session.status === 'completed' && session.role_card) {
        setRoleCard(session.role_card);
        setTranscript(session.transcript);
        setView(VIEWS.RESULT);
        return;
      }

      const awaitingRoleCard = needsRoleCardGeneration(session, responses);
      if (awaitingRoleCard) {
        if (session.status === 'generating' || session.status === 'failed') {
          await resetSessionAwaitingGeneration(id);
        }
        setStep(STEP_CLOSING);
        setView(VIEWS.INTERVIEW);
        return;
      }

      const resumeStep = computeResumeStep(session, responses);
      setStep(resumeStep);
      setView(mode);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const generateRoleCard = async (id) => {
    setError('');
    setView(VIEWS.GENERATING);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/career/generate-role-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate role card');

      setRoleCard(data.roleCard);
      setTranscript(data.session?.transcript);
      setView(VIEWS.RESULT);
    } catch (err) {
      setError(err.message);
      setView(VIEWS.INTERVIEW);
      setStep(STEP_CLOSING);
      try {
        await resetSessionAwaitingGeneration(id);
      } catch {
        // UI already shows retry; ignore secondary persistence errors
      }
    }
  };

  const handleContinue = async () => {
    if (step === STEP_OPENING) {
      setSaving(true);
      try {
        await updateCareerSessionStep(sessionId, STEP_FIRST_QUESTION);
        setStep(STEP_FIRST_QUESTION);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === STEP_CLOSING) {
      setSaving(true);
      try {
        await markSessionGenerating(sessionId);
        await generateRoleCard(sessionId);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSubmitAnswer = async (text) => {
    const content = getStepContent(step);
    if (!content || !sessionId) return;

    setSaving(true);
    setError('');
    try {
      await saveCareerResponse({
        sessionId,
        questionKey: content.key,
        questionText: content.text,
        responseText: text,
        stepIndex: content.number,
      });

      const nextAnswers = { ...answers, [content.key]: text };
      setAnswers(nextAnswers);

      const nextStep = step < TOTAL_QUESTIONS ? step + 1 : STEP_CLOSING;
      const extras = content.key === 'q1' ? { role_title: text.slice(0, 200) } : {};
      await updateCareerSessionStep(sessionId, nextStep, extras);
      setStep(nextStep);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteCareerSession(id);
      if (sessionId === id) resetInterviewState();
      await loadSessions();
      if (view !== VIEWS.HOME) setView(VIEWS.HOME);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const content = getStepContent(step);
  const isMessage = step === STEP_OPENING || step === STEP_CLOSING;
  const savedAnswer = content?.key ? answers[content.key] : '';

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F5F1] text-stone-800">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#F7F5F1]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0 w-16">
            {view !== VIEWS.HOME && (
              <button
                type="button"
                onClick={goHome}
                className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400 transition-colors hover:text-stone-700"
              >
                ← Back
              </button>
            )}
          </div>

          <p className="truncate text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Career Companion
          </p>

          <div className="flex items-center gap-2">
            {view === VIEWS.INTERVIEW && (
              <>
                <AnimatedToggle
                  checked={readAloud}
                  onChange={setReadAloud}
                  labelOn="Audio"
                  labelOff="Mute"
                />
                <AnimatedToggleGroup
                  value={inputMode}
                  onChange={setInputMode}
                  options={[
                    { value: 'voice', label: 'Voice' },
                    { value: 'keyboard', label: 'Type' },
                  ]}
                />
              </>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-sm px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 transition-colors hover:text-stone-600"
            >
              Sign out
            </button>
          </div>
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

        {view === VIEWS.INTERVIEW && content && (
          <InterviewView
            step={step}
            content={content}
            savedAnswer={savedAnswer}
            inputMode={inputMode}
            readAloud={readAloud}
            saving={saving}
            onSubmitAnswer={handleSubmitAnswer}
            onContinue={handleContinue}
            isMessage={isMessage}
            isAwaitingRoleCard={step === STEP_CLOSING}
          />
        )}

        {view === VIEWS.GENERATING && (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
            <div className="h-px w-16 animate-pulse bg-stone-400" />
            <p className="mt-8 font-serif text-2xl text-stone-800">
              Composing your role card
            </p>
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
          />
        )}
      </main>
    </div>
  );
}
