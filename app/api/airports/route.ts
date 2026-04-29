import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AirportRow = {
  id: number;
  iata_code: string | null;
  gps_code: string | null;
  name: string;
  municipality: string | null;
  iso_country: string | null;
  iso_region: string | null;
  scheduled_service: string | null;
};

const popularAirportCodes = [
  "ORD",
  "MDW",
  "MCO",
  "LAX",
  "JFK",
  "EWR",
  "LGA",
  "DFW",
  "ATL",
  "DEN",
  "LAS",
  "PHX",
  "SEA",
  "SFO",
  "MIA",
  "FLL",
  "TPA",
  "BOS",
  "MSP",
  "DTW",
  "LHR",
  "CDG",
  "FCO",
  "AMS",
  "CUN",
];

function sanitizeSearch(value: string) {
  return value.replace(/[%_,]/g, "").trim();
}

function airportLabel(airport: AirportRow) {
  const code = airport.iata_code ?? airport.gps_code ?? "";
  const city = airport.municipality ? ` — ${airport.municipality}` : "";
  const country = airport.iso_country ? `, ${airport.iso_country}` : "";

  return `${code} — ${airport.name}${city}${country}`;
}

function mapAirport(airport: AirportRow) {
  return {
    id: airport.id,
    iataCode: airport.iata_code,
    gpsCode: airport.gps_code,
    name: airport.name,
    municipality: airport.municipality,
    isoCountry: airport.iso_country,
    isoRegion: airport.iso_region,
    scheduledService: airport.scheduled_service,
    label: airportLabel(airport),
    value: airport.iata_code ?? airport.gps_code ?? airport.name,
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
      .from("airports")
      .select(
        "id, iata_code, gps_code, name, municipality, iso_country, iso_region, scheduled_service",
      )
      .eq("iata_code", upperQuery)
      .limit(10);

    if (exactCodeError) {
      return NextResponse.json(
        {
          error: exactCodeError.message,
        },
        {
          status: 500,
        },
      );
    }

    if ((exactCodeMatches ?? []).length > 0) {
      return NextResponse.json({
        airports: ((exactCodeMatches ?? []) as AirportRow[]).map(mapAirport),
      });
    }
  }

  let airportQuery = supabase
    .from("airports")
    .select(
      "id, iata_code, gps_code, name, municipality, iso_country, iso_region, scheduled_service",
    )
    .not("iata_code", "is", null)
    .limit(25);

  if (query.length >= 2) {
    const search = `%${query}%`;

    airportQuery = airportQuery.or(
      [
        `iata_code.ilike.${search}`,
        `gps_code.ilike.${search}`,
        `name.ilike.${search}`,
        `municipality.ilike.${search}`,
        `iso_country.ilike.${search}`,
        `iso_region.ilike.${search}`,
      ].join(","),
    );
  } else {
    airportQuery = airportQuery.in("iata_code", popularAirportCodes);
  }

  const { data, error } = await airportQuery.order("iata_code", {
    ascending: true,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    airports: ((data ?? []) as AirportRow[]).map(mapAirport),
  });
}