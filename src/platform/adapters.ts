/**
 * Payment and shipping provider adapters.
 *
 * The platform never talks to a gateway directly — it talks to these
 * interfaces. Adding Moyasar, Stripe, Aramex or SMSA means writing one more
 * object here and registering it; no call site changes.
 */

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "requires_action" | "authorized" | "captured" | "failed";
  method: string;
}

export interface PaymentAdapter {
  id: string;
  name: { ar: string; en: string };
  methods: string[];
  authorize(amount: number, currency: string, method: string): Promise<PaymentIntent>;
  capture(intentId: string): Promise<PaymentIntent>;
}

/** Stand-in gateway: authorises everything, captures on demand. */
const mockGateway: PaymentAdapter = {
  id: "waw-mock",
  name: { ar: "بوابة واو التجريبية", en: "WAW sandbox gateway" },
  methods: ["card", "bank_transfer", "credit_terms"],
  async authorize(amount, currency, method) {
    return {
      id: `pi_${Math.random().toString(36).slice(2, 12)}`,
      amount,
      currency,
      status: method === "credit_terms" ? "authorized" : "authorized",
      method,
    };
  },
  async capture(intentId) {
    return { id: intentId, amount: 0, currency: "SAR", status: "captured", method: "card" };
  },
};

export interface ShippingQuote {
  carrier: string;
  service: { ar: string; en: string };
  cost: number;
  etaDays: number;
}

export interface ShippingAdapter {
  id: string;
  quote(subtotal: number, fromCountry: string, toCountry: string): Promise<ShippingQuote[]>;
  track(trackingNumber: string): Promise<{ status: string; updatedAt: string }>;
}

const mockCarriers: ShippingAdapter = {
  id: "waw-logistics",
  async quote(subtotal, fromCountry, toCountry) {
    const domestic = fromCountry === toCountry;
    const base = domestic ? 75 : 420;
    return [
      {
        carrier: "WAW Fleet",
        service: { ar: "توصيل قياسي", en: "Standard delivery" },
        cost: Math.round((base + subtotal * (domestic ? 0.018 : 0.045)) * 100) / 100,
        etaDays: domestic ? 3 : 9,
      },
      {
        carrier: domestic ? "SMSA" : "DHL Express",
        service: { ar: "توصيل سريع", en: "Express delivery" },
        cost: Math.round((base * 1.9 + subtotal * (domestic ? 0.03 : 0.07)) * 100) / 100,
        etaDays: domestic ? 1 : 4,
      },
      {
        carrier: "Aramex",
        service: { ar: "شحن اقتصادي", en: "Economy freight" },
        cost: Math.round((base * 0.7 + subtotal * (domestic ? 0.012 : 0.03)) * 100) / 100,
        etaDays: domestic ? 6 : 15,
      },
    ];
  },
  async track(trackingNumber) {
    return { status: trackingNumber ? "in_transit" : "unknown", updatedAt: new Date().toISOString() };
  },
};

export const payments: PaymentAdapter = mockGateway;
export const shipping: ShippingAdapter = mockCarriers;
