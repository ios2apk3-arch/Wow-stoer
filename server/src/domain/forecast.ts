/**
 * Demand forecasting.
 *
 * A least-squares linear trend plus a single fitted annual seasonal term,
 * with a confidence band derived from the residuals. Deliberately simple and
 * explainable: a buyer has to trust the number before acting on it, and a
 * model nobody can describe in a sentence does not earn that trust.
 */

export interface Observation {
  date: string;
  volume: number;
  price: number;
}

export interface ForecastPoint {
  date: string;
  volume: number;
  low: number;
  high: number;
}

export interface Forecast {
  history: { date: string; volume: number }[];
  projection: ForecastPoint[];
  trendPerWeek: number;
  seasonalStrength: number;
  nextMonthUnits: number;
  confidence: number;
  priceOutlookPct: number;
  direction: "rising" | "flat" | "declining";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function forecastDemand(observations: Observation[], horizonWeeks = 8): Forecast | null {
  if (observations.length < 4) return null;

  const points = [...observations].sort((a, b) => (a.date < b.date ? -1 : 1));
  const volumes = points.map((p) => p.volume);
  const n = volumes.length;

  // Least-squares linear trend over the observed weeks.
  const meanX = (n - 1) / 2;
  const meanY = volumes.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  volumes.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den ? num / den : 0;
  const intercept = meanY - slope * meanX;

  // Residual seasonality, fitted as one annual sine wave.
  const residuals = volumes.map((y, x) => y - (intercept + slope * x));
  let sinSum = 0;
  let cosSum = 0;
  residuals.forEach((r, x) => {
    const angle = (x / 52) * Math.PI * 2;
    sinSum += r * Math.sin(angle);
    cosSum += r * Math.cos(angle);
  });
  const amplitude = (2 / n) * Math.hypot(sinSum, cosSum);
  const phase = Math.atan2(cosSum, sinSum);
  const seasonal = (x: number) => amplitude * Math.sin((x / 52) * Math.PI * 2 + phase);

  const fitted = volumes.map((_, x) => intercept + slope * x + seasonal(x));
  const sse = volumes.reduce((s, y, x) => s + (y - fitted[x]) ** 2, 0);
  const sst = volumes.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const r2 = sst ? Math.max(0, 1 - sse / sst) : 0;
  const rmse = Math.sqrt(sse / n);

  const lastDate = new Date(points[points.length - 1].date).getTime();
  const projection: ForecastPoint[] = Array.from({ length: horizonWeeks }, (_, i) => {
    const x = n + i;
    const value = Math.max(0, intercept + slope * x + seasonal(x));
    // The band widens with the horizon: further out is genuinely less certain.
    const band = rmse * (1 + i * 0.12) * 1.5;
    return {
      date: new Date(lastDate + (i + 1) * 7 * 864e5).toISOString(),
      volume: Math.round(value),
      low: Math.max(0, Math.round(value - band)),
      high: Math.round(value + band),
    };
  });

  const prices = points.map((p) => p.price);
  const monthAgo = prices[Math.max(0, prices.length - 5)];
  const current = prices[prices.length - 1];
  const priceChangePct = monthAgo ? ((current - monthAgo) / monthAgo) * 100 : 0;
  const trendPct = meanY ? (slope / meanY) * 100 : 0;

  return {
    history: points.map((p) => ({ date: p.date, volume: p.volume })),
    projection,
    trendPerWeek: round1(slope),
    seasonalStrength: round1(meanY ? (amplitude / meanY) * 100 : 0),
    nextMonthUnits: Math.round(projection.slice(0, 4).reduce((s, p) => s + p.volume, 0)),
    confidence: Math.round(r2 * 100),
    priceOutlookPct: round1(priceChangePct * 0.6),
    direction: trendPct > 1.2 ? "rising" : trendPct < -1.2 ? "declining" : "flat",
  };
}

export interface PriceSeriesSummary {
  current: number;
  min: number;
  max: number;
  avg: number;
  changeWeekPct: number;
  changeMonthPct: number;
  changeQuarterPct: number;
  volatility: number;
}

export function summarisePrices(prices: number[]): PriceSeriesSummary | null {
  if (prices.length < 4) return null;
  const at = (weeksBack: number) => prices[Math.max(0, prices.length - 1 - weeksBack)];
  const current = prices[prices.length - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + (b - avg) ** 2, 0) / prices.length;
  const pct = (from: number, to: number) => (from ? round1(((to - from) / from) * 100) : 0);

  return {
    current: Math.round(current * 100) / 100,
    min: Math.round(Math.min(...prices) * 100) / 100,
    max: Math.round(Math.max(...prices) * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    changeWeekPct: pct(at(1), current),
    changeMonthPct: pct(at(4), current),
    changeQuarterPct: pct(at(13), current),
    volatility: round1((Math.sqrt(variance) / avg) * 100),
  };
}
