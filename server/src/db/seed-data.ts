import { randomUUID } from "node:crypto";
import type {
  addresses, companies, negotiationRounds, negotiations, orderEvents, orderLines,
  orders, products, quotes, reviews, rfqs, suppliers, users,
} from "./schema.ts";

type CompanyRow = typeof companies.$inferInsert;
type AddressRow = typeof addresses.$inferInsert;
type SupplierRow = typeof suppliers.$inferInsert;
type UserRow = typeof users.$inferInsert;
type ProductRow = typeof products.$inferInsert;
type ReviewRow = typeof reviews.$inferInsert;
type OrderRow = typeof orders.$inferInsert;
type OrderLineRow = typeof orderLines.$inferInsert;
type OrderEventRow = typeof orderEvents.$inferInsert;
type RfqRow = typeof rfqs.$inferInsert;
type QuoteRow = typeof quotes.$inferInsert;
type NegotiationRow = typeof negotiations.$inferInsert;
type NegotiationRoundRow = typeof negotiationRounds.$inferInsert;

/**
 * Deterministic marketplace generator, producing database rows.
 *
 * Mirrors the browser-side generator so the API serves the same marketplace
 * the frontend already demonstrates. UUIDs are the one non-deterministic part:
 * primary keys come from the database's own type, not from the seed.
 */

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
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => String(round2(n));

const NOW = new Date("2026-08-26T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 864e5);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 864e5);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/* ----------------------------------------------------------- reference data */

const countryRows = [
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia", currency: "SAR", dialCode: "+966",
    cityList: [["الرياض", "Riyadh"], ["جدة", "Jeddah"], ["الدمام", "Dammam"], ["مكة المكرمة", "Makkah"], ["المدينة المنورة", "Madinah"]] },
  { code: "AE", nameAr: "الإمارات", nameEn: "United Arab Emirates", currency: "AED", dialCode: "+971",
    cityList: [["دبي", "Dubai"], ["أبوظبي", "Abu Dhabi"], ["الشارقة", "Sharjah"]] },
  { code: "EG", nameAr: "مصر", nameEn: "Egypt", currency: "EGP", dialCode: "+20",
    cityList: [["القاهرة", "Cairo"], ["الإسكندرية", "Alexandria"], ["بورسعيد", "Port Said"]] },
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait", currency: "KWD", dialCode: "+965",
    cityList: [["مدينة الكويت", "Kuwait City"], ["الأحمدي", "Al Ahmadi"]] },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar", currency: "QAR", dialCode: "+974",
    cityList: [["الدوحة", "Doha"], ["الريان", "Al Rayyan"]] },
  { code: "JO", nameAr: "الأردن", nameEn: "Jordan", currency: "JOD", dialCode: "+962",
    cityList: [["عمّان", "Amman"], ["الزرقاء", "Zarqa"]] },
  { code: "MA", nameAr: "المغرب", nameEn: "Morocco", currency: "MAD", dialCode: "+212",
    cityList: [["الدار البيضاء", "Casablanca"], ["الرباط", "Rabat"]] },
  { code: "TR", nameAr: "تركيا", nameEn: "Türkiye", currency: "TRY", dialCode: "+90",
    cityList: [["إسطنبول", "Istanbul"], ["مرسين", "Mersin"]] },
];

const categoryRows = [
  { id: "c-food", parentId: null, slug: "food", icon: "🍽️", nameAr: "أغذية ومشروبات", nameEn: "Food & Beverage" },
  { id: "c-grains", parentId: "c-food", slug: "grains", icon: "🌾", nameAr: "حبوب وبقوليات", nameEn: "Grains & Pulses" },
  { id: "c-dairy", parentId: "c-food", slug: "dairy", icon: "🥛", nameAr: "ألبان وأجبان", nameEn: "Dairy & Cheese" },
  { id: "c-oils", parentId: "c-food", slug: "oils", icon: "🫒", nameAr: "زيوت وسمن", nameEn: "Oils & Ghee" },
  { id: "c-drinks", parentId: "c-food", slug: "drinks", icon: "💧", nameAr: "مشروبات ومياه", nameEn: "Water & Drinks" },
  { id: "c-canned", parentId: "c-food", slug: "canned", icon: "🥫", nameAr: "معلبات", nameEn: "Canned Goods" },
  { id: "c-frozen", parentId: "c-food", slug: "frozen", icon: "🧊", nameAr: "مجمدات", nameEn: "Frozen Foods" },
  { id: "c-snacks", parentId: "c-food", slug: "snacks", icon: "🍫", nameAr: "حلويات وسناكس", nameEn: "Snacks & Confectionery" },
  { id: "c-pack", parentId: null, slug: "packaging", icon: "📦", nameAr: "تغليف وتعبئة", nameEn: "Packaging" },
  { id: "c-pack-paper", parentId: "c-pack", slug: "paper-packaging", icon: "🗞️", nameAr: "تغليف ورقي", nameEn: "Paper Packaging" },
  { id: "c-pack-plastic", parentId: "c-pack", slug: "plastic-packaging", icon: "🧴", nameAr: "تغليف بلاستيكي", nameEn: "Plastic Packaging" },
  { id: "c-clean", parentId: null, slug: "cleaning", icon: "🧼", nameAr: "منظفات ونظافة", nameEn: "Cleaning & Hygiene" },
  { id: "c-clean-chem", parentId: "c-clean", slug: "chemicals", icon: "🧪", nameAr: "مواد تنظيف", nameEn: "Cleaning Chemicals" },
  { id: "c-clean-paper", parentId: "c-clean", slug: "hygiene-paper", icon: "🧻", nameAr: "ورقيات صحية", nameEn: "Hygiene Paper" },
  { id: "c-disp", parentId: null, slug: "disposables", icon: "🥤", nameAr: "مستهلكات ومستلزمات", nameEn: "Disposables" },
  { id: "c-equip", parentId: null, slug: "equipment", icon: "🍳", nameAr: "معدات مطاعم", nameEn: "Restaurant Equipment" },
  { id: "c-agri", parentId: null, slug: "agriculture", icon: "🥬", nameAr: "منتجات زراعية", nameEn: "Agriculture" },
];

