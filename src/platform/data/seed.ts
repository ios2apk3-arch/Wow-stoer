import type {
  Company,
  Database,
  Negotiation,
  Notification,
  Order,
  OrderLine,
  OrderStatus,
  PricePoint,
  Product,
  Quote,
  Review,
  Rfq,
  Supplier,
  Thread,
  Message,
  User,
} from "../types";
import { archetypes, categories, countries } from "./catalog";

/** Bump whenever the seed shape or content changes, to invalidate stored copies. */
export const SEED_VERSION = 2;

/** Deterministic PRNG so every visitor sees the same marketplace. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260826);
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;

const NOW = new Date("2026-08-26T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 864e5).toISOString();
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 864e5).toISOString();

const supplierSeeds = [
  {
    id: "sup-1",
    ar: "مجموعة الوفرة للتجارة",
    en: "Al Wafrah Trading Group",
    logo: "🏢",
    country: "SA",
    city: "الرياض",
    cats: ["c-food", "c-grains", "c-canned", "c-oils", "c-drinks", "c-snacks"],
    rating: 4.8,
    years: 14,
    descAr: "أحد أكبر موزّعي المواد الغذائية الجافة في المملكة، بشبكة مستودعات في خمس مدن وأسطول توصيل خاص.",
    descEn: "One of the Kingdom's largest dry-goods distributors, with warehouses in five cities and an owned delivery fleet.",
  },
  {
    id: "sup-2",
    ar: "شركة الخليج للألبان",
    en: "Gulf Dairy Company",
    logo: "🥛",
    country: "AE",
    city: "دبي",
    cats: ["c-dairy", "c-frozen", "c-food", "c-drinks"],
    rating: 4.6,
    years: 9,
    descAr: "متخصصون في الألبان والأجبان المبرّدة مع سلسلة تبريد كاملة معتمدة من هيئة المواصفات.",
    descEn: "Chilled dairy and cheese specialists running a fully certified cold chain end to end.",
  },
  {
    id: "sup-3",
    ar: "النيل للصناعات الغذائية",
    en: "Nile Food Industries",
    logo: "🌾",
    country: "EG",
    city: "القاهرة",
    cats: ["c-canned", "c-grains", "c-snacks", "c-oils", "c-food"],
    rating: 4.4,
    years: 21,
    descAr: "مصنع متكامل للمعلبات والمعجونات بطاقة إنتاجية تتجاوز 400 طن شهريًا وتصدير لأكثر من 12 دولة.",
    descEn: "Integrated cannery producing 400+ tonnes monthly and exporting to more than 12 countries.",
  },
  {
    id: "sup-4",
    ar: "بكج برو للتغليف",
    en: "PackPro Packaging",
    logo: "📦",
    country: "SA",
    city: "جدة",
    cats: ["c-pack", "c-pack-paper", "c-pack-plastic", "c-disp", "c-equip"],
    rating: 4.7,
    years: 7,
    descAr: "حلول تغليف مخصصة للمطاعم وتطبيقات التوصيل، مع طباعة شعار العميل وكميات مرنة.",
    descEn: "Custom packaging for restaurants and delivery apps, with logo printing and flexible batch sizes.",
  },
  {
    id: "sup-5",
    ar: "أنطاليا للتوريدات",
    en: "Antalya Supplies",
    logo: "🇹🇷",
    country: "TR",
    city: "إسطنبول",
    cats: ["c-equip", "c-food", "c-snacks", "c-pack", "c-pack-paper"],
    rating: 4.5,
    years: 11,
    descAr: "مورّد تركي لمعدات المطاعم والمخابز مع خدمات التركيب والصيانة في دول الخليج.",
    descEn: "Turkish supplier of restaurant and bakery equipment, with installation and service across the GCC.",
  },
  {
    id: "sup-6",
    ar: "واحة المزارع",
    en: "Farm Oasis",
    logo: "🥬",
    country: "SA",
    city: "الدمام",
    cats: ["c-agri", "c-food", "c-frozen"],
    rating: 4.3,
    years: 5,
    descAr: "توريد يومي للخضروات والفواكه الطازجة مباشرة من المزارع إلى المطاعم والفنادق.",
    descEn: "Daily farm-to-kitchen supply of fresh produce for restaurants and hotels.",
  },
  {
    id: "sup-7",
    ar: "كلين إيدج للمنظفات",
    en: "CleanEdge Hygiene",
    logo: "🧼",
    country: "KW",
    city: "مدينة الكويت",
    cats: ["c-clean", "c-clean-chem", "c-clean-paper", "c-disp", "c-pack-plastic"],
    rating: 4.6,
    years: 12,
    descAr: "منظفات صناعية ومستلزمات نظافة للمنشآت الغذائية، مع برامج تدريب على السلامة.",
    descEn: "Industrial cleaning chemicals and hygiene supplies for food businesses, with safety training programmes.",
  },
  {
    id: "sup-8",
    ar: "بن الهضبة",
    en: "Highland Coffee Roasters",
    logo: "☕",
    country: "SA",
    city: "الرياض",
    cats: ["c-drinks", "c-food", "c-snacks"],
    rating: 4.9,
    years: 6,
    descAr: "محمصة متخصصة تورّد المقاهي بحبوب قهوة مختصة مع ملفات تحميص حسب الطلب.",
    descEn: "Specialty roastery supplying cafés with single-origin beans and bespoke roast profiles.",
  },
  {
    id: "sup-9",
    ar: "الأطلس للتجارة",
    en: "Atlas Trading",
    logo: "🫒",
    country: "MA",
    city: "الدار البيضاء",
    cats: ["c-oils", "c-agri", "c-food", "c-canned"],
    rating: 4.2,
    years: 17,
    descAr: "مصدّر مغربي لزيت الزيتون البكر والمنتجات الزراعية المعتمدة عضويًا.",
    descEn: "Moroccan exporter of extra virgin olive oil and certified organic produce.",
  },
  {
    id: "sup-10",
    ar: "الدوحة للتوريدات الغذائية",
    en: "Doha Food Supplies",
    logo: "🍽️",
    country: "QA",
    city: "الدوحة",
    cats: ["c-frozen", "c-food", "c-canned", "c-dairy", "c-drinks"],
    rating: 4.5,
    years: 8,
    descAr: "توريد شامل للفنادق وشركات الإعاشة مع خدمة طلبات أسبوعية مجدولة.",
    descEn: "Full-range supply for hotels and catering companies, with scheduled weekly replenishment.",
  },
];

const buyerSeeds = [
  { id: "buy-1", ar: "مطاعم الذواقة", en: "Gourmet Restaurants Co.", logo: "🍴", country: "SA", city: "الرياض" },
  { id: "buy-2", ar: "سوبرماركت الأسرة", en: "Family Supermarket", logo: "🛒", country: "SA", city: "جدة" },
  { id: "buy-3", ar: "فنادق النخيل", en: "Palm Hotels Group", logo: "🏨", country: "AE", city: "دبي" },
  { id: "buy-4", ar: "مقاهي ركن القهوة", en: "Coffee Corner Cafés", logo: "☕", country: "SA", city: "الدمام" },
];

function makeCompany(
  s: { id: string; ar: string; en: string; logo: string; country: string; city: string },
  kind: "supplier" | "buyer",
  descAr = "",
  descEn = "",
  years = 5,
): Company {
  const country = countries.find((c) => c.code === s.country)!;
  return {
    id: `co-${s.id}`,
    name: { ar: s.ar, en: s.en },
    legalName: `${s.en} LLC`,
    taxId: `${s.country}${intBetween(100000000, 999999999)}`,
    logo: s.logo,
    description: { ar: descAr, en: descEn },
    countryCode: s.country,
    city: s.city,
    website: kind === "supplier" ? `https://${s.id}.example.com` : undefined,
    phone: `${country.dialCode}${intBetween(500000000, 599999999)}`,
    email: `contact@${s.id}.example.com`,
    verification: kind === "supplier" ? (rand() > 0.15 ? "verified" : "pending") : "verified",
    memberSince: daysAgo(years * 365 + intBetween(0, 200)),
    addresses: [
      {
        id: `addr-${s.id}`,
        label: { ar: "المقر الرئيسي", en: "Head office" },
        line: `${intBetween(10, 900)} ${s.en} St., District ${intBetween(1, 20)}`,
        city: s.city,
        countryCode: s.country,
        contactName: s.en,
        phone: `${country.dialCode}${intBetween(500000000, 599999999)}`,
        isDefault: true,
      },
    ],
  };
}

export function buildSeed(): Database {
  const companies: Company[] = [];
  const suppliers: Supplier[] = [];
  const users: User[] = [];

  for (const s of supplierSeeds) {
    companies.push(makeCompany(s, "supplier", s.descAr, s.descEn, s.years));
    const badges: Supplier["badges"] = ["verified"];
    if (s.rating >= 4.6) badges.push("top_rated");
    if (s.years >= 10) badges.push("gold");
    if (rand() > 0.4) badges.push("fast_response");
    suppliers.push({
      id: s.id,
      companyId: `co-${s.id}`,
      categories: s.cats,
      rating: s.rating,
      reviewCount: intBetween(24, 310),
      responseHours: round2(between(0.5, 9)),
      onTimeRate: round2(between(0.88, 0.995)),
      fulfilledOrders: intBetween(180, 4200),
      yearsActive: s.years,
      badges,
    });
    users.push({
      id: `u-${s.id}`,
      name: s.en,
      email: `${s.id}@waw.example.com`,
      phone: `+9665${intBetween(10000000, 99999999)}`,
      role: "supplier",
      companyId: `co-${s.id}`,
      avatarColor: pick(["#0369a1", "#0f766e", "#7c3aed", "#b45309", "#be123c"]),
      createdAt: daysAgo(s.years * 365),
    });
  }

  for (const b of buyerSeeds) {
    companies.push(makeCompany(b, "buyer"));
    users.push({
      id: `u-${b.id}`,
      name: b.en,
      email: `${b.id}@waw.example.com`,
      phone: `+9665${intBetween(10000000, 99999999)}`,
      role: "buyer",
      companyId: `co-${b.id}`,
      avatarColor: pick(["#0369a1", "#0f766e", "#7c3aed", "#b45309"]),
      createdAt: daysAgo(intBetween(200, 900)),
    });
  }

  users.push({
    id: "u-admin",
    name: "WAW Operations",
    email: "admin@waw.example.com",
    phone: "+966500000000",
    role: "admin",
    companyId: null,
    avatarColor: "#020617",
    createdAt: daysAgo(1200),
  });

  // ---- Products -----------------------------------------------------------
  const products: Product[] = [];
  let pid = 0;
  for (const arch of archetypes) {
    // Every product needs competing sellers, or price comparison is meaningless.
    const matching = suppliers.filter((s) => s.categories.includes(arch.categoryId));
    const pool = [...matching];
    if (pool.length < 3) {
      const others = suppliers.filter((s) => !pool.includes(s)).sort(() => rand() - 0.5);
      pool.push(...others.slice(0, 3 - pool.length));
    }
    const count = Math.min(pool.length, intBetween(3, 4));
    const chosen = [...pool].sort(() => rand() - 0.5).slice(0, count);
    for (const sup of chosen) {
      pid += 1;
      const company = companies.find((c) => c.id === sup.companyId)!;
      const variance = between(0.86, 1.18);
      const base = round2(arch.basePrice * variance);
      const moq = Math.round(arch.moq * between(0.7, 1.35));
      const stock = intBetween(0, 40) === 0 ? 0 : intBetween(moq, moq * 26);
      const availability =
        stock === 0
          ? arch.unit === "piece"
            ? "made_to_order"
            : "out_of_stock"
          : stock < moq * 2
            ? "low_stock"
            : "in_stock";
      products.push({
        id: `p-${pid}`,
        supplierId: sup.id,
        categoryId: arch.categoryId,
        name: arch.name,
        description: {
          ar: `${arch.name.ar} من ${company.name.ar}. مناسب للمطاعم والمتاجر وشركات الإعاشة، متوفر بأسعار جملة متدرجة حسب الكمية مع إمكانية التفاوض على الشحن وشروط الدفع.`,
          en: `${arch.name.en} supplied by ${company.name.en}. Suited to restaurants, retailers and catering operations, priced on a volume ladder with shipping and payment terms open to negotiation.`,
        },
        brand: pick(arch.brandPool),
        image: arch.glyph,
        imageAlt: arch.name,
        specs: arch.specs.map((s) => ({
          label: { ar: s.ar[0], en: s.en[0] },
          value: { ar: s.ar[1], en: s.en[1] },
        })),
        unit: arch.unit,
        moq,
        stock,
        leadTimeDays: Math.max(1, Math.round(arch.leadTimeDays * between(0.7, 1.4))),
        tiers: [
          { minQty: moq, price: base },
          { minQty: Math.round(moq * 3), price: round2(base * between(0.93, 0.96)) },
          { minQty: Math.round(moq * 8), price: round2(base * between(0.86, 0.91)) },
          { minQty: Math.round(moq * 20), price: round2(base * between(0.78, 0.85)) },
        ],
        currency: countries.find((c) => c.code === company.countryCode)!.currency,
        originCountry: company.countryCode,
        availability,
        rating: round2(Math.min(5, sup.rating + between(-0.4, 0.25))),
        reviewCount: intBetween(3, 180),
        soldUnits: intBetween(120, 48000),
        tags: arch.tags,
        createdAt: daysAgo(intBetween(20, 700)),
      });
    }
  }

  // ---- Price history (26 weeks, seasonal + drift + noise) ------------------
  const priceHistory: PricePoint[] = [];
  for (const p of products) {
    const anchor = p.tiers[0].price;
    const drift = between(-0.0045, 0.0075);
    const seasonal = between(0.02, 0.09);
    const phase = between(0, Math.PI * 2);
    const demandBase = Math.max(4, p.soldUnits / 260);
    for (let w = 25; w >= 0; w -= 1) {
      const t = 25 - w;
      const wave = Math.sin(phase + (t / 26) * Math.PI * 2);
      priceHistory.push({
        productId: p.id,
        date: daysAgo(w * 7),
        avgPrice: round2(anchor * (1 + drift * t + seasonal * wave + between(-0.012, 0.012))),
        volume: Math.max(1, Math.round(demandBase * (1 + 0.35 * wave + between(-0.15, 0.2)))),
      });
    }
  }

  // ---- Reviews ------------------------------------------------------------
  const reviewBodies = [
    { ar: "التزام ممتاز بالمواعيد والجودة مطابقة للعينة تمامًا.", en: "Excellent punctuality and the quality matched the sample exactly." },
    { ar: "الأسعار تنافسية والتعامل احترافي، سنكرر الطلب.", en: "Competitive pricing and professional handling — we'll reorder." },
    { ar: "تأخر الشحن يومين لكن تم التعويض بخصم على الطلب التالي.", en: "Shipping ran two days late but they credited the next order." },
    { ar: "فريق المبيعات سريع الرد ويقدّم بدائل عند نفاد الصنف.", en: "Sales team replies fast and offers alternatives when an item runs out." },
    { ar: "التغليف ممتاز ولا توجد أي تلفيات في الشحنة.", en: "Packaging was excellent, zero damage in the shipment." },
  ];
  const reviews: Review[] = [];
  for (const sup of suppliers) {
    for (let i = 0; i < intBetween(3, 6); i += 1) {
      const body = pick(reviewBodies);
      reviews.push({
        id: `rev-${sup.id}-${i}`,
        supplierId: sup.id,
        buyerCompanyId: pick(buyerSeeds).id.replace("buy", "co-buy"),
        rating: Math.min(5, Math.max(3, Math.round(sup.rating + between(-1, 0.6)))),
        body,
        at: daysAgo(intBetween(5, 420)),
      });
    }
  }

  // ---- Orders -------------------------------------------------------------
  const statusFlow: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const carriers = ["Aramex", "SMSA", "DHL Express", "Naqel", "WAW Fleet"];
  const orders: Order[] = [];
  for (let i = 0; i < 34; i += 1) {
    const buyer = pick(buyerSeeds);
    const ageDays = intBetween(1, 240);
    const lineCount = intBetween(1, 4);
    const lines: OrderLine[] = [];
    for (let l = 0; l < lineCount; l += 1) {
      const p = pick(products);
      const qty = Math.round(p.moq * between(1, 6));
      const tier = [...p.tiers].reverse().find((t) => qty >= t.minQty) ?? p.tiers[0];
      lines.push({
        productId: p.id,
        productName: p.name,
        supplierId: p.supplierId,
        qty,
        unitPrice: tier.price,
        unit: p.unit,
      });
    }
    const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    const shipping = round2(Math.max(60, subtotal * between(0.012, 0.035)));
    const tax = round2((subtotal + shipping) * 0.15);
    const cancelled = rand() < 0.08;
    const progress = cancelled ? 0 : Math.min(4, Math.floor((240 - ageDays) / 46) + intBetween(0, 2));
    const status: OrderStatus = cancelled ? "cancelled" : statusFlow[Math.max(0, Math.min(4, progress))];
    const timeline = cancelled
      ? [
          { status: "pending" as OrderStatus, at: daysAgo(ageDays) },
          { status: "cancelled" as OrderStatus, at: daysAgo(Math.max(0, ageDays - 1)) },
        ]
      : statusFlow.slice(0, statusFlow.indexOf(status) + 1).map((st, idx) => ({
          status: st,
          at: daysAgo(Math.max(0, ageDays - idx * 2)),
        }));
    const shipped = ["shipped", "delivered"].includes(status);
    orders.push({
      id: `ord-${i + 1}`,
      reference: `WAW-${26000 + i}`,
      buyerCompanyId: `co-${buyer.id}`,
      lines,
      subtotal,
      shipping,
      tax,
      total: round2(subtotal + shipping + tax),
      currency: "SAR",
      status,
      paymentStatus: cancelled ? "refunded" : status === "delivered" ? "paid" : rand() > 0.4 ? "paid" : "authorized",
      paymentMethod: pick(["bank_transfer", "card", "credit_terms"]),
      shippingAddressId: `addr-${buyer.id}`,
      carrier: shipped ? pick(carriers) : undefined,
      trackingNumber: shipped ? `TRK${intBetween(100000000, 999999999)}` : undefined,
      etaDays: intBetween(2, 12),
      timeline,
      createdAt: daysAgo(ageDays),
    });
  }
  orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // ---- RFQs + quotes ------------------------------------------------------
  const rfqs: Rfq[] = [];
  const quotes: Quote[] = [];
  for (let i = 0; i < 10; i += 1) {
    const buyer = pick(buyerSeeds);
    const p = pick(products);
    const cat = categories.find((c) => c.id === p.categoryId)!;
    const age = intBetween(1, 60);
    const qty = Math.round(p.moq * between(2, 12));
    const invited = suppliers
      .filter((s) => s.categories.includes(p.categoryId))
      .slice(0, intBetween(2, 4))
      .map((s) => s.id);
    const rfqId = `rfq-${i + 1}`;
    const quoteCount = age > 3 ? intBetween(0, invited.length) : 0;
    for (let q = 0; q < quoteCount; q += 1) {
      quotes.push({
        id: `q-${rfqId}-${q}`,
        rfqId,
        supplierId: invited[q],
        unitPrice: round2(p.tiers[0].price * between(0.82, 1.06)),
        currency: "SAR",
        moq: Math.round(p.moq * between(0.8, 1.2)),
        leadTimeDays: Math.max(1, Math.round(p.leadTimeDays * between(0.7, 1.6))),
        shippingCost: round2(between(150, 1400)),
        shippingTerms: pick(["DDP", "EXW", "FOB", "CIF"]),
        paymentTerms: pick(["prepaid", "net_15", "net_30", "50_50"]),
        validUntil: daysAhead(intBetween(3, 21)),
        notes: "",
        status: "submitted",
        createdAt: daysAgo(Math.max(0, age - intBetween(1, 3))),
      });
    }
    rfqs.push({
      id: rfqId,
      reference: `RFQ-${4100 + i}`,
      buyerCompanyId: `co-${buyer.id}`,
      title: { ar: `توريد ${p.name.ar}`, en: `Supply of ${p.name.en}` },
      categoryId: cat.id,
      productId: p.id,
      qty,
      unit: p.unit,
      targetPrice: round2(p.tiers[0].price * between(0.82, 0.96)),
      currency: "SAR",
      specs: p.specs.map((s) => `${s.label.en}: ${s.value.en}`).join(" · "),
      neededBy: daysAhead(intBetween(5, 45)),
      deliveryCity: buyer.city,
      deliveryCountry: buyer.country,
      paymentTerms: pick(["net_30", "prepaid", "50_50"]),
      shippingTerms: pick(["DDP", "CIF", "EXW"]),
      notes: "",
      status: quoteCount > 0 ? "quoted" : "open",
      invitedSupplierIds: invited,
      createdAt: daysAgo(age),
      expiresAt: daysAhead(Math.max(2, 30 - age)),
    });
  }

  // ---- Negotiations -------------------------------------------------------
  const negotiations: Negotiation[] = [];
  for (let i = 0; i < 5; i += 1) {
    const p = pick(products);
    const buyer = pick(buyerSeeds);
    const qty = Math.round(p.moq * between(3, 9));
    const ask = p.tiers[0].price;
    const buyerTarget = round2(ask * between(0.78, 0.9));
    const counter = round2((ask + buyerTarget) / 2);
    const age = intBetween(2, 40);
    negotiations.push({
      id: `neg-${i + 1}`,
      reference: `NEG-${7300 + i}`,
      productId: p.id,
      buyerCompanyId: `co-${buyer.id}`,
      supplierId: p.supplierId,
      currency: "SAR",
      status: "active",
      createdAt: daysAgo(age),
      rounds: [
        {
          id: `nr-${i}-0`,
          by: "buyer",
          actorName: buyer.en,
          kind: "offer",
          at: daysAgo(age),
          message: "نطلب سعرًا أفضل مقابل التزام بكمية أكبر وتعاقد ربع سنوي.",
          terms: {
            unitPrice: buyerTarget,
            qty,
            moq: p.moq,
            shippingCost: 0,
            shippingTerms: "DDP",
            paymentTerms: "net_30",
          },
        },
        {
          id: `nr-${i}-1`,
          by: "supplier",
          actorName: supplierSeeds.find((s) => s.id === p.supplierId)!.en,
          kind: "counter",
          at: daysAgo(Math.max(0, age - 1)),
          message: "يمكننا الوصول لهذا السعر عند رفع الكمية 20% مع دفعة مقدمة 50%.",
          terms: {
            unitPrice: counter,
            qty: Math.round(qty * 1.2),
            moq: p.moq,
            shippingCost: round2(between(200, 900)),
            shippingTerms: "DDP",
            paymentTerms: "50_50",
          },
        },
      ],
    });
  }

  // ---- Threads + messages -------------------------------------------------
  const threads: Thread[] = [];
  const messages: Message[] = [];
  for (let i = 0; i < 4; i += 1) {
    const sup = supplierSeeds[i];
    const threadId = `th-${i + 1}`;
    threads.push({
      id: threadId,
      buyerCompanyId: "co-buy-1",
      supplierId: sup.id,
      subject: { ar: `محادثة مع ${sup.ar}`, en: `Conversation with ${sup.en}` },
      lastMessageAt: daysAgo(i),
    });
    const scripted: [string, "buyer" | "supplier"][] = [
      ["السلام عليكم، نحتاج عرض سعر لتوريد شهري منتظم.", "buyer"],
      ["وعليكم السلام، تفضّل بتحديد الأصناف والكميات وسنرسل العرض خلال ساعات.", "supplier"],
      ["الكميات مرفقة في طلب عرض السعر، والتسليم مطلوب في الرياض.", "buyer"],
      ["تم الاستلام، سنرسل السعر النهائي شاملاً الشحن اليوم.", "supplier"],
    ];
    scripted.forEach(([body, side], idx) => {
      messages.push({
        id: `m-${threadId}-${idx}`,
        threadId,
        senderId: side === "buyer" ? "u-buy-1" : `u-${sup.id}`,
        senderName: side === "buyer" ? "Gourmet Restaurants Co." : sup.en,
        side,
        kind: "text",
        body,
        at: daysAgo(i + (scripted.length - idx) * 0.05),
        read: idx < scripted.length - 1,
      });
    });
  }

  // ---- Notifications ------------------------------------------------------
  const notifications: Notification[] = [
    {
      id: "n-1",
      userId: "u-buy-1",
      kind: "quote_new",
      title: { ar: "عرض سعر جديد", en: "New quotation received" },
      body: { ar: "استلمت عرضًا جديدًا على طلب RFQ-4100.", en: "A new quote landed on RFQ-4100." },
      href: "/rfq/rfq-1",
      at: daysAgo(0.2),
      read: false,
      channels: ["in_app", "email", "push"],
    },
    {
      id: "n-2",
      userId: "u-buy-1",
      kind: "price_drop",
      title: { ar: "انخفاض سعر", en: "Price drop alert" },
      body: {
        ar: "انخفض متوسط سعر كرتون المياه 6.4% خلال أسبوعين — وقت مناسب لإعادة الطلب.",
        en: "Water carton average price fell 6.4% in two weeks — a good window to reorder.",
      },
      href: "/intelligence",
      at: daysAgo(1),
      read: false,
      channels: ["in_app", "whatsapp"],
    },
    {
      id: "n-3",
      userId: "u-buy-1",
      kind: "shipping_update",
      title: { ar: "تحديث شحنة", en: "Shipment update" },
      body: { ar: "شحنتك في الطريق ومتوقع وصولها خلال يومين.", en: "Your shipment is in transit, arriving in two days." },
      href: "/orders",
      at: daysAgo(2),
      read: true,
      channels: ["in_app", "sms"],
    },
    {
      id: "n-4",
      userId: "u-buy-1",
      kind: "ai_insight",
      title: { ar: "توصية من WAW AI", en: "WAW AI recommendation" },
      body: {
        ar: "بناءً على وتيرة استهلاكك، يُنصح بإعادة طلب الزيت خلال 9 أيام لتفادي النفاد.",
        en: "Based on your consumption rate, reorder cooking oil within 9 days to avoid a stockout.",
      },
      href: "/forecasting",
      at: daysAgo(3),
      read: true,
      channels: ["in_app", "push"],
    },
    {
      id: "n-5",
      userId: "u-sup-1",
      kind: "rfq_new",
      title: { ar: "طلب عرض سعر جديد", en: "New RFQ invitation" },
      body: { ar: "تمت دعوتك لتقديم عرض على طلب توريد جديد.", en: "You have been invited to quote on a new sourcing request." },
      href: "/supplier/rfq",
      at: daysAgo(0.5),
      read: false,
      channels: ["in_app", "email"],
    },
  ];

  return {
    version: SEED_VERSION,
    countries,
    categories,
    companies,
    users,
    suppliers,
    products,
    priceHistory,
    reviews,
    orders,
    rfqs,
    quotes,
    negotiations,
    threads,
    messages,
    notifications,
    audit: [],
    cart: [],
    favorites: [products[2].id, products[7].id],
    session: { userId: null },
  };
}
