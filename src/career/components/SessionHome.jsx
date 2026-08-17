import { formatSessionDate, needsRoleCardGeneration, sessionProgressPercent, sessionStatusLabel } from '../lib/careerDb'
import { PHASES } from '../lib/questions'

export default function SessionHome({
  sessions,
  loading,
  onStartNew,
  onResume,
  onView,
  onDelete,
  deletingId,
}) {
  const inProgress = sessions.filter(
    (s) =>
      s.status === 'in_progress' ||
      s.status === 'generating' ||
      s.status === 'failed' ||
      (s.status === 'completed' && !s.role_card)
  )
  const completed = sessions.filter((s) => s.status === 'completed' && s.role_card)

  return (
    <div className="mx-auto w-full max-w-xl space-y-12">
      <header className="space-y-4 pt-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
          Career Companion
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-stone-900 sm:text-5xl">
          Reflect on a role
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-stone-500">
          A quiet, structured conversation about one chapter of your career — spoken or typed, at
          your own pace. Follow-ups when something needs more texture; never a form.
        </p>
      </header>

      <button
        type="button"
        onClick={onStartNew}
        className="w-full rounded-sm bg-stone-900 py-4 text-sm font-medium tracking-wide text-[#F7F5F1] transition-colors hover:bg-stone-800 active:bg-stone-950"
      >
        Begin a new reflection
      </button>

      {loading && (
        <p className="text-center text-sm text-stone-400">Loading your sessions…</p>
      )}

      {!loading && inProgress.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
            In progress
          </h2>
          <ul className="space-y-3">
            {inProgress.map((session) => {
              const awaiting = needsRoleCardGeneration(session)
              return (
                <SessionCard
                  key={session.id}
                  session={session}
                  primaryAction={awaiting ? 'Generate role card' : 'Resume'}
                  onAction={() => onResume(session.id)}
                  onDelete={onDelete}
                  deletingId={deletingId}
                />
              )
            })}
          </ul>
        </section>
      )}

      {!loading && completed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
            Role cards
          </h2>
          <ul className="space-y-3">
            {completed.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                primaryAction="View"
                onAction={() => onView(session.id)}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SessionCard({ session, primaryAction, onAction, onDelete, deletingId }) {
  const awaitingRoleCard = needsRoleCardGeneration(session)
  const progress = sessionProgressPercent(session)
  const phase = session.interview_state?.phase
  const phaseHint =
    phase === PHASES.NAME_CONFIRM
      ? 'Confirming names'
      : phase === PHASES.INTERVIEWING
        ? 'In conversation'
        : null

  return (
    <li className="rounded-sm border border-stone-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(28,25,23,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={onAction} className="min-w-0 flex-1 text-left">
          <p className="truncate font-serif text-lg text-stone-900">
            {session.role_title || 'Untitled role'}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {sessionStatusLabel(session.status, { awaitingRoleCard })}
            {phaseHint ? ` · ${phaseHint}` : ''} · {formatSessionDate(session.updated_at)}
          </p>
          {!session.role_card && (
            <div className="mt-4">
              <div className="h-px overflow-hidden bg-stone-100">
                <div
                  className="h-px bg-stone-800 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-stone-400">
                {awaitingRoleCard ? 'Interview complete' : `${progress}% complete`}
              </p>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(session.id)}
          disabled={deletingId === session.id}
          className="shrink-0 text-xs text-stone-400 transition-colors hover:text-red-600 disabled:opacity-50"
        >
          {deletingId === session.id ? '…' : 'Remove'}
        </button>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 w-full rounded-sm border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50"
      >
        {primaryAction}
      </button>
    </li>
  )
}