export const REFERENCE = {
  countries: countryRows.map((c) => ({
    code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, currency: c.currency, dialCode: c.dialCode,
  })),
  cities: countryRows.flatMap((c) =>
    c.cityList.map(([ar, en]) => ({ countryCode: c.code, nameAr: ar, nameEn: en })),
  ),
  categories: categoryRows,
};

type Unit = "carton" | "pallet" | "kg" | "piece" | "liter" | "box";

interface Archetype {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  brands: string[];
  glyph: string;
  unit: Unit;
  basePrice: number;
  moq: number;
  leadTimeDays: number;
  tags: string[];
  specs: { label: { ar: string; en: string }; value: { ar: string; en: string } }[];
}

const spec = (la: string, le: string, va: string, ve: string) => ({
  label: { ar: la, en: le }, value: { ar: va, en: ve },
});

const archetypes: Archetype[] = [
  { categoryId: "c-drinks", nameAr: "كرتون مياه شرب 330 مل", nameEn: "Drinking Water Carton 330ml", brands: ["Aqua Vita", "نقاء", "Blue Spring"], glyph: "💧", unit: "carton", basePrice: 9.5, moq: 200, leadTimeDays: 2, tags: ["fast-moving", "hospitality"],
    specs: [spec("الحجم", "Size", "330 مل × 40 عبوة", "330ml × 40 bottles"), spec("مدة الصلاحية", "Shelf life", "12 شهر", "12 months")] },
  { categoryId: "c-grains", nameAr: "أرز بسمتي فاخر 5 كجم", nameEn: "Premium Basmati Rice 5kg", brands: ["Golden Field", "حصاد", "Royal Grain"], glyph: "🌾", unit: "box", basePrice: 118, moq: 40, leadTimeDays: 5, tags: ["staple", "restaurant"],
    specs: [spec("التعبئة", "Pack", "5 كجم × 6 أكياس", "5kg × 6 bags"), spec("المنشأ", "Origin", "الهند", "India")] },
  { categoryId: "c-oils", nameAr: "زيت دوار الشمس 5 لتر", nameEn: "Sunflower Oil 5L", brands: ["Sunlite", "الذهبية", "Vega Oils"], glyph: "🫗", unit: "carton", basePrice: 132, moq: 30, leadTimeDays: 4, tags: ["staple", "restaurant"],
    specs: [spec("التعبئة", "Pack", "5 لتر × 4", "5L × 4"), spec("نقطة الدخان", "Smoke point", "232°م", "232°C")] },
  { categoryId: "c-dairy", nameAr: "جبن موزاريلا مبشور 2 كجم", nameEn: "Shredded Mozzarella 2kg", brands: ["Casa Latte", "مراعي بلس", "Alpine Dairy"], glyph: "🧀", unit: "carton", basePrice: 196, moq: 20, leadTimeDays: 3, tags: ["chilled", "pizzeria"],
    specs: [spec("التعبئة", "Pack", "2 كجم × 6", "2kg × 6"), spec("التخزين", "Storage", "من 0 إلى 4°م", "0–4°C")] },
  { categoryId: "c-canned", nameAr: "معجون طماطم 800 جم", nameEn: "Tomato Paste 800g", brands: ["Rossa", "بستان", "Red Harvest"], glyph: "🥫", unit: "carton", basePrice: 74, moq: 50, leadTimeDays: 3, tags: ["staple"],
    specs: [spec("التعبئة", "Pack", "800 جم × 12", "800g × 12"), spec("التركيز", "Concentration", "28–30% بريكس", "28–30% brix")] },
  { categoryId: "c-frozen", nameAr: "بطاطس مقلية مجمدة 2.5 كجم", nameEn: "Frozen French Fries 2.5kg", brands: ["CrispCo", "الشهية", "Nordic Farms"], glyph: "🍟", unit: "carton", basePrice: 148, moq: 25, leadTimeDays: 6, tags: ["frozen", "qsr"],
    specs: [spec("القطع", "Cut", "9 مم مستقيم", "9mm straight"), spec("التخزين", "Storage", "-18°م", "-18°C")] },
  { categoryId: "c-frozen", nameAr: "صدور دجاج مجمدة 10 كجم", nameEn: "Frozen Chicken Breast 10kg", brands: ["Sadia Pro", "طيبة", "Farm Select"], glyph: "🍗", unit: "carton", basePrice: 268, moq: 20, leadTimeDays: 5, tags: ["frozen", "protein"],
    specs: [spec("الوزن", "Weight", "10 كجم", "10kg"), spec("الشهادة", "Certification", "حلال", "Halal")] },
  { categoryId: "c-grains", nameAr: "سكر أبيض ناعم 50 كجم", nameEn: "Refined White Sugar 50kg", brands: ["Cristal", "السكرية", "Delta Mills"], glyph: "🍚", unit: "pallet", basePrice: 172, moq: 10, leadTimeDays: 7, tags: ["staple", "bakery"],
    specs: [spec("النقاء", "Purity", "ICUMSA 45", "ICUMSA 45"), spec("التعبئة", "Pack", "كيس 50 كجم", "50kg sack")] },
  { categoryId: "c-drinks", nameAr: "حبوب قهوة عربية محمصة 1 كجم", nameEn: "Roasted Arabica Beans 1kg", brands: ["Bunn House", "دلّة", "Highland Roast"], glyph: "☕", unit: "kg", basePrice: 62, moq: 100, leadTimeDays: 4, tags: ["cafe", "premium"],
    specs: [spec("درجة التحميص", "Roast", "وسط", "Medium"), spec("المنشأ", "Origin", "إثيوبيا", "Ethiopia")] },
  { categoryId: "c-disp", nameAr: "أكواب ورقية 8 أونصة", nameEn: "Paper Cups 8oz", brands: ["EcoServe", "ورقية", "PureCup"], glyph: "🥤", unit: "carton", basePrice: 88, moq: 30, leadTimeDays: 3, tags: ["disposable", "cafe"],
    specs: [spec("الكمية", "Quantity", "1000 كوب", "1000 cups"), spec("الخامة", "Material", "ورق مقاوم للحرارة", "Heat-resistant paper")] },
  { categoryId: "c-pack-plastic", nameAr: "علب طعام بلاستيكية 750 مل", nameEn: "Plastic Food Containers 750ml", brands: ["PackPro", "حاويات", "SealRight"], glyph: "🥡", unit: "carton", basePrice: 112, moq: 25, leadTimeDays: 4, tags: ["delivery", "disposable"],
    specs: [spec("الكمية", "Quantity", "500 علبة + أغطية", "500 units + lids"), spec("مقاومة", "Resistance", "آمن للميكروويف", "Microwave safe")] },
  { categoryId: "c-pack-paper", nameAr: "صناديق كرافت للتوصيل", nameEn: "Kraft Delivery Boxes", brands: ["Kraftline", "كرتونة", "BoxWorks"], glyph: "📦", unit: "carton", basePrice: 165, moq: 20, leadTimeDays: 6, tags: ["delivery", "eco"],
    specs: [spec("الكمية", "Quantity", "300 صندوق", "300 boxes"), spec("الطباعة", "Printing", "شعار مخصص متاح", "Custom logo available")] },
  { categoryId: "c-clean-chem", nameAr: "سائل غسيل صحون 20 لتر", nameEn: "Dishwashing Liquid 20L", brands: ["Shine Pro", "نظافة", "CleanEdge"], glyph: "🧴", unit: "carton", basePrice: 96, moq: 20, leadTimeDays: 3, tags: ["cleaning"],
    specs: [spec("التركيز", "Concentration", "مركّز عالي", "High concentrate"), spec("الاستخدام", "Use", "مطابخ تجارية", "Commercial kitchens")] },
  { categoryId: "c-clean-paper", nameAr: "مناديل ورقية مقاس كبير", nameEn: "Jumbo Tissue Rolls", brands: ["SoftWave", "نعومة", "PurePaper"], glyph: "🧻", unit: "carton", basePrice: 78, moq: 40, leadTimeDays: 2, tags: ["hygiene"],
    specs: [spec("الكمية", "Quantity", "12 لفة", "12 rolls"), spec("الطبقات", "Ply", "طبقتان", "2-ply")] },
  { categoryId: "c-disp", nameAr: "قفازات نايتريل للطعام", nameEn: "Nitrile Food-Safe Gloves", brands: ["SafeHand", "أمان", "MediGrip"], glyph: "🧤", unit: "box", basePrice: 34, moq: 100, leadTimeDays: 3, tags: ["hygiene", "disposable"],
    specs: [spec("الكمية", "Quantity", "100 قفاز", "100 gloves"), spec("الاعتماد", "Approval", "معتمد للتلامس الغذائي", "Food contact approved")] },
  { categoryId: "c-equip", nameAr: "عجّانة صناعية 20 لتر", nameEn: "Industrial Dough Mixer 20L", brands: ["BakeMaster", "صناعية", "ProKitchen"], glyph: "🍞", unit: "piece", basePrice: 4250, moq: 2, leadTimeDays: 14, tags: ["equipment", "bakery"],
    specs: [spec("السعة", "Capacity", "20 لتر", "20L"), spec("الضمان", "Warranty", "سنتان", "2 years")] },
  { categoryId: "c-equip", nameAr: "ثلاجة عرض رأسية", nameEn: "Upright Display Chiller", brands: ["ColdLine", "تبريد", "FrostTech"], glyph: "🧊", unit: "piece", basePrice: 6900, moq: 1, leadTimeDays: 18, tags: ["equipment", "retail"],
    specs: [spec("السعة", "Capacity", "600 لتر", "600L"), spec("الطاقة", "Energy", "تصنيف A", "A rated")] },
  { categoryId: "c-agri", nameAr: "تمر سكري فاخر 5 كجم", nameEn: "Premium Sukkari Dates 5kg", brands: ["Nakhla", "القصيم", "Desert Gold"], glyph: "🌴", unit: "box", basePrice: 145, moq: 20, leadTimeDays: 4, tags: ["seasonal", "premium"],
    specs: [spec("الدرجة", "Grade", "فاخر", "Premium"), spec("المنشأ", "Origin", "القصيم", "Al Qassim")] },
  { categoryId: "c-oils", nameAr: "زيت زيتون بكر ممتاز 4 لتر", nameEn: "Extra Virgin Olive Oil 4L", brands: ["Zaytoun", "الجليل", "Olivia"], glyph: "🫒", unit: "carton", basePrice: 285, moq: 15, leadTimeDays: 6, tags: ["premium"],
    specs: [spec("الحموضة", "Acidity", "أقل من 0.5%", "Below 0.5%"), spec("العصر", "Pressing", "على البارد", "Cold pressed")] },
  { categoryId: "c-snacks", nameAr: "ألواح شوكولاتة متنوعة", nameEn: "Assorted Chocolate Bars", brands: ["CocoaLine", "حلاوة", "SweetBox"], glyph: "🍫", unit: "carton", basePrice: 121, moq: 30, leadTimeDays: 5, tags: ["retail", "fast-moving"],
    specs: [spec("الكمية", "Quantity", "48 لوح", "48 bars"), spec("التخزين", "Storage", "أقل من 22°م", "Below 22°C")] },
  { categoryId: "c-agri", nameAr: "صندوق خضروات طازجة مشكّل", nameEn: "Mixed Fresh Vegetables Crate", brands: ["GreenFields", "المزرعة", "FarmDirect"], glyph: "🥬", unit: "box", basePrice: 92, moq: 25, leadTimeDays: 1, tags: ["fresh", "daily"],
    specs: [spec("الوزن", "Weight", "10 كجم", "10kg"), spec("التوريد", "Supply", "يومي", "Daily")] },
  { categoryId: "c-grains", nameAr: "دقيق فاخر متعدد الاستخدام 25 كجم", nameEn: "All-Purpose Flour 25kg", brands: ["MillPro", "المطاحن", "White Mill"], glyph: "🌾", unit: "pallet", basePrice: 96, moq: 15, leadTimeDays: 4, tags: ["staple", "bakery"],
    specs: [spec("البروتين", "Protein", "11.5%", "11.5%"), spec("التعبئة", "Pack", "كيس 25 كجم", "25kg sack")] },
];

