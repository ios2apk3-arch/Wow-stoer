import { getSession, request, setSession, type Session, type SessionCompany } from "./http";
import type { Availability, I18nText, Unit } from "../types";

/**
 * Typed view of the API surface. Response shapes mirror the server's
 * serialisers; when the server changes, this file is the one that follows.
 */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface RemoteSupplierSummary {
  id: string;
  name: I18nText;
  logo: string;
  rating: number;
  verification: "unverified" | "pending" | "verified" | "rejected";
}

export interface RemoteProduct {
  id: string;
  supplierId: string;
  supplier: RemoteSupplierSummary;
  categoryId: string;
  name: I18nText;
  description: I18nText;
  brand: string;
  image: string;
  specs: { label: I18nText; value: I18nText }[];
  unit: Unit;
  moq: number;
  stock: number;
  leadTimeDays: number;
  tiers: { minQty: number; price: number }[];
  entryPrice: number;
  currency: string;
  originCountry: string;
  availability: Availability;
  rating: number;
  reviewCount: number;
  soldUnits: number;
  tags: string[];
  createdAt: string;
}

export interface RemoteSupplier {
  id: string;
  name: I18nText;
  description: I18nText;
  logo: string;
  countryCode: string;
  city: string;
  website: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected";
  memberSince: string;
  rating: number;
  reviewCount: number;
  responseHours: number;
  onTimeRate: number;
  fulfilledOrders: number;
  yearsActive: number;
  badges: string[];
  categories?: string[];
  reviews?: { id: string; rating: number; body: I18nText; at: string }[];
}

export interface RemoteCartLine {
  productId: string;
  supplierId: string;
  name: I18nText;
  image: string;
  unit: Unit;
  moq: number;
  availability: Availability;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  belowMoq: boolean;
}

export interface RemoteCart {
  lines: RemoteCartLine[];
  totals: { subtotal: number; shipping: number; tax: number; total: number };
}

export interface RemoteOrder {
  id: string;
  reference: string;
  buyerCompanyId: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "unpaid" | "authorized" | "paid" | "refunded" | "failed";
  paymentMethod: string;
  carrier: string | null;
  trackingNumber: string | null;
  etaDays: number;
  createdAt: string;
  lines: { productId: string | null; supplierId: string; name: I18nText; qty: number; unitPrice: number; unit: Unit }[];
  timeline?: { status: string; at: string; note?: I18nText }[];
}

export interface ShippingQuote {
  carrier: string;
  service: I18nText;
  cost: number;
  etaDays: number;
}


export interface RemoteQuote {
  id: string;
  supplierId: string;
  unitPrice: number;
  currency: string;
  moq: number;
  leadTimeDays: number;
  shippingCost: number;
  shippingTerms: string;
  paymentTerms: string;
  validUntil: string;
  notes: string;
  status: "submitted" | "revised" | "accepted" | "rejected" | "expired";
  createdAt: string;
}

export interface RemoteRfq {
  id: string;
  reference: string;
  buyerCompanyId: string;
  title: I18nText;
  categoryId: string;
  productId: string | null;
  qty: number;
  unit: Unit;
  targetPrice: number | null;
  currency: string;
  specs: string;
  neededBy: string;
  deliveryCity: string;
  deliveryCountry: string;
  paymentTerms: string;
  shippingTerms: string;
  notes: string;
  status: "open" | "quoted" | "awarded" | "closed" | "expired";
  createdAt: string;
  expiresAt: string;
  /** Present on the list endpoint only. */
  quoteCount?: number;
  bestQuote?: number | null;
  /** Present on the detail endpoint only. */
  invitedSupplierIds?: string[];
  quotes?: RemoteQuote[];
}

export interface NegotiationTerms {
  unitPrice: number;
  qty: number;
  moq: number;
  shippingCost: number;
  shippingTerms: string;
  paymentTerms: string;
}

export interface RemoteNegotiationRound {
  id: string;
  by: "buyer" | "supplier";
  actorName: string;
  kind: "offer" | "counter" | "accept" | "reject";
  terms: NegotiationTerms;
  message: string;
  at: string;
}

