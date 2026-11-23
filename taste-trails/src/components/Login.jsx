import React, { useState } from 'react'
import { LogIn, Lock, Mail, AlertCircle } from 'lucide-react'
import PrivacyPolicy from './PrivacyPolicy'
import { useAuth } from '../context/AuthContext'
import { requestProviderToken } from '../services/socialSignIn'

export default function Login({ onLogin, onSwitchToSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)
  const { signInWithProvider } = useAuth()

  async function social(provider) {
    setError('')
    setLoading(true)
    try {
      const result = await requestProviderToken(provider)
      const signedIn = await signInWithProvider(provider, result.idToken, result.name)
      if (!signedIn.success) setError(signedIn.error || 'Sign-in failed')
    } catch (err) {
      setError(err.message || 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await onLogin(email, password)
      if (!result?.success) {
        setError(result?.error || 'Login failed')
      }
    } catch (e) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--paper)] px-5 py-10" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">Discover food worth remembering.</h1>

        <div className="surface mt-8 p-5">

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <button type="button" className="btn btn-quiet w-full" onClick={() => social('google')} disabled={loading}>Continue with Google</button>
            <button type="button" className="btn btn-quiet w-full" onClick={() => social('apple')} disabled={loading}>Continue with Apple</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="field pl-10"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="field pl-10"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Log In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">New to TasteTrails?</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <button
            onClick={onSwitchToSignup}
            className="btn btn-quiet mt-3 w-full"
          >
            Create Account
          </button>
        </div>

        {/* Demo Note */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <button type="button" onClick={() => setShowPrivacy(true)} className="underline">Privacy Policy</button>
        </div>
      </div>
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}
