import { useState, useRef } from 'react'

const MAX_HOLDINGS = 20

// Valid: 1–7 uppercase alphanumeric chars, optional internal hyphen (BRK-B, BF-B)
const TICKER_REGEX = /^[A-Z0-9][A-Z0-9-]{0,6}$/

const LABEL_STYLE = {
  display: 'block',
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(200, 212, 232, 0.55)',
  marginBottom: '0.45rem',
}

const INLINE_MSG_STYLE = {
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  marginTop: '0.35rem',
  lineHeight: 1.4,
}

export default function PortfolioInput({
  holdings,
  onHoldingsChange,
  onRunAnalysis,
  isAnalyzing,
  invalidTickerSet = new Set(),
  perTicker = [],
  isMobile = false,
  onMobileClose = null,
  hasResults = false,
  sidebarWidth = 300,
}) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [inputError, setInputError] = useState(null)
  const tickerInputRef = useRef(null)

  const clearError = () => setInputError(null)

  const corrMap = Object.fromEntries(perTicker.map(p => [p.ticker, p.avgCorrelation]))

  const handleAdd = () => {
    const t = ticker.trim().toUpperCase()

    if (!t) return

    if (!TICKER_REGEX.test(t)) {
      setInputError('Invalid ticker symbol. Use letters, numbers, or a hyphen (e.g. BRK-B).')
      return
    }

    if (holdings.length >= MAX_HOLDINGS) {
      setInputError('20 holdings maximum.')
      return
    }

    if (holdings.some(h => h.ticker === t)) {
      setInputError('Already in portfolio.')
      return
    }

    onHoldingsChange([
      ...holdings,
      {
        id: Date.now(),
        ticker: t,
        shares: shares !== '' ? parseFloat(shares) : null,
      },
    ])
    setTicker('')
    setShares('')
    clearError()
    tickerInputRef.current?.focus()
  }

  const handleRemove = (id) => {
    onHoldingsChange(holdings.filter(h => h.id !== id))
  }

  const handleTickerChange = (e) => {
    setTicker(e.target.value)
    if (inputError) clearError()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd()
  }

  const isAtMax    = holdings.length >= MAX_HOLDINGS
  const isReady    = holdings.length >= 2 && !isAnalyzing
  const needsMore  = holdings.length === 1
  const isEmpty    = holdings.length === 0

  return (
    <aside style={{
      width: isMobile ? '100%' : sidebarWidth,
      flexShrink: 0,
      background: 'var(--color-sidebar)',
      height: isMobile ? 'auto' : '100vh',
      position: isMobile ? 'relative' : 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: isMobile ? '1.5rem 1.25rem 1.5rem' : '2.5rem 1.75rem 2rem',
      overflowY: 'auto',
    }}>

      {/* Wordmark */}
      <div style={{ marginBottom: isMobile ? '1.5rem' : '3rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-gold)',
            marginBottom: '0.5rem',
          }}>
            Prism
          </div>
          {!isMobile && (
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.05rem',
              fontStyle: 'italic',
              color: 'var(--color-text-sidebar)',
              lineHeight: 1.4,
              fontWeight: 300,
            }}>
              Portfolio<br />Risk Analysis
            </div>
          )}
        </div>
        {isMobile && hasResults && onMobileClose && (
          <button
            onClick={onMobileClose}
            style={{
              background: 'none',
              border: '1px solid rgba(200,212,232,0.2)',
              borderRadius: 6,
              color: 'rgba(200,212,232,0.6)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.72rem',
              padding: '0.3rem 0.65rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            View Results ↓
          </button>
        )}
      </div>

      {/* Ticker input */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={LABEL_STYLE} htmlFor="prism-ticker">Ticker Symbol</label>
        <input
          ref={tickerInputRef}
          id="prism-ticker"
          className="prism-input"
          value={ticker}
          onChange={handleTickerChange}
          onKeyDown={handleKeyDown}
          placeholder="e.g. AAPL"
          maxLength={7}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={isAtMax}
          aria-describedby={inputError ? 'ticker-error' : undefined}
        />
        {inputError && (
          <div
            id="ticker-error"
            role="alert"
            style={{ ...INLINE_MSG_STYLE, color: 'rgba(200,212,232,0.55)' }}
          >
            {inputError}
          </div>
        )}
      </div>

      {/* Shares input */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={LABEL_STYLE} htmlFor="prism-shares">
          Shares Held{' '}
          <span style={{ opacity: 0.5, textTransform: 'none', letterSpacing: 0 }}>
            (optional)
          </span>
        </label>
        <input
          id="prism-shares"
          className="prism-input"
          type="number"
          value={shares}
          onChange={e => setShares(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 100"
          min="0"
          disabled={isAtMax}
        />
      </div>

      {/* Add holding button */}
      <button
        className="prism-add-btn"
        onClick={handleAdd}
        disabled={!ticker.trim() || isAtMax}
        style={{ marginBottom: '2rem' }}
      >
        + Add Holding
      </button>

      {/* Holdings list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {!isEmpty ? (
          <>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(200, 212, 232, 0.4)',
              marginBottom: '0.65rem',
            }}>
              {holdings.length} / {MAX_HOLDINGS} Holdings
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {holdings.map(h => {
                const isInvalid = invalidTickerSet.has(h.ticker)
                return (
                  <div key={h.id} className="holding-item" style={isInvalid ? { borderColor: 'rgba(168,66,42,0.3)' } : {}}>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          color: isInvalid ? 'rgba(168,66,42,0.7)' : 'var(--color-gold)',
                          letterSpacing: '0.08em',
                        }}>
                          {h.ticker}
                        </span>
                        {h.shares != null && !isInvalid && (
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.68rem',
                            color: 'rgba(200,212,232,0.4)',
                            letterSpacing: '0.02em',
                          }}>
                            {h.shares} sh
                          </span>
                        )}
                        {h.shares == null && !isInvalid && (
                          <span style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.63rem',
                            color: 'rgba(200,212,232,0.28)',
                            fontStyle: 'italic',
                          }}>
                            equal-weighted
                          </span>
                        )}
                      </div>
                      {/* Inline invalid ticker error */}
                      {isInvalid && (
                        <span style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '0.65rem',
                          color: 'rgba(168,66,42,0.65)',
                          lineHeight: 1.3,
                        }}>
                          couldn't find price data
                        </span>
                      )}
                      {/* Mini correlation bar */}
                      {!isInvalid && corrMap[h.ticker] != null && (
                        <div className="holding-corr-bar-track">
                          <div
                            className="holding-corr-bar-fill"
                            style={{
                              width: `${Math.max(0, corrMap[h.ticker]) * 100}%`,
                              background: corrMap[h.ticker] >= 0.75
                                ? 'var(--score-high)'
                                : corrMap[h.ticker] >= 0.50
                                  ? 'var(--score-moderate)'
                                  : 'var(--score-low)',
                            }}
                          />
                          <span className="holding-corr-pct">
                            {Math.round(corrMap[h.ticker] * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      className="prism-remove-btn"
                      onClick={() => handleRemove(h.id)}
                      aria-label={`Remove ${h.ticker}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '0.875rem',
            color: 'rgba(200, 212, 232, 0.2)',
            lineHeight: 1.65,
          }}>
            Add at least two holdings<br />to begin.
          </div>
        )}
      </div>

      {/* Run analysis footer */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--color-gold-15)',
      }}>
        {/* Validation message */}
        {!isAnalyzing && (
          <>
            {needsMore && (
              <div style={{ ...INLINE_MSG_STYLE, color: 'rgba(200,212,232,0.4)', marginBottom: '0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                Add at least 2 holdings to run an analysis.
              </div>
            )}
            {isEmpty && (
              <div style={{ ...INLINE_MSG_STYLE, color: 'rgba(200,212,232,0.3)', marginBottom: '0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                Add at least 2 holdings to run an analysis.
              </div>
            )}
          </>
        )}

        <button
          className={`prism-run-btn ${isReady ? 'ready' : isAnalyzing ? 'analyzing' : 'disabled'}`}
          onClick={isReady ? onRunAnalysis : undefined}
          disabled={!isReady}
          aria-busy={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>

    </aside>
  )
}