export interface RemoteNegotiation {
  id: string;
  reference: string;
  productId: string;
  buyerCompanyId: string;
  supplierId: string;
  rfqId: string | null;
  quoteId: string | null;
  currency: string;
  status: "active" | "accepted" | "rejected" | "converted";
  orderId: string | null;
  createdAt: string;
  rounds: RemoteNegotiationRound[];
}

export interface RemoteThread {
  id: string;
  buyerCompanyId: string;
  supplierId: string;
  subject: I18nText;
  lastMessageAt: string;
  unreadCount: number;
}

export interface RemoteMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  side: "buyer" | "supplier";
  kind: string;
  body: string;
  attachmentRef: string | null;
  readAt: string | null;
  at: string;
}


export interface BuyerAnalytics {
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  supplierCount: number;
  openRfqs: number;
  activeNegotiations: number;
  favourites: number;
  monthly: { month: string; value: number }[];
  topCategories: { categoryId: string; name: I18nText; value: number; share: number }[];
  topSuppliers: { supplierId: string; name: I18nText; logo: string; value: number; orderCount: number }[];
}

export interface ReorderSuggestion {
  productId: string;
  name: I18nText;
  image: string;
  avgIntervalDays: number;
  daysSinceLast: number;
  daysUntilReorder: number;
  suggestedQty: number;
  urgency: "overdue" | "soon" | "later";
}

export interface SupplierAnalytics {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  buyerCount: number;
  openRfqs: number;
  activeNegotiations: number;
  productCount: number;
  rating: number;
  onTimeRate: number;
  monthly: { month: string; value: number }[];
  topProducts: { productId: string; name: I18nText; image: string; value: number; qty: number }[];
  lowStock: { id: string; name: I18nText; image: string; stock: number; availability: string }[];
}

export interface CategoryIndex {
  categoryId: string;
  name: I18nText;
  icon: string;
  avgPrice: number;
  productCount: number;
  supplierCount: number;
  demandIndex: number;
  changeMonthPct: number;
}

export interface PriceAlert {
  productId: string;
  name: I18nText;
  image: string;
  current: number;
  previous: number;
  changePct: number;
  direction: "up" | "down";
}

export interface TrendingProduct {
  productId: string;
  name: I18nText;
  image: string;
  recentVolume: number;
  demandGrowthPct: number;
  priceChangePct: number;
  volumes: number[];
}

export interface SupplierRanking {
  supplierId: string;
  name: I18nText;
  logo: string;
  rating: number;
  onTimeRate: number;
  responseHours: number;
  fulfilledOrders: number;
  productCount: number;
  competitivenessPct: number;
  score: number;
}

export interface RegionDemand {
  countryCode: string;
  name: I18nText;
  orderCount: number;
  value: number;
  share: number;
}

export interface DemandForecast {
  history: { date: string; volume: number }[];
  projection: { date: string; volume: number; low: number; high: number }[];
  trendPerWeek: number;
  seasonalStrength: number;
  nextMonthUnits: number;
  confidence: number;
  priceOutlookPct: number;
  direction: "rising" | "flat" | "declining";
}

export interface PriceSummary {
  current: number;
  min: number;
  max: number;
  avg: number;
  changeWeekPct: number;
  changeMonthPct: number;
  changeQuarterPct: number;
  volatility: number;
}

