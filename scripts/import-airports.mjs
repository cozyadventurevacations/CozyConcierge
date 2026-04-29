import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const AIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(`Could not find .env.local at ${envPath}`);
  }

  const envText = fs.readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const equalsIndex = trimmedLine.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = trimmedLine.slice(0, equalsIndex).trim();
    let value = trimmedLine.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in your .env.local file.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in your .env.local file.");
}

if (SUPABASE_SERVICE_ROLE_KEY === "your_service_role_key") {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is still using the placeholder value. Replace it with your real Supabase secret key.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;

  const numberValue = Number(value);

  return Number.isNaN(numberValue) ? null : numberValue;
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;

  const numberValue = Number.parseInt(value, 10);

  return Number.isNaN(numberValue) ? null : numberValue;
}

function toText(value) {
  if (value === undefined || value === null) return null;

  const textValue = String(value).trim();

  return textValue || null;
}

function toTimestamp(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

console.log("Supabase URL loaded:", Boolean(SUPABASE_URL));
console.log("Supabase secret key loaded:", Boolean(SUPABASE_SERVICE_ROLE_KEY));
console.log("Downloading airport dataset...");

const response = await fetch(AIRPORTS_CSV_URL);

if (!response.ok) {
  throw new Error(`Failed to download airports CSV. Status: ${response.status}`);
}

const csvText = await response.text();

console.log("Parsing airport dataset...");

const records = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`Raw records found: ${records.length}`);

const filteredAirports = records
  .filter((record) => {
    const scheduledService = String(record.scheduled_service ?? "")
      .trim()
      .toLowerCase();

    const iataCode = String(record.iata_code ?? "").trim();

    const airportType = String(record.type ?? "").trim();

    return (
      scheduledService === "yes" &&
      iataCode.length === 3 &&
      airportType !== "closed"
    );
  })
  .map((record) => ({
    id: toInteger(record.id),
    ident: toText(record.ident),
    airport_type: toText(record.type),
    name: toText(record.name),
    latitude_deg: toNumber(record.latitude_deg),
    longitude_deg: toNumber(record.longitude_deg),
    elevation_ft: toInteger(record.elevation_ft),
    continent: toText(record.continent),
    iso_country: toText(record.iso_country),
    iso_region: toText(record.iso_region),
    municipality: toText(record.municipality),
    scheduled_service: toText(record.scheduled_service),
    gps_code: toText(record.gps_code),
    iata_code: toText(record.iata_code),
    local_code: toText(record.local_code),
    home_link: toText(record.home_link),
    wikipedia_link: toText(record.wikipedia_link),
    keywords: toText(record.keywords),
    score: toInteger(record.score),
    last_updated: toTimestamp(record.last_updated),
    updated_at: new Date().toISOString(),
  }))
  .filter((airport) => airport.id && airport.name && airport.iata_code);

console.log(`Filtered airline-service airports found: ${filteredAirports.length}`);

const chunks = chunkArray(filteredAirports, 500);

let completed = 0;

for (const chunk of chunks) {
  const { error } = await supabase.from("airports").upsert(chunk, {
    onConflict: "id",
  });

  if (error) {
    console.error("Airport import failed.");
    console.error(error);
    process.exit(1);
  }

  completed += chunk.length;

  console.log(`Imported ${completed} of ${filteredAirports.length} airports...`);
}

console.log("Airport import complete.");