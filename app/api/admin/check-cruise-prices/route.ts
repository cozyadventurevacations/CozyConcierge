import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MIN_SAVINGS_AMOUNT = 100;
const SALE_WINDOW_DAYS = 5;
const SUPPORTED_CRUISE_LINES = [
  "royal caribbean",
  "celebrity",
  "norwegian",
  "ncl",
  "disney",
];

type TripComponentRow = {
  id: string;
  trip_id: string;
  display_name: string | null;
  supplier_name: string | null;
  booking_status: string | null;
  total_price: number | null;
  price_watch_enabled: boolean | null;
  price_watch_public_url: string | null;
  price_watch_match_code: string | null;
  price_watch_alerted_at?: string | null;
};

type CruiseComponentRow = {
  component_id: string;
  cruise_line: string | null;
  ship_name: string | null;
  sailing_date: string | null;
  cabin_category: string | null;
};

type TripRow = {
  id: string;
  trip_name: string | null;
  deleted_at?: string | null;
};

type WatchStatus =
  | "lower_price_found"
  | "no_lower_price"
  | "manual_review"
  | "error"
  | "skipped";

type PriceWatchSaleWindow = {
  label: string;
  date: string;
  type: "holiday" | "sale";
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (!cronSecret) return { ok: false, status: 500, error: "CRON_SECRET is not configured." };
  if (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret) {
    return { ok: true, status: 200, error: "" };
  }

  return { ok: false, status: 401, error: "Unauthorized." };
}

function getCruisePriceWatchSchemaErrorMessage(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  if (
    message.includes("price_watch_") ||
    message.includes("cruise_price_watch_results") ||
    message.includes("schema cache")
  ) {
    return "Cruise Price Watch needs a database setup step before it can be used.";
  }

  return null;
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeCabinMatchCode(value: string | null | undefined) {
  const raw = (value ?? "").trim().toUpperCase();
  const categoryPortion = raw.split(/[\/|,;]/)[0]?.trim() || raw;
  return normalizeCode(categoryPortion);
}

function cabinClassForMatchCode(value: string | null | undefined) {
  const code = normalizeCabinMatchCode(value);
  if (!code) return null;

  if (code.startsWith("H") || code.startsWith("S")) return "suite";
  if (code.startsWith("M")) return "club balcony";
  if (code.startsWith("B")) return "balcony";
  if (code.startsWith("O")) return "oceanview";
  if (code.startsWith("I") || code.startsWith("T")) return "inside";

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function supportedCruiseLine(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  return SUPPORTED_CRUISE_LINES.some((line) => normalized.includes(line));
}

function toUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const firstOfMonth = toUtcDate(year, monthIndex, 1);
  const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
  return toUtcDate(year, monthIndex, 1 + offset + (nth - 1) * 7);
}

function getLastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const lastOfMonth = toUtcDate(year, monthIndex + 1, 0);
  const offset = (lastOfMonth.getUTCDay() - weekday + 7) % 7;
  return toUtcDate(year, monthIndex, lastOfMonth.getUTCDate() - offset);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(left: Date, right: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate()) - Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate())) / msPerDay);
}

function getThanksgiving(year: number) {
  return getNthWeekdayOfMonth(year, 10, 4, 4);
}

function getHolidayAndSaleDates(year: number): PriceWatchSaleWindow[] {
  const thanksgiving = getThanksgiving(year);
  const blackFriday = addDays(thanksgiving, 1);
  const cyberMonday = addDays(thanksgiving, 4);
  const travelTuesday = addDays(thanksgiving, 5);

  return [
    { label: "New Year travel sale window", date: formatIsoDate(toUtcDate(year, 0, 1)), type: "sale" },
    { label: "MLK Day holiday sale window", date: formatIsoDate(getNthWeekdayOfMonth(year, 0, 1, 3)), type: "holiday" },
    { label: "Presidents Day holiday sale window", date: formatIsoDate(getNthWeekdayOfMonth(year, 1, 1, 3)), type: "holiday" },
    { label: "Memorial Day holiday sale window", date: formatIsoDate(getLastWeekdayOfMonth(year, 4, 1)), type: "holiday" },
    { label: "July 4 holiday sale window", date: formatIsoDate(toUtcDate(year, 6, 4)), type: "holiday" },
    { label: "Labor Day holiday sale window", date: formatIsoDate(getNthWeekdayOfMonth(year, 8, 1, 1)), type: "holiday" },
    { label: "Black Friday cruise sale window", date: formatIsoDate(blackFriday), type: "sale" },
    { label: "Cyber Monday cruise sale window", date: formatIsoDate(cyberMonday), type: "sale" },
    { label: "Travel Tuesday cruise sale window", date: formatIsoDate(travelTuesday), type: "sale" },
    { label: "Christmas holiday sale window", date: formatIsoDate(toUtcDate(year, 11, 25)), type: "holiday" },
  ];
}