export interface ProductQuery {
  q?: string;
  category?: string;
  supplier?: string;
  countries?: string;
  minPrice?: number;
  maxPrice?: number;
  maxMoq?: number;
  minRating?: number;
  availability?: string;
  tags?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export type AiIntent =
  | "search" | "rfq" | "negotiate" | "reorder" | "track_order"
  | "price_analysis" | "supplier_match" | "forecast" | "greeting" | "unknown";

export interface AiParsedQuery {
  raw: string;
  intent: AiIntent;
  keywords: string[];
  qty: number | null;
  unit: Unit | null;
  budget: number | null;
  budgetKind: "max" | "target" | null;
  city: string | null;
  countryCode: string | null;
  withinDays: number | null;
  paymentTerms: string | null;
  wantsCheapest: boolean;
  wantsFastest: boolean;
  wantsVerified: boolean;
  confidence: number;
}

export interface AiSupplierMatch {
  productId: string;
  supplierId: string;
  supplierName: I18nText;
  supplierLogo: string;
  name: I18nText;
  image: string;
  unitPrice: number;
  lineTotal: number;
  leadTimeDays: number;
  moq: number;
  availability: Availability;
  rating: number;
  verified: boolean;
  meetsBudget: boolean;
  meetsDeadline: boolean;
  meetsMoq: boolean;
  matchScore: number;
  reasons: I18nText[];
}

export type AiAction =
  | { kind: "view_product"; productId: string; label: I18nText }
  | { kind: "add_to_cart"; productId: string; qty: number; label: I18nText }
  | { kind: "create_rfq"; label: I18nText }
  | { kind: "negotiate"; productId: string; qty: number; targetPrice: number; label: I18nText }
  | { kind: "navigate"; href: string; label: I18nText };

export interface AiReply {
  parsed: AiParsedQuery;
  headline: I18nText;
  body: I18nText[];
  matches: AiSupplierMatch[];
  actions: AiAction[];
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  auth: {
    async login(email: string, password: string) {
      const session = await request<Session>("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
        retryOnExpiry: false,
      });
      setSession(session);
      // Login returns the user only; fetch the company so the rest of the app
      // can read it without another round trip on every page.
      await api.auth.hydrateCompany();
      return getSession()!;
    },

    async register(input: {
      name: string; email: string; phone: string; password: string;
      role: "buyer" | "supplier"; companyName: string; countryCode: string; city: string;
    }) {
      const session = await request<Session>("/api/v1/auth/register", {
        method: "POST",
        body: input,
        retryOnExpiry: false,
      });
      setSession(session);
      return session;
    },

    me: () => request<{ user: Session["user"]; company: SessionCompany | null }>("/api/v1/auth/me"),

    /** Refresh the cached user and company on the stored session. */
    async hydrateCompany() {
      const current = getSession();
      if (!current) return null;
      try {
        const { user, company } = await api.auth.me();
        setSession({ ...current, user, company });
        return company;
      } catch {
        // A stale session is cleared by the request layer; nothing to do here.
        return null;
      }
    },

    async logout(refreshToken?: string) {
      try {
        await request<void>("/api/v1/auth/logout", {
          method: "POST",
          body: { refreshToken },
          retryOnExpiry: false,
        });
      } catch {
        // Signing out locally must succeed even if the server call fails.
      }
      setSession(null);
    },
  },

  reference: {
    countries: () =>
      request<{ countries: { code: string; name: I18nText; currency: string; dialCode: string; cities: I18nText[] }[] }>(
        "/api/v1/reference/countries",
      ),
    categories: () =>
      request<{ categories: { id: string; parentId: string | null; slug: string; icon: string; name: I18nText }[] }>(
        "/api/v1/categories",
      ),
  },

