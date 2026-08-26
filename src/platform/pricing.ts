import type { Order, PriceTier, Product, Unit } from "./types";
import { fxToSar } from "./data/catalog";

/** The tier that applies at a given quantity — the wholesale ladder rule. */
export function tierFor(product: Product, qty: number): PriceTier {
  const applicable = [...product.tiers].sort((a, b) => a.minQty - b.minQty).filter((t) => qty >= t.minQty);
  return applicable.length ? applicable[applicable.length - 1] : product.tiers[0];
}

export function unitPrice(product: Product, qty: number): number {
  return tierFor(product, qty).price;
}

export function lineTotal(product: Product, qty: number): number {
  return round2(unitPrice(product, qty) * qty);
}

/** Saving versus buying the same quantity at the entry-tier price. */
export function tierSavingPct(product: Product, qty: number): number {
  const base = product.tiers[0].price;
  const now = unitPrice(product, qty);
  if (base === 0) return 0;
  return Math.max(0, Math.round(((base - now) / base) * 1000) / 10);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const VAT_RATE = 0.15;

/** Distance-free freight estimate: weight-band proxy driven by order value. */
export function estimateShipping(subtotal: number, sameCountry: boolean): number {
  const base = sameCountry ? 75 : 420;
  return round2(base + subtotal * (sameCountry ? 0.018 : 0.045));
}

export function toSar(amount: number, currency: string): number {
  return round2(amount * (fxToSar[currency] ?? 1));
}

export function orderValueSar(order: Order): number {
  return toSar(order.total, order.currency);
}

const unitLabels: Record<Unit, { ar: string; en: string }> = {
  carton: { ar: "كرتون", en: "carton" },
  pallet: { ar: "طبلية", en: "pallet" },
  kg: { ar: "كجم", en: "kg" },
  piece: { ar: "قطعة", en: "piece" },
  liter: { ar: "لتر", en: "litre" },
  box: { ar: "صندوق", en: "box" },
};

export const unitLabel = (unit: Unit, locale: "ar" | "en") => unitLabels[unit][locale];