function getActivePriceWatchSaleWindows(now = new Date()) {
  const today = toUtcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const years = [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1];
  const windows = years
    .flatMap(getHolidayAndSaleDates)
    .filter((window) => Math.abs(daysBetween(today, new Date(`${window.date}T00:00:00.000Z`))) <= SALE_WINDOW_DAYS);

  const isWaveSeason = today >= toUtcDate(today.getUTCFullYear(), 0, 1) && today <= toUtcDate(today.getUTCFullYear(), 2, 31);
  if (isWaveSeason) {
    windows.push({
      label: "Wave season cruise sale window",
      date: `${today.getUTCFullYear()}-01-01 to ${today.getUTCFullYear()}-03-31`,
      type: "sale",
    });
  }

  return windows;
}

function formatSaleWindowList(windows: PriceWatchSaleWindow[]) {
  return windows.map((window) => window.label).join(", ");
}

function hasSaleLanguage(text: string) {
  return /\b(sale|deal|offer|promo|promotion|bonus|onboard credit|free gratuities|kids sail free|reduced deposit|black friday|cyber monday|travel tuesday|wave season|holiday)\b/i.test(text);
}

function extractPromoCodes(text: string) {
  const promos = new Set<string>();
  const patterns = [
    /promo(?:tion)?\s+code\s*[:#-]?\s*([A-Z0-9-]{3,20})/gi,
    /offer\s+code\s*[:#-]?\s*([A-Z0-9-]{3,20})/gi,
    /code\s*[:#-]\s*([A-Z0-9-]{3,20})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) promos.add(match[1].toUpperCase());
    }
  }

  return Array.from(promos).slice(0, 5).join(", ") || null;
}

function extractMoneyValues(text: string) {
  const values: number[] = [];

  for (const match of text.matchAll(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g)) {
    const value = Number(match[1]?.replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 100 && value <= 100000) {
      values.push(value);
    }
  }

  return values;
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function normalizeOfferCategory(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function categoryMatchesCabinClass(category: string, cabinClass: string) {
  if (cabinClass === "club balcony") {
    return category.includes("club balcony") || category.includes("mini suite");
  }

  return category.includes(cabinClass);
}

function extractJsonLdBlocks(html: string) {
  const blocks: string[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    if (match[1]) blocks.push(match[1].trim());
  }

  return blocks;
}

function flattenJsonLdOffers(value: unknown): Array<{ name?: unknown; category?: unknown; price?: unknown; priceCurrency?: unknown }> {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLdOffers);
  }

  const record = value as Record<string, unknown>;
  const offers = record.offers;
  const nestedOffers = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const childOffers = Object.values(record).flatMap((child) => {
    if (child === offers) return [];
    return flattenJsonLdOffers(child);
  });

  return [
    ...nestedOffers
      .filter((offer): offer is Record<string, unknown> => Boolean(offer) && typeof offer === "object" && !Array.isArray(offer))
      .map((offer) => ({
        name: offer.name,
        category: offer.category,
        price: offer.price,
        priceCurrency: offer.priceCurrency,
      })),
    ...childOffers,
  ];
}

function extractStructuredCabinFare(html: string, cabinClass: string | null) {
  if (!cabinClass) return null;

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const offers = flattenJsonLdOffers(parsed);

      for (const offer of offers) {
        const category = normalizeOfferCategory(`${String(offer.name ?? "")} ${String(offer.category ?? "")}`);
        const price = Number(String(offer.price ?? "").replace(/,/g, ""));

        if (
          categoryMatchesCabinClass(category, cabinClass) &&
          Number.isFinite(price) &&
          price >= 100 &&
          price <= 100000
        ) {
          return {
            cabinClass,
            price,
            currency: String(offer.priceCurrency ?? "USD").toUpperCase(),
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isGenericCruiseLineUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "");
    return path === "" || path === "/" || path === "/en";
  } catch {
    return false;
  }
}

function parsePublicCruisePage({
  html,
  cabinMatchCode,
  bookedTotal,
  publicUrl,
  saleWindows,
}: {
  html: string;
  cabinMatchCode: string;
  bookedTotal: number;
  publicUrl: string;
  saleWindows: PriceWatchSaleWindow[];
}): {
  status: WatchStatus;
  foundTotal: number | null;
  savingsAmount: number | null;
  promoCodes: string | null;
  message: string;
} {
  const code = cabinMatchCode.trim();
  const promoCodes = extractPromoCodes(html);
  const saleWindowLabel = formatSaleWindowList(saleWindows);
  const hasActiveSaleWindow = saleWindows.length > 0;
  const hasVisibleSaleLanguage = hasSaleLanguage(html);
  const cabinClass = cabinClassForMatchCode(cabinMatchCode);
  const structuredCabinFare = extractStructuredCabinFare(html, cabinClass);
  const saleContextMessage =
    hasActiveSaleWindow
      ? ` This check ran during ${saleWindowLabel}; verify any holiday or major sale perks against the client booking.`
      : "";

  if (isGenericCruiseLineUrl(publicUrl)) {
    return {
      status: "manual_review",
      foundTotal: structuredCabinFare?.price ?? null,
      savingsAmount: null,
      promoCodes,
      message: `The saved public pricing URL is a cruise-line homepage, not a specific sailing or pricing page. Save the exact public pricing page for this ship, date, and cabin class so the checker can compare it.${saleContextMessage}`,
    };
  }

  if (!code) {
    return {
      status: "manual_review",
      foundTotal: null,
      savingsAmount: null,
      promoCodes,
      message: `No cabin category code was saved, so the app could not match exact room class.${saleContextMessage}`,
    };
  }

  if (structuredCabinFare) {
    return {
      status: "manual_review",
      foundTotal: structuredCabinFare.price,
      savingsAmount: null,
      promoCodes,
      message: `Found a public ${structuredCabinFare.cabinClass} cabin fare of ${formatMoney(structuredCabinFare.price)} ${structuredCabinFare.currency} per person. Review manually before comparing it to the booked total, because this page does not confirm the full booking total, taxes, fees, guests, or included perks.${saleContextMessage}`,
    };
  }

  const codePattern = new RegExp(`(^|[^A-Z0-9])${escapeRegExp(code)}([^A-Z0-9]|$)`, "i");
  const match = codePattern.exec(html);

  if (!match || typeof match.index !== "number") {
    return {
      status: "manual_review",
      foundTotal: null,
      savingsAmount: null,
      promoCodes,
      message: `Could not confirm exact cabin category ${code} on the public page.${saleContextMessage}`,
    };
  }

  const start = Math.max(0, match.index - 3000);
  const end = Math.min(html.length, match.index + 3000);
  const nearbyText = html.slice(start, end);
  const hasTotalLanguage =
    /\b(total|subtotal|grand total|cruise fare|stateroom price|room price|booking total)\b/i.test(nearbyText);
  const nearbyPrices = extractMoneyValues(nearbyText);

  if (nearbyPrices.length === 0) {
    return {
      status: "manual_review",
      foundTotal: null,
      savingsAmount: null,
      promoCodes,
      message: `Found cabin category ${code}, but no public price was visible near it.${saleContextMessage}`,
    };
  }

  if (!hasTotalLanguage) {
    return {
      status: "manual_review",
      foundTotal: Math.min(...nearbyPrices),
      savingsAmount: null,
      promoCodes,
      message: `Found cabin category ${code} and a visible price, but could not confirm it was the total booking price.${saleContextMessage}`,
    };
  }

  const foundTotal = Math.min(...nearbyPrices);
  const savingsAmount = Number((bookedTotal - foundTotal).toFixed(2));

  if (savingsAmount >= MIN_SAVINGS_AMOUNT) {
    return {
      status: "lower_price_found",
      foundTotal,
      savingsAmount,
      promoCodes,
      message: `Found a public price at least ${MIN_SAVINGS_AMOUNT.toLocaleString("en-US", { style: "currency", currency: "USD" })} lower for cabin category ${code}.${saleContextMessage}`,
    };
  }

  if (hasActiveSaleWindow && hasVisibleSaleLanguage) {
    return {
      status: "manual_review",
      foundTotal,
      savingsAmount,
      promoCodes,
      message: `Checked cabin category ${code} during ${saleWindowLabel}. The visible total was not at least ${MIN_SAVINGS_AMOUNT.toLocaleString("en-US", { style: "currency", currency: "USD" })} lower, but the public page appears to mention a holiday or major sale offer. Review perks, onboard credit, deposit terms, or promo codes before telling the client their booked price is still best.`,
    };
  }

  return {
    status: "no_lower_price",
    foundTotal,
    savingsAmount,
    promoCodes,
    message: `Checked cabin category ${code}; no qualifying lower public total was found.${saleContextMessage}`,
  };
}

async function runCruisePriceWatch() {
  const supabase = getSupabaseAdminClient();
  const saleWindows = getActivePriceWatchSaleWindows();

  const { data: componentsData, error: componentsError } = await supabase
    .from("trip_components")
    .select("id, trip_id, display_name, supplier_name, booking_status, total_price, price_watch_enabled, price_watch_public_url, price_watch_match_code, price_watch_alerted_at")
    .eq("component_type", "cruise")
    .eq("price_watch_enabled", true)
    .not("price_watch_public_url", "is", null);

  if (componentsError) {
    throw new Error(
      getCruisePriceWatchSchemaErrorMessage(componentsError) ??
        componentsError.message,
    );
  }

  const components = (componentsData ?? []) as TripComponentRow[];
  const componentIds = components.map((component) => component.id);
  const tripIds = Array.from(new Set(components.map((component) => component.trip_id)));

  const [{ data: cruisesData }, { data: tripsData }] = await Promise.all([
    componentIds.length
      ? supabase
          .from("cruise_components")
          .select("component_id, cruise_line, ship_name, sailing_date, cabin_category")
          .in("component_id", componentIds)
      : Promise.resolve({ data: [] }),
    tripIds.length
      ? supabase
          .from("trips")
          .select("id, trip_name, deleted_at")
          .in("id", tripIds)
      : Promise.resolve({ data: [] }),
  ]);

  const cruisesByComponentId = new Map(
    ((cruisesData ?? []) as CruiseComponentRow[]).map((cruise) => [cruise.component_id, cruise]),
  );
  const tripsById = new Map(((tripsData ?? []) as TripRow[]).map((trip) => [trip.id, trip]));
  const results: Array<{ componentId: string; status: WatchStatus; message: string }> = [];

  for (const component of components) {
    const trip = tripsById.get(component.trip_id);
    const cruise = cruisesByComponentId.get(component.id);
    const bookedTotal = Number(component.total_price ?? 0);
    const publicUrl = component.price_watch_public_url?.trim() ?? "";
    const cruiseLine = cruise?.cruise_line ?? component.supplier_name ?? component.display_name;
    const cabinMatchCode = normalizeCabinMatchCode(component.price_watch_match_code || cruise?.cabin_category);

    if (trip?.deleted_at) {
      results.push({ componentId: component.id, status: "skipped", message: "Trip is deleted." });
      continue;
    }

    if (!supportedCruiseLine(cruiseLine)) {
      results.push({ componentId: component.id, status: "skipped", message: "Cruise line is not enabled for public price watch yet." });
      continue;
    }

    if (!bookedTotal || bookedTotal <= 0) {
      results.push({ componentId: component.id, status: "manual_review", message: "Booked cruise total is missing." });
      continue;
    }

    try {
      const response = await fetch(publicUrl, {
        headers: {
          "user-agent": "CozyConciergePriceWatch/1.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`Public page returned HTTP ${response.status}.`);
      }

      const html = await response.text();
      const parsed = parsePublicCruisePage({ html, cabinMatchCode, bookedTotal, publicUrl, saleWindows });

      await supabase.from("cruise_price_watch_results").insert({
        trip_id: component.trip_id,
        component_id: component.id,
        cruise_line: cruiseLine,
        ship_name: cruise?.ship_name ?? component.display_name,
        sailing_date: cruise?.sailing_date ?? null,
        cabin_match_code: cabinMatchCode || null,
        booked_total: bookedTotal,
        found_total: parsed.foundTotal,
        savings_amount: parsed.savingsAmount,
        promo_codes: parsed.promoCodes,
        status: parsed.status,
        public_url: publicUrl,
        message: parsed.message,
      });

      const updatePayload: Record<string, unknown> = {
        price_watch_last_checked_at: new Date().toISOString(),
        price_watch_last_status: parsed.status,
        price_watch_last_found_price: parsed.foundTotal,
        price_watch_last_promo_codes: parsed.promoCodes,
        price_watch_last_error: ["error", "manual_review"].includes(parsed.status) ? parsed.message : null,
      };

      if (parsed.status === "lower_price_found") {
        updatePayload.price_watch_alerted_at = new Date().toISOString();
      }

      await supabase.from("trip_components").update(updatePayload).eq("id", component.id);
      results.push({ componentId: component.id, status: parsed.status, message: parsed.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown price watch error.";

      await supabase.from("cruise_price_watch_results").insert({
        trip_id: component.trip_id,
        component_id: component.id,
        cruise_line: cruiseLine,
        ship_name: cruise?.ship_name ?? component.display_name,
        sailing_date: cruise?.sailing_date ?? null,
        cabin_match_code: cabinMatchCode || null,
        booked_total: bookedTotal,
        found_total: null,
        savings_amount: null,
        promo_codes: null,
        status: "error",
        public_url: publicUrl,
        message,
      });

      await supabase
        .from("trip_components")
        .update({
          price_watch_last_checked_at: new Date().toISOString(),
          price_watch_last_status: "error",
          price_watch_last_error: message,
        })
        .eq("id", component.id);

      results.push({ componentId: component.id, status: "error", message });
    }
  }

  return {
    checkedCount: components.length,
    lowerPriceCount: results.filter((result) => result.status === "lower_price_found").length,
    manualReviewCount: results.filter((result) => result.status === "manual_review").length,
    errorCount: results.filter((result) => result.status === "error").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    results,
  };
}

export async function GET(request: Request) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runCruisePriceWatch();
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
