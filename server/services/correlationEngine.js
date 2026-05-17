const TRADING_DAYS_REQUESTED = 252; // ~1 year of trading days
const PRICE_CHART_DAYS       = 100; // days to expose for the normalized price chart

// ── Step 1: Fetch daily closing prices via Finnhub ───────────────────────────

async function fetchPrices(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not set');

  const to   = Math.floor(Date.now() / 1000);
  const from = to - 550 * 24 * 60 * 60; // ~550 days back to guarantee 252 trading days

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub returned ${res.status} for ${ticker}`);

  const data = await res.json();
  if (data.s !== 'ok' || !Array.isArray(data.c) || data.c.length === 0) {
    throw new Error(`No price data for ${ticker}`);
  }

  // Build price rows from parallel arrays (t=timestamps, c=closes)
  const prices = [];
  for (let i = 0; i < data.t.length; i++) {
    if (data.c[i] == null || isNaN(data.c[i])) continue;
    const dateStr = new Date(data.t[i] * 1000).toISOString().slice(0, 10);
    prices.push({ date: dateStr, close: data.c[i] });
  }

  if (prices.length < 2) throw new Error(`Insufficient price data for ${ticker}`);

  // Take only the most recent TRADING_DAYS_REQUESTED days
  const recent = prices.slice(-TRADING_DAYS_REQUESTED);
  const lastClose = recent[recent.length - 1].close;

  // Normalized price series for chart (last 100 days, rebased to 100 at day 0)
  const chartSlice = recent.slice(-PRICE_CHART_DAYS);
  const basePrice  = chartSlice[0].close;
  const priceSeries = chartSlice.map(p => ({
    date:  p.date,
    value: Math.round((p.close / basePrice) * 1000) / 10, // rebased to 100.0
  }));

  // Step 1 cont: convert closing prices → daily returns
  // return[N] = (price[N] - price[N-1]) / price[N-1]
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    const r = (recent[i].close - recent[i - 1].close) / recent[i - 1].close;
    returns.push({ date: recent[i].date, return: r });
  }

  if (returns.length === 0) throw new Error(`Could not compute returns for ${ticker}`);
  return { returns, lastClose, priceSeries };
}

// ── Step 2: Align return series to shared trading dates ──────────────────────

function alignReturns(returnsByTicker) {
  const tickers = Object.keys(returnsByTicker);

  // Build a set of dates present in ALL tickers
  const dateSets = tickers.map(t => new Set(returnsByTicker[t].map(r => r.date)));
  const sharedDates = [...dateSets[0]].filter(d => dateSets.every(s => s.has(d))).sort();

  if (sharedDates.length === 0) throw new Error('No overlapping trading dates found across tickers');

  // Index each ticker's returns by date for O(1) lookup
  const indexed = {};
  for (const ticker of tickers) {
    indexed[ticker] = {};
    for (const r of returnsByTicker[ticker]) indexed[ticker][r.date] = r.return;
  }

  // Build aligned arrays — same length, same date order for every ticker
  const aligned = {};
  for (const ticker of tickers) {
    aligned[ticker] = sharedDates.map(d => indexed[ticker][d]);
  }

  return { aligned, dates: sharedDates };
}

// ── Step 3: Pearson correlation coefficient ──────────────────────────────────

function pearson(a, b) {
  const n = a.length;
  if (n === 0) return 0;

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num   += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  if (denom === 0) return 0;
  return num / denom;
}

// ── Main engine ───────────────────────────────────────────────────────────────

async function analyze(tickers, sharesMap = {}) {
  if (!Array.isArray(tickers) || tickers.length < 2) {
    throw new Error('Portfolio must contain at least 2 tickers');
  }

  // Normalize tickers
  const normalized = [...new Set(tickers.map(t => t.trim().toUpperCase()))];

  // ── Step 1: Fetch prices for all tickers in parallel ──────────────────────
  const fetchResults = await Promise.allSettled(
    normalized.map(ticker => fetchPrices(ticker))
  );

  const validReturns   = {};
  const lastCloses     = {};
  const priceSeriesMap = {};
  const invalidTickers = [];

  for (let i = 0; i < normalized.length; i++) {
    const ticker = normalized[i];
    const result = fetchResults[i];
    if (result.status === 'fulfilled') {
      validReturns[ticker]  = result.value.returns;
      lastCloses[ticker]    = result.value.lastClose;
      priceSeriesMap[ticker] = result.value.priceSeries;
    } else {
      console.warn(`[PrismEngine] ${ticker} failed: ${result.reason?.message}`);
      invalidTickers.push({ ticker, reason: result.reason?.message || 'Unknown error' });
    }
  }

  const validTickers = Object.keys(validReturns);
  if (validTickers.length < 2) {
    throw new Error(
      `Portfolio must contain at least 2 valid tickers to compute correlations. ` +
      `Failed tickers: ${invalidTickers.map(e => e.ticker).join(', ')}`
    );
  }

  // ── Step 2: Align return series ───────────────────────────────────────────
  const { aligned, dates } = alignReturns(validReturns);
  const tradingDaysUsed = dates.length;

  const warning = tradingDaysUsed < 60
    ? `Warning: only ${tradingDaysUsed} trading days of shared price history found. Results may be less reliable than usual.`
    : null;

  // ── Step 3: Compute pairwise correlation matrix ───────────────────────────
  const pairCorrelations = []; // { tickerA, tickerB, correlation }

  for (let i = 0; i < validTickers.length; i++) {
    for (let j = i + 1; j < validTickers.length; j++) {
      const tickerA = validTickers[i];
      const tickerB = validTickers[j];
      const r = pearson(aligned[tickerA], aligned[tickerB]);
      pairCorrelations.push({ tickerA, tickerB, correlation: r });
    }
  }

  // ── Step 4: Compute weights (dollar-weighted if shares provided, equal otherwise) ───
  const hasShares = validTickers.some(t => sharesMap[t] != null);
  const weights = {};
  if (hasShares) {
    const positionValues = {};
    for (const t of validTickers) {
      positionValues[t] = (sharesMap[t] ?? 0) * lastCloses[t];
    }
    // Tickers without shares get the average value of tickers that do have shares
    const withShares = validTickers.filter(t => sharesMap[t] != null);
    const withoutShares = validTickers.filter(t => sharesMap[t] == null);
    const avgVal = withShares.length
      ? withShares.reduce((s, t) => s + positionValues[t], 0) / withShares.length
      : 1;
    for (const t of withoutShares) positionValues[t] = avgVal;
    const totalValue = validTickers.reduce((s, t) => s + positionValues[t], 0);
    for (const t of validTickers) weights[t] = totalValue > 0 ? positionValues[t] / totalValue : 1 / validTickers.length;
  } else {
    for (const t of validTickers) weights[t] = 1 / validTickers.length;
  }

  // ── Step 5: Portfolio correlation score (weighted) ────────────────────────
  let weightedSum = 0, weightTotal = 0;
  for (const p of pairCorrelations) {
    const w = weights[p.tickerA] * weights[p.tickerB];
    weightedSum += w * p.correlation;
    weightTotal += w;
  }
  const avgCorrelation = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const score = Math.round(Math.min(100, Math.max(0, avgCorrelation * 100)));

  const severity = score <= 30 ? 'low' : score <= 65 ? 'moderate' : 'high';

  // ── Step 6: Notable findings ──────────────────────────────────────────────
  const sortedPairs = [...pairCorrelations].sort((a, b) => b.correlation - a.correlation);

  // Return all pairs sorted by correlation descending — frontend picks top 6
  const pairs = sortedPairs.map(p => ({
    tickerA: p.tickerA,
    tickerB: p.tickerB,
    correlation: Math.round(p.correlation * 100) / 100,
    level: p.correlation >= 0.75 ? 'high' : p.correlation >= 0.50 ? 'moderate' : 'low',
  }));

  // Per-ticker average correlation
  const tickerCorrelationSum = {};
  const tickerCorrelationCount = {};
  for (const t of validTickers) { tickerCorrelationSum[t] = 0; tickerCorrelationCount[t] = 0; }

  for (const p of pairCorrelations) {
    tickerCorrelationSum[p.tickerA] += p.correlation;
    tickerCorrelationCount[p.tickerA]++;
    tickerCorrelationSum[p.tickerB] += p.correlation;
    tickerCorrelationCount[p.tickerB]++;
  }

  const perTicker = validTickers
    .map(t => ({
      ticker: t,
      avgCorrelation: Math.round((tickerCorrelationSum[t] / tickerCorrelationCount[t]) * 100) / 100,
    }))
    .sort((a, b) => b.avgCorrelation - a.avgCorrelation);

  // ── Step 7: Build response payload ───────────────────────────────────────
  return {
    score,
    severity,
    pairs,
    perTicker,
    tradingDaysUsed,
    dataFrom: dates[0],
    dataTo: dates[dates.length - 1],
    lastPrices:  lastCloses,
    priceSeries: priceSeriesMap,
    isWeighted:  hasShares,
    weights,
    ...(invalidTickers.length > 0 && { invalidTickers }),
    ...(warning && { warning }),
  };
}

module.exports = { analyze };
