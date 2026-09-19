import puppeteer from "puppeteer";
import nextConfig from "../next.config";

const PROD_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chowdhuryduo.in";

async function main() {
  console.log("==================================================================");
  console.log("CSP REPORT-ONLY REAL-BROWSER SIMULATION TEST (Puppeteer CDP)");
  console.log("Target:", PROD_URL);
  console.log("Timestamp:", new Date().toISOString());
  console.log("==================================================================\n");

  const headerRules = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];
  const globalHeaders = headerRules.find((r: any) => r.source === "/:path*");
  const cspReportOnly = globalHeaders?.headers?.find(
    (h: any) => h.key === "Content-Security-Policy-Report-Only"
  )?.value;

  if (!cspReportOnly) {
    console.error("No CSP Report-Only header found in nextConfig!");
    process.exit(1);
  }

  console.log("Testing with CSP Report-Only Header:");
  console.log(cspReportOnly.substring(0, 150) + "...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const routes = [
    { name: "Homepage", path: "/" },
    { name: "Automations Marketplace", path: "/automations" },
    { name: "Cart", path: "/cart" },
    { name: "About", path: "/about" },
    { name: "Services", path: "/services" },
    { name: "Projects", path: "/projects" },
    { name: "Resume", path: "/resume" },
  ];

  for (const route of routes) {
    console.log(`==================================================================`);
    console.log(`TESTING: ${route.name} (${route.path})`);
    console.log(`------------------------------------------------------------------`);

    const page = await browser.newPage();
    const cspViolations: string[] = [];
    const consoleLogs: string[] = [];

    page.on("console", (msg: any) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (
        text.includes("[Report Only]") ||
        text.includes("Content Security Policy") ||
        text.includes("violates the following Content Security Policy")
      ) {
        cspViolations.push(text);
      }
    });

    const client = await page.createCDPSession();
    await client.send("Fetch.enable", {
      patterns: [{ urlPattern: "*chowdhuryduo.in*", requestStage: "Response" }],
    });

    client.on("Fetch.requestPaused", async (event: any) => {
      const { requestId, responseHeaders = [], responseStatusCode } = event;
      const contentType = responseHeaders.find(
        (h: any) => h.name.toLowerCase() === "content-type"
      )?.value || "";

      // Inject Content-Security-Policy-Report-Only into HTML responses
      if (contentType.includes("text/html")) {
        responseHeaders.push({
          name: "Content-Security-Policy-Report-Only",
          value: cspReportOnly,
        });
      }

      await client.send("Fetch.continueResponse", {
        requestId,
        responseCode: responseStatusCode,
        responseHeaders,
      });
    });

    let loaded = false;
    let status = 0;

    try {
      const res = await page.goto(`${PROD_URL}${route.path}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      status = res ? res.status() : 0;
      loaded = status >= 200 && status < 400;

      // Give extra 2 seconds for client-side scripts, ads, and Clerk components to render
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      console.log(`  Navigation notice: ${err?.message}`);
    }

    console.log(`Page Loaded: ${loaded} (Status: ${status})`);
    console.log(`CSP Report-Only Violations Observed: ${cspViolations.length}`);

    if (cspViolations.length > 0) {
      console.log(`Violations detail:`);
      for (const v of cspViolations) {
        console.log(`  ⚠️  ${v}`);
      }
    } else {
      console.log(`  ✅ Zero CSP violations triggered under Chromium.`);
    }

    await page.close();
    console.log("");
  }

  await browser.close();
  console.log("==================================================================");
  console.log("CSP REPORT-ONLY SIMULATION COMPLETE");
  console.log("==================================================================");
}

main().catch(console.error);