const supplierSeeds = [
  { slug: "sup-1", ar: "مجموعة الوفرة للتجارة", en: "Al Wafrah Trading Group", logo: "🏢", country: "SA", city: "الرياض", cats: ["c-food", "c-grains", "c-canned", "c-oils", "c-drinks", "c-snacks"], rating: 4.8, years: 14,
    descAr: "أحد أكبر موزّعي المواد الغذائية الجافة في المملكة، بشبكة مستودعات في خمس مدن وأسطول توصيل خاص.", descEn: "One of the Kingdom's largest dry-goods distributors, with warehouses in five cities and an owned delivery fleet." },
  { slug: "sup-2", ar: "شركة الخليج للألبان", en: "Gulf Dairy Company", logo: "🥛", country: "AE", city: "دبي", cats: ["c-dairy", "c-frozen", "c-food", "c-drinks"], rating: 4.6, years: 9,
    descAr: "متخصصون في الألبان والأجبان المبرّدة مع سلسلة تبريد كاملة معتمدة.", descEn: "Chilled dairy and cheese specialists running a fully certified cold chain end to end." },
  { slug: "sup-3", ar: "النيل للصناعات الغذائية", en: "Nile Food Industries", logo: "🌾", country: "EG", city: "القاهرة", cats: ["c-canned", "c-grains", "c-snacks", "c-oils", "c-food"], rating: 4.4, years: 21,
    descAr: "مصنع متكامل للمعلبات والمعجونات بطاقة إنتاجية تتجاوز 400 طن شهريًا.", descEn: "Integrated cannery producing 400+ tonnes monthly and exporting to more than 12 countries." },
  { slug: "sup-4", ar: "بكج برو للتغليف", en: "PackPro Packaging", logo: "📦", country: "SA", city: "جدة", cats: ["c-pack", "c-pack-paper", "c-pack-plastic", "c-disp", "c-equip"], rating: 4.7, years: 7,
    descAr: "حلول تغليف مخصصة للمطاعم وتطبيقات التوصيل، مع طباعة شعار العميل.", descEn: "Custom packaging for restaurants and delivery apps, with logo printing and flexible batch sizes." },
  { slug: "sup-5", ar: "أنطاليا للتوريدات", en: "Antalya Supplies", logo: "🇹🇷", country: "TR", city: "إسطنبول", cats: ["c-equip", "c-food", "c-snacks", "c-pack", "c-pack-paper"], rating: 4.5, years: 11,
    descAr: "مورّد تركي لمعدات المطاعم والمخابز مع خدمات التركيب والصيانة.", descEn: "Turkish supplier of restaurant and bakery equipment, with installation and service across the GCC." },
  { slug: "sup-6", ar: "واحة المزارع", en: "Farm Oasis", logo: "🥬", country: "SA", city: "الدمام", cats: ["c-agri", "c-food", "c-frozen"], rating: 4.3, years: 5,
    descAr: "توريد يومي للخضروات والفواكه الطازجة مباشرة من المزارع.", descEn: "Daily farm-to-kitchen supply of fresh produce for restaurants and hotels." },
  { slug: "sup-7", ar: "كلين إيدج للمنظفات", en: "CleanEdge Hygiene", logo: "🧼", country: "KW", city: "مدينة الكويت", cats: ["c-clean", "c-clean-chem", "c-clean-paper", "c-disp", "c-pack-plastic"], rating: 4.6, years: 12,
    descAr: "منظفات صناعية ومستلزمات نظافة للمنشآت الغذائية.", descEn: "Industrial cleaning chemicals and hygiene supplies for food businesses." },
  { slug: "sup-8", ar: "بن الهضبة", en: "Highland Coffee Roasters", logo: "☕", country: "SA", city: "الرياض", cats: ["c-drinks", "c-food", "c-snacks"], rating: 4.9, years: 6,
    descAr: "محمصة متخصصة تورّد المقاهي بحبوب قهوة مختصة.", descEn: "Specialty roastery supplying cafés with single-origin beans and bespoke roast profiles." },
  { slug: "sup-9", ar: "الأطلس للتجارة", en: "Atlas Trading", logo: "🫒", country: "MA", city: "الدار البيضاء", cats: ["c-oils", "c-agri", "c-food", "c-canned"], rating: 4.2, years: 17,
    descAr: "مصدّر مغربي لزيت الزيتون البكر والمنتجات الزراعية العضوية.", descEn: "Moroccan exporter of extra virgin olive oil and certified organic produce." },
  { slug: "sup-10", ar: "الدوحة للتوريدات الغذائية", en: "Doha Food Supplies", logo: "🍽️", country: "QA", city: "الدوحة", cats: ["c-frozen", "c-food", "c-canned", "c-dairy", "c-drinks"], rating: 4.5, years: 8,
    descAr: "توريد شامل للفنادق وشركات الإعاشة مع طلبات أسبوعية مجدولة.", descEn: "Full-range supply for hotels and catering companies, with scheduled weekly replenishment." },
];

