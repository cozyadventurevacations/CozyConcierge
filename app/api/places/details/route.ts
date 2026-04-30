import { NextResponse } from "next/server";

type DetailsRequestBody = {
  placeId?: string;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function getComponent(
  components: GoogleAddressComponent[] | undefined,
  type: string,
  useShortText = false,
) {
  const component = components?.find((item) => item.types?.includes(type));

  if (!component) return "";

  return useShortText ? component.shortText ?? "" : component.longText ?? "";
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as DetailsRequestBody;
  const placeId = String(body.placeId ?? "").trim();

  if (!placeId) {
    return NextResponse.json(
      { error: "Missing placeId." },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "addressComponents,formattedAddress",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    return NextResponse.json(
      {
        error: "Google Places details request failed.",
        details: errorText,
      },
      { status: response.status },
    );
  }

  const data = await response.json();

  const streetNumber = getComponent(data.addressComponents, "street_number");
  const route = getComponent(data.addressComponents, "route");
  const city =
    getComponent(data.addressComponents, "locality") ||
    getComponent(data.addressComponents, "sublocality") ||
    getComponent(data.addressComponents, "postal_town");
  const state = getComponent(
    data.addressComponents,
    "administrative_area_level_1",
    true,
  );
  const postalCode = getComponent(data.addressComponents, "postal_code");
  const postalCodeSuffix = getComponent(
    data.addressComponents,
    "postal_code_suffix",
  );

  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  const fullPostalCode = [postalCode, postalCodeSuffix]
    .filter(Boolean)
    .join("-");

  return NextResponse.json({
    address: {
      addressLine1,
      city,
      state,
      postalCode: fullPostalCode,
      formattedAddress: data.formattedAddress ?? "",
    },
  });
}