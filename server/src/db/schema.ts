import {
  bigserial, boolean, char, date, index, integer, jsonb, numeric, pgEnum, pgTable,
  primaryKey, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

/** Mirrors migrations/0001_init.sql. The SQL is authoritative; this is the typed view. */

export const verificationStatus = pgEnum("verification_status", ["unverified", "pending", "verified", "rejected"]);
export const userRole = pgEnum("user_role", ["buyer", "supplier", "admin"]);
export const productUnit = pgEnum("product_unit", ["carton", "pallet", "kg", "piece", "liter", "box"]);
export const availabilityStatus = pgEnum("availability_status", ["in_stock", "low_stock", "made_to_order", "out_of_stock"]);
export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "authorized", "paid", "refunded", "failed"]);
export const rfqStatus = pgEnum("rfq_status", ["open", "quoted", "awarded", "closed", "expired"]);
export const quoteStatus = pgEnum("quote_status", ["submitted", "revised", "accepted", "rejected", "expired"]);
export const negotiationStatus = pgEnum("negotiation_status", ["active", "accepted", "rejected", "converted"]);
export const negotiationParty = pgEnum("negotiation_party", ["buyer", "supplier"]);
export const negotiationRoundKind = pgEnum("negotiation_round_kind", ["offer", "counter", "accept", "reject"]);
export const messageKind = pgEnum("message_kind", ["text", "quote", "product", "order", "file", "ai"]);

export const countries = pgTable("countries", {
  code: char("code", { length: 2 }).primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  dialCode: text("dial_code").notNull(),
});

export const cities = pgTable("cities", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  countryCode: char("country_code", { length: 2 }).notNull().references(() => countries.code),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  slug: text("slug").notNull(),
  icon: text("icon").notNull().default(""),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  legalName: text("legal_name").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  logo: text("logo").notNull().default(""),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  countryCode: char("country_code", { length: 2 }).notNull(),
  city: text("city").notNull().default(""),
  website: text("website"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  verification: verificationStatus("verification").notNull().default("pending"),
  memberSince: timestamp("member_since", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  labelAr: text("label_ar").notNull().default(""),
  labelEn: text("label_en").notNull().default(""),
  line: text("line").notNull(),
  city: text("city").notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  role: userRole("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull().default("#0369a1"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: uuid("replaced_by"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  responseHours: numeric("response_hours", { precision: 6, scale: 2 }).notNull().default("24"),
  onTimeRate: numeric("on_time_rate", { precision: 4, scale: 3 }).notNull().default("0"),
  fulfilledOrders: integer("fulfilled_orders").notNull().default(0),
  yearsActive: integer("years_active").notNull().default(0),
  badges: text("badges").array().notNull().default([]),
});

export const supplierCategories = pgTable("supplier_categories", {
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.supplierId, t.categoryId] })]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  brand: text("brand").notNull().default(""),
  image: text("image").notNull().default(""),
  specs: jsonb("specs").notNull().default([]),
  unit: productUnit("unit").notNull(),
  moq: integer("moq").notNull(),
  stock: integer("stock").notNull().default(0),
  leadTimeDays: integer("lead_time_days").notNull().default(1),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  originCountry: char("origin_country", { length: 2 }).notNull(),
  availability: availabilityStatus("availability").notNull().default("in_stock"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  soldUnits: integer("sold_units").notNull().default(0),
  tags: text("tags").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Generated by Postgres; read-only from the application. */
  searchVector: text("search_vector"),
});

export const priceTiers = pgTable("price_tiers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  minQty: integer("min_qty").notNull(),
  price: numeric("price", { precision: 14, scale: 4 }).notNull(),
});

export const priceHistory = pgTable("price_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  observedOn: date("observed_on").notNull(),
  avgPrice: numeric("avg_price", { precision: 14, scale: 4 }).notNull(),
  volume: integer("volume").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  buyerCompanyId: uuid("buyer_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  rating: smallint("rating").notNull(),
  bodyAr: text("body_ar").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable("favorites", {
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.companyId, t.productId] })]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull(),
  buyerCompanyId: uuid("buyer_company_id").notNull().references(() => companies.id),
  subtotal: numeric("subtotal", { precision: 14, scale: 4 }).notNull(),
  shipping: numeric("shipping", { precision: 14, scale: 4 }).notNull().default("0"),
  tax: numeric("tax", { precision: 14, scale: 4 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  status: orderStatus("status").notNull().default("pending"),
  paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method").notNull().default(""),
  paymentRef: text("payment_ref"),
  shippingAddressId: uuid("shipping_address_id").references(() => addresses.id, { onDelete: "set null" }),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  etaDays: integer("eta_days").notNull().default(0),
  sourceRfqId: uuid("source_rfq_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
  unit: productUnit("unit").notNull(),
});

export const orderEvents = pgTable("order_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: orderStatus("status").notNull(),
  noteAr: text("note_ar"),
  noteEn: text("note_en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rfqs = pgTable("rfqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull(),
  buyerCompanyId: uuid("buyer_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  categoryId: text("category_id").notNull().references(() => categories.id),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  qty: integer("qty").notNull(),
  unit: productUnit("unit").notNull(),
  targetPrice: numeric("target_price", { precision: 14, scale: 4 }),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  specs: text("specs").notNull().default(""),
  neededBy: date("needed_by").notNull(),
  deliveryCity: text("delivery_city").notNull().default(""),
  deliveryCountry: char("delivery_country", { length: 2 }).notNull(),
  paymentTerms: text("payment_terms").notNull().default(""),
  shippingTerms: text("shipping_terms").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: rfqStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rfqInvitations = pgTable("rfq_invitations", {
  rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.rfqId, t.supplierId] })]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  moq: integer("moq").notNull(),
  leadTimeDays: integer("lead_time_days").notNull(),
  shippingCost: numeric("shipping_cost", { precision: 14, scale: 4 }).notNull().default("0"),
  shippingTerms: text("shipping_terms").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default(""),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  notes: text("notes").notNull().default(""),
  status: quoteStatus("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  buyerCompanyId: uuid("buyer_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  rfqId: uuid("rfq_id").references(() => rfqs.id, { onDelete: "set null" }),
  quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  status: negotiationStatus("status").notNull().default("active"),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const negotiationRounds = pgTable("negotiation_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id, { onDelete: "cascade" }),
  byParty: negotiationParty("by_party").notNull(),
  actorName: text("actor_name").notNull().default(""),
  kind: negotiationRoundKind("kind").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
  qty: integer("qty").notNull(),
  moq: integer("moq").notNull(),
  shippingCost: numeric("shipping_cost", { precision: 14, scale: 4 }).notNull().default("0"),
  shippingTerms: text("shipping_terms").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default(""),
  message: text("message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerCompanyId: uuid("buyer_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  subjectAr: text("subject_ar").notNull().default(""),
  subjectEn: text("subject_en").notNull().default(""),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
  senderName: text("sender_name").notNull().default(""),
  side: negotiationParty("side").notNull(),
  kind: messageKind("kind").notNull().default("text"),
  body: text("body").notNull(),
  attachmentRef: text("attachment_ref"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  bodyAr: text("body_ar").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  href: text("href").notNull().default(""),
  channels: text("channels").array().notNull().default(["in_app"]),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
