import { useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// Distinct colors that work on the dark Prism background
const LINE_COLORS = [
  '#C8A97E', // gold
  '#6EC6A3', // sage green
  '#7EB8D4', // steel blue
  '#C97FA0', // rose
  '#A07EC9', // violet
  '#D4A96E', // amber
  '#6ECAC9', // teal
  '#D4726E', // coral
  '#8EC96E', // lime
  '#C9C36E', // yellow
  '#6E8EC9', // periwinkle
  '#C96E8E', // pink
  '#6EC98E', // mint
  '#C98E6E', // peach
  '#8EC9C9', // cyan
  '#9EC96E', // chartreuse
  '#C96E6E', // red
  '#6E9EC9', // sky
  '#C9A86E', // tan
  '#8E6EC9', // purple
]

function buildChartData(priceSeries) {
  const tickers = Object.keys(priceSeries)
  if (tickers.length === 0) return { data: [], tickers: [] }

  // Merge all date points into unified rows
  const dateMap = {}
  for (const ticker of tickers) {
    for (const pt of priceSeries[ticker]) {
      if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date }
      dateMap[pt.date][ticker] = pt.value
    }
  }

  const data = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  return { data, tickers }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function CorrelationMatrix({ allPairs, tickers }) {
  if (!allPairs?.length || !tickers?.length) return null

  // Build lookup
  const corrMap = {}
  for (const p of allPairs) {
    corrMap[`${p.tickerA}|${p.tickerB}`] = p.correlation
    corrMap[`${p.tickerB}|${p.tickerA}`] = p.correlation
  }

  function getCorr(a, b) {
    if (a === b) return 1
    return corrMap[`${a}|${b}`] ?? null
  }

  function cellColor(corr) {
    if (corr === null) return 'transparent'
    if (corr === 1) return 'rgba(200, 169, 126, 0.12)' // diagonal
    if (corr >= 0.75) return 'rgba(168, 66, 42, 0.22)'
    if (corr >= 0.50) return 'rgba(154, 100, 24, 0.18)'
    if (corr >= 0.20) return 'rgba(31, 77, 53, 0.18)'
    if (corr >= 0) return 'rgba(31, 77, 53, 0.08)'
    return 'rgba(100, 120, 160, 0.12)' // negative
  }

  function textColor(corr) {
    if (corr === 1) return 'rgba(200, 169, 126, 0.6)'
    if (corr === null) return 'transparent'
    if (corr >= 0.75) return 'var(--score-high)'
    if (corr >= 0.50) return 'var(--score-moderate)'
    return 'var(--score-low)'
  }

  const cellSize = Math.min(64, Math.floor(560 / (tickers.length + 1)))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-mono)',
        fontSize: cellSize > 48 ? '0.72rem' : '0.62rem',
      }}>
        <thead>
          <tr>
            <th style={{ width: cellSize, minWidth: cellSize }} />
            {tickers.map(t => (
              <th key={t} style={{
                width: cellSize,
                minWidth: cellSize,
                padding: '0 4px 8px',
                color: 'var(--color-gold)',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textAlign: 'center',
              }}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map(rowTicker => (
            <tr key={rowTicker}>
              <td style={{
                padding: '4px 10px 4px 0',
                color: 'var(--color-gold)',
                fontWeight: 500,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>
                {rowTicker}
              </td>
              {tickers.map(colTicker => {
                const corr = getCorr(rowTicker, colTicker)
                return (
                  <td key={colTicker} style={{
                    width: cellSize,
                    minWidth: cellSize,
                    height: cellSize,
                    textAlign: 'center',
                    background: cellColor(corr),
                    color: textColor(corr),
                    fontWeight: corr === 1 ? 300 : 500,
                    fontSize: corr === 1 ? '0.65em' : undefined,
                    borderRadius: 4,
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}>
                    {corr !== null ? (corr === 1 ? '—' : `${Math.round(corr * 100)}%`) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(14, 18, 26, 0.97)',
      border: '1px solid rgba(200,169,126,0.2)',
      borderRadius: 6,
      padding: '0.65rem 0.85rem',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.72rem',
    }}>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: '0.35rem', fontSize: '0.65rem' }}>
        {formatDate(label)}
      </div>
      {payload.map(entry => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.dataKey}: {entry.value?.toFixed(1)}
        </div>
      ))}
    </div>
  )
}

export default function DeepDiveModal({ results, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const { data, tickers } = buildChartData(results.priceSeries || {})

  // For the matrix, use the valid tickers from allPairs
  const matrixTickers = results.perTicker?.map(pt => pt.ticker) || tickers

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8, 11, 18, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '2rem 1rem',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div style={{
        width: '100%',
        maxWidth: 860,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        padding: '2.5rem 2.5rem 3rem',
        position: 'relative',
      }}>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            padding: '0.3rem 0.6rem',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          esc
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-gold)',
            marginBottom: '0.5rem',
          }}>
            Deep Dive
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '1.6rem',
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.25,
          }}>
            100-Day Price Movement
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.775rem',
            color: 'var(--color-text-muted)',
            marginTop: '0.5rem',
            lineHeight: 1.5,
          }}>
            All holdings rebased to 100 on day one. Lines that move together suggest high correlation.
          </p>
        </div>

        {/* Normalized price chart */}
        {data.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(200,169,126,0.07)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'rgba(200,212,232,0.35)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(200,169,126,0.12)' }}
                  interval={Math.floor(data.length / 5)}
                />
                <YAxis
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'rgba(200,212,232,0.35)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'rgba(200,212,232,0.5)',
                    paddingTop: 12,
                  }}
                />
                {tickers.map((ticker, i) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: '2.5rem' }} />

        {/* Correlation matrix */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-gold)',
            marginBottom: '0.5rem',
          }}>
            Full Correlation Matrix
          </div>
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '1.3rem',
            color: 'var(--color-text-primary)',
            margin: '0 0 0.5rem',
          }}>
            Every pair, ranked by correlation
          </h3>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.775rem',
            color: 'var(--color-text-muted)',
            marginBottom: '1.5rem',
            lineHeight: 1.5,
          }}>
            <span style={{ color: 'var(--score-high)' }}>Red</span> = highly correlated (≥75%) ·{' '}
            <span style={{ color: 'var(--score-moderate)' }}>Amber</span> = moderate (50–75%) ·{' '}
            <span style={{ color: 'var(--score-low)' }}>Green</span> = low (&lt;50%)
          </p>
          <CorrelationMatrix allPairs={results.allPairs} tickers={matrixTickers} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: '2.5rem' }} />

        {/* Full pair list */}
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-gold)',
            marginBottom: '1.25rem',
          }}>
            All Pairs — sorted by correlation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[...(results.allPairs || [])].sort((a, b) => b.correlation - a.correlation).map(p => {
              const pct = Math.round(p.correlation * 100)
              const color = p.correlation >= 0.75
                ? 'var(--score-high)'
                : p.correlation >= 0.50
                  ? 'var(--score-moderate)'
                  : p.correlation < 0
                    ? 'rgba(100,120,180,0.7)'
                    : 'var(--score-low)'
              return (
                <div key={`${p.tickerA}-${p.tickerB}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--color-gold)',
                    letterSpacing: '0.06em',
                    minWidth: 110,
                  }}>
                    {p.tickerA} · {p.tickerB}
                  </span>
                  <div style={{
                    flex: 1,
                    height: 3,
                    background: 'rgba(200,169,126,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(0, p.correlation) * 100}%`,
                      background: color,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color,
                    minWidth: 36,
                    textAlign: 'right',
                  }}>
                    {pct >= 0 ? `${pct}%` : `${pct}%`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
