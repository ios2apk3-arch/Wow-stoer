import { nowIso, store, uid } from "./store";
import { estimateShipping, round2, unitPrice, VAT_RATE } from "./pricing";
import { payments, shipping } from "./adapters";
import type {
  Company,
  Negotiation,
  NegotiationTerms,
  Notification,
  Order,
  OrderLine,
  OrderStatus,
  Product,
  Quote,
  Rfq,
  Role,
  Supplier,
  Unit,
  User,
} from "./types";

const db = () => store.getState();

/* ------------------------------------------------------------------ auth */

export const auth = {
  currentUser(): User | null {
    const { session, users } = db();
    return users.find((u) => u.id === session.userId) ?? null;
  },

  currentCompany(): Company | null {
    const user = auth.currentUser();
    if (!user?.companyId) return null;
    return db().companies.find((c) => c.id === user.companyId) ?? null;
  },

  /** Demo sign-in: any known email is accepted, password is not checked. */
  login(email: string): User | null {
    const user = db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return null;
    store.update((d) => {
      d.session.userId = user.id;
      d.audit.push({ id: uid("aud"), actorId: user.id, action: "auth.login", target: user.email, at: nowIso() });
    });
    return user;
  },

  loginAs(userId: string) {
    store.update((d) => {
      d.session.userId = userId;
    });
  },

  logout() {
    store.update((d) => {
      d.session.userId = null;
    });
  },

  register(input: {
    name: string;
    email: string;
    phone: string;
    role: Role;
    companyName: string;
    countryCode: string;
    city: string;
  }): User {
    const companyId = uid("co");
    const userId = uid("u");
    store.update((d) => {
      d.companies.push({
        id: companyId,
        name: { ar: input.companyName, en: input.companyName },
        legalName: input.companyName,
        taxId: "",
        logo: input.role === "supplier" ? "🏭" : "🏪",
        description: { ar: "", en: "" },
        countryCode: input.countryCode,
        city: input.city,
        phone: input.phone,
        email: input.email,
        verification: "pending",
        memberSince: nowIso(),
        addresses: [],
      });
      if (input.role === "supplier") {
        d.suppliers.push({
          id: companyId,
          companyId,
          categories: [],
          rating: 0,
          reviewCount: 0,
          responseHours: 24,
          onTimeRate: 0,
          fulfilledOrders: 0,
          yearsActive: 0,
          badges: [],
        });
      }
      d.users.push({
        id: userId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        companyId,
        avatarColor: "#0369a1",
        createdAt: nowIso(),
      });
      d.session.userId = userId;
      d.audit.push({ id: uid("aud"), actorId: userId, action: "auth.register", target: input.email, at: nowIso() });
    });
    return db().users.find((u) => u.id === userId)!;
  },
};

/** Role-based access control. One place decides who may do what. */
const permissions: Record<Role, string[]> = {
  buyer: ["cart.*", "order.create", "order.read.own", "rfq.create", "rfq.read.own", "negotiation.*", "message.*"],
  supplier: ["product.*", "quote.*", "order.read.supplied", "order.fulfil", "negotiation.*", "message.*"],
  admin: ["*"],
};

export function can(user: User | null, action: string): boolean {
  if (!user) return false;
  return permissions[user.role].some(
    (rule) => rule === "*" || rule === action || (rule.endsWith(".*") && action.startsWith(rule.slice(0, -1))),
  );
}

/* --------------------------------------------------------------- catalog */

