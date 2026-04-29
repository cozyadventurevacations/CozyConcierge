import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const AIRLINES_DATA_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";

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

if (
  SUPABASE_SERVICE_ROLE_KEY === "your_service_role_key" ||
  SUPABASE_SERVICE_ROLE_KEY === "your_new_secret_key_here"
) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is still using a placeholder value. Replace it with your real Supabase secret key.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;

  const numberValue = Number.parseInt(value, 10);

  return Number.isNaN(numberValue) ? null : numberValue;
}

function toText(value) {
  if (value === undefined || value === null) return null;

  const textValue = String(value).trim();

  if (!textValue || textValue === "\\N") return null;

  return textValue;
}

function normalizeCode(value) {
  const textValue = toText(value);

  if (!textValue) return null;

  return textValue.toUpperCase();
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
console.log("Downloading airline dataset...");

const response = await fetch(AIRLINES_DATA_URL);

if (!response.ok) {
  throw new Error(`Failed to download airlines data. Status: ${response.status}`);
}

const rawText = await response.text();

console.log("Parsing airline dataset...");

const records = parse(rawText, {
  columns: false,
  skip_empty_lines: true,
  relax_quotes: true,
});

console.log(`Raw airline records found: ${records.length}`);

const airlines = records
  .map((record) => {
    const id = toInteger(record[0]);
    const name = toText(record[1]);
    const alias = toText(record[2]);
    const iataCode = normalizeCode(record[3]);
    const icaoCode = normalizeCode(record[4]);
    const callsign = toText(record[5]);
    const country = toText(record[6]);
    const active = normalizeCode(record[7]);

    return {
      id,
      name,
      alias,
      iata_code: iataCode,
      icao_code: icaoCode,
      callsign,
      country,
      active,
      source: "openflights",
      updated_at: new Date().toISOString(),
    };
  })
  .filter((airline) => {
    if (!airline.id || !airline.name) return false;

    const hasUsefulCode = Boolean(airline.iata_code || airline.icao_code);

    if (!hasUsefulCode) return false;

    return airline.active === "Y";
  });

console.log(`Filtered active airlines found: ${airlines.length}`);

const chunks = chunkArray(airlines, 500);

let completed = 0;

for (const chunk of chunks) {
  const { error } = await supabase.from("airlines").upsert(chunk, {
    onConflict: "id",
  });

  if (error) {
    console.error("Airline import failed.");
    console.error(error);
    process.exit(1);
  }

  completed += chunk.length;

  console.log(`Imported ${completed} of ${airlines.length} airlines...`);
}

console.log("Airline import complete.");