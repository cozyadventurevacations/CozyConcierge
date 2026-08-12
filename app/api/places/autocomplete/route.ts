import { NextResponse } from "next/server";

type AutocompleteRequestBody = {
  input?: string;
};

export async function POST(request: Request) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as AutocompleteRequestBody;
  const input = String(body.input ?? "").trim();

  if (input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["us"],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let googleMessage = "";

    try {
      const googleError = JSON.parse(errorText) as {
        error?: { message?: string; status?: string };
      };
      googleMessage = [
        googleError.error?.status,
        googleError.error?.message,
      ]
        .filter(Boolean)
        .join(": ");
    } catch {
      googleMessage = errorText;
    }

    return NextResponse.json(
      {
        error:
          googleMessage ||
          "Google Places autocomplete request failed.",
        details: errorText,
      },
      { status: response.status },
    );
  }

  const data = await response.json();

  const suggestions =
    data.suggestions
      ?.map(
        (suggestion: {
          placePrediction?: {
            placeId?: string;
            text?: {
              text?: string;
            };
          };
        }) => ({
          placeId: suggestion.placePrediction?.placeId ?? "",
          text: suggestion.placePrediction?.text?.text ?? "",
        }),
      )
      .filter((suggestion: { placeId: string; text: string }) => {
        return suggestion.placeId && suggestion.text;
      }) ?? [];

  return NextResponse.json({ suggestions });
}