export interface ProductFilters {
  query?: string;
  categoryId?: string;
  supplierId?: string;
  countries?: string[];
  minPrice?: number;
  maxPrice?: number;
  maxMoq?: number;
  minRating?: number;
  availability?: string[];
  tags?: string[];
  sort?: "relevance" | "price_asc" | "price_desc" | "rating" | "newest" | "popular" | "lead_time";
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const catalog = {
  products: () => db().products,
  suppliers: () => db().suppliers,
  categories: () => db().categories,

  product: (id: string) => db().products.find((p) => p.id === id) ?? null,
  supplier: (id: string) => db().suppliers.find((s) => s.id === id) ?? null,

  supplierCompany(supplierId: string): Company | null {
    const sup = catalog.supplier(supplierId);
    if (!sup) return null;
    return db().companies.find((c) => c.id === sup.companyId) ?? null;
  },

  supplierName(supplierId: string, locale: "ar" | "en"): string {
    return catalog.supplierCompany(supplierId)?.name[locale] ?? supplierId;
  },

  /** Descendant-aware category filter: a parent matches all of its children. */
  categoryMatches(product: Product, categoryId: string): boolean {
    if (product.categoryId === categoryId) return true;
    const cat = db().categories.find((c) => c.id === product.categoryId);
    return cat?.parentId === categoryId;
  },

  search(filters: ProductFilters): Product[] {
    const terms = filters.query ? norm(filters.query).split(" ").filter((t) => t.length > 1) : [];
    let list = db().products.filter((p) => {
      if (filters.categoryId && !catalog.categoryMatches(p, filters.categoryId)) return false;
      if (filters.supplierId && p.supplierId !== filters.supplierId) return false;
      if (filters.countries?.length && !filters.countries.includes(p.originCountry)) return false;
      if (filters.minPrice != null && p.tiers[0].price < filters.minPrice) return false;
      if (filters.maxPrice != null && p.tiers[0].price > filters.maxPrice) return false;
      if (filters.maxMoq != null && p.moq > filters.maxMoq) return false;
      if (filters.minRating != null && p.rating < filters.minRating) return false;
      if (filters.availability?.length && !filters.availability.includes(p.availability)) return false;
      if (filters.tags?.length && !filters.tags.some((t) => p.tags.includes(t))) return false;
      if (terms.length) {
        const haystack = norm(
          [p.name.ar, p.name.en, p.brand, p.tags.join(" "), catalog.supplierName(p.supplierId, "ar"), catalog.supplierName(p.supplierId, "en")].join(" "),
        );
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    });

    const score = (p: Product) => {
      if (!terms.length) return 0;
      const name = norm(`${p.name.ar} ${p.name.en}`);
      return terms.reduce((acc, t) => acc + (name.includes(t) ? 2 : 1), 0);
    };

    const sort = filters.sort ?? "relevance";
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.tiers[0].price - b.tiers[0].price;
        case "price_desc":
          return b.tiers[0].price - a.tiers[0].price;
        case "rating":
          return b.rating - a.rating;
        case "newest":
          return a.createdAt < b.createdAt ? 1 : -1;
        case "popular":
          return b.soldUnits - a.soldUnits;
        case "lead_time":
          return a.leadTimeDays - b.leadTimeDays;
        default:
          return score(b) - score(a) || b.soldUnits - a.soldUnits;
      }
    });
    return list;
  },

  searchSuppliers(query: string): Supplier[] {
    const q = norm(query);
    if (!q) return db().suppliers;
    return db().suppliers.filter((s) => {
      const co = catalog.supplierCompany(s.id);
      if (!co) return false;
      return norm(`${co.name.ar} ${co.name.en} ${co.city} ${co.description.en}`).includes(q);
    });
  },

  featuredProducts: (n = 8) => [...db().products].sort((a, b) => b.rating - a.rating).slice(0, n),
  bestSellers: (n = 8) => [...db().products].sort((a, b) => b.soldUnits - a.soldUnits).slice(0, n),
  newArrivals: (n = 8) => [...db().products].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, n),
  featuredSuppliers: (n = 6) =>
    [...db().suppliers].sort((a, b) => b.rating * b.fulfilledOrders - a.rating * a.fulfilledOrders).slice(0, n),

  reviewsForSupplier: (supplierId: string) => db().reviews.filter((r) => r.supplierId === supplierId),

  addProduct(input: Omit<Product, "id" | "createdAt">): Product {
    const id = uid("p");
    store.update((d) => {
      d.products.push({ ...input, id, createdAt: nowIso() });
    });
    return catalog.product(id)!;
  },

  updateProduct(id: string, patch: Partial<Product>) {
    store.update((d) => {
      const idx = d.products.findIndex((p) => p.id === id);
      if (idx >= 0) d.products[idx] = { ...d.products[idx], ...patch };
    });
  },

  removeProduct(id: string) {
    store.update((d) => {
      d.products = d.products.filter((p) => p.id !== id);
    });
  },
};

/* ------------------------------------------------------------------ cart */

