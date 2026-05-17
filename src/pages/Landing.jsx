import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePageNav } from '../App'

gsap.registerPlugin(ScrollTrigger)

// ── Constellation canvas ──────────────────────────────────────────────────────
// Vanilla canvas — no library. Dots drift imperceptibly, lines connect nearby
// pairs at very low opacity, creating texture without distraction.

function ConstellationCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let rafId
    let dots = []

    const DOT_COUNT  = 58
    const THRESHOLD  = 155 // max px distance to draw a connecting line

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    function initDots() {
      dots = Array.from({ length: DOT_COUNT }, () => ({
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.17,
        vy: (Math.random() - 0.5) * 0.17,
        r:  Math.random() * 0.8 + 0.35,
      }))
    }

    function draw() {
      ctx.fillStyle = '#0E1B2E'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Move & wrap dots
      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        if (d.x < 0)             d.x = canvas.width
        else if (d.x > canvas.width)  d.x = 0
        if (d.y < 0)             d.y = canvas.height
        else if (d.y > canvas.height) d.y = 0

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,252,245,0.25)'
        ctx.fill()
      }

      // Draw connecting lines between close pairs
      ctx.lineWidth = 0.5
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx   = dots[i].x - dots[j].x
          const dy   = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < THRESHOLD) {
            const alpha = (1 - dist / THRESHOLD) * 0.08
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(255,252,245,${alpha})`
            ctx.stroke()
          }
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    resize()
    initDots()
    draw()

    const ro = new ResizeObserver(() => { resize(); initDots() })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

// ── Custom cursor ──────────────────────────────────────────────────────────────

function CustomCursor() {
  const dotRef = useRef(null)

  useEffect(() => {
    const dot  = dotRef.current
    const xTo  = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3.out' })
    const yTo  = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3.out' })

    const move = (e) => { xTo(e.clientX); yTo(e.clientY) }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  return (
    <div
      ref={dotRef}
      className="prism-cursor"
      style={{
        position: 'fixed',
        top: -5,
        left: -5,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'var(--color-gold)',
        pointerEvents: 'none',
        zIndex: 10000,
        mixBlendMode: 'screen',
        opacity: 0.85,
      }}
    />
  )
}

// ── Gold button with GSAP hover ────────────────────────────────────────────────

function GoldButton({ children, onClick }) {
  const btnRef = useRef(null)

  useEffect(() => {
    const btn = btnRef.current
    const enter = () => {
      gsap.to(btn, { y: -3, duration: 0.22, ease: 'power2.out' })
      gsap.to(btn, { boxShadow: '0 8px 28px rgba(201,168,76,0.45)', duration: 0.22, ease: 'power2.out' })
    }
    const leave = () => {
      gsap.to(btn, { y: 0, duration: 0.28, ease: 'power2.out' })
      gsap.to(btn, { boxShadow: '0 0px 0px rgba(201,168,76,0)', duration: 0.28, ease: 'power2.out' })
    }
    btn.addEventListener('mouseenter', enter)
    btn.addEventListener('mouseleave', leave)
    return () => {
      btn.removeEventListener('mouseenter', enter)
      btn.removeEventListener('mouseleave', leave)
    }
  }, [])

  return (
    <button ref={btnRef} onClick={onClick} className="landing-cta-btn">
      {children}
    </button>
  )
}

// ── Belief / Reality row ───────────────────────────────────────────────────────
// Each row is wrapped with its own rule line. The rule draws left-to-right
// first via GSAP scaleX, then the row fades up — "inscribed" feel.

function BeliefRow({ belief, reality, delay }) {
  const groupRef = useRef(null)
  const ruleRef  = useRef(null)
  const rowRef   = useRef(null)

  useEffect(() => {
    const trigger = {
      trigger: groupRef.current,
      start: 'top 87%',
      toggleActions: 'play none none none',
    }

    // Rule draws left to right
    gsap.from(ruleRef.current, {
      scaleX: 0,
      transformOrigin: 'left center',
      duration: 0.55,
      ease: 'power3.out',
      delay,
      immediateRender: false,
      scrollTrigger: trigger,
    })

    // Row fades up after rule has started drawing
    gsap.from(rowRef.current, {
      opacity: 0,
      y: 24,
      duration: 0.6,
      ease: 'power2.out',
      delay: delay + 0.2,
      immediateRender: false,
      scrollTrigger: trigger,
    })
  }, [delay])

  return (
    <div ref={groupRef} className="belief-row-group">
      <div ref={ruleRef} className="belief-rule-line" aria-hidden="true" />
      <div ref={rowRef} className="belief-row">
        <div className="belief-cell">
          <span className="belief-label">Belief</span>
          <span className="belief-text">{belief}</span>
        </div>
        <div className="belief-divider-vert" aria-hidden="true" />
        <div className="belief-cell">
          <span className="belief-label reality-label">Reality</span>
          <span className="belief-text reality-text">
            <span className="reality-marker" aria-hidden="true">·</span>{reality}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── How it works step ─────────────────────────────────────────────────────────
// Each step has a large faint watermark number in Cormorant behind the content.

function Step({ num, title, body, delay }) {
  const stepRef = useRef(null)

  useEffect(() => {
    const el = stepRef.current
    gsap.from(el, {
      opacity: 0,
      y: 32,
      duration: 0.65,
      ease: 'power2.out',
      delay,
      immediateRender: false,
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    })
  }, [delay])

  return (
    <div ref={stepRef} className="how-step">
      {/* Background watermark — large faint number in Cormorant */}
      <div className="how-step-watermark" aria-hidden="true">{num}</div>
      <div className="how-step-num">{num}</div>
      <div className="how-step-content">
        <div className="how-step-title">{title}</div>
        <div className="how-step-body">{body}</div>
      </div>
    </div>
  )
}

// ── How steps wrapper with progressive connector line ─────────────────────────
// A thin vertical gold line runs down the left side of the steps and fills
// top-to-bottom as the user scrolls through the section (GSAP scrub).

function HowStepsSection() {
  const wrapRef = useRef(null)
  const fillRef = useRef(null)

  useEffect(() => {
    gsap.fromTo(fillRef.current,
      { scaleY: 0, immediateRender: false },
      {
        scaleY: 1,
        transformOrigin: 'top center',
        ease: 'none',
        scrollTrigger: {
          trigger: wrapRef.current,
          start: 'top 58%',
          end:   'bottom 55%',
          scrub: 0.6,
        },
      }
    )
  }, [])

  return (
    <div ref={wrapRef} className="how-steps-wrapper">
      {/* Connector track + animated fill */}
      <div className="how-connector" aria-hidden="true">
        <div ref={fillRef} className="how-connector-fill" />
      </div>

      <div className="how-steps">
        <Step
          num="01"
          title="Enter your holdings"
          body="Type in your ticker symbols. No brokerage connection required."
          delay={0}
        />
        <Step
          num="02"
          title="Prism fetches the data"
          body="We pull 252 days of real closing prices from market data and compute pairwise Pearson correlations across your entire portfolio."
          delay={0.1}
        />
        <Step
          num="03"
          title="Get your verdict"
          body="A single score from 0–100 tells you how correlated your portfolio really is. High means concentrated. Low means genuinely diversified."
          delay={0.2}
        />
      </div>
    </div>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
// Decorative line mark animates in first, then text elements stagger up.

function FinalCTA({ goTo }) {
  const sectionRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current

    const st = {
      trigger: el,
      start: 'top 80%',
      toggleActions: 'play none none none',
    }

    // Decorative lines draw in first
    gsap.from(el.querySelectorAll('.cta-deco-line'), {
      scaleX: 0,
      opacity: 0,
      transformOrigin: 'center center',
      duration: 0.5,
      stagger: 0.09,
      ease: 'power3.out',
      immediateRender: false,
      scrollTrigger: st,
    })

    // Text elements stagger up after lines settle
    gsap.from(el.querySelectorAll('.cta-animate'), {
      opacity: 0,
      y: 28,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.3,
      immediateRender: false,
      scrollTrigger: st,
    })
  }, [])

  return (
    <div ref={sectionRef}>
      {/* Decorative mark — three lines, asymmetric lengths, gold */}
      <div className="cta-deco-lines" aria-hidden="true">
        <span className="cta-deco-line" style={{ width: 52 }} />
        <span className="cta-deco-line" style={{ width: 22, opacity: 0.5 }} />
        <span className="cta-deco-line" style={{ width: 38, opacity: 0.3 }} />
      </div>

      <div className="landing-section-eyebrow cta-animate">Get started</div>
      <h2 className="landing-final-heading cta-animate">
        See what your portfolio<br />really looks like.
      </h2>
      <p className="landing-final-sub cta-animate">
        Takes 30 seconds.
      </p>
      <div className="cta-animate">
        <GoldButton onClick={() => goTo('/auth')}>
          Start analyzing →
        </GoldButton>
      </div>

      {/* Social proof stat — DM Mono, very small, very muted */}
      <p className="cta-stat cta-animate">
        avg correlation score across portfolios analyzed: 71
      </p>
    </div>
  )
}

// ── Main Landing ───────────────────────────────────────────────────────────────

export default function Landing() {
  const goTo    = usePageNav()
  const heroRef = useRef(null)
  const subRef  = useRef(null)
  const ctaRef  = useRef(null)
  const lineRef = useRef(null)

  useEffect(() => {
    // Hero headline: split into words, stagger reveal from clip
    const words = heroRef.current.querySelectorAll('.word')
    gsap.fromTo(words,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.1 }
    )

    gsap.from(lineRef.current, {
      scaleX: 0,
      transformOrigin: 'left center',
      duration: 0.9,
      ease: 'power3.out',
      delay: 0.8,
    })

    gsap.from(subRef.current, {
      opacity: 0,
      y: 20,
      duration: 0.7,
      ease: 'power2.out',
      delay: 0.95,
    })

    gsap.from(ctaRef.current, {
      opacity: 0,
      y: 16,
      duration: 0.6,
      ease: 'power2.out',
      delay: 1.25,
    })

    return () => ScrollTrigger.getAll().forEach(t => t.kill())
  }, [])

  const headline = ['You think', "you're", 'diversified.', "You're", 'not.']

  return (
    <div className="landing-root">
      <CustomCursor />

      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">Prism</div>
        <button className="landing-nav-link" onClick={() => goTo('/auth')}>Sign in</button>
      </nav>

      {/* ── Section 1: Hero ─────────────────────────────────────────── */}
      <section className="landing-hero">

        {/* Constellation network — fills the full viewport behind everything */}
        <ConstellationCanvas />

        {/* Radial depth pool — barely-there lighter area centered on the text */}
        <div className="landing-hero-radial" aria-hidden="true" />

        <div className="landing-hero-inner">
          <h1 ref={heroRef} className="landing-headline" aria-label="You think you're diversified. You're not.">
            {headline.map((word, i) => (
              <span key={i} className="word">{word}{i < headline.length - 1 ? ' ' : ''}</span>
            ))}
          </h1>
          <div ref={lineRef} className="landing-rule" />
          <p ref={subRef} className="landing-sub">
            Prism analyzes your actual stock holdings and computes how correlated they
            really are — giving you a plain-English verdict on your true concentration risk.
          </p>
          <div ref={ctaRef}>
            <GoldButton onClick={() => goTo('/auth')}>
              Analyze your portfolio →
            </GoldButton>
          </div>
        </div>

        {/* Ambient grid lines */}
        <div className="landing-grid" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="landing-grid-line" />
          ))}
        </div>
      </section>

      {/* ── Section 2: Problem ──────────────────────────────────────── */}
      <section className="landing-section landing-problem">
        <div className="landing-section-inner">
          <div className="landing-section-eyebrow">The problem</div>
          <h2 className="landing-section-heading">
            Diversification is usually an illusion.
          </h2>
          <p className="landing-section-body">
            You might own a dozen different tickers, but if they all move together,
            you don't have a diversified portfolio — you have a concentrated bet with extra steps.
          </p>

          <div className="belief-rows">
            <BeliefRow
              belief="I own 12 different stocks."
              reality="9 of them move in lockstep."
              delay={0}
            />
            <BeliefRow
              belief="Tech is balanced by healthcare."
              reality="Both fell 18% in the same week."
              delay={0.08}
            />
            <BeliefRow
              belief="My ETFs cover different sectors."
              reality="They share 70% of the same holdings."
              delay={0.16}
            />
            <BeliefRow
              belief="I've been managing this for years."
              reality="No one told you the correlation score."
              delay={0.24}
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: How it works ──────────────────────────────────── */}
      <section className="landing-section landing-how">
        <div className="landing-section-inner">
          <div className="landing-section-eyebrow">How it works</div>
          <h2 className="landing-section-heading">
            Three steps. One number.
          </h2>

          <HowStepsSection />
        </div>
      </section>

      {/* ── Section 4: CTA ───────────────────────────────────────────── */}
      <section className="landing-section landing-final-cta">
        <div className="landing-final-cta-inner">
          <FinalCTA goTo={goTo} />
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2026 Prism. Not investment advice.</span>
      </footer>
    </div>
  )
}
