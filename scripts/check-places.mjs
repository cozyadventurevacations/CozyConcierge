import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_PLACES_API_KEY?.trim();
if (!key) {
  console.error("Set the server-only GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY.");
  process.exit(1);
}

try {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({ input: "1600 Amphitheatre Parkway", includedRegionCodes: ["us"] }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  console.log("Places API (New) autocomplete: HTTP " + response.status);
  if (!response.ok) {
    console.error(data.error?.status + ": " + data.error?.message);
    console.error("Check Places API (New) is enabled, billing is active, and the key allows this server request.");
    console.error("Use a separate server key from any browser key; never expose it with NEXT_PUBLIC_.");
    process.exitCode = 1;
  } else {
    const prediction = data.suggestions?.find((item) => item.placePrediction?.placeId)?.placePrediction;
    if (!prediction) throw new Error("No predictions returned for the public sample address.");
    console.log("Suggestions returned: " + data.suggestions.length);
    const details = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(prediction.placeId), {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,formattedAddress" },
      signal: AbortSignal.timeout(15000),
    });
    const address = await details.json();
    console.log("Places API (New) details: HTTP " + details.status);
    if (!details.ok || !address.addressComponents?.length) {
      throw new Error(address.error?.message || "No address components returned.");
    }
    console.log("Public sample address: " + address.formattedAddress);
  }
} catch (error) {
  console.error("Places check failed: " + error.message);
  process.exitCode = 1;
}
