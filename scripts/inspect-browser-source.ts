import { withBrowserPage } from "@/lib/playwright/browser";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getPlatformConnection } from "@/lib/connections/queries";

type SupportedSource = "google_jobs" | "linkedin" | "indeed";

function parseSource(value: string | undefined): SupportedSource {
  if (value === "google_jobs" || value === "linkedin" || value === "indeed") {
    return value;
  }

  return "google_jobs";
}

function buildSearchUrl(source: SupportedSource, keywords: string) {
  const query = encodeURIComponent(keywords.trim());

  if (source === "google_jobs") {
    return `https://www.google.com/search?q=${query}&ibp=htl;jobs`;
  }

  if (source === "linkedin") {
    return `https://www.linkedin.com/jobs/search/?keywords=${query}`;
  }

  return `https://www.indeed.com/jobs?q=${query}`;
}

async function main() {
  await ensureDefaultRecords();

  const args = process.argv.slice(2);
  const source = parseSource(args[0]);
  const keywords = args.slice(1).join(" ").trim() || "operations manager remote";
  const connection = await getPlatformConnection(source);

  if (!connection) {
    throw new Error(`No platform connection found for ${source}.`);
  }

  const searchUrl = buildSearchUrl(source, keywords);

  const result = await withBrowserPage({
    browserType: connection.browserType,
    browserProfileName: connection.browserProfileName,
    connectionMode: "attach",
    debugPort: connection.debugPort ?? 9222,
    handler: async (page) => {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3500);

      return page.evaluate(() => {
        const anchorSummaries = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((anchor) => ({
            href: anchor.href,
            text: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
            ariaLabel: anchor.getAttribute("aria-label"),
          }))
          .filter(
            (anchor) =>
              anchor.href.length > 0 &&
              (!anchor.href.includes("google.com") ||
                anchor.text.length > 20 ||
                (anchor.ariaLabel?.length ?? 0) > 0),
          )
          .slice(0, 80);

        const roleSummaries = Array.from(document.querySelectorAll("[role]"))
          .slice(0, 60)
          .map((element) => ({
            role: element.getAttribute("role"),
            text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) ?? "",
          }));

        const dataHrefElements = Array.from(
          document.querySelectorAll<HTMLElement>("[data-href], [data-url], [data-ved]"),
        )
          .map((element) => ({
            tag: element.tagName,
            dataHref: element.getAttribute("data-href"),
            dataUrl: element.getAttribute("data-url"),
            text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 180) ?? "",
          }))
          .filter((element) => element.dataHref || element.dataUrl || /via /.test(element.text))
          .slice(0, 40);

        return {
          title: document.title,
          url: window.location.href,
          bodyTextSample: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 1200) ?? "",
          anchorSummaries,
          roleSummaries,
          dataHrefElements,
        };
      });
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
