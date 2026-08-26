import type { Unit } from "../types";

/**
 * Rule-based natural-language understanding for Arabic and English commerce
 * queries. It is deterministic, offline and explainable: the assistant shows
 * the user exactly which slots it extracted, so a wrong reading is visible
 * and correctable rather than silent.
 *
 * A hosted LLM can replace `parse()` behind the same `ParsedQuery` contract.
 */

export type Intent =
  | "search"
  | "rfq"
  | "negotiate"
  | "reorder"
  | "track_order"
  | "price_analysis"
  | "supplier_match"
  | "forecast"
  | "greeting"
  | "unknown";

export interface ParsedQuery {
  raw: string;
  intent: Intent;
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

const arabicDigits: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** Written Arabic numbers, so "خمسة أيام" resolves like "5 أيام". */
const arabicWordNumbers: Record<string, number> = {
  صفر: 0, واحد: 1, واحده: 1, اثنين: 2, اثنان: 2, اثنتين: 2, ثلاثه: 3, ثلاث: 3,
  اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7,
  ثمانيه: 8, ثماني: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10,
  عشرين: 20, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70,
  ثمانين: 80, تسعين: 90, مئه: 100, مائه: 100, مئتين: 200, الف: 1000,
  الفين: 2000, اسبوع: 7, اسبوعين: 14, شهر: 30, شهرين: 60,
};

const englishWordNumbers: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twenty: 20, thirty: 30, fifty: 50, hundred: 100, thousand: 1000,
  week: 7, fortnight: 14, month: 30,
};

const unitWords: { unit: Unit; words: string[] }[] = [
  { unit: "carton", words: ["كرتون", "كراتين", "كرتونه", "carton", "cartons", "case", "cases"] },
  { unit: "pallet", words: ["طبليه", "طبليات", "باله", "pallet", "pallets"] },
  { unit: "kg", words: ["كيلو", "كجم", "كيلوغرام", "kg", "kilo", "kilos", "kilogram"] },
  { unit: "liter", words: ["لتر", "لترات", "liter", "litre", "liters", "litres"] },
  { unit: "box", words: ["صندوق", "صناديق", "علبه", "علب", "box", "boxes"] },
  { unit: "piece", words: ["قطعه", "قطع", "حبه", "حبات", "piece", "pieces", "unit", "units"] },
];

const cityWords: { city: string; country: string; words: string[] }[] = [
  { city: "الرياض", country: "SA", words: ["الرياض", "رياض", "riyadh"] },
  { city: "جدة", country: "SA", words: ["جده", "jeddah", "jedda"] },
  { city: "الدمام", country: "SA", words: ["الدمام", "دمام", "dammam"] },
  { city: "مكة المكرمة", country: "SA", words: ["مكه", "makkah", "mecca"] },
  { city: "المدينة المنورة", country: "SA", words: ["المدينه", "madinah", "medina"] },
  { city: "دبي", country: "AE", words: ["دبي", "dubai"] },
  { city: "أبوظبي", country: "AE", words: ["ابوظبي", "abu dhabi", "abudhabi"] },
  { city: "الشارقة", country: "AE", words: ["الشارقه", "sharjah"] },
  { city: "القاهرة", country: "EG", words: ["القاهره", "cairo"] },
  { city: "الإسكندرية", country: "EG", words: ["الاسكندريه", "alexandria"] },
  { city: "الدوحة", country: "QA", words: ["الدوحه", "doha"] },
  { city: "مدينة الكويت", country: "KW", words: ["الكويت", "kuwait"] },
  { city: "عمّان", country: "JO", words: ["عمان", "amman"] },
  { city: "إسطنبول", country: "TR", words: ["اسطنبول", "istanbul"] },
  { city: "الدار البيضاء", country: "MA", words: ["الدار البيضاء", "casablanca"] },
];