const buyerSeeds = [
  { slug: "buy-1", ar: "مطاعم الذواقة", en: "Gourmet Restaurants Co.", logo: "🍴", country: "SA", city: "الرياض" },
  { slug: "buy-2", ar: "سوبرماركت الأسرة", en: "Family Supermarket", logo: "🛒", country: "SA", city: "جدة" },
  { slug: "buy-3", ar: "فنادق النخيل", en: "Palm Hotels Group", logo: "🏨", country: "AE", city: "دبي" },
  { slug: "buy-4", ar: "مقاهي ركن القهوة", en: "Coffee Corner Cafés", logo: "☕", country: "SA", city: "الدمام" },
];

export function buildSeed() {
  const companyRows: CompanyRow[] = [];
  const addressRows: AddressRow[] = [];
  const supplierRows: SupplierRow[] = [];
  const supplierCategoryRows: { supplierId: string; categoryId: string }[] = [];
  const userRows: Omit<UserRow, "passwordHash">[] = [];

  const idFor = new Map<string, string>();
  const dial = (code: string) => countryRows.find((c) => c.code === code)!.dialCode;

  for (const s of supplierSeeds) {
    const id = randomUUID();
    idFor.set(s.slug, id);
    companyRows.push({
      id, nameAr: s.ar, nameEn: s.en, legalName: `${s.en} LLC`,
      taxId: `${s.country}${intBetween(100000000, 999999999)}`, logo: s.logo,
      descriptionAr: s.descAr, descriptionEn: s.descEn,
      countryCode: s.country, city: s.city, website: `https://${s.slug}.example.com`,
      phone: `${dial(s.country)}${intBetween(500000000, 599999999)}`,
      email: `contact@${s.slug}.example.com`,
      verification: rand() > 0.15 ? "verified" : "pending",
      memberSince: daysAgo(s.years * 365 + intBetween(0, 200)),
    });
    addressRows.push({
      companyId: id, labelAr: "المقر الرئيسي", labelEn: "Head office",
      line: `${intBetween(10, 900)} ${s.en} St.`, city: s.city, countryCode: s.country,
      contactName: s.en, phone: `${dial(s.country)}${intBetween(500000000, 599999999)}`, isDefault: true,
    });

    const badges = ["verified"];
    if (s.rating >= 4.6) badges.push("top_rated");
    if (s.years >= 10) badges.push("gold");
    if (rand() > 0.4) badges.push("fast_response");

    supplierRows.push({
      id, rating: String(s.rating), reviewCount: intBetween(24, 310),
      responseHours: String(round2(between(0.5, 9))),
      onTimeRate: String(round2(between(0.88, 0.995))),
      fulfilledOrders: intBetween(180, 4200), yearsActive: s.years, badges,
    });
    for (const cat of s.cats) supplierCategoryRows.push({ supplierId: id, categoryId: cat });

    userRows.push({
      companyId: id, name: s.en, email: `${s.slug}@waw.example.com`,
      phone: `+9665${intBetween(10000000, 99999999)}`, role: "supplier",
      avatarColor: pick(["#0369a1", "#0f766e", "#7c3aed", "#b45309", "#be123c"]),
    });
  }

  for (const b of buyerSeeds) {
    const id = randomUUID();
    idFor.set(b.slug, id);
    companyRows.push({
      id, nameAr: b.ar, nameEn: b.en, legalName: `${b.en} LLC`,
      taxId: `${b.country}${intBetween(100000000, 999999999)}`, logo: b.logo,
      countryCode: b.country, city: b.city,
      phone: `${dial(b.country)}${intBetween(500000000, 599999999)}`,
      email: `contact@${b.slug}.example.com`,
      verification: "verified", memberSince: daysAgo(intBetween(200, 900)),
    });
    addressRows.push({
      companyId: id, labelAr: "المستودع الرئيسي", labelEn: "Main warehouse",
      line: `${intBetween(10, 900)} ${b.en} Rd.`, city: b.city, countryCode: b.country,
      contactName: b.en, phone: `${dial(b.country)}${intBetween(500000000, 599999999)}`, isDefault: true,
    });
    userRows.push({
      companyId: id, name: b.en, email: `${b.slug}@waw.example.com`,
      phone: `+9665${intBetween(10000000, 99999999)}`, role: "buyer",
      avatarColor: pick(["#0369a1", "#0f766e", "#7c3aed", "#b45309"]),
    });
  }

  userRows.push({
    companyId: null, name: "WAW Operations", email: "admin@waw.example.com",
    phone: "+966500000000", role: "admin", avatarColor: "#020617",
  });

  /* ------------------------------------------------------------- products */
  const productRows: ProductRow[] = [];
  const priceTierRows: { productId: string; minQty: number; price: string }[] = [];
  const priceHistoryRows: { productId: string; observedOn: string; avgPrice: string; volume: number }[] = [];
  const productIndex: { id: string; supplierId: string; unit: Unit; moq: number; leadTimeDays: number; entry: number; nameAr: string; nameEn: string; categoryId: string }[] = [];

  for (const arch of archetypes) {
    const matching = supplierSeeds.filter((s) => s.cats.includes(arch.categoryId));
    const pool = [...matching];
    if (pool.length < 3) {
      const others = supplierSeeds.filter((s) => !pool.includes(s)).sort(() => rand() - 0.5);
      pool.push(...others.slice(0, 3 - pool.length));
    }
    const chosen = [...pool].sort(() => rand() - 0.5).slice(0, Math.min(pool.length, intBetween(3, 4)));

    for (const sup of chosen) {
      const id = randomUUID();
      const supplierId = idFor.get(sup.slug)!;
      const base = round2(arch.basePrice * between(0.86, 1.18));
      const moq = Math.max(1, Math.round(arch.moq * between(0.7, 1.35)));
      const stock = intBetween(0, 40) === 0 ? 0 : intBetween(moq, moq * 26);
      const availability = stock === 0
        ? (arch.unit === "piece" ? "made_to_order" : "out_of_stock")
        : stock < moq * 2 ? "low_stock" : "in_stock";

      productRows.push({
        id, supplierId, categoryId: arch.categoryId,
        nameAr: arch.nameAr, nameEn: arch.nameEn,
        descriptionAr: `${arch.nameAr} من ${sup.ar}. مناسب للمطاعم والمتاجر وشركات الإعاشة، بأسعار جملة متدرجة حسب الكمية.`,
        descriptionEn: `${arch.nameEn} supplied by ${sup.en}. Suited to restaurants, retailers and catering, priced on a volume ladder.`,
        brand: pick(arch.brands), image: arch.glyph, specs: arch.specs,
        unit: arch.unit, moq, stock, leadTimeDays: Math.max(1, Math.round(arch.leadTimeDays * between(0.7, 1.4))),
        currency: "SAR", originCountry: sup.country, availability,
        rating: String(round2(Math.min(5, sup.rating + between(-0.4, 0.25)))),
        reviewCount: intBetween(3, 180), soldUnits: intBetween(120, 48000),
        tags: arch.tags, createdAt: daysAgo(intBetween(20, 700)),
      });

      const tiers = [
        { minQty: moq, price: base },
        { minQty: Math.round(moq * 3), price: round2(base * between(0.93, 0.96)) },
        { minQty: Math.round(moq * 8), price: round2(base * between(0.86, 0.91)) },
        { minQty: Math.round(moq * 20), price: round2(base * between(0.78, 0.85)) },
      ];
      // Collapse duplicate thresholds that appear when moq is very small.
      const seen = new Set<number>();
      for (const t of tiers) {
        if (seen.has(t.minQty)) continue;
        seen.add(t.minQty);
        priceTierRows.push({ productId: id, minQty: t.minQty, price: money(t.price) });
      }

      const drift = between(-0.0045, 0.0075);
      const seasonal = between(0.02, 0.09);
      const phase = between(0, Math.PI * 2);
      const demandBase = Math.max(4, (productRows[productRows.length - 1].soldUnits as number) / 260);
      for (let w = 25; w >= 0; w -= 1) {
        const t = 25 - w;
        const wave = Math.sin(phase + (t / 26) * Math.PI * 2);
        priceHistoryRows.push({
          productId: id,
          observedOn: dateOnly(daysAgo(w * 7)),
          avgPrice: money(base * (1 + drift * t + seasonal * wave + between(-0.012, 0.012))),
          volume: Math.max(1, Math.round(demandBase * (1 + 0.35 * wave + between(-0.15, 0.2)))),
        });
      }

      productIndex.push({
        id, supplierId, unit: arch.unit, moq, leadTimeDays: arch.leadTimeDays,
        entry: base, nameAr: arch.nameAr, nameEn: arch.nameEn, categoryId: arch.categoryId,
      });
    }
  }

  /* -------------------------------------------------------------- reviews */
  const reviewBodies = [
    ["التزام ممتاز بالمواعيد والجودة مطابقة للعينة تمامًا.", "Excellent punctuality and the quality matched the sample exactly."],
    ["الأسعار تنافسية والتعامل احترافي، سنكرر الطلب.", "Competitive pricing and professional handling — we'll reorder."],
    ["تأخر الشحن يومين لكن تم التعويض بخصم على الطلب التالي.", "Shipping ran two days late but they credited the next order."],
    ["فريق المبيعات سريع الرد ويقدّم بدائل عند نفاد الصنف.", "Sales team replies fast and offers alternatives when an item runs out."],
    ["التغليف ممتاز ولا توجد أي تلفيات في الشحنة.", "Packaging was excellent, zero damage in the shipment."],
  ];
  const reviewRows: ReviewRow[] = [];
  for (const s of supplierSeeds) {
    for (let i = 0; i < intBetween(3, 6); i += 1) {
      const [ar, en] = pick(reviewBodies);
      reviewRows.push({
        supplierId: idFor.get(s.slug)!,
        buyerCompanyId: idFor.get(pick(buyerSeeds).slug)!,
        rating: Math.min(5, Math.max(3, Math.round(s.rating + between(-1, 0.6)))),
        bodyAr: ar, bodyEn: en, createdAt: daysAgo(intBetween(5, 420)),
      });
    }
  }

  /* --------------------------------------------------------------- orders */
  const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;
  const carriers = ["Aramex", "SMSA", "DHL Express", "Naqel", "WAW Fleet"];
  const orderRows: OrderRow[] = [];
  const orderLineRows: OrderLineRow[] = [];
  const orderEventRows: OrderEventRow[] = [];

  for (let i = 0; i < 34; i += 1) {
    const orderId = randomUUID();
    const buyer = pick(buyerSeeds);
    const ageDays = intBetween(1, 240);
    const lines: { productId: string; supplierId: string; nameAr: string; nameEn: string; qty: number; unitPrice: number; unit: Unit }[] = [];

    for (let l = 0; l < intBetween(1, 4); l += 1) {
      const p = pick(productIndex);
      const qty = Math.round(p.moq * between(1, 6));
      lines.push({
        productId: p.id, supplierId: p.supplierId, nameAr: p.nameAr, nameEn: p.nameEn,
        qty, unitPrice: round2(p.entry * between(0.82, 1)), unit: p.unit,
      });
    }

    const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    const shipping = round2(Math.max(60, subtotal * between(0.012, 0.035)));
    const tax = round2((subtotal + shipping) * 0.15);
    const cancelled = rand() < 0.08;
    const progress = cancelled ? 0 : Math.min(4, Math.floor((240 - ageDays) / 46) + intBetween(0, 2));
    const status = cancelled ? "cancelled" : FLOW[Math.max(0, Math.min(4, progress))];
    const shipped = status === "shipped" || status === "delivered";

    orderRows.push({
      id: orderId, reference: `WAW-${26000 + i}`, buyerCompanyId: idFor.get(buyer.slug)!,
      subtotal: money(subtotal), shipping: money(shipping), tax: money(tax),
      total: money(subtotal + shipping + tax), currency: "SAR", status,
      paymentStatus: cancelled ? "refunded" : status === "delivered" ? "paid" : rand() > 0.4 ? "paid" : "authorized",
      paymentMethod: pick(["bank_transfer", "card", "credit_terms"]),
      carrier: shipped ? pick(carriers) : null,
      trackingNumber: shipped ? `TRK${intBetween(100000000, 999999999)}` : null,
      etaDays: intBetween(2, 12), createdAt: daysAgo(ageDays),
    });

    for (const l of lines) {
      orderLineRows.push({
        orderId, productId: l.productId, supplierId: l.supplierId,
        nameAr: l.nameAr, nameEn: l.nameEn, qty: l.qty, unitPrice: money(l.unitPrice), unit: l.unit,
      });
    }

    type Stage = { status: NonNullable<OrderRow["status"]>; at: number };
    const stages: Stage[] = cancelled
      ? [{ status: "pending", at: ageDays }, { status: "cancelled", at: Math.max(0, ageDays - 1) }]
      : FLOW.slice(0, FLOW.indexOf(status as (typeof FLOW)[number]) + 1)
          .map((st, idx) => ({ status: st, at: Math.max(0, ageDays - idx * 2) }));
    for (const st of stages) {
      orderEventRows.push({ orderId, status: st.status, createdAt: daysAgo(st.at) });
    }
  }

  /* ----------------------------------------------------------- RFQ + quotes */
  const rfqRows: RfqRow[] = [];
  const rfqInvitationRows: { rfqId: string; supplierId: string }[] = [];
  const quoteRows: QuoteRow[] = [];

  for (let i = 0; i < 10; i += 1) {
    const rfqId = randomUUID();
    const buyer = pick(buyerSeeds);
    const p = pick(productIndex);
    const age = intBetween(1, 60);
    const invitedSlugs = supplierSeeds
      .filter((s) => s.cats.includes(p.categoryId))
      .slice(0, intBetween(2, 4));
    const invited = invitedSlugs.length ? invitedSlugs : [supplierSeeds[0]];
    const quoteCount = age > 3 ? intBetween(0, invited.length) : 0;

    rfqRows.push({
      id: rfqId, reference: `RFQ-${4100 + i}`, buyerCompanyId: idFor.get(buyer.slug)!,
      titleAr: `توريد ${p.nameAr}`, titleEn: `Supply of ${p.nameEn}`,
      categoryId: p.categoryId, productId: p.id,
      qty: Math.round(p.moq * between(2, 12)), unit: p.unit,
      targetPrice: money(p.entry * between(0.82, 0.96)), currency: "SAR",
      specs: "", neededBy: dateOnly(daysAhead(intBetween(5, 45))),
      deliveryCity: buyer.city, deliveryCountry: buyer.country,
      paymentTerms: pick(["net_30", "prepaid", "50_50"]),
      shippingTerms: pick(["DDP", "CIF", "EXW"]), notes: "",
      status: quoteCount > 0 ? "quoted" : "open",
      createdAt: daysAgo(age), expiresAt: daysAhead(Math.max(2, 30 - age)),
    });

    for (const s of invited) rfqInvitationRows.push({ rfqId, supplierId: idFor.get(s.slug)! });

    for (let q = 0; q < quoteCount; q += 1) {
      quoteRows.push({
        rfqId, supplierId: idFor.get(invited[q].slug)!,
        unitPrice: money(p.entry * between(0.82, 1.06)), currency: "SAR",
        moq: Math.max(1, Math.round(p.moq * between(0.8, 1.2))),
        leadTimeDays: Math.max(1, Math.round(p.leadTimeDays * between(0.7, 1.6))),
        shippingCost: money(between(150, 1400)),
        shippingTerms: pick(["DDP", "EXW", "FOB", "CIF"]),
        paymentTerms: pick(["prepaid", "net_15", "net_30", "50_50"]),
        validUntil: daysAhead(intBetween(3, 21)), notes: "", status: "submitted",
        createdAt: daysAgo(Math.max(0, age - intBetween(1, 3))),
      });
    }
  }

  /* --------------------------------------------------------- negotiations */
  const negotiationRows: NegotiationRow[] = [];
  const negotiationRoundRows: NegotiationRoundRow[] = [];

  for (let i = 0; i < 5; i += 1) {
    const negotiationId = randomUUID();
    const p = pick(productIndex);
    const buyer = pick(buyerSeeds);
    const qty = Math.round(p.moq * between(3, 9));
    const target = round2(p.entry * between(0.78, 0.9));
    const counter = round2((p.entry + target) / 2);
    const age = intBetween(2, 40);
    const supplierName = supplierSeeds.find((s) => idFor.get(s.slug) === p.supplierId)?.en ?? "Supplier";

    negotiationRows.push({
      id: negotiationId, reference: `NEG-${7300 + i}`, productId: p.id,
      buyerCompanyId: idFor.get(buyer.slug)!, supplierId: p.supplierId,
      currency: "SAR", status: "active", createdAt: daysAgo(age),
    });
    negotiationRoundRows.push({
      negotiationId, byParty: "buyer", actorName: buyer.en, kind: "offer",
      unitPrice: money(target), qty, moq: p.moq, shippingCost: "0",
      shippingTerms: "DDP", paymentTerms: "net_30",
      message: "نطلب سعرًا أفضل مقابل التزام بكمية أكبر وتعاقد ربع سنوي.",
      createdAt: daysAgo(age),
    });
    negotiationRoundRows.push({
      negotiationId, byParty: "supplier", actorName: supplierName, kind: "counter",
      unitPrice: money(counter), qty: Math.round(qty * 1.2), moq: p.moq,
      shippingCost: money(between(200, 900)), shippingTerms: "DDP", paymentTerms: "50_50",
      message: "يمكننا الوصول لهذا السعر عند رفع الكمية 20% مع دفعة مقدمة 50%.",
      createdAt: daysAgo(Math.max(0, age - 1)),
    });
  }

  /* -------------------------------------------------------- notifications */
  const buyerUserEmail = "buy-1@waw.example.com";
  const notificationRows = [
    { email: buyerUserEmail, kind: "quote_new", titleAr: "عرض سعر جديد", titleEn: "New quotation received",
      bodyAr: "استلمت عرضًا جديدًا على أحد طلباتك.", bodyEn: "A new quote landed on one of your requests.",
      href: "/rfq", channels: ["in_app", "email", "push"], createdAt: daysAgo(0.2) },
    { email: buyerUserEmail, kind: "price_drop", titleAr: "انخفاض سعر", titleEn: "Price drop alert",
      bodyAr: "انخفض متوسط سعر كرتون المياه 6.4% خلال أسبوعين — وقت مناسب لإعادة الطلب.",
      bodyEn: "Water carton average price fell 6.4% in two weeks — a good window to reorder.",
      href: "/intelligence", channels: ["in_app", "whatsapp"], createdAt: daysAgo(1) },
    { email: buyerUserEmail, kind: "shipping_update", titleAr: "تحديث شحنة", titleEn: "Shipment update",
      bodyAr: "شحنتك في الطريق ومتوقع وصولها خلال يومين.", bodyEn: "Your shipment is in transit, arriving in two days.",
      href: "/orders", channels: ["in_app", "sms"], createdAt: daysAgo(2) },
    { email: buyerUserEmail, kind: "ai_insight", titleAr: "توصية من WAW AI", titleEn: "WAW AI recommendation",
      bodyAr: "بناءً على وتيرة استهلاكك، يُنصح بإعادة طلب الزيت خلال 9 أيام.",
      bodyEn: "Based on your consumption rate, reorder cooking oil within 9 days.",
      href: "/forecasting", channels: ["in_app", "push"], createdAt: daysAgo(3) },
    { email: "sup-1@waw.example.com", kind: "rfq_new", titleAr: "طلب عرض سعر جديد", titleEn: "New RFQ invitation",
      bodyAr: "تمت دعوتك لتقديم عرض على طلب توريد جديد.", bodyEn: "You have been invited to quote on a new sourcing request.",
      href: "/rfq", channels: ["in_app", "email"], createdAt: daysAgo(0.5) },
  ];

  return {
    companies: companyRows,
    addresses: addressRows,
    suppliers: supplierRows,
    supplierCategories: supplierCategoryRows,
    users: userRows,
    products: productRows,
    priceTiers: priceTierRows,
    priceHistory: priceHistoryRows,
    reviews: reviewRows,
    orders: orderRows,
    orderLines: orderLineRows,
    orderEvents: orderEventRows,
    rfqs: rfqRows,
    rfqInvitations: rfqInvitationRows,
    quotes: quoteRows,
    negotiations: negotiationRows,
    negotiationRounds: negotiationRoundRows,
    notifications: notificationRows,
  };
}
