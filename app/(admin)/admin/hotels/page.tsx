import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { HotelLibraryPicker } from "@/components/forms/hotel-library-picker";
import type { HotelLibraryRow } from "@/components/forms/hotel-library-picker";
import { requireAdmin } from "@/lib/auth/require-admin";

type HotelLibraryAdminRow = HotelLibraryRow & {
  brand_name: string | null;
  formatted_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_room_notes: string | null;
  terms_notes: string | null;
  internal_notes: string | null;
  created_at: string | null;
};

function cleanText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function buildFormattedAddress(values: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  const cityLine = [
    values.city,
    values.state,
    values.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    values.addressLine1,
    values.addressLine2,
    cityLine,
    values.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function hotelMatchesSearch(hotel: HotelLibraryAdminRow, searchTerm: string) {
  if (!searchTerm) return true;

  const haystack = [
    hotel.hotel_name,
    hotel.brand_name,
    hotel.address_line_1,
    hotel.city,
    hotel.state,
    hotel.country,
    hotel.phone,
    hotel.website_url,
    hotel.contact_name,
    hotel.contact_email,
    hotel.contact_phone,
    hotel.preferred_room_notes,
    hotel.terms_notes,
    hotel.internal_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/admin/hotels"
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        name="q"
        type="search"
        placeholder="Search hotels, city, brand, contacts, notes..."
        defaultValue={defaultValue}
        className="input"
        style={{ flex: "1 1 320px", minWidth: 260 }}
      />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? (
        <Link href="/admin/hotels" className="btn btn-outline">Clear</Link>
      ) : null}
    </form>
  );
}

async function createHotel(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const addressLine1 = cleanText(formData, "address_line_1");
  const addressLine2 = cleanText(formData, "address_line_2");
  const city = cleanText(formData, "city");
  const state = cleanText(formData, "state");
  const postalCode = cleanText(formData, "postal_code");
  const country = cleanText(formData, "country");
  const hotelName = cleanText(formData, "hotel_name");

  if (!hotelName) {
    throw new Error("Hotel name is required.");
  }

  const formattedAddress = buildFormattedAddress({
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  });

  const { error } = await supabase
    .from("hotel_library")
    .insert({
      hotel_name: hotelName,
      brand_name: cleanText(formData, "brand_name"),
      google_place_id: cleanText(formData, "google_place_id"),
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      state,
      postal_code: postalCode,
      country,
      formatted_address: formattedAddress || null,
      phone: cleanText(formData, "phone"),
      website_url: cleanText(formData, "website_url"),
      google_maps_url: cleanText(formData, "google_maps_url"),
      contact_name: cleanText(formData, "contact_name"),
      contact_email: cleanText(formData, "contact_email"),
      contact_phone: cleanText(formData, "contact_phone"),
      preferred_room_notes: cleanText(formData, "preferred_room_notes"),
      terms_notes: cleanText(formData, "terms_notes"),
      internal_notes: cleanText(formData, "internal_notes"),
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/hotels");
  redirect("/admin/hotels?saved=1");
}

async function deleteHotel(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const hotelId = String(formData.get("hotel_id") ?? "").trim();

  if (!hotelId) throw new Error("Missing hotel ID.");

  const { error } = await supabase
    .from("hotel_library")
    .delete()
    .eq("id", hotelId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/hotels");
  redirect("/admin/hotels?deleted=1");
}

export default async function AdminHotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; deleted?: string }>;
}) {
  const { q, saved, deleted } = await searchParams;
  const searchTerm = String(q ?? "").trim();
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("hotel_library")
    .select("*")
    .order("hotel_name", { ascending: true });

  if (error) {
    return (
      <PageShell title="Hotels" subtitle="Save hotel addresses, contacts, and reusable booking notes.">
        <div className="card">
          <p><strong>Error loading hotels:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const allRows = (data ?? []) as HotelLibraryAdminRow[];
  const rows = allRows.filter((hotel) => hotelMatchesSearch(hotel, searchTerm));

  return (
    <PageShell title="Hotels" subtitle="Build a reusable hotel library as you plan trips.">
      {saved ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 900 }}>Hotel saved.</p>
        </div>
      ) : null}

      <div className="card stack">
        <div>
          <h2 style={{ margin: 0 }}>Add Hotel</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.5 }}>
            Search Google to fill the basics, then save your own contact notes, room preferences, and terms.
          </p>
        </div>

        <form action={createHotel} className="stack">
          <HotelLibraryPicker
            savedHotels={allRows}
            showContactFields
            title="Find or Enter Hotel"
            fieldNames={{
              hotelName: "hotel_name",
              googlePlaceId: "google_place_id",
              addressLine1: "address_line_1",
              addressLine2: "address_line_2",
              city: "city",
              state: "state",
              postalCode: "postal_code",
              country: "country",
              phone: "phone",
              websiteUrl: "website_url",
              googleMapsUrl: "google_maps_url",
            }}
          />

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Brand / Collection</span>
              <input className="input" name="brand_name" placeholder="Marriott, Hyatt, Sandals..." />
            </label>
            <label className="stack-sm">
              <span className="label">Main Contact Name</span>
              <input className="input" name="contact_name" />
            </label>
            <label className="stack-sm">
              <span className="label">Contact Email</span>
              <input className="input" name="contact_email" type="email" />
            </label>
            <label className="stack-sm">
              <span className="label">Contact Phone</span>
              <input className="input" name="contact_phone" />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Preferred Room / Booking Notes</span>
            <textarea className="textarea" name="preferred_room_notes" />
          </label>
          <label className="stack-sm">
            <span className="label">Supplier Terms / Conditions Notes</span>
            <textarea className="textarea" name="terms_notes" />
          </label>
          <label className="stack-sm">
            <span className="label">Internal Notes</span>
            <textarea className="textarea" name="internal_notes" />
          </label>

          <div>
            <button type="submit" className="btn btn-primary">
              Save Hotel
            </button>
          </div>
        </form>
      </div>

      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Saved Hotels</h2>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              Showing {rows.length} of {allRows.length} hotel record{allRows.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            {searchTerm
              ? "No hotels found. Try a broader search."
              : "No hotels saved yet. Add your first hotel above."}
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Location</th>
                  <th>Phone</th>
                  <th>Website</th>
                  <th>Contact</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((hotel) => {
                  const noteCount = [
                    hotel.preferred_room_notes,
                    hotel.terms_notes,
                    hotel.internal_notes,
                  ].filter(Boolean).length;

                  return (
                    <tr key={hotel.id}>
                      <td>
                        <strong>{hotel.hotel_name}</strong>
                        {hotel.brand_name ? (
                          <div style={{ color: "#64748b", fontSize: 13 }}>{hotel.brand_name}</div>
                        ) : null}
                      </td>
                      <td>
                        {[hotel.city, hotel.state, hotel.country].filter(Boolean).join(", ") || "-"}
                      </td>
                      <td>{hotel.phone || "-"}</td>
                      <td>
                        {hotel.website_url ? (
                          <a href={hotel.website_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-dark)", fontWeight: 800 }}>
                            Open
                          </a>
                        ) : "-"}
                      </td>
                      <td>
                        {hotel.contact_name || hotel.contact_email || hotel.contact_phone ? (
                          <div className="stack-sm">
                            {hotel.contact_name ? <span>{hotel.contact_name}</span> : null}
                            {hotel.contact_email ? <span>{hotel.contact_email}</span> : null}
                            {hotel.contact_phone ? <span>{hotel.contact_phone}</span> : null}
                          </div>
                        ) : "-"}
                      </td>
                      <td>{noteCount > 0 ? `${noteCount} saved` : "-"}</td>
                      <td>
                        <form action={deleteHotel}>
                          <input type="hidden" name="hotel_id" value={hotel.id} />
                          <button
                            type="submit"
                            className="btn btn-outline"
                            style={{ borderColor: "#fecaca", color: "#b42318" }}
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleted ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 900 }}>Hotel deleted.</p>
        </div>
      ) : null}
    </PageShell>
  );
}
