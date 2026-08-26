import { BASE, createReporter, launch } from "./helpers.mjs";

/** Every route must render real content and raise no runtime errors. */
const routes = [
  "/", "/search", "/search?q=%D9%85%D9%8A%D8%A7%D9%87", "/suppliers", "/product/p-1",
  "/supplier/sup-1", "/cart", "/ai", "/intelligence", "/forecasting",
  "/login", "/register", "/company", "/rfq", "/orders", "/nope-404",
];

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const r = createReporter();
r.watch(page);

for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  const chars = await page.evaluate(() => document.body.innerText.trim().length);
  r.check(`renders ${route}`, chars > 50, `chars=${chars}`);
}

await browser.close();
r.finish();
