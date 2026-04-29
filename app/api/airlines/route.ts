import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AirlineRow = {
  id: number;
  name: string;
  alias: string | null;
  iata_code: string | null;
  icao_code: string | null;
  callsign: string | null;
  country: string | null;
  active: string | null;
};

const popularAirlineCodes = [
  "AA",
  "DL",
  "UA",
  "WN",
  "B6",
  "AS",
  "NK",
  "F9",
  "G4",
  "HA",
  "AC",
  "WS",
  "BA",
  "LH",
  "AF",
  "KL",
  "IB",
  "VS",
  "EK",
  "QR",
  "TK",
  "SQ",
  "NH",
  "JL",
];

function sanitizeSearch(value: string) {
  return value.replace(/[%_,]/g, "").trim();
}

function airlineLabel(airline: AirlineRow) {
  const code = airline.iata_code ?? airline.icao_code ?? "";
  const icao = airline.icao_code ? ` — ${airline.icao_code}` : "";
  const country = airline.country ? ` — ${airline.country}` : "";

  return `${code} — ${airline.name}${icao}${country}`;
}

function mapAirline(airline: AirlineRow) {
  return {
    id: airline.id,
    name: airline.name,
    alias: airline.alias,
    iataCode: airline.iata_code,
    icaoCode: airline.icao_code,
    callsign: airline.callsign,
    country: airline.country,
    active: airline.active,
    label: airlineLabel(airline),
    value: airline.iata_code ?? airline.icao_code ?? airline.name,
  };
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);

  const rawQuery = searchParams.get("q") ?? "";
  const query = sanitizeSearch(rawQuery);
  const upperQuery = query.toUpperCase();

  if (query.length >= 2 && query.length <= 3) {
    const { data: exactCodeMatches, error: exactCodeError } = await supabase
      .from("airlines")
      .select("id, name, alias, iata_code, icao_code, callsign, country, active")
      .eq("active", "Y")
      .or(`iata_code.eq.${upperQuery},icao_code.eq.${upperQuery}`)
      .limit(10);

    if (exactCodeError) {
      return NextResponse.json(
        { error: exactCodeError.message },
        { status: 500 },
      );
    }

    if ((exactCodeMatches ?? []).length > 0) {
      return NextResponse.json({
        airlines: ((exactCodeMatches ?? []) as AirlineRow[]).map(mapAirline),
      });
    }
  }

  let airlineQuery = supabase
    .from("airlines")
    .select("id, name, alias, iata_code, icao_code, callsign, country, active")
    .eq("active", "Y")
    .limit(25);

  if (query.length >= 2) {
    const search = `%${query}%`;

    airlineQuery = airlineQuery.or(
      [
        `iata_code.ilike.${search}`,
        `icao_code.ilike.${search}`,
        `name.ilike.${search}`,
        `alias.ilike.${search}`,
        `callsign.ilike.${search}`,
        `country.ilike.${search}`,
      ].join(","),
    );
  } else {
    airlineQuery = airlineQuery.in("iata_code", popularAirlineCodes);
  }

  const { data, error } = await airlineQuery.order("name", {
    ascending: true,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    airlines: ((data ?? []) as AirlineRow[]).map(mapAirline),
  });
}