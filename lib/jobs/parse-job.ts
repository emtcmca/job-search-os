function extractMatch(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function cleanTitle(input: string) {
  return cleanText(
    input
      .replace(/\s+[|\-–]\s+(linkedin|indeed|greenhouse|lever|workday|jobs?).*$/i, "")
      .replace(/\s+[|\-–]\s+[A-Z][A-Za-z0-9 .,&'-]{2,}$/g, "")
      .replace(/\s{2,}/g, " "),
  );
}

function inferCompanyFromHostname(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const first = hostname.split(".")[0] ?? "";
    if (!first || ["jobs", "careers", "apply", "boards"].includes(first.toLowerCase())) {
      return null;
    }

    return first
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

export function stripHtmlToText(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&"),
  );
}

export function inferJobFieldsFromText(input: {
  url: string;
  html: string | null;
  rawDescription: string | null;
  manualTitle: string | null;
  manualCompany: string | null;
  manualLocation: string | null;
}) {
  const html = input.html ?? "";
  const combinedText = cleanText(
    [input.rawDescription ?? "", stripHtmlToText(html)].filter(Boolean).join(" "),
  );

  const titleFromMeta =
    extractMatch(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, html) ??
    extractMatch(/<title>([^<]+)<\/title>/i, html);
  const companyFromMeta =
    extractMatch(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i, html) ??
    extractMatch(/company[:\s]+([A-Z][A-Za-z0-9&.,' -]{2,})/i, combinedText);

  const salaryMatch = combinedText.match(
    /\$([\d,]{2,3}(?:,\d{3})?)(?:\s*-\s*\$([\d,]{2,3}(?:,\d{3})?))?/,
  );
  const title = input.manualTitle || titleFromMeta || "Imported job";
  const company = input.manualCompany || companyFromMeta || inferCompanyFromHostname(input.url);
  const locationText =
    input.manualLocation ||
    extractMatch(/location[:\s]+([A-Z][A-Za-z0-9, .-]{2,})/i, combinedText);

  let locationType: string | null = null;
  if (/remote/i.test(combinedText)) {
    locationType = "remote";
  } else if (/hybrid/i.test(combinedText)) {
    locationType = "hybrid";
  } else if (/on-?site|in office/i.test(combinedText)) {
    locationType = "on-site";
  }

  let employmentType: string | null = null;
  if (/full[-\s]?time/i.test(combinedText)) {
    employmentType = "full-time";
  } else if (/part[-\s]?time/i.test(combinedText)) {
    employmentType = "part-time";
  } else if (/contract/i.test(combinedText)) {
    employmentType = "contract";
  }

  return {
    title: cleanTitle(title),
    company: company ? cleanText(company) : null,
    locationText,
    locationType,
    employmentType,
    rawText: combinedText,
    salaryMin: salaryMatch?.[1]
      ? Number(salaryMatch[1].replaceAll(",", ""))
      : null,
    salaryMax: salaryMatch?.[2]
      ? Number(salaryMatch[2].replaceAll(",", ""))
      : null,
  };
}