const intentRules: { intent: Intent; words: string[]; weight: number }[] = [
  { intent: "greeting", words: ["مرحبا", "السلام عليكم", "اهلا", "hi", "hello", "hey", "صباح الخير", "مساء الخير"], weight: 3 },
  { intent: "rfq", words: ["عرض سعر", "عروض اسعار", "طلب عرض", "rfq", "quotation", "quote me", "request a quote", "اطلب عرض"], weight: 5 },
  { intent: "negotiate", words: ["تفاوض", "افاوض", "خصم", "سعر افضل", "تخفيض", "negotiate", "discount", "better price", "counter offer"], weight: 5 },
  { intent: "reorder", words: ["اعاده طلب", "اعيد الطلب", "نفس الطلب", "reorder", "order again", "repeat order", "اعاده الطلب"], weight: 5 },
  { intent: "track_order", words: ["اين طلبي", "تتبع", "حاله الطلب", "شحنتي", "track", "where is my order", "order status", "shipment"], weight: 5 },
  { intent: "price_analysis", words: ["متوسط السعر", "متوسط سعر", "تحليل الاسعار", "تحليل سعر", "سعر السوق", "السعر في السوق", "مقارنه اسعار", "price analysis", "market price", "average price", "compare prices"], weight: 5 },
  { intent: "supplier_match", words: ["مورد", "موردين", "افضل مورد", "supplier", "suppliers", "vendor", "manufacturer"], weight: 4 },
  { intent: "forecast", words: ["توقع", "تنبؤ", "الطلب القادم", "forecast", "predict", "demand next", "trend"], weight: 5 },
  { intent: "search", words: ["ابحث", "احتاج", "اريد", "ابغى", "عندك", "متوفر", "find", "need", "want", "looking for", "search"], weight: 2 },
];

const stopWords = new Set([
  // Filler
  "في", "من", "الي", "علي", "عن", "مع", "او", "هذا", "هذه", "التي", "الذي",
  "لو", "سمحت", "الرجاء", "خلال", "لدي", "هل", "يوجد", "عندكم", "ممكن", "شكرا",
  "the", "and", "for", "with", "please", "can", "you", "some", "that", "this",
  // Request verbs — they set the intent, they are not the product
  "احتاج", "اريد", "ابغى", "ابحث", "اطلب", "عايز", "ودي",
  "need", "want", "looking", "find", "search", "get", "give",
  // Commercial vocabulary
  "بسعر", "سعر", "اسعار", "السعر", "متوسط", "مناسب", "افضل", "جيد", "ارخص",
  "عرض", "عروض", "خصم", "تفاوض", "التفاوض", "كميه", "لكميه", "كبيره",
  "توقع", "تنبؤ", "الطلب", "الشهر", "القادم", "الاسبوع",
  "مورد", "موردين", "معتمد", "موثق", "شركه", "شركات",
  "price", "prices", "average", "market", "quote", "quotation", "quotes",
  "discount", "negotiate", "supplier", "suppliers", "vendor", "forecast",
  "demand", "next", "month", "week", "order", "bulk", "quantity",
  // Logistics + currency
  "والتوصيل", "التوصيل", "توصيل", "التسليم", "شحن", "الشحن",
  "delivery", "deliver", "delivered", "shipping", "within", "under", "below",
  "days", "day", "weeks", "ايام", "يوم", "يوما", "اشهر", "سنه",
  "where", "when", "how", "what", "which", "who",
  "ريال", "درهم", "دولار", "sar", "aed", "usd", "riyal",
]);

