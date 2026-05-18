import { useState } from 'react'
import { usePageNav } from '../App'
import { useAuth } from '../AuthContext'

export default function AuthPage() {
  const goTo  = usePageNav()
  const { login } = useAuth()
  const [mode,  setMode]  = useState('signup')
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [error, setError] = useState('')
  const [busy,  setBusy]  = useState(false)

  const isLogin = mode === 'login'

  const switchMode = (next) => {
    setMode(next)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup'

    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password: pass }),
      })
      const json = await res.json()

      if (!json.success) {
        setError(json.error || 'Something went wrong.')
        setBusy(false)
        return
      }

      login(json.data.token, { email: json.data.email, subscriptionStatus: json.data.subscriptionStatus })
      goTo('/app')
    } catch {
      setError('Could not connect. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-root">
      <button className="auth-back" onClick={() => goTo('/')}>
        ← Prism
      </button>

      <div className="auth-card">

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${!isLogin ? ' auth-tab--active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
          <button
            className={`auth-tab${isLogin ? ' auth-tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
        </div>

        <h1 className="auth-heading">
          {isLogin ? 'Welcome back.' : 'Start for free.'}
        </h1>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder={isLogin ? '••••••••' : 'At least 8 characters'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={busy}
          >
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

        </form>

        <p className="auth-footer">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            className="auth-footer-link"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  )
}
