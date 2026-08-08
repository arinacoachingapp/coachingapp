import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from '@/components/auth/RequireAuth'
import CareerCompanion from '@/career/components/CareerCompanion'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'

export default function App() {
  return (
    <div className="min-h-dvh overscroll-none">
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth message="Sign in to use Career Companion and save your reflections.">
              <CareerCompanion />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/career" element={<Navigate to="/" replace />} />
        <Route path="/career/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
