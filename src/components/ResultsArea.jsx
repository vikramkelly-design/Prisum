import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

// ── Severity helpers ──────────────────────────────────────────────────────────

function scoreSeverity(score) {
  if (score <= 30) return 'low'
  if (score <= 65) return 'moderate'
  return 'high'
}

function findingSeverity(correlation) {
  if (correlation >= 0.75) return 'high'
  if (correlation >= 0.50) return 'moderate'
  return 'low'
}

const SEVERITY_COLOR = {
  low:      'var(--score-low)',
  moderate: 'var(--score-moderate)',
  high:     'var(--score-high)',
}

const SEVERITY_LABEL = {
  low:      'Well Diversified',
  moderate: 'Moderate Correlation',
  high:     'Concentrated Risk',
}

// ── Cluster detection (union-find) ────────────────────────────────────────────

function detectClusters(allPairs, threshold = 0.70) {
  const parent = {}
  const find = (x) => { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x] }
  const union = (x, y) => { parent[find(x)] = find(y) }

  const tickers = [...new Set(allPairs.flatMap(p => [p.tickerA, p.tickerB]))]
  tickers.forEach(t => (parent[t] = t))

  for (const p of allPairs) {
    if (p.correlation >= threshold) union(p.tickerA, p.tickerB)
  }

  const groups = {}
  for (const t of tickers) {
    const root = find(t)
    if (!groups[root]) groups[root] = []
    groups[root].push(t)
  }

  return Object.values(groups).filter(g => g.length >= 3)
}

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ finding }) {
  const sev = finding.severity || findingSeverity(finding.correlation)
  const corrColor = SEVERITY_COLOR[sev] || SEVERITY_COLOR.low
  const corrPct = Math.round(finding.correlation * 100)

  const LEVEL_LABEL = {
    high:     'Highly Correlated',
    moderate: 'Moderately Correlated',
    low:      'Low Correlation',
  }

  return (
    <div
      className="finding-card"
      style={{
        background: 'rgba(31, 77, 53, 0.04)',
        border: '1px solid rgba(31, 77, 53, 0.14)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem 1.25rem',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '0.45rem',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          fontWeight: 500,
          color: 'var(--color-gold)',
          letterSpacing: '0.1em',
        }}>
          {finding.pair[0]} · {finding.pair[1]}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.95rem',
          fontWeight: 500,
          color: corrColor,
          letterSpacing: '-0.01em',
        }}>
          {corrPct}%
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: corrColor,
        marginBottom: finding.description ? '0.5rem' : 0,
        opacity: 0.75,
      }}>
        {LEVEL_LABEL[sev] || LEVEL_LABEL.low}
      </div>

      {finding.description ? (
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.775rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {finding.description}
        </p>
      ) : null}
    </div>
  )
}

// ── Legal disclaimer ──────────────────────────────────────────────────────────

function Disclaimer() {
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: '0.7rem',
      color: 'var(--color-text-muted)',
      lineHeight: 1.6,
      marginTop: '1.25rem',
      maxWidth: '65ch',
    }}>
      This is correlation analysis of historical price data only. It is not investment
      advice and should not be treated as a recommendation to buy or sell any security.
    </p>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--color-text-muted)',
      marginBottom: '1.25rem',
    }}>
      {children}
    </div>
  )
}

// ── Main results area ─────────────────────────────────────────────────────────

