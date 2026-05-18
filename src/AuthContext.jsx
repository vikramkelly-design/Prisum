import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)   // { email, subscriptionStatus }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('prism_token')
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.data) setUser(json.data)
        else localStorage.removeItem('prism_token')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function login(token, userData) {
    localStorage.setItem('prism_token', token)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('prism_token')
    setUser(null)
  }

  function refreshUser() {
    const token = localStorage.getItem('prism_token')
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.data) setUser(json.data) })
      .catch(() => {})
  }

  const isPro = user?.subscriptionStatus === 'pro'

  return (
    <AuthContext.Provider value={{ user, isPro, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
