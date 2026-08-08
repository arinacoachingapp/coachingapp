import { Link } from 'react-router-dom'

const THEMES = {
  career: {
    page: 'bg-[#F7F5F1] text-stone-800',
    card: 'rounded-sm border border-stone-200/90 bg-white shadow-[0_1px_3px_rgba(28,25,23,0.06)]',
    title: 'font-serif text-3xl font-medium tracking-tight text-stone-900',
    subtitle: 'text-stone-500',
    back: 'text-stone-500 hover:text-stone-800',
    label: 'text-stone-600',
    input:
      'border-stone-200 bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-stone-400/20',
    button: 'bg-stone-900 text-[#F7F5F1] hover:bg-stone-800 active:bg-stone-950',
    link: 'text-stone-700 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-500',
    footer: 'text-stone-500',
    brand: 'text-xs font-medium uppercase tracking-[0.2em] text-stone-400',
  },
  default: {
    page: 'bg-stone-100 text-stone-800',
    card: 'rounded-2xl border border-stone-200 bg-white shadow-sm',
    title: 'text-2xl font-bold tracking-tight text-stone-900',
    subtitle: 'text-stone-500',
    back: 'text-stone-600 hover:text-stone-900',
    label: 'text-stone-700',
    input:
      'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-stone-500',
    button: 'bg-stone-800 text-white active:bg-stone-700',
    link: 'text-stone-700 font-semibold',
    footer: 'text-stone-500',
    brand: 'text-sm font-medium text-stone-500',
  },
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  theme = 'career',
  backHref = '/',
  backLabel = 'Back',
  appName,
}) {
  const t = THEMES[theme] || THEMES.default

  return (
    <div className={`flex min-h-dvh flex-col px-4 py-10 sm:py-14 ${t.page}`}>
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-10 text-center">
          <Link to={backHref} className={`inline-block text-sm transition-colors ${t.back}`}>
            ← {backLabel}
          </Link>
          {appName && theme === 'career' && <p className={`mt-8 ${t.brand}`}>{appName}</p>}
          <h1 className={`mt-3 ${t.title}`}>{title}</h1>
          {subtitle && <p className={`mt-3 text-sm leading-relaxed ${t.subtitle}`}>{subtitle}</p>}
        </div>

        <div className={`p-6 sm:p-8 ${t.card}`}>{children}</div>

        {footer && <div className={`mt-8 text-center text-sm ${t.footer}`}>{footer}</div>}
      </div>
    </div>
  )
}

export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  theme = 'career',
}) {
  const t = THEMES[theme] || THEMES.default

  return (
    <label className="block" htmlFor={id}>
      <span className={`text-sm font-medium ${t.label}`}>{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={`mt-2 w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors focus:ring-2 ${t.input}`}
      />
    </label>
  )
}

export function AuthSubmitButton({ children, disabled, loading, theme = 'career' }) {
  const t = THEMES[theme] || THEMES.default

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`mt-8 w-full rounded-lg py-3.5 text-base font-medium transition-colors disabled:opacity-50 ${t.button}`}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function AuthError({ message, theme = 'career' }) {
  if (!message) return null
  return (
    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  )
}

export function AuthSuccess({ message }) {
  if (!message) return null
  return (
    <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </p>
  )
}

export function AuthLink({ to, children, theme = 'career' }) {
  const t = THEMES[theme] || THEMES.default
  return (
    <Link to={to} className={`font-medium transition-colors ${t.link}`}>
      {children}
    </Link>
  )
}
