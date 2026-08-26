import { catalog, orders } from "./api";
import { store } from "./store";
import { round2 } from "./pricing";
import type { Category, PricePoint, Product } from "./types";

const db = () => store.getState();

export interface PriceSeries {
  productId: string;
  points: PricePoint[];
  current: number;
  weekAgo: number;
  monthAgo: number;
  quarterAgo: number;
  changeWeekPct: number;
  changeMonthPct: number;
  changeQuarterPct: number;
  min: number;
  max: number;
  avg: number;
  volatility: number;
}

function pctChange(from: number, to: number) {
  if (!from) return 0;
  return Math.round(((to - from) / from) * 1000) / 10;
}

/** Weekly price observations for one product, plus the derived deltas. */
export function priceSeries(productId: string): PriceSeries | null {
  const points = db()
    .priceHistory.filter((p) => p.productId === productId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (points.length < 4) return null;

  const at = (weeksBack: number) => points[Math.max(0, points.length - 1 - weeksBack)].avgPrice;
  const current = points[points.length - 1].avgPrice;
  const prices = points.map((p) => p.avgPrice);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + (b - avg) ** 2, 0) / prices.length;

  return {
    productId,
    points,
    current,
    weekAgo: at(1),
    monthAgo: at(4),
    quarterAgo: at(13),
    changeWeekPct: pctChange(at(1), current),
    changeMonthPct: pctChange(at(4), current),
    changeQuarterPct: pctChange(at(13), current),
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: round2(avg),
    volatility: round2((Math.sqrt(variance) / avg) * 100),
  };
}

export interface CategoryIndex {
  category: Category;
  avgPrice: number;
  changeMonthPct: number;
  productCount: number;
  supplierCount: number;
  demandIndex: number;
}

/** Per-category price index and demand level — the home page market ticker. */
export function categoryIndices(): CategoryIndex[] {
  const cats = db().categories.filter((c) => c.parentId === null);
  return cats
    .map((category) => {
      const products = db().products.filter((p) => catalog.categoryMatches(p, category.id));
      const series = products.map((p) => priceSeries(p.id)).filter((s): s is PriceSeries => s !== null);
      const avgPrice = series.length ? round2(series.reduce((s, x) => s + x.current, 0) / series.length) : 0;
      const changeMonthPct = series.length
        ? Math.round((series.reduce((s, x) => s + x.changeMonthPct, 0) / series.length) * 10) / 10
        : 0;
      const volume = series.reduce((s, x) => s + x.points.slice(-4).reduce((a, b) => a + b.volume, 0), 0);
      return {
        category,
        avgPrice,
        changeMonthPct,
        productCount: products.length,
        supplierCount: new Set(products.map((p) => p.supplierId)).size,
        demandIndex: Math.round(volume),
      };
    })
    .filter((c) => c.productCount > 0)
    .sort((a, b) => b.demandIndex - a.demandIndex);
}

export interface TrendingProduct {
  product: Product;
  demandGrowthPct: number;
  recentVolume: number;
  priceChangePct: number;
}

/** Products whose recent 4-week volume outruns the 4 weeks before that. */
export function trendingProducts(limit = 8): TrendingProduct[] {
  return db()
    .products.map((product) => {
      const series = priceSeries(product.id);
      if (!series) return null;
      const recent = series.points.slice(-4).reduce((s, p) => s + p.volume, 0);
      const prior = series.points.slice(-8, -4).reduce((s, p) => s + p.volume, 0);
      return {
        product,
        recentVolume: recent,
        demandGrowthPct: pctChange(prior, recent),
        priceChangePct: series.changeMonthPct,
      };
    })
    .filter((x): x is TrendingProduct => x !== null)
    .sort((a, b) => b.demandGrowthPct - a.demandGrowthPct)
    .slice(0, limit);
}

export interface PriceAlert {
  product: Product;
  changePct: number;
  direction: "up" | "down";
  current: number;
  previous: number;
}

export function priceAlerts(thresholdPct = 4, limit = 10): PriceAlert[] {
  return db()
    .products.map((product) => {
      const s = priceSeries(product.id);
      if (!s) return null;
      return {
        product,
        changePct: s.changeMonthPct,
        direction: s.changeMonthPct >= 0 ? ("up" as const) : ("down" as const),
        current: s.current,
        previous: s.monthAgo,
      };
    })
    .filter((a): a is PriceAlert => a !== null && Math.abs(a.changePct) >= thresholdPct)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit);
}

export interface SupplierRanking {
  supplierId: string;
  name: { ar: string; en: string };
  rating: number;
  onTimeRate: number;
  responseHours: number;
  fulfilledOrders: number;
  productCount: number;
  competitivenessPct: number;
  score: number;
}

/**
 * Composite supplier score. Competitiveness compares a supplier's entry-tier
 * prices against the category median, so cheap-but-late suppliers don't win.
 */
