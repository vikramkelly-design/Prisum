import { Routes, Route } from 'react-router-dom'
import { useRef, createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import Landing      from './pages/Landing'
import AuthPage     from './pages/AuthPage'
import AnalyzerPage from './pages/AnalyzerPage'

export const OverlayContext = createContext(null)

export function usePageNav() {
  const overlayRef = useContext(OverlayContext)
  const navigate   = useNavigate()

  return function goTo(path) {
    const el = overlayRef.current
    if (!el) { navigate(path); return }
    gsap.killTweensOf(el)
    gsap.to(el, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.in',
      onComplete() {
        navigate(path)
        gsap.to(el, { opacity: 0, duration: 0.45, ease: 'power2.out', delay: 0.05 })
      },
    })
  }
}

export default function App() {
  const overlayRef = useRef(null)

  return (
    <OverlayContext.Provider value={overlayRef}>
      {/* GSAP page-transition overlay */}
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0E1B2E',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
      <Routes>
        <Route path="/"     element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/app"  element={<AnalyzerPage />} />
      </Routes>
    </OverlayContext.Provider>
  )
}