export const cart = {
  lines: () => db().cart,

  detailed() {
    return db()
      .cart.map((line) => {
        const product = catalog.product(line.productId);
        if (!product) return null;
        const price = unitPrice(product, line.qty);
        return { line, product, price, total: round2(price * line.qty) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  },

  count: () => db().cart.reduce((n, l) => n + 1, 0),

  add(productId: string, qty: number) {
    store.update((d) => {
      const existing = d.cart.find((l) => l.productId === productId);
      if (existing) existing.qty += qty;
      else d.cart.push({ productId, qty, addedAt: nowIso() });
    });
  },

  setQty(productId: string, qty: number) {
    store.update((d) => {
      const line = d.cart.find((l) => l.productId === productId);
      if (!line) return;
      if (qty <= 0) d.cart = d.cart.filter((l) => l.productId !== productId);
      else line.qty = qty;
    });
  },

  remove(productId: string) {
    store.update((d) => {
      d.cart = d.cart.filter((l) => l.productId !== productId);
    });
  },

  clear() {
    store.update((d) => {
      d.cart = [];
    });
  },

  totals(sameCountry = true) {
    const lines = cart.detailed();
    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const ship = lines.length ? estimateShipping(subtotal, sameCountry) : 0;
    const tax = round2((subtotal + ship) * VAT_RATE);
    return { subtotal, shipping: ship, tax, total: round2(subtotal + ship + tax), lineCount: lines.length };
  },
};

export const favorites = {
  list: () => db().favorites,
  has: (productId: string) => db().favorites.includes(productId),
  toggle(productId: string) {
    store.update((d) => {
      d.favorites = d.favorites.includes(productId)
        ? d.favorites.filter((f) => f !== productId)
        : [...d.favorites, productId];
    });
  },
};

/* ---------------------------------------------------------------- orders */

const statusFlow: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export const orders = {
  all: () => db().orders,

  forBuyer: (companyId: string) => db().orders.filter((o) => o.buyerCompanyId === companyId),

  forSupplier: (supplierId: string) =>
    db().orders.filter((o) => o.lines.some((l) => l.supplierId === supplierId)),

  get: (id: string) => db().orders.find((o) => o.id === id) ?? null,

  async createFromCart(input: {
    buyerCompanyId: string;
    shippingAddressId: string;
    paymentMethod: string;
    carrier: string;
    etaDays: number;
    shippingCost: number;
  }): Promise<Order> {
    const detailed = cart.detailed();
    if (!detailed.length) throw new Error("Cart is empty");

    const lines: OrderLine[] = detailed.map(({ product, line, price }) => ({
      productId: product.id,
      productName: product.name,
      supplierId: product.supplierId,
      qty: line.qty,
      unitPrice: price,
      unit: product.unit,
    }));
    const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    const tax = round2((subtotal + input.shippingCost) * VAT_RATE);
    const intent = await payments.authorize(round2(subtotal + input.shippingCost + tax), "SAR", input.paymentMethod);

    const id = uid("ord");
    store.update((d) => {
      d.orders.unshift({
        id,
        reference: `WAW-${30000 + d.orders.length}`,
        buyerCompanyId: input.buyerCompanyId,
        lines,
        subtotal,
        shipping: input.shippingCost,
        tax,
        total: round2(subtotal + input.shippingCost + tax),
        currency: "SAR",
        status: "pending",
        paymentStatus: intent.status === "authorized" ? "authorized" : "unpaid",
        paymentMethod: input.paymentMethod,
        shippingAddressId: input.shippingAddressId,
        etaDays: input.etaDays,
        carrier: input.carrier,
        timeline: [{ status: "pending", at: nowIso() }],
        createdAt: nowIso(),
      });
      d.cart = [];
      const supplierIds = [...new Set(lines.map((l) => l.supplierId))];
      for (const supplierId of supplierIds) {
        const supUser = d.users.find((u) => u.companyId === `co-${supplierId}`);
        if (!supUser) continue;
        d.notifications.unshift({
          id: uid("n"),
          userId: supUser.id,
          kind: "order_new",
          title: { ar: "طلب جديد", en: "New order" },
          body: { ar: "وصلك طلب شراء جديد بانتظار التأكيد.", en: "A new purchase order is awaiting confirmation." },
          href: `/order/${id}`,
          at: nowIso(),
          read: false,
          channels: ["in_app", "email", "push"],
        });
      }
    });
    return orders.get(id)!;
  },

  advance(id: string) {
    store.update((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (!order || order.status === "cancelled") return;
      const next = statusFlow[statusFlow.indexOf(order.status) + 1];
      if (!next) return;
      order.status = next;
      order.timeline.push({ status: next, at: nowIso() });
      if (next === "shipped") {
        order.carrier = order.carrier ?? "WAW Fleet";
        order.trackingNumber = `TRK${Math.floor(Math.random() * 9e8 + 1e8)}`;
      }
      if (next === "delivered") order.paymentStatus = "paid";
      const buyerUser = d.users.find((u) => u.companyId === order.buyerCompanyId);
      if (buyerUser) {
        d.notifications.unshift({
          id: uid("n"),
          userId: buyerUser.id,
          kind: "order_status",
          title: { ar: "تحديث حالة الطلب", en: "Order status updated" },
          body: { ar: `طلبك ${order.reference} أصبح في مرحلة جديدة.`, en: `Order ${order.reference} moved to a new stage.` },
          href: `/order/${order.id}`,
          at: nowIso(),
          read: false,
          channels: ["in_app", "push"],
        });
      }
    });
  },

  cancel(id: string) {
    store.update((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (!order || ["delivered", "cancelled"].includes(order.status)) return;
      order.status = "cancelled";
      order.paymentStatus = order.paymentStatus === "paid" ? "refunded" : "unpaid";
      order.timeline.push({ status: "cancelled", at: nowIso() });
    });
  },

  quoteShipping: (subtotal: number, from: string, to: string) => shipping.quote(subtotal, from, to),
};

/* ------------------------------------------------------------------- RFQ */

export const rfq = {
  all: () => db().rfqs,
  forBuyer: (companyId: string) => db().rfqs.filter((r) => r.buyerCompanyId === companyId),
  forSupplier: (supplierId: string) => db().rfqs.filter((r) => r.invitedSupplierIds.includes(supplierId)),
  get: (id: string) => db().rfqs.find((r) => r.id === id) ?? null,
  quotesFor: (rfqId: string) => db().quotes.filter((q) => q.rfqId === rfqId),
  quote: (id: string) => db().quotes.find((q) => q.id === id) ?? null,

  create(input: Omit<Rfq, "id" | "reference" | "status" | "createdAt" | "expiresAt">): Rfq {
    const id = uid("rfq");
    store.update((d) => {
      d.rfqs.unshift({
        ...input,
        id,
        reference: `RFQ-${5000 + d.rfqs.length}`,
        status: "open",
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      });
      for (const supplierId of input.invitedSupplierIds) {
        const supUser = d.users.find((u) => u.companyId === `co-${supplierId}`);
        if (!supUser) continue;
        d.notifications.unshift({
          id: uid("n"),
          userId: supUser.id,
          kind: "rfq_new",
          title: { ar: "دعوة لتقديم عرض سعر", en: "Invitation to quote" },
          body: { ar: "تمت دعوتك لتقديم عرض على طلب توريد جديد.", en: "You were invited to quote a new sourcing request." },
          href: `/rfq/${id}`,
          at: nowIso(),
          read: false,
          channels: ["in_app", "email", "whatsapp"],
        });
      }
    });
    return rfq.get(id)!;
  },

  submitQuote(input: Omit<Quote, "id" | "status" | "createdAt">): Quote {
    const id = uid("q");
    store.update((d) => {
      d.quotes.unshift({ ...input, id, status: "submitted", createdAt: nowIso() });
      const parent = d.rfqs.find((r) => r.id === input.rfqId);
      if (parent) {
        parent.status = "quoted";
        const buyerUser = d.users.find((u) => u.companyId === parent.buyerCompanyId);
        if (buyerUser) {
          d.notifications.unshift({
            id: uid("n"),
            userId: buyerUser.id,
            kind: "quote_new",
            title: { ar: "عرض سعر جديد", en: "New quotation" },
            body: { ar: `استلمت عرضًا جديدًا على ${parent.reference}.`, en: `A new quote arrived on ${parent.reference}.` },
            href: `/rfq/${parent.id}`,
            at: nowIso(),
            read: false,
            channels: ["in_app", "email", "push"],
          });
        }
      }
    });
    return rfq.quote(id)!;
  },

  reviseQuote(quoteId: string, patch: Partial<Quote>) {
    store.update((d) => {
      const q = d.quotes.find((x) => x.id === quoteId);
      if (q) Object.assign(q, patch, { status: "revised" });
    });
  },

  acceptQuote(quoteId: string) {
    store.update((d) => {
      const q = d.quotes.find((x) => x.id === quoteId);
      if (!q) return;
      q.status = "accepted";
      d.quotes.filter((o) => o.rfqId === q.rfqId && o.id !== quoteId).forEach((o) => (o.status = "rejected"));
      const parent = d.rfqs.find((r) => r.id === q.rfqId);
      if (parent) parent.status = "awarded";
    });
  },

  close(rfqId: string) {
    store.update((d) => {
      const r = d.rfqs.find((x) => x.id === rfqId);
      if (r) r.status = "closed";
    });
  },
};

/* ---------------------------------------------------------- negotiations */

export const negotiation = {
  all: () => db().negotiations,
  forBuyer: (companyId: string) => db().negotiations.filter((n) => n.buyerCompanyId === companyId),
  forSupplier: (supplierId: string) => db().negotiations.filter((n) => n.supplierId === supplierId),
  get: (id: string) => db().negotiations.find((n) => n.id === id) ?? null,

  start(input: {
    productId: string;
    buyerCompanyId: string;
    supplierId: string;
    actorName: string;
    terms: NegotiationTerms;
    message: string;
    rfqId?: string;
    quoteId?: string;
  }): Negotiation {
    const id = uid("neg");
    store.update((d) => {
      d.negotiations.unshift({
        id,
        reference: `NEG-${8000 + d.negotiations.length}`,
        productId: input.productId,
        buyerCompanyId: input.buyerCompanyId,
        supplierId: input.supplierId,
        rfqId: input.rfqId,
        quoteId: input.quoteId,
        currency: "SAR",
        status: "active",
        createdAt: nowIso(),
        rounds: [
          {
            id: uid("nr"),
            by: "buyer",
            actorName: input.actorName,
            kind: "offer",
            terms: input.terms,
            message: input.message,
            at: nowIso(),
          },
        ],
      });
    });
    return negotiation.get(id)!;
  },

  counter(id: string, by: "buyer" | "supplier", actorName: string, terms: NegotiationTerms, message: string) {
    store.update((d) => {
      const n = d.negotiations.find((x) => x.id === id);
      if (!n || n.status !== "active") return;
      n.rounds.push({ id: uid("nr"), by, actorName, kind: "counter", terms, message, at: nowIso() });
    });
  },

  resolve(id: string, by: "buyer" | "supplier", actorName: string, accept: boolean, message: string) {
    store.update((d) => {
      const n = d.negotiations.find((x) => x.id === id);
      if (!n || n.status !== "active") return;
      const last = n.rounds[n.rounds.length - 1];
      n.rounds.push({
        id: uid("nr"),
        by,
        actorName,
        kind: accept ? "accept" : "reject",
        terms: last.terms,
        message,
        at: nowIso(),
      });
      n.status = accept ? "accepted" : "rejected";
    });
  },

  /** Turn an accepted negotiation into a real order — phase 10's end state. */
  async convertToOrder(id: string): Promise<Order | null> {
    const n = negotiation.get(id);
    if (!n || n.status !== "accepted") return null;
    const product = catalog.product(n.productId);
    if (!product) return null;
    const terms = n.rounds[n.rounds.length - 1].terms;
    const subtotal = round2(terms.unitPrice * terms.qty);
    const tax = round2((subtotal + terms.shippingCost) * VAT_RATE);
    const orderId = uid("ord");
    store.update((d) => {
      d.orders.unshift({
        id: orderId,
        reference: `WAW-${30000 + d.orders.length}`,
        buyerCompanyId: n.buyerCompanyId,
        lines: [
          {
            productId: product.id,
            productName: product.name,
            supplierId: product.supplierId,
            qty: terms.qty,
            unitPrice: terms.unitPrice,
            unit: product.unit,
          },
        ],
        subtotal,
        shipping: terms.shippingCost,
        tax,
        total: round2(subtotal + terms.shippingCost + tax),
        currency: "SAR",
        status: "confirmed",
        paymentStatus: "authorized",
        paymentMethod: terms.paymentTerms,
        shippingAddressId: "",
        etaDays: product.leadTimeDays,
        timeline: [
          { status: "pending", at: nowIso() },
          { status: "confirmed", at: nowIso(), note: { ar: "ناتج عن اتفاق تفاوض", en: "Created from an agreed negotiation" } },
        ],
        createdAt: nowIso(),
      });
      const neg = d.negotiations.find((x) => x.id === id);
      if (neg) {
        neg.status = "converted";
        neg.orderId = orderId;
      }
    });
    return orders.get(orderId);
  },
};

/* -------------------------------------------------------------- messages */

export const messaging = {
  threads: () => db().threads,
  threadsForBuyer: (companyId: string) => db().threads.filter((t) => t.buyerCompanyId === companyId),
  threadsForSupplier: (supplierId: string) => db().threads.filter((t) => t.supplierId === supplierId),
  thread: (id: string) => db().threads.find((t) => t.id === id) ?? null,
  messages: (threadId: string) =>
    db()
      .messages.filter((m) => m.threadId === threadId)
      .sort((a, b) => (a.at < b.at ? -1 : 1)),

  openThread(buyerCompanyId: string, supplierId: string, subject: { ar: string; en: string }) {
    const existing = db().threads.find((t) => t.buyerCompanyId === buyerCompanyId && t.supplierId === supplierId);
    if (existing) return existing;
    const id = uid("th");
    store.update((d) => {
      d.threads.unshift({ id, buyerCompanyId, supplierId, subject, lastMessageAt: nowIso() });
    });
    return messaging.thread(id)!;
  },

  send(threadId: string, senderId: string, senderName: string, side: "buyer" | "supplier" | "ai", body: string, kind: "text" | "quote" | "product" | "order" | "file" | "ai" = "text", attachmentRef?: string) {
    store.update((d) => {
      d.messages.push({
        id: uid("m"),
        threadId,
        senderId,
        senderName,
        side,
        kind,
        body,
        attachmentRef,
        at: nowIso(),
        read: false,
      });
      const t = d.threads.find((x) => x.id === threadId);
      if (t) t.lastMessageAt = nowIso();
    });
  },

  markRead(threadId: string) {
    store.update((d) => {
      d.messages.filter((m) => m.threadId === threadId).forEach((m) => (m.read = true));
    });
  },

  unreadCount: (userId: string) =>
    db().messages.filter((m) => !m.read && m.senderId !== userId).length,
};

/* --------------------------------------------------------- notifications */

export const notifications = {
  forUser: (userId: string): Notification[] =>
    db()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => (a.at < b.at ? 1 : -1)),

  unreadCount: (userId: string) => db().notifications.filter((n) => n.userId === userId && !n.read).length,

  markRead(id: string) {
    store.update((d) => {
      const n = d.notifications.find((x) => x.id === id);
      if (n) n.read = true;
    });
  },

  markAllRead(userId: string) {
    store.update((d) => {
      d.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
    });
  },

  push(n: Omit<Notification, "id" | "at" | "read">) {
    store.update((d) => {
      d.notifications.unshift({ ...n, id: uid("n"), at: nowIso(), read: false });
    });
  },
};

/* ---------------------------------------------------------------- admin */

export const admin = {
  companies: () => db().companies,
  users: () => db().users,
  audit: () => db().audit,

  setVerification(companyId: string, status: Company["verification"]) {
    store.update((d) => {
      const c = d.companies.find((x) => x.id === companyId);
      if (!c) return;
      c.verification = status;
      d.audit.unshift({
        id: uid("aud"),
        actorId: d.session.userId ?? "system",
        action: `company.verification.${status}`,
        target: companyId,
        at: nowIso(),
      });
    });
  },

  stats() {
    const d = db();
    const gmv = d.orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    return {
      users: d.users.length,
      companies: d.companies.length,
      suppliers: d.suppliers.length,
      products: d.products.length,
      orders: d.orders.length,
      openRfqs: d.rfqs.filter((r) => r.status === "open" || r.status === "quoted").length,
      activeNegotiations: d.negotiations.filter((n) => n.status === "active").length,
      pendingVerification: d.companies.filter((c) => c.verification === "pending").length,
      gmv: round2(gmv),
      avgOrderValue: d.orders.length ? round2(gmv / d.orders.length) : 0,
    };
  },
};

export const platform = { auth, can, catalog, cart, favorites, orders, rfq, negotiation, messaging, notifications, admin, store };
export type { Unit };
