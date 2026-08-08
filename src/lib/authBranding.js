/** Branding for shared auth pages — this app is Career Companion only. */

const CAREER = {
  id: 'career',
  appName: 'Career Companion',
  backHref: '/',
  backLabel: 'Career Companion',
  loginSubtitle: 'Sign in to save your reflections and continue where you left off.',
  registerSubtitle: 'Create an account to begin reflecting on your career.',
  defaultNext: '/',
  theme: 'career',
}

export function getAuthBranding(_nextPath = '/') {
  return CAREER
}

export function getAuthBrandingFromPathname(_pathname = '/') {
  return CAREER
}
