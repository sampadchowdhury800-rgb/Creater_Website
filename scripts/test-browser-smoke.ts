import puppeteer from "puppeteer";

const PROD_URL = "https://chowdhuryduo.vercel.app";

interface PageResult {
  url: string;
  loaded: boolean;
  status: number;
  consoleErrors: string[];
  cspViolations: string[];
}

async function testPage(browser: any, path: string): Promise<PageResult> {
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  const cspViolations: string[] = [];

  page.on("console", (msg: any) => {
    const text = msg.text();
    const type = msg.type();
    if (text.includes("Content Security Policy") || text.includes("CSP") || text.includes("Report-Only")) {
      cspViolations.push(text);
    } else if (type === "error") {
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err: any) => {
    consoleErrors.push(err.message);
  });

  let status = 0;
  let loaded = false;

  try {
    const res = await page.goto(`${PROD_URL}${path}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    status = res ? res.status() : 0;
    loaded = status >= 200 && status < 400;
  } catch (err: any) {
    consoleErrors.push(err.message);
  } finally {
    await page.close();
  }

  return {
    url: path,
    loaded,
    status,
    consoleErrors,
    cspViolations,
  };
}

async function main() {
  console.log("==================================================================");
  console.log("READ-ONLY BROWSER SMOKE TEST (Puppeteer)");
  console.log("Target:", PROD_URL);
  console.log("Timestamp:", new Date().toISOString());
  console.log("==================================================================\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const routes = [
    "/",
    "/automations",
    "/cart",
    "/about",
    "/projects",
    "/services",
  ];

  for (const r of routes) {
    console.log(`Testing route: ${r}...`);
    const res = await testPage(browser, r);
    console.log(`  Loaded: ${res.loaded} (Status: ${res.status})`);
    console.log(`  CSP Violations: ${res.cspViolations.length}`);
    if (res.cspViolations.length > 0) {
      res.cspViolations.forEach((v) => console.log(`    ⚠️ CSP: ${v}`));
    }
    console.log(`  Console Errors: ${res.consoleErrors.length}`);
    if (res.consoleErrors.length > 0) {
      res.consoleErrors.slice(0, 5).forEach((e) => console.log(`    ❌ Error: ${e.substring(0, 120)}`));
    }
    console.log("");
  }

  await browser.close();
  console.log("Browser smoke test completed.");
}

main().catch(console.error);
