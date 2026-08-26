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

  notifications: {
    list: (query: { unreadOnly?: boolean; page?: number } = {}, signal?: AbortSignal) =>
      request<Page<{ id: string; kind: string; title: I18nText; body: I18nText; href: string; channels: string[]; read: boolean; at: string }> & { unreadCount: number }>(
        "/api/v1/notifications",
        { query: query as Record<string, string>, signal },
      ),
    markRead: (id: string) => request<void>(`/api/v1/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request<void>("/api/v1/notifications/read-all", { method: "POST" }),
  },
};
