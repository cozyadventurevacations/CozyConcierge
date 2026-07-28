import { createClient } from "@supabase/supabase-js";

type BookingWindowWatchRow = {
  id: string;
  supplier_name_snapshot: string | null;
  product_type: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  flexible_window: string | null;
  traveler_count: number | null;
  target_year: number | null;
  check_url: string | null;
  suppliers:
    | {
        supplier_name: string | null;
        website_url: string | null;
        booking_portal_url: string | null;
      }
    | {
        supplier_name: string | null;
        website_url: string | null;
        booking_portal_url: string | null;
      }[]
    | null;
};

type WatchStatus = "open" | "not_open" | "manual_review" | "error";

type WatchCheckResult = {
  watchId: string;
  status: WatchStatus;
  checkedUrl: string | null;
  message: string;
  foundStartDate?: string | null;
  foundEndDate?: string | null;
  rawExcerpt?: string | null;
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

function supplierFromWatch(watch: BookingWindowWatchRow) {
  if (Array.isArray(watch.suppliers)) return watch.suppliers[0] ?? null;
  return watch.suppliers ?? null;
}

function resolveCheckUrl(watch: BookingWindowWatchRow) {
  const supplier = supplierFromWatch(watch);
  return (
    watch.check_url?.trim() ||
    supplier?.booking_portal_url?.trim() ||
    supplier?.website_url?.trim() ||
    null
  );
}

function normalizeText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateForSearch(value: string | null | undefined) {
  if (!value) return [];
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return [value];

  const date = new Date(Date.UTC(year, month - 1, day));
  const monthLong = date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const monthShort = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const dayNoPad = String(day);

  return [
    value,
    `${monthLong} ${dayNoPad}, ${year}`,
    `${monthShort} ${dayNoPad}, ${year}`,
    `${month}/${day}/${year}`,
    `${month}-${day}-${year}`,
  ];
}

function includesAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

function excerptAround(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  const index = needles
    .map((needle) => lower.indexOf(needle.toLowerCase()))
    .filter((value) => value >= 0)
    .sort((a, b) => a - b)[0];

  if (index === undefined) return text.slice(0, 500);
  return text.slice(Math.max(0, index - 220), Math.min(text.length, index + 320));
}

function getTargetYear(watch: BookingWindowWatchRow) {
  if (watch.target_year) return String(watch.target_year);
  if (watch.start_date) return watch.start_date.slice(0, 4);
  if (watch.end_date) return watch.end_date.slice(0, 4);
  return null;
}

function parseAvailability(text: string, watch: BookingWindowWatchRow, checkedUrl: string): Omit<WatchCheckResult, "watchId" | "checkedUrl"> {
  const targetYear = getTargetYear(watch);
  const dateTerms = [
    ...formatDateForSearch(watch.start_date),
    ...formatDateForSearch(watch.end_date),
    targetYear,
  ].filter((term): term is string => Boolean(term));
  const destinationTerms = (watch.destination ?? "")
    .split(/[,\-/|]/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4);
  const positiveTerms = [
    "book now",
    "check availability",
    "select",
    "view dates",
    "available",
    "sailings",
    "packages",
    "offers",
    "rooms",
    "tickets",
  ];
  const notOpenTerms = [
    "not yet available",
    "not available for your dates",
    "no matching",
    "no cruises found",
    "no results",
    "check back",
    "not currently available",
    "vacation packages are not yet available",
  ];

  const hasTargetDate = dateTerms.length === 0 || includesAny(text, dateTerms);
  const hasDestination = destinationTerms.length === 0 || includesAny(text, destinationTerms);
  const hasPositiveSignal = includesAny(text, positiveTerms);
  const hasNotOpenSignal = includesAny(text, notOpenTerms);
  const sourceLabel = new URL(checkedUrl).hostname.replace(/^www\./, "");

  if (hasTargetDate && hasDestination && hasPositiveSignal && !hasNotOpenSignal) {
    return {
      status: "open",
      message: `Booking appears open on ${sourceLabel}. The page contains the target date or year plus availability/booking language. Verify details before quoting.`,
      foundStartDate: watch.start_date,
      foundEndDate: watch.end_date,
      rawExcerpt: excerptAround(text, [...dateTerms, ...positiveTerms]),
    };
  }

  if (hasNotOpenSignal || (targetYear && !text.includes(targetYear))) {
    return {
      status: "not_open",
      message: targetYear && !text.includes(targetYear)
        ? `Booking does not appear open yet. The checked page did not show ${targetYear}.`
        : "Booking does not appear open yet. The checked page includes not-available or check-back language.",
      foundStartDate: null,
      foundEndDate: null,
      rawExcerpt: excerptAround(text, [...dateTerms, ...notOpenTerms]),
    };
  }

  return {
    status: "manual_review",
    message: "The checker could not confidently determine whether the booking window is open. Review the source page manually.",
    foundStartDate: null,
    foundEndDate: null,
    rawExcerpt: excerptAround(text, [...dateTerms, ...destinationTerms, ...positiveTerms]),
  };
}

async function checkOneWatch(watch: BookingWindowWatchRow): Promise<WatchCheckResult> {
  const checkedUrl = resolveCheckUrl(watch);

  if (!checkedUrl) {
    return {
      watchId: watch.id,
      status: "manual_review",
      checkedUrl: null,
      message: "No check URL is available. Add a watch-specific URL or supplier booking/public website URL.",
      rawExcerpt: null,
    };
  }

  try {
    const response = await fetch(checkedUrl, {
      headers: {
        "user-agent": "CozyConciergeBookingWindowWatch/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        watchId: watch.id,
        status: "error",
        checkedUrl,
        message: `Source returned HTTP ${response.status}.`,
        rawExcerpt: null,
      };
    }

    const html = await response.text();
    const text = normalizeText(html);
    const parsed = parseAvailability(text, watch, checkedUrl);

    return {
      watchId: watch.id,
      checkedUrl,
      ...parsed,
    };
  } catch (error) {
    return {
      watchId: watch.id,
      status: "error",
      checkedUrl,
      message: error instanceof Error ? error.message : "Unknown booking window check error.",
      rawExcerpt: null,
    };
  }
}

export async function runBookingWindowWatch(options: { watchId?: string } = {}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("booking_window_watches")
    .select("id, supplier_name_snapshot, product_type, destination, start_date, end_date, flexible_window, traveler_count, target_year, check_url, suppliers(supplier_name, website_url, booking_portal_url)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (options.watchId) {
    query = query.eq("id", options.watchId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const watches = (data ?? []) as BookingWindowWatchRow[];
  const results: WatchCheckResult[] = [];

  for (const watch of watches) {
    const result = await checkOneWatch(watch);
    results.push(result);

    await supabase.from("booking_window_watch_results").insert({
      watch_id: result.watchId,
      status: result.status,
      checked_url: result.checkedUrl,
      found_start_date: result.foundStartDate ?? null,
      found_end_date: result.foundEndDate ?? null,
      message: result.message,
      raw_excerpt: result.rawExcerpt?.slice(0, 1000) ?? null,
    });

    await supabase
      .from("booking_window_watches")
      .update({
        last_checked_at: new Date().toISOString(),
        last_status: result.status,
        last_message: result.message,
        last_open_url: result.status === "open" ? result.checkedUrl : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", result.watchId);
  }

  return {
    checkedCount: results.length,
    openCount: results.filter((result) => result.status === "open").length,
    notOpenCount: results.filter((result) => result.status === "not_open").length,
    manualReviewCount: results.filter((result) => result.status === "manual_review").length,
    errorCount: results.filter((result) => result.status === "error").length,
    results,
  };
}