export function supplierRankings(): SupplierRanking[] {
  const products = db().products;
  const medianByCategory = new Map<string, number>();
  for (const cat of new Set(products.map((p) => p.categoryId))) {
    const prices = products.filter((p) => p.categoryId === cat).map((p) => p.tiers[0].price).sort((a, b) => a - b);
    medianByCategory.set(cat, prices[Math.floor(prices.length / 2)] ?? 0);
  }

  return db()
    .suppliers.map((s) => {
      const own = products.filter((p) => p.supplierId === s.id);
      const deltas = own.map((p) => {
        const median = medianByCategory.get(p.categoryId) ?? p.tiers[0].price;
        return median ? (median - p.tiers[0].price) / median : 0;
      });
      const competitiveness = deltas.length ? (deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100 : 0;
      const score =
        s.rating * 12 +
        s.onTimeRate * 30 +
        Math.max(0, 10 - s.responseHours) * 1.5 +
        Math.min(20, s.fulfilledOrders / 200) +
        competitiveness * 0.6;
      return {
        supplierId: s.id,
        name: catalog.supplierCompany(s.id)?.name ?? { ar: s.id, en: s.id },
        rating: s.rating,
        onTimeRate: s.onTimeRate,
        responseHours: s.responseHours,
        fulfilledOrders: s.fulfilledOrders,
        productCount: own.length,
        competitivenessPct: Math.round(competitiveness * 10) / 10,
        score: Math.round(score * 10) / 10,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export interface RegionDemand {
  countryCode: string;
  orderCount: number;
  value: number;
  share: number;
}

export function regionDemand(): RegionDemand[] {
  const all = orders.all().filter((o) => o.status !== "cancelled");
  const byCountry = new Map<string, { count: number; value: number }>();
  for (const o of all) {
    const company = db().companies.find((c) => c.id === o.buyerCompanyId);
    const code = company?.countryCode ?? "SA";
    const entry = byCountry.get(code) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += o.total;
    byCountry.set(code, entry);
  }
  const totalValue = [...byCountry.values()].reduce((s, v) => s + v.value, 0) || 1;
  return [...byCountry.entries()]
    .map(([countryCode, v]) => ({
      countryCode,
      orderCount: v.count,
      value: round2(v.value),
      share: Math.round((v.value / totalValue) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}

/* ------------------------------------------------------ demand forecasting */

export interface Forecast {
  productId: string;
  history: { date: string; volume: number }[];
  projection: { date: string; volume: number; low: number; high: number }[];
  trendPerWeek: number;
  seasonalStrength: number;
  nextMonthUnits: number;
  confidence: number;
  priceOutlookPct: number;
  direction: "rising" | "flat" | "declining";
}

/**
 * Holt-style linear trend plus a fitted seasonal term over the 26-week window.
 * Deliberately simple and explainable — a buyer has to trust the number.
 */
export function forecastDemand(productId: string, horizonWeeks = 8): Forecast | null {
  const series = priceSeries(productId);
  if (!series) return null;
  const points = series.points;
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

  // Residual seasonality, fitted as a single annual sine wave.
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
  const projection = Array.from({ length: horizonWeeks }, (_, i) => {
    const x = n + i;
    const value = Math.max(0, intercept + slope * x + seasonal(x));
    const band = rmse * (1 + i * 0.12) * 1.5;
    return {
      date: new Date(lastDate + (i + 1) * 7 * 864e5).toISOString(),
      volume: Math.round(value),
      low: Math.max(0, Math.round(value - band)),
      high: Math.round(value + band),
    };
  });

  const nextMonthUnits = Math.round(projection.slice(0, 4).reduce((s, p) => s + p.volume, 0));
  const trendPct = meanY ? (slope / meanY) * 100 : 0;

  return {
    productId,
    history: points.map((p) => ({ date: p.date, volume: p.volume })),
    projection,
    trendPerWeek: Math.round(slope * 10) / 10,
    seasonalStrength: Math.round((meanY ? (amplitude / meanY) * 100 : 0) * 10) / 10,
    nextMonthUnits,
    confidence: Math.round(r2 * 100),
    priceOutlookPct: Math.round(series.changeMonthPct * 0.6 * 10) / 10,
    direction: trendPct > 1.2 ? "rising" : trendPct < -1.2 ? "declining" : "flat",
  };
}

export interface ReorderSuggestion {
  product: Product;
  lastOrderedAt: string | null;
  avgIntervalDays: number;
  daysSinceLast: number;
  daysUntilReorder: number;
  suggestedQty: number;
  urgency: "overdue" | "soon" | "later";
  priceOutlookPct: number;
}

/**
 * Reorder timing from a buyer's own order cadence for each product.
 * Products bought once give no interval, so they are skipped.
 */
export function reorderSuggestions(buyerCompanyId: string, limit = 6): ReorderSuggestion[] {
  const history = orders
    .forBuyer(buyerCompanyId)
    .filter((o) => o.status !== "cancelled")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const byProduct = new Map<string, { dates: number[]; qty: number[] }>();
  for (const o of history) {
    for (const line of o.lines) {
      const entry = byProduct.get(line.productId) ?? { dates: [], qty: [] };
      entry.dates.push(new Date(o.createdAt).getTime());
      entry.qty.push(line.qty);
      byProduct.set(line.productId, entry);
    }
  }

  const now = Date.now();
  const suggestions: ReorderSuggestion[] = [];
  for (const [productId, entry] of byProduct) {
    const product = catalog.product(productId);
    if (!product || entry.dates.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < entry.dates.length; i += 1) gaps.push((entry.dates[i] - entry.dates[i - 1]) / 864e5);
    const avgInterval = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const last = entry.dates[entry.dates.length - 1];
    const daysSince = (now - last) / 864e5;
    const daysUntil = Math.round(avgInterval - daysSince);
    const avgQty = Math.round(entry.qty.reduce((a, b) => a + b, 0) / entry.qty.length);
    const series = priceSeries(productId);
    suggestions.push({
      product,
      lastOrderedAt: new Date(last).toISOString(),
      avgIntervalDays: Math.round(avgInterval),
      daysSinceLast: Math.round(daysSince),
      daysUntilReorder: daysUntil,
      suggestedQty: Math.max(product.moq, avgQty),
      urgency: daysUntil <= 0 ? "overdue" : daysUntil <= 10 ? "soon" : "later",
      priceOutlookPct: series ? Math.round(series.changeMonthPct * 0.6 * 10) / 10 : 0,
    });
  }

  const order = { overdue: 0, soon: 1, later: 2 };
  return suggestions
    .sort((a, b) => order[a.urgency] - order[b.urgency] || a.daysUntilReorder - b.daysUntilReorder)
    .slice(0, limit);
}

export interface BuyerSpendSummary {
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  supplierCount: number;
  monthly: { month: string; value: number }[];
  topCategories: { categoryId: string; value: number; share: number }[];
  topSuppliers: { supplierId: string; value: number; orderCount: number }[];
}

export function buyerSpend(buyerCompanyId: string): BuyerSpendSummary {
  const list = orders.forBuyer(buyerCompanyId).filter((o) => o.status !== "cancelled");
  const total = list.reduce((s, o) => s + o.total, 0);

  const monthMap = new Map<string, number>();
  const catMap = new Map<string, number>();
  const supMap = new Map<string, { value: number; orderCount: number }>();

  for (const o of list) {
    const month = o.createdAt.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + o.total);
    for (const line of o.lines) {
      const value = line.qty * line.unitPrice;
      const product = catalog.product(line.productId);
      if (product) catMap.set(product.categoryId, (catMap.get(product.categoryId) ?? 0) + value);
      const sup = supMap.get(line.supplierId) ?? { value: 0, orderCount: 0 };
      sup.value += value;
      sup.orderCount += 1;
      supMap.set(line.supplierId, sup);
    }
  }

  return {
    totalSpend: round2(total),
    orderCount: list.length,
    avgOrderValue: list.length ? round2(total / list.length) : 0,
    supplierCount: supMap.size,
    monthly: [...monthMap.entries()].sort().map(([month, value]) => ({ month, value: round2(value) })),
    topCategories: [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, value]) => ({
        categoryId,
        value: round2(value),
        share: total ? Math.round((value / total) * 1000) / 10 : 0,
      })),
    topSuppliers: [...supMap.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5)
      .map(([supplierId, v]) => ({ supplierId, value: round2(v.value), orderCount: v.orderCount })),
  };
}

export interface SupplierPerformance {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  buyerCount: number;
  monthly: { month: string; value: number }[];
  topProducts: { productId: string; value: number; qty: number }[];
  openRfqs: number;
  activeNegotiations: number;
  lowStock: Product[];
}

export function supplierPerformance(supplierId: string): SupplierPerformance {
  const list = orders.forSupplier(supplierId).filter((o) => o.status !== "cancelled");
  const monthMap = new Map<string, number>();
  const prodMap = new Map<string, { value: number; qty: number }>();
  const buyers = new Set<string>();
  let revenue = 0;

  for (const o of list) {
    buyers.add(o.buyerCompanyId);
    const own = o.lines.filter((l) => l.supplierId === supplierId);
    const value = own.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    revenue += value;
    const month = o.createdAt.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + value);
    for (const l of own) {
      const entry = prodMap.get(l.productId) ?? { value: 0, qty: 0 };
      entry.value += l.qty * l.unitPrice;
      entry.qty += l.qty;
      prodMap.set(l.productId, entry);
    }
  }

  const products = db().products.filter((p) => p.supplierId === supplierId);
  return {
    revenue: round2(revenue),
    orderCount: list.length,
    avgOrderValue: list.length ? round2(revenue / list.length) : 0,
    buyerCount: buyers.size,
    monthly: [...monthMap.entries()].sort().map(([month, value]) => ({ month, value: round2(value) })),
    topProducts: [...prodMap.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5)
      .map(([productId, v]) => ({ productId, value: round2(v.value), qty: v.qty })),
    openRfqs: db().rfqs.filter((r) => r.invitedSupplierIds.includes(supplierId) && ["open", "quoted"].includes(r.status)).length,
    activeNegotiations: db().negotiations.filter((n) => n.supplierId === supplierId && n.status === "active").length,
    lowStock: products.filter((p) => p.availability === "low_stock" || p.availability === "out_of_stock"),
  };
}