  catalog: {
    products: (query: ProductQuery = {}, signal?: AbortSignal) =>
      request<Page<RemoteProduct>>("/api/v1/products", { query: query as Record<string, string>, signal }),
    product: (id: string, signal?: AbortSignal) =>
      request<{ product: RemoteProduct; priceHistory: { date: string; avgPrice: number; volume: number }[] }>(
        `/api/v1/products/${id}`,
        { signal },
      ),
    suppliers: (query: { q?: string; country?: string; category?: string; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<RemoteSupplier>>("/api/v1/suppliers", { query, signal }),
    supplier: (id: string, signal?: AbortSignal) => request<RemoteSupplier>(`/api/v1/suppliers/${id}`, { signal }),
  },

  cart: {
    get: (signal?: AbortSignal) => request<RemoteCart>("/api/v1/cart", { signal }),
    add: (productId: string, qty: number) =>
      request<RemoteCart>("/api/v1/cart/items", { method: "POST", body: { productId, qty } }),
    setQty: (productId: string, qty: number) =>
      request<RemoteCart>(`/api/v1/cart/items/${productId}`, { method: "PATCH", body: { qty } }),
    remove: (productId: string) => request<RemoteCart>(`/api/v1/cart/items/${productId}`, { method: "DELETE" }),
    clear: () => request<RemoteCart>("/api/v1/cart", { method: "DELETE" }),
  },

  favorites: {
    list: (signal?: AbortSignal) => request<{ productIds: string[] }>("/api/v1/favorites", { signal }),
    add: (productId: string) => request<{ favorited: boolean }>(`/api/v1/favorites/${productId}`, { method: "POST" }),
    remove: (productId: string) => request<{ favorited: boolean }>(`/api/v1/favorites/${productId}`, { method: "DELETE" }),
  },

  orders: {
    list: (query: { status?: string; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<RemoteOrder>>("/api/v1/orders", { query, signal }),
    get: (id: string, signal?: AbortSignal) => request<RemoteOrder>(`/api/v1/orders/${id}`, { signal }),
    create: (input: { shippingAddressId?: string | null; paymentMethod: string; carrier: string; etaDays: number }) =>
      request<RemoteOrder>("/api/v1/orders", { method: "POST", body: input }),
    advance: (id: string) => request<RemoteOrder>(`/api/v1/orders/${id}/advance`, { method: "POST" }),
    cancel: (id: string) => request<RemoteOrder>(`/api/v1/orders/${id}/cancel`, { method: "POST" }),
    shippingQuotes: (subtotal: number, from = "SA", to = "SA", signal?: AbortSignal) =>
      request<{ quotes: ShippingQuote[] }>("/api/v1/shipping/quotes", { query: { subtotal, from, to }, signal }),
  },


  rfq: {
    list: (query: { status?: string; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<RemoteRfq>>("/api/v1/rfqs", { query, signal }),
    get: (id: string, signal?: AbortSignal) => request<RemoteRfq>(`/api/v1/rfqs/${id}`, { signal }),
    create: (input: {
      title: string; categoryId: string; productId?: string | null; qty: number; unit: Unit;
      targetPrice?: number | null; specs?: string; neededBy: string; deliveryCity: string;
      deliveryCountry: string; paymentTerms?: string; shippingTerms?: string; notes?: string;
      supplierIds: string[];
    }) => request<RemoteRfq>("/api/v1/rfqs", { method: "POST", body: input }),
    submitQuote: (rfqId: string, input: {
      unitPrice: number; moq: number; leadTimeDays: number; shippingCost?: number;
      shippingTerms?: string; paymentTerms?: string; validDays?: number; notes?: string;
    }) => request<RemoteRfq>(`/api/v1/rfqs/${rfqId}/quotes`, { method: "POST", body: input }),
    award: (rfqId: string, quoteId: string) =>
      request<RemoteRfq>(`/api/v1/rfqs/${rfqId}/award/${quoteId}`, { method: "POST" }),
    close: (rfqId: string) => request<RemoteRfq>(`/api/v1/rfqs/${rfqId}/close`, { method: "POST" }),
  },

  negotiations: {
    list: (query: { status?: string; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<RemoteNegotiation>>("/api/v1/negotiations", { query, signal }),
    get: (id: string, signal?: AbortSignal) => request<RemoteNegotiation>(`/api/v1/negotiations/${id}`, { signal }),
    start: (input: NegotiationTerms & { productId: string; message?: string; rfqId?: string | null; quoteId?: string | null }) =>
      request<RemoteNegotiation>("/api/v1/negotiations", { method: "POST", body: input }),
    counter: (id: string, terms: NegotiationTerms & { message?: string }) =>
      request<RemoteNegotiation>(`/api/v1/negotiations/${id}/counter`, { method: "POST", body: terms }),
    decide: (id: string, decision: "accept" | "reject") =>
      request<RemoteNegotiation>(`/api/v1/negotiations/${id}/${decision}`, { method: "POST" }),
    convert: (id: string) =>
      request<{ orderId: string; reference: string }>(`/api/v1/negotiations/${id}/convert`, { method: "POST" }),
  },

  messaging: {
    threads: (signal?: AbortSignal) => request<{ threads: RemoteThread[] }>("/api/v1/threads", { signal }),
    open: (supplierId: string, subject: string) =>
      request<{ id: string; subject: I18nText }>("/api/v1/threads", { method: "POST", body: { supplierId, subject } }),
    messages: (threadId: string, signal?: AbortSignal) =>
      request<{ thread: { id: string; buyerCompanyId: string; supplierId: string; subject: I18nText }; messages: RemoteMessage[] }>(
        `/api/v1/threads/${threadId}/messages`,
        { signal },
      ),
    send: (threadId: string, body: string) =>
      request<{ id: string; at: string }>(`/api/v1/threads/${threadId}/messages`, { method: "POST", body: { body } }),
    markRead: (threadId: string) => request<void>(`/api/v1/threads/${threadId}/read`, { method: "POST" }),
  },

  admin: {
    stats: (signal?: AbortSignal) =>
      request<{
        users: number; companies: number; suppliers: number; products: number; orders: number;
        openRfqs: number; activeNegotiations: number; pendingVerification: number;
        gmv: number; avgOrderValue: number;
      }>("/api/v1/admin/stats", { signal }),
    companies: (query: { verification?: string; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<{
        id: string; name: I18nText; logo: string; taxId: string; email: string;
        countryCode: string; city: string; verification: string; memberSince: string; isSupplier: boolean;
      }>>("/api/v1/admin/companies", { query, signal }),
    setVerification: (companyId: string, status: string) =>
      request<{ id: string; verification: string }>(`/api/v1/admin/companies/${companyId}/verification`, {
        method: "PATCH",
        body: { status },
      }),
    audit: (query: { page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<{ id: number; actorId: string | null; action: string; target: string; at: string }>>(
        "/api/v1/admin/audit",
        { query, signal },
      ),
  },

  analytics: {
    buyer: (signal?: AbortSignal) => request<BuyerAnalytics>("/api/v1/analytics/buyer", { signal }),
    reorders: (signal?: AbortSignal) =>
      request<{ suggestions: ReorderSuggestion[] }>("/api/v1/analytics/buyer/reorders", { signal }),
    supplier: (signal?: AbortSignal) => request<SupplierAnalytics>("/api/v1/analytics/supplier", { signal }),
  },

  platform: {
    stats: (signal?: AbortSignal) =>
      request<{ suppliers: number; products: number; orders: number; rfqs: number }>("/api/v1/stats", { signal }),
  },

  intelligence: {
    categories: (signal?: AbortSignal) =>
      request<{ categories: CategoryIndex[] }>("/api/v1/intelligence/categories", { signal }),
    alerts: (signal?: AbortSignal) => request<{ alerts: PriceAlert[] }>("/api/v1/intelligence/alerts", { signal }),
    trending: (signal?: AbortSignal) =>
      request<{ trending: TrendingProduct[] }>("/api/v1/intelligence/trending", { signal }),
    suppliers: (signal?: AbortSignal) =>
      request<{ suppliers: SupplierRanking[] }>("/api/v1/intelligence/suppliers", { signal }),
    regions: (signal?: AbortSignal) => request<{ regions: RegionDemand[] }>("/api/v1/intelligence/regions", { signal }),
    forecast: (productId: string, signal?: AbortSignal) =>
      request<{ productId: string; forecast: DemandForecast; priceSummary: PriceSummary | null }>(
        `/api/v1/forecast/${productId}`,
        { signal },
      ),
  },

  ai: {
    query: (q: string, signal?: AbortSignal) =>
      request<AiReply>("/api/v1/ai/query", { method: "POST", body: { q }, signal }),
    prompts: (signal?: AbortSignal) =>
      request<{ prompts: { ar: string[]; en: string[] } }>("/api/v1/ai/prompts", { signal }),
  },

  notifications: {
    list: (query: { unreadOnly?: boolean; page?: number; perPage?: number } = {}, signal?: AbortSignal) =>
      request<Page<{ id: string; kind: string; title: I18nText; body: I18nText; href: string; channels: string[]; read: boolean; at: string }> & { unreadCount: number }>(
        "/api/v1/notifications",
        { query: query as Record<string, string>, signal },
      ),
    markRead: (id: string) => request<void>(`/api/v1/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request<void>("/api/v1/notifications/read-all", { method: "POST" }),
  },
};
