import { chromium } from "playwright";

export const BASE = process.env.WAW_E2E_URL ?? "http://localhost:4173";

/**
 * Launch Chromium. `WAW_CHROMIUM` points at a pre-installed binary for
 * sandboxes that ship their own browser; otherwise Playwright resolves its own.
 */
export function launch() {
  const executablePath = process.env.WAW_CHROMIUM;
  return chromium.launch(executablePath ? { executablePath } : {});
}

export function createReporter() {
  const failures = [];
  return {
    failures,
    check(label, ok, extra = "") {
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
      if (!ok) failures.push(`${label}${extra ? ` (${extra})` : ""}`);
    },
    /** Collect page errors, ignoring network noise from blocked font CDNs. */
    watch(page) {
      page.on("pageerror", (e) => failures.push(`[pageerror] ${page.url()} :: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_RESET")) {
          failures.push(`[console] ${page.url()} :: ${m.text()}`);
        }
      });
    },
    finish() {
      console.log("\n--- failures ---");
      console.log(failures.length ? failures.join("\n") : "none");
      process.exit(failures.length ? 1 : 0);
    },
  };
}