export function normalize(text: string): string {
  return text
    .split("")
    .map((ch) => arabicDigits[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/(?<!\d)\.(?!\d)/g, " ")
    .replace(/[^\p{L}\p{N}\s.%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads "1000", "1,000", "الف" or "five" into a number. */
function readNumberNear(tokens: string[], index: number): number | null {
  const order = [index - 1, index + 1, index - 2, index + 2];
  for (const i of order) {
    if (i < 0 || i >= tokens.length) continue;
    const t = tokens[i];
    const digits = Number(t.replace(/,/g, ""));
    if (Number.isFinite(digits) && digits > 0) return digits;
    if (arabicWordNumbers[t] != null) return arabicWordNumbers[t];
    if (englishWordNumbers[t] != null) return englishWordNumbers[t];
  }
  return null;
}

export function parse(raw: string): ParsedQuery {
  const text = normalize(raw);
  const tokens = text.split(" ").filter(Boolean);

  // --- intent -------------------------------------------------------------
  let intent: Intent = "unknown";
  let bestWeight = 0;
  const padded = ` ${text} `;
  const hasPhrase = (w: string) => padded.includes(` ${normalize(w)} `);
  for (const rule of intentRules) {
    if (rule.words.some(hasPhrase) && rule.weight > bestWeight) {
      intent = rule.intent;
      bestWeight = rule.weight;
    }
  }

  // --- unit + quantity ----------------------------------------------------
  let unit: Unit | null = null;
  let qty: number | null = null;
  for (const { unit: u, words } of unitWords) {
    const idx = tokens.findIndex((t) => words.includes(t));
    if (idx >= 0) {
      unit = u;
      qty = readNumberNear(tokens, idx);
      break;
    }
  }
  if (qty == null) {
    const bare = tokens.find((t) => /^\d{2,}$/.test(t.replace(/,/g, "")));
    if (bare) qty = Number(bare.replace(/,/g, ""));
  }

  // --- budget -------------------------------------------------------------
  let budget: number | null = null;
  let budgetKind: ParsedQuery["budgetKind"] = null;
  const budgetMatch = text.match(
    /(?:ميزانيه|حد اقصي|اقل من|تحت|budget|under|below|max|around|about)\s*([\d,.]+)/,
  );
  if (budgetMatch) {
    budget = Number(budgetMatch[1].replace(/,/g, ""));
    budgetKind = /اقل من|تحت|under|below|max|حد اقصي/.test(text) ? "max" : "target";
  }
  const currencyMatch = text.match(/([\d,.]+)\s*(ريال|درهم|دولار|sar|aed|usd|riyal)/);
  if (budget == null && currencyMatch) {
    budget = Number(currencyMatch[1].replace(/,/g, ""));
    budgetKind = "target";
  }

  // --- destination --------------------------------------------------------
  let city: string | null = null;
  let countryCode: string | null = null;
  for (const entry of cityWords) {
    if (entry.words.some(hasPhrase)) {
      city = entry.city;
      countryCode = entry.country;
      break;
    }
  }

  // --- deadline -----------------------------------------------------------
  let withinDays: number | null = null;
  const dayIdx = tokens.findIndex((t) => ["يوم", "ايام", "يوما", "day", "days"].includes(t));
  if (dayIdx >= 0) withinDays = readNumberNear(tokens, dayIdx);
  if (withinDays == null) {
    const weekIdx = tokens.findIndex((t) => ["اسبوع", "اسابيع", "week", "weeks"].includes(t));
    if (weekIdx >= 0) {
      const w = readNumberNear(tokens, weekIdx);
      withinDays = w ? (w > 4 ? w : w * 7) : 7;
    }
  }
  if (withinDays == null && /غدا|بكره|tomorrow/.test(text)) withinDays = 1;
  if (withinDays == null && /عاجل|urgent|اليوم|today/.test(text)) withinDays = 1;

  // --- payment terms ------------------------------------------------------
  let paymentTerms: string | null = null;
  if (/اجل|credit|net 30|نت 30|بعد شهر/.test(text)) paymentTerms = "net_30";
  else if (/نصف|دفعتين|50 50/.test(text)) paymentTerms = "50_50";
  else if (/كاش|نقدا|مقدما|prepaid|advance/.test(text)) paymentTerms = "prepaid";

  // --- preference flags ---------------------------------------------------
  const wantsCheapest = /ارخص|اقل سعر|اوفر|cheapest|lowest price|best price|سعر مناسب/.test(text);
  const wantsFastest = /اسرع|عاجل|سريع|fastest|urgent|asap|quick/.test(text);
  const wantsVerified = /موثق|معتمد|verified|certified|trusted/.test(text);

  // --- keywords -----------------------------------------------------------
  const unitTokens = new Set(unitWords.flatMap((u) => u.words));
  const cityTokens = new Set(cityWords.flatMap((c) => c.words.flatMap((w) => normalize(w).split(" "))));
  const keywords = tokens.filter(
    (t) =>
      t.length > 2 &&
      !stopWords.has(t) &&
      !unitTokens.has(t) &&
      !cityTokens.has(t) &&
      !/^\d+([.,]\d+)?$/.test(t) &&
      arabicWordNumbers[t] == null &&
      englishWordNumbers[t] == null,
  );

  if (intent === "unknown" && keywords.length) intent = "search";

  const slots = [qty, unit, budget, city, withinDays].filter((v) => v != null).length;
  const confidence = Math.min(
    0.98,
    0.32 + bestWeight * 0.07 + slots * 0.09 + Math.min(keywords.length, 3) * 0.05,
  );

  return {
    raw,
    intent,
    keywords,
    qty,
    unit,
    budget,
    budgetKind,
    city,
    countryCode,
    withinDays,
    paymentTerms,
    wantsCheapest,
    wantsFastest,
    wantsVerified,
    confidence: Math.round(confidence * 100) / 100,
  };
}
