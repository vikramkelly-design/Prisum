import { useState, useEffect, useRef } from 'react'
import PortfolioInput from '../components/PortfolioInput'
import ResultsArea    from '../components/ResultsArea'

const STORAGE_KEY  = 'prism_holdings'
const HISTORY_KEY  = 'prism_history'

function loadHoldings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((h, i) => ({
      id: Date.now() + i,
      ticker: h.ticker,
      shares: h.shares ?? null,
    }))
  } catch {
    return []
  }
}

function saveHoldings(holdings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(holdings.map(({ ticker, shares }) => ({ ticker, shares: shares ?? null })))
    )
  } catch { /* storage unavailable */ }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

const SEVERITY_COLOR = { low: '#1F4D35', moderate: '#9A6418', high: '#A8422A' }

function HistoryDropdown({ history, onSelect, activeId }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="history-dropdown-wrap" ref={wrapRef}>
      <button
        className={`history-pill${open ? ' history-pill--open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        History
        {history.length > 0 && (
          <span className="history-pill-count">{history.length}</span>
        )}
      </button>

      {open && (
        <div className="history-dropdown">
          {history.length === 0 ? (
            <div className="history-dd-empty">No analyses yet.</div>
          ) : (
            history.map(entry => {
              const isActive = entry.results?._historyId === activeId
              return (
                <button
                  key={entry.id}
                  className={`history-dd-entry${isActive ? ' history-dd-entry--active' : ''}`}
                  onClick={() => { onSelect(entry); setOpen(false) }}
                >
                  <div className="history-dd-tickers">{entry.tickers.join(' · ')}</div>
                  <div className="history-dd-meta">
                    <span className="history-dd-score" style={{ color: SEVERITY_COLOR[entry.severity] }}>
                      {entry.score}
                    </span>
                    <span className="history-dd-date">
                      {new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="history-dd-verdict">{entry.verdict}</div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function AnalyzerPage() {
  const [holdings,          setHoldings]          = useState(loadHoldings)
  const [results,           setResults]           = useState(null)
  const [isAnalyzing,       setIsAnalyzing]       = useState(false)
  const [apiError,          setApiError]          = useState(null)
  const [invalidTickerSet,  setInvalidTickerSet]  = useState(new Set())
  const [analyzingTickers,  setAnalyzingTickers]  = useState([])
  const [history,           setHistory]           = useState(loadHistory)

  useEffect(() => { saveHoldings(holdings) }, [holdings])

  const handleRunAnalysis = async () => {
    if (holdings.length < 2 || isAnalyzing) return

    setResults(null)
    setApiError(null)
    setInvalidTickerSet(new Set())
    setIsAnalyzing(true)
    setAnalyzingTickers(holdings.map(h => h.ticker))

    try {
      const tickers   = holdings.map(h => h.ticker)
      const sharesMap = {}
      holdings.forEach(h => { if (h.shares != null) sharesMap[h.ticker] = h.shares })

      const response = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tickers, shares: sharesMap }),
      })
      const json = await response.json()

      if (!json.success) {
        setApiError(json.error || 'Analysis failed. Please try again.')
        return
      }

      const d = json.data

      if (d.invalidTickers?.length) {
        setInvalidTickerSet(new Set(d.invalidTickers.map(t => t.ticker)))
      }

      const findings = (d.pairs || [])
        .sort((a, b) => b.correlation - a.correlation)
        .slice(0, 6)
        .map(p => ({
          pair:        [p.tickerA, p.tickerB],
          correlation: p.correlation,
          severity:    p.level,
          description: '',
        }))

      const entryId = Date.now()

      const fullResults = {
        _historyId:      entryId,
        score:           d.score,
        severity:        d.severity,
        verdict:         d.verdict,
        whatThisMeans:   d.explanation,
        findings,
        allPairs:        d.pairs || [],
        perTicker:       d.perTicker || [],
        isWeighted:      d.isWeighted || false,
        weights:         d.weights || {},
        lastPrices:      d.lastPrices || {},
        tradingDaysUsed: d.tradingDaysUsed,
        dataFrom:        d.dataFrom,
        dataTo:          d.dataTo,
        invalidTickers:  d.invalidTickers || [],
        warning:         d.warning || null,
      }

      setResults(fullResults)

      const entry = {
        id:       entryId,
        savedAt:  new Date().toISOString(),
        tickers:  holdings.map(h => h.ticker),
        score:    d.score,
        severity: d.severity,
        verdict:  d.verdict,
        results:  fullResults,
      }
      setHistory(prev => {
        const updated = [entry, ...prev].slice(0, 10)
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
        return updated
      })
    } catch {
      setApiError('Something went wrong fetching price data. Check your connection and try again.')
    } finally {
      setIsAnalyzing(false)
      setAnalyzingTickers([])
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <PortfolioInput
        holdings={holdings}
        onHoldingsChange={setHoldings}
        onRunAnalysis={handleRunAnalysis}
        isAnalyzing={isAnalyzing}
        invalidTickerSet={invalidTickerSet}
        perTicker={results?.perTicker || []}
      />
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <HistoryDropdown
          history={history}
          onSelect={(entry) => setResults(entry.results)}
          activeId={results?._historyId ?? null}
        />
        <ResultsArea
          results={results}
          isAnalyzing={isAnalyzing}
          apiError={apiError}
          analyzingTickers={analyzingTickers}
        />
      </div>
    </div>
  )
}
