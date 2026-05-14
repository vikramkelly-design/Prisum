// Lazy-initializes yahoo-finance2 exactly as Atlas does — ESM module via dynamic import
let yahooFinance = null;

async function getYF() {
  if (!yahooFinance) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    yahooFinance = new YahooFinance();
    try { yahooFinance.suppressNotices(['yahooSurvey']); } catch (_) {}
  }
  return yahooFinance;
}

module.exports = { getYF };
