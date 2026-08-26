/**
 * Server-side pricing. The browser may show a price, but only this module
 * decides what a buyer is charged — a client-sent price is never trusted.
 */

export const VAT_RATE = 0.15;

export interface Tier {
  minQty: number;
  price: number;
}

/** The applicable tier at a given quantity on the wholesale ladder. */
export function tierFor(tiers: Tier[], qty: number): Tier {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const applicable = sorted.filter((t) => qty >= t.minQty);
  return applicable.length ? applicable[applicable.length - 1] : sorted[0];
}

export const unitPriceFor = (tiers: Tier[], qty: number): number => tierFor(tiers, qty).price;

/** Round to 2dp for presentation; storage keeps 4dp. */
export const money = (n: number) => Math.round(n * 100) / 100;

export function estimateShipping(subtotal: number, sameCountry: boolean): number {
  const base = sameCountry ? 75 : 420;
  return money(base + subtotal * (sameCountry ? 0.018 : 0.045));
}

export function totalsFor(lines: { qty: number; unitPrice: number }[], shipping: number) {
  const subtotal = money(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const tax = money((subtotal + shipping) * VAT_RATE);
  return { subtotal, shipping: money(shipping), tax, total: money(subtotal + shipping + tax) };
}

export function shippingQuotes(subtotal: number, fromCountry: string, toCountry: string) {
  const domestic = fromCountry === toCountry;
  const base = domestic ? 75 : 420;
  return [
    {
      carrier: "WAW Fleet",
      service: { ar: "توصيل قياسي", en: "Standard delivery" },
      cost: money(base + subtotal * (domestic ? 0.018 : 0.045)),
      etaDays: domestic ? 3 : 9,
    },
    {
      carrier: domestic ? "SMSA" : "DHL Express",
      service: { ar: "توصيل سريع", en: "Express delivery" },
      cost: money(base * 1.9 + subtotal * (domestic ? 0.03 : 0.07)),
      etaDays: domestic ? 1 : 4,
    },
    {
      carrier: "Aramex",
      service: { ar: "شحن اقتصادي", en: "Economy freight" },
      cost: money(base * 0.7 + subtotal * (domestic ? 0.012 : 0.03)),
      etaDays: domestic ? 6 : 15,
    },
  ];
}