export default function ResultsArea({
  results,
  isAnalyzing,
  apiError,
  analyzingTickers = [],
}) {
  const [displayScore, setDisplayScore] = useState(0)
  const prevResultsRef = useRef(null)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!results || results === prevResultsRef.current) return
    prevResultsRef.current = results

    if (prefersReducedMotion) {
      setDisplayScore(results.score)
      return
    }

    const counter = { val: 0 }
    gsap.to(counter, {
      val: results.score,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate() { setDisplayScore(Math.round(counter.val)) },
    })

    gsap.from('.prism-verdict', { opacity: 0, duration: 0.5, ease: 'power2.out', delay: 0.6 })
    gsap.from('.finding-card',  { opacity: 0, y: 16, duration: 0.45, stagger: 0.08, ease: 'power2.out', delay: 0.9 })
    gsap.from('.what-this-means', { opacity: 0, y: 12, duration: 0.5, ease: 'power2.out', delay: 1.5 })
  }, [results, prefersReducedMotion])

  const sev = results ? scoreSeverity(results.score) : null
  const scoreColor = sev ? SEVERITY_COLOR[sev] : 'var(--color-text-muted)'
  const severityLabel = sev ? SEVERITY_LABEL[sev] : ''

  // ── Pre-analysis state ────────────────────────────────────────────────────
  if (!results && !isAnalyzing) {
    return (
      <main style={{
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem',
        background: 'var(--color-bg)',
      }}>
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <h1
            className="prism-tagline"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.25,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '1.75rem',
            }}
          >
            You think you're diversified.
            <br />You're not.
          </h1>

          <p
            className="prism-tagline-sub"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.7,
              maxWidth: '38ch',
              margin: '0 auto',
            }}
          >
            Enter your holdings on the left. Prism computes how correlated your
            stocks actually are and returns a plain-English verdict on your real risk.
          </p>

          {apiError && (
            <div style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(168, 66, 42, 0.06)',
              border: '1px solid rgba(168, 66, 42, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8rem',
              color: 'var(--score-high)',
              lineHeight: 1.5,
            }}>
              {apiError}
            </div>
          )}

          <div style={{
            width: 40,
            height: 1,
            background: 'var(--color-gold)',
            opacity: 0.4,
            margin: '2rem auto 0',
          }} />
        </div>
      </main>
    )
  }

  // ── Analyzing — per-ticker progress list ──────────────────────────────────
  if (isAnalyzing) {
    return (
      <main style={{
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div className="analysis-progress">
          <p className="analysis-progress-label">Fetching price data…</p>
          <div className="analysis-progress-tickers">
            {analyzingTickers.map(t => (
              <div key={t} className="analysis-progress-ticker">
                <span className="analysis-progress-dot" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const clusters = results.allPairs?.length ? detectClusters(results.allPairs) : []

  return (
    <main style={{
      flex: 1,
      height: '100vh',
      overflowY: 'auto',
      background: 'var(--color-bg)',
      padding: '3rem 3.5rem 4rem',
    }}>
      <div style={{ maxWidth: 780 }}>

        {/* ── Failure banner ──────────────────────────────────────────────── */}
        {results.invalidTickers?.length > 0 && (
          <div className="failure-banner">
            <strong>Incomplete analysis</strong> — {results.invalidTickers.length} ticker
            {results.invalidTickers.length > 1 ? 's' : ''} could not be loaded:{' '}
            <span className="failure-tickers">
              {results.invalidTickers.map(t => t.ticker).join(', ')}
            </span>
            . Results reflect only the tickers that loaded successfully.
          </div>
        )}

        {/* Short data warning (not an error, shown less prominently) */}
        {results.warning && !results.invalidTickers?.length && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.65rem 1rem',
            background: 'rgba(154, 100, 24, 0.06)',
            border: '1px solid rgba(154, 100, 24, 0.2)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.775rem',
            color: 'var(--score-moderate)',
          }}>
            {results.warning}
          </div>
        )}

        {/* ── Score ─────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(5rem, 12vw, 9rem)',
              fontWeight: 300,
              lineHeight: 0.9,
              letterSpacing: '-0.04em',
              color: scoreColor,
              marginBottom: '0.75rem',
              transition: 'color 0.3s ease',
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-live="polite"
            aria-label={`Correlation score: ${displayScore} out of 100`}
          >
            {displayScore}
          </div>

          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: scoreColor,
            marginBottom: '1rem',
            opacity: 0.8,
          }}>
            {severityLabel} · Score out of 100
            {results.isWeighted && (
              <span style={{ marginLeft: '0.75rem', opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                · dollar-weighted
              </span>
            )}
          </div>

          <p
            className="prism-verdict"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '1.25rem',
              lineHeight: 1.45,
              color: 'var(--color-text-secondary)',
              maxWidth: '52ch',
            }}
          >
            {results.verdict}
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: '2rem' }} />

        {/* ── Clusters ──────────────────────────────────────────────────────── */}
        {clusters.length > 0 && (
          <section className="clusters-section">
            <SectionLabel>Clusters</SectionLabel>
            {clusters.map((cluster, i) => {
              const clusterPairs = (results.allPairs || []).filter(
                p => cluster.includes(p.tickerA) && cluster.includes(p.tickerB)
              )
              const avgCorr = clusterPairs.length
                ? clusterPairs.reduce((s, p) => s + p.correlation, 0) / clusterPairs.length
                : 0
              return (
                <div key={i} className="cluster-card">
                  <div className="cluster-tickers">{cluster.join(' · ')}</div>
                  <div className="cluster-meta">
                    {cluster.length} holdings move together · avg {Math.round(avgCorr * 100)}% correlated
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ── Findings ──────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionLabel>Findings</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.85rem',
          }}>
            {results.findings.map((finding) => (
              <FindingCard
                key={`${finding.pair[0]}-${finding.pair[1]}`}
                finding={finding}
              />
            ))}
          </div>
        </section>

        {/* ── Per-ticker correlation drag ────────────────────────────────────── */}
        {results.perTicker?.length > 0 && (
          <section className="per-ticker-section">
            <SectionLabel>Correlation drag — ranked</SectionLabel>
            {results.perTicker.map((pt, i) => (
              <div key={pt.ticker} className="per-ticker-row">
                <span className="per-ticker-rank">#{i + 1}</span>
                <span className="per-ticker-name">{pt.ticker}</span>
                <div className="per-ticker-bar-track">
                  <div
                    className="per-ticker-bar-fill"
                    style={{
                      width: `${Math.max(0, pt.avgCorrelation) * 100}%`,
                      background: pt.avgCorrelation >= 0.75
                        ? 'var(--score-high)'
                        : pt.avgCorrelation >= 0.50
                          ? 'var(--score-moderate)'
                          : 'var(--score-low)',
                    }}
                  />
                </div>
                <span className="per-ticker-pct">{Math.round(pt.avgCorrelation * 100)}%</span>
              </div>
            ))}
          </section>
        )}

        {/* ── What this means ────────────────────────────────────────────────── */}
        <div className="what-this-means">
          <SectionLabel>What This Means</SectionLabel>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
            lineHeight: 1.75,
            color: 'var(--color-text-secondary)',
            maxWidth: '65ch',
          }}>
            {results.whatThisMeans}
          </p>

          <Disclaimer />
        </div>

        {/* Data provenance */}
        {results.tradingDaysUsed && (
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--color-border-subtle)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--color-text-muted)',
            letterSpacing: '0.04em',
          }}>
            {results.tradingDaysUsed} trading days · {results.dataFrom} → {results.dataTo}
          </div>
        )}

      </div>
    </main>
  )
}
