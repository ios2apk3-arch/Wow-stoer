/**
 * WAW Smart Commerce — domain model.
 *
 * Every entity here is storage-agnostic: `platform/api.ts` is the only module
 * that knows where these live. Swapping the local adapter for a real backend
 * means reimplementing that file, not this one.
 */

export type Locale = "ar" | "en";

/** A string that carries both supported locales. */
export interface I18nText {
  ar: string;
  en: string;
}

export type Role = "buyer" | "supplier" | "admin";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Country {
  code: string;
  name: I18nText;
  currency: string;
  dialCode: string;
  cities: I18nText[];
}

export interface Address {
  id: string;
  label: I18nText;
  line: string;
  city: string;
  countryCode: string;
  contactName: string;
  phone: string;
  isDefault: boolean;
}

export interface Company {
  id: string;
  name: I18nText;
  legalName: string;
  taxId: string;
  logo: string;
  description: I18nText;
  countryCode: string;
  city: string;
  website?: string;
  phone: string;
  email: string;
  verification: VerificationStatus;
  memberSince: string;
  addresses: Address[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  companyId: string | null;
  avatarColor: string;
  createdAt: string;
}

/** Supplier-specific facts layered on top of a Company. */
export interface Supplier {
  id: string;
  companyId: string;
  categories: string[];
  rating: number;
  reviewCount: number;
  responseHours: number;
  onTimeRate: number;
  fulfilledOrders: number;
  yearsActive: number;
  badges: ("gold" | "verified" | "fast_response" | "top_rated")[];
}

export interface Category {
  id: string;
  parentId: string | null;
  name: I18nText;
  icon: string;
  slug: string;
}

export type Unit = "carton" | "pallet" | "kg" | "piece" | "liter" | "box";

/** Wholesale price ladder: the more you buy, the lower the unit price. */
export interface PriceTier {
  minQty: number;
  price: number;
}

export type Availability = "in_stock" | "low_stock" | "made_to_order" | "out_of_stock";

export interface Product {
  id: string;
  supplierId: string;
  categoryId: string;
  name: I18nText;
  description: I18nText;
  brand: string;
  image: string;
  imageAlt: I18nText;
  specs: { label: I18nText; value: I18nText }[];
  unit: Unit;
  moq: number;
  stock: number;
  leadTimeDays: number;
  tiers: PriceTier[];
  currency: string;
  originCountry: string;
  availability: Availability;
  rating: number;
  reviewCount: number;
  soldUnits: number;
  tags: string[];
  createdAt: string;
}

export interface CartLine {
  productId: string;
  qty: number;
  addedAt: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded" | "failed";

export interface OrderLine {
  productId: string;
  productName: I18nText;
  supplierId: string;
  qty: number;
  unitPrice: number;
  unit: Unit;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  note?: I18nText;
}

export interface Order {
  id: string;
  reference: string;
  buyerCompanyId: string;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingAddressId: string;
  carrier?: string;
  trackingNumber?: string;
  etaDays: number;
  timeline: OrderEvent[];
  createdAt: string;
  sourceRfqId?: string;
}

export type RfqStatus = "open" | "quoted" | "awarded" | "closed" | "expired";

export interface Rfq {
  id: string;
  reference: string;
  buyerCompanyId: string;
  title: I18nText;
  categoryId: string;
  productId?: string;
  qty: number;
  unit: Unit;
  targetPrice?: number;
  currency: string;
  specs: string;
  neededBy: string;
  deliveryCity: string;
  deliveryCountry: string;
  paymentTerms: string;
  shippingTerms: string;
  notes: string;
  status: RfqStatus;
  invitedSupplierIds: string[];
  createdAt: string;
  expiresAt: string;
}

export type QuoteStatus = "submitted" | "revised" | "accepted" | "rejected" | "expired";

export interface Quote {
  id: string;
  rfqId: string;
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
  status: QuoteStatus;
  createdAt: string;
}

export type NegotiationField = "price" | "qty" | "moq" | "shipping" | "payment";

export interface NegotiationTerms {
  unitPrice: number;
  qty: number;
  moq: number;
  shippingCost: number;
  shippingTerms: string;
  paymentTerms: string;
}

export interface NegotiationRound {
  id: string;
  by: "buyer" | "supplier";
  actorName: string;
  terms: NegotiationTerms;
  message: string;
  at: string;
  kind: "offer" | "counter" | "accept" | "reject";
}

export type NegotiationStatus = "active" | "accepted" | "rejected" | "converted";

export interface Negotiation {
  id: string;
  reference: string;
  rfqId?: string;
  quoteId?: string;
  productId: string;
  buyerCompanyId: string;
  supplierId: string;
  currency: string;
  status: NegotiationStatus;
  rounds: NegotiationRound[];
  createdAt: string;
  orderId?: string;
}

export type MessageKind = "text" | "quote" | "product" | "order" | "file" | "ai";

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  side: "buyer" | "supplier" | "ai";
  kind: MessageKind;
  body: string;
  attachmentRef?: string;
  at: string;
  read: boolean;
}

export interface Thread {
  id: string;
  buyerCompanyId: string;
  supplierId: string;
  subject: I18nText;
  lastMessageAt: string;
}

export type NotificationKind =
  | "order_new"
  | "order_status"
  | "quote_new"
  | "message_new"
  | "price_drop"
  | "back_in_stock"
  | "shipping_update"
  | "payment_update"
  | "ai_insight"
  | "rfq_new";

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: I18nText;
  body: I18nText;
  href: string;
  at: string;
  read: boolean;
  channels: ("in_app" | "email" | "push" | "whatsapp" | "sms")[];
}

/** One observation of a product's market price, used by intelligence + forecasting. */
export interface PricePoint {
  productId: string;
  date: string;
  avgPrice: number;
  volume: number;
}

export interface Review {
  id: string;
  supplierId: string;
  productId?: string;
  buyerCompanyId: string;
  rating: number;
  body: I18nText;
  at: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  target: string;
  at: string;
}

/** Everything the app persists. One object = one storage document. */
export interface Database {
  version: number;
  countries: Country[];
  categories: Category[];
  companies: Company[];
  users: User[];
  suppliers: Supplier[];
  products: Product[];
  priceHistory: PricePoint[];
  reviews: Review[];
  orders: Order[];
  rfqs: Rfq[];
  quotes: Quote[];
  negotiations: Negotiation[];
  threads: Thread[];
  messages: Message[];
  notifications: Notification[];
  audit: AuditEntry[];
  cart: CartLine[];
  favorites: string[];
  session: { userId: string | null };
}
