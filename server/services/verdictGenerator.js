const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt — exact text, do not modify ─────────────────────────────────
const SYSTEM_PROMPT = `You are Prism, a portfolio correlation analyst. Your only job is to explain correlation risk to beginner investors in plain, direct, honest English. You never give investment advice. You never recommend buying or selling anything. You only explain what the math means about how a user's existing portfolio actually behaves.

You are talking to someone aged 18 to 30 who just started investing. They are smart but they do not know what correlation means. They do not know what Pearson coefficients are. They do not know what factor loading means. You will not use any of those words. You will speak to them the way a smart older friend would — direct, clear, zero condescension, zero jargon.

You never speculate about what stocks will do in the future. You never simulate scenarios. You never say things like "if a crash happened" or "in a downturn." You only describe what the historical price data shows about how these stocks have moved together in the past.

Your tone is calm and factual. You are not alarming. You are not cheerleading. You are telling someone the truth about their portfolio the way a good doctor tells a patient their test results — honest, clear, and with full respect for their ability to handle the information.

The verdict is always one sentence. It names the score and says what it means in plain English. Example: "Your portfolio scored 84 out of 100, which means your holdings have moved almost in lockstep over the past year — you have much less diversification than it looks like on paper."

The findings explanation is 3 to 5 sentences. It mentions the specific tickers. It explains which pair is most tightly linked and why that matters. It notes which holding is doing the most to concentrate the risk. It ends with a factual statement about what genuine diversification looks like, without recommending any specific changes.

Never use the word "diversification" more than once. Never use the word "portfolio" more than twice. Vary your sentence structure. This should read like a person wrote it, not like a template filled in.`;

// ── Advice detection ──────────────────────────────────────────────────────────
const ADVICE_PHRASES = [
  'you should',
  'consider buying',
  'consider selling',
  'i recommend',
  'you might want to',
  'it would be wise to',
];

function containsAdvice(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ADVICE_PHRASES.some(phrase => lower.includes(phrase));
}

// ── Build user prompt from engine data ────────────────────────────────────────
function buildUserPrompt(data, retrying = false) {
  const { score, severity, pairs, perTicker, tradingDaysUsed, dataFrom, dataTo } = data;
  const tickers = perTicker.map(t => t.ticker).join(', ');

  const pairsText = pairs.length > 0
    ? pairs.map(p => `${p.tickerA} and ${p.tickerB}: ${p.correlation} correlation (${p.level})`).join('\n')
    : 'No pairs above the 0.50 threshold — all holdings show relatively low correlation with each other.';

  const perTickerText = perTicker
    .map(t => `${t.ticker}: ${t.avgCorrelation} average correlation with the rest of the portfolio`)
    .join('\n');

  const retryNote = retrying
    ? '\n\nIMPORTANT: Do not include phrases like "you should", "consider buying", "consider selling", "I recommend", or "it would be wise to". Only describe what the historical data shows — no advice of any kind.'
    : '';

  return `Here is the correlation analysis for this investor's portfolio:

Score: ${score} out of 100
Severity: ${severity}
Tickers held: ${tickers}

Most correlated pairs:
${pairsText}

Per-ticker average correlation:
${perTickerText}

Analysis period: ${tradingDaysUsed} trading days from ${dataFrom} to ${dataTo}

Write the one-sentence verdict and the findings explanation.

Respond only with valid JSON in the format shown. No preamble, no markdown, no extra text.
{ "verdict": "one sentence here", "explanation": "paragraph here" }${retryNote}`;
}

// ── Claude API call — same pattern as Atlas ───────────────────────────────────
async function callClaude(userPrompt) {
  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return result.content[0].text;
}

// ── Parse and validate Claude's JSON response ─────────────────────────────────
function parseResponse(raw) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.verdict !== 'string' || typeof parsed.explanation !== 'string') {
    throw new Error('Missing verdict or explanation fields');
  }
  return { verdict: parsed.verdict.trim(), explanation: parsed.explanation.trim() };
}

const DEFAULT_VERDICT = {
  verdict: 'Analysis complete. See your correlation score above.',
  explanation: 'Analysis complete. See your correlation score above.',
};

// ── Main entry point ──────────────────────────────────────────────────────────
async function generateVerdict(engineData) {
  try {
    // First attempt
    const raw = await callClaude(buildUserPrompt(engineData, false));
    let parsed;
    try {
      parsed = parseResponse(raw);
    } catch (e) {
      console.error('[Prism AI] JSON parse failed on first attempt:', raw);
      return DEFAULT_VERDICT;
    }

    // Check for advice in first response
    if (containsAdvice(parsed.verdict) || containsAdvice(parsed.explanation)) {
      console.warn('[Prism AI] Advice phrases detected — retrying with explicit constraint');

      try {
        const retryRaw = await callClaude(buildUserPrompt(engineData, true));
        const retried = parseResponse(retryRaw);

        if (containsAdvice(retried.verdict) || containsAdvice(retried.explanation)) {
          console.error('[Prism AI] Advice still present after retry — using fallback');
          return DEFAULT_VERDICT;
        }

        return retried;
      } catch (e) {
        console.error('[Prism AI] Retry failed:', e.message);
        return DEFAULT_VERDICT;
      }
    }

    return parsed;
  } catch (err) {
    console.error('[Prism AI] Claude call failed:', err.message);
    return DEFAULT_VERDICT;
  }
}

module.exports = { generateVerdict };
