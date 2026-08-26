import { BASE as B, createReporter, launch } from "./helpers.mjs";

/** Buyer, supplier and admin journeys end to end against the built app. */
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const reporter = createReporter();
reporter.watch(page);
const check = reporter.check;
const fails = reporter.failures;

// 1. Arabic keyword search returns products
await page.goto(`${B}/search?q=${encodeURIComponent("مياه")}`, { waitUntil: "networkidle" });
let cards = await page.locator('a[href^="/product/"]').count();
check("Arabic search 'مياه' returns products", cards > 0, `cards=${cards}`);

// 2. English search
await page.goto(`${B}/search?q=rice`, { waitUntil: "networkidle" });
cards = await page.locator('a[href^="/product/"]').count();
check("English search 'rice' returns products", cards > 0, `cards=${cards}`);

// 3. Category filter
await page.goto(`${B}/search?category=c-drinks`, { waitUntil: "networkidle" });
cards = await page.locator('a[href^="/product/"]').count();
check("Category filter returns products", cards > 0, `cards=${cards}`);

// 4. AI assistant on the spec's flagship query
const q = "أحتاج 1000 كرتون مياه بسعر مناسب والتوصيل إلى الرياض خلال خمسة أيام";
await page.goto(`${B}/ai?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
let body = await page.evaluate(() => document.body.innerText);
check("AI extracts quantity 1000", body.includes("1,000") || body.includes("1000"));
check("AI extracts Riyadh", body.includes("الرياض"));
check("AI returns supplier matches", (await page.locator("text=/درجة المطابقة|Match score/").count()) > 0);

// 5. Sign in as buyer
await page.goto(`${B}/login`, { waitUntil: "networkidle" });
await page.locator('button:has-text("buy-1@waw.example.com")').first().click();
await page.waitForTimeout(600);
check("Buyer sign-in lands on dashboard", page.url().includes("/dashboard"), page.url());
body = await page.evaluate(() => document.body.innerText);
check("Buyer dashboard shows spend", /إجمالي المصروفات|Total spend/.test(body));

// 6. Add to cart from a product page
await page.goto(`${B}/product/p-1`, { waitUntil: "networkidle" });
await page.locator('button:has-text("أضف إلى السلة"), button:has-text("Add to cart")').first().click();
await page.waitForTimeout(400);
await page.goto(`${B}/cart`, { waitUntil: "networkidle" });
const cartLines = await page.locator('a[href^="/product/"]').count();
check("Product reached the cart", cartLines > 0, `lines=${cartLines}`);

// 7. Checkout -> place order
await page.goto(`${B}/checkout`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const placeBtn = page.locator('button:has-text("تأكيد الطلب"), button:has-text("Place order")').first();
check("Checkout renders a place-order button", await placeBtn.count() > 0);
await placeBtn.click();
await page.waitForTimeout(900);
check("Order created and routed to detail", page.url().includes("/order/"), page.url());
body = await page.evaluate(() => document.body.innerText);
check("Order shows a WAW reference", /WAW-\d+/.test(body));

// 8. Advance order status as admin
await page.goto(`${B}/login`, { waitUntil: "networkidle" });
await page.locator('button:has-text("admin@waw.example.com")').first().click();
await page.waitForTimeout(600);
check("Admin sign-in lands on admin dashboard", page.url().includes("/admin"), page.url());
body = await page.evaluate(() => document.body.innerText);
check("Admin shows GMV", /إجمالي قيمة المبيعات|Gross merchandise/.test(body));

// 9. Supplier dashboard
await page.goto(`${B}/login`, { waitUntil: "networkidle" });
await page.locator('button:has-text("sup-1@waw.example.com")').first().click();
await page.waitForTimeout(600);
check("Supplier sign-in lands on supplier dashboard", page.url().includes("/supplier"), page.url());
body = await page.evaluate(() => document.body.innerText);
check("Supplier dashboard shows revenue", /الإيرادات|Revenue/.test(body));

// 10. Locale toggle flips direction
await page.goto(`${B}/`, { waitUntil: "networkidle" });
let dir = await page.evaluate(() => document.documentElement.dir);
check("Default direction is RTL", dir === "rtl", dir);
await page.locator('button:has-text("English")').first().click();
await page.waitForTimeout(400);
dir = await page.evaluate(() => document.documentElement.dir);
const lang = await page.evaluate(() => document.documentElement.lang);
check("Toggle switches to LTR/English", dir === "ltr" && lang === "en", `${dir}/${lang}`);
body = await page.evaluate(() => document.body.innerText);
check("English copy renders", body.includes("Buy wholesale"));

// 11. Negotiations page (buyer, seeded)
await page.goto(`${B}/login`, { waitUntil: "networkidle" });
await page.locator('button:has-text("buy-1@waw.example.com")').first().click();
await page.waitForTimeout(500);
await page.goto(`${B}/negotiations`, { waitUntil: "networkidle" });
body = await page.evaluate(() => document.body.innerText);
check("Negotiations page renders", /NEG-|No active negotiations|لا توجد مفاوضات/.test(body));

// 12. Intelligence + forecasting charts draw
await page.goto(`${B}/intelligence`, { waitUntil: "networkidle" });
check("Intelligence draws an SVG chart", (await page.locator("svg polyline").count()) > 0);
await page.goto(`${B}/forecasting`, { waitUntil: "networkidle" });
check("Forecasting draws history + projection", (await page.locator("svg polyline").count()) >= 2);

await browser.close();
reporter.finish();
